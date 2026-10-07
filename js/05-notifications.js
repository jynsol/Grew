/* original script block 11 */
// Reminders run only while the app is visible. No background push is implied.
const NOTIFICATION_STORAGE='songrim.notifications.v1.';
const notificationDefaults=()=>({daily:false,visitors:true,time:'21:00'});
let notificationOwner=null,notificationPrefs=notificationDefaults(),notificationDataOwner=null;
let notificationInterval=null,notificationHideTimer=null,notificationChecking=false,notificationVisitorDelivering=false,notificationActive=null,notificationQueue=[];
const notificationMemory=new Map();
function notificationRead(key){
 if(notificationMemory.has(key))return notificationMemory.get(key);
 try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}
}
function notificationWrite(key,value){
 try{localStorage.setItem(key,JSON.stringify(value));notificationMemory.delete(key);return true}catch{notificationMemory.set(key,value);return false}
}
function readNotificationPrefs(owner=notificationOwner){
 const p=notificationRead(NOTIFICATION_STORAGE+owner);
 return {daily:typeof p?.daily==='boolean'?p.daily:false,visitors:typeof p?.visitors==='boolean'?p.visitors:true,time:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p?.time)?p.time:'21:00'};
}
function notificationHistory(owner=notificationOwner){
 const h=notificationRead(NOTIFICATION_STORAGE+owner+'.history');
 return {lastDaily:typeof h?.lastDaily==='string'?h.lastDaily:'',visitors:Array.isArray(h?.visitors)?h.visitors.filter(id=>FOREST_VISITORS.some(v=>v.id===id)):[]};
}
function eligibleNotificationOwner(){
 if(authRoute!=='app'||!authSession.signedIn||candidatePreview||cloudApplying)return null;
 const owner=cloudSession?.user?.id||'local';
 if((loadCloudSession()?.user?.id||'local')!==owner)return null;
 if(owner!=='local'&&notificationDataOwner!==owner)return null;
 return owner;
}
function syncNotifications(){
 const owner=eligibleNotificationOwner();
 if(owner!==notificationOwner){
  dismissNotification(false);notificationQueue=[];notificationOwner=owner;
  notificationPrefs=owner?readNotificationPrefs(owner):notificationDefaults();
 }
 if(!owner||document.hidden){
  clearInterval(notificationInterval);notificationInterval=null;
  dismissNotification(false);notificationQueue=[];return;
 }
 if(!notificationInterval)notificationInterval=setInterval(()=>{void deliverVisitorNotification();void checkDailyNotification()},15000);
 if(notificationActive&&!notificationActive.preview&&((notificationActive.type==='daily'&&hasRecordOnDate(notificationDate()))||!readNotificationPrefs()[notificationActive.type==='daily'?'daily':'visitors']))dismissNotification();
 queueMicrotask(()=>{void deliverVisitorNotification();void checkDailyNotification()});
}
function notificationDate(date=new Date()){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function hasRecordOnDate(date){return state.items.some(c=>c.completed===date||(c.logs||[]).some(l=>l.date===date))}
function dailyNotificationDue(date=new Date()){
 if(!notificationOwner||eligibleNotificationOwner()!==notificationOwner||document.hidden||modal||view==='notifications'||notificationActive||notificationQueue.length)return false;
 if(document.activeElement?.matches('input,textarea,[contenteditable="true"]'))return false;
 const p=readNotificationPrefs(),today=notificationDate(date),[h,m]=p.time.split(':').map(Number),elapsed=date.getHours()*60+date.getMinutes()-h*60-m;
 return p.daily&&elapsed>=0&&elapsed<60&&notificationHistory().lastDaily!==today&&!hasRecordOnDate(today);
}
async function withNotificationLock(owner,run){
 // Web Locks serializes delivery across tabs; re-read the ledger inside it.
 if(navigator.locks?.request)return navigator.locks.request(NOTIFICATION_STORAGE+owner,{mode:'exclusive'},run);
 return run();
}
async function checkDailyNotification(){
 if(notificationChecking||!dailyNotificationDue())return;
 notificationChecking=true;const owner=notificationOwner;
 try{await withNotificationLock(owner,()=>{
  const date=new Date();if(owner!==notificationOwner||!dailyNotificationDue(date))return false;
  const history=notificationHistory(owner);history.lastDaily=notificationDate(date);
  notificationWrite(NOTIFICATION_STORAGE+owner+'.history',history);
  showNotification({type:'daily'});return true;
 })}catch{ /* Retry on the next visible tick if a browser lock is unavailable. */ }
 finally{notificationChecking=false}
}
function announceNewVisitor(id){
 if(!FOREST_VISITORS.some(v=>v.id===id)||!notificationOwner||eligibleNotificationOwner()!==notificationOwner||document.hidden||!readNotificationPrefs().visitors)return;
 if(notificationHistory().visitors.includes(id)||notificationQueue.some(n=>n.id===id)||notificationActive?.id===id)return;
 notificationQueue.push({type:'visitor',id,owner:notificationOwner});void deliverVisitorNotification();
}
async function deliverVisitorNotification(){
 if(notificationVisitorDelivering||notificationActive||!notificationQueue.length||modal||document.hidden)return;
 const item=notificationQueue[0];notificationVisitorDelivering=true;
 try{await withNotificationLock(item.owner,()=>{
  if(notificationQueue[0]!==item)return false;
  const history=notificationHistory(item.owner);
  if(item.owner!==notificationOwner||eligibleNotificationOwner()!==item.owner||!readNotificationPrefs().visitors||history.visitors.includes(item.id)){notificationQueue.shift();return false}
  if(notificationActive||modal||document.hidden)return false;
  history.visitors=[...new Set([...history.visitors,item.id])];
  notificationWrite(NOTIFICATION_STORAGE+item.owner+'.history',history);notificationQueue.shift();showNotification(item);return true;
 })}catch{}finally{notificationVisitorDelivering=false}
 if(!notificationActive&&notificationQueue.length&&notificationQueue[0]!==item)void deliverVisitorNotification();
}
function showNotification(item){
 dismissNotification(false);notificationActive=item;
 let banner=document.getElementById('songrimNotification');
 if(!banner){
  banner=document.createElement('aside');banner.id='songrimNotification';banner.className='notification-banner';banner.setAttribute('aria-label',APP_BRAND.ko+' 알림');document.body.append(banner);
  banner.addEventListener('mouseenter',()=>clearTimeout(notificationHideTimer));
  banner.addEventListener('focusin',()=>clearTimeout(notificationHideTimer));
  banner.addEventListener('mouseleave',scheduleNotificationDismiss);
  banner.addEventListener('focusout',()=>queueMicrotask(scheduleNotificationDismiss));
 }
 const visitor=FOREST_VISITORS.find(v=>v.id===item.id),isVisitor=item.type==='visitor';
 const title=isVisitor?(visitor?.name||'새 친구')+'의 첫 방문이에요':'오늘의 경험을 남겨볼까요?';
 const body=isVisitor?(item.preview?'새 친구를 만나면 이렇게 알려드려요.':'나의 숲에서 만난 친구를 도감에 담았어요.'):'책 한 쪽, 영화 한 장면도 좋아요.';
 const art=isVisitor?'<svg viewBox="-36 -44 72 60" aria-hidden="true">'+visitorArt(item.id)+'</svg>':icon('today');
 banner.innerHTML='<span class="notification-banner-icon '+(isVisitor?'visitor-icon':'')+'">'+art+'</span><div class="notification-banner-copy"><div role="status" aria-live="polite" aria-atomic="true"><span class="notification-banner-kicker">'+(item.preview?'미리보기 · ':'')+(isVisitor?'새 방문객':'오늘 기록')+'</span><strong>'+esc(title)+'</strong><p>'+body+'</p></div>'+button(isVisitor?'도감 보기':'기록하러 가기','notificationOpen','notification-banner-action')+'</div>'+button(icon('close'),'notificationDismiss','notification-banner-close','aria-label="알림 닫기"');
 banner.hidden=false;scheduleNotificationDismiss();
}
function scheduleNotificationDismiss(){
 clearTimeout(notificationHideTimer);const banner=document.getElementById('songrimNotification');
 if(notificationActive&&!banner?.contains(document.activeElement)&&!banner?.matches(':hover'))notificationHideTimer=setTimeout(()=>dismissNotification(),12000);
}
function dismissNotification(next=true){
 clearTimeout(notificationHideTimer);notificationActive=null;
 const banner=document.getElementById('songrimNotification');if(banner){banner.hidden=true;banner.innerHTML=''}
 if(next)queueMicrotask(()=>deliverVisitorNotification());
}
function notificationSwitch(kind,label){
 return button('<span>'+(notificationPrefs[kind]?'켜짐':'꺼짐')+'</span><i aria-hidden="true"></i>','notificationToggle','forest-sound-switch','data-kind="'+kind+'" id="notification-'+kind+'" role="switch" aria-checked="'+notificationPrefs[kind]+'" aria-label="'+label+'"');
}
function renderNotificationSettings(){
 notificationPrefs=readNotificationPrefs();
 return '<section class="notification-settings"><div class="page-heading"><h1 class="page-title">알림</h1></div><p class="page-caption">기록할 시간과 숲의 새 소식을 알려드려요.</p>'+
 button('<span class="notification-sample-icon" aria-hidden="true"><img src="./assets/images/trees/sprout.webp" alt=""></span><span class="notification-sample-copy"><small>'+esc(APP_BRAND.ko)+' · '+esc(notificationPrefs.time)+' · 미리보기</small><strong>오늘 기록이 아직 없어요. 한 쪽만 읽어도 나무가 자라요.</strong></span>','notificationPreview','notification-sample','data-kind="daily" aria-label="기록 알림 미리보기"')+
 '<div class="settings-group"><h2>기록 습관</h2><div class="settings-card"><div class="notification-setting-row"><div class="notification-setting-copy"><strong>오늘 기록</strong><small>기록이 없을 때만 하루 한 번</small></div>'+notificationSwitch('daily','오늘 기록 알림')+'</div><div class="notification-time-row"><label for="notificationTime">알림 시간</label><span class="notification-time-pill'+(notificationPrefs.daily?'':' is-off')+'"><b id="notificationTimeText" aria-hidden="true">'+esc(notificationPrefs.time)+'</b><input id="notificationTime" type="time" value="'+notificationPrefs.time+'" '+(notificationPrefs.daily?'':'disabled')+' aria-describedby="notificationScope"></span></div></div></div>'+
 '<div class="settings-group"><h2>숲의 소식</h2><div class="settings-card"><div class="notification-setting-row"><div class="notification-setting-copy"><strong>새 방문객</strong><small>처음 만난 친구가 도감에 오르면</small></div>'+notificationSwitch('visitors','새 방문객 알림')+'</div></div>'+button('방문객 알림 미리보기','notificationPreview','notification-preview','data-kind="visitor"')+'</div>'+
 '<p class="notification-note" id="notificationScope">앱이 열려 있을 때만 표시돼요. 설정은 이 기기에 저장돼요.</p><p id="notificationSaveStatus" class="notification-save-status" role="status"></p></section>';
}
function updateNotificationSettings(){
 for(const kind of ['daily','visitors']){const b=document.getElementById('notification-'+kind);if(b){b.setAttribute('aria-checked',String(notificationPrefs[kind]));b.querySelector('span').textContent=notificationPrefs[kind]?'켜짐':'꺼짐'}}
 const input=document.getElementById('notificationTime');if(input){input.disabled=!notificationPrefs.daily;if(document.activeElement!==input)input.value=notificationPrefs.time}
}
function saveNotificationSettings(){
 const saved=notificationWrite(NOTIFICATION_STORAGE+notificationOwner,notificationPrefs);
 const status=document.getElementById('notificationSaveStatus');if(status)status.textContent=saved?'':'설정을 저장하지 못했어요. 이 화면을 닫기 전까지만 적용돼요.';
 updateNotificationSettings();syncNotifications();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(a==='notificationDismiss'){dismissNotification();return}
 if(a==='notificationOpen'){const item=notificationActive;dismissNotification();if(item?.type==='visitor')openCollection('visitors');else go('today');return}
 if(!a.startsWith('notification')||!notificationOwner||eligibleNotificationOwner()!==notificationOwner)return;
 if(a==='notificationToggle'&&['daily','visitors'].includes(b.dataset.kind)){
  notificationPrefs=readNotificationPrefs();notificationPrefs[b.dataset.kind]=!notificationPrefs[b.dataset.kind];saveNotificationSettings();
  if(!notificationPrefs.visitors)notificationQueue=[];return;
 }
 if(a==='notificationPreview')showNotification({type:b.dataset.kind==='visitor'?'visitor':'daily',id:b.dataset.kind==='visitor'?'rabbit':undefined,preview:true});
});
document.addEventListener('change',e=>{
 if(e.target.id!=='notificationTime'||!notificationOwner||eligibleNotificationOwner()!==notificationOwner)return;
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)){e.target.value=notificationPrefs.time;return}
 notificationPrefs=readNotificationPrefs();notificationPrefs.time=e.target.value;saveNotificationSettings();
});
document.addEventListener('visibilitychange',syncNotifications);
window.addEventListener('focus',syncNotifications);
window.addEventListener('pagehide',()=>{clearInterval(notificationInterval);notificationInterval=null;dismissNotification(false);notificationQueue=[]});
window.addEventListener('pageshow',syncNotifications);
window.addEventListener('storage',e=>{
 if(e.key===null||e.key?.startsWith(NOTIFICATION_STORAGE)||e.key===CLOUD_SESSION_STORAGE){syncNotifications();if(notificationOwner){notificationPrefs=readNotificationPrefs();updateNotificationSettings()}}
});
