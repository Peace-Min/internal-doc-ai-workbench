import { fileURLToPath } from 'node:url';

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 14)) throw Object.assign(new Error(), { code: 'NODE_VERSION' });
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw Object.assign(new Error(), { code: 'ARGUMENTS' });
  process.chdir(fileURLToPath(new URL('../', import.meta.url)));
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { prepareWorkbench, startWorkbench } = await import('../src/server.mjs');
  if (args[0] === '--check') {
    const { mode } = await prepareWorkbench();
    console.log(JSON.stringify({ ok: true, mode, networkRequestSent: false, portAvailabilityChecked: false }));
  } else {
    const { server, url, mode } = await startWorkbench();
    console.log(`Workbench ready: ${url}/?demo=1\nMode: ${mode}\nConnection code: private/runtime.json\nKeep this window open. Press Ctrl+C to stop.`);
    const stop = () => { server.closeAllConnections(); server.close(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
} catch (error) {
  const messages = {
    NODE_VERSION: 'Node.js 22.14.0 or later is required.',
    ARGUMENTS: 'Usage: node scripts/launch.mjs [--check]',
    EADDRINUSE: 'The service port is already in use. Keep the existing service or change WB_PORT in .env.',
    EACCES: 'Access denied. Check folder permissions and the service port.',
    EPERM: 'Access denied. Check folder permissions.'
  };
  console.error(messages[error.code] || 'Startup failed. Check the local .env file and LLM settings. Private details were omitted.');
  process.exitCode = 1;
}
