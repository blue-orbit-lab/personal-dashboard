(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CashCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // Cash observations are absolute balances. They never create income or trades.
  function amount(value){
    if(typeof value!=='string')throw Error('残高を文字列で入力してください');
    const s=value.normalize('NFKC').trim();
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,10})?$/.test(s))throw Error('残高の桁・区切りを確認してください');
    const [integer,fraction='']=s.replace(/,/g,'').split('.');
    if(integer.length>18)throw Error('残高が大きすぎます');
    const i=integer.replace(/^0+(?=\d)/,''),f=fraction.replace(/0+$/,'');return i+(f?'.'+f:'');
  }
  function observation({mode,jpy,usd,asOf,confirmed,transferChecked}){
    if(!['native','aggregate_jpy'].includes(mode))throw Error('残高の表示方法を選んでください');
    if(!confirmed)throw Error('対象口座の預り金全体・通貨・包含関係を確認してください');
    if(!transferChecked)throw Error('振替・両替・受渡前の金額を確認してください');
    if(typeof asOf!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>Date.now()+300000)throw Error('残高の確認日時を確認してください');
    const rows=[];
    if(jpy!==''&&jpy!=null)rows.push({currency:'JPY',balance:amount(jpy)});
    if(usd!==''&&usd!=null){if(mode==='aggregate_jpy')throw Error('円換算合計にドル残高を重ねて登録できません');rows.push({currency:'USD',balance:amount(usd)});}
    if(!rows.length||mode==='aggregate_jpy'&&(rows.length!==1||rows[0].currency!=='JPY'))throw Error('確認した残高を入力してください。残高ゼロは0と入力します');
    return {mode,asOf:new Date(asOf).toISOString(),rows};
  }
  function mergeBalances(legacy,scopes){
    const covered=new Set(),out=[];
    for(const scope of scopes){
      if(!Array.isArray(scope.account_ids)||!scope.account_ids.length||!Array.isArray(scope.balances)||!scope.balances.length)throw Error('預り金の保存内容を再確認してください');
      for(const id of scope.account_ids){if(covered.has(id))throw Error('同じ口座の預り金が重複しています');covered.add(id);}
      const currencies=new Set();
      if(!['native','aggregate_jpy'].includes(scope.mode)||!Number.isFinite(Date.parse(scope.as_of)))throw Error('預り金の表示方法・日時が不明です');
      for(const row of scope.balances){
        if(!['JPY','USD'].includes(row.currency)||currencies.has(row.currency)||scope.mode==='aggregate_jpy'&&(row.currency!=='JPY'||scope.balances.length!==1))throw Error('預り金の通貨・合計と内訳が重複しています');
        currencies.add(row.currency);const exact=amount(row.balance);
        out.push({id:scope.id+':'+row.currency,scopeId:scope.id,name:scope.name,accountIds:scope.account_ids,type:scope.mode==='aggregate_jpy'?'預り金・円換算合計（内訳は加算しません）':'預り金・'+row.currency,balance:Number(exact),balanceExact:exact,currency:row.currency,date:scope.as_of,issue:Date.parse(scope.as_of)>Date.now()+300000?'残高の確認日時を確認':null});
      }
    }
    return [...legacy.filter(row=>!covered.has(row.accountId)),...out];
  }
  return {amount,observation,mergeBalances};
});
