(function(){
  'use strict';
  window.AssetFlowScreenshots={init};
  function init(bridge){
    const C=window.ScreenshotCore,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const panel=document.createElement('section');panel.className='import-panel';panel.hidden=true;
    panel.innerHTML=`<div class="import-page sc-page"><div class="import-head"><h2>スクショから残高を登録</h2><button type="button" class="secondary" id="scClose">閉じる</button></div>
      <p>保有銘柄一覧を読み取り、現在の残高と照合します。購入履歴への追加は行いません。</p>
      <details class="card"><summary>必要な画像・画像の扱い</summary><p>「銘柄別に集計した保有一覧」を、列見出し付きで撮影してください。注文・約定履歴は対象外です。</p><ul><li>銘柄名・コード、保有数量、平均取得単価、通貨。年金など取得単価がない画面は購入金額を含めてください。</li><li>取得金額・評価額は表示できれば追加（取得単価と現在値を区別）</li><li>証券会社・口座区分は下で選択。口座番号・氏名・ログイン情報は隠してください。</li><li>同じ証券会社の画像を選択。複数の口座区分がある場合は、読み取り後に口座を切り替えて保存します。長い一覧は列見出しと1行分を重ねてください。</li></ul><p>画像は読取終了・失敗・取消時にアプリから解放し、保存しません。元の写真・ファイルや端末のバックアップは削除されません。外部へ送りたくない場合は端末で読み取った文字を入力できます。</p></details>
      <div class="card"><div class="field"><label for="scAccount">登録する口座</label><select id="scAccount"></select></div>
      <div id="scNewAccount" class="grid2"><div class="field"><label for="scBroker">証券会社</label><select id="scBroker"><option>SBI証券</option><option>楽天証券</option><option>マネックス証券</option></select></div><div class="field"><label for="scTax">口座区分</label><select id="scTax"><option>特定口座</option><option>一般口座</option><option>NISA</option></select></div></div>
      <div id="scNisaNotice" hidden><p>各行で成長・つみたて・旧NISAを指定してください。合計行と枠別行は混ぜません。画面に単に「NISA」とある場合は、対象の枠をご確認ください。</p><label class="sc-check"><input type="checkbox" id="scNisaAggregate">枠を指定しない行は、この口座のNISA全枠を含む銘柄別の合計です</label></div>
      <div class="grid2"><div class="field"><label for="scKind">商品区分</label><select id="scKind"><option value="stock">株式・ETF</option><option value="fund">投資信託</option></select></div><div class="field"><label for="scCurrency">取得単価の通貨</label><select id="scCurrency"><option value="JPY">日本円</option><option value="USD">米ドル</option></select></div></div>
      <div class="grid2"><div class="field"><label for="scBasis">取得単価の単位</label><select id="scBasis"><option value="1">1株・1口あたり</option><option value="10000">1万口あたり</option></select></div><div class="field"><label for="scAsOf">保有画面を確認した日時（日本時間）</label><input id="scAsOf" type="datetime-local" required><p class="small">過去の画像はその日時に変更してください。</p></div></div></div>
      <div class="card" id="scDrop"><h3>画像を選ぶ</h3><div class="import-actions"><button type="button" class="primary" id="scPhone">スマホ：写真から選ぶ</button><button type="button" class="secondary" id="scPc">PC：ファイルを選ぶ</button></div><input type="file" id="scFiles" accept="image/png,image/jpeg" multiple hidden><p>PCではここへドラッグ、または画像を貼り付けできます。PNG/JPEG、1枚8MBまで、最大5枚。</p><p id="scSelected">画像は未選択です</p><label class="sc-check"><input type="checkbox" id="scEnhance" checked>小さい文字を拡大して読み取る</label><label class="sc-check"><input type="checkbox" id="scConsent">選択した画像をGoogle Cloud Visionへ送信して文字を読み取る</label><button type="button" class="primary" id="scRead">読み取って画像を解放</button><button type="button" class="secondary" id="scDiscard">画像を破棄・読取を取消</button><p id="scImageStatus" role="status" aria-live="polite"></p></div>
      <details class="card"><summary>画像を送らず入力する／読取文字を見る</summary><label for="scText">必要な文字だけをコピー</label><textarea id="scText" rows="6" placeholder="コード、銘柄名、保有数量、平均取得単価を確認し、下の表へ入力してください"></textarea><p>端末の文字認識や証券会社の表示を参照して、下の表へ入力できます。この文字欄は保存しません。</p></details>
      <div class="card"><h3>読取結果を確認</h3><p>取得金額・評価額が不明なら空欄。取得単価から正確な取得総額を推定しません。画像にない銘柄は削除しません。</p><div id="scIssues" role="status"></div><div id="scRows"></div><button type="button" class="secondary" id="scAdd">銘柄を追加して入力</button><div class="field"><label for="scCount">今回登録する銘柄数（重複を除く）</label><input id="scCount" type="number" min="1" max="200" step="1"></div><label class="sc-check"><input type="checkbox" id="scReviewed">すべての画像・行を確認し、口座・銘柄・数量・単価・通貨が一致している</label><button type="button" class="primary" id="scCompare">登録内容との差を確認</button><div id="scDiff"></div><button type="button" class="primary" id="scSave" disabled>確認した残高を保存</button><p id="scStatus" role="status" aria-live="polite"></p></div></div>`;
    const style=document.createElement('style');style.textContent='.sc-page{font-size:16px}.sc-page .card{padding:18px;margin-bottom:14px}.sc-page h2{font-size:20px}.sc-page h3{font-size:18px}.sc-page summary{cursor:pointer;font-weight:700}.sc-page p,.sc-page li{line-height:1.7}.sc-page label{font-size:14px}.sc-page textarea{width:100%;background:var(--surface);color:var(--text);padding:10px;border:1px solid var(--line);border-radius:10px}.sc-check{display:flex;align-items:flex-start;gap:10px;margin:16px 0}.sc-check input{width:20px;min-width:20px;height:20px}.sc-row{border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}.sc-row-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sc-row input,.sc-row select{min-width:0}.sc-page button{min-height:44px;margin:4px 0}.sc-diff{padding:12px;border-bottom:1px solid var(--line)}@media(max-width:600px){.sc-row-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-page .import-actions{display:grid;grid-template-columns:1fr}.sc-page{padding:12px}.sc-page .card{padding:14px}}';document.head.append(style);document.body.append(panel);
    const $=id=>panel.querySelector('#'+id);
    $('scBroker').insertAdjacentHTML('beforeend','<option>年金運営管理機関</option>');$('scTax').insertAdjacentHTML('beforeend','<option>iDeCo・企業型DC</option>');
    panel.querySelector('label[for="scCount"]').textContent='今回登録する残高の行数（枠・コースごと。重複を除く）';
    const scopeLabels={account_total:'枠の区別なし・全枠合計',nisa_growth:'NISA 成長投資枠',nisa_accumulation:'NISA つみたて投資枠',legacy_nisa:'旧一般NISA',legacy_accumulation:'旧つみたてNISA'};
    const courseLabels={total:'コースの区別なし・全コース合計',receive:'受取コース',reinvest:'再投資コース'};
    let files=[],controller=null,rows=[],accounts=[],assets=[],positions=[],plan=null,batchId=null,openUser=null,timer=null,busy=false,requestPayload=null,generation=0,editVersion=0,cashReview=null,cashHints=[];
    const invalidate=()=>{cashReview?.dispose();cashReview=null;editVersion++;plan=null;batchId=null;requestPayload=null;$('scSave').disabled=true;$('scDiff').textContent='';};
    const lock=on=>{panel.querySelectorAll('input,select,textarea,#scAdd,#scCompare,#scPhone,#scPc').forEach(el=>el.disabled=on)};
    function releaseImages(message){controller?.abort();controller=null;files=[];$('scFiles').value='';$('scSelected').textContent='画像は保持していません';$('scImageStatus').textContent=message||'画像をアプリから解放しました。';}
    function close(){cashReview?.dispose();cashReview=null;generation++;releaseImages();clearTimeout(timer);busy=false;lock(false);$('scRead').disabled=false;rows=[];cashHints=[];plan=null;requestPayload=null;batchId=null;openUser=null;positions=[];assets=[];$('scText').value='';$('scRows').replaceChildren();$('scDiff').replaceChildren();$('scIssues').replaceChildren();panel.hidden=true;}
    async function open(){
      close();panel.hidden=false;openUser=bridge.getUser()?.id;const token=generation;
      $('scStatus').textContent='口座と登録内容を確認しています…';$('scConsent').checked=false;$('scReviewed').checked=false;$('scCount').value='';
      $('scAsOf').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T');
      timer=setTimeout(close,10*60*1000);
      try{
        if(!openUser)throw Error('ログインしてください');
        const loaded=await Promise.all([bridge.readAccounts(),bridge.readAssets()]);
        if(token!==generation||panel.hidden)return;
        if(openUser!==bridge.getUser()?.id)return close();
        [accounts,assets]=loaded;
        $('scAccount').innerHTML=accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.institution)}・${esc(a.account_type)}${a.name!==a.institution?'・'+esc(a.name):''}</option>`).join('')+'<option value="new">新しい口座を登録</option>';
        updateAccountScope();
        await refreshPositions(token);if(token!==generation||panel.hidden)return;$('scStatus').textContent='画像を選ぶか、必要項目を入力してください。';
      }catch(_error){if(token===generation&&!panel.hidden)$('scStatus').textContent='保存機能の初期設定が必要です。画像読取と表の入力は準備できます。';}
    }
    async function refreshPositions(token=generation){const loaded=await bridge.readPositions();if(token===generation&&!panel.hidden)positions=loaded;}
    function selectedAccount(){return accounts.find(a=>a.id===$('scAccount').value)||null;}
    const selectedBroker=()=>selectedAccount()?.institution||$('scBroker').value;
    function isNisa(){return /NISA/i.test(selectedAccount()?.account_type||$('scTax').value);}
    const selectedTax=()=>selectedAccount()?.account_type||$('scTax').value;
    function matchesAccount(r){return !r.account_type||r.account_type===selectedTax()||r.account_type==='NISA'&&isNisa()}
    function updateAccountScope(){rows=collect();$('scNewAccount').hidden=$('scAccount').value!=='new';$('scNisaNotice').hidden=!isNisa();$('scNisaAggregate').checked=false;$('scReviewed').checked=false;$('scCount').value='';invalidate();renderRows();}
    function collect(){
      return [...$('scRows').querySelectorAll('.sc-row')].map((node,i)=>{
        const r={...rows[i]};for(const input of node.querySelectorAll('[data-field]'))r[input.dataset.field]=input.type==='checkbox'?input.checked:input.value;
        return {...r,kind:r.kind||$('scKind').value,currency:r.currency||$('scCurrency').value,price_basis:Number(r.price_basis||$('scBasis').value)};
      });
    }
    function renderRows(){
      $('scRows').innerHTML=rows.map((r,i)=>`<div class="sc-row"><div class="sc-row-grid">${[['ticker','コード・ティッカー'],['name','銘柄名'],['quantity','保有数量'],['acquisition_price','平均取得単価'],['cost_total','取得金額（任意）'],['statement_value','評価額（任意）']].map(([k,label])=>`<div class="field"><label for="sc-${i}-${k}">${label}</label><input id="sc-${i}-${k}" data-field="${k}" value="${esc(r[k])}" ${['name','ticker'].includes(k)?'':'inputmode="decimal"'}></div>`).join('')}</div><div class="field"><label for="sc-${i}-asset">登録済み銘柄との対応</label><select id="sc-${i}-asset" data-field="asset_id"><option value="">コード・名称の完全一致で照合</option>${assets.filter(a=>a.asset_type===$('scKind').value&&a.currency===$('scCurrency').value).map(a=>`<option value="${esc(a.id)}" ${r.asset_id===a.id?'selected':''}>${esc(a.name)} (${esc(a.ticker||'コードなし')})</option>`).join('')}</select></div><label class="sc-check"><input type="checkbox" data-field="new_confirmed" ${r.new_confirmed?'checked':''}>一致する銘柄がなければ、新しい銘柄として登録する</label><button type="button" class="secondary" data-remove="${i}">この行を除く</button></div>`).join('');
      $('scRows').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{rows=collect();rows.splice(Number(b.dataset.remove),1);invalidate();renderRows()});
      rows.forEach((r,i)=>{
        const grid=$('scRows').children[i].querySelector('.sc-row-grid');
        const kind=r.kind||$('scKind').value,currency=r.currency||$('scCurrency').value;
        const fields=[['kind','商品区分',{stock:'株式・ETF',fund:'投資信託'},kind],['currency','取得単価の通貨',{JPY:'日本円',USD:'米ドル'},currency],['price_basis','単価の単位',{'1':'1株・1口','10000':'1万口'},String(r.price_basis||$('scBasis').value)],['holding_scope','NISA枠',scopeLabels,r.holding_scope||'account_total'],['distribution_course','分配金コース',courseLabels,r.distribution_course||'total'],['cost_currency','取得金額の通貨',{JPY:'日本円',USD:'米ドル'},r.cost_currency||currency],['statement_currency','評価額の通貨',{JPY:'日本円',USD:'米ドル'},r.statement_currency||currency]];
        for(const [key,label,options,selected] of fields){const field=document.createElement('div');field.className='field';field.innerHTML=`<label for="sc-${i}-${key}">${label}</label><select id="sc-${i}-${key}" data-field="${key}">${Object.entries(options).map(([value,text])=>`<option value="${value}" ${value===selected?'selected':''}>${text}</option>`).join('')}</select>`;grid.append(field)}
        if(kind==='fund')grid.querySelector(`label[for="sc-${i}-acquisition_price"]`).textContent='平均取得単価（表示がなければ空欄）';
        $('scRows').children[i].hidden=!matchesAccount(r);
        const asset=$('sc-'+i+'-asset');asset.innerHTML='<option value="">コード・名称の完全一致で照合</option>'+assets.filter(a=>a.asset_type===kind&&a.currency===currency).map(a=>`<option value="${esc(a.id)}" ${r.asset_id===a.id?'selected':''}>${esc(a.name)} (${esc(a.ticker||'コードなし')})</option>`).join('');
      });
      const deferred=rows.filter(r=>!matchesAccount(r));if(deferred.length)$('scStatus').textContent=`別の口座区分の${deferred.length}行は保持しています。上の登録口座を切り替えて確認・保存できます。画面を閉じると破棄されます。`;
    }
    function pick(list){
      if(busy)return;
      releaseImages('');invalidate();
      const selected=[...list];
      if(!selected.length||selected.length>5||selected.some(f=>!['image/png','image/jpeg'].includes(f.type)||f.size>8*1024*1024)){$('scImageStatus').textContent='PNG/JPEGを最大5枚、1枚8MB以内で選んでください';return;}
      files=selected;$('scSelected').textContent=files.length+'枚を選択中（未送信）';$('scImageStatus').textContent='読取後は画像を残しません。';
    }
    async function read(){
      if(busy)return;if(!$('scConsent').checked){$('scImageStatus').textContent='送信先の確認にチェックを入れてください';return;}
      if(!files.length){$('scImageStatus').textContent='画像を選択してください';return;}
      busy=true;lock(true);$('scRead').disabled=true;rows=collect();invalidate();controller=new AbortController();
      const signal=controller.signal,owner=openUser,token=generation,settings={kind:$('scKind').value,currency:$('scCurrency').value,price_basis:Number($('scBasis').value),account_type:selectedTax()};let file=null;
      try{
        let page=0;
        while(files.length){
          file=files.shift();$('scImageStatus').textContent=(++page)+'枚目を読取中…';
          file=await window.ScreenshotImage.prepare(file,{enhance:$('scEnhance').checked,signal});
          if(token!==generation||panel.hidden||owner!==bridge.getUser()?.id||signal.aborted)return;
          let result=await bridge.readImage(file,signal);file=null;
          if(token!==generation||panel.hidden||owner!==bridge.getUser()?.id||signal.aborted)return;
          const parsed=window.ScreenshotLayouts?window.ScreenshotLayouts.parse(result.words||[],settings):C.suggestRows(result.words||[],settings);
          cashHints.push(...(parsed.cash||[]).map(h=>({...h,institution:selectedBroker(),observedAsOf:$('scAsOf').value})));
          rows.push(...parsed.rows);$('scText').value+=result.text+'\n';
          for(const issue of parsed.issues){const p=document.createElement('p');p.textContent=issue;$('scIssues').append(p)}
          result=null;renderRows();lock(true);
        }
        const deferred=rows.filter(r=>!matchesAccount(r)).length;
        $('scStatus').textContent='文字・数値だけが残っています。全行を元の画面と照合してください。'+(deferred?` 別の口座区分の${deferred}行は、登録口座を切り替えて保存してください。`:'');
      }catch(_error){if(token===generation&&!panel.hidden)$('scStatus').textContent=_error.code==='quota'?'画像読取の回数制限または初期設定を確認してください。費用を抑えるため読取を停止しました。文字入力は利用できます。':'読取を完了できませんでした。API設定を確認するか、文字入力を利用してください。';}
      finally{file=null;if(token===generation){releaseImages('読取に使用した画像をアプリから解放しました。');busy=false;lock(false);$('scRead').disabled=false;$('scReviewed').checked=false;}}
    }
    function resolveAsset(r){
      if(r.asset_id){const a=assets.find(a=>a.id===r.asset_id&&a.asset_type===r.kind&&a.currency===r.currency);if(!a)throw Error('銘柄と通貨の対応を確認してください');return a.id;}
      const matches=assets.filter(a=>a.asset_type===r.kind&&a.currency===r.currency&&(r.ticker&&C.clean(a.ticker).toUpperCase()===r.ticker||!r.ticker&&r.kind==='fund'&&C.clean(a.name)===r.name));
      if(matches.length>1)throw Error(r.name+'：対応する登録済み銘柄を選んでください');
      return matches[0]?.id||null;
    }
    async function compare(){
      if(busy)return;
      invalidate();$('scStatus').textContent='登録内容を読み直しています…';
      const token=generation,editing=editVersion;
      try{
        if(openUser!==bridge.getUser()?.id)throw Error('ログインし直してください');
        if(!$('scReviewed').checked)throw Error('全行と口座・単位を確認してください');
        const date=new Date($('scAsOf').value+':00+09:00');if(!Number.isFinite(+date)||date>Date.now()+300000)throw Error('確認日時を見直してください');
        await refreshPositions(token);if(token!==generation||editing!==editVersion||panel.hidden)return;rows=collect();
        const normalized=rows.filter(matchesAccount).map(raw=>{const r=C.normalize(raw);r.asset_id=resolveAsset(r);if(!r.asset_id&&!raw.new_confirmed)throw Error(r.name+'：既存銘柄を選ぶか、新しい銘柄であることを確認してください');return r});
        if(isNisa()&&normalized.some(r=>r.holding_scope==='account_total')&&!$('scNisaAggregate').checked)throw Error('NISAの枠を指定するか、全枠合計であることを確認してください');
        if(!isNisa()&&normalized.some(r=>r.holding_scope!=='account_total'))throw Error('NISA枠はNISA口座を選択してください');
        const account=selectedAccount(),previous=positions.filter(p=>p.account_id===account?.id).map(p=>({...p,name:p.assets.name,ticker:p.assets.ticker,kind:p.assets.asset_type,currency:p.assets.currency}));
        const diff=C.compare(previous,normalized);
        if(!diff.rows.length||Number($('scCount').value)!==diff.rows.length)throw Error('重複を除いた銘柄数を確認してください');
        for(const change of diff.changes){const stored=positions.find(p=>p.account_id===account?.id&&p.asset_id===change.row.asset_id&&(p.holding_scope||'account_total')===change.row.holding_scope&&(p.distribution_course||'total')===change.row.distribution_course);change.row.expected_revision=Number(stored?.revision||0);if(stored&&date<new Date(stored.as_of))throw Error(change.row.name+'：前回より古い画像です');}
        const labels={new:'残高を初登録（購入追加ではありません）',unchanged:'変更なし・追加しません',quantity:'保有数量の更新（売買とは判定しません）',acquisition:'取得価格・取得金額の変更を確認',valuation:'評価額のみ更新'};
        const value=(r,k)=>r?.[k]===null||r?.[k]===undefined?'不明':esc(r[k]);
        $('scDiff').innerHTML=`<p>重なった同じ行：${diff.overlaps}件をまとめました。画像にない銘柄は変更しません。</p>`+diff.changes.map(c=>`<div class="sc-diff"><b>${esc(c.row.name)}</b><br>${scopeLabels[c.row.holding_scope]}・${courseLabels[c.row.distribution_course]}<br>${labels[c.status]}<br>数量 ${c.prior?value(c.prior,'quantity')+' → ':''}${value(c.row,'quantity')}<br>取得単価 ${c.prior?value(c.prior,'acquisition_price')+' / '+c.prior.price_basis+'単位 → ':''}${value(c.row,'acquisition_price')} / ${c.row.price_basis}単位 (${esc(c.row.currency)})<br>取得金額 ${c.prior?value(c.prior,'cost_total')+' '+c.prior.cost_currency+' → ':''}${value(c.row,'cost_total')} ${c.row.cost_currency}<br>評価額 ${c.prior?value(c.prior,'statement_value')+' '+c.prior.statement_currency+' → ':''}${value(c.row,'statement_value')} ${c.row.statement_currency}</div>`).join('');
        plan={...diff,account,date:date.toISOString(),broker:$('scBroker').value,tax:$('scTax').value,nisaAggregate:isNisa()&&normalized.every(r=>r.holding_scope==='account_total')&&$('scNisaAggregate').checked};batchId=crypto.randomUUID();$('scSave').disabled=false;$('scStatus').textContent='差分を確認して保存してください。';
        if(window.AssetFlowReconciliation){
          const target=document.createElement('div');target.dataset.cashReview='';$('scDiff').append(target);
          const currencies=[...new Set(normalized.map(r=>r.currency))],cashCurrency=currencies.length===1?currencies[0]:$('scCurrency').value,hints=cashHints.filter(h=>h.currency===cashCurrency&&h.institution===selectedBroker()&&h.observedAsOf===$('scAsOf').value);
          cashReview=window.AssetFlowReconciliation.mount(target,{accountId:account?.id,bridge,input:{version:1,currency:cashCurrency,asOf:date.toISOString(),openingAsOf:null,cash:{opening:null,closing:hints.length===1?hints[0].amount:null,kind:'unknown'},historyConfirmed:false,events:[],positions:diff.changes.map((c,i)=>({id:(c.row.asset_id||'new-'+i)+':'+c.row.holding_scope+':'+c.row.distribution_course,name:c.row.name+' '+scopeLabels[c.row.holding_scope]+' '+courseLabels[c.row.distribution_course],before:c.prior?.quantity??null,after:c.row.quantity,cause:'unknown',confirmed:false}))}});
        }
      }catch(error){$('scStatus').textContent=error.message;}
    }
    async function save(){
      if(!plan||busy)return;busy=true;lock(true);$('scSave').disabled=true;
      const attempt=plan,token=generation;
      try{
        if(openUser!==bridge.getUser()?.id)throw Error('ログインし直してください');
        if(!requestPayload){
          const resolved=await bridge.resolveEntities({p_account_id:attempt.account?.id||null,p_institution:attempt.broker,p_account_type:attempt.tax,
            p_assets:attempt.rows.map(r=>({asset_id:r.asset_id,name:r.name,ticker:r.ticker,kind:r.kind,currency:r.currency,allow_create:!r.asset_id}))});
          if(token!==generation||openUser!==bridge.getUser()?.id)return;
          const payloadRows=[];
          for(const [index,row] of attempt.rows.entries()){
            const assetId=resolved.asset_ids[index];
            const change=attempt.changes.find(c=>C.key(c.row)===C.key(row));
            payloadRows.push({asset_id:assetId,quantity:row.quantity,acquisition_price:row.acquisition_price,price_basis:row.price_basis,cost_total:row.cost_total,statement_value:row.statement_value,cost_currency:row.cost_currency,statement_currency:row.statement_currency,holding_scope:row.holding_scope,distribution_course:row.distribution_course,expected_revision:change.row.expected_revision});
          }
          requestPayload={p_batch_id:batchId,p_account_id:resolved.account_id,p_as_of:attempt.date,p_rows:payloadRows,p_nisa_aggregate:attempt.nisaAggregate};
        }
        const result=await bridge.save(requestPayload);
        if(token!==generation||panel.hidden||openUser!==bridge.getUser()?.id)return;
        $('scStatus').textContent=`保存済み：初回照合 ${result.registered}件・残高更新 ${result.updated}件・変更なし ${result.unchanged}件。購入履歴への追加はありません。`;
        const savedAccountId=requestPayload.p_account_id;
        plan=null;requestPayload=null;batchId=null;
        try{
          const refreshed=await Promise.all([bridge.readAccounts(),bridge.readAssets()]);
          if(token!==generation||panel.hidden||openUser!==bridge.getUser()?.id)return;
          [accounts,assets]=refreshed;
          if(!accounts.some(a=>a.id===savedAccountId))throw Error('saved account unavailable');
          $('scAccount').innerHTML=accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.institution)}・${esc(a.account_type)}${a.name!==a.institution?'・'+esc(a.name):''}</option>`).join('')+'<option value="new">新しい口座を登録</option>';
          $('scAccount').value=savedAccountId;$('scNewAccount').hidden=true;
          await refreshPositions(token);await bridge.onSaved();
        }catch(_error){if(token===generation&&!panel.hidden)$('scStatus').textContent+=' 一覧の再読込に失敗しました。画面を開き直してください。保存は完了しています。';}
      }catch(_error){if(token===generation&&!panel.hidden){$('scStatus').textContent='保存結果を確認できませんでした。同じ内容なら再度「保存」で結果を確認できます。変更が競合した場合は差分を確認し直してください。';$('scSave').disabled=false;}}
      finally{if(token===generation){busy=false;lock(false);}}
    }
    $('scClose').onclick=close;$('scDiscard').onclick=()=>releaseImages('読取を取り消し、画像を解放しました。');
    $('scPhone').onclick=$('scPc').onclick=()=>$('scFiles').click();$('scFiles').onchange=()=>{pick($('scFiles').files);$('scFiles').value=''};
    $('scDrop').ondragover=e=>e.preventDefault();$('scDrop').ondrop=e=>{e.preventDefault();if(!busy)pick(e.dataTransfer.files)};
    panel.addEventListener('paste',e=>{const imgs=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile());if(imgs.length&&!busy){e.preventDefault();pick(imgs)}});
    $('scRead').onclick=read;$('scCompare').onclick=compare;$('scSave').onclick=save;
    $('scAdd').onclick=()=>{rows=collect();rows.push({});invalidate();renderRows()};
    panel.addEventListener('input',e=>{if(e.target.closest('[data-cash-review]'))return;if(e.target.id!=='scConsent'&&e.target.id!=='scText'){if(e.target.id!=='scReviewed')$('scReviewed').checked=false;invalidate()}});
    $('scAccount').onchange=updateAccountScope;$('scTax').onchange=updateAccountScope;
    $('scKind').onchange=()=>{rows=collect();$('scBasis').value=$('scKind').value==='fund'?'10000':'1';invalidate();renderRows()};
    panel.addEventListener('change',e=>{if(['kind','currency'].includes(e.target.dataset.field)){rows=collect();invalidate();renderRows()}});
    window.addEventListener('pagehide',close);
    document.querySelectorAll('[data-screenshot-entry]').forEach(b=>b.onclick=open);
    return {open,close};
  }
})();
