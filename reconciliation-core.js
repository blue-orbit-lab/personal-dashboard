(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReconciliationCore=api})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const SCALE=10000000000n;
  const SIGNS={purchase:-1,sale:1,deposit:1,withdrawal:-1,dividend:1,interest:1,fee:-1,tax:-1,refund:1,transfer_in:1,transfer_out:-1,fx_in:1,fx_out:-1};
  const CAUSES=['purchase','sale','transfer','split','reinvestment','correction','initial','unknown'];
  const FACTS=['quantity_increase','quantity_decrease','cash_surplus','cash_shortfall','cash_unknown','baseline_unknown','unconfirmed_event','pending_settlement','own_transfer','fx','history_incomplete','position_unexplained'];
  const REASONS=['cash_balance','cash_kind','opening_balance','position_reason','event_details','cash_difference','other_account','fx_leg','history','initial_position'];
  const CANDIDATES=['purchase','sale','deposit','withdrawal','dividend','interest','fee','tax','refund','transfer','fx','pending_settlement','split','reinvestment','correction','unknown'];
  function decimal(value){
    if(typeof value!=='string')throw Error('金額・数量は文字列で指定してください');
    let s=value.normalize('NFKC').trim();if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,10})?$/.test(s))throw Error('数値の桁・区切りを確認してください');
    s=s.replace(/,/g,'');const negative=s[0]==='-';s=s.replace(/^[+-]/,'');let [i,f='']=s.split('.');if(i.length>18)throw Error('数値が大きすぎます');
    return (BigInt(i)*SCALE+BigInt(f.padEnd(10,'0')))*(negative?-1n:1n);
  }
  function format(n){const neg=n<0n;if(neg)n=-n;const f=(n%SCALE).toString().padStart(10,'0').replace(/0+$/,'');return (neg?'-':'')+(n/SCALE).toString()+(f?'.'+f:'')}
  function instant(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('時刻とタイムゾーンを確認してください');return Date.parse(value)}
  function present(v){return v!==null&&v!==undefined&&v!==''}
  function analyze(input){
    if(!input||!['JPY','USD'].includes(input.currency))throw Error('預り金の通貨を選んでください');
    const end=instant(input.asOf),questions=[],facts=new Set(),positions=input.positions||[],events=input.events||[];
    if(positions.length>200||events.length>200)throw Error('1回に照合する件数が多すぎます');
    function ask(key,kind,text,candidates=['unknown']){if(!questions.some(q=>q.key===key))questions.push({key,kind,text,candidates})}
    const cash=input.cash||{},hasOpening=present(cash.opening)&&present(input.openingAsOf),hasClosing=present(cash.closing);
    const start=hasOpening?instant(input.openingAsOf):null;
    if(start!==null&&start>=end)throw Error('前回の残高日時は今回より前にしてください');
    const opening=hasOpening?decimal(cash.opening):null,closing=hasClosing?decimal(cash.closing):null;
    if(cash.kind!=='settled_cash')ask('cash-kind','cash_kind','確認するのは買付余力ではなく、受渡済みの預り金残高ですか？');
    if(!hasClosing){facts.add('cash_unknown');ask('cash-closing','cash_balance',`今回の確認日時の預り金残高（${input.currency}）はいくらですか？ 銀行との自動入出金がある場合も、証券口座の表示額を入力してください。`)}
    if(!hasOpening){facts.add('baseline_unknown');ask('cash-opening','opening_balance','前回の預り金残高と、その確認日時は分かりますか？ 分からなければ今回は初回残高として保存し、差額の照合は次回から行います。')}
    const byId=new Map(),eventIds=new Set();let net=0n,pending=0;
    for(const event of events){
      if(!event.id||eventIds.has(event.id))throw Error('同じ入出金が重複しています');eventIds.add(event.id);
      if(!(event.kind in SIGNS)||event.currency!==input.currency)throw Error('入出金の種類・通貨を確認してください');
      const amount=decimal(event.amount);if(amount<=0n)throw Error('入出金額は正の実際の受渡金額を入力してください');
      const at=instant(event.settledAt),confirmed=event.confirmed===true;
      if(!confirmed){facts.add('unconfirmed_event');ask('event-'+event.id,'event_details','入出金の金額・受渡日時を明細で確認してください。推定額は照合に使いません。',[event.kind,'unknown'].filter(c=>CANDIDATES.includes(c)))}
      if(at>end){pending++;facts.add('pending_settlement')}
      if(confirmed&&start!==null&&at>start&&at<=end)net+=amount*BigInt(SIGNS[event.kind]);
      if(event.positionId){if(!byId.has(event.positionId))byId.set(event.positionId,[]);byId.get(event.positionId).push(event)}
      if(['transfer_in','transfer_out'].includes(event.kind)){
        facts.add('own_transfer');
        if(!present(event.counterpartyBalance)||!present(event.counterpartyAsOf)||!event.counterpartyConfirmed){ask('other-'+event.id,'other_account','自分の銀行・別口座からの振替ですか？ 振替元／先の口座名、反映後の残高と日時も確認してください。振替は資産全体の利益にしません。',['transfer','unknown'])}
        else {decimal(event.counterpartyBalance);if(instant(event.counterpartyAsOf)<at||!event.counterpartyId)throw Error('振替先／元の口座と、反映後の残高日時を確認してください')}
      }
      if(['fx_in','fx_out'].includes(event.kind)){facts.add('fx');ask('fx-'+event.id,'fx_leg','両替のもう一方の通貨・受渡額・手数料も、別通貨の預り金として照合してください。',['fx','fee','unknown'])}
    }
    const ids=new Set(),changes=[];
    for(const p of positions){
      if(!p.id||ids.has(p.id))throw Error('銘柄・口座区分が重複しています');ids.add(p.id);
      const after=decimal(p.after);if(after<0n)throw Error('保有数量を確認してください');
      if(!present(p.before)){
        if(p.cause!=='initial'||p.confirmed!==true)ask('position-'+p.id,'initial_position','前回の保有数量が分かりません。以前からの保有か、今回の購入かを確認してください。初回登録を購入扱いにはしません。',['purchase','transfer','unknown']);
        changes.push({id:p.id,delta:null});continue;
      }
      const before=decimal(p.before);if(before<0n)throw Error('前回の保有数量を確認してください');const delta=after-before;changes.push({id:p.id,delta:format(delta)});if(delta===0n)continue;
      facts.add(delta>0n?'quantity_increase':'quantity_decrease');
      const candidates=delta>0n?['purchase','transfer','split','reinvestment','correction','unknown']:['sale','transfer','split','correction','unknown'];
      if(!CAUSES.includes(p.cause)||['unknown','initial'].includes(p.cause)||p.confirmed!==true){facts.add('position_unexplained');ask('position-'+p.id,'position_reason',`保有数量が${format(delta)}変わりました。購入・売却・移管・分割・再投資・読取訂正のどれに当たりますか？`,candidates);continue}
      if(['purchase','sale'].includes(p.cause)){
        if((p.cause==='purchase'&&delta<0n)||(p.cause==='sale'&&delta>0n))throw Error('数量の増減と売買の向きが一致しません');
        const linked=(byId.get(p.id)||[]).filter(e=>['purchase','sale'].includes(e.kind)&&e.confirmed===true);
        let quantity=0n,complete=linked.length>0;
        for(const e of linked){if(!present(e.quantity)){complete=false;continue}const q=decimal(e.quantity);if(q<=0n)throw Error('売買数量を確認してください');quantity+=q*(e.kind==='purchase'?1n:-1n)}
        if(!complete||quantity!==delta)ask('trade-'+p.id,'event_details','数量差に対応する売買の数量・手数料や税を含む実際の受渡金額・受渡日時を確認してください。平均取得単価の差から代金を逆算しません。',[p.cause,'fee','tax','pending_settlement','unknown']);
      }
    }
    for(const id of byId.keys())if(!ids.has(id))throw Error('売買と保有銘柄の対応を確認してください');
    const expected=opening===null?null:opening+net;
    const difference=expected===null||closing===null?null:closing-expected;
    if(difference!==null&&difference!==0n){const surplus=difference>0n;facts.add(surplus?'cash_surplus':'cash_shortfall');ask('cash-difference','cash_difference',`確認済みの入出金で計算した預り金より、表示残高が${format(surplus?difference:-difference)} ${input.currency}${surplus?'多く':'少なく'}なっています。入出金・売買・配当・手数料・自動振替・受渡日時を確認してください。`,surplus?['deposit','sale','dividend','interest','refund','transfer','pending_settlement','unknown']:['purchase','withdrawal','fee','tax','transfer','fx','pending_settlement','unknown'])}
    if(input.historyConfirmed!==true){facts.add('history_incomplete');ask('history','history','この期間の入出金・受渡済みの売買・配当などを、明細でひと通り確認できましたか？ 差額が0でも、相殺された取引がないとは限りません。')}
    questions.forEach((q,i)=>q.id='q'+(i+1));
    return {version:1,status:questions.length?'pending':'matched',currency:input.currency,expected:expected===null?null:format(expected),observed:closing===null?null:format(closing),difference:difference===null?null:format(difference),pendingSettlements:pending,changes,questions,facts:[...facts],canPostTransactions:false};
  }
  // Only categorical facts leave the device; amounts, names, row IDs and images do not.
  function adviserInput(result){return {version:1,facts:result.facts.filter(f=>FACTS.includes(f)),questions:result.questions.map(q=>({id:q.id,kind:q.kind,candidates:q.candidates})).slice(0,40)}}
  function validateAdvice(input,advice){
    if(!advice||!Array.isArray(advice.priorities)||advice.priorities.length>input.questions.length)throw Error('AI応答の形式が不正です');
    const seen=new Set();for(const item of advice.priorities){const q=input.questions.find(q=>q.id===item.question_id);if(!q||seen.has(q.id)||!Array.isArray(item.candidates)||item.candidates.length>3||item.candidates.some(c=>!q.candidates.includes(c))||new Set(item.candidates).size!==item.candidates.length)throw Error('AIが照合外の情報を返しました');seen.add(q.id)}
    return advice;
  }
  return {analyze,decimal,format,adviserInput,validateAdvice,FACTS,REASONS,CANDIDATES,SIGNS};
});
