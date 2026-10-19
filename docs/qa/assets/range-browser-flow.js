async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.getByRole('combobox', { name: '선택 개체', exact: true }).selectOption('one');
  await page.locator('#demo-text').fill('첫 슬라이드 자료 '.repeat(700));
  await page.getByRole('combobox', { name: '선택 개체', exact: true }).selectOption('two');
  await page.locator('#demo-text').fill('둘째 슬라이드 자료 '.repeat(700));
  await page.getByRole('combobox', { name: '작업', exact: true }).selectOption('summarize');
  await page.getByRole('combobox', { name: '분석 범위', exact: true }).selectOption('document');
  await page.getByRole('button', { name: '문서 텍스트 읽기' }).click();
  check((await page.locator('#status').textContent()).includes('12,000자'), 'long full document was accepted');
  let requests = 0;
  await page.route('**/api/propose', async route => {
    const text = route.request().postDataJSON().text;
    const slide = text.includes('슬라이드 1~1') ? 1 : 2;
    check(text.includes(`[분석 범위: 슬라이드 ${slide}~${slide} / 전체 2]`), 'missing range header');
    check(text.includes(`[슬라이드 ${slide} · 개체 1]`), 'original slide source missing');
    check(!text.includes(slide === 1 ? '둘째 슬라이드 자료' : '첫 슬라이드 자료'), 'unrequested slide was sent');
    requests++;
    await route.fulfill({ json: { operation: 'summarize', answer: `구간 ${slide}의 합성 요약 [슬라이드 ${slide} · 개체 1]`, mode: 'openai-compatible' } });
  });
  for (const slide of ['1', '2']) {
    await page.locator('#slide-start').fill(slide);
    await page.locator('#slide-end').fill(slide);
    check(await page.locator('#send').isDisabled(), 'range input did not invalidate old target');
    check(!await page.locator('#answer-section').isVisible(), 'range input did not clear old answer');
    await page.getByRole('button', { name: '문서 텍스트 읽기' }).click();
    await page.getByRole('button', { name: '요약하기', exact: true }).click();
    await page.locator('#answer-section').waitFor();
    check((await page.locator('#target').textContent()).includes(`읽은 범위 ${slide}~${slide} / 전체 2`), 'wrong coverage title');
    check(!await page.getByRole('button', { name: '원래 개체에 적용' }).isVisible(), 'range answer offers apply');
  }
  await page.screenshot({ path: 'output/playwright/range-summary.png', fullPage: true });
  await page.locator('#slide-end').fill('3');
  await page.getByRole('button', { name: '문서 텍스트 읽기' }).click();
  check((await page.locator('#status').textContent()).includes('전체 슬라이드: 2'), 'out-of-document bound was accepted');
  check(await page.locator('#send').isDisabled(), 'invalid range can send');
  check(requests === 2, 'invalid range sent extra request');
  await page.unroute('**/api/propose');
}
