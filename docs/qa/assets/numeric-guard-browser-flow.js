async (page) => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  await page.getByRole('textbox',{name:'연결 코드',exact:true}).fill('synthetic-numeric-guard-pairing-code');
  await page.getByRole('button',{name:'연결 확인',exact:true}).click();
  const original='예산 950, 일정 2026';
  await page.locator('#demo-text').fill(original);
  await page.getByRole('combobox',{name:'작업',exact:true}).selectOption('rewrite_slide');
  await page.locator('#page-number').fill('1');
  let scenario='move';
  await page.route('**/api/propose',async route=>{
    const doc=JSON.parse(route.request().postDataJSON().text);
    const plan={edits:doc.segments.map(s=>({id:s.id,text:s.text+' 검토'}))};
    if(scenario==='move'){
      plan.edits[0].text+=' 950';plan.edits[1].text='예산, 일정 2026';
    }else if(scenario==='reorder')plan.edits[1].text='예산 2026, 일정 950';
    await route.fulfill({json:{operation:'rewrite_slide',plan,mode:'mock'}});
  });
  for(const next of ['move','reorder']){
    scenario=next;
    await page.getByRole('button',{name:'페이지 읽기',exact:true}).click();
    await page.locator('#instruction').fill('숫자를 유지하며 보고용으로 다듬어 주세요.');
    await page.getByRole('button',{name:'페이지 수정안 요청',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('status').dataset.error==='true');
    check((await page.locator('#status').textContent()).includes('구간별 숫자'),'numeric error missing');
    check(!await page.locator('#page-proposal-section').isVisible(),'unsafe plan is applicable');
    check(await page.locator('#demo-text').inputValue()===original,'rejected plan changed source');
  }
  await page.screenshot({path:'output/playwright/numeric-plan-rejected.png',fullPage:true});
  await page.locator('#page-allow-numbers').check();
  check(await page.locator('#send').isDisabled(),'option did not invalidate target');
  await page.getByRole('button',{name:'페이지 읽기',exact:true}).click();
  await page.getByRole('button',{name:'페이지 수정안 요청',exact:true}).click();
  await page.locator('#page-proposal-section').waitFor();
  check(await page.locator('#demo-text').inputValue()===original,'preview changed source');
  await page.getByRole('button',{name:'페이지에 일괄 적용',exact:true}).click();
  check(await page.locator('#demo-text').inputValue()==='예산 2026, 일정 950','explicit numeric opt-in failed');
  await page.locator('#page-allow-numbers').uncheck();scenario='preserve';
  await page.getByRole('button',{name:'페이지 읽기',exact:true}).click();
  await page.getByRole('button',{name:'페이지 수정안 요청',exact:true}).click();
  await page.locator('#page-proposal-section').waitFor();
  await page.getByRole('button',{name:'페이지에 일괄 적용',exact:true}).click();
  check(await page.locator('#demo-text').inputValue()==='예산 2026, 일정 950 검토','safe prose revision failed');
  await page.unroute('**/api/propose');
  return {passed:true,numericMigrationBlocked:true,numericReorderBlocked:true,explicitOptIn:true,safeRevision:true,desktopEngine:false,liveModel:false};
}
