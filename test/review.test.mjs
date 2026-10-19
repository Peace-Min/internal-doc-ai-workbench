import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../plugin/report.js';

test('citation review deduplicates exact labels and does not infer claim correctness',()=>{
  const review=WorkbenchReport.review({sources:['[슬라이드 2 · 개체 3]'],answer:'맞음 [슬라이드 2 · 개체 3] 반복 [슬라이드 2·개체 3] 누락 [슬라이드 1 · 개체 3]'});
  assert.deepEqual(review.known,['[슬라이드 2 · 개체 3]']);
  assert.deepEqual(review.unknown,['[슬라이드 1 · 개체 3]']);
  assert.match(review.summary,/출처 표기 2개/);
});

test('citation review distinguishes absent citations, selected objects and unrecognized formats',()=>{
  assert.match(WorkbenchReport.review({sources:[],answer:'선택 텍스트 답변'}).summary,/자동 대조 대상 아님/);
  for(const answer of ['출처 없는 답변','[slide 1]','[슬라이드 0 · 개체 1]']){
    assert.match(WorkbenchReport.review({sources:['[슬라이드 1 · 개체 1]'],answer}).summary,/정형 출처 표기 없음/);
  }
});
