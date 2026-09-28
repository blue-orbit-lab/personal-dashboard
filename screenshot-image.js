(function(root){
  'use strict';
  root.ScreenshotImage={prepare};
  async function prepare(file,{enhance=false,signal}={}){
    if(!enhance)return file;
    let bitmap=null,canvas=null;
    try{
      signal?.throwIfAborted();bitmap=await createImageBitmap(file);signal?.throwIfAborted();
      if(bitmap.width*bitmap.height>25000000)throw Error('画像が大きすぎます。保有一覧の範囲に分けてください。');
      const scale=Math.min(2,Math.sqrt(5000000/(bitmap.width*bitmap.height)));
      if(scale<=1)return file;
      canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();bitmap=null;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));signal?.throwIfAborted();
      if(!blob||blob.size>8*1024*1024)throw Error('拡大した画像が大きすぎます。拡大を外すか画像を分けてください。');
      return blob;
    }finally{bitmap?.close();if(canvas){canvas.width=0;canvas.height=0}bitmap=null;canvas=null}
  }
})(typeof globalThis!=='undefined'?globalThis:this);
