/* original script block 1 */
const APP_BRAND=Object.freeze({ko:'그루',en:'grew',motto:'내 취향대로 자라는 숲'});
document.title=APP_BRAND.ko+' — '+APP_BRAND.motto;

/* original script block 2 */
window.initRatingPicker=function(){
 const wrap=document.querySelector('[data-rating-picker]');
 const input=document.getElementById('ratingValue');
 const label=document.getElementById('ratingText');
 if(!wrap||!input)return;
 wrap.tabIndex=0;wrap.setAttribute('role','slider');wrap.setAttribute('aria-label','별점');wrap.setAttribute('aria-valuemin','0');wrap.setAttribute('aria-valuemax','5');
 const draw=(v)=>{
   v=Number(v)||0;wrap.setAttribute('aria-valuenow',String(v));wrap.setAttribute('aria-valuetext',v?v+'점':'별점 없음'); wrap.innerHTML='';
   for(let i=1;i<=5;i++){
     const s=document.createElement('span');
     s.className='star';
     const f=document.createElement('span'); f.className='fill';
     f.style.width=v>=i?'100%':(v>=i-.5?'50%':'0');
     s.appendChild(f);
     s.onpointerdown=(e)=>{
       const r=s.getBoundingClientRect();
       const half=e.clientX-r.left<r.width/2;
       const nv=(i-.5)+(half?0:0.5);
       input.value=nv;
       label.textContent=nv.toFixed(1);
       draw(nv);
     };
     wrap.appendChild(s);
   }
 };
 wrap.onkeydown=e=>{if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const step=['ArrowRight','ArrowUp'].includes(e.key)?.5:-.5;const v=e.key==='Home'?0:e.key==='End'?5:Math.max(0,Math.min(5,(Number(input.value)||0)+step));input.value=v||'';if(label)label.textContent=v?v.toFixed(1):'선택 안 함';draw(v)};
 draw(input.value);
};
