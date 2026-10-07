/* original script block 20 */
// Onboarding and recommendation UI; account authentication is handled by cloudAuth functions.
const AUTH_KEY='songrim.ux-session.v1';

let discoveryType='all',discoveryOffset=0,discoveryShown=[];
function seriesPart(c){
 if(c.type!=='book')return null;
 const match=String(c.title).normalize('NFKC').trim().match(/^(.+?[^\d\s])\s*(?:제\s*)?([1-9]\d?)(?:\s*권)?$/);
 if(!match)return null;
 return {key:Model.norm(match[1])+':'+Model.norm(c.creator),volume:Number(match[2])};
}
function orderSeries(pool){
 const groups=new Map();
 pool.forEach((c,index)=>{const part=seriesPart(c);if(!part)return;if(!groups.has(part.key))groups.set(part.key,[]);groups.get(part.key).push({c,index,volume:part.volume})});
 for(const entries of groups.values()){if(entries.length<2)continue;const sorted=[...entries].sort((a,b)=>a.volume-b.volume);entries.forEach((entry,i)=>{pool[entry.index]=sorted[i].c})}
 return pool;
}
function discoveryCatalog(){const seen=new Set();return [...CATALOG,...SEED_BOOKS.map(b=>({type:'book',title:b.title,creator:b.creator,genre:b.genre}))].filter(c=>{if(!allowDiscoveryCandidate(c))return false;const key=c.type+':'+Model.norm(c.title)+':'+Model.norm(c.creator);if(seen.has(key))return false;seen.add(key);return true})}
function renderDiscovery(){
 const completed=state.items.filter(c=>c.completed),known=discoveryCatalog();
 if(!known.length)return '<section>'+todayHeading()+'<div class="empty"><h2>'+(completed.length?'담아둔 작품을 모두 완료했어요':'작품을 추가해보세요')+'</h2>'+button('새로운 작품 추천받기','tastes')+button('직접 스크랩하기','add','textbtn')+'</div></section>';
 const refs=[...completed,...known.filter(c=>['experienced','interested'].includes(state.profile.responses?.[c.type+':'+c.title]))];
 const pool=known.filter(c=>(discoveryType==='all'||c.type===discoveryType)&&!isTasteCandidateSaved(c)&&!hasTasteHistory(c));
 const score=c=>refs.reduce((n,x)=>n+(x.type===c.type?1:0)+(c.genre&&x.genre===c.genre?3:0),0);
 pool.sort((a,b)=>score(b)-score(a));orderSeries(pool);if(discoveryOffset>=pool.length)discoveryOffset=0;discoveryShown=pool.slice(discoveryOffset,discoveryOffset+3);
 return '<section>'+todayHeading()+'<div class="space"></div><p class="creator">'+(completed.length?'모아둔 콘텐츠를 모두 경험했어요':'첫 관심을 모아보세요')+'</p><h2 class="section-title">다음에는 무엇이 궁금하세요?</h2><p class="creator">'+(refs.length?'지난 경험과 비슷한 유형·장르의 작품을 골라봤어요.':'책과 영화 중 관심 있는 것을 골라보세요.')+'</p><div class="chips">'+[['all','전체'],['book','책'],['movie','영화']].map(([id,label])=>button(label,'discoveryType','chip '+(discoveryType===id?'active':''),'data-type="'+id+'"')).join('')+'</div><div class="stack">'+discoveryShown.map((c,i)=>'<div class="card"><div class="row">'+cover(c)+'<div class="grow"><small>'+typeName[c.type]+'</small><h3>'+esc(c.title)+'</h3><p class="creator">'+esc(c.creator)+'</p></div></div><div class="space"></div>'+button('보고 싶어요','discoverySave','secondary','data-index="'+i+'"')+'</div>').join('')+'</div>'+(pool.length>3?button('다른 후보 3개 보기','discoveryMore','textbtn'):'')+(!pool.length?'<p class="creator">이 유형의 준비된 후보를 모두 살펴봤어요. 다른 유형을 고르거나 직접 스크랩해보세요.</p>':'')+button('직접 스크랩하기','add','secondary')+'</section>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='discoveryType'){if(!['all','book','movie'].includes(b.dataset.type))return;discoveryType=b.dataset.type;discoveryOffset=0;render()}
 if(a==='discoveryMore'){discoveryOffset+=3;render()}
 if(a==='discoverySave'){const candidate=discoveryShown[Number(b.dataset.index)];if(candidate&&['book','movie'].includes(candidate.type)){const id=Model.uid(),c=Model.add(state,candidate,id);saved(c,id)}}
});
let authSession={signedIn:false,finished:false},authRoute='welcome',tasteIndex=0,tasteOrigin='my',tasteOriginScroll=0,tastePool=[],tasteSeen=0,tasteReviewed=0,tasteMode='initial',tastePreferredType='book',flowCodeSent=false;
const INITIAL_TASTE_TARGET=5;
try{const a=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');if(a&&typeof a==='object')authSession={signedIn:a.signedIn===true,finished:a.finished===true,name:String(a.name||''),method:String(a.method||'이메일')};}catch{}
authRoute=authSession.signedIn?(authSession.finished?'app':'onboard'):'welcome';
function saveSession(){try{localStorage.setItem(AUTH_KEY,JSON.stringify(authSession))}catch{toast('로그인 상태를 저장하지 못했어요.')}}
function flowTo(route){closeModal();authRoute=route;render();scrollPageTop();if(route==='tasteType')void loadMusicClassicCatalog();focusPageHeading()}
function entrySteps(n){return '<div class="entry-steps" aria-label="3단계 중 '+n+'단계">'+[1,2,3].map(i=>'<span class="'+(i<=n?'on':'')+'"></span>').join('')+'</div>'}
function entryNote(){return cloudPublicKey()?'':'<div class="entry-note">'+button('연결 설정','cloudSetup','textbtn')+'</div>'}
function loginFields(){
 let lastEmail='';try{lastEmail=localStorage.getItem(CLOUD_LAST_EMAIL_STORAGE)||''}catch{}
 return '<label for="flowEmail">이메일</label><input id="flowEmail" type="email" required autocomplete="email" value="'+esc(lastEmail)+'" placeholder="you@example.com"><label for="flowPassword">비밀번호</label><input id="flowPassword" type="password" required minlength="6" autocomplete="current-password" placeholder="6자 이상">'
}

let introductionStep=0,introFirstRun=false;
// The intro opens by itself once per device; afterwards it stays behind the welcome link.
const INTRO_SEEN_KEY='grew.intro-seen.v1';
function introSeen(){try{return localStorage.getItem(INTRO_SEEN_KEY)==='1'}catch{return true}}
function markIntroSeen(){try{localStorage.setItem(INTRO_SEEN_KEY,'1')}catch{}}
// Small sticker forest shared by the welcome and ready screens.
function entryStickerArt(label='책과 영화로 자라난 작은 숲'){
 if(!window.INTRO_LIVE_ART)return '<div class="entry-sticker-art" role="img" aria-label="'+esc(label)+'"><img class="entry-art" src="./assets/images/onboarding/welcome.webp?v=1" alt="" decoding="async"></div>';
 return '<div class="entry-sticker-art" role="img" aria-label="'+esc(label)+'">'+
 introSticker('trees/cherry.webp','left:4%;top:18px;width:46%;transform:rotate(-4deg)')+
 introSticker('trees/oak.webp','right:2%;top:0;width:54%;transform:rotate(3deg)')+
 introSticker('trees/sprout.webp','left:38%;top:132px;width:28%;transform:rotate(-6deg)')+
 introVisitor('rabbit','right:6%;top:150px;width:96px;height:96px;transform:rotate(4deg)')+
 introSticker('forest/decor-flower-peach.webp','left:6%;top:170px;width:56px;transform:rotate(8deg)')+'</div>';
}
// Intro slides (redesign 5a): cut-out stickers on a coloured page, one big title, one action.
const INTRO_STAR4='polygon(50% 0,59% 41%,100% 50%,59% 59%,50% 100%,41% 59%,0 50%,41% 41%)';
function introStar(points,inner){const pts=[];for(let i=0;i<points*2;i++){const r=i%2?inner:50,a=Math.PI*i/points-Math.PI/2;pts.push((50+r*Math.cos(a)).toFixed(1)+'% '+(50+r*Math.sin(a)).toFixed(1)+'%')}return 'polygon('+pts.join(',')+')'}
// Generic book and film covers for the intro cards, drawn in the sticker palette.
const INTRO_BOOK_ART='<svg viewBox="0 0 108 130" aria-hidden="true"><defs><clipPath id="introBookCover"><rect x="14" y="8" width="72" height="108" rx="6"/></clipPath></defs><rect x="22" y="13" width="70" height="106" rx="5" fill="#FFFDF6" stroke="#E8E3D6"/><path d="M88 22v88M91 26v80" stroke="#E8E3D6" stroke-width="1.5"/><g clip-path="url(#introBookCover)"><rect x="14" y="8" width="72" height="108" fill="#CDBDF2"/><circle cx="64" cy="58" r="10" fill="#E85A47"/><path d="M14 96Q34 74 52 88T86 82V116H14Z" fill="#B9E0C2"/><path d="M14 104Q42 90 86 104V116H14Z" fill="#9FD0AA"/><rect x="14" y="8" width="11" height="108" fill="#B4A0E6"/></g><rect x="34" y="22" width="38" height="5" rx="2.5" fill="#1E2A22"/><rect x="34" y="31" width="24" height="4" rx="2" fill="#1E2A22" opacity=".45"/><path d="M72 8v20l4-3.5 4 3.5V8z" fill="#1E2A22"/></svg>';
const INTRO_MOVIE_ART='<svg viewBox="0 0 108 130" aria-hidden="true"><g transform="rotate(-9 16 32)"><rect x="14" y="16" width="80" height="15" rx="3" fill="#1E2A22"/><path d="M24 16h10l-7 15H17zM44 16h10l-7 15H37zM64 16h10l-7 15H57zM84 16h10l-7 15H77z" fill="#FAF7F0"/></g><rect x="14" y="34" width="80" height="80" rx="7" fill="#1E2A22"/><rect x="22" y="42" width="64" height="44" rx="4" fill="#F4E3A0"/><circle cx="54" cy="64" r="13" fill="#FAF7F0"/><path d="M50 57.5 61 64l-11 6.5z" fill="#1E2A22"/><rect x="22" y="94" width="40" height="5" rx="2.5" fill="#FAF7F0" opacity=".85"/><rect x="22" y="103" width="24" height="4" rx="2" fill="#FAF7F0" opacity=".45"/><circle cx="80" cy="100" r="5" fill="#E85A47"/></svg>';
function introSticker(src,style){return '<img class="intro-cut" src="./assets/images/'+src+'" alt="" style="'+style+'">'}
function introVisitor(id,style){return '<i class="intro-cut intro-visitor" style="background-image:url(./assets/images/forest/visitor-'+id+'.webp);'+style+'"></i>'}
const INTRO_CHECK=(size,w=3.4)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const introSpark=(x,y,size,color,rot=0,cls='')=>'<i'+(cls?' class="'+cls+'"':'')+' style="left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;background:'+color+';clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);transform:rotate('+rot+'deg)"></i>';
const introBurst=(x,y,size,color,points,inner,rot=0,extra='')=>'<i style="left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;background:'+color+';clip-path:'+introStar(points,inner)+';transform:rotate('+rot+'deg);'+extra+'"></i>';
const introRing=(x,y,size,color)=>'<i class="intro-ring" style="left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;border-color:'+color+'"></i>';
// A small, full forest for the third slide: the forest tab's ground with trees on shuffled cells.
function introBoardHTML(){
 const ground=stickerGroundArtwork({boardW:290,boardH:121},195,178.5),cell=(u,v)=>({x:195+(u-v)*37.8,y:102.9+(u+v)*18.9});
 const plants=[['trees/maple.webp',62],['trees/cherry.webp',60],['trees/ginkgo.webp',58],['trees/oak.webp',62],['trees/birch.webp',56],['trees/young.webp',50],['trees/sprout.webp',36],['trees/maple.webp',58],['trees/sprout.webp',34],['trees/cherry.webp',56],['trees/oak.webp',58],['trees/ginkgo.webp',54],['forest/decor-flower-lilac.webp',26],['forest/decor-flower-peach.webp',26]];
 // Hand-placed checkerboard so the baked picture reads as a full, even little forest.
 const cells=[[0,0],[2,0],[4,0],[1,1],[3,1],[0,2],[4,2],[1,3],[3,3],[0,4],[2,4],[4,4],[1,2],[3,2],[2,2]].map(([u,v])=>u+v*5);
 const placed=plants.map(([src,base],k)=>{const size=Math.round(base*1.4);const c=cells[k],p=cell(c%5,Math.floor(c/5));return {src,size,x:p.x+(hash('ix'+k)%7-3),y:p.y+(hash('iy'+k)%5-2)}});
 const rabbit=cell(cells[plants.length]%5,Math.floor(cells[plants.length]/5));
 const items=[...placed.map(t=>({y:t.y,html:'<img class="intro-cut" src="./assets/images/'+t.src+'" alt="" style="left:'+(t.x-t.size/2).toFixed(1)+'px;top:'+(t.y-t.size*.9).toFixed(1)+'px;width:'+t.size+'px;height:'+t.size+'px;filter:none">'})),{y:rabbit.y,html:introVisitor('rabbit','left:'+(rabbit.x-24).toFixed(1)+'px;top:'+(rabbit.y-42).toFixed(1)+'px;width:48px;height:48px;filter:none')}].sort((a,b)=>a.y-b.y);
 return '<svg class="intro-board" viewBox="0 0 390 340" aria-hidden="true"><defs>'+ground.defs+'</defs>'+ground.body+'</svg>'+items.map(t=>t.html).join('');
}
const INTRO_SLIDES=[
 {title:'마음에 든 작품,<br>가볍게 <mark style="--tilt:-2deg">스크랩.</mark>',copy:'읽고 싶은 책, 보고 싶은 영화를 한곳에 담아요.',label:'책과 영화 카드, 씨앗, 다람쥐 스티커',
  shapes:introBurst(130,66,290,'#F6E7A8',16,40,8)+introBurst(-50,336,170,'rgba(255,255,255,.28)',12,37,-10)+introSpark(20,64,24,'#1E2A22')+introSpark(340,86,18,'#E85A47',15)+introSpark(336,446,28,'#1E2A22',10,'intro-low')+introSpark(14,466,16,'#fff',0,'intro-low')+introRing(-20,96,88,'rgba(30,42,34,.55)')+introRing(300,366,64,'rgba(255,255,255,.9)'),
  art:()=>'<div class="intro-card" style="left:40px;top:62px;background:#F9D9C8;transform:rotate(-10deg)"><span>BOOK</span>'+INTRO_BOOK_ART+'</div><div class="intro-card" style="left:198px;top:96px;background:#C5E8CE;transform:rotate(8deg)"><span>MOVIE</span>'+INTRO_MOVIE_ART+'</div>'+
   introVisitor('squirrel','left:6px;top:292px;width:146px;height:146px;transform:rotate(-5deg)')+introSticker('trees/seed.webp','left:152px;top:312px;width:120px;height:120px;transform:rotate(7deg)')+introSticker('forest/decor-flower-peach.webp','left:276px;top:328px;width:78px;height:78px;transform:rotate(-12deg)'),
  overlay:'<span class="intro-chip" style="left:126px;top:30px;background:#1E2A22;color:#fff;transform:rotate(-7deg)">+ 스크랩</span>'},
 {title:'하루 한 번,<br>도장 <mark class="is-ink" style="--tilt:3deg">쾅!</mark>',copy:'담아둔 작품 하나를 골라 오늘 읽었다고 찍어요.',label:'새싹, 오늘 읽었어요 도장, 이번 주 도장 스티커와 토끼',
  shapes:introBurst(150,62,270,'rgba(255,255,255,.45)',20,43)+introBurst(-40,216,150,'#E6DDF8',10,36,12,'opacity:.45')+introSpark(344,256,26,'#1E2A22',0,'intro-low')+introSpark(16,70,18,'#1E2A22',20)+introSpark(262,466,16,'#E85A47',0,'intro-low')+introRing(310,70,64,'rgba(30,42,34,.55)')+introRing(20,446,54,'rgba(255,255,255,.9)'),
  art:()=>introSticker('trees/sprout.webp','left:8px;top:70px;width:196px;height:196px;transform:rotate(-6deg)')+introVisitor('rabbit','left:240px;top:354px;width:122px;height:122px;transform:rotate(7deg)')+introSticker('forest/decor-flower-lilac.webp','left:34px;top:378px;width:70px;height:70px;transform:rotate(-10deg)'),
  overlay:'<div class="intro-stamp" style="left:192px;top:60px"><i class="stamp-ring"></i>'+INTRO_CHECK(36)+'<span>오늘<br>읽었어요</span></div>'+
   '<span class="intro-chip" style="left:30px;top:40px;background:#fff;transform:rotate(-6deg)">하루 한 번</span>'+
   '<div class="intro-week">'+['월','화','수','목','금','토','일'].map((d,i)=>i<2?'<span class="is-done" style="transform:rotate('+(i?6:-8)+'deg)">'+INTRO_CHECK(17)+'</span>':i===2?'<span class="is-today">'+d+'</span>':'<span>'+d+'</span>').join('')+'</div>'},
 {title:'다 읽은 작품이<br>나의 <mark style="--tilt:-3deg;background:#F6E7A8">숲</mark>이 돼요.',copy:'완료한 책과 영화가 달마다 숲에 나무로 남아요.',label:'나무와 새싹이 자라는 숲 판, 여우 스티커',
  shapes:introBurst(40,58,310,'#F6E7A8',24,44,0,'opacity:.9')+introBurst(300,376,110,'rgba(255,255,255,.28)',10,36,18)+introSpark(14,76,22,'#1E2A22')+introSpark(350,96,18,'#fff')+introSpark(10,446,26,'#1E2A22',12,'intro-low')+introSpark(196,64,14,'#E85A47')+introRing(318,66,60,'rgba(30,42,34,.55)'),
  art:()=>'<div class="intro-board-wrap">'+introBoardHTML()+'</div>'+introVisitor('fox','left:250px;top:330px;width:124px;height:124px;transform:rotate(-6deg)')+introSticker('forest/decor-flower-peach.webp','left:14px;top:348px;width:64px;height:64px;transform:rotate(10deg)'),
  overlay:()=>'<span class="intro-chip" style="left:22px;top:44px;background:#F6E7A8;transform:rotate(-8deg);font-size:16px">+1 TREE</span><span class="intro-chip" style="left:226px;top:64px;background:#fff;transform:rotate(6deg)">'+Number(now().slice(5,7))+'월의 숲</span>'}
];
// The sticker art is drawn once and shipped as a picture (assets/images/onboarding); the live
// version (art) is kept only to re-bake it. Set window.INTRO_LIVE_ART=true to see the live one.
const INTRO_ART_PAD=30;
function introArtLayer(step){
 if(window.INTRO_LIVE_ART)return INTRO_SLIDES[step].art();
 if(!introArtLayer.warm){introArtLayer.warm=true;[1,2,3].forEach(n=>{const i=new Image();i.decoding='async';i.src='./assets/images/onboarding/intro-'+n+'.webp?v=1'})}
 return '<img class="intro-art" src="./assets/images/onboarding/intro-'+(step+1)+'.webp?v=1" alt="" decoding="async" style="left:-'+INTRO_ART_PAD+'px;top:-'+INTRO_ART_PAD+'px;width:'+(390+INTRO_ART_PAD*2)+'px">';
}
function renderIntroduction(){
 const step=introductionStep,s=INTRO_SLIDES[step],last=step===2;
 return '<section class="sticker-intro" data-step="'+step+'"><div class="intro-shapes" aria-hidden="true">'+s.shapes+'</div>'+
 '<div class="intro-top"><span class="intro-wordmark">'+esc(APP_BRAND.en)+'</span>'+button('건너뛰기','introSkip','textbtn intro-skip')+'</div>'+
 '<div class="intro-stage" role="img" aria-label="'+esc(s.label)+'">'+introArtLayer(step)+(typeof s.overlay==='function'?s.overlay():s.overlay)+'</div>'+
 '<div class="intro-bottom"><span class="sr-only">3장 중 '+(step+1)+'번째</span><h1>'+s.title+'</h1><p>'+s.copy+'</p><div class="intro-footer"><div class="intro-dots" aria-hidden="true">'+[0,1,2].map(i=>'<i class="'+(i===step?'on':'')+'"></i>').join('')+'</div>'+
 button((last?'시작하기':'다음')+'<span aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>','introNext','intro-next')+'</div></div></section>';
}
function renderEntry(){
 if(authRoute==='welcome'&&!introSeen()){if(!introFirstRun)introductionStep=0;introFirstRun=true;authRoute='intro'}
 $('head').hidden=false;
 $('tabs').hidden=true;$('page').dataset.view=authRoute;document.body.dataset.view=authRoute;$('head').dataset.view=authRoute;$('page').classList.add('entry-page');$('page').classList.toggle('taste-page',authRoute==='taste');$('page').classList.toggle('intro-page',authRoute==='intro');
 $('head').innerHTML=!['welcome','onboard','taste','ready','intro'].includes(authRoute)?'<div class="row">'+button(icon('back'),'flowBack','iconbtn','aria-label="뒤로가기"')+'<span class="back-title">'+esc(APP_BRAND.ko)+'</span></div>':'<div class="brand">'+icon('forest')+esc(APP_BRAND.ko)+'</div>';
 let h='';
 if(authRoute==='welcome')h='<section class="sticker-welcome"><i class="sticker-block" aria-hidden="true"></i><div class="intro-shapes" aria-hidden="true"><i style="right:44px;top:470px;width:24px;height:24px;background:#1E2A22;clip-path:'+INTRO_STAR4+'"></i><i style="left:200px;top:60px;width:18px;height:18px;background:#E85A47;clip-path:'+INTRO_STAR4+'"></i><i class="intro-ring" style="right:28px;top:360px;width:72px;height:72px"></i></div>'+
 '<div class="intro-top"><span class="intro-wordmark">'+esc(APP_BRAND.en)+'</span><span class="welcome-name">'+esc(APP_BRAND.ko)+'</span></div>'+
 '<div class="welcome-stage">'+entryStickerArt()+'<span class="intro-chip" style="left:24px;top:6px;background:#fff;transform:rotate(-7deg)">책</span><span class="intro-chip" style="left:76px;top:0;background:#F4E3A0;transform:rotate(5deg)">영화</span><span class="intro-chip" style="right:18px;top:4px;background:#E85A47;color:#fff;transform:rotate(-5deg)">+1 TREE</span></div>'+
 '<div class="welcome-copy"><h1>읽고, 보고,<br><mark style="--tilt:-2deg;background:#B9E0C2">자라요.</mark></h1><p>'+esc(APP_BRAND.motto)+'</p></div>'+
 '<div class="welcome-actions">'+button('시작하기','flowSignup','primary ink-button')+button('로그인','flowEmailLogin','secondary')+button(esc(APP_BRAND.ko)+' 알아보기 <span aria-hidden="true">↗</span>','introStart','textbtn')+'</div></section>';
 if(authRoute==='intro')h=renderIntroduction();
 if(authRoute==='signupOptions')h='<div class="entry-options-page"><div class="entry-options-title"><div class="entry-options-symbol">'+icon('forest')+'</div><h1>나의 숲을<br>시작해요.</h1><p>이메일로 나만의 숲을 시작해요.</p></div><div class="signup-benefits"><p>'+icon('scrap')+'<span>책과 영화를 한곳에 모아요.</span></p><p>'+icon('forest')+'<span>경험한 작품이 나무로 자라요.</span></p></div><div class="signup-methods">'+button('이메일로 가입하기','flowEmailSignup','primary ink-button')+'</div><p class="entry-login-link">이미 함께하고 있나요? '+button('로그인','flowEmailLogin','textbtn')+'</p></div>';
 if(authRoute==='login')h='<div class="entry-hero"><span class="section-eyebrow">WELCOME BACK</span><h1>다시 만나서<br>반가워요.</h1><p>당신의 숲이 기다리고 있어요.</p></div><form id="flowLoginForm">'+loginFields()+'<div id="flowError" class="entry-error" role="alert"></div><button class="primary ink-button" type="submit">로그인</button></form>'+button('비밀번호를 잊으셨나요?','flowRecover','textbtn')+'<p class="entry-login-link">아직 계정이 없나요? '+button('회원가입','flowSignup','textbtn')+'</p>'+entryNote();
 if(authRoute==='signupSent')h='<div class="entry-hero"><span class="section-eyebrow">CHECK YOUR EMAIL</span><h1>메일을 확인하면<br>숲을 시작할 수 있어요.</h1><p>가입한 이메일로 확인 안내를 보냈어요.<br>메일의 링크를 확인한 뒤 로그인해주세요.</p></div><p class="note">메일이 보이지 않으면 스팸함도 확인해주세요. 이미 가입한 이메일이라면 로그인을 이용해주세요.</p>'+button('로그인으로 이동','flowEmailLogin','primary ink-button');
 if(authRoute==='social')h='<div class="entry-hero"><h1>함께할 준비 중이에요</h1><p>지금은 이메일로 '+esc(APP_BRAND.ko)+'를 시작할 수 있어요.</p></div>'+button('이메일로 가입하기','flowEmailSignup');
 if(authRoute==='signup')h=entrySteps(1)+'<div class="entry-hero"><h1>이메일로<br>가입하기.</h1><p>나만의 취향을 차곡차곡 쌓아보세요.</p></div><form id="flowSignupForm">'+loginFields().replace('autocomplete="current-password"','autocomplete="new-password"')+'<label for="flowPasswordConfirm">비밀번호 확인</label><input id="flowPasswordConfirm" required type="password" minlength="6" autocomplete="new-password" placeholder="비밀번호를 한 번 더 입력해주세요"><label class="checkrow"><input id="flowTerms" type="checkbox" required><span>이용약관 및 개인정보 안내에 동의합니다</span></label>'+button('이용 안내 보기','terms','terms-link')+'<div id="flowError" class="entry-error" role="alert"></div><button class="primary ink-button" type="submit">가입하기</button></form>'+entryNote();
 if(authRoute==='recover')h='<div class="entry-hero"><h1>비밀번호를<br>잊으셨나요?</h1><p>가입한 이메일로 재설정 안내를 보내드려요.</p><p class="entry-error">'+esc(passwordRecoveryError)+'</p></div><form id="flowRecoverForm"><label for="recoveryEmail">이메일</label><input id="recoveryEmail" type="email" required autocomplete="email" placeholder="you@example.com"><div id="flowError" class="entry-error" role="alert"></div><button class="primary" type="submit">재설정 안내 받기</button></form>'+entryNote();
 if(authRoute==='recoverSent')h='<div class="entry-hero"><h1>메일을<br>확인해주세요.</h1><p>메일에서 재설정 링크를 확인해주세요.</p></div>'+(location.protocol==='file:'?'<p class="creator">로컬 파일에서는 링크를 열기 전에 주소를 복사해 아래에 붙여넣어주세요.</p><form id="flowRecoveryLinkForm"><label for="recoveryLink">재설정 메일의 링크</label><input id="recoveryLink" type="password" autocomplete="off" required><div id="flowError" class="entry-error" role="alert"></div><button class="primary" type="submit">재설정 계속하기</button></form>':'')+button('새 메일 받기','flowRecover','textbtn')+button('로그인으로 돌아가기','flowEmailLogin','textbtn');
 if(authRoute==='resetPassword')h='<div class="entry-hero"><h1>새 비밀번호를<br>정해주세요.</h1><p>'+esc(passwordRecoveryEmail)+'</p></div><form id="flowResetPasswordForm"><label for="newPassword">새 비밀번호</label><input id="newPassword" type="password" required minlength="6" autocomplete="new-password"><label for="newPasswordConfirm">새 비밀번호 확인</label><input id="newPasswordConfirm" type="password" required minlength="6" autocomplete="new-password"><div id="flowError" class="entry-error" role="alert"></div><button class="primary ink-button" type="submit">비밀번호 변경</button></form>'+button('새 메일 받기','flowRecover','textbtn');
 if(authRoute==='profile')h=entrySteps(2)+'<div class="entry-hero"><h1>숲의 주인은<br>누구인가요?</h1><p>'+esc(APP_BRAND.ko)+'에서 사용할 이름을 알려주세요.</p></div><div class="profile-onboard-art">'+icon('my')+'</div><form id="flowProfileForm"><label for="flowProfileName">이름 또는 별명</label><input id="flowProfileName" maxlength="30" value="'+esc(authSession.name||(state.profile.name==='나'?'':state.profile.name))+'" placeholder="어떻게 불러드릴까요?"><p class="creator">이름은 나중에도 바꿀 수 있어요.</p><button class="primary ink-button" type="submit">다음</button></form>';
 if(authRoute==='start')h=entrySteps(3)+'<div class="entry-hero"><h1>어떤 작품부터<br>담아볼까요?</h1><p>작은 관심 하나로 시작하면 돼요.</p></div><div class="start-options">'+button(icon('plus')+'<span class="option-arrow" aria-hidden="true">↗</span><strong>직접 스크랩하기</strong><small>찾고, 공유하고, 사진으로 가져와요.</small>','flowFirstScrap','start-option')+button(icon('book')+'<span class="option-arrow" aria-hidden="true">↗</span><strong>추천으로 시작하기</strong><small>작품 5개를 살펴보며 취향을 찾아요.</small>','flowOptionalTaste','start-option')+'</div>';
 if(authRoute==='tasteType'){const adding=tasteMode==='add';h=(adding?'':entrySteps(3))+'<div class="entry-hero"><h1>지금 마음이 가는<br>분야는 뭔가요?</h1><p>선택한 분야의 작품을 보여드릴게요.</p></div><div class="taste-type-grid">'+[['book','책','새로운 페이지를 넘기는 시간'],['movie','영화','또 다른 세계를 만나는 시간']].map(([type,label,desc])=>button(icon(type)+'<span class="grow">'+label+'<small>'+desc+'</small></span><span aria-hidden="true">↗</span>','chooseTasteType','taste-type-option','data-type="'+type+'"')).join('')+'</div>';}
 if(authRoute==='onboard')h=entrySteps(3)+'<div class="entry-hero"><h1>'+esc(state.profile.name)+'님,<br>어떤 걸 좋아하세요?</h1><p>관심 있는 작품이나 이미 본 작품을 추가해보세요.</p></div>'+button('직접 고르기','flowTaste')+button('저장해 둔 스크린샷 가져오기','photoAdd','secondary')+'<div class="flow-account"><strong>지금 모인 콘텐츠 '+state.items.length+'개</strong><small>가져온 콘텐츠는 스크랩에서 이어서 볼 수 있어요.</small></div>'+button(state.items.length?'이 콘텐츠로 시작하기':'취향 선택은 나중에 할게요','flowReady','textbtn');
 if(authRoute==='taste')h=renderTastePage();
 if(authRoute==='ready')h='<div class="entry-hero center"><h1>취향이 자랄<br>준비가 됐어요.</h1><p>이제 하나씩, 나의 속도로 경험해요.</p></div>'+entryStickerArt()+'<div class="entry-bottom">'+button('나의 '+esc(APP_BRAND.ko)+' 시작하기','flowFinish','primary ink-button')+'</div>';
 $('page').innerHTML=h;
 if(['intro','welcome'].includes(authRoute)){$('head').hidden=true;$('head').innerHTML='';requestAnimationFrame(scrollPageTop)}
 if(authRoute==='taste')$('head').innerHTML=tasteMode==='add'?'<div class="back-title">취향 추가</div>'+button('닫기','tasteClose','textbtn taste-exit'):'<div class="brand">'+esc(APP_BRAND.ko)+'</div>'+button('그냥 시작하기','flowFinish','textbtn taste-exit');
 if(authRoute==='tasteType'&&tasteMode==='add')$('head').innerHTML='<div class="back-title">취향 추가</div>'+button('닫기','tasteClose','textbtn taste-exit');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
 if(b.dataset.action==='introStart'){introductionStep=0;introFirstRun=false;flowTo('intro')}
 if(b.dataset.action==='introNext'){if(introductionStep<2){introductionStep++;flowTo('intro')}else{markIntroSeen();flowTo(introFirstRun?'welcome':'signupOptions')}}
 if(b.dataset.action==='introSkip'){markIntroSeen();flowTo(introFirstRun?'welcome':'signupOptions')}
 if(b.dataset.action==='flowEmailSignup'){flowCodeSent=false;flowTo('signup')}
});

function signedIn(method){authSession.signedIn=true;authSession.method=method;saveSession();flowTo(authSession.finished?'app':'profile')}
function tasteStart(){
 tasteOrigin=view;tasteOriginScroll=window.scrollY;
 // MY > 취향 추가도 유형을 먼저 고른 뒤 그 유형의 후보만 보여준다.
 const owner=cloudSession?.user?.id||'local';
 if(tasteOwner!==owner)tasteShownKeys=new Set();
 tasteOwner=owner;tasteMode='add';tastePreferredType='';
 tasteQueryDecks={};tasteExploreDecks={};tasteUsedQueries=new Set();
 for(const type of ['book','movie']){
  tasteQueryDecks[type]=[...TASTE_QUERIES[type]];tasteExploreDecks[type]=[];
  TASTE_EXPLORE[type].forEach(query=>enqueueTasteQuery(type,query));
 }
 tasteActiveCandidate=null;
 tasteRequest++;tasteLoading=false;tastePool=[];tasteIndex=0;tasteSeen=0;tasteReviewed=0;window.tasteCandidate=null;
 flowTo('tasteType');
}
function closeAdditionalTaste(){tasteRequest++;tasteLoading=false;window.tasteCandidate=null;authRoute='app';view=tasteOrigin||'my';render();requestAnimationFrame(()=>window.scrollTo(0,tasteOriginScroll||0))}
// Search prompts bootstrap discovery; no personal preference or local catalog is required.
const TASTE_QUERIES={
 book:[],
 album:[],
 movie:[]
};
const TASTE_EXPLORE={
 book:['소설','한국소설','세계문학','SF 소설','추리 소설','판타지 소설','에세이','철학','심리','과학','우주','역사','사회','예술','여행','사랑','인생','마음'],
 album:[],
 movie:['드라마','SF','판타지','액션','스릴러','미스터리','범죄','로맨스','코미디','애니메이션','가족','모험','역사','음악 영화','다큐멘터리','시간 여행','우주','성장']
};
let tasteLoading=false,tasteNotice='',tasteRequest=0,tasteOwner=null;
let tasteActiveCandidate=null;
let tasteShownKeys=new Set(),tasteQueryDecks={},tasteExploreDecks={},tasteUsedQueries=new Set();
function enqueueTasteQuery(type,query){
 const key=type+':'+Model.norm(query);
 if(!Model.norm(query)||tasteUsedQueries.has(key))return;
 tasteUsedQueries.add(key);tasteExploreDecks[type].push(query);
}
function tasteKeys(c){
 const keys=[c.type+':text:'+Model.norm(c.title)+':'+Model.norm(c.creator)];
 if(c.recommendationKey)keys.push(c.recommendationKey);
 const providerId=String(c.providerId??c.provider_id??'').trim();
 if(providerId)keys.push(c.type+':id:'+(c.provider||'')+':'+providerId);
 if(c.type==='book'){
  const isbns=String(c.isbn||'').replace(/-/g,'').match(/(?:97[89]\d{10}|\d{9}[\dXx])/g)||[];
  isbns.forEach(isbn=>keys.push('book:isbn:'+isbn.toUpperCase()));
 }
 return keys;
}
function isTasteCandidateSaved(c){
 const keys=new Set(tasteKeys(c));
 return state.items.some(item=>tasteKeys(item).some(key=>keys.has(key)));
}
function hasTasteHistory(c){
 const history=new Set(state.profile.recommendationHistory||[]);
 return tasteKeys(c).some(key=>history.has(key))||!!state.profile.responses?.[c.type+':'+c.title];
}
function rememberTasteCandidate(c){
 const history=new Set(state.profile.recommendationHistory||[]),before=history.size;
 tasteKeys(c).forEach(key=>history.add(key));
 if(history.size!==before){state.profile.recommendationHistory=[...history];persist()}
}
function freshTasteCandidates(candidates){
 const excluded=new Set([...tasteShownKeys,...(state.profile.recommendationHistory||[])]);
 [...state.items,...tastePool.slice(tasteIndex)].forEach(c=>{
  tasteKeys(c).forEach(key=>excluded.add(key));
 });
 return candidates.filter(c=>{
  if(!c?.title||!['book','movie'].includes(c.type)||state.profile.responses?.[c.type+':'+c.title])return false;
  if(!allowDiscoveryCandidate(c))return false;
  const keys=tasteKeys(c);
  if(keys.some(key=>excluded.has(key)))return false;
  keys.forEach(key=>excluded.add(key));return true;
 });
}

function tasteSignalCount(type){
 const responses=state.profile?.responses||{};
 let count=Object.keys(responses).filter(k=>k.startsWith(type+':')&&['interested','experienced'].includes(responses[k])).length;
 count+=state.items.filter(c=>c.type===type&&(c.completed||c.saves?.length)).length*.35;
 return count;
}
function tastePopularityScore(c){
 const pop=Math.max(0,Number(c?.searchPopularity)||0),rating=Math.max(0,Number(c?.averageRating)||0),votes=Math.max(0,Number(c?.voteCount)||0);
 let score=0;
 if(c.type==='book'){
  score=Math.max(score,.18+bookPublisherTrust(c)*.22+bookEditionTrust(c)*.16);

  const yesPop=Math.max(0,Number(c?.yes24PopularityScore)||0);
  const salePoint=Math.max(0,Number(c?.yes24SalePoint)||0);
  const star=Math.max(0,Number(c?.yes24StarScore)||0);

  if(yesPop>0)score=Math.max(score,Math.min(1,.34+yesPop/190));
  if(salePoint>0)score=Math.max(score,Math.min(1,.32+Math.log10(salePoint+1)/5.2));
  if(c?.yes24BestsellerRank)score=Math.max(score,Math.max(.62,1-Math.log10(Number(c.yes24BestsellerRank)+1)*.14));
  if(c?.yes24SteadyRank)score=Math.max(score,Math.max(.40,.88-Math.log10(Number(c.yes24SteadyRank)+1)*.15));
  if(star>0)score=Math.min(1,score+Math.min(.08,star/120));
  if(c?.yes24Found)score=Math.min(1,score+.03);

  if(pop>0)score=Math.max(score,Math.min(1,.36+Math.log10(pop+1)/4.8));
 }else if(c.type==='movie'){
  if(pop>0)score=Math.max(score,Math.min(1,.34+Math.log10(pop+1)/4.2));
  if(votes>0)score=Math.max(score,Math.min(1,.30+Math.log10(votes+1)/5.1));
 }else{
  if(pop>0)score=Math.max(score,Math.min(1,.34+Math.log10(pop+1)/5));
 }
 if(rating>0&&(c.type!=='movie'||votes>=100))score=Math.min(1,score+Math.min(.10,rating/100));
 if(c.cover)score=Math.min(1,score+.03);
 return Math.max(.18,score);
}
function tasteAffinityScore(c){
 const same=state.items.filter(x=>x.type===c.type);
 if(!same.length)return .35;
 let score=.20,weight=0;
 for(const x of same){
  const positive=x.completed||x.saves?.length||state.profile?.responses?.[x.type+':'+x.title]==='interested'||state.profile?.responses?.[x.type+':'+x.title]==='experienced';
  if(!positive)continue;
  weight++;
  if(c.genre&&x.genre&&Model.norm(c.genre)===Model.norm(x.genre))score+=.22;
  if(c.creator&&x.creator&&Model.norm(c.creator)===Model.norm(x.creator))score+=.10;
  const cg=new Set((c.genreCandidates||[]).map(g=>Model.norm(Array.isArray(g)?g[0]:g)));
  const xg=(x.genreCandidates||[]).map(g=>Model.norm(Array.isArray(g)?g[0]:g));
  if(xg.some(g=>cg.has(g)))score+=.08;
 }
 return Math.max(.15,Math.min(1,score/(Math.max(1,weight*.16)+.55)));
}
function tasteDiversityScore(c){
 const recent=tastePool.slice(Math.max(0,tasteIndex-8),tasteIndex).filter(Boolean);
 if(!recent.length)return 1;
 let penalty=0;
 for(const x of recent){
  if(c.creator&&x.creator&&Model.norm(c.creator)===Model.norm(x.creator))penalty+=.34;
  if(c.genre&&x.genre&&Model.norm(c.genre)===Model.norm(x.genre))penalty+=.07;
  if(c.type==='movie'&&c.providerId&&x.providerId===c.providerId)penalty+=1;
 }
 return Math.max(0,1-penalty);
}

function tasteRecencyScore(c){
 const raw=String(c?.publishedAt||c?.publishDate||c?.releaseDate||'').trim();
 if(!raw)return .12;

 let year=0,month=1,day=1;
 const compact=raw.match(/^(\d{4})(\d{2})(\d{2})$/);
 const dashed=raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);

 if(compact){
  year=Number(compact[1]);month=Number(compact[2]);day=Number(compact[3]);
 }else if(dashed){
  year=Number(dashed[1]);month=Number(dashed[2]);day=Number(dashed[3]||1);
 }else{
  const y=raw.match(/\b(19|20)\d{2}\b/);
  if(y)year=Number(y[0]);
 }

 if(!year)return .12;

 const now=new Date();
 const published=new Date(year,Math.max(0,month-1),Math.max(1,day));
 const ageYears=Math.max(0,(now-published)/(365.25*24*60*60*1000));

 // Fresh releases are strongly preferred during cold start, but backlist
 // titles keep a non-zero floor so classics can still appear.
 if(ageYears<=1.5)return 1;
 if(ageYears<=3)return .86;
 if(ageYears<=5)return .68;
 if(ageYears<=8)return .46;
 if(ageYears<=12)return .30;
 return .12;
}

function tasteRankScore(c){
 const signals=tasteSignalCount(c.type);

 // Cold start policy:
 // books: current YES24 bestsellers first (weighted random), then popularity/newness.
 // other media: recent releases + popular titles.
 // As explicit taste accumulates, affinity gradually becomes the main signal.
 const weights=c.type==='book'
  ?(signals<3
    ?{pop:.70,newness:.18,aff:.04,div:.08}
    :signals<8
     ?{pop:.62,newness:.14,aff:.10,div:.14}
     :{pop:.54,newness:.10,aff:.20,div:.16})
  :(signals<3
    ?{pop:.52,newness:.28,aff:.10,div:.10}
    :signals<8
     ?{pop:.40,newness:.18,aff:.28,div:.14}
     :{pop:.36,newness:.08,aff:.40,div:.16});

 const pop=tastePopularityScore(c),
       newness=tasteRecencyScore(c),
       aff=tasteAffinityScore(c),
       div=tasteDiversityScore(c);

 // Current bestseller status gets an extra cold-start nudge for books.
 let bestsellerNudge=0;
 if(c.type==='book'&&signals<3){
  if(c?.yes24BestsellerRank)bestsellerNudge=.10;
  else if((Number(c?.yes24PopularityScore)||0)>0)bestsellerNudge=.04;
 }

 const stableJitter=(hash(c.type+'|'+c.title+'|'+c.creator)%100)/10000;
 return pop*weights.pop
      +newness*weights.newness
      +aff*weights.aff
      +div*weights.div
      +bestsellerNudge
      +stableJitter;
}
function rankTasteCandidates(candidates){
 return [...candidates].sort((a,b)=>tasteRankScore(b)-tasteRankScore(a));
}

function nextTasteQuery(type){
 if(type==='album')return {pick:['classic-albums',''],curated:false};
 const query=tasteExploreDecks[type].shift();
 return query?{pick:[query,''],curated:false}:null;
}


const BOOK_RECOMMENDATION_EXCLUDED_GROUPS=new Set(['history','art','travel','selfdev','society','economy']);

const BOOK_RECOMMENDATION_YOUTH_RE=/(주니어|어린이|아동|유아|청소년|키즈|초등|중등|고등|학습만화|만화로\s*배우는|캐릭터|공략집)/i;
const BOOK_RECOMMENDATION_YOUTH_PUBLISHER_RE=/(주니어|어린이|아이세움|아울북|비룡소|사계절아동|웅진주니어|길벗스쿨|미래엔아이세움|위즈덤하우스\s*키즈|키즈엠|창비어린이|다산어린이)/i;

function isYouthBookRecommendationCandidate(c){
 const title=String(c?.title||'');
 const publisher=String(c?.publisher||'');
 const categoryText=[
  c?.genre,
  c?.rawGenre,
  c?.categoryName,
  c?.categoryFullPath
 ].filter(Boolean).join(' ');
 return BOOK_RECOMMENDATION_YOUTH_RE.test(title)
   ||BOOK_RECOMMENDATION_YOUTH_RE.test(categoryText)
   ||BOOK_RECOMMENDATION_YOUTH_PUBLISHER_RE.test(publisher);
}


async function fetchBookRankingCandidates(mode='bestseller'){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),7000);
 try{
  const res=await fetch(BOOK_POPULARITY_ENDPOINT,{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({mode,page:1,size:100}),
   signal:controller.signal
  });
  if(!res.ok)return [];

  const payload=await res.json();
  const raw=Array.isArray(payload?.books)?payload.books:[];
  return raw.map((d,index)=>{
   const title=String(d?.title||'').trim();
   const creator=String(d?.author||d?.creator||'').trim();
   const isbn13=String(d?.isbn13||d?.isbn||'').replace(/\D/g,'');
   const publishedAt=String(d?.publishDate||d?.publishedAt||'').trim();
   const rank=Number(d?.rank)||index+1;

   // 카테고리별 rank 기준. 상위권일수록 잘 뽑히되 완전 순차는 아니다.
   const rankingWeight=mode==='steady'
    ?(rank<=5?.72:rank<=10?.60:rank<=20?.48:.36)
    :(rank<=5?1:rank<=10?.86:rank<=20?.68:.48);

   return {
    type:'book',
    title,
    creator,
    publisher:String(d?.publisher||'').trim(),
    isbn:isbn13,
    cover:String(d?.cover||'').trim(),
    catalogUrl:String(d?.link||'').trim(),
    publishedAt,
    genre:String(d?.categoryName||'').trim(),
    rawGenre:String(d?.categoryFullPath||'').trim(),
    genreSource:'yes24-'+mode,
    genreCandidates:[],
    recommendationGroup:String(d?.recommendationGroup||'etc'),
    categoryName:String(d?.categoryName||'').trim(),
    source:mode==='steady'?'YES24 스테디셀러':'YES24 베스트셀러',
    yes24Found:true,
    yes24PopularityScore:Number(d?.popularityScore)||0,
    yes24SalePoint:Number(d?.salePoint)||0,
    yes24StarScore:Number(d?.starScore)||0,
    yes24BestsellerRank:mode==='bestseller'?rank:null,
    yes24SteadyRank:mode==='steady'?rank:(Number(d?.steadyRank)||null),
    bestsellerWeight:rankingWeight,
    recommendationTier:mode
   };
  }).filter(c=>
    c.title
    &&!isExcludedBookCandidate(c)
    &&!BOOK_RECOMMENDATION_EXCLUDED_GROUPS.has(String(c?.recommendationGroup||''))
    &&!isYouthBookRecommendationCandidate(c)
   );
 }catch{
  return [];
 }finally{
  clearTimeout(timer);
 }
}
function weightedPickIndex(list){
 const total=list.reduce((sum,c)=>sum+Math.max(.05,Number(c?.bestsellerWeight)||.35),0);
 let pick=Math.random()*total;
 for(let i=0;i<list.length;i++){
  pick-=Math.max(.05,Number(list[i]?.bestsellerWeight)||.35);
  if(pick<=0)return i;
 }
 return Math.max(0,list.length-1);
}

function weightedShuffleBestsellers(list){
 // 같은 장르가 연속으로 몰리지 않게 카테고리별로 번갈아 뽑는다.
 const groups=new Map();
 for(const c of (list||[])){
  const key=String(c?.recommendationGroup||c?.categoryName||'etc');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(c);
 }
 const groupKeys=[...groups.keys()].sort(()=>Math.random()-.5);
 const out=[];
 while(groupKeys.some(key=>(groups.get(key)||[]).length)){
  // 라운드마다 카테고리 순서를 가볍게 섞어서 고정 패턴도 피한다.
  const round=[...groupKeys].sort(()=>Math.random()-.5);
  for(const key of round){
   const pool=groups.get(key)||[];
   if(!pool.length)continue;
   const idx=weightedPickIndex(pool);
   out.push(pool.splice(idx,1)[0]);
  }
 }
 return out;
}

async function fetchMovieRecommendations(){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const headers={'Accept':'application/json'};
  if(cloudSession?.access_token)headers.Authorization='Bearer '+cloudSession.access_token;
  const publicKey=cloudPublicKey();if(publicKey)headers.apikey=publicKey;
  const res=await fetch(MOVIE_RECOMMEND_ENDPOINT,{method:'GET',headers,signal:controller.signal});
  if(!res.ok)return [];
  const payload=await res.json();
  const raw=Array.isArray(payload?.movies)?payload.movies:[];
  return raw.map(movie=>normalizeRemoteMovie({
    ...movie,
    poster_path:movie.poster_url||movie.poster_path,
    id:movie.provider_id||movie.id
  })).filter(c=>c?.title).map(c=>({
    ...c,
    source:'영화 추천 API',
    provider:'tmdb',
    provider_id:c.provider_id||c.id||''
  }));
 }catch{
  return [];
 }finally{
  clearTimeout(timer);
 }
}

function musicRecommendationWeight(c){
 const users=Math.max(0,Number(c?.totalUserCount)||0);
 const listens=Math.max(0,Number(c?.totalListenCount)||0);
 const score=Math.max(0,Number(c?.musicPopularityScore)||0);
 return Math.max(.2,score||Math.log10(users+1)*.78+Math.log10(listens+1)*.22);
}

function weightedShuffleClassicAlbums(list){
 const pool=[...(list||[])];
 const out=[];
 const usedArtists=new Set();
 let recentGenres=[],recentEras=[];

 while(pool.length){
  const candidates=pool
   .map((c,i)=>({c,i}))
   .filter(({c})=>!usedArtists.has(Model.norm(c?.creator||'')));

  if(!candidates.length)break;

  const weighted=candidates.map(({c,i})=>{
   let w=musicRecommendationWeight(c);
   const genre=String(c?.musicGenreFamily||c?.genre||'').toLowerCase();
   const era=String(c?.musicEra||'');
   if(genre&&recentGenres.includes(genre))w*=.32;
   if(genre&&recentGenres.slice(-1)[0]===genre)w*=.18;
   if(era&&recentEras.slice(-2).includes(era))w*=.68;
   w*=.82+Math.random()*.36;
   return {c,i,w:Math.max(.03,w)};
  });

  const total=weighted.reduce((s,x)=>s+x.w,0);
  let pick=Math.random()*total,chosen=weighted[0];
  for(const x of weighted){
   pick-=x.w;
   if(pick<=0){chosen=x;break}
  }

  const [picked]=pool.splice(chosen.i,1);
  out.push(picked);
  usedArtists.add(Model.norm(picked?.creator||''));

  const g=String(picked?.musicGenreFamily||picked?.genre||'').toLowerCase();
  const e=String(picked?.musicEra||'');
  if(g)recentGenres=[...recentGenres.slice(-2),g];
  if(e)recentEras=[...recentEras.slice(-2),e];
 }
 return out;
}

// Public catalog only: saved works and responses are filtered at display time.
const MUSIC_CATALOG_TTL=30*60*1000;
let musicClassicCatalog=[],musicClassicFetchedAt=0,musicClassicRequest=null;
function loadMusicClassicCatalog(){
 if(musicClassicFetchedAt&&Date.now()-musicClassicFetchedAt<MUSIC_CATALOG_TTL)return Promise.resolve(musicClassicCatalog);
 if(musicClassicRequest)return musicClassicRequest;
 musicClassicRequest=requestMusicClassicCatalog().then(candidates=>{
  if(candidates.length){musicClassicCatalog=candidates;musicClassicFetchedAt=Date.now()}
  return musicClassicCatalog;
 }).finally(()=>{musicClassicRequest=null});
 return musicClassicRequest;
}
async function fetchMusicClassicCandidates(){
 return weightedShuffleClassicAlbums(await loadMusicClassicCatalog());
}
async function requestMusicClassicCatalog(){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const res=await fetch(MUSIC_POPULARITY_ENDPOINT,{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({mode:'classic-albums'}),
   signal:controller.signal
  });
  if(!res.ok)return [];

  const payload=await res.json();
  const raw=Array.isArray(payload?.albums)?payload.albums:[];
  const normalized=raw.map(d=>{
   const c=normalizeRemoteAlbum(d);
   return {
    ...c,
    source:'ListenBrainz 명반 추천',
    searchPopularity:Number(d?.total_user_count)||Number(d?.popularity_score)||0,
    totalUserCount:Number(d?.total_user_count)||0,
    totalListenCount:Number(d?.total_listen_count)||0,
    musicPopularityScore:Number(d?.popularity_score)||0,
    musicGenreFamily:String(d?.genre_family||'').trim(),
    musicEra:String(d?.era||'').trim(),
    recommendationKey:d?.release_group_mbid?'album:rg:'+String(d.release_group_mbid):''
   };
  }).filter(c=>c.title&&c.creator);

  return normalized;
 }catch{
  return [];
 }finally{
  clearTimeout(timer);
 }
}

async function fetchTasteCandidates(type,job){
 if(type==='movie'){
  return await fetchMovieRecommendations();
 }
 if(type==='book'){
  const bestsellers=await fetchBookRankingCandidates('bestseller');
  return weightedShuffleBestsellers(bestsellers);
 }
 if(type==='album'){
  return await fetchMusicClassicCandidates();
 }
 if(!job)return [];
 const {pick}=job;
 const [title,creator]=pick;
 const query=title+(creator?' '+creator:'');
 const config={book:[BOOK_SEARCH_ENDPOINT,unwrapBookDocuments,normalizeRemoteBook],album:[MUSIC_SEARCH_ENDPOINT,unwrapAlbums,normalizeRemoteAlbum],movie:[MOVIE_SEARCH_ENDPOINT,unwrapMovies,normalizeRemoteMovie]};
 const [endpoint,unwrap,normalize]=config[type];
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 try{
  const url=type==='book'?endpoint+'?query='+encodeURIComponent(query)+'&q='+encodeURIComponent(query):endpoint;
  const headers={'Content-Type':'application/json','Accept':'application/json'};
  if(cloudSession?.access_token)headers.Authorization='Bearer '+cloudSession.access_token;
  const publicKey=cloudPublicKey();if(publicKey)headers.apikey=publicKey;
  const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({query,q:query,size:50,page:1}),signal:controller.signal});
  if(!res.ok)throw Error('HTTP '+res.status);
  let works=unwrap(await res.json()).map(normalize).filter(c=>c.title&&(type!=='book'||!isExcludedBookCandidate(c)));
  if(type==='movie')works=[...works].sort((a,b)=>movieSearchScore(b,query)-movieSearchScore(a,query));
  if(type==='book')return works.slice(0,40);
  return works.slice(0,24);
 }finally{clearTimeout(timer)}
}


async function fetchTasteBookSteadyFallback(){
 const steady=await fetchBookRankingCandidates('steady');
 return weightedShuffleBestsellers(steady);
}

async function enrichTasteBookPopularity(candidates){
 const books=(candidates||[])
   .filter(c=>c?.type==='book'&&!isExcludedBookCandidate(c)&&primaryIsbn13(c?.isbn))
   .slice(0,12);
 const isbns=[...new Set(books.map(c=>primaryIsbn13(c.isbn)).filter(Boolean))];
 if(!isbns.length)return candidates;

 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4500);

 try{
  const res=await fetch(BOOK_POPULARITY_ENDPOINT,{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({isbns}),
   signal:controller.signal
  });
  if(!res.ok)return candidates;

  const payload=await res.json();
  const responseBooks = Array.isArray(payload?.books)
    ? payload.books
    : (payload?.isbn ? [payload] : []);

  const infoMap=new Map(
   responseBooks
    .map(info=>[primaryIsbn13(info?.isbn13||info?.isbn),info])
    .filter(([isbn])=>isbn)
  );

  for(const book of books){
   const info=infoMap.get(primaryIsbn13(book.isbn));
   if(info)applyPopularityInfo(book,info);
  }
 }catch{
  // YES24 보강이 실패하거나 느려도 추천 자체는 서버 후보로 계속 진행한다.
 }finally{
  clearTimeout(timer);
 }

 return candidates;
}

async function loadTasteCandidates(){
 if(tasteLoading)return;
 const request=++tasteRequest,owner=cloudSession?.user?.id||'local';
 tasteLoading=true;tasteNotice='';render();
 try{
 // Prefetch without replacing the current card. Limit empty/error retries per interaction.
 for(let attempt=0;attempt<(tastePreferredType==='album'?1:2);attempt++){
  const activeTypes=tastePreferredType?[tastePreferredType]:['book','movie'];
  const jobs=activeTypes.map(type=>({type,job:nextTasteQuery(type)})).filter(x=>x.job);
  if(!jobs.length){
   if(tasteMode==='add'){
    const refillTypes=tastePreferredType?[tastePreferredType]:['book','movie'];
    for(const type of refillTypes){tasteExploreDecks[type]=[];TASTE_EXPLORE[type].forEach(q=>{const key=type+':'+Model.norm(q);tasteUsedQueries.delete(key);enqueueTasteQuery(type,q)})}
    continue;
   }
   tasteNotice='지금 찾을 수 있는 새 작품을 모두 살펴봤어요.';break
  }
  const results=await Promise.allSettled(jobs.map(({type,job})=>fetchTasteCandidates(type,job)));
  if(request!==tasteRequest)return;
  if(owner!==(cloudSession?.user?.id||'local')||authRoute!=='taste'){tasteLoading=false;return}
  let candidates=results.flatMap(r=>r.status==='fulfilled'?r.value:[])
   .filter(c=>c?.type!=='book'||!isExcludedBookCandidate(c));

  // Book recommendations get the same YES24 popularity enrichment as search.
  candidates=await enrichTasteBookPopularity(candidates);

  // Filter educational/anthology books again before the final recommendation rank.
  candidates=candidates.filter(c=>c?.type!=='book'||!isExcludedBookCandidate(c));

  // 책은 서버의 카테고리 혼합 베스트셀러 순서를 보존한다.
  // 장르/취향 점수로 다시 정렬하면 특정 장르가 몰릴 수 있으므로 책에는 재정렬하지 않는다.
  let additions;
  if(tastePreferredType==='book' || (candidates.length&&candidates.every(c=>c?.type==='book'))){
   additions=freshTasteCandidates(candidates);
   if(!additions.length){
    const steady=await fetchTasteBookSteadyFallback();
    additions=freshTasteCandidates(steady);
   }
  }else if(tastePreferredType==='album' || (candidates.length&&candidates.every(c=>c?.type==='album'))){
   // 음악은 ListenBrainz 대중성 + 장르/시대 분산 순서를 그대로 사용한다.
   additions=freshTasteCandidates(candidates);
  }else{
   additions=rankTasteCandidates(freshTasteCandidates(candidates));
  }
  if(request!==tasteRequest)return;
  if(owner!==(cloudSession?.user?.id||'local')||authRoute!=='taste'){tasteLoading=false;return}
  tastePool.push(...additions);
  const failed=results.filter(r=>r.status==='rejected').length;
  if(failed===results.length){
   jobs.forEach(({type,job})=>{if(job?.pick?.[0])tasteExploreDecks[type].push(job.pick[0])});
   tasteNotice='작품을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요.';break;
  }
  if(additions.length)break;
 }
 if(!tastePool[tasteIndex]&&!tasteNotice)tasteNotice='새 작품을 찾지 못했어요. 다른 후보를 다시 찾아볼 수 있어요.';
 tasteLoading=false;
 render();
 }catch(err){
  if(request===tasteRequest){
   tasteLoading=false;
   tasteNotice='추천을 불러오는 중 오류가 발생했어요. 다시 시도해주세요.';
   console.error('taste recommendation error',err);
   render();
  }
 }
}
function startTaste(mode='initial',preferredType=''){
 tasteMode=mode==='add'?'add':'initial';
 if(preferredType&&['book','movie'].includes(preferredType))tastePreferredType=preferredType;
 // Keep skipped works out of subsequent batches during this account's page session.
 const owner=cloudSession?.user?.id||'local';
 if(tasteOwner!==owner){
  tasteShownKeys=new Set();tasteQueryDecks={};tasteExploreDecks={};tasteUsedQueries=new Set();tasteOwner=owner;
  for(const type of ['book','movie']){
   tasteQueryDecks[type]=[];tasteExploreDecks[type]=[];
   TASTE_EXPLORE[type].forEach(query=>enqueueTasteQuery(type,query));
  }
 }
 tasteActiveCandidate=null;
 tasteRequest++;tasteLoading=false;tastePool=[];tasteIndex=0;tasteSeen=0;tasteReviewed=0;
 flowTo('taste');
 return loadTasteCandidates();
}

function tasteIntroText(c){
 let raw=String(c?.contents||c?.description||c?.overview||'')
  .replace(/<[^>]+>/g,' ')
  .replace(/[_＿]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();
 if(!raw)return '';

 // 추천사/인용문/수상·화제 문구보다 실제 작품 설명을 우선한다.
 raw=raw
  .replace(/^[“"『「][^”"』」]{15,220}[”"』」]\s*(?:[-–—]?\s*[^.!?。]{0,45})?\s*/,'')
  .replace(/^(?:(?:출간\s*즉시|종합\s*베스트셀러|베스트셀러|유튜브\s*[\d,.]+\s*만?\s*뷰|전\s*국민적|화제작|특별기획보도|인터뷰\s*대서특필|방송계의\s*퓰리처상|피버디상|수상자|수상작|추천사|찬사)[^.!?。]{0,95}[.!?。]?\s*)+/i,'')
  .trim();

 if(!raw)return '';

 // 첫 문장이 너무 짧으면 거기서 끝내지 않는다.
 // 완결된 문장을 2~3개 이어 붙여 약 90~170자 정도를 목표로 한다.
 const parts=[];
 let start=0;
 const enders=/[.!?。]/g;
 let match;
 while((match=enders.exec(raw))&&parts.length<4){
  let end=match.index+1;
  while(end<raw.length&&/[”"'’」』)]/.test(raw[end]))end++;
  const part=raw.slice(start,end).trim();
  if(part)parts.push(part);
  start=end;
  while(start<raw.length&&/\s/.test(raw[start]))start++;
  enders.lastIndex=start;
 }

 if(parts.length){
  let combined='';
  for(const part of parts){
   const next=(combined?combined+' ':'')+part;
   if(combined.length>=90)break;
   if(next.length<=180){
    combined=next;
   }else{
    break;
   }
  }
  if(combined.length>=70)return combined;
 }

 // 문장부호가 드문 소개문은 단어 경계에서만 축약한다.
 if(raw.length<=165)return raw;
 const probe=raw.slice(0,166);
 const lastSpace=probe.lastIndexOf(' ');
 const safe=lastSpace>=135?probe.slice(0,lastSpace):raw.slice(0,160);
 return safe.trim()+'…';
}

async function ensureTasteIntro(c){
 if(!c||c.type!=='book'||c.contents||c._introLoading||c._introLoaded)return;
 c._introLoading=true;
 try{
  const isbn=primaryIsbn13(c.isbn);
  const query=isbn||c.title;
  if(!query)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try{
   const url=BOOK_SEARCH_ENDPOINT+'?query='+encodeURIComponent(query)+'&q='+encodeURIComponent(query)+(isbn?'&target=isbn':'');
   const headers={'Content-Type':'application/json','Accept':'application/json'};
   if(cloudSession?.access_token)headers.Authorization='Bearer '+cloudSession.access_token;
   const publicKey=cloudPublicKey();if(publicKey)headers.apikey=publicKey;
   const res=await fetch(url,{
    method:'POST',
    headers,
    body:JSON.stringify({query,q:query,target:isbn?'isbn':'title',size:8,page:1,sort:'accuracy'}),
    signal:controller.signal
   });
   if(!res.ok)return;
   const docs=unwrapBookDocuments(await res.json()).map(normalizeRemoteBook);
   const exact=isbn
    ?docs.find(x=>primaryIsbn13(x.isbn)===isbn)
    :docs.find(x=>Model.norm(x.title)===Model.norm(c.title));
   const found=exact||docs[0];
   if(found?.contents)c.contents=found.contents;
  }finally{
   clearTimeout(timer);
  }
 }catch{
  // 소개 보강 실패는 추천 흐름을 막지 않는다.
 }finally{
  c._introLoading=false;
  c._introLoaded=true;
  if(authRoute==='taste'&&window.tasteCandidate===c)render();
 }
}

// 카카오 책 검색의 contents는 책 소개 전문이 아니라 고정 길이 발췌라서
// 말줄임표 없이 문장 중간에서 끊긴다. 상세 화면에서만 Google Books 원문으로 보강한다.
function looksTruncatedIntro(value){
 const s=String(value||'').trim();
 if(s.length<150)return false;
 return !/(?:[.!?。…”"』」)\]]|다|요|음|임)$/.test(s);
}
// Google Books는 API 키 없이 쓰면 요청 한도가 낮아 429(Too Many Requests)가 쉽게 뜬다.
// 재시도는 오히려 같은 한도를 더 빨리 소진시키므로, 한 번 막히면 곧바로 길게 쉬고
// 그 안에서는 아예 요청을 보내지 않는다. 가장 확실한 해결책은 GOOGLE_BOOKS_API_KEY 발급이다.
let googleBooksCooldownUntil=0;
async function queryGoogleBooksDescription(q,tn,an,timeoutMs){
 if(Date.now()<googleBooksCooldownUntil){
  console.debug('[송림 소개보강] 쿨다운 중이라 요청 생략',q);
  return '';
 }
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(q)+'&maxResults=5&printType=books'+(GOOGLE_BOOKS_API_KEY?'&key='+GOOGLE_BOOKS_API_KEY:'');
  const res=await fetch(url,{signal:controller.signal});
  if(res.status===429){
   console.debug('[송림 소개보강] 429 응답 - 5분간 요청 중단',q);
   googleBooksCooldownUntil=Date.now()+300000;
   return '';
  }
  if(!res.ok)return '';
  const payload=await res.json(),items=Array.isArray(payload?.items)?payload.items:[];
  if(!items.length)return '';
  const ranked=items.map(it=>{
   const v=it?.volumeInfo||{},vt=Model.norm(v.title||''),va=Model.norm((v.authors||[]).join(' '));
   let score=0;
   if(tn&&vt===tn)score+=10;else if(tn&&(vt.includes(tn)||tn.includes(vt)))score+=6;
   if(an&&va.includes(an))score+=4;
   if(v.description)score+=3;
   return {v,score};
  }).sort((a,b)=>b.score-a.score);
  const best=ranked.find(r=>r.v.description)||ranked[0];
  return String(best?.v?.description||'').replace(/<[^>]+>/g,' ').replace(/\s+\n/g,'\n').trim();
 }catch{
  return '';
 }finally{
  clearTimeout(timer);
 }
}

async function fetchYes24BookDescription(c){
 try{
  const isbn=primaryIsbn13(c?.isbn)||String(c?.isbn||'').split(/\s+/).filter(Boolean)[0]||'';
  if(!isbn)return '';
  const res=await fetch('https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/book-intro',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({isbn})
  });
  if(!res.ok)return '';
  const data=await res.json();
  return String(data?.intro||'').trim();
 }catch(e){
  console.debug('[송림 YES24 소개보강] 실패',c?.title,e);
  return '';
 }
}

async function fetchGoogleBookDescription(c){
 const isbn=primaryIsbn13(c?.isbn)||String(c?.isbn||'').split(/\s+/).filter(Boolean)[0]||'';
 const title=String(c?.title||'').replace(/<[^>]+>/g,'').trim();
 const author=String(c?.creator||'').split(',')[0].trim();
 if(!isbn&&!title)return '';
 const tn=Model.norm(title),an=Model.norm(author);
 // ISBN 검색은 정확한 판(版)을 찾지만, 국내서는 Google Books에 등록돼 있어도
 // description이 비어있는 경우가 흔하다. 요청 수를 아끼기 위해 순차로 시도하고,
 // ISBN 쪽에서 이미 설명을 찾으면 제목 검색은 생략한다.
 if(isbn){
  const byIsbn=await queryGoogleBooksDescription('isbn:'+isbn,tn,an,4500);
  if(byIsbn)return byIsbn;
 }
 if(title)return await queryGoogleBooksDescription('intitle:'+title+(author?' inauthor:'+author:''),tn,an,4500);
 return '';
}
async function ensureDetailIntro(c){
 if(!c||c.type!=='book')return;
 const key=detailIntroKey(c);
 if(detailIntroAttempts.has(key))return;
 if(c.contents&&!looksTruncatedIntro(c.contents))return;
 detailIntroAttempts.set(key,'loading');
 try{
  const yes24Description=await fetchYes24BookDescription(c);
  const description=yes24Description || await fetchGoogleBookDescription(c);
  if(description&&description.length>String(c.contents||'').length){
   console.debug('[송림 소개보강] 성공',c.title,'길이',String(c.contents||'').length,'→',description.length);
   c.contents=description;
   if(c.id&&get(c.id)===c)persist();
   if(view==='detail')render();
  }else{
   console.debug('[송림 소개보강] Google Books에 더 나은 소개가 없음',c.title,c.isbn);
  }
 }catch(e){
  console.debug('[송림 소개보강] 실패',c.title,e);
  // 소개 보강 실패는 상세 화면 표시를 막지 않는다.
 }finally{
  detailIntroAttempts.set(key,'done');
 }
}

function renderTastePage(){
 let c=tastePool[tasteIndex],isAdd=tasteMode==='add';
 while(c&&(isTasteCandidateSaved(c)||state.profile.responses?.[c.type+':'+c.title]||(c!==tasteActiveCandidate&&hasTasteHistory(c))||(c.type==='book'&&isExcludedBookCandidate(c)))){
  tasteIndex++;
  c=tastePool[tasteIndex];
 }
 window.tasteCandidate=c||null;
 if(tasteLoading&&!c)return '<div class="entry-hero" role="status"><h1>새로운 작품을 찾고 있어요</h1><p class="creator">다음 작품을 곧 보여드릴게요.</p></div>';
 if(!c){
  const title=tasteNotice?.includes('오류')?'작품을 불러오지 못했어요':'새로운 작품을 찾지 못했어요';
  const description=esc(tasteNotice||'이미 본 작품은 제외했어요. 다른 유형을 둘러보거나 잠시 후 다시 찾아주세요.');
  return '<div class="entry-hero" role="status"><h1>'+title+'</h1><p class="creator">'+description+'</p></div>'+button('다시 찾아보기','flowTasteMore','secondary')+button(isAdd?'닫기':'그냥 시작하기',isAdd?'tasteClose':'flowFinish','textbtn');
 }
 window.tasteCandidate=c;
 tasteActiveCandidate=c;
 rememberTasteCandidate(c);
 tasteKeys(c).forEach(key=>tasteShownKeys.add(key));
 if(c.type==='book'&&!c.contents&&!c._introLoaded&&!c._introLoading)setTimeout(()=>ensureTasteIntro(c),0);
 const initialProgress=Math.min(tasteReviewed+1,INITIAL_TASTE_TARGET);
 const heading=isAdd
  ?'<div class="taste-heading"><h1>관심 있는 작품을 골라주세요</h1></div>'
  :'<div class="taste-heading"><h1>관심 있는 작품을 골라주세요</h1><p class="creator">작품 5개를 살펴보세요.</p><div class="taste-progress" aria-label="첫 추천 작품 '+initialProgress+'번째, 전체 '+INITIAL_TASTE_TARGET+'개"><span>'+initialProgress+' / '+INITIAL_TASTE_TARGET+'</span><span class="taste-dots" aria-hidden="true">'+Array.from({length:INITIAL_TASTE_TARGET},(_,i)=>'<i class="'+(i<=tasteReviewed?'on':'')+'"></i>').join('')+'</span></div></div>';
 return (tasteNotice?'<p class="note" role="status">'+esc(tasteNotice)+'</p>':'')+heading+'<div class="onboard-card"><div class="taste-cover-stage">'+cover(c)+'</div><small>'+typeName[c.type]+'</small><h2 title="'+esc(c.title)+'">'+esc(c.title)+'</h2><p class="creator" title="'+esc(c.creator)+'">'+esc(c.creator)+'</p>'+button('상세보기','tasteDetail','textbtn taste-detail-link')+'</div><div class="taste-actions">'+button(({book:'읽고 싶어요',album:'듣고 싶어요',movie:'보고 싶어요'})[c.type]||'경험하고 싶어요','flowInterested')+button('이미 경험했어요','flowExperienced','secondary')+button('넘기기','flowSkip','textbtn')+'</div>'
}

function response(type){const c=window.tasteCandidate;state.profile.responses??={};state.profile.responses[c.type+':'+c.title]=type;return persist()}
function nextTaste(){if(!tastePool[tasteIndex])return;tasteIndex++;tasteReviewed++;if(tasteMode==='initial'&&tasteReviewed>=INITIAL_TASTE_TARGET){flowTo('ready');return}flowTo('taste');if(authRoute==='taste'&&tastePool.length-tasteIndex<=8)loadTasteCandidates()}
function finishEntry(){state.onboarded=true;if(!persist())return false;authSession.finished=true;saveSession();view='today';flowTo('app');return true}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(['flowInterested','flowExperienced','flowSkip','tasteDetail'].includes(a)&&(authRoute!=='taste'||!window.tasteCandidate))return;
 if(a==='tasteDetail'){openCandidateDetail(window.tasteCandidate);return}
 if(a==='flowTasteMore'){
  const refillTypes=tastePreferredType?[tastePreferredType]:['book','movie'];
  if(!refillTypes.some(type=>(tasteQueryDecks[type]?.length||tasteExploreDecks[type]?.length))){
   for(const type of refillTypes){tasteQueryDecks[type]=[];tasteExploreDecks[type]=[];TASTE_EXPLORE[type].forEach(query=>enqueueTasteQuery(type,query));}
  }
  loadTasteCandidates();
 }
 if(a==='flowOptionalTaste'){tasteMode='initial';tastePreferredType='';flowTo('tasteType');}
 if(a==='chooseTasteType'){const chosen=b.dataset.type;if(['book','movie'].includes(chosen))startTaste(tasteMode==='add'?'add':'initial',chosen);}
 if(a==='flowFirstScrap'){if(finishEntry())addMenu()}
 if(a==='flowWelcome')flowTo('welcome');
 if(a==='flowBack')flowTo(authRoute==='start'?'profile':authRoute==='recover'?'login':authRoute==='signup'?'signupOptions':'welcome');
 if(a==='flowEmailLogin'){passwordRecoveryToken='';flowTo('login');}
 if(a==='retryCloudSync'){void cloudUpsertState();return}
 if(a==='backupUnsaved'){const snapshot=JSON.parse(JSON.stringify(unsavedState||state));snapshot._unsavedForm=[...document.querySelectorAll('#overlay input:not([type=password]):not([type=file]),#overlay textarea,#overlay select')].map(el=>({id:el.id,value:el.value,checked:el.checked}));downloadStateSnapshot(snapshot,'unsaved');return}
 if(a==='reloadAccountData'){confirmBox('최신 기록을 불러올까요?','작성 중인 내용을 백업한 뒤 진행해주세요.',()=>{activateDataOwner(dataOwner);closeModal();render();showStorageStatus()},'불러오기');return}
 if(a==='resolveCloudConflict'){showCloudConflict();return}
 if(a==='backupRemoteConflict'&&dataEnvelope?.conflict){downloadStateSnapshot(dataEnvelope.conflict.state,'cloud-conflict');return}
 if(a==='useRemoteConflict'||a==='useLocalConflict'){void resolveCloudConflict(a==='useLocalConflict');return}
 if(a==='reviewLegacy'){
  if(!legacyReviewPending())return;try{const previous=Model.validate(JSON.parse(localStorage.getItem(KEY)));showModal('계정 분리 전의 기록','<p>현재 '+state.items.length+'개 · 이전 '+previous.items.length+'개</p><p>이전 기록은 자동으로 업로드하지 않았어요. 내 기록인지 확인한 뒤 복원할 수 있어요. 현재 기록도 먼저 보관합니다.</p>'+button('이전 기록 내려받기','legacyBackup','secondary')+button('이전 기록으로 복원','restoreLegacy','secondary')+button('현재 기록으로 계속','keepCurrentLegacy','primary'),'legacy-review')}catch{toast('이전 기록을 읽지 못했어요.')}return;
 }
 if(a==='keepCurrentLegacy'){try{localStorage.setItem(KEY+'.legacy-reviewed','true');closeModal();showStorageStatus()}catch{toast('확인 상태를 저장하지 못했어요.')}return}
 if(a==='restoreLegacy'){
  if(!legacyReviewPending())return;try{const previous=Model.validate(JSON.parse(localStorage.getItem(KEY)));localStorage.setItem(accountDataKey(dataOwner)+':archive:'+revisionID(),JSON.stringify({owner:dataOwner,state:JSON.parse(JSON.stringify(state))}));state=previous;if(!commit(true))return;localStorage.setItem(KEY+'.legacy-reviewed','true');showStorageStatus();toast('이전 기록을 복원했어요. 바꾸기 전 기록도 보관했어요.')}catch{toast('복원하지 못했어요. 기존 기록은 보관되어 있어요.')}return;
 }
 if(a==='legacyBackup'){try{const raw=localStorage.getItem(KEY);if(raw&&localStorage.getItem(KEY+'.legacy-owner')===dataOwner)downloadStateSnapshot(JSON.parse(raw),'legacy')}catch{toast('이전 백업을 읽지 못했어요.')}return}
 if(a==='syncArchives'){
  const keys=Object.keys(localStorage).filter(key=>key.startsWith(accountDataKey(dataOwner)+':archive:')).reverse();
  if(!keys.length){toast('보관된 충돌 기록이 없어요.');return}
  showModal('보관한 충돌 기록',keys.map((key,index)=>{const archive=JSON.parse(localStorage.getItem(key));return '<section><h3>보관 기록 '+(index+1)+'</h3><p>이 기기 '+archive.state.items.length+'개 · 클라우드 '+(archive.conflict?.state.items.length||0)+'개</p>'+button('이 기기 기록 내려받기','downloadArchive','secondary','data-key="'+esc(key)+'" data-side="local"')+(archive.conflict?button('클라우드 기록 내려받기','downloadArchive','secondary','data-key="'+esc(key)+'" data-side="remote"'):'')+'</section>'}).join(''),'sync-archives');return;
 }
 if(a==='downloadArchive'){const key=b.dataset.key;if(!key?.startsWith(accountDataKey(dataOwner)+':archive:'))return;try{const archive=JSON.parse(localStorage.getItem(key));downloadStateSnapshot(b.dataset.side==='remote'?archive.conflict.state:archive.state,'archived')}catch{toast('보관 기록을 읽지 못했어요.')}return}


 if(a==='flowSignup'){flowCodeSent=false;flowTo('signupOptions')}
 if(a==='cloudSetup'){cloudSetupModal()}
 if(a==='flowRecover'){passwordRecoveryToken='';passwordRecoveryError='';flowTo('recover');}
 if(['flowKakao','flowApple','flowGoogle'].includes(a)){toast('소셜 로그인은 다음 단계에서 연결할게요. 지금은 이메일 로그인을 사용해주세요.')}
 if(a==='flowSocialConfirm')flowTo('welcome');
 if(a==='flowTaste')startTaste('initial',tastePreferredType||'book');
 if(a==='tasteClose'){closeAdditionalTaste();return}
 if(a==='flowReady')flowTo('ready');
 if(a==='flowFinish')finishEntry();
 if(a==='flowInterested'){Model.add(state,window.tasteCandidate);tasteSeen++;if(response('interested'))nextTaste()}
 if(a==='flowSkip'){if(response('skipped'))nextTaste()}
 if(a==='flowExperienced'){const c=Model.add(state,window.tasteCandidate);if(!c.completed){c.completed='unknown';c.completedAt=Date.now()}if(response('experienced'))nextTaste()}
 if(a==='flowLogout'){confirmBox('로그아웃할까요?','기록과 미전송 변경은 이 기기에 보관되며, 같은 계정으로 로그인하면 이어서 전송합니다.',async()=>{await cloudLogout();authSession={signedIn:false,finished:false};saveSession();state=Model.empty();/* Account snapshots, including pending uploads, survive logout. */authRoute='welcome';view='today';render()},'로그아웃')}
 if(a==='deleteAccount'){
  if(!cloudSession?.access_token){toast('다시 로그인한 뒤 회원탈퇴를 진행해주세요.');return}
  showModal(
   '회원탈퇴',
   '<p><strong>'+esc(APP_BRAND.ko)+' 계정과 저장한 기록을 모두 삭제할까요?</strong></p>'+
   '<p class="muted">스크랩, 경험 기록, 완료 기록, 별점과 클라우드 사용자 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>'+
   '<label for="deleteAccountConfirm">확인을 위해 <strong>탈퇴</strong>를 입력해주세요.</label>'+
   '<input id="deleteAccountConfirm" autocomplete="off" placeholder="탈퇴">'+
   '<div id="deleteAccountError" class="entry-error" role="alert"></div>'+
   button('계정과 데이터 삭제','deleteAccountConfirm','primary danger')+
   button('취소','close','textbtn'),
   'delete-account'
  );
 }
 if(a==='deleteAccountConfirm'){
  const input=$('deleteAccountConfirm'),err=$('deleteAccountError');
  if(!input||input.value.trim()!=='탈퇴'){if(err)err.textContent='확인을 위해 “탈퇴”를 입력해주세요.';return}
  const btn=e.target.closest('button');if(btn)btn.disabled=true;
  if(err)err.textContent='계정과 데이터를 삭제하는 중이에요…';
  try{
   await deleteSongrimAccount();
   closeModal();
   render();
   toast('회원탈퇴가 완료됐어요.');
  }catch(ex){
   if(err)err.textContent=ex.message||'회원탈퇴를 완료하지 못했어요.';
   if(btn)btn.disabled=false;
  }
 }
 if(a==='flowReplay'){authSession.finished=false;saveSession();flowTo('profile')}
});
document.addEventListener('submit',async e=>{
 const f=e.target;
 if(f.id==='cloudConfigForm'){
  e.preventDefault();
  const key=$('cloudPublicKey').value.trim();
  if(!/^sb_publishable_/i.test(key) && !/^eyJ/i.test(key)){cloudSetupModal('브라우저용 Publishable key를 확인해주세요.');return}
  saveCloudPublicKey(key);closeModal();toast('Supabase 사용자 데이터 연결을 저장했어요.');render();return;
 }
 if(f.id==='flowLoginForm'||f.id==='flowSignupForm'){
  e.preventDefault();
  if(!cloudPublicKey()){cloudSetupModal('로그인 전에 Supabase Publishable key를 한 번 연결해주세요.');return}
  const email=$('flowEmail').value.trim().toLowerCase(),password=$('flowPassword').value;
  const submit=f.querySelector('[type=submit]');submit.disabled=true;const previousLabel=submit.textContent;submit.textContent=f.id==='flowSignupForm'?'가입하는 중…':'로그인하는 중…';f.setAttribute('aria-busy','true');
  try{
   if(f.id==='flowSignupForm'){
    if($('flowPasswordConfirm').value!==password)throw Error('비밀번호가 일치하지 않아요.');
    if(!$('flowTerms').checked)throw Error('이용 안내에 동의해주세요.');
    const data=await cloudSignup(email,password);
    authSession.name='';
    try{localStorage.setItem(CLOUD_LAST_EMAIL_STORAGE,email)}catch{}

    // 가입 직후에는 자동 진입하지 않고 로그인 화면으로 이동.
    // Supabase에서 이메일 확인이 켜져 있으면 메일 인증 후 로그인하면 된다.
    if(data?.access_token){
     saveCloudSession(data);
     await cloudLogout();
    }else{
     clearCloudSession();
    }
    authSession.signedIn=false;
    authSession.method='이메일';
    authSession.finished=false;
    saveSession();
    flowTo(data?.access_token?'login':'signupSent');
    if(data?.access_token)setTimeout(()=>toast('가입이 완료됐어요. 로그인해주세요.'),50);
   }else{
    const data=await cloudLogin(email,password);
    authSession.signedIn=true;authSession.method='이메일';
    await cloudLoadForSignedInUser();
    authSession.name=state.profile?.name||data?.user?.user_metadata?.name||authSession.name||'';
    authSession.finished=state.onboarded===true;
    saveSession();
    flowTo(authSession.finished?'app':'profile');
   }
  }catch(err){if(f.isConnected&&$('flowError'))$('flowError').textContent=err.message||'로그인 정보를 확인해주세요.'}
  finally{if(f.isConnected){submit.disabled=false;submit.textContent=previousLabel;f.removeAttribute('aria-busy')}}
  return;
 }
 if(f.id==='flowProfileForm'){e.preventDefault();const name=$('flowProfileName').value.trim()||'나';authSession.name=name;state.profile.name=name;if(!persist())return;saveSession();flowTo('start')}
 if(f.id==='flowRecoverForm'){e.preventDefault();const submit=f.querySelector('[type=submit]');submit.disabled=true;try{if(!cloudPublicKey())throw Error('Supabase 연결 설정이 필요해요.');await cloudRecover($('recoveryEmail').value.trim().toLowerCase());flowTo('recoverSent')}catch(err){$('flowError').textContent=err.message||'재설정 안내를 보내지 못했어요.'}finally{if(f.isConnected)submit.disabled=false}}
 if(f.id==='flowRecoveryLinkForm'||f.id==='flowResetPasswordForm'){
  e.preventDefault();const submit=f.querySelector('[type=submit]');submit.disabled=true;
  try{if(f.id==='flowRecoveryLinkForm'){await readRecoveryLink($('recoveryLink').value.trim());flowTo('resetPassword')}
   else{await updateRecoveredPassword($('newPassword').value,$('newPasswordConfirm').value);flowTo('login');toast('비밀번호를 변경했어요. 새 비밀번호로 로그인해주세요.')}}
  catch(err){if(f.isConnected)$('flowError').textContent=err.status===401||err.status===403?'재설정 링크가 만료됐어요. 새 메일을 받아주세요.':err.message}
  finally{if(f.isConnected)submit.disabled=false}return;
 }
 if(f.id==='flowTasteDateForm'){e.preventDefault();const date=$('flowTasteDate').value;if(date&&(!Model.validDate(date)||date>now())){$('flowError').textContent='오늘 또는 과거 날짜를 선택해주세요.';return}const c=Model.add(state,window.tasteCandidate);if(!c.completed){c.completed=date||'unknown';c.completedAt=Date.now()}if(response('experienced'))nextTaste()}
});
document.addEventListener('input',e=>{if(e.target.id==='flowProfileName')e.target.setCustomValidity('')});
// CLOUD_SESSION_STORAGE alone drives cross-tab account changes.
authRoute='welcome';
render();
cloudBootstrap().then(()=>render()).catch(()=>{cloudSyncStatus='error';showStorageStatus()});
