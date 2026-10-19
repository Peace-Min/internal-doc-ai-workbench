async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.route('**/api/propose', route => route.fulfill({json:{operation:'summarize',answer:'합성 분석 [슬라이드 1 · 개체 1] 잘못된 출처 [슬라이드 99 · 개체 1]\n<script>window.reviewExecuted=true</script>',mode:'mock'}}));
  await page.getByRole('textbox',{name:'연결 코드',exact:true}).fill('synthetic-review-browser-pairing-code');
  await page.getByRole('button',{name:'연결 확인',exact:true}).click();
  await page.getByRole('combobox',{name:'작업',exact:true}).selectOption('summarize');
  await page.getByRole('combobox',{name:'분석 범위',exact:true}).selectOption('document');
  await page.getByRole('button',{name:'문서 텍스트 읽기',exact:true}).click();
  await page.getByRole('button',{name:'요약하기',exact:true}).click();
  await page.locator('#review-section').waitFor();
  check((await page.locator('#review-check').textContent()).includes('읽은 출처에 없음 1개'),'unknown citation not flagged');
  const source=await page.locator('#review-source').textContent();
  check(source.includes('문서 편집 중 사내 AI'),'source not retained');
  check(await page.locator('#review-answer script').count()===0,'answer interpreted as HTML');
  check(!await page.evaluate(()=>window.reviewExecuted),'script executed');
  await page.getByRole('textbox',{name:'문서 내용 (직접 변경 가능)',exact:true}).fill('새 원문으로 변경');
  await page.getByRole('button',{name:'문서 텍스트 읽기',exact:true}).click();
  check(await page.locator('#review-source').textContent()===source,'old source overwritten by recapture');
  const report=await page.locator('#report').inputValue();
  check(!report.includes('문서 편집 중 사내 AI'),'source leaked into exported report');
  check(report.includes('미확인 출처: [슬라이드 99 · 개체 1]'),'report missing warning');
  await page.getByRole('button',{name:'기록 지우기',exact:true}).click();
  check(await page.locator('#review-section').isHidden(),'review not cleared');
  check(await page.locator('#review-source').textContent()==='','source retained after clear');
  return {passed:true,checks:9,synthetic:true,desktopEngine:false};
}
