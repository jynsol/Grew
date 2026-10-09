/* original script block 18 */
let forestViewportYear=null,forestViewportFrame=null;
function forestCameraFrame(vp,world,bounds=world.getBBox()){
 const unit=Math.min(vp.clientWidth/720,vp.clientHeight/540)||1;
 // Floating controls cover part of a full-bleed board: fit the plot into what is left and
 // shift its centre by half the difference.
 const tools=vp.closest('.forest-board')?.querySelector('.forest-tools-row'),vr=vp.getBoundingClientRect();
 const insetTop=tools?18:0,insetBottom=tools?Math.max(0,vr.bottom-tools.getBoundingClientRect().top+10):0,shiftY=(insetTop-insetBottom)/2/unit;
 const padding=14,visibleW=vp.clientWidth/unit,visibleH=vp.clientHeight/unit;
 const fit=Math.min((vp.clientWidth-padding*2)/(Math.max(1,bounds.width)*unit),(vp.clientHeight-insetTop-insetBottom-padding*2)/(Math.max(1,bounds.height)*unit));
 return {bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},unit,visibleW,visibleH,padding:padding/unit,fit,min:fit*.4,max:fit*2.4,cx:bounds.x+bounds.width/2,cy:bounds.y+bounds.height/2,tier:forestBoardConfig(forestBoardCount(vp),vp.querySelector('svg[data-grid]')?.dataset.grid).tier+(vp.querySelector('svg[data-grid]')?'m':''),shiftY};
}
// The board on screen may be one month, not the whole year: size everything from what was drawn.
function forestBoardCount(vp){const n=vp?.querySelector('svg[data-count]')?.dataset.count;return n!=null?+n:forestItems(state,year).length;
}
function forestFittedState(frame){return {scale:frame.fit,x:(360-frame.cx)*frame.fit,y:(270-frame.cy)*frame.fit+(frame.shiftY||0)}}
function initializeForestViewport(frame){
 const previous=forestViewportFrame;
 if(forestViewportYear!==year+'|'+month||!previous||previous.tier!==frame.tier||zoomState.scale<=previous.fit*1.03){zoomState=forestFittedState(frame)}
 else{
  const scale=Math.max(frame.min,Math.min(frame.max,zoomState.scale/previous.fit*frame.fit)),ratio=scale/zoomState.scale;
  zoomState={scale,x:zoomState.x*ratio,y:zoomState.y*ratio};
 }
 forestViewportYear=year+'|'+month;forestViewportFrame=frame;
}

function setupForest(){
 const vp=$('forestViewport'),world=vp?.querySelector('#forest-world');if(!vp||!world)return;
 const pointers=new Map();let prev=null,suppressClick=false,sel=null;


 const SVG_NS='http://www.w3.org/2000/svg',TYPE_LABEL={book:'책',album:'음반',movie:'영화'},TAP_RADIUS=24;
 const tip=document.createElement('button');tip.type='button';tip.className='forest-tree-tooltip';tip.setAttribute('aria-hidden','true');tip.tabIndex=-1;vp.appendChild(tip);

 /* 선택/호버된 나무 발밑 링 — SVG 요소라 iOS Safari에서도 확실히 그려진다(CSS filter 글로우는 SVG 자식에 안 먹는 경우가 있음). */
 const setFocusRing=(g,mode)=>{
  vp.querySelectorAll('.tree-ring').forEach(r=>r.remove());
  vp.querySelectorAll('.is-focus').forEach(x=>x.classList.remove('is-focus'));
  if(!g)return;
  // Selection is a soft warm glow on the ground under the tree, not an outlined ring.
  const svg=vp.querySelector('svg');
  if(svg&&!svg.querySelector('#treeSelectGlow'))(svg.querySelector('defs')||svg.insertBefore(document.createElementNS(SVG_NS,'defs'),svg.firstChild)).insertAdjacentHTML('beforeend','<radialGradient id="treeSelectGlow"><stop offset="0" stop-color="#FFF6CF" stop-opacity=".95"/><stop offset=".5" stop-color="#FFF6CF" stop-opacity=".55"/><stop offset="1" stop-color="#FFF6CF" stop-opacity="0"/></radialGradient>');
  const shadow=g.querySelector('ellipse'),rx=(parseFloat(shadow?.getAttribute('rx'))||22)*2.1+6;
  const ring=document.createElementNS(SVG_NS,'ellipse');
  ring.setAttribute('class','tree-ring '+mode);
  ring.setAttribute('cx',shadow?.getAttribute('cx')||'0');ring.setAttribute('cy',shadow?.getAttribute('cy')||'10');
  ring.setAttribute('rx',rx.toFixed(1));ring.setAttribute('ry',(rx*.46).toFixed(1));
  ring.setAttribute('fill','url(#treeSelectGlow)');
  if(shadow)shadow.after(ring);else g.prepend(ring);
  g.classList.add('is-focus');
 };
 const hideTip=()=>{
  if(!sel&&!tip.classList.contains('show'))return;
  sel=null;tip.classList.remove('show','pinned');tip.setAttribute('aria-hidden','true');tip.tabIndex=-1;
  tip.removeAttribute('data-action');tip.removeAttribute('data-id');tip.removeAttribute('aria-label');
  vp.classList.remove('has-pin');setFocusRing(null);
 };
 /* 카드는 마우스 커서가 아니라 '나무'에 붙는다: 머리 위 중앙, 공간이 없으면 발밑으로 뒤집히고, 화살표가 나무를 가리킨다. */
 const placeTip=g=>{
  const vr=vp.getBoundingClientRect(),gr=g.getBoundingClientRect(),pad=8,gap=10;
  tip.style.left='0px';tip.style.top='0px';
  const tw=tip.offsetWidth,th=tip.offsetHeight,cx=gr.left+gr.width/2-vr.left;
  const x=Math.min(Math.max(cx-tw/2,pad),Math.max(pad,vr.width-tw-pad));
  let y=gr.top-vr.top-th-gap,below=false;
  if(y<pad){below=true;y=gr.bottom-vr.top+gap}
  if(y+th>vr.height-pad)y=Math.max(pad,vr.height-th-pad);
  tip.style.left=x.toFixed(1)+'px';tip.style.top=y.toFixed(1)+'px';
  tip.style.setProperty('--ax',Math.min(Math.max(cx-x,18),Math.max(18,tw-18)).toFixed(1)+'px');
  tip.classList.toggle('below',below);
 };
 const showTip=(g,mode)=>{
  const id=g.getAttribute('data-tree')||'',c=id?get(id):null;if(!c){hideTip();return}
  const pin=mode==='pin',genre=String(c.genre||'').trim()||'미분류';
  tip.innerHTML='<span class="ftt-body"><strong>'+esc(c.title)+'</strong><small><i class="ftt-type" data-type="'+esc(c.type)+'">'+(TYPE_LABEL[c.type]||'콘텐츠')+'</i><span>'+esc(genre)+'</span></small></span>'+(pin?'<span class="ftt-go" aria-hidden="true">›</span>':'');
  tip.classList.toggle('pinned',pin);
  if(pin){tip.removeAttribute('aria-hidden');tip.tabIndex=0;tip.dataset.action='detail';tip.dataset.id=id;tip.setAttribute('aria-label',c.title+' 상세 보기')}
  else{tip.setAttribute('aria-hidden','true');tip.tabIndex=-1;tip.removeAttribute('data-action');tip.removeAttribute('data-id');tip.removeAttribute('aria-label')}
  vp.classList.toggle('has-pin',pin);
  setFocusRing(g,mode);placeTip(g);
  tip.classList.add('show');sel={g,mode};
 };

 /* 터치는 손가락이 굵고 나무는 작다 → 나무 히트영역이 화면상 반지름 24px(지름 48px)보다 작으면 그만큼 넓혀서 가장 가까운 나무를 잡는다. */
 const nearestTree=(x,y,minR)=>{
  let best=null,bestScore=1;
  vp.querySelectorAll('[data-tree]').forEach(g=>{
   const h=g.querySelector('.tree-hit');if(!h)return;
   const r=h.getBoundingClientRect(),eff=Math.max(Math.max(r.width,r.height)/2,minR),score=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2))/eff;
   if(score<bestScore){bestScore=score;best=g}
  });
  return best;
 };
 const pickTree=e=>{
  const hit=e.target.closest?.('[data-tree]');
  if(hit&&!e.target.classList?.contains('tree-hit'))return hit;
  return nearestTree(e.clientX,e.clientY,e.pointerType==='mouse'?0:TAP_RADIUS)||hit||null;
 };

 vp.addEventListener('pointerleave',()=>{if(sel?.mode==='hover')hideTip()});
 vp.addEventListener('focusin',e=>{const g=e.target.closest?.('[data-tree]');if(g&&pointers.size===0&&g.matches(':focus-visible'))showTip(g,'pin')});
 vp.addEventListener('focusout',e=>{if(sel?.mode!=='pin'&&e.target.closest?.('[data-tree]')&&!tip.contains(e.relatedTarget))hideTip()});
 let camera=forestCameraFrame(vp,world),zoomFrame=0,zoomTarget,lastZoomFrame=0;
 initializeForestViewport(camera);
 zoomTarget={...zoomState};
 const clampCamera=s=>{
  s.scale=Math.max(camera.min,Math.min(camera.max,s.scale));
  const homeX=(360-camera.cx)*s.scale,homeY=(270-camera.cy)*s.scale+(camera.shiftY||0);
  const maxX=Math.max(0,(camera.bounds.width*s.scale-camera.visibleW+camera.padding*2)/2);
  const maxY=Math.max(0,(camera.bounds.height*s.scale-camera.visibleH+camera.padding*2)/2);
  s.x=Math.max(homeX-maxX,Math.min(homeX+maxX,s.x));
  s.y=Math.max(homeY-maxY,Math.min(homeY+maxY,s.y));
  return s;
 };
 const apply=()=>{
  clampCamera(zoomState);
  world.setAttribute('transform','translate('+(360*(1-zoomState.scale)+zoomState.x)+' '+(270*(1-zoomState.scale)+zoomState.y)+') scale('+zoomState.scale+')');
 };
 const stopZoom=()=>{cancelAnimationFrame(zoomFrame);zoomFrame=0;lastZoomFrame=0;zoomTarget={...zoomState}};
 const animateZoom=timestamp=>{
  if(!vp.isConnected){stopZoom();return}
  const elapsed=lastZoomFrame?Math.min(40,timestamp-lastZoomFrame):16;lastZoomFrame=timestamp;
  const ease=1-Math.exp(-elapsed/65);
  for(const key of ['scale','x','y'])zoomState[key]+=(zoomTarget[key]-zoomState[key])*ease;
  apply();
  if(Math.abs(zoomTarget.scale-zoomState.scale)<.0002&&Math.abs(zoomTarget.x-zoomState.x)<.05&&Math.abs(zoomTarget.y-zoomState.y)<.05){zoomState={...zoomTarget};apply();zoomFrame=0;lastZoomFrame=0}
  else zoomFrame=requestAnimationFrame(animateZoom);
 };
 const smoothTo=next=>{
  zoomTarget=clampCamera({...next});
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){stopZoom();zoomState={...next};apply();zoomTarget={...zoomState};return}
  if(!zoomFrame)zoomFrame=requestAnimationFrame(animateZoom);
 };
 const zoomAt=(scale,point={x:360,y:270})=>{
  const next=Math.max(camera.min,Math.min(camera.max,scale)),ratio=next/zoomTarget.scale;
  smoothTo({scale:next,x:point.x-360-(point.x-360-zoomTarget.x)*ratio,y:point.y-270-(point.y-270-zoomTarget.y)*ratio});
 };
 const fitForest=()=>{hideTip();smoothTo(forestFittedState(camera))};
 const svgPoint=(x,y)=>new DOMPoint(x,y).matrixTransform(vp.querySelector('svg').getScreenCTM().inverse());
 window.applyForest=()=>{stopZoom();apply();zoomTarget={...zoomState}};
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{
  if(!vp.isConnected)return;
  const next=forestCameraFrame(vp,world,camera.bounds);
  if(Math.abs(next.visibleW-camera.visibleW)<.01&&Math.abs(next.visibleH-camera.visibleH)<.01&&Math.abs(next.unit-camera.unit)<.00001)return;
  hideTip();stopZoom();const prior=camera;camera=next;
  if(zoomState.scale<=prior.fit*1.03)zoomState=forestFittedState(camera);
  else{const scale=zoomState.scale/prior.fit*camera.fit,ratio=scale/zoomState.scale;zoomState={scale,x:zoomState.x*ratio,y:zoomState.y*ratio}}
  forestViewportFrame=camera;apply();zoomTarget={...zoomState};
 }):null;
 observer?.observe(vp);
 window.__songrimForestCleanup=()=>{stopZoom();observer?.disconnect();clearTimeout(window.__songrimVisitorTimer);window.__songrimVisitorTimer=null};

 vp.addEventListener('pointerdown',e=>{
  if(tip.contains(e.target))return;
  stopZoom();
  const direct=e.target.closest?.('[data-tree]');
  if(direct&&!forestEditMode&&e.pointerType==='mouse'){e.preventDefault(); try{direct.blur?.()}catch{}}
  if(pointers.size>=1){hideTip();pointers.forEach(p=>p.moved=true)}
  const tree=pickTree(e);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:pointers.size>0,tree,treeId:tree?.getAttribute('data-tree')||''});
  if(e.pointerType!=='mouse'){try{vp.setPointerCapture(e.pointerId)}catch{}}
  const pts=[...pointers.values()];prev=pts.length>=2?{d:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2}:null;
 });
 vp.addEventListener('pointermove' ,e=>{
  if(e.pointerType==='mouse'&&pointers.size===0){
   if(!sel||sel.mode==='hover'){const t=e.target.closest?.('[data-tree]');if(t){if(!sel||sel.g!==t)showTip(t,'hover')}else hideTip()}
   return;
  }
  if(!pointers.has(e.pointerId))return;
  const before=pointers.get(e.pointerId),moved=before.moved||Math.hypot(e.clientX-before.startX,e.clientY-before.startY)>(e.pointerType==='mouse'?7:10);
  if(moved&&!before.moved){hideTip();if(e.pointerType==='mouse'){try{vp.setPointerCapture(e.pointerId)}catch{}}}
  pointers.set(e.pointerId,{...before,x:e.clientX,y:e.clientY,moved});
  const pts=[...pointers.values()];
  if(pts.length>=2){
   hideTip();pointers.forEach(p=>p.moved=true);
   const mid={d:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
   if(prev&&prev.d>0){
    const svg=vp.querySelector('svg'),m=svg.getScreenCTM().inverse();
    const old=new DOMPoint(prev.x,prev.y).matrixTransform(m),cur=new DOMPoint(mid.x,mid.y).matrixTransform(m);
    const scale=Math.max(camera.min,Math.min(camera.max,zoomState.scale*mid.d/prev.d)),ratio=scale/zoomState.scale;
    zoomState.x=cur.x-360-(old.x-360-zoomState.x)*ratio;
    zoomState.y=cur.y-270-(old.y-270-zoomState.y)*ratio;
    zoomState.scale=scale;
   }prev=mid;
  }
  else if(moved){
   if(zoomState.scale>camera.fit*1.03||e.pointerType==='mouse'){zoomState.x+=(e.clientX-before.x)/camera.unit;zoomState.y+=(e.clientY-before.y)/camera.unit}
   else if(e.pointerType!=='mouse')window.scrollBy(0,before.y-e.clientY);
  }
  apply();zoomTarget={...zoomState};
 });
 const up=e=>{
  const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);prev=null;
  if(!p||p.moved||pointers.size>0)return;
  // A touch tap is followed by a synthetic click at the same spot. Opening a sheet or page on
  // pointerup let that click land on whatever just appeared (the sheet backdrop or a tree card),
  // so the action runs once the click has been swallowed (or shortly after, if none comes).
  if(!forestEditMode&&p.treeId&&forestGrowthKey(get(p.treeId))){hideTip();deferTap(()=>openDetail(p.treeId));return}
  if(forestEditMode){if(p.treeId){hideTip();deferTap(()=>openTreePicker(p.treeId))}return}
  if(!p.tree){hideTip();return}
  if(sel?.mode==='pin'&&sel.g===p.tree)hideTip();else showTip(p.tree,'pin');
 };
 vp.addEventListener('pointerup',up);vp.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);prev=null});
 vp.addEventListener('wheel',e=>{
  e.preventDefault();if(!e.deltaY)return;hideTip();
  const unit=e.deltaMode===1?16:e.deltaMode===2?vp.clientHeight:1;
  const delta=Math.max(-64,Math.min(64,e.deltaY*unit));
  zoomAt(zoomTarget.scale*Math.exp(-delta*.001),svgPoint(e.clientX,e.clientY));
 },{passive:false});
 let pendingTap=null,pendingTapTimer=0;
 const runPendingTap=()=>{clearTimeout(pendingTapTimer);const run=pendingTap;pendingTap=null;suppressClick=false;run?.()};
 const deferTap=fn=>{suppressClick=true;pendingTap=fn;clearTimeout(pendingTapTimer);pendingTapTimer=setTimeout(runPendingTap,350)};
 vp.addEventListener('click',e=>{if(suppressClick||(!forestEditMode&&e.target.closest?.('[data-tree]'))){e.preventDefault();e.stopPropagation();if(pendingTap)setTimeout(runPendingTap,0);return}});
 vp.addEventListener('dblclick',e=>{if(e.target.closest?.('[data-tree]')||tip.contains(e.target))return;fitForest()});
 vp.addEventListener('keydown',e=>{
  const tree=e.target.closest?.('[data-tree]');
  if(tree&&['Enter',' '].includes(e.key)){e.preventDefault();if(!forestEditMode&&forestGrowthKey(get(tree.dataset.tree))){hideTip();openDetail(tree.dataset.tree);return}if(forestEditMode)openTreePicker(tree.dataset.tree);else showTip(tree,'pin');return}
  if(e.key==='Escape'&&sel){e.preventDefault();hideTip();vp.focus({preventScroll:true});return}
  if(!['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','0'].includes(e.key))return;e.preventDefault();hideTip();
  if(e.key==='0'){fitForest();return}
  if(['+','=','-'].includes(e.key)){zoomAt(zoomTarget.scale*(e.key==='-'?1/1.12:1.12));return}
  stopZoom();if(e.key==='ArrowLeft')zoomState.x+=25;if(e.key==='ArrowRight')zoomState.x-=25;if(e.key==='ArrowUp')zoomState.y+=25;if(e.key==='ArrowDown')zoomState.y-=25;apply();zoomTarget={...zoomState};
 });
 apply();
 if(pendingForestArrival){const arrived=[...vp.querySelectorAll('[data-tree]')].find(g=>g.dataset.tree===pendingForestArrival);if(arrived){const pos=arrived.transform.baseVal.getItem(0).matrix;zoomState.scale=Math.min(camera.max,Math.max(zoomState.scale,camera.fit*1.15));zoomState.x=(360-pos.e)*zoomState.scale;zoomState.y=(290-pos.f)*zoomState.scale;apply();zoomTarget={...zoomState};showTip(arrived,'pin');arrived.querySelector('.tree-art')?.classList.add('forest-arrival');pendingForestArrival=null}}
 clearTimeout(window.__songrimVisitorTimer);
 const layer=world.querySelector('#forest-visitor-layer'),cfg=forestBoardConfig(forestBoardCount(vp),vp.querySelector('svg[data-grid]')?.dataset.grid);
 let visitorElapsed=0,visitorTickAt=performance.now();
 const syncVisitorVisibility=()=>{layer?.classList.toggle('visitors-paused',document.hidden);visitorTickAt=performance.now()};
 document.addEventListener('visibilitychange',syncVisitorVisibility);syncVisitorVisibility();
 const cleanupForest=window.__songrimForestCleanup;
 window.__songrimForestCleanup=()=>{cleanupForest?.();document.removeEventListener('visibilitychange',syncVisitorVisibility)};
 let visitorRolled=false;
 const spawnVisitor=()=>{
  if(!layer)return;
  const boxes=[...world.querySelectorAll('[data-tree]')].map(g=>{
   const b=treeArtElementBounds(g.querySelector('.tree-art')),m=g.transform.baseVal.consolidate().matrix;
   return {left:m.e+b.x*m.a,right:m.e+(b.x+b.width)*m.a,top:m.f+b.y*m.d,bottom:m.f+(b.y+b.height)*m.d};
  });
  const props=[...world.querySelectorAll('[data-decoration]')].map(g=>{const b=g.getBBox(),m=g.transform.baseVal.consolidate()?.matrix||{a:1,d:1,e:0,f:0};return {left:m.e+b.x*m.a,right:m.e+(b.x+b.width)*m.a,top:m.f+b.y*m.d,bottom:m.f+(b.y+b.height)*m.d}});
  const scale=cfg.treeScale*(cfg.month?.9:1.05),pos=visitorPosition(cfg,boxes,scale,props);
  // No free spot yet: try again on the next tick without using up a visit.
  layer.innerHTML='';if(!pos)return;
  // A visit may come up empty; the chance grows with each visitor milestone.
  visitorRolled=true;visitorElapsed=0;if(Math.random()>=forestVisitorChance())return;
  const chosen=nextForestVisitor();if(!chosen)return;

  // Depth-sort the visitor with the trees: it goes just before the first tree standing in front of it.
  const trees=[...world.querySelectorAll('[data-tree]')],front=trees.find(g=>g.transform.baseVal.consolidate().matrix.f>pos.y);
  if(front)front.parentNode.insertBefore(layer,front);else if(trees.length)trees[trees.length-1].after(layer);
  layer.innerHTML='<g data-visitor="'+chosen.id+'" role="img" aria-label="'+chosen.name+'" transform="translate('+pos.x+' '+pos.y+') scale('+scale+')"><g class="forest-visitor">'+animatedVisitorArt(chosen.id)+'</g></g>';
  visitorElapsed=0;
 };
 const visitTick=()=>{
  if(!vp.isConnected||view!=='forest'||!layer)return;
  const tickAt=performance.now(),elapsed=tickAt-visitorTickAt;visitorTickAt=tickAt;
  if(!document.hidden&&!vp.classList.contains('paused')){
   visitorElapsed+=elapsed;
   const peek=layer.querySelector('.forest-visitor')?.getAnimations().find(a=>a.animationName==='visitorPeek');
   if(layer.firstChild?(peek?peek.playState==='finished':visitorElapsed>=18000):(!visitorRolled||visitorElapsed>=18000))spawnVisitor();
   const v=layer?.querySelector('[data-visitor]');
   if(v&&!collectionState().visitorsSeen.includes(v.dataset.visitor)){
    const b=v.getBoundingClientRect(),r=vp.getBoundingClientRect();
    if(Number(getComputedStyle(v.firstElementChild).opacity)>.5&&b.top>=Math.max(0,r.top)&&b.bottom<=Math.min(innerHeight,r.bottom)&&b.left>=r.left&&b.right<=r.right){collectionState().visitorsSeen.push(v.dataset.visitor);if(persist())announceNewVisitor(v.dataset.visitor)}
   }
  }
  window.__songrimVisitorTimer=setTimeout(visitTick,600);
 };
 spawnVisitor();visitTick();
 if('IntersectionObserver'in window){forestVisibilityObserver=new IntersectionObserver(es=>vp.classList.toggle('paused',!es[0].isIntersecting));forestVisibilityObserver.observe(vp)}
}
function changeMonth(delta){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);const next=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(next<=now().slice(0,7)){month=next;render()}}
function linkAdd(){openLinkImport()}
let photoImportSource=null;
function photoAdd(source=null){photoImportSource=normalizeLinkSources(source?[source]:[])[0]||null;photoFiles=[];candidates=[];showModal('사진에서 가져오기',(photoImportSource?'<p class="link-import-source">이 게시물의 사진을 선택해주세요.<br><a href="'+esc(photoImportSource.url)+'" target="_blank" rel="noopener noreferrer">'+esc(photoImportSource.title||new URL(photoImportSource.url).hostname)+' ↗</a></p>':'')+'<p class="muted">스크린샷·표지·목록 사진을 선택하세요. 여러 영역을 반복 인식해 제목과 제작자를 묶고, 가장 가능성 높은 콘텐츠를 찾아드려요.</p><label for="photoFiles">사진 선택 · 최대 10장</label><input id="photoFiles" type="file" accept="image/*" multiple><div id="photoThumbs" class="thumbs"></div><div id="ocrProgress" class="summary"></div>'+button('사진 분석하기','runOCR','primary','id="ocrButton" disabled')+button('직접 입력하기','manual','textbtn'),'photo')}
function ocrCleanLine(line){return String(line||'').replace(/[|_~`^=*<>\\]/g,' ').replace(/[●■□◆◇▶▷◀◁→←↑↓]/g,' ').replace(/\s+/g,' ').trim()}
const OCR_UI_WORDS=new Set(['서재','기본책장','내책장','내 책장','다운로드','필터','편집','소장','서점','my','검색','메뉴','공유','저장','취소','확인','완료','홈','home','search','share','save','cancel','menu']);
function ocrUsefulLine(line){
 const s=ocrCleanLine(line);if(s.length<1||s.length>200)return false;
 if(!/[A-Za-z가-힣]/.test(s))return false;
 const compact=s.toLowerCase().replace(/\s+/g,'');
 if(OCR_UI_WORDS.has(s.toLowerCase())||OCR_UI_WORDS.has(compact))return false;
 if(/^\d{1,3}(권|개)?$/.test(s)||/^\d{1,2}:\d{2}$/.test(s)||/^\d{1,3}%$/.test(s))return false;
 if(/^(lte|5g|wifi|battery)$/i.test(s))return false;
 if((s.match(/[A-Za-z가-힣]/g)||[]).length<1)return false;
 const letters=(s.match(/[A-Za-z가-힣]/g)||[]).length;
 if(letters/Math.max(1,s.length)<.42)return false;
 return true;
}
function ocrContextType(text){
 const n=String(text||'').toLowerCase();
 if(/서재|책장|도서|읽는 중|읽고 싶|독서|소장/.test(n))return 'book';
 if(/앨범|음악|재생|아티스트|곡/.test(n))return 'album';
 if(/영화|상영|감독|개봉/.test(n))return 'movie';
 return '';
}
function ocrNoiseLine(text){
 const s=ocrCleanLine(text),compact=s.toLowerCase().replace(/\s+/g,'');
 if(!s)return true;
 if(OCR_UI_WORDS.has(s.toLowerCase())||OCR_UI_WORDS.has(compact))return true;
 if(/^[^A-Za-z가-힣]*(?:소장|다운로드|필터|편집|기본책장|내\s*책장|MY)$/i.test(s))return true;
 if(/^[^가-힣]*\d+일\s*남음$/.test(s))return true;
 if(/^([.!·•\s]*)(LTE|5G|WiFi|wifi|battery)(\s*\d+)?$/i.test(s))return true;
 if(/^\d{1,3}(권|개)?$/.test(s)||/^\d{1,2}\s*:\s*\d{2}$/.test(s))return true;
 return false;
}
function ocrEditionGroups(text){
 const s=String(text||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 const groups=[];
 const add=k=>{if(!groups.includes(k))groups.push(k)};
 if(/리커버|re-?cover/.test(s))add('recover');
 if(/개정증보판|증보판/.test(s))add('expanded');
 else if(/개정판|revisededition/.test(s))add('revised');
 if(/특별판|스페셜(?:판|에디션)|specialedition|컬렉터스?에디션|collector'?sedition|기념판|anniversaryedition/.test(s))add('special');
 if(/한정판|limitededition/.test(s))add('limited');
 if(/양장본?|양장판|hardcover/.test(s))add('hardcover');
 if(/보급판/.test(s))add('popular');
 if(/소장판/.test(s))add('collector');
 if(/합본판?|옴니버스판|omnibus/.test(s))add('omnibus');
 if(/완전판|completeedition/.test(s))add('complete');
 if(/복간판|복각판/.test(s))add('reprint');
 if(/리마스터(?:판|에디션)?|remaster(?:ed)?/.test(s))add('remaster');
 if(/디럭스(?:판|에디션)?|deluxeedition/.test(s))add('deluxe');
 if(/큰글자판|큰글씨책|대활자본?|largeprint/.test(s))add('largeprint');
 return groups;
}
function ocrEditionOnlyLine(text){
 const s=ocrCleanLine(text);if(!s)return false;
 const stripped=s.normalize('NFKC').toLowerCase().replace(/[()\[\]{}〈〉《》「」『』·:：,./\s_-]/g,'');
 if(!ocrEditionGroups(s).length)return false;
 return /^(리커버(?:판|에디션)?|개정(?:증보)?판|증보판|특별판|스페셜(?:판|에디션)|한정판|양장(?:본|판)?|보급판|소장판|합본판?|옴니버스판|완전판|기념판|복간판|복각판|리마스터(?:판|에디션)?|디럭스(?:판|에디션)?|큰글자판|큰글씨책|대활자본?|recover|recoveredition|revisededition|specialedition|limitededition|hardcover|omnibus|completeedition|remastered|deluxeedition|largeprint)$/.test(stripped);
}
function ocrBaseTitle(text){
 let s=ocrCleanLine(text);
 s=s.replace(/[([]?\s*(?:리커버(?:판|\s*에디션)?|개정(?:증보)?판|증보판|특별판|스페셜(?:판|\s*에디션)|한정판|양장(?:본|판)?|보급판|소장판|합본판?|옴니버스판|완전판|기념판|복간판|복각판|리마스터(?:판|\s*에디션)?|디럭스(?:판|\s*에디션)?|큰글자판|큰글씨책|대활자본?|re-?cover(?:\s*edition)?|revised\s*edition|special\s*edition|limited\s*edition|hardcover|omnibus|complete\s*edition|remaster(?:ed)?|deluxe\s*edition|large\s*print)\s*[)\]]?/gi,' ');
 return s.replace(/\s+/g,' ').trim();
}
function ocrTitleLike(text){
 const s=ocrCleanLine(text);if(!ocrUsefulLine(s)||ocrNoiseLine(s))return false;
 if(ocrEditionOnlyLine(s))return false;
 if(s.length>200)return false;
 if(/[.!?]{2,}/.test(s))return false;
 
 return true;
}
function ocrWordBox(word){
 const b=word?.bbox||word?.boundingBox||word?.box||{};
 const left=Number(word?.left??word?.x??b?.left??b?.x??b?.x0??0);
 const top=Number(word?.top??word?.y??b?.top??b?.y??b?.y0??0);
 let width=Number(word?.width??b?.width??0),height=Number(word?.height??b?.height??0);
 if(!width&&Number.isFinite(Number(b?.x1)))width=Math.max(0,Number(b.x1)-left);
 if(!height&&Number.isFinite(Number(b?.y1)))height=Math.max(0,Number(b.y1)-top);
 return {left,top,width,height};
}
function ocrStringSimilarity(a,b){
 const x=Model.norm(a),y=Model.norm(b);if(!x||!y)return 0;if(x===y)return 1;
 if(x.includes(y)||y.includes(x))return Math.min(x.length,y.length)/Math.max(x.length,y.length)*.86+.1;
 const grams=s=>{const g=new Set();for(let i=0;i<Math.max(1,s.length-1);i++)g.add(s.slice(i,i+2));return g};
 const A=grams(x),B=grams(y);let hit=0;A.forEach(v=>{if(B.has(v))hit++});return hit/Math.max(1,A.size+B.size-hit);
}
function ocrCandidateKey(c){return [c.type,c.provider||'',c.providerId||'',Model.norm(c.title),Model.norm(c.creator)].join('|')}
async function ocrFetchUncached(endpoint,query,unwrap,normalize){
 const requestUrl=endpoint+'?query='+encodeURIComponent(query)+'&q='+encodeURIComponent(query);
 const res=await fetch(requestUrl,{method:'POST',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,q:query,size:50,page:1})});
 const text=await res.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={message:text}}
 if(!res.ok)throw Error(payload?.error||payload?.message||('HTTP '+res.status));
 return unwrap(payload).map(normalize).filter(c=>c.title&&['book','movie'].includes(c.type)).slice(0,7);
}
async function ocrSearchAll(query){
 const configs=[[BOOK_SEARCH_ENDPOINT,unwrapBookDocuments,normalizeRemoteBook],[MOVIE_SEARCH_ENDPOINT,unwrapMovies,normalizeRemoteMovie]];
 const settled=await Promise.allSettled(configs.map(c=>ocrFetch(c[0],query,c[1],c[2])));
 const failed=settled.filter(r=>r.status==='rejected');
 if(failed.length===settled.length)throw Error('콘텐츠 검색 서버에 연결하지 못했어요.');
 const results=settled.flatMap(r=>r.status==='fulfilled'?r.value.map((c,rank)=>({...c,ocrSearchRank:rank})):[]);
 results.errors=failed.map(r=>String(r.reason?.message||r.reason));return results;
}
async function ocrPostImage(imageBase64){
 const res=await fetch(IMAGE_OCR_ENDPOINT,{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({imageBase64})});
 const raw=await res.text();let payload={};try{payload=raw?JSON.parse(raw):{}}catch{payload={message:raw}}
 if(!res.ok)throw Error(payload?.error||payload?.message||('OCR 서버 오류 · HTTP '+res.status));
 if(payload?.error)throw Error(payload.error);
 return payload;
}

function ocrStripTypeSuffix(text){
 return ocrCleanLine(text).replace(/\s*[·ㆍ]\s*(?:책|도서|음반|앨범|영화)\s*$/i,'').trim();
}
function ocrStripCreatorFromTitle(title,creator){
 let t=ocrCleanLine(title),c=ocrCleanLine(creator);if(!t||!c)return t;
 const m=t.match(/^(.*?)[\(（\[]\s*([^\)）\]]{2,30})\s*[\)）\]]\s*$/);
 if(!m)return t;
 if(ocrEditionGroups(m[2]).length)return t;
 if(Model.norm(m[2])===Model.norm(c))return ocrCleanLine(m[1]);
 return t;
}

function ocrRegionBox(item,region){
 const b=ocrWordBox(item),scale=Math.max(.0001,Number(region.scale)||1);
 return {...item,
  left:Math.max(0,(b.left-Number(region.padX||0))/scale+Number(region.sx||0)),
  top:Math.max(0,(b.top-Number(region.padY||0))/scale+Number(region.sy||0)),
  width:b.width/scale,
  height:b.height/scale,
  multipass:true
 };
}

// Geometry is always expressed in original-image pixels. Passes never share
// word rows until their own words have been assembled into spatial lines.
function ocrSyntheticLines(words){
 const tokens=(words||[]).map(w=>({...w,...ocrWordBox(w),text:ocrCleanLine(w.text||w.word||w.value||'')})).filter(w=>w.text&&w.width>0&&w.height>0);
 const passes=new Map();
 for(const w of tokens){const p=w.passId||'default';if(!passes.has(p))passes.set(p,[]);passes.get(p).push(w)}
 const lines=[];
 for(const [passId,items] of passes){
  const rows=[];
  for(const w of items.sort((a,b)=>a.top+a.height/2-b.top-b.height/2||a.left-b.left)){
   const cy=w.top+w.height/2;
   const row=rows.find(r=>Math.abs(r.cy-cy)<=Math.min(r.height,w.height)*.45);
   if(row){row.items.push(w);row.cy=(row.cy*(row.items.length-1)+cy)/row.items.length}else rows.push({cy,height:w.height,items:[w]});
  }
  for(const row of rows){
   let segment=[];
   const flush=()=>{if(!segment.length)return;const left=Math.min(...segment.map(w=>w.left)),top=Math.min(...segment.map(w=>w.top));lines.push({text:segment.map(w=>w.text).join(' '),left,top,width:Math.max(...segment.map(w=>w.left+w.width))-left,height:Math.max(...segment.map(w=>w.top+w.height))-top,passId,synthetic:true});segment=[]};
   for(const w of row.items.sort((a,b)=>a.left-b.left)){
    const prev=segment.at(-1);
    if(prev&&w.left-prev.left-prev.width>Math.max(prev.height,w.height)*1.4)flush();
    segment.push(w);
   }
   flush();
  }
 }
 return lines;
}
function ocrDedupePositioned(items){
 const out=[];
 for(const item of items||[]){
  const text=ocrCleanLine(item.text||item.word||'');const b=ocrWordBox(item);
  if(!text||b.width<=0||b.height<=0)continue;
  const old=out.find(o=>{
   const overlapX=Math.max(0,Math.min(b.left+b.width,o.left+o.width)-Math.max(b.left,o.left));
   const overlapY=Math.max(0,Math.min(b.top+b.height,o.top+o.height)-Math.max(b.top,o.top));
   const sharedPosition=overlapX/Math.max(b.width,o.width)>.7&&overlapY/Math.min(b.height,o.height)>.55;
   const independentPass=!o.passIds.includes(item.passId||'default');
   const sameFootprint=overlapX/Math.max(b.width,o.width)>.85&&overlapY/Math.max(b.height,o.height)>.75;
   return sharedPosition&&(ocrStringSimilarity(text,o.text)>.5||independentPass&&sameFootprint);
  });
  if(!old){out.push({...item,...b,text,alternatives:[text],passIds:[item.passId||'default']});continue}
  const ids=[...new Set([...old.passIds,item.passId||'default'])];
  const alternatives=[...new Set([...old.alternatives,text])];
  if(Number(item.confidence||0)>Number(old.confidence||0))Object.assign(old,item,b,{text});
  old.passIds=ids;old.alternatives=alternatives;
 }
 return out;
}
function ocrSpatialLines(result,fileIndex){
 const synthetic=ocrSyntheticLines(result.words||[]);
 // A server line spanning two separated columns must not join those columns again.
 const raw=(result.lines||[]).filter(line=>{
  const b=ocrWordBox(line);
  const parts=synthetic.filter(s=>(s.passId||'default')===(line.passId||'default')&&Math.abs(s.top+s.height/2-b.top-b.height/2)<Math.min(s.height,b.height)*.6&&s.left>=b.left-3&&s.left+s.width<=b.left+b.width+3);
  return parts.length<2;
 });
 return ocrDedupePositioned([...raw,...synthetic]).map((line,lineIndex)=>({...line,fileIndex,lineIndex,cx:line.left+line.width/2,cy:line.top+line.height/2})).filter(x=>!ocrNoiseLine(x.text));
}
function ocrCreatorText(text){
 return ocrStripTypeSuffix(text).split(/\s*[·ㆍ•]\s*|(?<=[가-힣])\s+\.\s+(?=[가-힣]{2})/)[0].replace(/\s*(?:지음|저자|감독|지은이)\s*$/,'').trim();
}
function ocrCreatorLike(text){
 const s=ocrCreatorText(text);return ocrUsefulLine(s)&&!ocrNoiseLine(s)&&!ocrEditionGroups(s).length&&s.length<=80&&!/[!?]/.test(s);
}
function ocrCanonicalQueryTitle(title,creator){
 const c=ocrCreatorText(creator||'');return {title:ocrStripCreatorFromTitle(title,c),creator:c};
}
function ocrEditionKey(text){return ocrEditionGroups(text).sort().join('|')}
function ocrSpatialQueries(results){
 const queries=[];
 (results||[]).forEach((result,fileIndex)=>{
  const lines=ocrSpatialLines(result,fileIndex).filter(l=>ocrTitleLike(l.text)||ocrEditionOnlyLine(l.text)).sort((a,b)=>a.top-b.top||a.left-b.left);
  const consumed=new Set(),local=[];
  const aligned=(a,b)=>Math.abs(a.left-b.left)<=Math.max(a.height,b.height)*.8;
  const nextLine=a=>lines.filter(b=>b!==a&&!consumed.has(b)&&b.top>=a.top+a.height*.7&&b.top-a.top-a.height<=Math.max(a.height,b.height)*2.2&&aligned(a,b)).sort((a,b)=>a.top-b.top)[0];
  for(const line of lines){
   if(consumed.has(line)||ocrEditionOnlyLine(line.text))continue;
   let title=line.text,tail=line,creator='',creatorLine=null,parts=[line],hypotheses=[];
   let next=nextLine(tail);
   // A wrapped title is joined only when a third metadata line supports it.
   const third=next&&nextLine(next);
   if(next&&third&&!ocrCreatorMetadata(next.text)&&!ocrEditionOnlyLine(next.text)&&Math.abs(next.height-line.height)<line.height*.18&&third.height<line.height*.88&&ocrCreatorLike(third.text)&&!/[·ㆍ•]/.test(next.text)){
    hypotheses.push({title:line.text,creator:ocrCreatorText(next.text),titleVariants:line.alternatives||[],creatorVariants:(next.alternatives||[]).map(ocrCreatorText)});
    title+=' '+next.text;parts.push(next);consumed.add(next);tail=next;next=third;
   }
   if(next&&ocrEditionOnlyLine(next.text)){title+=' '+next.text;consumed.add(next);tail=next;next=nextLine(tail)}
   if(next&&ocrCreatorLike(next.text)&&next.height<=line.height*1.2){creatorLine=next;creator=ocrCreatorText(next.text);consumed.add(next)}
   consumed.add(line);
   const canonical=ocrCanonicalQueryTitle(title,creator);
   const repeat=lines.filter(l=>l!==line&&Math.abs(l.left-line.left)<line.height&&l.height>=line.height*.8&&l.height<=line.height*1.2).length;
   local.push({...canonical,hypotheses,titleVariants:parts.length===1?(line.alternatives||[]).filter(t=>ocrEditionKey(t)===ocrEditionKey(title)):[],creatorVariants:(creatorLine?.alternatives||[]).map(ocrCreatorText),groupId:fileIndex+':'+line.lineIndex,fileIndex,top:line.top,left:line.left,width:Math.max(...parts.map(p=>p.left+p.width))-line.left,height:(creatorLine||tail).top+(creatorLine||tail).height-line.top,fontHeight:line.height,geometryScore:creatorLine?Math.min(95,78+repeat*3):48,edition:ocrEditionKey(title),localText:parts.map(p=>p.text).concat(creatorLine?[creatorLine.text]:[]).join('\n'),evidence:parts.map(p=>p.text),spatial:true});
  }
  // Repeated, aligned title/metadata pairs are the primary text column.
  // Smaller lettering beside that column belongs to its illustration only
  // inside that item's vertical cell; a neighbouring card is not suppressed.
  const primaries=local.filter(q=>q.creator&&local.filter(p=>p.creator&&Math.abs(p.left-q.left)<Math.max(p.fontHeight,q.fontHeight)).length>=2);
  for(const q of local){
   const owner=primaries.filter(p=>p!==q&&q.left+q.width<=p.left+p.fontHeight*.5&&q.fontHeight<p.fontHeight*.82&&q.top>=p.top-p.fontHeight*2&&q.top<Math.min(...primaries.filter(n=>n.top>p.top+p.fontHeight*2&&Math.abs(n.left-p.left)<p.fontHeight).map(n=>n.top-n.fontHeight*2),p.top+p.fontHeight*16)).sort((a,b)=>b.top-a.top)[0];
   if(owner){owner.evidence.push(q.title);continue}
   queries.push(q);
  }
 });
 return queries;
}
function ocrCanonicalResultTitle(title,creator){return Model.norm(ocrBaseTitle(ocrStripCreatorFromTitle(title,ocrCreatorText(creator))))}
function ocrSameResolvedWork(a,b){
 if(!a||!b||a.type!==b.type||ocrEditionKey(a.ocrQuery||a.title)!==ocrEditionKey(b.ocrQuery||b.title)||ocrEditionKey(a.title)!==ocrEditionKey(b.title))return false;
 if(a.provider&&a.provider===b.provider&&a.providerId&&a.providerId===b.providerId)return true;
 const at=ocrCanonicalResultTitle(a.title,a.creator),bt=ocrCanonicalResultTitle(b.title,b.creator);
 if(!at||at!==bt&&ocrStringSimilarity(at,bt)<.94)return false;
 return !!a.creator&&!!b.creator&&ocrStringSimilarity(ocrCreatorText(a.creator),ocrCreatorText(b.creator))>=.8;
}
function ocrEvaluateHypothesis(c,q,rank,preferredType=''){
 const source=ocrCanonicalResultTitle(q.title,q.creator),target=ocrCanonicalResultTitle(c.title,c.creator);
 const title=Math.max(...[q.title,...q.titleVariants||[]].map(t=>ocrStringSimilarity(ocrCanonicalResultTitle(t,q.creator),target))),creator=q.creator&&c.creator?Math.max(...[q.creator,...q.creatorVariants||[]].map(v=>ocrStringSimilarity(ocrCreatorText(c.creator),v))):null;
 const wanted=ocrEditionGroups(q.title),actual=ocrEditionGroups(c.title);
 const editionExact=ocrEditionKey(q.title)===ocrEditionKey(c.title);
 if(source.length===1&&!q.creator&&q.geometryScore<70)return {valid:false,reason:'isolated-glyph',title,creator};
 // Short titles require exact title evidence; a matching author cannot rescue an unrelated title.
 if(!source||title<(source.length<=3?1:.56))return {valid:false,reason:'title',title,creator};
 if(wanted.includes('largeprint')!==actual.includes('largeprint'))return {valid:false,reason:'largeprint',title,creator};
 if(creator!==null&&creator<.3)return {valid:false,reason:'creator',title,creator};
 const spatial=Math.min(1,(q.geometryScore||45)/100),relevance=1/(1+rank);
 const score=Math.min(100,title*65+(creator===null?0:creator*20)+spatial*8+relevance*3+(editionExact?4:-8)+(preferredType===c.type?1:0));
 const high=score>=82&&title>=.86&&editionExact&&(creator===null||creator>=.75);
 return {valid:true,title,creator,editionExact,spatial,relevance,score,label:high?'일치 높음':'확인 필요',level:high?'high':'medium',selected:high};
}
async function ocrResolveQueries(queries,search,progress,preferredType=''){
 const cache=new Map();
 const lookup=async query=>{if(!cache.has(query))cache.set(query,Promise.resolve().then(()=>search(query,'')));return cache.get(query)};
 const resolved=await ocrMapLimit(queries,3,async(q,i)=>{
  if(progress)progress(q,i,queries.length);
  const pool=new Map(),errors=[];
  const add=async query=>{try{const found=await lookup(query);errors.push(...found.errors||[]);found.forEach((c,rank)=>{const key=ocrCandidateKey(c);if(!pool.has(key))pool.set(key,{...c,searchRank:c.ocrSearchRank??rank})})}catch(e){errors.push(String(e.message||e))}};
  const ranked=()=>[...pool.values()].map(c=>({...c,match:ocrEvaluateCandidate(c,q,c.searchRank,preferredType)})).filter(c=>c.match.valid).sort((a,b)=>b.match.score-a.match.score);
  await add(q.title);
  // Never discard the original title/creator interpretation after a geometric wrap.
  for(const h of q.hypotheses||[])await add(h.title);
  if(!ranked()[0]||!ranked()[0].match.selected){for(const variant of [...new Set(q.titleVariants||[])].slice(0,3)){if(Model.norm(variant)!==Model.norm(q.title))await add(variant)}}
  if(!ranked()[0]||!ranked()[0].match.selected){
   for(const h of [q,...q.hypotheses||[]])if(h.creator)await add(h.title+' '+h.creator);
  }
  const base=ocrBaseTitle(q.title);
  if(Model.norm(base)!==Model.norm(q.title)&&(!ranked()[0]||!ranked()[0].match.editionExact))await add(base+(q.creator?' '+q.creator:''));
  const options=ranked(),best=options[0];
  const diagnostic={groupId:q.groupId,query:q.title,creator:q.creator,hypotheses:q.hypotheses||[],errors,results:[...pool.values()].map(c=>({candidateTitle:c.title,candidateCreator:c.creator,...ocrEvaluateCandidate(c,q,c.searchRank,preferredType)}))};
  if(!best)return {diagnostic};
  const m={...best.match};
  if(options[1]&&!ocrSameResolvedWork(best,options[1])&&m.score-options[1].match.score<3){m.selected=false;m.level='medium';m.label='확인 필요'}
  return {diagnostic,chosen:{...best,score:m.score,selected:m.selected,confidence:m.label,confidenceLevel:m.level,source:'사진 자동 인식 · OCR.Space',ocrQuery:m.ocrTitle,ocrGroupId:q.groupId,ocrTop:q.top,ocrFileIndex:q.fileIndex,ocrGeometryScore:q.geometryScore}};
 });
 const picked=[];
 for(const {chosen} of resolved){
  if(!chosen)continue;
  const duplicate=picked.findIndex(p=>ocrSameResolvedWork(p,chosen));
  if(duplicate<0)picked.push(chosen);else if(chosen.score>picked[duplicate].score)picked[duplicate]=chosen;
 }
 return {picked,diagnostics:resolved.map(r=>r.diagnostic)};
}
async function imageCanvasToOCRDataURL(canvas){
 const data=canvas.toDataURL('image/png');return {data,width:canvas.width,height:canvas.height,bytes:Math.ceil(data.split(',')[1].length*3/4)};
}
function ocrGenericRegionPlan(w,h){
 const tw=Math.min(w,850),th=Math.min(h,900),plan=[];
 const positions=(size,tile)=>{const out=[0];while(out.at(-1)+tile<size)out.push(Math.min(size-tile,out.at(-1)+Math.floor(tile*.78)));return out};
 for(const sy of positions(h,th))for(const sx of positions(w,tw))plan.push({sx,sy,sw:tw,sh:th,scale:Math.min(2.5,1500/tw)});
 return plan;
}
async function ocrEncodeRegion(img,sx,sy,sw,sh,scale=1){
 const pad=32,canvas=document.createElement('canvas');canvas.width=Math.round(sw*scale)+pad*2;canvas.height=Math.round(sh*scale)+pad*2;
 const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,sw,sh,pad,pad,Math.round(sw*scale),Math.round(sh*scale));
 return {...await imageCanvasToOCRDataURL(canvas),sx,sy,sw,sh,scale,padX:pad,padY:pad};
}
async function requestServerOCRMultiPassUncached(file,progress,onPartial){
 const url=URL.createObjectURL(file);
 try{
  const img=await loadImage(url),w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  const plan=ocrGenericRegionPlan(w,h);if(w*h<=12000000)plan.unshift({sx:0,sy:0,sw:w,sh:h,scale:1});
  const tasks=[];
  async function prepare(region,depth=0){
   const enc=await ocrEncodeRegion(img,region.sx,region.sy,region.sw,region.sh,region.scale);
   if(enc.bytes>850000&&depth<8){
    const axis=region.sw>region.sh?'x':'y',size=axis==='x'?region.sw:region.sh,part=Math.ceil(size*.58);
    if(part<size){for(const offset of [0,size-part])await prepare({...region,[axis==='x'?'sx':'sy']:region[axis==='x'?'sx':'sy']+offset,[axis==='x'?'sw':'sh']:part},depth+1);return}
   }
   tasks.push({region,enc});
  }
  for(const region of plan)await prepare(region);
  let completed=0;const partials=[];
  const outputs=await ocrMapLimit(tasks,3,async({region,enc},i)=>{
   const passId='p'+i,started=performance.now();
   try{
    if(enc.bytes>850000)throw Error('이미지 영역이 OCR 전송 한도를 초과했어요.');
    const payload=await ocrPostImage(enc.data);
    const output={text:payload.text||'',lines:(payload.lines||[]).map(x=>({...ocrRegionBox(x,enc),passId})),words:(payload.words||[]).map(x=>({...ocrRegionBox(x,enc),passId})),pass:{passId,...region,ok:true,lineCount:(payload.lines||[]).length,ms:performance.now()-started}};
    partials[i]=output;
    if(onPartial){const ready=partials.filter(Boolean);try{onPartial({name:file.name,text:ready.map(o=>o.text).join('\n'),lines:ready.flatMap(o=>o.lines),words:ready.flatMap(o=>o.words),sourceWidth:w,sourceHeight:h})}catch{/* Optional prefetch must never invalidate a successful OCR pass. */}}
    return output;
   }catch(e){return {text:'',lines:[],words:[],pass:{passId,...region,ok:false,error:String(e.message||e),ms:performance.now()-started}}}
   finally{completed++;if(progress)progress('글자 영역을 읽고 있어요 · '+completed+'/'+tasks.length)}
  });
  const passes=outputs.map(o=>o.pass);
  if(!passes.some(p=>p.ok))throw Error(passes[0]?.error||'사진을 읽지 못했어요.');
  return {name:file.name,text:outputs.map(o=>o.text).join('\n'),lines:outputs.flatMap(o=>o.lines),words:outputs.flatMap(o=>o.words),passes,sourceWidth:w,sourceHeight:h,multiPassCount:passes.length};
 }finally{URL.revokeObjectURL(url)}
}

function ocrCreatorMetadata(text){
 const cleaned=ocrStripTypeSuffix(text);
 return ocrCreatorText(cleaned)!==cleaned||/(?:저자|지음|지은이|감독|아티스트)\s*[:：]/.test(cleaned);
}
async function ocrMapLimit(items,limit,fn){
 const results=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(next<items.length){const index=next++;results[index]=await fn(items[index],index)}
 }));
 return results;
}
function ocrEvaluateCandidate(c,q,rank,preferredType=''){
 const interpretations=[q,...q.hypotheses||[]];
 const scores=interpretations.map(h=>({...ocrEvaluateHypothesis(c,{...q,...h,hypotheses:[]},rank,preferredType),ocrTitle:h.title,ocrCreator:h.creator}));
 return scores.filter(m=>m.valid).sort((a,b)=>b.score-a.score)[0]||scores[0];
}
// Session memory only: no screenshots or OCR text are persisted in browser storage.
const OCR_IMAGE_CACHE={values:new Map(),pending:new Map(),ttl:10*60*1000,maxEntries:12,maxBytes:8*1024*1024};
const OCR_SEARCH_CACHE={values:new Map(),pending:new Map(),ttl:5*60*1000,maxEntries:128,maxBytes:2*1024*1024};
function ocrCacheCopy(value){
 return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
}
async function ocrCached(cache,key,produce,accept=()=>true,onReuse=()=>{}){
 const now=Date.now();
 for(const [k,v] of cache.values)if(v.expires<=now)cache.values.delete(k);
 const old=cache.values.get(key);
 if(old){cache.values.delete(key);cache.values.set(key,old);onReuse('cached');return ocrCacheCopy(old.value)}
 if(cache.pending.has(key)){onReuse('pending');return ocrCacheCopy(await cache.pending.get(key))}
 const job=Promise.resolve().then(produce).then(value=>{
  if(accept(value)){
   const bytes=JSON.stringify(value).length*2;
   if(bytes<=cache.maxBytes){
    cache.values.set(key,{value:ocrCacheCopy(value),bytes,expires:Date.now()+cache.ttl});
    let total=[...cache.values.values()].reduce((n,v)=>n+v.bytes,0);
    while(cache.values.size>cache.maxEntries||total>cache.maxBytes){const first=cache.values.keys().next().value;total-=cache.values.get(first).bytes;cache.values.delete(first)}
   }
  }
  return value;
 });
 cache.pending.set(key,job);
 try{return ocrCacheCopy(await job)}finally{if(cache.pending.get(key)===job)cache.pending.delete(key)}
}
async function ocrFileDigest(file){
 if(typeof file?.arrayBuffer!=='function'||!globalThis.crypto?.subtle)return '';
 try{
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 }catch{return ''}
}
async function ocrFetch(endpoint,query,unwrap,normalize){
 // Preserve punctuation and case: different editions and creator queries stay distinct.
 const normalized=String(query||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 return ocrCached(OCR_SEARCH_CACHE,JSON.stringify([endpoint,normalized]),()=>ocrFetchUncached(endpoint,normalized,unwrap,normalize),value=>Array.isArray(value)&&value.length>0);
}
async function requestServerOCRMultiPass(file,progress,onPartial){
 const digest=await ocrFileDigest(file);
 if(!digest)return requestServerOCRMultiPassUncached(file,progress,onPartial);
 let cacheState='fresh';
 const value=await ocrCached(OCR_IMAGE_CACHE,'png-multipass-v2:'+digest,()=>requestServerOCRMultiPassUncached(file,progress,onPartial),r=>r.passes?.length>0&&r.passes.every(p=>p.ok)&&r.lines?.length>0,state=>{
  cacheState=state;if(progress)progress(state==='cached'?'이미 읽은 사진의 인식 결과를 불러오고 있어요…':'같은 사진의 진행 중인 분석을 기다리고 있어요…');
 });
 return {...value,name:file.name,cacheState};
}

function ocrCreateSearchSession(search,isCurrent=()=>true){
 const entries=new Map(),queue=[];let active=0,finalPhase=false,stopped=false;
 const stats={prefetched:0,reused:0,discarded:0,peak:0};
 const keyOf=q=>String(q||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 function pump(){
  if(stopped||!isCurrent())return;
  while(active<(finalPhase?3:2)&&queue.length){
   const job=queue.shift();job.state='running';active++;stats.peak=Math.max(stats.peak,active);
   if(job.speculative)stats.prefetched++;
   Promise.resolve().then(()=>search(job.query)).then(value=>{
    job.state='done';job.value=value;
    // A failed speculative lookup must not suppress a normal retry.
    if(value.errors?.length)entries.delete(job.key);
    job.resolve(value);
   },error=>{entries.delete(job.key);job.state='failed';job.reject(error)}).finally(()=>{active--;pump()});
  }
 }
 function request(query,speculative){
  const key=keyOf(query),existing=entries.get(key);
  if(existing){if(!speculative&&existing.speculative&&!existing.used){existing.used=true;stats.reused++}return existing.promise}
  if(stopped||!isCurrent())return Promise.reject(Error('인식이 취소되었어요.'));
  const job={query:key,key,speculative,state:'queued',used:!speculative};
  job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject});
  entries.set(key,job);if(speculative)queue.push(job);else queue.unshift(job);pump();return job.promise;
 }
 function discardQueued(){
  while(queue.length){const job=queue.pop();entries.delete(job.key);stats.discarded++;job.reject(Error('추가 사전 검색을 종료했어요.'))}
 }
 return {
  offer(queries){
   if(finalPhase||stopped||!isCurrent())return;
   // Speculation only: this budget never filters the final recognition candidates.
   for(const q of [...queries].sort((a,b)=>b.geometryScore-a.geometryScore)){
    if(stats.prefetched+queue.length>=12)break;
    if(!q.creator||q.geometryScore<85)continue;
    void request(q.title,true).catch(()=>{});
   }
  },
  beginFinal(){finalPhase=true;discardQueued();pump()},
  async lookup(query){
   const key=keyOf(query),job=entries.get(key);
   if(job?.speculative){
    try{const value=await request(query,false);if(!value.errors?.length)return ocrCacheCopy(value)}catch{}
    if(entries.get(key)===job)entries.delete(key);
   }
   return ocrCacheCopy(await request(query,false));
  },
  stop(){stopped=true;discardQueued()},
  stats
 };
}

async function runOCR(){
 if(!photoFiles.length||ocrBusy)return;
 const pipelineStarted=performance.now();let ocrFinished=0,searchStarted=0;
 ocrBusy=true;const ticket=++ocrGeneration;$('ocrButton').disabled=true;$('ocrProgress').textContent='사진을 OCR 서버로 보내고 있어요…';let results=[];
 const searchSession=ocrCreateSearchSession(ocrSearchAll,()=>ticket===ocrGeneration);
 try{
  for(let fi=0;fi<photoFiles.length;fi++){
   if(ticket!==ocrGeneration)return;
   $('ocrProgress').textContent='글자를 읽고 있어요 · '+(fi+1)+'/'+photoFiles.length+'장';
   const result=await requestServerOCRMultiPass(photoFiles[fi],msg=>{if(ticket===ocrGeneration&&$('ocrProgress'))$('ocrProgress').textContent=msg},partial=>{if(ticket===ocrGeneration)searchSession.offer(ocrSpatialQueries([partial]))});results.push(result);
  }
  if(ticket!==ocrGeneration)return;
  ocrFinished=performance.now();
  const text=results.map(r=>r.text).join('\n'),preferredType=ocrContextType(text);
  if(preferredType==='album')throw Error('음반은 현재 지원하지 않아요. 책이나 영화라면 제목이 잘 보이는 사진을 가져오거나 직접 입력해주세요.');
  $('ocrProgress').textContent='가까운 제목과 제작자를 묶고 있어요…';
  const structured=ocrSpatialQueries(results,text);
  if(!structured.length)throw Error('검색할 만한 제목을 읽지 못했어요. 더 선명한 사진으로 다시 시도해주세요.');
  $('ocrProgress').textContent='제목과 제작자를 묶어 콘텐츠를 찾고 있어요…';

  const queries=structured;
  searchStarted=performance.now();searchSession.beginFinal();
  const resolved=await ocrResolveQueries(queries,q=>searchSession.lookup(q),(q,i,total)=>{
   if(ticket!==ocrGeneration)throw Error('인식이 취소되었어요.');
   $('ocrProgress').textContent='콘텐츠 검색 중 · '+(i+1)+'/'+total+' · '+q.title;
  },preferredType);
  if(ticket!==ocrGeneration)return;
  candidates=resolved.picked.filter(c=>['book','movie'].includes(c.type)&&!(c.type==='book'&&isExcludedBookCandidate(c))).map(c=>photoImportSource?{...c,source:photoImportSource.url,linkSources:[photoImportSource]}:c);
  window.songrimOCRDiagnostics={images:results,queries,matching:resolved.diagnostics,prefetch:{...searchSession.stats},timings:{ocrMs:ocrFinished-pipelineStarted,groupingMs:searchStarted-ocrFinished,searchMs:performance.now()-searchStarted,totalMs:performance.now()-pipelineStarted}};
  const failures=results.flatMap(r=>(r.passes||[]).filter(p=>!p.ok)).length;
  const searchFailures=resolved.diagnostics.reduce((n,d)=>n+d.errors.length,0);
  const auto=candidates.filter(c=>c.selected&&c.confidenceLevel==='high').length,review=candidates.filter(c=>c.selected&&c.confidenceLevel==='medium').length;
const used=queries.map(q=>q.creator?q.title+' — '+q.creator:q.title);
  showModal('사진에서 찾은 작품','<div class="ocr-scan-status"><strong>'+candidates.length+'개를 찾았어요</strong><span>자동 선택 '+(auto+review)+'개</span></div>'+(failures||searchFailures?'<div class="ocr-review-note">일부 인식·검색 요청이 실패했어요. 결과에 누락이 있을 수 있으니 다시 시도해주세요.</div>':'')+'<div class="ocr-review-note">제목과 제작자를 확인하고, 저장할 작품을 골라주세요.</div><div id="candidateRows"></div><details class="collapse"><summary>인식한 제목·제작자 보기</summary><p class="muted">'+esc(used.join(' · '))+'</p></details><details class="collapse"><summary>사진에서 읽은 글자 보기</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(text||'글자를 찾지 못했어요.')+'</p></details><details class="collapse ocr-unmatched"><summary>직접 추가하기</summary><label for="ocrTitle">작품 제목</label><input id="ocrTitle" placeholder="제목 입력"><label for="ocrCreator">제작자 · 선택</label><input id="ocrCreator"><select id="ocrType" aria-label="콘텐츠 유형"><option value="book">책</option><option value="movie">영화</option></select>'+button('후보에 추가','candidateManual','secondary')+'</details>'+button('선택한 작품 저장','saveCandidates','primary','id="saveCandidates"'),'review');renderCandidates();
 }catch(e){if(ticket===ocrGeneration){$('ocrProgress').textContent=e?.message||'사진을 읽지 못했어요. 다시 시도하거나 직접 입력해주세요.';$('ocrButton').disabled=false}}finally{searchSession.stop();if(ticket===ocrGeneration)ocrBusy=false}
}
function renderCandidates(){
 const rows=$('candidateRows');if(!rows)return;
 candidates=candidates.filter(c=>['book','movie'].includes(c.type));
 rows.innerHTML=candidates.length?'<div class="ocr-match-list">'+candidates.map((c,i)=>'<div class="ocr-match"><input type="checkbox" id="candidate-'+i+'" data-candidate="'+i+'" '+(c.selected?'checked':'')+'>'+cover(c)+'<label class="ocr-match-main" for="candidate-'+i+'"><div class="ocr-match-title">'+esc(c.title)+'</div><div class="ocr-match-meta">'+esc(c.creator||'제작자 미확인')+' · '+typeName[c.type]+'</div><div class="ocr-confidence '+esc(c.confidenceLevel||'medium')+'">'+esc(c.confidence||'직접 추가')+'</div></label></div>').join('')+'</div>':'<p class="note">확실하게 매칭된 콘텐츠를 찾지 못했어요. 인식한 글자를 확인해 직접 추가하거나 다른 사진으로 다시 시도해주세요.</p>';
 if($('saveCandidates'))$('saveCandidates').disabled=!candidates.some(c=>c.selected)
}
async function imageData(file){
 if(!file)return '';
 if(file.size>15000000)throw Error('사진은 15MB 이하로 선택해주세요.');
 const url=URL.createObjectURL(file);
 try{const img=await loadImage(url),canvas=document.createElement('canvas'),scale=Math.min(1,300/img.width,400/img.height);canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82)}finally{URL.revokeObjectURL(url)}
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('이미지를 읽지 못했어요.'));img.src=src})}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
function loadShareImage(src,timeoutMs=8000){
 return new Promise(resolve=>{
  const img=new Image();let settled=false;
  const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);img.onload=null;img.onerror=null;if(!value)img.removeAttribute('src');resolve(value)};
  const timer=setTimeout(()=>finish(null),timeoutMs);
  // Only origin-clean images may be drawn onto an export canvas.
  img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.decoding='async';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=src;
 });
}
const shareCoverCache=new Map();
function shareCoverProxyURL(src){
 // The fallback receives only public catalog artwork, never uploaded photos,
 // arbitrary URLs, account data, or the calendar itself. Keep saved covers intact.
 try{
  const url=new URL(src);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port)return '';
  const publicArtwork=u=>
   (/^search\d?\.kakaocdn\.net$/.test(u.hostname)&&u.pathname.startsWith('/thumb/'))||
   (/^t\d\.daumcdn\.net$/.test(u.hostname)&&/^\/lbook\/image\/\d+/.test(u.pathname))||
   (u.hostname==='image.yes24.com'&&u.pathname.startsWith('/goods/'))||
   (u.hostname==='image.aladin.co.kr'&&u.pathname.startsWith('/product/'))||
   (u.hostname==='contents.kyobobook.co.kr'&&u.pathname.startsWith('/sih/'))||
   (['books.google.com','books.google.co.kr','books.googleusercontent.com'].includes(u.hostname)&&u.pathname==='/books/content')||
   (['shopping-phinf.pstatic.net','bookthumb-phinf.pstatic.net'].includes(u.hostname));
  if(!publicArtwork(url)||[...url.searchParams.keys()].some(k=>/token|signature|credential|authorization|key/i.test(k)))return '';
  if(url.searchParams.has('fname')){
   const original=new URL(url.searchParams.get('fname'));
   if(!['http:','https:'].includes(original.protocol)||original.username||original.password||original.port||!/^t\d\.daumcdn\.net$/.test(original.hostname)||!/^\/lbook\/image\/\d+/.test(original.pathname)||[...original.searchParams.keys()].some(k=>k!=='timestamp'))return '';
  }
  url.hash='';
  return 'https://wsrv.nl/?'+new URLSearchParams({url:url.href,w:'240',h:'360',fit:'inside',output:'jpg'});
 }catch{return ''}
}
async function loadShareCover(src,timeoutMs=12000,isCurrent=()=>true){
 if(!src||!isCurrent())return null;
 if(shareCoverCache.has(src))return shareCoverCache.get(src);
 const started=performance.now(),proxy=shareCoverProxyURL(src);
 let img=await loadShareImage(src,proxy?Math.min(3500,timeoutMs):timeoutMs);
 if(!isCurrent())return null;
 if(!img&&proxy){
  const remaining=timeoutMs-(performance.now()-started);
  if(remaining>0)img=await loadShareImage(proxy,remaining);
 }
 if(!isCurrent())return null;
 if(img){shareCoverCache.set(src,img);if(shareCoverCache.size>64)shareCoverCache.delete(shareCoverCache.keys().next().value)}
 return img;
}
// Share (redesign 15/16): one sheet for the month forest, the year forest and a finished work,
// with a story (9:16) or feed (4:5) image. Everything is drawn on a canvas from local assets.
let shareKind='year',shareRevision='',shareGeneration=0,shareFormat='feed',shareTarget='';
const shareImageCache=new Map();
function shareAsset(src){if(!shareImageCache.has(src))shareImageCache.set(src,loadImage(src).catch(()=>null));return shareImageCache.get(src)}
async function inlineSvgImages(markup){
 const hrefs=[...new Set([...markup.matchAll(/href="(\.\/assets\/[^"]+)"/g)].map(m=>m[1]))];
 const pairs=await Promise.all(hrefs.map(async href=>{try{const blob=await (await fetch(href)).blob();return [href,await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.onerror=()=>r('');f.readAsDataURL(blob)})]}catch{return [href,'']}}));
 for(const [href,data] of pairs)if(data)markup=markup.split('href="'+href+'"').join('href="'+data+'"');
 return markup;
}
function shareSnapshot(){return JSON.stringify({items:state.items,collection:state.collection,floor:bmFloorId(),year,month,kind:shareKind,target:shareTarget,format:shareFormat,name:state.profile.name})}
function shareRounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function sharePill(ctx,text,x,y,{fill='#fff',color='#1E2A22',size=34,rotate=0,bold='',boldSize=0,align='left'}={}){
 const F='"Pretendard Variable",Pretendard,sans-serif';ctx.save();ctx.font='600 '+size+'px '+F;const w1=ctx.measureText(text).width;ctx.font='800 '+(boldSize||size*1.25)+'px '+F;const w2=bold?ctx.measureText(bold).width+12:0;
 const w=w1+w2+56,h=(boldSize||size*1.25)+44,ox=align==='right'?x-w:x;ctx.translate(ox+w/2,y+h/2);ctx.rotate(rotate*Math.PI/180);
 ctx.shadowColor='rgba(30,42,34,.18)';ctx.shadowBlur=24;ctx.shadowOffsetY=10;ctx.fillStyle='#fff';shareRounded(ctx,-w/2-6,-h/2-6,w+12,h+12,(h+12)/2);ctx.fill();ctx.shadowColor='transparent';
 ctx.fillStyle=fill;shareRounded(ctx,-w/2,-h/2,w,h,h/2);ctx.fill();ctx.fillStyle=color;ctx.textBaseline='middle';ctx.font='600 '+size+'px '+F;ctx.fillText(text,-w/2+28,2);if(bold){ctx.font='800 '+(boldSize||size*1.25)+'px '+F;ctx.fillText(bold,-w/2+28+w1+12,2)}ctx.restore();return w;
}
// Same rubber stamp as stampSVG (coral rings, arc lettering, DONE), drawn on canvas.
function shareStamp(ctx,cx,cy,r,date,rotate=10){
 const k=r/60,L='Archivo,"Pretendard Variable",sans-serif',coral='#E85A47';
 ctx.save();ctx.translate(cx,cy);ctx.rotate(rotate*Math.PI/180);ctx.globalAlpha=.92;ctx.strokeStyle=coral;ctx.fillStyle=coral;
 [[56,3.4],[51,1.1],[35,1.4]].forEach(([rr,w])=>{ctx.lineWidth=w*k;ctx.beginPath();ctx.arc(0,0,rr*k,0,Math.PI*2);ctx.stroke()});
 const arc=(text,rr,top)=>{ctx.font='600 '+(10*k)+'px '+L;const sp=1.4*k,ws=[...text].map(ch=>ctx.measureText(ch).width+sp),total=ws.reduce((x,y)=>x+y,0)-sp;
  let pos=-total/2;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  [...text].forEach((ch,i)=>{const mid=pos+(ws[i]-sp)/2,ang=mid/(rr*k);ctx.save();if(top){ctx.rotate(ang);ctx.fillText(ch,0,-rr*k)}else{ctx.rotate(-ang);ctx.fillText(ch,0,rr*k+7*k)}ctx.restore();pos+=ws[i]})};
 arc('GREW · TODAY',39,true);arc(String(date||now()).replace(/-/g,'.'),39,false);
 ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='600 '+(7*k)+'px '+L;ctx.fillText('★  ★  ★',0,-13*k);
 ctx.font='700 '+(21*k)+'px '+L;ctx.letterSpacing=(.6*k)+'px';ctx.fillText('DONE',0,11*k);ctx.letterSpacing='0px';
 [-44,44].forEach(x=>{ctx.beginPath();ctx.arc(x*k,0,1.6*k,0,Math.PI*2);ctx.fill()});
 ctx.restore();
}
async function shareIsland(ctx,y0,x0,scale,items){
 const g=yearBoardGeometry(forestLifetime&&shareKind==='year'?'all':year,items),G=g.ground,P=(x,y)=>[x0+x*scale,y0+y*scale];
 const poly=(pts,fill,stroke)=>{ctx.fillStyle=fill;ctx.beginPath();pts.forEach(([x,y],k)=>{const [px,py]=P(x,y);k?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.closePath();ctx.fill();if(stroke){ctx.strokeStyle=fill;ctx.lineWidth=.7*scale;ctx.lineJoin='round';ctx.stroke()}};
 const oval=(x,y,rx,ry,fill,a=1)=>{ctx.globalAlpha=a;ctx.fillStyle=fill;ctx.beginPath();const [px,py]=P(x,y);ctx.ellipse(px,py,rx*scale,ry*scale,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1};
 G.sides.forEach(f=>poly(f.pts,f.fill));G.specks.forEach(d=>oval(d.x,d.y,d.r,d.r,d.fill,.85));G.lips.forEach(f=>poly(f.pts,f.fill));
 G.facets.forEach(f=>poly(f.pts,f.fill,true));G.extras.forEach(e=>oval(e.x,e.y,e.rx,e.ry,e.fill,e.opacity||1));
 g.dots.forEach(d=>oval(d.x,d.y,g.cellW*.16,g.cellW*.08,G.dot));
 const imgs=await Promise.all(g.trees.map(t=>shareAsset(t.src)));
 g.trees.forEach((t,k)=>{if(imgs[k]){const z=t.size,[x,y]=P(t.x-z/2,t.y-z*.875);ctx.drawImage(imgs[k],x,y,z*scale,z*scale)}});
}
async function drawShareCard(kind,format,target){
 if(document.fonts?.ready)await document.fonts.ready;
 const W=1080,H=format==='story'?1920:1350,story=format==='story',canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
 const F='"Pretendard Variable",Pretendard,sans-serif',L='Archivo,'+F,name=state.profile.name||'나',ink='#1E2A22',muted='#52524F',months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 ctx.fillStyle='#F8F8F6';ctx.fillRect(0,0,W,H);
 if(kind==='year'&&forestLifetime)return drawLifetimeCard(ctx,canvas,W,H,story,name,F,L,'life');
 if(kind==='year'||kind==='month')return drawStickerCard(ctx,canvas,W,H,story,name,F,L,kind);
 return canvas;
}
// Forest stat cards. Lifetime ("솔의 숲"): a night forest — dark sky, stars, the island lit from behind,
// a bar per year. Year ("올해의 숲"): the same layout on white, no sky, a bar per month.
async function drawLifetimeCard(ctx,canvas,W,H,story,name,F,L,mode='life'){
 const life=mode==='life',items=yearForestItems(life?'all':year,'all'),done=items.filter(x=>x.completed),books=done.filter(x=>x.type==='book').length,films=done.filter(x=>x.type==='movie').length;
 const years=forestTreeYears(),first=years[0]||now().slice(0,4),rated=done.filter(x=>validRating(x.rating)),avg=rated.length?(rated.reduce((n,x)=>n+Number(x.rating),0)/rated.length).toFixed(1):'';
 const butter='#F7E7A1',mint='#BFE7CB',coral='#E85A47',ink='#1E2A22',white='#FFFFFF';
 const fg=life?white:ink,soft=life?'rgba(255,255,255,.62)':'rgba(30,42,34,.55)',accent=life?butter:ink;
 if(life){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#16211A');g.addColorStop(.55,'#22382B');g.addColorStop(1,'#2E4A38');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const rnd=k=>(hash('life|'+k)%10000)/10000;
  for(let i=0;i<90;i++){const x=rnd('x'+i)*W,y=rnd('y'+i)*H*.62,r=.8+rnd('r'+i)*2.2;ctx.globalAlpha=.25+rnd('a'+i)*.6;ctx.fillStyle=i%7?white:butter;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;
  const sparkle=(x,y,r,c)=>{ctx.save();ctx.translate(x,y);ctx.fillStyle=c;ctx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=k%2?r*.28:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.fill();ctx.restore()};
  [[.12,.2,16],[.86,.28,20],[.2,.48,12],[.9,.52,14]].forEach(([x,y,r],i)=>sparkle(W*x,H*y*(story?1:.95),r,i%2?butter:white));
 }else{ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H)}
 ctx.textBaseline='alphabetic';ctx.fillStyle=fg;ctx.font='700 30px '+L;ctx.letterSpacing='4px';ctx.textAlign='left';ctx.fillText('GREW',72,96);ctx.textAlign='right';ctx.fillStyle=life?butter:soft;ctx.fillText(life?'SINCE '+first:year+' FOREST',W-72,96);ctx.letterSpacing='0px';
 const top=story?260:190;ctx.textAlign='center';ctx.fillStyle=fg;ctx.font='700 54px '+F;ctx.fillText(name+'의 '+(life?'':'올해 ')+'숲',W/2,top);
 ctx.fillStyle=accent;ctx.font='800 '+(story?280:220)+'px '+L;ctx.fillText(String(done.length),W/2,top+(story?270:215));
 ctx.fillStyle=soft;ctx.font='600 44px '+F;ctx.fillText(life?'그루가 자랐어요':'그루를 심었어요',W/2,top+(story?350:285));
 const bandTop=top+(story?420:320),bandH=story?680:430,scale=Math.min((W-60)/390,bandH/250),cx=W/2,cy=bandTop+bandH*.52;
 const glow=ctx.createRadialGradient(cx,cy,10,cx,cy,W*.55);
 if(life){glow.addColorStop(0,'rgba(247,231,161,.38)');glow.addColorStop(.5,'rgba(191,231,203,.12)');glow.addColorStop(1,'rgba(191,231,203,0)')}else{glow.addColorStop(0,'rgba(191,231,203,.28)');glow.addColorStop(1,'rgba(191,231,203,0)')}
 ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 await shareIsland(ctx,bandTop+(bandH-250*scale)/2,(W-390*scale)/2,scale,items);
 // bars: a year each (lifetime) or a month each (this year)
 const cur=now().slice(0,7),labels=life?years.slice(-6):Array.from({length:12},(_,i)=>String(i+1)),counts=life?labels.map(y=>yearForestItems(y,'all').length):labels.map((_,i)=>done.filter(x=>x.completed.slice(5,7)===String(i+1).padStart(2,'0')).length);
 const best=life?labels.length-1:counts.indexOf(Math.max(...counts)),gap=life?24:12,max=Math.max(1,...counts),barW=Math.min(110,(W-144-(labels.length-1)*gap)/Math.max(1,labels.length)),totalW=labels.length*barW+(labels.length-1)*gap,x0=(W-totalW)/2,chartTop=bandTop+bandH+(story?50:30),chartH=story?190:96;
 labels.forEach((lb,i)=>{const future=!life&&year+'-'+String(i+1).padStart(2,'0')>cur,h=counts[i]?Math.max(12,counts[i]/max*chartH):6,x=x0+i*(barW+gap),by=chartTop+chartH-h;
  ctx.fillStyle=i===best&&counts[i]?butter:life?mint:(future?'rgba(30,42,34,.06)':mint);ctx.globalAlpha=life&&i!==best?.85:1;shareRounded(ctx,x,by,barW,h,Math.min(18,barW/2,h/2));ctx.fill();ctx.globalAlpha=1;
  if(counts[i]){ctx.fillStyle=fg;ctx.font='800 '+(life?32:28)+'px '+L;ctx.fillText(String(counts[i]),x+barW/2,by-12)}
  ctx.fillStyle=soft;ctx.font='600 '+(life?26:24)+'px '+L;ctx.fillText(lb,x+barW/2,chartTop+chartH+36)});
 ctx.textAlign='left';const chipY=chartTop+chartH+(story?90:66);
 const chip=(label,fill,color)=>{ctx.font='700 32px '+F;return {label,fill,color,w:ctx.measureText(label).width+56}};
 const chips=[chip('책 '+books+'권',butter,ink),chip('영화 '+films+'편',mint,ink),...(avg?[chip('★ '+avg,coral,white)]:[]),life?chip(years.length+'년째',null,white):counts[best]?chip('제일 울창한 달 '+(best+1)+'월',null,ink):null].filter(Boolean);
 let cxs=(W-(chips.reduce((n,c)=>n+c.w,0)+(chips.length-1)*16))/2;
 chips.forEach(c=>{if(c.fill){ctx.fillStyle=c.fill;shareRounded(ctx,cxs,chipY,c.w,68,34);ctx.fill()}else{ctx.strokeStyle=life?'rgba(255,255,255,.5)':'rgba(30,42,34,.2)';ctx.lineWidth=2;shareRounded(ctx,cxs+1,chipY+1,c.w-2,66,33);ctx.stroke()}ctx.fillStyle=c.color;ctx.font='700 32px '+F;ctx.textBaseline='middle';ctx.fillText(c.label,cxs+28,chipY+36);ctx.textBaseline='alphabetic';cxs+=c.w+16});
 ctx.fillStyle=soft;ctx.font='500 30px '+F;ctx.textAlign='left';ctx.fillText('읽고 본 것을 숲으로',72,H-70);ctx.textAlign='right';ctx.fillStyle=fg;ctx.font='800 32px '+L;ctx.fillText(APP_BRAND.en,W-72,H-70);ctx.textAlign='left';
 return canvas;
}
// Year and month cards: white page; the original header (title, big number and 그루를 심었어요 on the
// left, 책/영화 stickers stacked on the right), then the forest with a strip of washi tape, a couple of
// sparkles and stickers slapped on around it.
let shareDecor='visitor';
async function shareDecorate(ctx,W,tx,ty,bandTop,bandH,story){
 const d=shareDecor,sticker=(img,x,y,size,rot)=>{if(!img)return;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore()};
 if(d==='visitor'){ // a forest friend peeking from the island's corner
  const pick=FOREST_VISITORS.filter(v=>collectionState().visitorsSeen.includes(v.id)),v=(pick.at(-1)||FOREST_VISITORS[0]).id;sticker(await shareAsset('./assets/images/forest/sticker/visitor-'+v+'.webp'),tx+10,ty-30,story?190:170,-.12)}
 else if(d==='leaves'){ // a few falling leaves in the app's colours
  const leaf=(x,y,r,rot,c)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.8,0,0,r);ctx.quadraticCurveTo(-r*.8,0,0,-r);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-r*.8);ctx.lineTo(0,r*.8);ctx.stroke();ctx.restore()};
  [[110,bandTop+30,26,.6,'#6CC092'],[180,bandTop-30,18,-.4,'#F2B84B'],[W-120,bandTop+bandH*.45,22,.9,'#E85A47'],[W*.5+250,bandTop-40,16,-.8,'#6CC092'],[140,bandTop+bandH*.55,16,1.2,'#F2B84B']].forEach(a=>leaf(...a))}
 else if(d==='doodle'){ // hand-drawn heart and swirl next to the forest
  ctx.save();ctx.strokeStyle='#E85A47';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';const hx=130,hy=bandTop+40,r=34;ctx.beginPath();ctx.moveTo(hx,hy+r*.9);ctx.bezierCurveTo(hx-r*1.6,hy-r*.2,hx-r*.6,hy-r*1.3,hx,hy-r*.4);ctx.bezierCurveTo(hx+r*.6,hy-r*1.3,hx+r*1.6,hy-r*.2,hx,hy+r*.9);ctx.stroke();
  ctx.strokeStyle='#6CC092';ctx.beginPath();for(let a=0;a<Math.PI*3;a+=.2){const rr=6+a*7;ctx.lineTo(W-150+Math.cos(a)*rr,bandTop+bandH*.42+Math.sin(a)*rr)}ctx.stroke();ctx.restore()}
 else if(d==='badge'){ // round "MY FOREST" sticker badge on the island corner
  ctx.save();ctx.translate(tx+20,ty-20);ctx.rotate(-.18);ctx.shadowColor='rgba(30,42,34,.18)';ctx.shadowBlur=18;ctx.shadowOffsetY=8;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,78,0,Math.PI*2);ctx.fill();ctx.shadowColor='transparent';ctx.fillStyle='#CBE4FF';ctx.beginPath();ctx.arc(0,0,68,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1E2A22';ctx.textAlign='center';ctx.font='800 26px Archivo,sans-serif';ctx.fillText('MY',0,-6);ctx.fillText('FOREST',0,24);ctx.textAlign='left';ctx.restore()}
}
async function drawStickerCard(ctx,canvas,W,H,story,name,F,L,kind){
 const isYear=kind==='year',items=isYear?yearForestItems(year,'all'):forestMonthItems(month),done=items.filter(x=>x.completed),books=done.filter(x=>x.type==='book').length,films=done.filter(x=>x.type==='movie').length,m=Number(month.slice(5));
 const ink='#1E2A22',soft='rgba(30,42,34,.55)',muted='#52524F',months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
 ctx.textBaseline='alphabetic';ctx.fillStyle=ink;ctx.font='700 30px '+L;ctx.letterSpacing='4px';ctx.textAlign='left';ctx.fillText('GREW',72,96);ctx.textAlign='right';ctx.fillText(isYear?year+' FOREST':months[m-1]+' '+month.slice(0,4),W-72,96);ctx.letterSpacing='0px';ctx.textAlign='left';
 const top=story?250:200;ctx.fillStyle=ink;ctx.font='700 46px '+F;ctx.fillText(name+'의 '+(isYear?'올해':m+'월')+' 숲',72,top);
 ctx.font='800 '+(story?300:250)+'px '+L;ctx.fillText(String(done.length),60,top+(story?290:240));
 ctx.font='700 56px '+F;ctx.fillText('그루를 심었어요',72,top+(story?390:330));
 sharePill(ctx,'책 ',W-72,top-30,{fill:'#F7E7A1',size:34,bold:books+'권',boldSize:48,rotate:-6,align:'right'});
 sharePill(ctx,'영화 ',W-110,top+90,{fill:'#BFE7CB',size:34,bold:films+'편',boldSize:48,rotate:5,align:'right'});
 const bandTop=top+(story?440:400),bandH=story?980:560;
 let tx=W*.2,ty=bandTop+bandH*.3;
 if(isYear){const scale=Math.min((W-80)/390,bandH/250),oy=bandTop+(bandH-250*scale)/2,ox=(W-390*scale)/2;await shareIsland(ctx,oy,ox,scale,items);const N=Math.max(2,Math.ceil(Math.sqrt(items.length))),BW=Math.min(170,95+N*9),y0=46+(170-BW)/2;tx=ox+(195-BW*.92)*scale;ty=oy+(y0+BW/2-8)*scale}
 else{try{const board=items.map(x=>({...x,forestTile:''})),svg=await inlineSvgImages(shareCropSVG(selfContainedForestSVG(forestSVG(board,'basic',false,{preview:true,transient:true,grid:'month'})))),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const img=await loadImage(url),iw=img.naturalWidth||720,ih=img.naturalHeight||540,sc=Math.min((W+60)/iw,bandH/ih);const ix=(W-iw*sc)/2,iy=bandTop+(bandH-ih*sc)/2;ctx.drawImage(img,ix,iy,iw*sc,ih*sc);tx=ix+iw*sc*.12;ty=iy+ih*sc*.4}finally{URL.revokeObjectURL(url)}}catch{}}
 // decoration around the island (shareDecor): sparkles always, plus one extra touch
 const spark=(x,y,r,c)=>{ctx.save();ctx.translate(x,y);ctx.fillStyle=c;ctx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=k%2?r*.3:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.fill();ctx.restore()};
 spark(W-150,bandTop-10,20,'#F2B84B');spark(W-210,bandTop+50,13,'#E85A47');
 await shareDecorate(ctx,W,tx,ty,bandTop,bandH,story);
 const rated=done.filter(x=>validRating(x.rating)),avg=rated.length?(rated.reduce((n,x)=>n+Number(x.rating),0)/rated.length).toFixed(1):'';
 if(avg)sharePill(ctx,'★ '+avg+'  평균 별점',W-72,bandTop+bandH-(story?150:120),{fill:'#E85A47',color:'#fff',size:34,rotate:6,align:'right'});
 if(isYear){const byMonth=Array.from({length:12},(_,i)=>done.filter(x=>x.completed.slice(5,7)===String(i+1).padStart(2,'0')).length),best=byMonth.indexOf(Math.max(...byMonth));
  if(done.length)sharePill(ctx,'제일 울창한 달 ',72,bandTop+bandH-(story?40:10),{size:30,bold:(best+1)+'월 · '+byMonth[best]+'그루',boldSize:40,rotate:-4})}
 else{const days=new Set(state.items.flatMap(x=>x.logs.map(l=>l.date)).filter(d=>d.startsWith(month))).size;if(!days){const cnt={};done.forEach(x=>{const g=cleanGenreValue(x.genre)?launchGenre(x.type,x.genre,x):'';if(g&&g!=='기타')cnt[g]=(cnt[g]||0)+1});const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];if(top)sharePill(ctx,'이달의 장르 ',72,bandTop+bandH-(story?60:30),{fill:'#CBE4FF',size:30,bold:top[0],boldSize:42,rotate:-5})}
 else sharePill(ctx,'기록한 날 ',72,bandTop+bandH-(story?60:30),{fill:'#1E2A22',color:'#fff',size:32,bold:days+'일',boldSize:44,rotate:-5})}
 ctx.fillStyle=muted;ctx.font='500 30px '+F;ctx.textAlign='left';ctx.fillText('읽고 본 것을 숲으로',72,H-70);ctx.textAlign='right';ctx.fillStyle=ink;ctx.font='800 32px '+L;ctx.fillText(APP_BRAND.en,W-72,H-70);ctx.textAlign='left';
 return canvas;
}
// Crop the scene to the board itself so a small month forest still fills the card.
function shareCropSVG(markup){
 const host=document.createElement('div');host.style.cssText='position:absolute;left:-9999px;top:0;width:720px;height:540px;visibility:hidden';host.innerHTML=markup;document.body.appendChild(host);
 try{const svg=host.querySelector('svg'),world=svg?.querySelector('#forest-world')||svg;const b=world.getBBox(),pad=16;if(b.width&&b.height)return markup.replace(/viewBox="[^"]*"/,'viewBox="'+[b.x-pad,b.y-pad,b.width+pad*2,b.height+pad*2].map(n=>n.toFixed(1)).join(' ')+'"')}catch{}finally{host.remove()}
 return markup;
}
function shareTitle(){return shareKind==='month'?Number(month.slice(5))+'월의 숲 공유':forestLifetime?forestLifetimeName()+' 공유':'올해의 숲 공유'}
async function makeShare(kind=shareKind,target=shareTarget){
 shareKind=kind==='forest'?'year':kind;shareTarget=target||'';
 const generation=++shareGeneration,current=()=>generation===shareGeneration&&modal==='share';
 shareRevision=shareSnapshot();shareBlob=null;
 const formats='<div class="share-formats" role="group" aria-label="이미지 형식">'+[['story','스토리','9:16'],['feed','피드','4:5']].map(([id,l,r])=>button('<i class="share-format-icon is-'+id+'" aria-hidden="true"></i><span><strong>'+l+'</strong><small>'+r+'</small></span>','shareFormat',shareFormat===id?'active':'','data-format="'+id+'" aria-pressed="'+(shareFormat===id)+'"')).join('')+'</div>';
 const actions='<div class="share-actions">'+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>이미지 저장','saveImage','share-save')+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>공유하기','nativeShare','share-go')+'</div>';
 showModal(shareTitle(),'<div class="share-preview is-'+shareFormat+'"><p class="muted">이미지를 준비하고 있어요…</p></div>'+formats+actions,'share');
 try{
  const canvas=await drawShareCard(shareKind,shareFormat,shareTarget);if(!current())return;
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error()),'image/png'));if(!current())return;
  shareBlob=blob;if(shareURL)URL.revokeObjectURL(shareURL);shareURL=URL.createObjectURL(shareBlob);
  const box=document.querySelector('.share-preview');if(box)box.innerHTML='<img src="'+shareURL+'" alt="'+esc(shareTitle())+' 이미지">';
 }catch(e){const box=document.querySelector('.share-preview');if(current()&&box)box.innerHTML='<p class="muted">이미지를 만들지 못했어요.</p>'+button('다시 시도','retryShare','textbtn')}
}
function shareFileName(){return 'grew-'+(shareKind==='year'?year:month)+'-'+shareFormat+'.png'}
function shareFresh(){return shareRevision===shareSnapshot()}
async function nativeShare(){
 if(!shareFresh()){await makeShare(shareKind);toast('최신 기록으로 이미지를 갱신했어요.');return}
 if(!shareBlob)return;
 const file=new File([shareBlob],shareFileName(),{type:'image/png'});
 if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'나의 '+APP_BRAND.ko})}catch(e){if(e.name!=='AbortError')toast('공유하지 못했어요. 이미지 저장을 이용해주세요.')}}
 else toast('이 브라우저에서는 이미지 저장 후 공유해주세요.');
}
function exportBackup(){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'grew-backup-'+now()+'.json');toast('백업 파일을 다운로드했어요.')}
function replaceData(s){state=s;ensureCompletedSpeciesAssignments();if(!persist())return;year=now().slice(0,4);month=now().slice(0,7);zoomState={scale:1,x:0,y:0};forestViewportYear=null;closeModal();view='today';render();scrollPageTop()}
// Automatic deletion of records based on source labels was retired.
setTimeout(()=>repairMissingBookGenres(36),1200);
async function resetAll(){
 photoFiles=[];candidates=[];ocrGeneration++;undoAction=null;clearTimeout(toastTimer);$('toast').innerHTML='';
 state=Model.empty();state.profile.name=authSession.name||'나';state.onboarded=authSession.finished===true;
 if(!persist())return;
 await cloudUpsertState();
 view='today';closeModal();render();toast('모든 스크랩과 기록을 삭제했어요.');
}
function inlinePicker(label,kind,options,value){return '<div class="inline-picker">'+button(esc(label)+' ▾','inlinePicker',kind==='sort'?'sort-button':'textbtn','data-picker="'+kind+'" aria-expanded="false" aria-controls="picker-'+kind+'"')+'<div id="picker-'+kind+'" class="inline-picker-panel '+(kind==='year'?'year-picker':'')+'" role="group" aria-label="'+(kind==='year'?'연도 선택':'정렬')+'" hidden>'+options.map(([key,text])=>button('<span>'+esc(text)+'</span><span aria-hidden="true">'+(key===value?'✓':'')+'</span>',kind==='year'?'year':'inlineSort','','data-'+(kind==='year'?'year':'value')+'="'+esc(key)+'" aria-pressed="'+(key===value)+'"')).join('')+'</div></div>'}
function closeInlinePickers(){document.querySelectorAll('.inline-picker').forEach(el=>{el.querySelector('button').setAttribute('aria-expanded','false');el.querySelector('.inline-picker-panel').hidden=true})}
function toggleInlinePicker(b){const opening=b.getAttribute('aria-expanded')!=='true';closeInlinePickers();if(opening){b.setAttribute('aria-expanded','true');document.getElementById(b.getAttribute('aria-controls')).hidden=false}}
document.addEventListener('click',e=>{if(!e.target.closest('.inline-picker'))closeInlinePickers()});
document.addEventListener('keydown',e=>{const panel=e.target.closest('.inline-picker');if(!panel)return;const trigger=panel.querySelector('button');if(e.key==='Escape'){closeInlinePickers();trigger.focus();e.preventDefault()}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(trigger.getAttribute('aria-expanded')!=='true')toggleInlinePicker(trigger);const buttons=[...panel.querySelectorAll('.inline-picker-panel button')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}});
document.addEventListener('focusin',e=>{if(!e.target.closest('.inline-picker'))closeInlinePickers()});
function editCompletion(id){
 const c=get(id);showModal('완료일 수정','<form id="completionForm" data-id="'+id+'"><label for="completionDate">완료 날짜</label><input id="completionDate" type="date" max="'+now()+'" value="'+(c.completed==='unknown'?'':c.completed)+'" required><p class="creator">해당 날짜의 숲과 달력에 반영돼요.</p><div id="formError" class="form-error" role="alert"></div><button type="submit" class="primary">수정 저장</button></form>','completion');
}
