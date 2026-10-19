async (page) => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  await page.getByRole('textbox',{name:'연결 코드',exact:true}).fill('synthetic-page-edit-pairing-code');
  await page.getByRole('button',{name:'연결 확인',exact:true}).click();
  const source='프로젝트 계획을 정기적으로 공유하고 팀의 의견을 반영합니다.';
  await page.getByRole('textbox',{name:'문서 내용 (직접 변경 가능)',exact:true}).fill(source);
  await page.getByRole('combobox',{name:'작업',exact:true}).selectOption('rewrite_slide');
  await page.getByRole('spinbutton',{name:'수정할 페이지 (비우면 현재 슬라이드)',exact:true}).fill('1');
  await page.getByRole('button',{name:'페이지 읽기',exact:true}).click();
  check((await page.locator('#source').textContent()).includes('문서 AI 활용'),'page title not captured');
  check((await page.locator('#source').textContent()).includes(source),'page body not captured');
  await page.getByRole('textbox',{name:'어떻게 다듬을까요?',exact:true}).fill("모든 텍스트 앞에 '검토: '를 붙이고 페이지 전체를 간결한 보고용 문장으로 다듬어 주세요. 새로운 사실이나 숫자는 추가하지 마세요.");
  await page.getByRole('button',{name:'페이지 수정안 요청',exact:true}).click();
  await page.locator('#page-proposal-section').waitFor({timeout:40000});
  const diff=await page.locator('#page-diff').textContent();
  check(diff.includes('변경 전:')&&diff.includes('변경 후:'),'missing before/after review');
  check(await page.getByRole('textbox',{name:'문서 내용 (직접 변경 가능)',exact:true}).inputValue()===source,'model request wrote without approval');
  await page.getByRole('button',{name:'페이지에 일괄 적용',exact:true}).click();
  check((await page.locator('#status').textContent()).includes('적용했습니다'),'apply failed');
  const edited=await page.getByRole('textbox',{name:'문서 내용 (직접 변경 가능)',exact:true}).inputValue();
  check(edited!==source,'page body not changed');
  await page.getByRole('button',{name:'페이지 읽기',exact:true}).click();
  check((await page.locator('#source').textContent()).includes(edited),'page recapture not updated');
  await page.getByRole('combobox',{name:'선택 개체',exact:true}).selectOption('two');
  check(await page.getByRole('textbox',{name:'문서 내용 (직접 변경 가능)',exact:true}).inputValue()==='다른 개체의 내용은 유지되어야 합니다.','other page changed');
  return {passed:true,liveInference:true,pageSegments:2,reviewBeforeWrite:true,mockEditorApply:true,otherPageUnchanged:true,desktopEngine:false};
}
