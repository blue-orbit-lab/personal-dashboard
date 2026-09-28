(function(){
  'use strict';
  const C=window.ReconciliationCore,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={purchase:'購入',sale:'売却',deposit:'入金（自分の別口座以外）',withdrawal:'出金（自分の別口座以外）',dividend:'配当・分配金',interest:'利息',fee:'手数料',tax:'税',refund:'返金',transfer_in:'自分の銀行・別口座から振替／自動入金',transfer_out:'自分の銀行・別口座へ振替／自動出金',fx_in:'両替で受取',fx_out:'両替で支払',transfer:'移管・振替',split:'株式分割など',reinvestment:'再投資',correction:'読取・登録の訂正',initial:'以前から保有（初回登録）',unknown:'不明',pending_settlement:'受渡前'};
  const dateValue=s=>s?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s)).replace(' ','T'):'';
  const iso=s=>s?new Date(s+':00+09:00').toISOString():null;
  function mount(node,options){
    let closed=false,version=0,analysis=null,input=null,controller=null,revision=0,child=null;const adviceCache=new Map();
    const seed=options.input,bridge=options.bridge||{},positions=seed.positions||[];
    const field=(label,key,value='',type='text')=>`<label>${esc(label)}<input data-cash="${key}" type="${type}" value="${esc(value)}" ${type==='text'?'inputmode="decimal"':''}></label>`;
    node.innerHTML=`<details class="card" open><summary>預り金の差も確認する</summary><p>この画像の保有残高と、預り金の動きを照合します。回答は照合メモとして保存でき、購入履歴や総資産額を自動で変更しません。未確認の原因は「照合待ち」です。</p>
      <p>預り金は証券会社の<strong>受渡済み残高</strong>です。買付余力・評価額合計・配当の累計額は入力しません。税区分ごとに同じ預り金を重複登録しないでください。</p>
      <div class="grid2">${field('前回の預り金（'+seed.currency+'）','opening',seed.cash?.opening||'')}${field('前回の確認日時（日本時間）','openingAsOf',dateValue(seed.openingAsOf),'datetime-local')}${field('今回の預り金（'+seed.currency+'）','closing',seed.cash?.closing||'')}${field('今回の確認日時（日本時間）','asOf',dateValue(seed.asOf),'datetime-local')}</div>
      <label class="sc-check"><input type="checkbox" data-cash="settled" ${seed.cash?.kind==='settled_cash'?'checked':''}>受渡済みの預り金残高を確認した</label>
      <div data-role="positions">${positions.filter(p=>p.before===null||C.decimal(p.before)!==C.decimal(p.after)).map(p=>`<div class="sc-row" data-position="${esc(p.id)}"><b>${esc(p.name||'銘柄')}</b><p>保有数量 ${esc(p.before??'不明')} → ${esc(p.after)}</p><label>変動した理由<select data-role="cause">${['unknown','purchase','sale','transfer','split','reinvestment','correction','initial'].map(v=>`<option value="${v}" ${p.cause===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label><label class="sc-check"><input type="checkbox" data-role="confirmed" ${p.confirmed?'checked':''}>この理由を確認した</label></div>`).join('')}</div>
      <h4>確認できた入出金・売買</h4><p>受渡金額を正の数で入力してください。売買は手数料・税を含む受取額／支払額で、別途同じ手数料を追加しません。受渡日時より後に確認した預り金と照合します。</p>
      <div data-role="events"></div><button type="button" class="secondary" data-action="add">入出金・売買を追加</button>
      <label class="sc-check"><input type="checkbox" data-cash="history" ${seed.historyConfirmed?'checked':''}>この期間の入出金・売買・配当などを明細でひと通り確認した</label>
      <button type="button" class="primary" data-action="analyze">預り金を照合する</button>
      <div data-role="result" aria-live="polite"></div>
      <button type="button" class="secondary" data-action="ai" disabled>AIに質問の優先順を相談</button>
      <p class="small">AIには「数量が増えた」「残高が多い」などの分類だけを送ります。画像・銘柄名・口座名・金額は送りません。未設定・利用上限・失敗時は上の質問で続けられます。</p>
      <button type="button" class="secondary" data-action="save" disabled>照合メモを保存</button><p data-role="status" role="status"></p></details>`;
    const $=s=>node.querySelector(s),button=a=>$('[data-action="'+a+'"]'),val=k=>$('[data-cash="'+k+'"]');
    for(const row of node.querySelectorAll('[data-position]')){if(positions.find(p=>p.id===row.dataset.position)?.before===null){const label=document.createElement('label');label.textContent='前回の保有数量（確認できた場合だけ。初めての購入前は0）';const before=document.createElement('input');before.dataset.role='before';before.inputMode='decimal';label.append(before);row.append(label)}}
    function invalid(){version++;controller?.abort();analysis=null;input=null;button('ai').disabled=true;button('save').disabled=true;$('[data-role="result"]').replaceChildren();$('[data-role="status"]').textContent='入力を変更しました。もう一度照合してください。'}
    function addEvent(e={}){
      const row=document.createElement('div');row.className='sc-row';row.dataset.event=e.id||crypto.randomUUID();
      row.innerHTML=`<label>種類<select data-event="kind">${Object.keys(C.SIGNS).map(v=>`<option value="${v}" ${e.kind===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label>
        <label>対応する銘柄（売買の場合）<select data-event="positionId"><option value="">該当なし</option>${positions.map(p=>`<option value="${esc(p.id)}" ${e.positionId===p.id?'selected':''}>${esc(p.name||p.id)}</option>`).join('')}</select></label>
        <div class="grid2"><label>売買数量<input data-event="quantity" inputmode="decimal" value="${esc(e.quantity||'')}"></label><label>受渡金額（${esc(seed.currency)}）<input data-event="amount" inputmode="decimal" value="${esc(e.amount||'')}"></label><label>受渡日時（日本時間）<input data-event="settledAt" type="datetime-local" value="${esc(dateValue(e.settledAt))}"></label></div>
        <details><summary>自分の銀行・別口座との振替の場合</summary><label>相手の口座名（自分用の名前）<input data-event="counterpartyId" value="${esc(e.counterpartyId||'')}"></label><label>反映後の相手口座の残高<input data-event="counterpartyBalance" inputmode="decimal" value="${esc(e.counterpartyBalance||'')}"></label><label>相手口座の確認日時（日本時間）<input data-event="counterpartyAsOf" type="datetime-local" value="${esc(dateValue(e.counterpartyAsOf))}"></label><label class="sc-check"><input data-event="counterpartyConfirmed" type="checkbox" ${e.counterpartyConfirmed?'checked':''}>同じ通貨で振替先／元の残高を確認した</label></details>
        <label class="sc-check"><input data-event="confirmed" type="checkbox" ${e.confirmed?'checked':''}>金額・数量・受渡日時を確認した</label><button type="button" class="secondary" data-remove>この入出金を除く</button>`;
      row.querySelector('[data-remove]').onclick=()=>{row.remove();invalid()};$('[data-role="events"]').append(row);
    }
    function collect(){
      return {version:1,currency:seed.currency,asOf:iso(val('asOf').value),openingAsOf:iso(val('openingAsOf').value),cash:{opening:val('opening').value,closing:val('closing').value,kind:val('settled').checked?'settled_cash':'unknown'},historyConfirmed:val('history').checked,
        positions:positions.map(p=>{const row=[...node.querySelectorAll('[data-position]')].find(r=>r.dataset.position===p.id),before=row?.querySelector('[data-role="before"]');return {...p,before:before?(before.value||null):p.before,cause:row?row.querySelector('[data-role="cause"]').value:p.cause,confirmed:row?row.querySelector('[data-role="confirmed"]').checked:p.confirmed}}),
        events:[]};
    }
    function collectEvents(){return [...$('[data-role="events"]').children].map(row=>{const e={id:row.dataset.event,currency:seed.currency};for(const el of row.querySelectorAll('[data-event]'))e[el.dataset.event]=el.type==='checkbox'?el.checked:el.type==='datetime-local'?iso(el.value):el.value;return e})}
    function show(result,advice){
      const order=advice?.priorities||[],ordered=[...result.questions].sort((a,b)=>{const i=order.findIndex(x=>x.question_id===a.id),j=order.findIndex(x=>x.question_id===b.id);return (i<0?999:i)-(j<0?999:j)});
      $('[data-role="result"]').innerHTML=`<h4>${result.status==='matched'?'入力した明細と預り金は一致':'照合待ち'}</h4><p>計算上の残高：${esc(result.expected??'前回残高が不明')} ${esc(result.currency)} ／ 差額：${esc(result.difference??'未計算')}</p><p>受渡前：${result.pendingSettlements}件。${advice?'AIが確認順を提案しました。候補は未確定です。':''}</p><ol>${ordered.map(q=>{const recommended=order.find(x=>x.question_id===q.id)?.candidates||[];return `<li>${esc(q.text)}${recommended.length?'<p>確認候補：'+recommended.map(c=>esc(labels[c]||c)).join('・')+'</p>':''}</li>`}).join('')}</ol><p>一致は、入力した明細とこの通貨の預り金についての判定です。全資産・全取引の正確性を保証するものではありません。</p>`;
    }
    button('add').onclick=()=>{addEvent();invalid()};
    node.addEventListener('input',invalid);node.addEventListener('change',invalid);
    for(const e of seed.events||[])addEvent(e);
    button('analyze').onclick=()=>{try{input=collect();input.events=collectEvents();analysis=C.analyze(input);show(analysis);button('ai').disabled=!analysis.questions.length||!bridge.advise;button('save').disabled=!bridge.saveReview||!options.accountId;$('[data-role="status"]').textContent='回答を追加・修正したら、もう一度照合してください。'}catch(e){invalid();$('[data-role="status"]').textContent=e.message}};
    button('ai').onclick=async()=>{if(!analysis||!bridge.advise)return;const token=version,base=analysis,request=C.adviserInput(base);controller?.abort();controller=new AbortController();button('ai').disabled=true;
      try{const cacheKey=JSON.stringify(request),advice=adviceCache.get(cacheKey)||C.validateAdvice(request,await bridge.advise(request,controller.signal));if(!closed&&token===version){adviceCache.set(cacheKey,advice);show(base,advice);$('[data-role="status"]').textContent='AIは確認候補を並べ替えました。残高・取引は変更していません。'}}catch(_){if(!closed&&token===version)$('[data-role="status"]').textContent='AIは利用できません。表示中の質問でそのまま確認できます。'}finally{if(!closed&&token===version)button('ai').disabled=false}};
    button('save').onclick=async()=>{if(!input||!bridge.saveReview||!options.accountId)return;const token=version,payload=structuredClone(input);button('save').disabled=true;
      try{const saved=await bridge.saveReview({p_account_id:options.accountId,p_currency:seed.currency,p_expected_revision:revision,p_input:payload});if(!closed&&token===version){revision=saved.revision;$('[data-role="status"]').textContent='照合メモを保存しました。預り金や取引の本登録はしていません。'}}catch(_){if(!closed&&token===version)$('[data-role="status"]').textContent='保存できません。保存先の設定か、他端末による更新を確認してください。'}finally{if(!closed&&token===version)button('save').disabled=false}};
    // Restore only the same observation, never silently apply an older answer to a new screenshot.
    const untouched=version;
    if(options.accountId&&bridge.readReview)bridge.readReview(options.accountId,seed.currency).then(saved=>{
      if(closed||version!==untouched||!saved)return;revision=saved.revision;
      $('[data-role="status"]').textContent='前回の照合メモがあります。「前回のメモを開く」で内容を確認できます。';
      if(saved.input?.cash?.kind==='settled_cash'&&saved.input.cash.closing!==''&&saved.input.cash.closing!==null&&saved.input.cash.closing!==undefined&&Date.parse(saved.input.asOf)<Date.parse(seed.asOf)&&!val('opening').value){val('opening').value=saved.input.cash.closing;val('openingAsOf').value=dateValue(saved.input.asOf);$('[data-role="status"]').textContent='前回の照合メモから預り金と確認日時を入力しました。';}
      const reopen=document.createElement('button');reopen.type='button';reopen.className='secondary';reopen.textContent='前回のメモを開く';reopen.onclick=()=>{dispose();child=mount(node,{...options,input:saved.input,revision:saved.revision})};$('[data-role="status"]').append(reopen);
    }).catch(()=>{if(!closed&&version===untouched)$('[data-role="status"]').textContent='照合メモの保存先は未設定です。画面内の照合は利用できます。'});
    revision=options.revision||0;button('analyze').click();
    if(!options.accountId)$('[data-role="status"]').textContent='新しい口座の照合メモは、保有残高を初回登録して画面を開き直すと保存できます。';
    function dispose(){child?.dispose();child=null;closed=true;version++;controller?.abort();analysis=null;input=null;adviceCache.clear();node.removeEventListener('input',invalid);node.removeEventListener('change',invalid);node.replaceChildren()}
    return {dispose};
  }
  window.AssetFlowReconciliation={mount};
})();
