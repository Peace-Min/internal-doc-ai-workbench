async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  let requests = 0;
  await page.route('**/api/propose', async route => {
    const body = route.request().postDataJSON();
    const slide = body.text.includes('슬라이드 1~1') ? 1 : 2;
    requests++;
    await route.fulfill({ json: { operation: body.operation, answer: `구간 ${slide} 합성 답변 [슬라이드 ${slide} · 개체 1]\n<script>window.reportExecuted=true</script>`, mode: 'mock' } });
  });
  await page.getByRole('combobox', {name:'작업',exact:true}).selectOption('summarize');
  await page.getByRole('combobox', {name:'분석 범위',exact:true}).selectOption('document');
  for (const slide of ['1','2']) {
    await page.locator('#slide-start').fill(slide);
    await page.locator('#slide-end').fill(slide);
    await page.getByRole('button', {name:'문서 텍스트 읽기'}).click();
    await page.getByRole('button', {name:'요약하기',exact:true}).click();
    await page.locator('#answer-section').waitFor();
  }
  const report = await page.locator('#report').inputValue();
  check(report.includes('읽은 범위 1~1 / 전체 2'), 'first range lost');
  check(report.includes('읽은 범위 2~2 / 전체 2'), 'second range lost');
  check(report.includes('핵심 사실과 조건을 간결하게 요약'), 'effective instruction missing');
  check(report.includes('모의 답변, 실제 분석 아님'), 'mock not labelled');
  check(!report.includes('synthetic-browser-report-pairing-code'), 'pairing code leaked');
  check(await page.locator('#answer script, #history-section script').count() === 0, 'answer interpreted as HTML');
  await page.locator('#operation').selectOption('replace_text');
  check(await page.locator('#report').inputValue() === report, 'mode switch lost history');
  const downloadPending = page.waitForEvent('download');
  await page.getByRole('button', {name:'보고서 내려받기 (.txt)',exact:true}).click();
  const download = await downloadPending;
  check(download.suggestedFilename() === 'workbench-report.txt', 'wrong download filename');
  await download.saveAs('output/playwright/workbench-report.txt');
  check(await page.locator('#report').inputValue() === report, 'download cleared records');
  await page.getByText('보고서 내용 보기·직접 복사',{exact:true}).click();
  await page.screenshot({path:'output/playwright/report-history.png',fullPage:true});
  check(requests === 2, 'export sent extra model request');
  await page.reload();
  check(await page.locator('#report').inputValue() === '', 'history persisted across reload');
  check(!await page.locator('#history-section').isVisible(), 'history restored after reload');
  await page.locator('#token').fill('synthetic-browser-report-pairing-code');
  await page.getByRole('button', {name:'연결 확인',exact:true}).click();
  await page.locator('#operation').selectOption('summarize');
  await page.getByRole('button', {name:'선택 개체 읽기',exact:true}).click();
  await page.getByRole('button', {name:'요약하기',exact:true}).click();
  await page.locator('#answer-section').waitFor();
  check(await page.locator('#history-section').isVisible(), 'new record not retained');
  await page.getByRole('button', {name:'기록 지우기',exact:true}).click();
  check(!await page.locator('#history-section').isVisible(), 'clear left records visible');
  check(await page.locator('#report').inputValue() === '', 'clear retained report');
  check(requests === 3, 'clear sent extra model request');
  await page.unroute('**/api/propose');
}
