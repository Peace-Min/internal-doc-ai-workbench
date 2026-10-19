async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.getByRole('combobox', { name: '선택 개체', exact: true }).selectOption('one');
  await page.getByRole('textbox', { name: '문서 내용 (직접 변경 가능)' }).fill('합성 프로젝트는 다음 주 시작합니다.');
  await page.getByRole('combobox', { name: '선택 개체', exact: true }).selectOption('two');
  await page.getByRole('textbox', { name: '문서 내용 (직접 변경 가능)' }).fill('승인 조건은 예산 검토입니다.');
  await page.getByRole('combobox', { name: '작업', exact: true }).selectOption('summarize');
  await page.getByRole('combobox', { name: '분석 범위', exact: true }).selectOption('document');
  await page.getByRole('button', { name: '문서 텍스트 읽기' }).click();
  const source = await page.locator('#source').textContent();
  check(source.includes('[슬라이드 1 · 개체 1]') && source.includes('[슬라이드 2 · 개체 1]'), 'missing slide provenance');
  check(source.includes('다음 주 시작') && source.includes('예산 검토'), 'document only read selected object');
  check((await page.locator('#coverage').textContent()).includes('이미지·표·그룹'), 'missing coverage warning');
  let sent = 0;
  await page.route('**/api/propose', async route => {
    const body = route.request().postDataJSON();
    check(body.text === source, 'sent content differs from preview');
    sent++;
    await route.fulfill({ json: { operation: 'summarize', answer: '다음 주 시작 [슬라이드 1 · 개체 1]\n예산 검토 승인 필요 [슬라이드 2 · 개체 1]', mode: 'openai-compatible' } });
  });
  await page.getByRole('button', { name: '요약하기', exact: true }).click();
  await page.locator('#answer-section').waitFor();
  check(!await page.getByRole('button', { name: '원래 개체에 적용' }).isVisible(), 'document answer can apply');
  check(await page.locator('#demo-text').inputValue() === '승인 조건은 예산 검토입니다.', 'summary changed source');
  await page.screenshot({ path: 'output/playwright/document-summary.png', fullPage: true });
  await page.getByRole('combobox', { name: '분석 범위', exact: true }).selectOption('selected');
  check(await page.locator('#send').isDisabled(), 'scope change retained old target');
  check(!await page.locator('#answer-section').isVisible(), 'scope change retained old answer');
  await page.locator('#demo-text').fill('x'.repeat(12000));
  await page.getByRole('combobox', { name: '분석 범위', exact: true }).selectOption('document');
  await page.getByRole('button', { name: '문서 텍스트 읽기' }).click();
  check((await page.locator('#status').textContent()).includes('12,000자'), 'oversized document not rejected');
  check(await page.locator('#send').isDisabled(), 'partial document can send');
  check(sent === 1, 'oversized capture sent a request');
  await page.getByRole('combobox', { name: '작업', exact: true }).selectOption('replace_text');
  check(await page.locator('#scope').inputValue() === 'selected', 'edit mode retained document scope');
  check(await page.locator('#scope').isDisabled(), 'edit mode allows document scope');
  await page.unroute('**/api/propose');
}
