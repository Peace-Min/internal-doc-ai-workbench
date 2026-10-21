/* Serialized ONLYOFFICE command. No external closure, network, or generated code. */
function workbenchPageCommand() {
  try {
    var payload=Asc.scope.workbenchPayload, presentation=Api.GetPresentation();
    if(!presentation)return {error:'PPTX 편집기에서 실행해 주세요.'};
    function readPage(number,allowNumberChanges) {
      var slides=presentation.GetAllSlides();
      var index=number===undefined ? presentation.GetCurSlideIndex() : number-1;
      if(!Number.isSafeInteger(index)||index<0||index>=slides.length)throw Error('페이지 번호를 확인하세요.');
      var drawings=slides[index].GetAllDrawings(),members=[],segments=[],handles=[],layouts=[],excluded=0,empty=0;
      if(drawings.length>2000)throw Error('한 페이지에서 읽을 수 있는 개체 수를 초과했습니다.');
      for(var d=0;d<drawings.length;d++){
        var drawing=drawings[d],objectId=String(drawing.GetInternalId());
        if(objectId==='undefined'||members.indexOf(objectId)!==-1)throw Error('페이지 개체 식별자를 확인할 수 없습니다.');
        members.push(objectId);
        if(drawing.GetClassType()!=='shape'){excluded++;continue;}
        var content=drawing.GetContent();if(!content){empty++;continue;}
        var paragraphs=content.GetAllParagraphs(),pending=[],layout=[],unsupported=paragraphs.length>200;
        for(var p=0;!unsupported&&p<paragraphs.length;p++){
          var count=paragraphs[p].GetElementsCount();layout.push(count);
          if(count>2000){unsupported=true;break;}
          for(var r=0;r<count;r++){
            var run=paragraphs[p].GetElement(r);
            if(!run||run.GetClassType()!=='run'){unsupported=true;break;}
            var text=run.GetText();
            if(typeof text!=='string'||/[\r\n\u0000]/.test(text)){unsupported=true;break;}
            if(!text.trim())continue;
            pending.push({run:run,text:text,paragraph:p,runIndex:r});
            if(pending.length+segments.length>60)throw Error('페이지 텍스트 구간이 60개를 초과합니다.');
          }
        }
        if(unsupported){excluded++;continue;}
        layouts.push({objectId:objectId,paragraphs:layout});
        if(!pending.length){empty++;continue;}
        for(var n=0;n<pending.length;n++){
          var item=pending[n],id='s'+(segments.length+1);
          segments.push({id:id,objectId:objectId,paragraph:item.paragraph,runIndex:item.runIndex,text:item.text});
          handles.push(item.run);
        }
      }
      if(!segments.length)throw Error('이 페이지에는 수정할 수 있는 일반 텍스트가 없습니다.');
      var text=JSON.stringify({slideNumber:index+1,allowNumberChanges:allowNumberChanges===true,segments:segments.map(function(segment){return {id:segment.id,object:members.indexOf(segment.objectId)+1,paragraph:segment.paragraph+1,text:segment.text};})});
      if(text.length>12000)throw Error('페이지 내용이 12,000자를 초과합니다. 내용을 자르지 않았습니다.');
      return {snapshot:{scope:'slide_edit',slideIndex:index,slideNumber:index+1,allowNumberChanges:allowNumberChanges===true,members:members,layouts:layouts,segments:segments,excludedCount:excluded,emptyCount:empty,text:text},handles:handles};
    }
    if(payload.action==='page_capture')return readPage(payload.pageNumber,payload.allowNumberChanges).snapshot;
    if(payload.action!=='page_apply'||payload.target?.scope!=='slide_edit')return {error:'페이지를 다시 읽어 주세요.'};
    var current=readPage(payload.target.slideNumber,payload.target.allowNumberChanges);
    if(JSON.stringify(current.snapshot)!==JSON.stringify(payload.target))return {error:'페이지의 개체·내용·구조가 변경되었습니다. 다시 읽고 요청하세요.'};
    var edits=payload.plan?.edits,segments=current.snapshot.segments;
    if(!payload.plan||Object.keys(payload.plan).join()!=='edits'||!Array.isArray(edits)||edits.length!==segments.length)return {error:'페이지 수정안 형식이 올바르지 않습니다.'};
    var mapped={},total=0;
    for(var e=0;e<edits.length;e++){
      var edit=edits[e];
      if(!edit||Object.keys(edit).sort().join()!=='id,text'||typeof edit.id!=='string'||mapped[edit.id]!==undefined||!segments.some(function(segment){return segment.id===edit.id;})||typeof edit.text!=='string'||!edit.text.trim()||/[\r\n\u0000]/.test(edit.text))return {error:'페이지 수정 대상 또는 텍스트가 올바르지 않습니다.'};
      var prior=segments.filter(function(segment){return segment.id===edit.id;})[0].text;
      var normalized=prior.match(/^\s*/)[0]+edit.text.trim()+prior.match(/\s*$/)[0];
      total+=normalized.length;if(total>12000)return {error:'페이지 수정안이 12,000자를 초과합니다.'};
      mapped[edit.id]=normalized;
    }
    if(!current.snapshot.allowNumberChanges){
      for(var b=0;b<segments.length;b++){
        var beforeNumbers=segments[b].text.match(/[+-]?\d+(?:[.,]\d+)*/g)||[];
        var afterNumbers=mapped[segments[b].id].match(/[+-]?\d+(?:[.,]\d+)*/g)||[];
        if(JSON.stringify(beforeNumbers)!==JSON.stringify(afterNumbers))return {error:'구간별 숫자가 누락·추가·변경되거나 순서가 바뀐 수정안은 적용하지 않습니다. 숫자 변경을 허용하려면 페이지를 다시 읽으세요.'};
      }
    }
    var touched=[],changed=0;
    try {
      for(var i=0;i<segments.length;i++){
        var original=segments[i],replacement=mapped[original.id],handle=current.handles[i];
        if(replacement===original.text)continue;
        touched.push(i);
        if(handle.ClearContent()!==true||handle.AddText(replacement)!==true||handle.GetText()!==replacement)throw Error('page write failed');
        changed++;
      }
    } catch(writeError){
      var failed=[];
      for(var k=touched.length-1;k>=0;k--){
        var position=touched[k],restore=current.handles[position],before=segments[position].text,recovered=false;
        try{recovered=restore.GetText()===before||(restore.ClearContent()===true&&restore.AddText(before)===true&&restore.GetText()===before);}catch(restoreError){}
        if(!recovered)failed.push(segments[position].id);
      }
      return {error:failed.length?'페이지 수정 실패 후 일부 원문 복구를 확인하지 못했습니다. 추가 편집·저장 전에 실행 취소 또는 사본 복구를 확인하세요.':'페이지 수정에 실패했습니다. 변경한 구간의 원문 복구를 확인했습니다.',recoveryFailed:failed.length>0,failedSegments:failed};
    }
    return {applied:true,changedSegments:changed,slideNumber:current.snapshot.slideNumber};
  }catch(error){return {error:'페이지 읽기·수정에 실패했습니다. 페이지 번호, 60개 구간·12,000자 한도와 지원 개체를 확인하세요.'};}
}
globalThis.workbenchPageCommand=workbenchPageCommand;
