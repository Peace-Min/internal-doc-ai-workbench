import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createLlmAdapter } from './llm.mjs';
import { loadLlmConfig } from './config.mjs';
import '../plugin/contract.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const contract = globalThis.WorkbenchContract;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
const STATIC = new Set(['index.html', 'app.js', 'style.css', 'contract.js', 'editor-command.js', 'config.json', 'icon.svg', 'vendor/plugins.js', 'vendor/AGPL-3.0.txt', 'THIRD_PARTY_NOTICES.md', 'notices.html', 'LICENSE']);

async function readLimited(stream, limit = 65536) {
  const parts = []; let length = 0;
  for await (const chunk of stream) {
    length += chunk.length;
    if (length > limit) throw Object.assign(new Error('요청 또는 응답이 너무 큽니다.'), { status: 413 });
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts).toString('utf8');
}
export function createWorkbenchServer(options = {}) {
  const token = options.token;
  if (typeof token !== 'string' || token.length < 24) throw new Error('연결 코드는 24자 이상이어야 합니다.');
  const mode = options.mode || 'mock';
  const propose = createLlmAdapter({ ...options, mode });
  // Desktop Editors 10.0.0 on Windows sends Origin: file:// for local plugins.
  const origins = new Set(options.origins || ['null', 'file://']);
  const expectedToken = Buffer.from(`Bearer ${token}`);
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    const address = server.address();
    const allowedHosts = new Set([`127.0.0.1:${address.port}`, `localhost:${address.port}`]);
    if (!allowedHosts.has(req.headers.host)) return send(403, { error: '로컬 주소만 허용합니다.' });
    const origin = req.headers.origin;
    if (origin && !origins.has(origin) && ![`http://127.0.0.1:${address.port}`, `http://localhost:${address.port}`].includes(origin)) return send(403, { error: '허용되지 않은 플러그인 출처입니다.' });
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }); return res.end();
    }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const supplied = Buffer.from(req.headers.authorization || '');
      if (supplied.length !== expectedToken.length || !timingSafeEqual(supplied, expectedToken)) return send(401, { error: '연결 코드를 확인하세요.' });
      if (req.method === 'GET' && pathname === '/api/health') return send(200, { mode, version: '0.3.1' });
      if (req.method !== 'POST' || pathname !== '/api/propose') return send(404, { error: '지원하지 않는 경로입니다.' });
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'JSON 요청만 지원합니다.' });
      try {
        const input = contract.validateRequest(JSON.parse(await readLimited(req)));
        const proposedText = await propose(input);
        send(200, { operation: 'replace_text', proposedText: contract.validateProposal(proposedText), mode });
      } catch (error) {
        const upstreamError = ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name);
        send(error.status || (upstreamError ? 502 : 400), { error: upstreamError ? 'LLM 연결 실패 또는 응답 시간 초과입니다.' : '요청 또는 수정안 형식이 올바르지 않습니다.' });
      }
      return;
    }
    if (req.method !== 'GET') return send(405, { error: 'GET만 허용합니다.' });
    const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    if (!STATIC.has(file)) return send(404, { error: '파일이 없습니다.' });
    try {
      const content = await readFile(file === 'LICENSE' ? path.join(root, file) : path.join(root, 'plugin', file));
      res.writeHead(200, { 'Content-Type': file === 'LICENSE' ? 'text/plain; charset=utf-8' : MIME[path.extname(file)] || 'application/octet-stream' }); res.end(content);
    } catch { send(404, { error: '파일이 없습니다.' }); }
  });
  server.requestTimeout = 40000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.WB_PORT || 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WB_PORT를 확인하세요.');
  const token = process.env.WB_TOKEN || randomBytes(24).toString('hex');
  const llmConfig = await loadLlmConfig();
  const server = createWorkbenchServer({ ...llmConfig, token, origins: (process.env.WB_PLUGIN_ORIGINS || 'null,file://').split(',').map(s => s.trim()) });
  await mkdir(path.join(root, 'private'), { recursive: true });
  await writeFile(path.join(root, 'private/runtime.json'), JSON.stringify({ url: `http://127.0.0.1:${port}`, token }, null, 2), { mode: 0o600 });
  server.listen(port, '127.0.0.1', () => console.log(`Local bridge: http://127.0.0.1:${port}/?demo=1\nPairing code: private/runtime.json\nMode: ${process.env.WB_MODE || 'mock'}`));
}
