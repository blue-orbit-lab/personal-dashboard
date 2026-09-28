(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const localTime=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(s)).replace(' ','T');
 function init(bridge){
  const panel=document.createElement('section');panel.className='import-panel';panel.hidden=true;
  panel.innerHTML=`<div class="import-page sc-page"><div class="import-head"><h2>預り金・預金を確認して登録</h2><button type="button" class="secondary" data-action="close">閉じる</button></div>
   <p>金融機関に表示された現在残高を登録します。残高の差を購入・売却・利益として記録しません。</p>
   <div class="card"><label>資金口座<select data-field="scope"></select></label><label>自分用の口座名<input data-field="name" maxlength="100" placeholder="例：楽天証券の預り金"></label>
   <p>同じ預り金を共有する口座区分をすべて選んでください。別の銀行口座や、別名義の口座を一緒にしません。既存の預金登録は、この対応付けを確認すると集計上置き換わります。</p><div data-role="accounts"></div>
   <label>表示方法<select data-field="mode"><option value="native">通貨別の残高（円・ドル）</option><option value="aggregate_jpy">外貨を含む円換算合計だけ</option></select></label>
   <label data-role="jpy-label">日本円残高<input data-field="jpy" inputmode="decimal"></label><label data-role="usd-label">米ドル残高<input data-field="usd" inputmode="decimal"></label>
   <p>ゼロは0を入力します。通貨別では、存在する通貨の残高をすべて入力してください。円換算合計には外貨の内訳を加算しません。合計から円残高を逆算しません。</p>
   <label>残高の確認日時（日本時間）<input data-field="asOf" type="datetime-local" step="1"></label>
   <label class="sc-check"><input data-field="confirmed" type="checkbox">選択した口座全体の受渡済み残高で、通貨と合計・内訳の関係を確認した（買付余力・保有商品評価額ではない）</label>
   <label class="sc-check"><input data-field="transfer" type="checkbox">振替元と振替先、両替の両通貨の反映を確認した。受渡前・反映待ちの金額を重ねていない</label>
   <button type="button" class="primary" data-action="save" disabled>確認した残高を保存</button><p data-role="status" role="status"></p></div></div>`;
  document.body.append(panel);
  const $=s=>panel.querySelector(s),field=k=>$('[data-field="'+k+'"]'),button=k=>$('[data-action="'+k+'"]'),status=$('[data-role="status"]');
  let generation=0,owner=null,accounts=[],scopes=[],payload=null,busy=false,ready=false;
  function close(){generation++;owner=null;ready=false;payload=null;busy=false;accounts=[];scopes=[];panel.hidden=true;field('jpy').value='';field('usd').value='';field('name').value='';field('confirmed').checked=false;field('transfer').checked=false;$('[data-role="accounts"]').replaceChildren();}
  function selected(){return scopes.find(s=>s.id===field('scope').value);}
  function changed(){payload=null;field('confirmed').checked=false;field('transfer').checked=false;status.textContent='表示・範囲を確認してから保存してください。';}
  function show(){
   const s=selected(),covered=new Set(scopes.flatMap(x=>x.account_ids));
   field('name').value=s?.name||'';field('mode').value=s?.mode||'native';field('jpy').value=s?.balances.find(r=>r.currency==='JPY')?.balance||'';field('usd').value=s?.balances.find(r=>r.currency==='USD')?.balance||'';
   field('asOf').value=localTime(s?.as_of||Date.now());
   $('[data-role="accounts"]').innerHTML=accounts.map(a=>`<label class="sc-check"><input type="checkbox" data-account="${esc(a.id)}" ${s?.account_ids.includes(a.id)?'checked':''} ${s||covered.has(a.id)?'disabled':''}>${esc(a.institution)}・${esc(a.account_type)}・${esc(a.name)}</label>`).join('');
   mode();changed();button('save').disabled=!ready;
  }
  function mode(){const aggregate=field('mode').value==='aggregate_jpy';$('[data-role="usd-label"]').hidden=aggregate;if(aggregate)field('usd').value='';$('[data-role="jpy-label"]').firstChild.textContent=aggregate?'外貨を含む円換算合計':'日本円残高';}
  function lock(on){panel.querySelectorAll('input,select,button').forEach(el=>{if(el!==button('close'))el.disabled=on;});if(!on){const s=selected(),covered=new Set(scopes.flatMap(x=>x.account_ids));panel.querySelectorAll('[data-account]').forEach(el=>el.disabled=!!s||covered.has(el.dataset.account));button('save').disabled=!ready;}}
  async function open(){
   close();panel.hidden=false;owner=bridge.getUser()?.id;const token=generation;status.textContent='登録口座と預り金を読み込んでいます…';lock(true);
   try{if(!owner)throw Error('ログインしてください');const loaded=await Promise.all([bridge.readAccounts(),bridge.readCash()]);if(token!==generation||owner!==bridge.getUser()?.id)return;[accounts,scopes]=loaded;
    ready=true;field('scope').innerHTML='<option value="">新しい資金口座を対応付ける</option>'+scopes.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');show();
   }catch(_){if(token===generation)status.textContent='預り金の保存機能を準備中です。残高は保存・加算していません。';}finally{if(token===generation)lock(false);}
  }
  field('scope').onchange=show;field('mode').onchange=()=>{mode();changed();};
  panel.addEventListener('input',e=>{if(e.target!==field('confirmed')&&e.target!==field('transfer'))changed();});
  button('close').onclick=close;
  button('save').onclick=async()=>{
   if(busy||!ready)return;const token=generation;
   try{
    if(!owner||owner!==bridge.getUser()?.id)throw Error('ログインし直してください');
    const s=selected(),ids=s?s.account_ids:[...panel.querySelectorAll('[data-account]:checked')].map(el=>el.dataset.account);
    if(!ids.length)throw Error('対応する口座を選んでください');if(!field('name').value.trim())throw Error('資金口座の名前を入力してください');
    const time=field('asOf').value,at=time.length===16?time+':00+09:00':time+'+09:00';
    const data=window.CashCore.observation({mode:field('mode').value,jpy:field('jpy').value,usd:field('usd').value,asOf:at,confirmed:field('confirmed').checked,transferChecked:field('transfer').checked});
    payload=payload||{p_batch_id:crypto.randomUUID(),p_scope_id:s?.id||null,p_name:field('name').value.trim(),p_account_ids:ids,p_as_of:data.asOf,p_mode:data.mode,p_balances:data.rows,p_expected_revision:s?.revision||0,p_confirmed:true,p_transfer_checked:true};
    busy=true;lock(true);status.textContent='保存しています…';
    const result=await bridge.saveCash(structuredClone(payload));if(token!==generation||owner!==bridge.getUser()?.id)return;
    // A successful write stays successful even if the following read fails.
    ready=false;payload=null;status.textContent='残高の保存は完了しました。表示を読み直しています…';
    try{const refreshed=await bridge.readCash();if(token!==generation||owner!==bridge.getUser()?.id)return;scopes=refreshed;await bridge.onSaved();if(token!==generation||owner!==bridge.getUser()?.id)return;
     field('scope').innerHTML='<option value="">新しい資金口座を対応付ける</option>'+scopes.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');field('scope').value=result.scope_id;ready=true;show();status.textContent='残高を保存し、表示を更新しました。取引や利益は作成していません。';
    }catch(_){if(token===generation)status.textContent='残高の保存は完了しました。再読込に失敗したため、閉じてから開き直してください。再保存は不要です。';}
   }catch(e){if(token===generation)status.textContent=busy?'保存結果を確認できません。同じ内容で再試行できます。競合・古い日時の場合は閉じて読み直してください。':e.message;}
   finally{if(token===generation){busy=false;lock(false);}}
  };
  document.querySelectorAll('[data-cash-entry]').forEach(el=>el.addEventListener('click',open));return {open,close};
 }
 window.AssetFlowCash={init};
})();
