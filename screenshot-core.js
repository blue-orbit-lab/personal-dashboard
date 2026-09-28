(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ScreenshotCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=v=>String(v??'').normalize('NFKC').trim();
  const scopes=['account_total','nisa_growth','nisa_accumulation','legacy_nisa','legacy_accumulation'];
  const courses=['total','receive','reinvest'];
  function decimal(v,{optional=false}={}){
    let text=clean(v);
    if(optional&&(text===''||text==='--'||text==='—'))return null;
    // Do not guess ambiguous OCR glyphs, currency or units.
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,10})?$/.test(text))throw Error('数値を確認してください：'+text.slice(0,40));
    text=text.replaceAll(',','');let [a,b='']=text.split('.');a=a.replace(/^0+(?=\d)/,'');b=b.replace(/0+$/,'');
    if(a.length>18)throw Error('数値が大きすぎます');
    return a+(b?'.'+b:'');
  }
  function perUnit(v,basis){
    const s=decimal(v);if(basis===1)return s;if(basis!==10000)throw Error('価格単位を確認してください');
    const [whole,frac='']=s.split('.');const digits=(whole+frac).padStart(frac.length+5,'0');
    const at=digits.length-frac.length-4;
    return (digits.slice(0,at).replace(/^0+(?=\d)/,'')||'0')+'.'+digits.slice(at).replace(/0+$/,'');
  }
  function exactUnit(v,basis){return perUnit(v,basis).replace(/\.$/,'')}
  function normalize(row){
    const name=clean(row.name),ticker=clean(row.ticker).toUpperCase();
    if(!name||name.length>160)throw Error('銘柄名を確認してください');
    if(!['stock','fund'].includes(row.kind)||!['JPY','USD'].includes(row.currency))throw Error('商品区分と通貨を確認してください');
    if(row.kind==='stock'&&!/^[A-Z0-9.^:/-]{1,20}$/.test(ticker))throw Error('株式の銘柄コード・ティッカーを確認してください');
    const basis=Number(row.price_basis);if(![1,10000].includes(basis)||row.kind==='stock'&&basis!==1)throw Error('取得単価の単位を確認してください');
    const holding_scope=row.holding_scope||'account_total',distribution_course=row.distribution_course||'total';
    const cost_currency=row.cost_currency||row.currency,statement_currency=row.statement_currency||row.currency;
    if(!scopes.includes(holding_scope)||!courses.includes(distribution_course)||row.kind==='stock'&&distribution_course!=='total')throw Error('NISA枠と分配金コースを確認してください');
    if(!['JPY','USD'].includes(cost_currency)||!['JPY','USD'].includes(statement_currency))throw Error('取得金額と評価額の通貨を確認してください');
    return {asset_id:row.asset_id||null,name,ticker,kind:row.kind,currency:row.currency,holding_scope,distribution_course,cost_currency,statement_currency,
      quantity:decimal(row.quantity),acquisition_price:decimal(row.acquisition_price,{optional:row.kind==='fund'}),price_basis:basis,
      cost_total:decimal(row.cost_total,{optional:true}),statement_value:decimal(row.statement_value,{optional:true}),
      expected_revision:Number(row.expected_revision||0)};
  }
  const assetKey=r=>JSON.stringify([r.asset_id||[r.kind,r.ticker||clean(r.name),r.currency],r.currency]);
  const key=r=>JSON.stringify([assetKey(r),r.holding_scope||'account_total',r.distribution_course||'total']);
  const unit=r=>r.acquisition_price===null?null:exactUnit(r.acquisition_price,r.price_basis);
  function equal(a,b){return a.quantity===b.quantity&&unit(a)===unit(b)&&a.cost_total===b.cost_total&&a.cost_currency===b.cost_currency&&a.statement_value===b.statement_value&&a.statement_currency===b.statement_currency}
  function checkCoverage(rows){
    for(const [i,a] of rows.entries())for(const b of rows.slice(i+1))if(assetKey(a)===assetKey(b)){
      if(a.holding_scope!==b.holding_scope&&[a.holding_scope,b.holding_scope].includes('account_total'))throw Error(a.name+'：NISA全枠の合計と枠別残高を混在できません');
      if(a.holding_scope===b.holding_scope&&a.distribution_course!==b.distribution_course&&[a.distribution_course,b.distribution_course].includes('total'))throw Error(a.name+'：分配金コースの合計とコース別残高を混在できません');
    }
  }
  function deduplicate(rows){
    const map=new Map();let overlaps=0;
    for(const raw of rows){const row=normalize(raw),k=key(row),old=map.get(k);
      if(old){if(!equal(old,row))throw Error(row.name+'：同じ銘柄に異なる数値があります。合算せず確認してください');overlaps++;}
      else map.set(k,row);
    }
    const unique=[...map.values()];checkCoverage(unique);return {rows:unique,overlaps};
  }
  function compare(previous,incoming){
    const old=new Map(deduplicate(previous).rows.map(n=>[key(n),n]));
    const data=deduplicate(incoming);
    checkCoverage([...old.values(),...data.rows]);
    return {...data,changes:data.rows.map(row=>{
      const prior=old.get(key(row));let status='new';
      if(prior){status=equal(prior,row)?'unchanged':prior.quantity!==row.quantity?'quantity':unit(prior)!==unit(row)||prior.cost_total!==row.cost_total||prior.cost_currency!==row.cost_currency?'acquisition':'valuation'}
      return {row,prior:prior||null,status};
    })};
  }
  function wordsToLines(words){
    const lines=[];
    for(const word of words.slice().sort((a,b)=>a.y-b.y||a.x-b.x)){
      const line=lines.find(l=>Math.abs(l.y-word.y)<=Math.max(3,Math.min(l.h,word.h)*0.55));
      if(line)line.words.push(word);else lines.push({y:word.y,h:word.h,words:[word]});
    }
    return lines.sort((a,b)=>a.y-b.y).map(l=>({...l,words:l.words.sort((a,b)=>a.x-b.x)}));
  }
  function suggestRows(words,{kind,currency,price_basis}){
    const aliases={name:['銘柄名','銘柄'],ticker:['銘柄コード','コード','ティッカー'],quantity:['保有数量','保有株数','保有口数','数量'],acquisition_price:['平均取得単価','取得単価','平均取得価額'],cost_total:['取得金額','取得価額合計'],statement_value:['評価額','評価金額']};
    const lines=wordsToLines(words);let columns=[],header=-1;
    // Deliberately accept only a recognized single-line table; card layouts fall back to review entry.
    for(let i=0;i<lines.length;i++){
      const found=[];const used=new Set();
      for(let w=0;w<lines[i].words.length;w++){
        for(let n=Math.min(5,lines[i].words.length-w);n>0;n--){
          const group=lines[i].words.slice(w,w+n),text=group.map(x=>clean(x.text)).join('').replace(/\s/g,'');
          const field=Object.keys(aliases).find(k=>!used.has(k)&&aliases[k].includes(text));
          if(field){found.push({field,x:group[0].x,right:group.at(-1).x+group.at(-1).w});used.add(field);w+=n-1;break;}
        }
      }
      if(used.has('name')&&used.has('quantity')&&used.has('acquisition_price')){columns=found.sort((a,b)=>a.x-b.x);header=i;break;}
    }
    if(header<0)return {rows:[],issues:['列見出しを特定できませんでした。読取文字を確認し、下の表へ必要項目を入力してください。']};
    const rows=[],issues=[];
    for(const line of lines.slice(header+1)){
      const cells={};for(const word of line.words){
        const center=word.x+word.w/2;
        let index=columns.findIndex((c,i)=>i===columns.length-1||center<(c.right+columns[i+1].x)/2);
        const field=columns[Math.max(0,index)].field;(cells[field]??=[]).push(word.text);
      }
      const row=Object.fromEntries(Object.entries(cells).map(([k,v])=>[k,v.join(k==='name'?' ':'')]));
      if(!row.name||!row.quantity||!row.acquisition_price){issues.push('読み切れない行があります：'+line.words.map(w=>w.text).join(' ').slice(0,100));continue;}
      rows.push({...row,kind,currency,price_basis});
    }
    return {rows,issues};
  }
  return {clean,decimal,exactUnit,normalize,key,equal,deduplicate,compare,wordsToLines,suggestRows,scopes,courses};
});
