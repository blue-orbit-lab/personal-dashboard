(function(root,factory){const api=factory(typeof module==='object'?require('./screenshot-core.js'):root.ScreenshotCore);if(typeof module==='object')module.exports=api;else root.ScreenshotLayouts=api})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const text=v=>C.clean(v).replace(/\s/g,'');
  const labels={name:['銘柄名','銘柄','ファンド名','運用商品名'],quantity:['保有数量','保有株数','保有口数','保有□数','保有数(口)','保有数','残高数量'],acquisition_price:['平均取得単価','取得単価','平均取得価額'],cost_total:['取得金額','購入金額'],statement_value:['時価評価額','概算評価額','資産残高','評価額'],current:['現在値','基準価額','時価単価'],course:['分配金の取扱い','分配金の','分配金'],type:['種別','商品タイプ'],account:['口座区分','口座'],profit:['外貨建評価損益','評価損益','損益']};
  const names={green_us:'米国株・上下2段の一覧',stacked:'国内株・投信・枠別の一覧',pension:'iDeCo・企業型DC',rakuten:'保有商品詳細・外貨預り金',fund_courses:'投信・受取/再投資コース別'};
  function scan(lines,aliases){
    const hits=[];
    for(const line of lines)for(let i=0;i<line.words.length;i++)for(let n=Math.min(14,line.words.length-i);n>=1;n--){
      const words=line.words.slice(i,i+n),s=text(words.map(w=>w.text).join(''));
      if(aliases.includes(s)){hits.push({x:words[0].x,right:words.at(-1).x+words.at(-1).w,y:line.y,h:line.h,words});break}
    }
    return hits;
  }
  function number(raw){
    const s=text(raw).replace(/(?:株|口|USD|USドル|米ドル|円)$/,'');
    try{return C.decimal(s)}catch{return null}
  }
  function detect(s){
    if(s.includes('拠出金累計')&&s.includes('残高数量'))return 'pension';
    if(s.includes('外貨建評価損益')&&s.includes('米国株式'))return 'green_us';
    if(s.includes('平均取得価額')&&s.includes('時価評価額')&&s.includes('保有商品'))return 'rakuten';
    if(s.includes('平均取得単価')&&s.includes('概算評価額')&&s.includes('再投資'))return 'fund_courses';
    if(s.includes('取得金額')&&(s.includes('ファンド名')||s.includes('株式(特定預り)')))return 'stacked';
    return null;
  }
  function account(s,fallback){
    if(/iDeCo|企業型|拠出金累計/.test(s))return 'iDeCo・企業型DC';
    if(s.includes('NISA'))return 'NISA';
    if(/特定/.test(s))return '特定口座';
    if(/一般/.test(s))return '一般口座';
    return fallback||null;
  }
  function scope(s){
    if(/旧つみたてNISA|旧NISA.*つみたて/.test(s))return 'legacy_accumulation';
    if(/旧一般NISA|旧NISA/.test(s))return 'legacy_nisa';
    if(/つみたて投資枠|NISAつみたて枠/.test(s))return 'nisa_accumulation';
    if(/成長投資枠|NISA成長枠/.test(s))return 'nisa_growth';
    return 'account_total';
  }
  function parse(words,settings={}){
    if(!Array.isArray(words)||words.length>50000)return {rows:[],issues:['読取結果が多すぎます。画像の範囲を分けてください。'],cash:[],format:null};
    const valid=words.filter(w=>typeof w.text==='string'&&[w.x,w.y,w.w,w.h].every(Number.isFinite)&&w.w>=0&&w.h>0);
    const heights=valid.map(w=>w.h).sort((a,b)=>a-b),scale=12/(heights[Math.floor(heights.length/2)]||12);
    const safe=valid.map(w=>({...w,x:w.x*scale,y:w.y*scale,w:w.w*scale,h:w.h*scale}));
    const lines=C.wordsToLines(safe),all=lines.map(l=>text(l.words.map(w=>w.text).join(''))).join('');
    const format=detect(all);if(!format)return {...C.suggestRows(safe,settings),format:null,cash:[]};
    const headers=scan(lines,labels.quantity),rows=[],issues=[],cash=[];
    if(!headers.length)return {rows,issues:['数量の列を特定できませんでした。見出しを含めて確認してください。'],cash,format};
    for(let hi=0;hi<headers.length;hi++){
      const qh=headers[hi],nextHeader=headers[hi+1]?.y??Infinity;
      const band=lines.filter(l=>l.y>=qh.y-28&&l.y<=qh.y+32);
      const anchors={quantity:qh};
      for(const [field,aliases] of Object.entries(labels))if(field!=='quantity'){
        const found=scan(band,aliases).sort((a,b)=>Math.abs(a.y-qh.y)-Math.abs(b.y-qh.y));if(found.length)anchors[field]=found[0];
      }
      if(format!=='green_us'&&!anchors.name||format!=='pension'&&!anchors.acquisition_price){issues.push('銘柄名または取得単価の見出しが不鮮明です。この表は自動入力しません。');continue}
      if(format==='stacked'&&anchors.cost_total)delete anchors.statement_value;
      const columns=Object.entries(anchors).map(([field,a])=>({field,...a})).sort((a,b)=>a.x-b.x);
      // Ignore duplicate aliases inside the same physical column (e.g. a two-line header).
      const unique=columns.filter((c,i)=>!columns.slice(0,i).some(p=>Math.abs((p.x+p.right-c.x-c.right)/2)<18));
      const bounds={};unique.forEach((c,i)=>bounds[c.field]={left:i?(unique[i-1].right+c.x)/2:-Infinity,right:i<unique.length-1?(c.right+unique[i+1].x)/2:Infinity});
      if(!bounds.quantity||format!=='green_us'&&!bounds.name){issues.push('列の重なりを判定できません。この表は手入力で確認してください。');continue}
      const headerEnd=Math.max(...Object.values(anchors).map(a=>a.y+a.h));
      const region=lines.filter(l=>l.y>headerEnd+1&&l.y<nextHeader-28);
      const cell=(line,field)=>{const b=bounds[field];return b?line.words.filter(w=>w.x+w.w/2>=b.left&&w.x+w.w/2<b.right):[]};
      const valueAt=(line,field)=>cell(line,field).map(w=>w.text).join('');
      const candidates=[];
      // Group each column independently: text in adjacent cells can have a different baseline.
      const quantityLines=C.wordsToLines(region.flatMap(l=>cell(l,'quantity')));
      for(const line of quantityLines){const raw=line.words.map(w=>w.text).join('');if(!raw||format==='green_us'&&/[A-Z]/i.test(raw))continue;const n=number(raw.replace(/□$/,'口'));if(n!==null)candidates.push({line,n});else if(/\d/.test(raw)&&!/[合計預り枠価額数量]/.test(raw)){issues.push('数量を読み切れない行があります。数字は補正せず空欄にしています。');candidates.push({line,n:null})}}
      const priorHeading=lines.filter(l=>l.y<qh.y&&l.y>Math.max(qh.y-100,headers[hi-1]?.y??-Infinity)).map(l=>text(l.words.map(w=>w.text).join('')));
      const section=['fund_courses','rakuten'].includes(format)?'':priorHeading.filter(s=>/米国株式|投資信託|株式\(|\(金額/.test(s)).slice(-3).join('');
      const sectionAccount=format==='pension'?'iDeCo・企業型DC':account(section,settings.account_type);
      for(let i=0;i<candidates.length;i++){
        const {line,n}=candidates[i],previous=candidates[i-1]?.line,next=candidates[i+1]?.line;
        const half=Math.min(60,Math.max(18,previous?(line.y-previous.y)/2:next?(next.y-line.y)/2:35));
        const start=format==='green_us'?(previous?previous.y+previous.h:headerEnd):previous?(previous.y+line.y)/2:headerEnd;
        const note=region.find(l=>l.y>line.y&&/^[※*]/.test(text(l.words.map(w=>w.text).join(''))));
        const end=format==='green_us'?line.y+line.h:next?(line.y+next.y)/2:format==='pension'?Math.min(note?.y??Infinity,line.y+120):line.y+half;
        const rowWords=safe.filter(w=>w.y>headerEnd+1&&w.y+w.h/2>=start&&w.y+w.h/2<end);
        const rowLines=C.wordsToLines(rowWords);
        const strings=field=>C.wordsToLines(rowWords.filter(w=>{
          const b=bounds[field];if(!b||w.x+w.w/2<b.left||w.x+w.w/2>=b.right)return false;
          return format!=='green_us'||Math.abs(w.y+w.h/2-line.y-line.h/2)<Math.max(w.h,line.h)*0.65;
        })).map(l=>l.words.map(w=>w.text).join('')).filter(Boolean);
        const numbers=field=>strings(field).map(raw=>{
          const plain=text(raw).replace(/^[|\]]+|[|\]]+$/g,'');
          if(plain!==text(raw))issues.push('数値の端に罫線らしい記号を認識しました。数字は変更していませんが元の表示との照合が必要です。');
          return number(plain);
        }).filter(v=>v!==null);
        const nameWords=rowWords.filter(w=>format==='green_us'?w.y+w.h/2<line.y&&w.x<(anchors.profit?.x??Infinity):format==='rakuten'?w.x+w.w/2<(anchors.account?.x??anchors.quantity.x):format==='pension'?w.x>(anchors.type?.right??0)&&w.x+w.w/2<anchors.current.x:cell({words:[w]},'name').length);
        const nameParts=C.wordsToLines(nameWords).map(l=>l.words.map(w=>w.text).join(''));
        let name=nameParts.join('').replace(/現買|現売|積立|買付|売却|メール/g,'');
        if(!name){issues.push('銘柄名を読み取れない数量があります。確認してください。');continue}
        const rowText=rowLines.map(l=>text(l.words.map(w=>w.text).join(''))).join('');
        if(format==='rakuten'&&/外貨預り金/.test(rowText)){
          if(/USD|USドル|米ドル/.test(rowText))cash.push({currency:'USD',amount:n,kind:'cash_balance',confirmed:false});
          issues.push('外貨預り金は保有銘柄へ加算しません。預り金合計との内訳を確認してください。');continue;
        }
        const kind=format==='green_us'||format==='rakuten'?'stock':format==='pension'||format==='fund_courses'||/投資信託|ファンド名/.test(section+band.map(l=>text(l.words.map(w=>w.text).join(''))).join(''))?'fund':'stock';
        let ticker='';
        if(kind==='stock'){
          const tickerText=nameWords.slice().sort((a,b)=>a.y-b.y||a.x-b.x).map(w=>w.text).join(' ');
          const match=tickerText.match(format==='stacked'?/(?:^|[^A-Z0-9])(\d{3}[A-Z0-9])(?=$|[^A-Z0-9])/ : /(?:^|\s)([A-Z][A-Z0-9.]{0,9})(?=[^A-Z0-9.]|$)/);
          ticker=match?.[1]||'';if(ticker){name=name.replace(ticker,'').trim()||ticker;if(format==='rakuten')name=name.replace(/^米国株式/,'')}
          if(!ticker){issues.push('株式コードを確定できない行があります。自動入力を保留しました。');continue}
        }
        const prices=numbers('acquisition_price'),costs=numbers('cost_total'),values=numbers('statement_value');
        if(format!=='pension'&&(prices.length!==(format==='stacked'?2:1))){issues.push(name+'：取得単価と現在値を分離できません。自動入力を保留しました。');continue}
        const currency=format==='green_us'||format==='rakuten'?'USD':'JPY';
        let cost_total=costs[0]??null,statement_value=values[0]??null;
        if(format==='stacked'){if(costs.length===2){cost_total=costs[0];statement_value=costs[1]}else{cost_total=null;statement_value=null;issues.push(name+'：取得金額と評価額は画像から確認してください。')}}
        const courseText=strings('course').join('');
        let distribution_course='total';
        if(format==='fund_courses'){
          if(/再投資/.test(courseText))distribution_course='reinvest';else if(/受取/.test(courseText))distribution_course='receive';else{issues.push(name+'：受取・再投資のコースを判定できません。自動入力を保留しました。');continue}
        }
        const rowAccount=account(strings('account').join(''),sectionAccount),holding_scope=rowAccount==='NISA'?scope(section+strings('account').join('')):'account_total';
        if(rowAccount==='NISA'&&holding_scope==='account_total')issues.push(name+'：NISAの対象枠が画像で特定できません。枠を指定するか全枠合計か確認してください。');
        if(rowLines.some(l=>l.words.some(w=>typeof w.confidence==='number'&&w.confidence<0.85)))issues.push(name+'：認識が不確かな文字があります。数値と名称を確認してください。');
        rows.push({name,ticker,kind,currency,quantity:n,acquisition_price:format==='pension'?null:prices[0],price_basis:kind==='fund'?10000:1,cost_total,statement_value,cost_currency:currency,statement_currency:format==='rakuten'?'JPY':currency,holding_scope,distribution_course,account_type:rowAccount,source_layout:format});
      }
    }
    if(format==='pension')issues.push('拠出金累計と商品の購入金額は別です。取得単価を逆算せず、未表示なら不明として残します。');
    if(format==='rakuten')issues.push('保有商品評価額・預り金・資産合計を重ねて足しません。外貨残高が預り金合計に含まれるか確認します。');
    return {format,formatName:names[format],rows,cash,issues:[...new Set(issues)]};
  }
  return {parse,detect,number};
});
