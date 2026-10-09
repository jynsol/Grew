/* original script block 17 */
const SUPABASE_URL='https://gytfefnvpqqxveryhopw.supabase.co';
const DELETE_ACCOUNT_ENDPOINT=SUPABASE_URL+'/functions/v1/delete-account';
const CLOUD_PUBLIC_KEY_STORAGE='songrim.supabase.publishable-key.v1';
const CLOUD_SESSION_STORAGE='songrim.supabase.session.v1';
const CLOUD_LAST_EMAIL_STORAGE='songrim.supabase.last-email.v1';
let cloudSession=null,cloudApplying=false,cloudSyncTimer=null,cloudSyncStatus='local';

// The publishable key is meant to ship in browser code (Row Level Security guards the data).
// Once it is set here, nobody has to paste it; a key saved on the device (?debug) still wins.
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_1aHPXqrU3WJP8zDTlh-y2g_9RLnt_lP';
function cloudPublicKey(){try{return localStorage.getItem(CLOUD_PUBLIC_KEY_STORAGE)||SUPABASE_PUBLISHABLE_KEY}catch{return SUPABASE_PUBLISHABLE_KEY}}
function saveCloudPublicKey(v){try{localStorage.setItem(CLOUD_PUBLIC_KEY_STORAGE,String(v||'').trim())}catch{}}
function clearCloudSession(){cloudSession=null;try{localStorage.removeItem(CLOUD_SESSION_STORAGE)}catch{}}
function saveCloudSession(session){cloudSession=session||null;try{session?localStorage.setItem(CLOUD_SESSION_STORAGE,JSON.stringify(session)):localStorage.removeItem(CLOUD_SESSION_STORAGE)}catch{}}
function loadCloudSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_STORAGE)||'null')}catch{return null}}
function cloudAuthHeaders(token=''){
 const key=cloudPublicKey(),h={'Content-Type':'application/json','apikey':key};
 if(token)h.Authorization='Bearer '+token;
 return h;
}
async function cloudRequest(path,options={}){
 const key=cloudPublicKey();
 if(!key)throw Error('Supabase Publishable key 연결이 필요해요.');
 const res=await fetch(SUPABASE_URL+path,{...options,signal:options.signal||(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(20000):undefined),headers:{...cloudAuthHeaders(options.token||''),...(options.headers||{})}});
 let body=null,text='';
 try{text=await res.text();body=text?JSON.parse(text):null}catch{body=text}
 if(!res.ok){const error=Error(body?.msg||body?.message||body?.error_description||body?.error||('Supabase 오류 · HTTP '+res.status));error.status=res.status;throw error}
 return body;
}
async function cloudRefresh(){
 if(cloudRefreshPromise)return cloudRefreshPromise;
 const owner=cloudSession?.user?.id,generation=dataGeneration;if(!owner||!cloudSession?.refresh_token)return false;
 const run=async()=>{
  if(!ownerIsCurrent(owner,generation))return false;
  const stored=loadCloudSession();if(stored?.access_token!==cloudSession.access_token){cloudSession=stored;return true}
  try{const data=await cloudRequest('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:cloudSession.refresh_token})});
   if(!ownerIsCurrent(owner,generation)||data?.user?.id!==owner)return false;saveCloudSession(data);return true;
  }catch{return false}
 };
 cloudRefreshPromise=navigator.locks?.request?navigator.locks.request('songrim-token:'+owner,run):run();
 try{return await cloudRefreshPromise}finally{cloudRefreshPromise=null}
}

async function cloudLogin(email,password){
 const data=await cloudRequest('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
 saveCloudSession(data);activateDataOwner(data.user.id);return data;
}
async function cloudSignup(email,password){
 return cloudRequest('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});
}
// Recovery credentials stay in memory and never replace the active account session.
let passwordRecoveryToken='',passwordRecoveryEmail='',passwordRecoveryError='';
async function cloudRecover(email){
 const redirect=['http:','https:'].includes(location.protocol)?location.origin+location.pathname:'';
 return cloudRequest('/auth/v1/recover'+(redirect?'?redirect_to='+encodeURIComponent(redirect):''),{method:'POST',body:JSON.stringify({email})});
}
async function readRecoveryLink(raw){
 passwordRecoveryToken='';passwordRecoveryEmail='';
 const url=new URL(raw,location.href),hash=new URLSearchParams(url.hash.slice(1));
 const allowed=url.origin===new URL(SUPABASE_URL).origin||(url.origin===location.origin&&url.pathname===location.pathname);
 if(!allowed)throw Error(APP_BRAND.ko+' 비밀번호 재설정 메일의 링크를 붙여넣어주세요.');
 if(hash.get('error')||url.searchParams.get('error'))throw Error('만료되었거나 이미 사용한 링크예요. 재설정 메일을 다시 받아주세요.');
 const kind=hash.get('type')||url.searchParams.get('type');
 if(kind!=='recovery')throw Error('비밀번호 재설정 링크인지 확인해주세요. 새 메일을 받아 다시 시도할 수 있어요.');
 let token=hash.get('access_token');
 if(!token){
  const tokenHash=url.searchParams.get('token_hash')||url.searchParams.get('token');
  if(!tokenHash)throw Error('재설정 인증 정보가 없어요. 새 메일을 받아주세요.');
  const result=await cloudRequest('/auth/v1/verify',{method:'POST',body:JSON.stringify({token_hash:tokenHash,type:'recovery'})});
  token=result?.access_token;
 }
 if(!token)throw Error('재설정 인증을 완료하지 못했어요.');
 const user=await cloudRequest('/auth/v1/user',{method:'GET',token});
 passwordRecoveryToken=token;passwordRecoveryEmail=user.email||'';passwordRecoveryError='';
}
// Social login (Kakao, Apple, Google) through Supabase Auth. Each provider is switched on in the
// Supabase dashboard; the provider sends the user back here with the session tokens in the URL hash.
const OAUTH_PENDING='grew.oauth.pending',OAUTH_LINKING='grew.oauth.linking',OAUTH_NAMES={kakao:'카카오',apple:'Apple',google:'Google'};
function cloudOAuthStart(provider){
 if(!OAUTH_NAMES[provider])return;
 try{sessionStorage.setItem(OAUTH_PENDING,provider)}catch{}
 location.assign(SUPABASE_URL+'/auth/v1/authorize?provider='+encodeURIComponent(provider)+'&redirect_to='+encodeURIComponent(location.origin+location.pathname));
}
let oauthNotice='';
async function finishOAuthReturn(){
 let provider='';try{provider=sessionStorage.getItem(OAUTH_PENDING)||''}catch{}
 const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 if(!provider||(!hash.has('access_token')&&!hash.has('error')&&!query.has('error')))return '';
 let linking=false;try{linking=sessionStorage.getItem(OAUTH_LINKING)==='1';sessionStorage.removeItem(OAUTH_PENDING);sessionStorage.removeItem(OAUTH_LINKING)}catch{}
 try{history.replaceState(null,'',location.pathname)}catch{}
 if(hash.has('error')||query.has('error')){if(linking){oauthNotice=OAUTH_NAMES[provider]+' 계정을 연결하지 못했어요. 이미 다른 그루 계정에 연결돼 있을 수 있어요.';return ''}loginError=OAUTH_NAMES[provider]+' 로그인을 마치지 못했어요. 다시 시도해주세요.';return ''}
 try{
  const token=hash.get('access_token'),user=await cloudRequest('/auth/v1/user',{token}),expires=Number(hash.get('expires_in'))||3600;
  saveCloudSession({access_token:token,refresh_token:hash.get('refresh_token')||'',token_type:hash.get('token_type')||'bearer',expires_in:expires,expires_at:Math.floor(Date.now()/1000)+expires,user});
  if(linking)oauthNotice=OAUTH_NAMES[provider]+' 계정을 연결했어요.';
  return provider;
 }catch{loginError=OAUTH_NAMES[provider]+' 로그인을 확인하지 못했어요. 다시 시도해주세요.';return ''}
}
async function beginPasswordRecovery(){
 const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 if(hash.get('type')!=='recovery'&&query.get('type')!=='recovery'&&!hash.has('error')&&!query.has('code'))return false;
 const raw=location.href;
 try{history.replaceState(null,'',location.pathname)}catch{}
 try{await readRecoveryLink(raw);authRoute='resetPassword'}
 catch{passwordRecoveryError='재설정 링크가 만료되었거나 이 기기에서 확인할 수 없어요. 새 메일을 받아주세요.';authRoute='recover'}
 return true;
}
async function updateRecoveredPassword(password,confirmation){
 if(password.length<6)throw Error('비밀번호를 6자 이상 입력해주세요.');
 if(password!==confirmation)throw Error('비밀번호가 일치하지 않아요.');
 if(!passwordRecoveryToken)throw Error('재설정 메일을 다시 받아주세요.');
 await cloudRequest('/auth/v1/user',{method:'PUT',token:passwordRecoveryToken,body:JSON.stringify({password})});
 const token=passwordRecoveryToken;passwordRecoveryToken='';passwordRecoveryEmail='';
 try{await cloudRequest('/auth/v1/logout?scope=local',{method:'POST',token,body:'{}'})}catch{}
}

async function cloudLogout(){
 const session=cloudSession;clearTimeout(cloudSyncTimer);
 // All successful edits are already durable under this account key.
 clearCloudSession();activateDataOwner('local');
 try{if(session?.access_token)await cloudRequest('/auth/v1/logout?scope=local',{method:'POST',token:session.access_token,body:'{}'})}catch{}
}

async function deleteSongrimAccount(){
 const deletingOwner=dataOwner,deletingGeneration=dataGeneration;
 if(!cloudSession?.access_token)throw Error('다시 로그인한 뒤 회원탈퇴를 진행해주세요.');
 const key=cloudPublicKey();
 if(!key)throw Error('Supabase 연결 설정이 필요해요.');

 const res=await fetch(DELETE_ACCOUNT_ENDPOINT,{
  method:'POST',
  headers:{
   'Content-Type':'application/json',
   'apikey':key,
   'Authorization':'Bearer '+cloudSession.access_token
  },
  body:JSON.stringify({confirm:true})
 });

 let payload=null,text='';
 try{text=await res.text();payload=text?JSON.parse(text):null}catch{payload={message:text}}

 if(!res.ok)throw Error(payload?.message||payload?.error||('회원탈퇴 처리 실패 · HTTP '+res.status));

 // 서버에서 확인된 이 계정의 로컬 스냅샷만 삭제한다.
 if(localStorage.getItem(KEY+'.legacy-owner')===deletingOwner){localStorage.removeItem(KEY);localStorage.removeItem(KEY+'.legacy-owner');localStorage.removeItem(KEY+'.legacy-reviewed')}
 for(const key of Object.keys(localStorage))if(key===accountDataKey(deletingOwner)||key.startsWith(accountDataKey(deletingOwner)+':archive:'))localStorage.removeItem(key);
 if(!ownerIsCurrent(deletingOwner,deletingGeneration))return true;
 clearCloudSession();activateDataOwner('local');
 authSession={signedIn:false,finished:false};
 try{
  // Legacy unowned backups are retained; never delete another account snapshot.
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CLOUD_LAST_EMAIL_STORAGE);
 }catch{}
 state=Model.empty();
 authRoute='entry';
 view='today';
 return true;
}
// Account-owned durable snapshots. Never use the legacy shared record as an upload source.
let dataOwner='local',dataGeneration=0,dataEnvelope=null,durableState=null,unsavedState=null;
let cloudWritePromise=null,cloudRefreshPromise=null,cloudReloadPending=false;
const accountDataKey=owner=>'songrim.account-state.v1:'+encodeURIComponent(owner);
const stateFingerprint=value=>JSON.stringify({...value,filters:undefined});
const revisionID=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function readAccountEnvelope(owner=dataOwner){
 const raw=localStorage.getItem(accountDataKey(owner));if(!raw)return null;
 const value=JSON.parse(raw);
 if(value.owner!==owner||!value.state||typeof value.rev!=='string')throw Error('계정별 저장 기록을 확인해주세요.');
 return value;
}
function ownerIsCurrent(owner,generation=dataGeneration){
 return owner===dataOwner&&generation===dataGeneration&&owner===(cloudSession?.user?.id||'local')&&owner===(loadCloudSession()?.user?.id||'local');
}
function activateDataOwner(owner){
 clearTimeout(cloudSyncTimer);dataGeneration++;dataOwner=owner;notificationDataOwner=null;
 cloudReloadPending=false;unsavedState=null;dataEnvelope=null;state=Model.empty();
 try{dataEnvelope=readAccountEnvelope(owner);if(dataEnvelope){const removeAlbums=dataEnvelope.state.items?.some(c=>c.type==='album');state=Model.validate(dataEnvelope.state);if(removeAlbums)saveEnvelope({...dataEnvelope,rev:revisionID(),state:Model.clone(state),dirty:true})}storageOK=true}catch{storageOK=false}
 durableState=JSON.stringify(state);
 cloudSyncStatus=dataEnvelope?.conflict?'conflict':dataEnvelope?.dirty?'pending':owner==='local'?'local':'synced';
}
function saveEnvelope(envelope){
 localStorage.setItem(accountDataKey(envelope.owner),JSON.stringify(envelope));
 if(envelope.owner===dataOwner){dataEnvelope=envelope;durableState=JSON.stringify(envelope.state)}
}
function legacyReviewPending(){try{return dataOwner!=='local'&&localStorage.getItem(KEY+'.legacy-owner')===dataOwner&&!localStorage.getItem(KEY+'.legacy-reviewed')&&!!localStorage.getItem(KEY)}catch{return false}}
function cloudSaveStatusLabel(){return !storageOK?'기기 저장 확인 필요':cloudSyncStatus==='conflict'?'기록 충돌 확인 필요':cloudSyncStatus==='reauth'?'기기에 저장됨 · 다시 로그인 필요':cloudSyncStatus==='error'?'기기에 저장됨 · 전송 대기':cloudSyncStatus==='pending'||cloudSyncStatus==='syncing'?'기기에 저장됨 · 동기화 중':dataOwner==='local'?'이 기기에 저장 중':'기기와 클라우드에 저장됨'}
function showStorageStatus(){
 const status=$('cloudSaveStatus');if(status)status.textContent=cloudSaveStatusLabel();
 const el=$('storageAlert');if(!el)return;
 let message='',actions='';
 if(!storageOK){message='이 변경을 브라우저에 저장하지 못했어요. 입력 내용을 유지했어요. 공간을 확보한 뒤 다시 저장하거나 미저장 내용을 백업해주세요.';actions=button('미저장 내용 백업','backupUnsaved','textbtn')}
 else if(cloudReloadPending){message='다른 창에서 기록이 바뀌었어요. 작성 중인 내용을 백업한 뒤 최신 기록을 불러와주세요.';actions=button('작성 내용 백업','backupUnsaved','textbtn')+button('최신 기록 불러오기','reloadAccountData','textbtn')}
 else if(cloudSyncStatus==='conflict'){message='다른 기기의 기록과 충돌했어요. 이 기기 기록은 보관되어 있어요.';actions=button('두 기록 확인','resolveCloudConflict','textbtn')}
 else if(cloudSyncStatus==='reauth'){message='이 기기에 저장했어요. 로그인이 만료되어 클라우드 전송을 기다리고 있어요.';actions=button('다시 로그인','flowEmailLogin','textbtn')}
 else if(cloudSyncStatus==='error'){message='이 기기에 저장했어요. 클라우드 전송을 다시 시도해주세요.';actions=button('다시 전송','retryCloudSync','textbtn')+button('백업','backup','textbtn')}

 else if(legacyReviewPending()){message='계정별 저장으로 전환했어요. 전환 전의 기기 기록도 보관했으니 한 번 확인해주세요.';actions=button('이전 기록 확인','reviewLegacy','textbtn')}
 el.innerHTML=message?'<div class="storage-alert" role="status">'+message+actions+'</div>':'';
}
function persist(){
 try{
  bmRefresh(state);
  if(!ownerIsCurrent(dataOwner))throw Error('로그인 계정이 바뀌었어요.');
  const latest=readAccountEnvelope();
  if((latest?.rev||null)!==(dataEnvelope?.rev||null)){cloudReloadPending=true;throw Error('다른 창의 기록이 바뀌었어요.')}
  const changed=stateFingerprint(state)!==stateFingerprint(dataEnvelope?.state||Model.empty());
  const envelope={...dataEnvelope,owner:dataOwner,rev:revisionID(),state:JSON.parse(JSON.stringify(state)),dirty:!!dataEnvelope?.dirty||changed,baseKnown:!!dataEnvelope?.baseKnown,baseVersion:dataEnvelope?.baseVersion||null};
  saveEnvelope(envelope);storageOK=true;unsavedState=null;
  if(envelope.dirty&&dataOwner!=='local'){cloudSyncStatus=envelope.conflict?'conflict':'pending';scheduleCloudSync()}
  showStorageStatus();return true;
 }catch{
  unsavedState=JSON.parse(JSON.stringify(state));
  // Roll back the model, leaving live form controls intact for a retry.
  if(durableState)state=Model.validate(JSON.parse(durableState));
  storageOK=false;showStorageStatus();
  const error=$('formError')||$('flowError');if(error)error.textContent='저장하지 못했어요. 입력 내용을 확인한 뒤 다시 저장해주세요.';
  document.querySelectorAll('form button[type="submit"]:disabled').forEach(el=>el.disabled=false);
  return false;
 }
}
async function cloudAuthorized(path,options,owner,generation){
 if(!ownerIsCurrent(owner,generation))throw Error('계정이 변경되어 요청을 취소했어요.');
 try{return await cloudRequest(path,{...options,token:cloudSession.access_token})}
 catch(err){
  if(err.status!==401&&!/JWT|token.*expired/i.test(err.message))throw err;
  if(!await cloudRefresh()||!ownerIsCurrent(owner,generation))throw err;
  return cloudRequest(path,{...options,token:cloudSession.access_token});
 }
}
async function cloudFetchState(owner=dataOwner,generation=dataGeneration){
 if(owner==='local'||!cloudSession?.access_token)return null;
 const rows=await cloudAuthorized('/rest/v1/songrim_user_states?select=state,updated_at&user_id=eq.'+encodeURIComponent(owner)+'&limit=1',{method:'GET',headers:{Accept:'application/json'}},owner,generation);
 if(!ownerIsCurrent(owner,generation))throw Error('로그인 계정이 변경됐어요.');
 return Array.isArray(rows)&&rows.length?rows[0]:null;
}
async function cloudUpsertState(){
 if(cloudWritePromise)return cloudWritePromise;
 const owner=dataOwner,generation=dataGeneration;
 if(cloudApplying||owner==='local'||!cloudSession?.access_token||!ownerIsCurrent(owner,generation))return false;
 const work=async()=>{
  try{
   let envelope=readAccountEnvelope(owner);
   if(!envelope?.dirty)return true;
   if(envelope.conflict){cloudSyncStatus='conflict';return false}
   cloudSyncStatus='syncing';showStorageStatus();
   if(!envelope.baseKnown){await cloudLoadForSignedInUser();envelope=readAccountEnvelope(owner);if(!envelope?.dirty)return true;if(envelope.conflict)return false}
   if(!ownerIsCurrent(owner,generation))return false;
   const revision=envelope.rev,version=envelope.baseVersion;
   // Compare-and-swap avoids overwriting a row modified by another device.
   const path='/rest/v1/songrim_user_states'+(version?'?user_id=eq.'+encodeURIComponent(owner)+'&updated_at=eq.'+encodeURIComponent(version):'');
   const rows=await cloudAuthorized(path,{method:version?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:owner,state:envelope.state,updated_at:new Date().toISOString()})},owner,generation);
   if(!ownerIsCurrent(owner,generation))return false;
   if(!Array.isArray(rows)||!rows.length){await cloudLoadForSignedInUser();return false}
   const latest=readAccountEnvelope(owner);if(!latest)return false;
   saveEnvelope({...latest,baseKnown:true,baseVersion:rows[0].updated_at,dirty:latest.rev!==revision,rev:revisionID()});
   cloudSyncStatus=dataEnvelope.dirty?'pending':'synced';
   if(dataEnvelope.dirty)scheduleCloudSync();return true;
  }catch(err){
   if(!ownerIsCurrent(owner,generation))return false;
   if(err.status===409){try{await cloudLoadForSignedInUser()}catch{cloudSyncStatus='error'}}
   else cloudSyncStatus=err.status===401||err.status===403?'reauth':'error';
   return false;
  }finally{if(ownerIsCurrent(owner,generation))showStorageStatus()}
 };
 cloudWritePromise=(navigator.locks?.request?navigator.locks.request('songrim-sync:'+owner,work):work());
 try{return await cloudWritePromise}finally{cloudWritePromise=null;if(dataGeneration!==generation&&dataEnvelope?.dirty)scheduleCloudSync()}
}
function scheduleCloudSync(){
 if(cloudApplying||!cloudSession?.access_token||dataEnvelope?.conflict)return;
 clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>void cloudUpsertState(),500);
}
async function cloudLoadForSignedInUser(){
 const owner=cloudSession?.user?.id;if(!owner)return;
 if(dataOwner!==owner)activateDataOwner(owner);
 const generation=dataGeneration;notificationDataOwner=null;syncNotifications();
 const row=await cloudFetchState(owner,generation);
 if(!ownerIsCurrent(owner,generation))return;
 const latest=readAccountEnvelope(owner),remote=row?.state?Model.validate(row.state):null,removeRemoteAlbums=!!row?.state?.items?.some(c=>c.type==='album');
 if(latest?.dirty&&remote&&(!latest.baseKnown||latest.baseVersion!==row.updated_at)&&stateFingerprint(latest.state)!==stateFingerprint(remote)){
  saveEnvelope({...latest,rev:revisionID(),conflict:{state:remote,version:row.updated_at}});cloudSyncStatus='conflict';
 }else if(latest?.dirty&&(!remote||stateFingerprint(latest.state)!==stateFingerprint(remote))){
  saveEnvelope({...latest,rev:revisionID(),baseKnown:true,baseVersion:row?.updated_at||null});cloudSyncStatus='pending';scheduleCloudSync();
 }else{
  const next=remote||latest?.state||Model.empty();
  // Do not replace a live editor while a background request completes.
  if(modal&&latest&&stateFingerprint(next)!==stateFingerprint(state)){cloudReloadPending=true;cloudSyncStatus='pending';return}
  state=next;ensureCompletedSpeciesAssignments();
  saveEnvelope({owner,rev:revisionID(),state:JSON.parse(JSON.stringify(state)),baseKnown:true,baseVersion:row?.updated_at||null,dirty:!remote||removeRemoteAlbums});
  cloudSyncStatus=remote&&!removeRemoteAlbums?'synced':'pending';if(!remote||removeRemoteAlbums)scheduleCloudSync();
 }
 notificationDataOwner=owner;showStorageStatus();
}
async function cloudBootstrap(){
 const oauth=await finishOAuthReturn();
 if(!oauth&&await beginPasswordRecovery())return;
 cloudSession=loadCloudSession();activateDataOwner(cloudSession?.user?.id||'local');
 const bootGeneration=dataGeneration;
 if(!cloudSession?.access_token){authSession={signedIn:false,finished:false};authRoute=loginError?'login':'entry';return}
 authSession={signedIn:true,finished:state.onboarded===true,name:state.profile?.name||'',method:oauth?OAUTH_NAMES[oauth]:'이메일'};
 try{await cloudLoadForSignedInUser()}
 catch(err){if(bootGeneration!==dataGeneration)return;cloudSyncStatus=err.status===401||err.status===403?'reauth':'error';notificationDataOwner=dataOwner;showStorageStatus()}
 if(bootGeneration!==dataGeneration)return;
 if(dataOwner!==(cloudSession?.user?.id||'local'))return;
 authSession.name=state.profile?.name||'';authSession.finished=state.onboarded===true;saveSession();
 // A first social login still asks for the terms consent before starting.
 authRoute=authSession.finished?'app':oauth?'socialTerms':'profile';
 if(oauthNotice){const m=oauthNotice;oauthNotice='';setTimeout(()=>toast(m),400)}
}
async function handleCloudStorage(event){
 if(event.key===CLOUD_SESSION_STORAGE||event.key===null){
  const next=loadCloudSession(),owner=next?.user?.id||'local';cloudSession=next;
  if(owner===dataOwner)return;
  // A pending response can no longer apply state after this generation change.
  closeModal();activateDataOwner(owner);authSession={signedIn:owner!=='local',finished:false};authRoute='entry';view='today';render();
  if(owner!=='local'){await cloudBootstrap();render()}return;
 }
 if(event.key!==accountDataKey(dataOwner))return;
 if(modal||document.activeElement?.matches('input,textarea,select')){cloudReloadPending=true;showStorageStatus();return}
 try{const latest=readAccountEnvelope();if(latest&&latest.rev!==dataEnvelope?.rev){dataEnvelope=latest;state=Model.validate(latest.state);durableState=JSON.stringify(state);cloudSyncStatus=latest.conflict?'conflict':latest.dirty?'pending':'synced';render();showStorageStatus()}}catch{storageOK=false;showStorageStatus()}
}
function downloadStateSnapshot(value,label){download(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),'grew-'+label+'-'+Model.today()+'.json')}
function showCloudConflict(){
 const conflict=dataEnvelope?.conflict;if(!conflict)return;
 showModal('두 기기의 기록을 확인해주세요','<p>이 기기 '+state.items.length+'개 · 클라우드 '+conflict.state.items.length+'개. 선택하지 않은 기록도 이 기기에 별도 보관해요.</p>'+button('이 기기 기록 백업','backup','secondary')+button('클라우드 기록 백업','backupRemoteConflict','secondary')+button('클라우드 기록 사용','useRemoteConflict','primary')+button('이 기기 기록 사용','useLocalConflict','secondary'),'sync-conflict');
}
async function resolveCloudConflict(useLocal){
 const owner=dataOwner,generation=dataGeneration;
 try{
  const latest=readAccountEnvelope(),row=await cloudFetchState(owner,generation);if(!latest?.conflict||!row||!ownerIsCurrent(owner,generation))return;
  if(row.updated_at!==latest.conflict.version){await cloudLoadForSignedInUser();showCloudConflict();toast('클라우드 기록이 다시 바뀌었어요. 확인해주세요.');return}
  // Archive both snapshots before either choice can replace data.
  localStorage.setItem(accountDataKey(owner)+':archive:'+revisionID(),JSON.stringify(latest));
  state=Model.validate(useLocal?latest.state:row.state);
  saveEnvelope({owner,rev:revisionID(),state,baseKnown:true,baseVersion:row.updated_at,dirty:useLocal});
  cloudSyncStatus=useLocal?'pending':'synced';closeModal();render();if(useLocal)scheduleCloudSync();showStorageStatus();
 }catch{storageOK=false;showStorageStatus()}
}

function cloudSetupModal(message=''){
 showModal('Supabase 사용자 데이터 연결',
  '<p class="muted">브라우저용 <strong>Publishable key</strong>를 한 번 저장하면 이 기기에서는 다시 입력하지 않아도 돼요.</p>'+
  (message?'<p class="form-error">'+esc(message)+'</p>':'')+
  '<form id="cloudConfigForm"><label for="cloudPublicKey">Supabase Publishable key</label>'+
  '<input id="cloudPublicKey" type="password" autocomplete="off" spellcheck="false" placeholder="sb_publishable_...">'+
  '<p class="muted tiny">OCR.Space 키나 service_role 키를 넣지 마세요.</p>'+
  '<button class="primary" type="submit">연결 저장</button></form>','cloud-config');
}

const KEY='songrim.prototype.v3';
let forestEditMode=false,forestVisibilityObserver=null;
const typeName={book:'책',movie:'영화'},statusName={all:'전체',saved:'시작 전',active:'감상 중',done:'완료'};
let pendingForestArrival=null;
let state=Model.empty(),view='today',detailId=null,detailOrigin='scrap',picking=false,year=String(new Date().getFullYear()),month=Model.today().slice(0,7),modal=null,zoomState={scale:1,x:0,y:0},storageOK=true,toastTimer,undoAction=null,shareBlob=null,shareURL=null,photoFiles=[],ocrGeneration=0,ocrBusy=false,candidates=[],authMode=false,candidatePreview=null,candidatePreviewReturn=null;
const $=id=>document.getElementById(id);
function load(){
 cloudSession=loadCloudSession();activateDataOwner(cloudSession?.user?.id||'local');
 // Retain the original shared snapshot for review by the session present at migration.
 try{if(localStorage.getItem(KEY)&&cloudSession?.user?.id&&!localStorage.getItem(KEY+'.legacy-owner'))localStorage.setItem(KEY+'.legacy-owner',cloudSession.user.id)}catch{}
 // The pre-account shared key remains untouched for explicit backup/recovery.
 ensureCompletedSpeciesAssignments();remapDefaultSpeciesByCategory();
}

function now(){return Model.today(state.offset)}
function selected(){return Model.get(state,state.selected)}
function get(id){return Model.get(state,id)}
function button(text,action,cls='primary',attrs=''){return '<button type="button" class="'+cls+'" data-action="'+action+'" '+attrs+'>'+text+'</button>'}
function attr(id){return 'data-id="'+esc(id)+'"'}
function toast(message,undo){$('toast').classList.remove('planted');clearTimeout(toastTimer);undoAction=undo||null;$('toast').innerHTML='<span>'+esc(message)+'</span>'+(undo?button('취소','toastUndo',''):'');toastTimer=setTimeout(()=>{$('toast').innerHTML='';undoAction=null},undo?4500:2200)}
// A tap on the toast (outside its undo button) dismisses it at once.
document.addEventListener('click',e=>{const t=e.target.closest?.('#toast');if(t&&!e.target.closest('[data-action]'))dismissToast()});
function dismissToast(){$('toast').classList.remove('planted');clearTimeout(toastTimer);$('toast').innerHTML='';undoAction=null}
function commit(close=false){if(!persist())return false;if(close)closeModal();render();return true}
function focusPageHeading(){requestAnimationFrame(()=>{if(modal)return;const heading=$('page').querySelector('h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}})}
function go(next){forestMonthPopOpen=false;if(next==='calendar'){forestMode='month';forestShow='calendar';next='forest'}if(next==='forest'&&view!=='forest')forestViewportFrame=null;clearTimeout(mainSearchRenderTimer);mainSearchRenderTimer=null;if(view==='detail'&&next!=='detail')candidatePreview=null;closeModal();if(next!=='forest')forestEditMode=false;if(view==='calendar')sessionStorageSafe('calendarScroll',String(window.scrollY));if(view==='scrap')sessionStorageSafe('scroll',String(window.scrollY));view=next;picking=false;render();scrollPageTop();if(next==='scrap')window.scrollTo(0,Number(sessionStorageSafe('scroll'))||0);if(next==='calendar')window.scrollTo(0,Number(sessionStorageSafe('calendarScroll'))||0);focusPageHeading()}
function sessionStorageSafe(k,v){try{if(v!==undefined)sessionStorage.setItem('sr3-'+k,v);return sessionStorage.getItem('sr3-'+k)}catch{return null}}
function openDetail(id,origin=view){candidatePreview=null;detailId=id;detailOrigin=origin==='detail'?detailOrigin:origin;go('detail');const c=get(id);if(c?.type==='book'&&!cleanGenreValue(c.genre)&&c.genreSource!=='user'){enrichBookGenre(c).then(()=>{if(c.genre&&get(c.id)===c){ensureCompletedSpeciesAssignments();persist();if(view==='detail'&&detailId===id)render()}}).catch(()=>{})}}
function openCandidateDetail(c){
 // 추천(취향) 카드의 미저장 후보를 상세 화면에서 미리보기 위한 진입점. Model.add()를 호출하지 않는다.
 if(!c)return;
 candidatePreview={...c,id:null,logs:[],saves:[],completed:c.completed||null,rating:null,review:''};
 candidatePreviewReturn=authRoute;
 detailId=null;
 authRoute='app';
 go('detail');
}
function closeCandidateDetail(){
 const back=candidatePreviewReturn||'taste';
 candidatePreview=null;candidatePreviewReturn=null;
 authRoute=back;
 render();scrollPageTop();
}
function cover(c,small=false){return c.cover?'<img class="cover '+c.type+'" data-cover-kind="'+c.type+'" src="'+esc(c.cover)+'" alt="'+esc(c.title)+' 표지" decoding="async" loading="lazy">':'<div class="cover '+c.type+'" aria-label="'+esc(c.title)+' 표지 없음">'+icon(c.type)+'</div>'}
function row(c,choose=false){return '<button class="content-row" data-action="'+(choose?'choose':'detail')+'" '+attr(c.id)+'>'+cover(c)+'<div class="grow"><span class="badge">'+typeName[c.type]+'</span><div class="title">'+esc(c.title)+'</div><div class="creator">'+esc(c.creator||'제작자 미확인')+'</div><div class="content-row-meta"><span class="record-status '+Model.status(c)+'">'+statusName[Model.status(c)]+'</span>'+(validRating(c.rating)?'<span class="row-rating"><span class="rating-star" aria-hidden="true">★</span> '+c.rating+'</span>':'')+(c.saves.length>1?'<span>스크랩 '+c.saves.length+'회</span>':'')+'</div></div><span class="muted" aria-hidden="true">›</span></button>'}
function handleCoverError(event){
 const img=event.target;if(!img?.matches?.('img[data-cover-kind]'))return;
 const type=['book','movie'].includes(img.dataset.coverKind)?img.dataset.coverKind:'book';
 const fallback=document.createElement('span');fallback.className=img.dataset.coverMini?'mini-cover':'cover '+type+' cover-fallback';
 if(img.alt){fallback.setAttribute('role','img');fallback.setAttribute('aria-label',img.alt+' · 이미지를 불러오지 못했어요')}else fallback.setAttribute('aria-hidden','true');
 fallback.innerHTML=icon(type);img.replaceWith(fallback);
}
document.addEventListener('error',handleCoverError,true);
function menu(c){return '<details class="more"><summary aria-label="콘텐츠 메뉴">⋯</summary><div class="more-menu">'+button('다른 스크랩으로 바꾸기','pick','')+button('콘텐츠 상세 보기','detail','',attr(c.id))+'</div></details>'}
// Status bar tint follows the page colour (intro slides; every other screen uses the app background).
const INTRO_THEME_COLORS=['#EADFFC','#FCF0C2','#D2EED8'];
function syncThemeColor(){
 const meta=document.querySelector('meta[name="theme-color"]');if(!meta)return;
 const color=authRoute==='intro'?INTRO_THEME_COLORS[introductionStep]||'#F8F8F6':'#F8F8F6';
 meta.setAttribute('content',color);document.documentElement.style.backgroundColor=color;
}
function render(){
 showStorageStatus();
 syncLinkImport();
 syncForestSound();
 syncNotifications();
 window.__songrimForestCleanup?.();window.__songrimForestCleanup=null;
 forestVisibilityObserver?.disconnect();forestVisibilityObserver=null;
 if(authRoute!=='app'){renderEntry();syncThemeColor();return}
 syncThemeColor();
 $('tabs').hidden=false;$('page').classList.remove('entry-page','taste-page','intro-page','ob-page');$('page').dataset.view=view;document.body.classList.toggle('is-decorating',view==='forest'&&forestEditMode);$('head').dataset.view=view;document.body.dataset.view=view;
 const parentTab=view==='detail'?detailOrigin:view;
 const tab=['sound','notifications'].includes(parentTab)?'my':['calendar','shop','codex'].includes(parentTab)?'forest':parentTab;
 $('tabs').innerHTML=['today','scrap','forest','my'].map((t,i)=>'<button class="'+(tab===t?'active':'')+'" data-action="tab" data-tab="'+t+'" aria-current="'+(tab===t?'page':'false')+'">'+icon(t)+'<span class="tab-label">'+['오늘','스크랩','숲','마이'][i]+'</span></button>').join('');
 $('head').hidden=!['detail','calendar','sound','notifications','shop','codex'].includes(view);
 $('head').innerHTML=!$('head').hidden?'<div class="row">'+button(icon('back'),'back','iconbtn','aria-label="뒤로가기"')+'<span class="back-title">'+(['shop','codex'].includes(view)?'나의 숲':['sound','notifications'].includes(view)?'설정':view==='calendar'?'나의 숲 · 월간 기록':({today:'오늘',scrap:'스크랩',forest:'숲',calendar:'숲',my:'마이'}[detailOrigin]||'스크랩'))+'</span></div>'+(view==='detail'&&!candidatePreview&&get(detailId)?detailMenu(get(detailId)):view==='shop'&&BM_STORE_OPEN?(()=>{const q=bmCouponStatus();return button(BM_PAGE_ICONS.coupon+'쿠폰 '+q.balance+'장<span class="bm-wallet-go">'+BM_PAGE_ICONS.arrow+'</span>','collectionTab','bm-wallet-pill','data-tab="coupons" aria-label="쿠폰 '+q.balance+'장, 쿠폰 모으기"')})():''):'';
 $('tabs').hidden=view==='detail';
 $('page').innerHTML=({today:renderToday,scrap:renderScrap,forest:renderForest,calendar:renderCalendar,my:renderMy,sound:renderForestSoundSettings,notifications:renderNotificationSettings,detail:renderDetail,shop:renderShopPage,codex:renderCodexPage}[view]||renderToday)();
 if(view==='my'){
  let legacy=false,archives=false;try{legacy=localStorage.getItem(KEY)&&localStorage.getItem(KEY+'.legacy-owner')===dataOwner;archives=Object.keys(localStorage).some(key=>key.startsWith(accountDataKey(dataOwner)+':archive:'))}catch{}
  if(legacy||archives)$('page').insertAdjacentHTML('beforeend','<section class="settings-group"><h2>기록 보관함</h2><details class="settings-archive"><summary>이전 기록과 백업</summary>'+(archives?'<p>다른 기기와 충돌했을 때 보관한 기록을 내려받을 수 있어요.</p>'+button('보관 기록 확인','syncArchives','secondary'):'')+(legacy?'<p>계정별 저장으로 전환하기 전의 기록이에요. 필요한 경우 내려받아 복원할 수 있어요.</p>'+button('이전 기록 내려받기','legacyBackup','secondary'):'')+'</details></section>');
 }
 if(view==='forest')setupForest();
 if(view==='today')fitTodayTitle();
 updateForestSoundUI();
 if(!storageOK&& !$('storageAlert').innerHTML)$('storageAlert').innerHTML='<div class="storage-alert">이 환경에서는 자동 저장을 사용할 수 없어요.</div>';
}
function todayLogDates(c){
 return new Set((c.logs||[]).map(l=>l.date).filter(date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date));
}
// The streak and this week's dots are shared: any day you recorded any book or film counts.
// Which kinds were recorded on each day: {date: Set('book','movie')}.
function logKindsByDate(){const out={};for(const c of state.items||[]){const add=d=>{(out[d]=out[d]||new Set()).add(c.type)};todayLogDates(c).forEach(add);if(typeof c.completed==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.completed))add(c.completed)}return out}
function allLogDates(){const out=new Set();for(const c of state.items||[]){todayLogDates(c).forEach(d=>out.add(d));if(typeof c.completed==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.completed))out.add(c.completed)}return out}
function todayDateShift(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
// Calendar dates, not elapsed hours: this also keeps DST and year boundaries stable.
function weekDots(c,today=now()){
 const kinds=logKindsByDate(),weekday=new Date(today+'T12:00:00Z').getUTCDay(),monday=todayDateShift(today,-((weekday+6)%7));
 return Array.from({length:7},(_,i)=>{const date=todayDateShift(monday,i),k=date<=today&&kinds[date];const kind=!k?'':k.has('book')&&k.has('movie')?'both':k.has('movie')?'movie':'book';return {date,logged:!!kind,kind,isToday:date===today,isFuture:date>today}});
}
function streakDays(c,today=now()){
 const logged=allLogDates();let date=logged.has(today)?today:todayDateShift(today,-1),days=0;
 while(logged.has(date)){days++;date=todayDateShift(date,-1)}return days;
}

function scrapAddButton(){return button(icon('plus')+'<span>스크랩</span>','add','heading-scrap','aria-label="스크랩 추가"')}
function todayHeading(title='오늘',actions=''){return '<div class="page-heading"><h1 class="page-title">'+title+'</h1><div class="page-heading-actions">'+scrapAddButton()+actions+'</div></div>'}
// The work in progress stays on Today: the most recently read one wins over unstarted scraps.
let todayPickedId=null;
function lastReadDate(c){return [c.startedAt,...(c.logs||[]).map(l=>l.date)].filter(Model.validDate).sort().at(-1)||''}
function latestReading(exceptId){return state.items.filter(x=>!x.completed&&Model.stage(x)>0&&x.id!==exceptId).sort((a,b)=>lastReadDate(b).localeCompare(lastReadDate(a)))[0]||null}
function renderTodayBase(){
 let c=selected();if(c?.completed)c=null;
 // An unstarted scrap only replaces the reading work when it was picked in this session.
 if(!c||Model.stage(c)===0&&c.id!==todayPickedId)c=latestReading()||c;
 if(!state.onboarded&&!state.items.length)return '<section>'+todayHeading()+'<div class="center today-empty">'+growth(0)+'<h2>첫 작품을 담아보세요</h2><p class="creator">책과 영화를 기록할 수 있어요.</p><div class="space"></div>'+button('첫 스크랩 추가하기','add')+'</div></section>';
 if(!c){
  const candidates=state.items.filter(c=>!c.completed).sort((a,b)=>b.saves.length-a.saves.length||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0));
  const skip=Number(sessionStorageSafe('candidate'))||0,chosen=candidates[skip%candidates.length];
  if(!chosen)return renderDiscovery();
  c=chosen;
 }

 return todayBoard(c);
}
// Sticker board (redesign 5a): the tree sticker leads, the stamp records, the week stays small.
const STICKER_TREE_KEYS={0:'seed',1:'sprout',2:'young'};
function stickerTreeSrc(c,stage=Model.stage(c)){
 const key=stage<3?growthKey(c,stage):c.hiddenTree?(c.hiddenTree==='A'?'shining':'moonlight'):contentSpecies(c)?.id;
 return (SONGLIM_TREE_ASSETS[key]||SONGLIM_TREE_ASSETS.oak).src;
}
function stickerTree(c,stage=Model.stage(c),cls=''){
 const name=stage<3?growthAppearance(stage,c).name:(c.hiddenTree?bmTreeName('mystery-'+c.hiddenTree):contentSpecies(c)?.name||'나무');
 return '<img class="sticker-tree '+cls+'" src="'+esc(stickerTreeSrc(c,stage))+'" alt="'+esc(name)+'" decoding="async">';
}
// "N일째" counts the days actually recorded, not calendar days since the first one.
function todayDayCount(c){return todayLogDates(c).size}
// Books show the day count; a film is watched in one sitting, so it shows its running time.
function todayStageSuffix(c){
 if(c.type==='movie'){const minutes=Number(c.runtime)||0;return minutes>0?minutes+'분':''}
 const days=todayDayCount(c);return Model.stage(c)&&days?days+'일째':'';
}
function todayLogOf(c){return c.logs.find(l=>l.date===now())}
// A rubber stamp: thick and thin rings, curved GREW / date lettering, stars and one bold word.
// Pressed, it prints as a rough-edged ink imprint in the work's colour.
function stampSVG(c,done){
 const d=now(),date=d.slice(0,4)+'.'+d.slice(5,7)+'.'+d.slice(8,10),movie=c.type==='movie';
 const word=done?'DONE':'';
 const center=done?'<text class="stamp-word" x="60" y="71" text-anchor="middle">'+word+'</text>':'<text class="stamp-small" x="60" y="61" text-anchor="middle">오늘</text><text class="stamp-mid" x="60" y="77" text-anchor="middle">'+(movie?'봤어요':'읽었어요')+'</text>';
 return '<svg class="stamp-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="stampArcTop" d="M21 60a39 39 0 0 1 78 0"/><path id="stampArcBottom" d="M13 60a47 47 0 0 0 94 0"/>'+
  (done?'<filter id="stampRough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.45" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>':'')+'</defs>'+
  '<g'+(done?' filter="url(#stampRough)"':'')+'><g fill="none" stroke="currentColor"><circle cx="60" cy="60" r="56" stroke-width="3.4"/><circle cx="60" cy="60" r="51" stroke-width="1.1"/><circle cx="60" cy="60" r="35" stroke-width="1.4"/></g>'+
  '<g fill="currentColor"><text class="stamp-arc"><textPath href="#stampArcTop" startOffset="50%" text-anchor="middle">GREW · TODAY</textPath></text><text class="stamp-arc"><textPath href="#stampArcBottom" startOffset="50%" text-anchor="middle">'+date+'</textPath></text>'+
  '<text class="stamp-stars" x="60" y="'+(done?47:44)+'" text-anchor="middle">★ ★ ★</text>'+center+'<circle cx="16" cy="60" r="1.6"/><circle cx="104" cy="60" r="1.6"/></g></g></svg>';
}
function todayStamp(c){
 const stage=Model.stage(c),log=c.logs.find(l=>l.date===now()),verb=c.type==='movie'?'봤어요':'읽었어요';
 if(stage===0)return button('<span class="stamp-start-label">'+(c.type==='movie'?'보기<br>시작':'읽기<br>시작')+'</span>','startExperience','stamp-button is-start',attr(c.id)+' aria-label="'+(c.type==='movie'?'보기 시작하기':'읽기 시작하기')+'"');
 if(log)return '<div class="stamp-done"><div class="stamp-button is-done" role="img" aria-label="오늘 기록했어요">'+stampSVG(c,true)+'</div></div>';
 // Not yet stamped: a plain grey face (no rings) so it reads clearly apart from the printed stamp.
 return button('<span class="stamp-face"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>오늘<br>'+verb+'</span></span>','record','stamp-button',attr(c.id)+' aria-label="오늘 '+verb+'"');
}
// Long titles shrink until the whole title fits in two lines next to the cover stickers.
// Long titles shrink until the whole title fits in two lines beside the cover.
function fitTodayTitle(){
 const el=document.querySelector('.today-panel-title h1 button');if(!el)return;
 el.classList.add('is-fitting');el.classList.remove('is-long');let size=22;
 const apply=()=>{el.style.fontSize=size+'px';el.style.letterSpacing=size>=19?'':'-.025em'};
 const fits=(lines=2)=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=size*1.2*lines+2;
 apply();
 while(size>16&&!fits()){size--;apply()}
 // Very long titles get up to four lines at the smallest size rather than an ellipsis.
 if(!fits())el.classList.add('is-long');
 el.classList.remove('is-fitting');
}
addEventListener('resize',()=>{if(view==='today')fitTodayTitle()});
// Books are read and films are watched; a mixed list uses the app's shared status name.
function progressLabel(){return statusName.active}
function openReadingList(currentId){
 const list=state.items.filter(x=>!x.completed&&Model.stage(x)>0&&x.id!==currentId).sort((a,b)=>Math.max(0,...b.logs.map(l=>Date.parse(l.date)||0))-Math.max(0,...a.logs.map(l=>Date.parse(l.date)||0)));
 showModal(progressLabel(list)+'인 작품','<div class="content-list">'+list.map(x=>row(x,true)).join('')+'</div>'+button('다른 스크랩에서 고르기','pick','secondary'),'reading');
}
function todayStickerWeek(c){
 const streak=streakDays(c),names=['월','화','수','목','금','토','일'];
 return '<section class="sticker-week" aria-label="이번 주 기록"><h2>이번 주'+(streak?'<span class="tv-streak">연속 '+streak+'일</span>':'')+'</h2><ol>'+weekDots(c).map((d,i)=>'<li class="'+(d.logged?'is-logged is-'+d.kind+' ':'')+(d.isToday?'is-today ':'')+(d.isFuture?'is-future':'')+'" aria-label="'+d.date+' '+names[i]+'요일'+(d.isToday?' · 오늘':'')+' · '+(d.logged?'기록함':d.isFuture?'예정':'기록 없음')+'"'+(d.isToday?' aria-current="date"':'')+'>'+names[i]+'</li>').join('')+'</ol></section>';
}
function todayBoard(c){
 const stage=Model.stage(c),readingItems=state.items.filter(x=>!x.completed&&x.id!==c.id&&Model.stage(x)>0),reading=readingItems.length,readingLabel=progressLabel(readingItems),others=state.items.some(x=>!x.completed&&x.id!==c.id),date=new Date(now()+'T12:00:00Z');
 const dateLabel=String(date.getUTCMonth()+1).padStart(2,'0')+'.'+String(date.getUTCDate()).padStart(2,'0')+' '+['SUN','MON','TUE','WED','THU','FRI','SAT'][date.getUTCDay()];
 const coverArt=c.cover?'<img src="'+esc(c.cover)+'" alt="" decoding="async">':'<span class="sticker-cover-blank" aria-hidden="true"></span>';
 const completeLabel=stage===0?(c.type==='movie'?'이미 다 봤어요':'이미 다 읽었어요'):(c.type==='movie'?'다 봤어요':'다 읽었어요');
 // A trailing "(…)" in a book title reads as its subtitle, as in the design.
 const split=String(c.title).match(/^(.+?)\s*[(（]([^()（）]+)[)）]\s*$/),mainTitle=split?split[1]:c.title;
 const suffix=todayStageSuffix(c),sub=split?split[2]:c.originalTitle&&c.originalTitle!==c.title?c.originalTitle:'';
 // Today (Apple-style): coral date over a large title, a gradient hero card with the work and its
 // tree in a soft disc, then a white week card with the stamp. Stages are not a goal, so no progress ring.
 // Big count: films with a known running time show minutes, everything else the days recorded.
 const minutes=c.type==='movie'?Number(c.runtime)||0:0,count=minutes||todayDayCount(c),unit=minutes?'분':'일째';
 return '<section class="sticker-today today-v2" data-type="'+c.type+'" data-stage="'+stage+'">'+
 '<header class="tv-head"><div class="sticker-top"><div class="sticker-titles"><h1 class="page-title">오늘</h1></div><div class="page-heading-actions">'+scrapAddButton()+'</div></div></header>'+
 '<article class="today-panel tv-hero">'+
  '<div class="tv-hero-top"><span class="tv-tag">'+(stage?statusName.active:statusName.saved)+'</span>'+
   (reading?button('⇄ '+readingLabel+' '+reading,'readingList','sticker-switch',attr(c.id)+' aria-label="함께 '+readingLabel+'인 작품 '+reading+'개 보기"'):others?button('⇄ 다른 작품','pick','sticker-switch','aria-label="다른 작품 고르기"'):'')+'</div>'+
  '<div class="tv-hero-main"><div class="today-panel-title"><h1 class="page-title"><button type="button" data-action="detail" '+attr(c.id)+' aria-label="'+esc(c.title)+'">'+esc(mainTitle)+'</button></h1>'+(sub?'<span>'+esc(sub)+'</span>':'')+(c.creator?'<span class="today-panel-kicker">'+esc(c.creator)+'</span>':'')+(c.type==='movie'?button('보러 가기 ↗','external','tv-watch',attr(c.id)):'')+'</div>'+
  '<button type="button" class="sticker-cover" data-action="detail" '+attr(c.id)+' aria-label="'+esc(c.title)+' 상세 보기">'+coverArt+'</button></div>'+
  '<i class="tv-sun" aria-hidden="true"></i>'+stickerTree(c,stage,'today-tree')+
  '<div class="today-stage tv-count">'+'<b>'+(stage?count:0)+'</b><small>'+(stage?unit:'일째')+'</small><span>'+esc(growthAppearance(stage,c).name)+(stage?'':' · 시작 전')+'</span></div>'+
 '</article>'+
 '<article class="tv-week sticker-actions"><div class="sticker-actions-left">'+todayStickerWeek(c)+'<div class="sticker-links">'+button(completeLabel,'complete','textbtn sticker-complete',attr(c.id))+(todayLogOf(c)?button('기록 취소','undoLog','textbtn',attr(c.id)):'')+'</div></div>'+todayStamp(c)+'</article>'+
 '</section>';
}

// Scrap rows (redesign 11a): cover, title, type · creator, status chip, the work's tree sticker.
function stickerCover(c,cls=''){return '<span class="sticker-cover-art '+cls+'" data-type="'+c.type+'">'+(c.cover?'<img src="'+esc(c.cover)+'" alt="" decoding="async" loading="lazy" data-cover-kind="'+c.type+'">':'')+'</span>'}
function scrapStatusLabel(c){const status=Model.status(c);return status==='done'?'완료':status==='active'?statusName.active:statusName.saved}
function scrapCard(c,choose=false){
 const status=Model.status(c),stage=Model.stage(c);
 return '<button type="button" class="scrap-row" data-type="'+c.type+'" data-action="'+(choose?'choose':'detail')+'" '+attr(c.id)+' aria-label="'+esc(c.title)+' · '+scrapStatusLabel(c)+'">'+stickerCover(c)+
 '<span class="scrap-row-body"><strong>'+esc(c.title)+'</strong><small>'+esc(c.creator||'제작자 미확인')+'</small><span class="scrap-row-marks"><span class="scrap-type is-'+c.type+'">'+(c.type==='movie'?'MOVIE':'BOOK')+'</span>'+(status==='done'?'':'<span class="scrap-status is-'+status+'">'+scrapStatusLabel(c)+'</span>')+(validRating(c.rating)?'<span class="scrap-rating"><b>★</b> '+c.rating+'</span>':'')+'</span></span>'+
 '<span class="scrap-tree-slot">'+(c.completed?stickerTree(c,stage,'is-cut-sm'):'')+'</span></button>';
}

let pickingFilters={q:'',type:'all',status:'all',sort:'recent'};
const SCRAP_SORT_LABELS={recent:'최근 담은 순',many:'많이 담은 순',completed:'최근 완료한 순',rating:'별점 높은 순'};
function scrapCompletionOrder(c){if(!c.completed)return -1;const date=c.completed==='unknown'?NaN:Date.parse(c.completed+'T12:00:00');return Number.isFinite(date)?date:Number(c.completedAt)||0}
function activeScrapFilters(){return picking?pickingFilters:state.filters}
function updateScrapFilters(values,close=false){
 clearTimeout(mainSearchRenderTimer);mainSearchRenderTimer=null;
 Object.assign(activeScrapFilters(),values);
 if(!picking&&!persist())return false;
 if(close)closeModal();render();return true;
}
function openScrapFilters(){
 clearTimeout(mainSearchRenderTimer);mainSearchRenderTimer=null;
 const f=activeScrapFilters();
 const option=(name,value,label,selected)=>'<label class="scrap-filter-option"><input type="radio" name="'+name+'" value="'+esc(value)+'" '+(selected?'checked':'')+'><span>'+esc(label)+'</span></label>';
 const status=picking?'':'<fieldset class="scrap-filter-group is-chips"><legend>경험 상태</legend><div class="scrap-filter-options">'+['all','saved','active','done'].map(value=>option('status',value,statusName[value],f.status===value)).join('')+'</div></fieldset>';
 const sort='<fieldset class="scrap-filter-group is-list"><legend>정렬</legend><div class="scrap-filter-options">'+Object.entries(SCRAP_SORT_LABELS).map(([value,label])=>option('sort',value,label,f.sort===value)).join('')+'</div></fieldset>';
 showModal('필터·정렬','<form id="scrapFilterForm">'+status+sort+'<div id="formError" class="form-error" role="alert"></div><div class="scrap-filter-footer">'+button('초기화','scrapFilterDraftReset','textbtn')+'<button type="submit" class="primary">적용하기</button></div></form>','scrap-filters');
}
function renderScrap(){
 const f=activeScrapFilters();
 const list=state.items.filter(c=>(!picking||!c.completed)&&(picking||f.status==='all'||Model.status(c)===f.status)&&(f.type==='all'||c.type===f.type)&&Model.norm(c.title+' '+c.creator).includes(Model.norm(f.q)));
 list.sort((a,b)=>f.sort==='rating'?(validRating(b.rating)??-1)-(validRating(a.rating)??-1)||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0):f.sort==='many'?b.saves.length-a.saves.length||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0):f.sort==='completed'?scrapCompletionOrder(b)-scrapCompletionOrder(a)||(b.completedAt||0)-(a.completedAt||0)||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0):(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0));
 const typeTabs='<div class="type-tabs" role="group" aria-label="콘텐츠 유형">'+['all','book','movie'].map(t=>button(t==='all'?'전체':typeName[t],'filterType','type-tab '+(f.type===t?'active':''),'data-type="'+t+'" aria-pressed="'+(f.type===t)+'"')).join('')+'</div>';
 const applied=[];
 if(!picking&&f.status!=='all')applied.push(button(esc(statusName[f.status])+' '+icon('close'),'clearScrapStatus','scrap-applied-filter','aria-label="경험 상태 필터 해제"'));
 if(f.sort!=='recent')applied.push(button(esc(SCRAP_SORT_LABELS[f.sort])+' '+icon('close'),'clearScrapSort','scrap-applied-filter','aria-label="최근 담은 순으로 초기화"'));
 const count='<span class="sr-only" role="status" aria-live="polite">'+list.length+'개'+(picking?' · 미완료 작품':'')+'</span>';
 const filterLabel=icon('filter')+'필터·정렬'+(applied.length?'<span class="scrap-filter-count">'+applied.length+'</span>':'');
 const filterButton=button(filterLabel,'scrapFilters','scrap-filter-trigger','aria-haspopup="dialog" aria-label="필터와 정렬'+(applied.length?' · '+applied.length+'개 적용':'')+'"'),appliedHTML=applied.length?'<div class="scrap-applied-filters" aria-label="적용한 필터">'+applied.join('')+'</div>':'';
 return '<section class="scrap-page"><div class="page-heading"><h1 class="page-title">'+(picking?'오늘 경험할 작품':'나의 스크랩<span class="scrap-heading-count">'+state.items.length+'</span>')+'</h1>'+(picking?button('취소','cancelPick','textbtn'):scrapAddButton())+'</div><div class="scrap-tools">'+typeTabs+filterButton+'</div><div class="scrap-fixed-search">'+icon('search')+'<input id="search" type="search" placeholder="제목·제작자 검색" aria-label="스크랩 검색" value="'+esc(f.q)+'"></div>'+count+appliedHTML+'<div class="content-list scrap-list">'+(list.length?list.map(c=>scrapCard(c,picking)).join(''):(state.items.length?'<div class="empty"><span class="empty-icon" aria-hidden="true">'+icon('search')+'</span><h3>일치하는 작품이 없어요</h3><p>다른 제목이나 제작자로 검색하거나<br>선택한 필터를 초기화해보세요.</p>'+button('검색·필터 초기화','resetFilters','secondary')+'</div>':'<div class="empty"><span class="empty-icon" aria-hidden="true">'+icon('scrap')+'</span><h3>첫 작품을 담아보세요</h3><p>읽고 싶은 책과<br>보고 싶은 영화를 모아보세요.</p>'+button('작품 추가하기','add','primary')+'</div>'))+'</div><div class="list-footer"></div></section>';
}
function contentIntroText(c){
 // 상세 화면 전용: tasteIntroText()와 달리 절대 자르지 않고 원본 필드를 그대로 반환한다.
 if(!c)return '';
 if(c.type==='movie')return String(c.overview||'').trim();
 if(c.type==='album')return String(c.albumDescription||c.contents||c.description||'').trim();
 return String(c.contents||'').trim();
}
function detailMenu(c){return '<details class="more detail-more"><summary aria-label="콘텐츠 관리">⋯</summary><div class="more-menu">'+button('기본 정보 수정','editInfo','',attr(c.id))+(c.completed?button('완료 취소','undoComplete','',attr(c.id)):Model.stage(c)>0?button('기록 초기화','resetRecords','',attr(c.id)):'')+button('스크랩 삭제','delete','',attr(c.id))+'</div></details>'}
function renderDetail(){
 const c=candidatePreview||get(detailId);if(!c)return '<div class="empty">이 콘텐츠가 없어요.'+button('스크랩으로','toScrap','textbtn')+'</div>';
 if(c.type==='book'&&!detailIntroAttempts.has(detailIntroKey(c))&&(!c.contents||looksTruncatedIntro(c.contents)))setTimeout(()=>ensureDetailIntro(c),0);
 const introHTML=contentIntroText(c)?'<div class="rule"></div><h3>작품 소개</h3><p class="detail-intro">'+esc(contentIntroText(c))+'</p>':'';
 if(candidatePreview){
  // 추천 후보 미리보기: Model.add()를 호출하지 않으므로 id가 없다. 편집·삭제·기록 등 저장 전제 기능은 노출하지 않는다.
  return '<section><div class="detail-title-row"><div><h1>'+esc(c.title)+'</h1>'+(c.originalTitle&&c.originalTitle!==c.title?'<p class="original-title">'+esc(c.originalTitle)+'</p>':'')+'</div></div><p class="creator">'+esc(c.creator||'제작자 미확인')+' · '+typeName[c.type]+' · 추천 후보 · 아직 스크랩 전</p><div class="row">'+cover(c)+'</div>'+detailMetadata(c)+introHTML+'</section>';
 }
 const logs=[...c.logs].sort((a,b)=>b.date.localeCompare(a.date)),stage=Model.stage(c),logDays=todayLogDates(c).size,days=todayDayCount(c);
 const genre=cleanGenreValue(c.genre)?launchGenre(c.type,c.genre,c):'';
 const chips=c.completed?'<span class="detail-chip is-ink"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>완료 · '+(c.completed==='unknown'?'날짜 미상':esc(c.completed.slice(5).replace('-','.')))+'</span>'+'<button type="button" class="detail-chip detail-chip-rating" data-action="rating" '+attr(c.id)+' aria-label="별점 '+(validRating(c.rating)?c.rating+'점 · 수정':'남기기')+'"><b>★</b> '+(validRating(c.rating)?c.rating:'별점 남기기')+'</button>':
  '<span class="detail-chip is-ink">'+esc(growthAppearance(stage,c).name)+'</span>'+(stage>0?'<span class="detail-chip">'+[days&&c.type==='book'?days+'일째':'',c.type==='movie'&&Number(c.runtime)?Number(c.runtime)+'분':'',c.type==='movie'?'기록 '+logDays+'회':''].filter(Boolean).join(' · ')+'</span>':'');
 const logRow=l=>'<button type="button" class="detail-log" data-action="editLog" '+attr(c.id)+' data-log="'+esc(l.id)+'"><span>'+esc(l.date.slice(5).replace('-','.'))+'</span><span class="'+(l.memo||l.page?'':'is-empty')+'">'+(l.memo?esc(l.memo):l.page?esc(l.page)+'쪽':'+ 메모 남기기')+'</span></button>';
 const todayLog=c.logs.find(l=>l.date===now()),verb=c.type==='movie'?'봤어요':'읽었어요';
 const actions=c.completed?'':'<div class="detail-actions">'+(stage===0?button(c.type==='movie'?'이미 다 봤어요':'이미 다 읽었어요','complete','detail-action-secondary',attr(c.id))+button(c.type==='movie'?'보기 시작하기':'읽기 시작하기','startExperience','detail-action-primary',attr(c.id)):
  button(c.type==='movie'?'다 봤어요':'다 읽었어요','complete','detail-action-secondary',attr(c.id))+(todayLog?button('오늘 기록했어요 · '+(todayLog.memo?'메모 수정':'메모'),'editLog','detail-action-primary is-done',attr(c.id)+' data-log="'+esc(todayLog.id)+'"'):button('<i aria-hidden="true"></i>오늘 '+verb,'record','detail-action-primary',attr(c.id))))+'</div>';
 // Records sit at the bottom: something to scroll down to, not the page's lead.
 // Memos, not reading dates: free notes plus any memo written on a record day, newest first.
 const memos=[...(c.notes||[]).map(n=>({kind:'note',id:n.id,date:n.date,text:n.text})),...c.logs.filter(l=>String(l.memo||'').trim()).map(l=>({kind:'log',id:l.id,date:l.date,text:l.memo}))].sort((a,b)=>b.date.localeCompare(a.date));
 const memoRow=m=>'<button type="button" class="detail-memo" data-action="'+(m.kind==='note'?'editNote':'editMemo')+'" '+attr(c.id)+(m.kind==='note'?' data-note="':' data-log="')+esc(m.id)+'"><span>'+esc(m.text)+'</span><small>'+esc(m.date.slice(2).replace(/-/g,'.'))+'</small></button>';
 const recordsHTML='<div class="detail-section detail-memos"><div class="detail-memos-head"><h2>메모</h2>'+button('+ 메모 남기기','addNote','detail-memo-add',attr(c.id))+'</div>'+(memos.length?'<div class="detail-memo-list">'+memos.map(memoRow).join('')+'</div>':'<p class="detail-empty">아직 메모가 없어요.</p>')+'</div>';
 return '<section class="detail-page" data-type="'+c.type+'"><div class="detail-panel">'+stickerCover(c,'detail-cover')+'<span class="detail-tree">'+stickerTree(c,stage)+'</span>'+'</div>'+
 '<div class="detail-head"><span class="detail-kicker"><span class="scrap-type is-'+c.type+'">'+(c.type==='movie'?'MOVIE':'BOOK')+'</span>'+(genre?esc(genre):'')+'</span><h1>'+esc(c.title)+'</h1>'+(c.originalTitle&&c.originalTitle!==c.title?'<p class="original-title">'+esc(c.originalTitle)+'</p>':'')+'<p class="detail-creator">'+esc(c.creator||'제작자 미확인')+(c.publisher?' · '+esc(c.publisher):'')+'</p></div>'+
 '<div class="detail-chips">'+chips+'</div>'+
 
 '<div class="detail-section detail-about">'+detailMetadata(c)+button('나무 모습 바꾸기','bmWorkTree','textbtn detail-tree-change',attr(c.id))+'</div>'+
 (introHTML?'<div class="detail-section">'+introHTML+'</div>':'')+recordsHTML+renderLinkSources(c)+actions+'</section>';
}
function forestGrowthKey(c){
 if(!c||!c.id||c._bmSample||!['book','movie'].includes(c.type)||c.completed)return '';
 const stage=Model.stage(c);return stage===1||stage===2?growthKey(c,stage):'';
}
function forestRecordYear(c){
 if(c.completed&&c.completed!=='unknown')return c.completed.slice(0,4);
 if(!c.completed){const date=Model.firstExperienceDate(c);if(date)return date.slice(0,4)}
 const date=new Date(c.completedAt||c.saves?.[0]?.at||Date.now());return Number.isNaN(date.getTime())?now().slice(0,4):String(date.getFullYear());
}
function forestItemOrder(c){
 if(c.completedAt)return Number(c.completedAt)||0;
 const date=c.completed&&c.completed!=='unknown'?c.completed:Model.firstExperienceDate(c);
 return (date?new Date(date+'T12:00:00').getTime():Number(c.saves?.[0]?.at))||0;
}
function forestItems(data,period){
 return data.items.filter(c=>['book','movie'].includes(c.type)&&Model.stage(c)>0&&forestRecordYear(c)===String(period)).sort((a,b)=>forestItemOrder(a)-forestItemOrder(b)||a.id.localeCompare(b.id));
}
// Forest tab (redesign 11a): this month's board is the main view; the year is an island of
// twelve month plots; the calendar is the same month seen as stamps.
let forestMode='month',forestShow='forest',forestTypeFilter='all';
function forestMonthOf(c){if(c.completed)return c.completed==='unknown'?'':c.completed.slice(0,7);return now().slice(0,7)}
function forestMonthItems(period,type='all'){return state.items.filter(c=>['book','movie'].includes(c.type)&&(type==='all'||c.type===type)&&Model.stage(c)>0&&forestMonthOf(c)===period).sort((a,b)=>forestItemOrder(a)-forestItemOrder(b)||a.id.localeCompare(b.id))}
// With a type filter on, only that type's chip shows (no "영화 0편" next to a book filter).
function forestTypeChips(items,extra='',type='all'){const done=items.filter(c=>c.completed),b=done.filter(c=>c.type==='book').length,m=done.filter(c=>c.type==='movie').length;return '<div class="forest-chips">'+(type!=='movie'?'<span class="forest-chip is-book">책 <b>'+b+'권</b></span>':'')+(type!=='book'?'<span class="forest-chip is-movie">영화 <b>'+m+'편</b></span>':'')+extra+'</div>'}
function forestNav(prevAction,nextAction,prevLabel,nextLabel,canNext,canPrev=true){return '<div class="forest-nav">'+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',prevAction,'forest-nav-btn','aria-label="'+prevLabel+'"'+(canPrev?'':' disabled'))+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',nextAction,'forest-nav-btn','aria-label="'+nextLabel+'"'+(canNext?'':' disabled'))+'</div>'}
// Years that actually have trees. A year with none does not exist in the year view.
function forestTreeYears(){const cur=now().slice(0,4),c=new Set([cur]);state.items.forEach(x=>{if(x.completed&&x.completed!=='unknown')c.add(forestRecordYear(x))});return [...c].filter(y=>y&&y<=cur&&yearForestItems(y,'all').length).sort()}
function forestYearMonth(y){return y===now().slice(0,4)?now().slice(0,7):y+'-12'}
// Month picker: jump straight to any month instead of stepping back one at a time.
function forestMonthPickerHTML(y){
 const cur=now().slice(0,7),first=[...state.items.map(c=>c.completed&&c.completed!=='unknown'?c.completed:''),...state.items.flatMap(c=>c.logs.map(l=>l.date)),...state.items.map(c=>c.startedAt||'')].filter(Boolean).sort()[0]||cur;
 const minY=first.slice(0,4),maxY=cur.slice(0,4);
 const months=Array.from({length:12},(_,i)=>{const period=y+'-'+String(i+1).padStart(2,'0'),future=period>cur,n=future?0:forestMonthItems(period).filter(c=>c.completed).length;
  return button('<strong>'+(i+1)+'월</strong><small>'+(future?'':n?n+'그루':'—')+'</small>','forestPickMonth','month-pick-cell'+(period===month?' is-selected':'')+(period===cur?' is-current':''),'data-month="'+period+'" aria-pressed="'+(period===month)+'"'+(future?' disabled':''))}).join('');
 return '<div class="month-pick" data-year="'+y+'"><div class="month-pick-year">'+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>','forestPickYear','forest-nav-btn','data-year="'+(Number(y)-1)+'" aria-label="지난해"'+(y>minY?'':' disabled'))+'<strong>'+y+'년</strong>'+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>','forestPickYear','forest-nav-btn','data-year="'+(Number(y)+1)+'" aria-label="다음 해"'+(y<maxY?'':' disabled'))+'</div><div class="month-pick-grid">'+months+'</div></div>';
}
// Dropdown under the title (not a sheet). Closed by picking a month or tapping outside.
let forestMonthPopOpen=false;
function forestMonthPopHTML(){return forestMonthPopOpen?button('','forestMonthPickerClose','month-pop-scrim','aria-label="닫기" tabindex="-1"')+'<div class="month-pop" role="dialog" aria-label="월 선택">'+forestMonthPickerHTML(month.slice(0,4))+'</div>':''}
function renderForest(){
 if(!/^\d{4}-\d{2}$/.test(month)||month>now().slice(0,7))month=now().slice(0,7);
 year=month.slice(0,4);
 if(forestMode==='year'){const ys=forestTreeYears();if(ys.length&&!ys.includes(year)){year=ys.filter(y=>y<=year).at(-1)||ys[0];month=forestYearMonth(year)}}
 return forestMode==='year'?renderForestYear():renderForestMonth();
}
function renderForestMonth(){
 const m=Number(month.slice(5)),items=forestMonthItems(month),reading=items.filter(c=>!c.completed).length;
 const shareIcon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
 const head='<div class="forest-top"><h1 class="page-title">'+button(m+'월의 숲<svg class="month-pick-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>','forestMonthPicker','forest-title-btn'+(forestMonthPopOpen?' is-open':''),'aria-label="'+month.slice(0,4)+'년 '+m+'월의 숲, 다른 달 고르기" aria-haspopup="dialog" aria-expanded="'+forestMonthPopOpen+'"')+'</h1>'+forestMonthPopHTML()+button(shareIcon,'shareMonth','forest-share','aria-label="'+m+'월의 숲 공유하기"')+'</div>'+
  '<div class="forest-title-row"><div>'+forestTypeChips(items,reading?'<span class="forest-reading">'+progressLabel(items.filter(c=>!c.completed))+' <b>'+reading+'</b></span>':'')+'</div>'+'</div>'; // months are picked from the title dropdown, so no prev/next arrows here
 const toggle='<div class="forest-toggle" role="group" aria-label="보기 방식">'+button(icon('forest')+'숲으로 보기','forestShow',forestShow==='forest'?'active':'','data-show="forest" aria-pressed="'+(forestShow==='forest')+'"')+button(icon('today')+'달력으로 보기','forestShow',forestShow==='calendar'?'active':'','data-show="calendar" aria-pressed="'+(forestShow==='calendar')+'"')+'</div>';
 // The year island sits with the other forest tools instead of above the title.
 const yearTool=button('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>올해의 숲','forestYearView','forest-tool','aria-label="'+esc(year)+' 올해의 숲 보기"');
 if(forestShow==='calendar')return '<section class="forest-page-section forest-month">'+head+toggle+forestCalendarHTML(month)+'<div class="forest-tools-row is-static">'+yearTool+'</div></section>';
 const board=items.map(c=>({...c,forestTile:''}));
 const tools='<div class="forest-tools-row">'+button('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'+(forestEditMode?'완료':'꾸미기'),'forestEdit','forest-tool is-ink','aria-pressed="'+forestEditMode+'"')+button('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9 5.5 4h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z"/><path d="M5 13v7h14v-7"/></svg>상점','bmOpenShop','forest-tool')+button('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>도감','bmCodex','forest-tool')+yearTool+'</div>';
 return '<section class="forest-page-section forest-month is-board">'+head+toggle+
 '<div class="forest-board"><div class="forest-viewport '+(forestEditMode?'editing':'')+'" id="forestViewport" data-theme="basic" tabindex="0" aria-label="'+(forestEditMode?'꾸미기 중. 바꿀 나무를 선택하세요.':m+'월의 숲, '+items.length+'그루. 나무를 선택해 기록을 볼 수 있어요.')+'">'+forestSVG(board,'basic',true,{transient:true,grid:'month'})+'</div>'+
 '<div class="forest-float">'+(forestEditMode?bmEditBarHTML():(items.length?'':'<p class="forest-empty">'+(month===now().slice(0,7)?'이번 달 첫 기록을 남기면 새싹이 자라요':'이 달에는 심은 나무가 없어요')+'</p>')+tools)+'</div></div></section>';
}
const FOREST_MONTH_NAMES=['일','월','화','수','목','금','토'];
function forestCalendarHTML(period){
 const [y,m]=period.split('-').map(Number),start=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate(),today=now();
 const check='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
 let cells=FOREST_MONTH_NAMES.map((d,i)=>'<span class="fcal-weekday'+(i===0?' is-sun':'')+'">'+d+'</span>').join('')+'<span></span>'.repeat(start);
 for(let d=1;d<=days;d++){
  const date=period+'-'+String(d).padStart(2,'0'),done=state.items.filter(c=>c.completed===date),logged=state.items.some(c=>c.logs.some(l=>l.date===date));
  const label=date+(done.length?' · '+done.map(c=>c.title).join(', ')+' 완료':logged?' · 기록함':' · 기록 없음');
  cells+='<button type="button" class="fcal-day'+(date===today?' is-today':'')+(done.length?' is-done':logged?' is-logged':'')+'"'+(done.length?' data-type="'+done[0].type+'"':'')+' data-action="day" data-date="'+date+'" aria-label="'+esc(label)+'"'+(date>today?' disabled':'')+'><span class="fcal-num">'+d+'</span>'+(done.length?'<span class="fcal-tree">'+stickerTree(done[0],3)+'</span>':logged?'<span class="fcal-stamp">'+check+'</span>':'')+'</button>';
 }
 const finished=state.items.filter(c=>c.completed&&c.completed.startsWith(period)).sort((a,b)=>b.completed.localeCompare(a.completed)||(b.completedAt||0)-(a.completedAt||0));
 const card=c=>{const dt=new Date(c.completed+'T12:00:00Z');return '<button type="button" class="fcal-card" data-action="detail" '+attr(c.id)+'>'+stickerCover(c)+'<span class="fcal-card-copy"><small>'+(dt.getUTCMonth()+1)+'월 '+dt.getUTCDate()+'일 '+FOREST_MONTH_NAMES[dt.getUTCDay()]+' · '+'완료'+'</small><strong>'+esc(c.title)+'</strong><span>'+(validRating(c.rating)?'<b>★</b> '+c.rating+' · ':'')+esc(c.hiddenTree?bmTreeName('mystery-'+c.hiddenTree):contentSpecies(c)?.name||'나무')+'로 심었어요</span></span>'+stickerTree(c,3,'is-cut-sm')+'</button>'};
 return '<div class="fcal"><div class="fcal-grid">'+cells+'</div><div class="fcal-legend"><span><i class="is-logged"></i>기록한 날</span><span><i class="is-done"></i>다 읽은 날</span><span><i class="is-done is-movie"></i>다 본 날</span></div></div>'+(finished.length?'<div class="fcal-cards">'+finished.map(card).join('')+'</div>':'');
}
// Year island: twelve 5×5 plots, three per row, laid out on one isometric block.
// Each month plot is a 5×5 grid; trees take cells in a shuffled (but stable) order so they
// spread over the plot instead of filling it row by row.
// Trees scatter over each month plot: every tree takes the most open of a dozen seeded random
// spots inside the diamond, so the plot fills evenly without lining up in rows.
// Year forest: one square, slightly bumpy low-poly board. Every tree from the year is planted in order,
// from the back corner forward. The board is the smallest square that holds them, so it never looks empty.
// Past the latest year, › shows 평생의 숲: every tree ever planted on one board (y==='all').
let forestLifetime=false;
function yearForestItems(y,type){
 const current=now().slice(0,7);
 // Only finished works count as planted trees here (and in shares); growing ones live in the month forest.
 const items=state.items.filter(c=>['book','movie'].includes(c.type)&&(type==='all'||c.type===type)&&c.completed&&(y==='all'||forestRecordYear(c)===y));
 const key=c=>c.completed&&c.completed!=='unknown'?c.completed:'9999'+(c.logs.map(l=>l.date).sort().at(-1)||c.startedAt||'');
 return items.sort((a,b)=>key(a).localeCompare(key(b)));
}
function yearBoardGeometry(y,items){
 const W=390,H=250,n=items.length,N=Math.max(2,Math.ceil(Math.sqrt(n)));
 const BW=Math.min(170,95+N*9),y0=46+(170-BW)/2,cx=W/2,rnd=k=>(hash(y+'|board|'+k)%100000)/100000;
 const ground=polyGround(cx,y0+BW/2,BW,BW/2,16,Math.max(3,Math.min(6,N+1)),'year'+y+N,POLY_FLOORS[bmFloorId()]?bmFloorId():'basic');
 // cells back to front, centre-out along each diagonal
 const cellW=BW/N,cellH=cellW/2,cells=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++)cells.push({r,c});
 cells.sort((p,q)=>(p.r+p.c)-(q.r+q.c)||Math.abs(p.c-p.r)-Math.abs(q.c-q.r)||p.c-q.c);
 const center=({r,c})=>[cx+(c-r)*cellW,y0+(c+r+1)*cellH];
 const trees=items.map((it,k)=>{const cell=cells[k],[x,yy]=center(cell),stage=it.completed?3:Model.stage(it),base=cellW*2.25;
  return {x:x+(rnd('tx'+it.id)-.5)*cellW*.5,y:yy+(rnd('ty'+it.id)-.5)*cellH*.5,src:stage===3&&it.hiddenTree&&bmFloorId()==='snow'?(SONGLIM_TREE_ASSETS['winter'+(it.hiddenTree==='A'?'shining':'moonlight')]||{}).src||stickerTreeSrc(it,stage):stickerTreeSrc(it,stage),size:+(base*(stage===3?1:stage===2?.62:.45)).toFixed(1),id:it.id}});
 const dots=cells.slice(n).filter((_,k)=>k%2===0).map(cell=>{const [x,yy]=center(cell);return {x,y:yy}});
 return {W,H,ground,trees:trees.sort((a,b)=>a.y-b.y),dots,cellW};
}
function forestYearIsland(y,type){
 const g=yearBoardGeometry(y,yearForestItems(y,type));
 return '<svg class="forest-island forest-year-board" viewBox="0 0 '+g.W+' '+g.H+'" role="img" aria-label="'+(y==='all'?'평생의 숲':y+'년의 숲')+', '+g.trees.length+'그루">'+polyGroundSVG(g.ground)+
  g.dots.map(d=>'<ellipse cx="'+d.x.toFixed(1)+'" cy="'+d.y.toFixed(1)+'" rx="'+(g.cellW*.16).toFixed(1)+'" ry="'+(g.cellW*.08).toFixed(1)+'" fill="'+g.ground.dot+'"/>').join('')+
  g.trees.map(t=>'<image href="'+esc(t.src)+'" x="'+(t.x-t.size/2).toFixed(1)+'" y="'+(t.y-t.size*.875).toFixed(1)+'" width="'+t.size+'" height="'+t.size+'" pointer-events="none"/>').join('')+'</svg>';
}
function renderForestYear(){
 const treeYears=forestTreeYears();
 if(!treeYears.length)return '<section class="forest-page-section forest-year"><div class="forest-top">'+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>'+Number(month.slice(5))+'월의 숲','forestMonthView','forest-back','data-month="'+month+'"')+'</div><div class="empty"><span class="empty-icon" aria-hidden="true">'+icon('forest')+'</span><h3>아직 심은 나무가 없어요</h3><p>작품을 다 읽거나 보면<br>올해의 숲에 나무가 생겨요.</p></div></section>';
 if(forestLifetime)return renderForestLifetime(treeYears);
 const type=forestTypeFilter,current=now().slice(0,7),all=yearForestItems(year,type);
 const filters='<div class="forest-type-filter" role="group" aria-label="종류">'+[['all','전체'],['book','책'],['movie','영화']].map(([k,l])=>button(l,'forestType',k===type?'active':'','data-type="'+k+'" aria-pressed="'+(k===type)+'"')).join('')+'</div>';
 const head='<div class="forest-top">'+button('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>'+Number(month.slice(5))+'월의 숲','forestMonthView','forest-back','data-month="'+month+'"')+filters+'</div>'+
  '<div class="forest-title-row"><div><span class="forest-year-label">'+esc(year)+'</span><h1 class="page-title">올해의 숲</h1>'+forestTypeChips(all,'<span class="forest-reading">'+all.length+'그루</span>',forestTypeFilter)+'</div>'+forestNav('forestPrevYear','forestNextYear','지난해',treeYears.some(y=>y>year)?'다음 해':'평생의 숲',true,treeYears.some(y=>y<year))+'</div>';
 const cards=Array.from({length:12},(_,i)=>{const period=year+'-'+String(i+1).padStart(2,'0'),future=period>current,items=future?[]:forestMonthItems(period,type),done=items.filter(c=>c.completed),b=done.filter(c=>c.type==='book').length,m=done.filter(c=>c.type==='movie').length;
  return future?'<div class="forest-month-card is-future"><strong>'+(i+1)+'월</strong><small>—</small></div>':button('<strong>'+(i+1)+'월<b>'+done.length+'</b></strong><small>'+(forestTypeFilter==='book'?'책 '+b+'권':forestTypeFilter==='movie'?'영화 '+m+'편':'책 '+b+' · 영화 '+m)+'</small>','forestMonthView','forest-month-card'+(period===current?' is-current':''),'data-month="'+period+'"')}).join('');
 return '<section class="forest-page-section forest-year">'+head+'<div class="forest-island-wrap">'+forestYearIsland(year,type)+'</div><div class="forest-month-grid">'+cards+'</div>'+
 (all.length?'<div class="forest-year-share">'+button('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>올해의 숲 자랑하기','shareForest','primary')+'</div>':'')+'</section>';
}

function renderForestLifetime(treeYears){
 const type=forestTypeFilter,all=yearForestItems('all',type),first=treeYears[0],last=treeYears.at(-1);
 const back='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
 const filters='<div class="forest-type-filter" role="group" aria-label="종류">'+[['all','전체'],['book','책'],['movie','영화']].map(([k,l])=>button(l,'forestType',k===type?'active':'','data-type="'+k+'" aria-pressed="'+(k===type)+'"')).join('')+'</div>';
 const head='<div class="forest-top">'+button(back+Number(month.slice(5))+'월의 숲','forestMonthView','forest-back','data-month="'+month+'"')+filters+'</div>'+
  '<div class="forest-title-row"><div><span class="forest-year-label">'+esc(first===last?first:first+'–'+last)+'</span><h1 class="page-title">평생의 숲</h1>'+forestTypeChips(all,'<span class="forest-reading">'+all.length+'그루</span>',type)+'</div>'+forestNav('forestPrevYear','forestNextYear',last+'년의 숲','',false,true)+'</div>';
 const cards=[...treeYears].reverse().map(y=>{const done=yearForestItems(y,type),b=done.filter(c=>c.type==='book').length,m=done.filter(c=>c.type==='movie').length;return button('<strong>'+y+'<b>'+done.length+'</b></strong><small>'+(type==='book'?'책 '+b+'권':type==='movie'?'영화 '+m+'편':'책 '+b+' · 영화 '+m)+'</small>','forestPickYearCard','forest-month-card'+(y===now().slice(0,4)?' is-current':''),'data-year="'+y+'"')}).join('');
 return '<section class="forest-page-section forest-year is-lifetime">'+head+'<div class="forest-island-wrap">'+forestYearIsland('all',type)+'</div><div class="forest-month-grid">'+cards+'</div>'+
 (all.length?'<div class="forest-year-share">'+button('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>평생의 숲 자랑하기','shareForest','primary')+'</div>':'')+'</section>';
}
function calendarHTML(period){
 const [y,m]=period.split('-').map(Number),start=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate();
 let html='<div class="cal">'+['일','월','화','수','목','금','토'].map(d=>'<div class="weekday">'+d+'</div>').join('')+'<div></div>'.repeat(start);
 for(let d=1;d<=days;d++){
  const date=period+'-'+String(d).padStart(2,'0');
  const list=state.items.filter(c=>c.completed===date||c.logs.some(l=>l.date===date)).sort((a,b)=>Number(b.completed===date)-Number(a.completed===date));
  const completed=list.filter(c=>c.completed===date),first=list[0];
  const label=date+(list.length?' · '+list.map(c=>c.title+(c.completed===date?' 완료':' 기록')).join(', '):' 기록 없음');
  html+='<button class="day '+(date===now()?'today ':'')+(completed.length?'completed ':'')+'" data-action="day" data-date="'+date+'" aria-label="'+esc(label)+'"><span>'+d+'</span>'+(first?'<span class="day-cover">'+(first.cover?'<img data-cover-kind="'+first.type+'" data-cover-mini="true" src="'+esc(first.cover)+'" alt="" decoding="async">':'<span class="mini-cover">'+icon(first.type)+'</span>')+'</span>'+(list.length>1?'<span class="plus">+'+(list.length-1)+'</span>':''):'')+'</button>';
 }
 return html+'</div>';
}
function renderCalendar(){
 const stats=Model.stats(Model.completed(state,month));
 const recordedDays=new Set(state.items.flatMap(c=>c.logs.map(l=>l.date).concat(c.completed&&c.completed!=='unknown'?[c.completed]:[])).filter(d=>d.startsWith(month))).size;
 return '<section><div class="page-heading"><h1 class="page-title">월간 기록</h1></div><p class="page-caption">한 달의 경험을 모아 살펴보세요.</p><div class="month-head">'+button('‹','prevMonth','iconbtn','aria-label="이전 달"')+button(month.replace('-','년 ')+'월 ▾','months','textbtn')+button('›','nextMonth','iconbtn','aria-label="다음 달" '+(month>=now().slice(0,7)?'disabled':''))+'</div>'+calendarHTML(month)+'<p class="summary">기록한 날 '+recordedDays+'일</p><div class="rule"></div><p><strong>완료한 작품 '+stats.n+'개</strong></p><p class="summary">책 '+stats.book+' · 영화 '+stats.movie+'</p>'+button('기록 공유하기','shareMonth','primary',recordedDays?'':'disabled')+(!recordedDays?'<p class="creator center">이달의 기록을 남기면 이미지로 공유할 수 있어요.</p>':'')+'</section>';
}
const TREE_UNLOCK_TEST_CASES=[
 ['book-literature','book','소설'],['book-humanities','book','철학'],['book-science','book','과학'],['album-classical','album','클래식'],['album-popular','album','팝'],['album-roots','album','재즈'],['movie-drama','movie','드라마'],['movie-sf','movie','SF'],['movie-action','movie','액션'],['other','movie','다큐멘터리']
];
function addTreeUnlockTestData(){
 const stamp=Date.now(),date=now();
 TREE_UNLOCK_TEST_CASES.forEach(([catId,type,genre],catIndex)=>{
  for(let i=1;i<=3;i++){
   const title='도감 테스트 · '+catId+' '+i,creator=APP_BRAND.ko+' 테스트',request='tree-unlock-'+catId+'-'+i;
   let c=state.items.find(x=>x.source==='나무 도감 테스트 데이터'&&x.title===title);
   if(!c)c=Model.add(state,{type,title,creator,genre,genreSource:'user',source:'나무 도감 테스트 데이터'},request);
   c.genre=genre;c.genreSource='user';c.completed=date;c.completedAt=stamp+catIndex*10+i;c.source='나무 도감 테스트 데이터';c.logs=[];
  }
 });
 ensureCompletedSpeciesAssignments();
 if(!persist())return;render();toast('각 나무에 완료 경험 3개씩 넣었어요. 일반 나무 20종이 모두 해금돼요.');
}

let profileEdit=null;
function profileAvatarHTML(photo=state.profile.photo){
 const source=profilePhotoSource(photo);
 return source?'<img src="'+esc(source)+'" alt="프로필 사진">':icon('my');
}
// Linked sign-in methods = Supabase identities. Linking a new provider needs "Allow manual linking"
// switched on in Supabase (Authentication → Sign In / Providers). A login method can be removed only
// while at least one other remains.
const LINKABLE=[['email','이메일'],['kakao','카카오'],['google','Google']];
let profileIdentities=[];
async function cloudAuthed(path,options={}){
 try{return await cloudRequest(path,{...options,token:cloudSession?.access_token})}
 catch(err){if(err.status!==401||!await cloudRefresh())throw err;return cloudRequest(path,{...options,token:cloudSession?.access_token})}
}
function linkedAccountsHTML(){
 return LINKABLE.map(([id,label])=>{const it=profileIdentities.find(x=>x.provider===id);
  const right=it?(profileIdentities.length>1&&id!=='email'?button('해제','unlinkIdentity','linked-action is-unlink','data-id="'+esc(it.identity_id||it.id)+'" data-provider="'+id+'"'):'<em>연결됨</em>'):id==='email'?'<em class="is-off">연결 안 됨</em>':button('연결','linkIdentity','linked-action','data-provider="'+id+'"');
  return '<div class="linked-row"><strong>'+label+'</strong>'+(it&&it.identity_data?.email&&id!=='email'?'<small>'+esc(it.identity_data.email)+'</small>':'')+right+'</div>'}).join('');
}
async function loadLinkedAccounts(){
 const box=$('linkedAccounts');if(!box)return;
 try{const user=await cloudAuthed('/auth/v1/user');profileIdentities=user.identities||[];if($('linkedAccounts'))$('linkedAccounts').innerHTML=linkedAccountsHTML()}
 catch{if($('linkedAccounts'))$('linkedAccounts').innerHTML='<p class="linked-note">연결 정보를 불러오지 못했어요.</p>'}
}
async function cloudLinkIdentity(provider){
 if(!OAUTH_NAMES[provider])return;
 try{
  const data=await cloudAuthed('/auth/v1/user/identities/authorize?provider='+encodeURIComponent(provider)+'&skip_http_redirect=true&redirect_to='+encodeURIComponent(location.origin+location.pathname));
  if(!data?.url)throw Error('no url');
  try{sessionStorage.setItem(OAUTH_PENDING,provider);sessionStorage.setItem(OAUTH_LINKING,'1')}catch{}
  location.assign(data.url);
 }catch{toast(OAUTH_NAMES[provider]+' 연결을 시작하지 못했어요. 잠시 후 다시 시도해주세요.')}
}
async function cloudUnlinkIdentity(id,provider){
 try{await cloudAuthed('/auth/v1/user/identities/'+encodeURIComponent(id),{method:'DELETE'});toast(OAUTH_NAMES[provider]+' 연결을 해제했어요.');await loadLinkedAccounts()}
 catch{toast('연결을 해제하지 못했어요. 다른 로그인 방법이 하나 이상 있어야 해요.')}
}
function openProfile(){
 profileEdit={photo:profilePhotoSource(state.profile.photo),loading:false,request:0};
 const email=cloudSession?.user?.email||'';
 showModal('프로필 설정','<form id="profileForm"><div class="profile-photo-editor">'+button('<span class="profile-avatar profile-avatar-large" id="profilePhotoPreview">'+profileAvatarHTML(profileEdit.photo)+'</span>','profilePhotoChoose','profile-photo-trigger','aria-label="프로필 사진 변경"')+'<div class="profile-photo-actions">'+button('사진 변경','profilePhotoChoose','textbtn')+button('기본 이미지로','profilePhotoRemove','textbtn','id="profilePhotoRemove" '+(profileEdit.photo?'':'disabled'))+'</div><input id="profilePhotoFile" type="file" accept="image/*" hidden><p id="profilePhotoStatus" class="profile-photo-status" role="status">사진은 가운데를 기준으로 동그랗게 보여요.</p></div><label for="profileName">이름 또는 별명</label><input id="profileName" maxlength="30" required autocomplete="nickname" value="'+esc(state.profile.name)+'"><label for="profileBio">한 줄 소개 · 선택</label><textarea id="profileBio" maxlength="120" rows="2" placeholder="나의 취향을 짧게 소개해보세요.">'+esc(state.profile.bio||'')+'</textarea><div class="profile-bio-count"><span id="profileBioCount">'+String(state.profile.bio||'').length+'</span> / 120</div>'+(email?'<div class="profile-account"><span>로그인 계정</span><strong>'+esc(email)+'</strong></div>':'')+(cloudSession?.access_token?'<div class="linked-accounts"><span>연결된 로그인</span><div id="linkedAccounts" aria-live="polite"><p class="linked-note">불러오는 중…</p></div></div>':'')+'<p id="profileError" class="form-error" role="alert"></p><button id="profileSave" class="primary" type="submit">저장</button>'+button('취소','close','textbtn')+'</form>','profile');if(cloudSession?.access_token)void loadLinkedAccounts();
}
function updateProfilePhotoPreview(){
 if(modal!=='profile'||!$('profileForm')||!profileEdit)return;
 $('profilePhotoPreview').innerHTML=profileAvatarHTML(profileEdit.photo);
 $('profilePhotoRemove').disabled=!profileEdit.photo&&!profileEdit.loading;
 $('profileSave').disabled=profileEdit.loading;
 $('profilePhotoStatus').textContent=profileEdit.loading?'사진을 준비하고 있어요…':'사진은 가운데를 기준으로 동그랗게 보여요.';
}
async function changeProfilePhoto(file,form){
 if(!file||!form?.isConnected||!profileEdit)return;
 const draft=profileEdit,ticket=++draft.request;
 draft.loading=true;$('profileError').textContent='';updateProfilePhotoPreview();
 let url='';
 try{
  if(!file.type.startsWith('image/'))throw Error('사진 파일을 선택해주세요.');
  if(file.size>15000000)throw Error('15MB 이하의 사진을 선택해주세요.');
  url=URL.createObjectURL(file);
  const img=await loadImage(url),width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height)throw Error('사진을 읽지 못했어요.');
  const side=Math.min(width,height),canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f7f7f4';ctx.fillRect(0,0,256,256);
  ctx.drawImage(img,(width-side)/2,(height-side)/2,side,side,0,0,256,256);
  const photo=profilePhotoSource(canvas.toDataURL('image/jpeg',.86));
  if(!photo)throw Error('다른 사진을 선택해주세요.');
  if(profileEdit!==draft||draft.request!==ticket||!form.isConnected)return;
  draft.photo=photo;
 }catch(err){
  if(profileEdit===draft&&draft.request===ticket&&form.isConnected)$('profileError').textContent=err.message==='이미지를 읽지 못했어요.'?'사진을 열지 못했어요. JPG, PNG 또는 WebP 사진을 선택해주세요.':err.message||'사진을 불러오지 못했어요.';
 }finally{
  if(url)URL.revokeObjectURL(url);
  if(profileEdit===draft&&draft.request===ticket&&form.isConnected){draft.loading=false;updateProfilePhotoPreview();}
 }
}
function saveProfile(form){
 if(!profileEdit||profileEdit.loading||!form.isConnected)return;
 const name=$('profileName').value.trim().slice(0,30);
 if(!name){$('profileError').textContent='이름 또는 별명을 입력해주세요.';$('profileName').focus();return;}
 const previous=state.profile;
 state.profile={...previous,name,bio:$('profileBio').value.trim().slice(0,120),photo:profilePhotoSource(profileEdit.photo)};
 if(!persist()){state.profile=previous;$('profileError').textContent='저장하지 못했어요. 저장 공간을 확인한 뒤 다시 시도해주세요.';return;}
 authSession.name=name;saveSession();profileEdit=null;
 closeModal();render();toast('프로필을 저장했어요.');
}

function renderMy(){
 const stats=Model.stats(state.items.filter(c=>c.completed)),row=(label,action,value='›',cls='')=>button('<span>'+label+'</span><span class="menu-row-value">'+value+'</span>',action,'menu-row '+cls);
 return '<section class="my-page"><div class="page-heading"><h1 class="page-title">마이</h1></div>'+
 '<div class="my-profile"><button type="button" class="my-profile-head" data-action="profile"><span class="profile-avatar">'+profileAvatarHTML()+'</span><span class="my-profile-copy"><strong>'+esc(state.profile.name)+'</strong><small>'+esc(state.profile.bio||'읽고 본 것을 숲으로')+'</small></span><span class="my-profile-edit">수정</span></button>'+
 '<div class="my-stats"><div><strong>'+state.items.length+'</strong><span>스크랩</span></div><div><strong>'+state.items.filter(c=>!c.completed&&Model.stage(c)>0).length+'</strong><span>'+statusName.active+'</span></div><div><strong>'+stats.n+'</strong><span>'+statusName.done+'</span></div></div></div>'+
 '<div class="settings-group"><h2>나의 설정</h2><div class="settings-card">'+row('취향 관리','tastes')+button('<span>숲의 소리</span><span class="menu-row-value forest-sound-menu-value"><span id="forestSoundSummary">'+(forestSoundPrefs.enabled?forestSoundCurrent().name:'꺼짐')+'</span> ›</span>','forestSoundSettings','menu-row')+row('알림','notifications')+'</div></div>'+
 '<div class="settings-group"><div class="settings-group-head"><h2>기록 관리</h2><p id="cloudSaveStatus" class="save-status" role="status" aria-live="polite">'+cloudSaveStatusLabel()+'</p></div><div class="settings-card">'+row('데이터 백업','backup','↓')+row('백업 복원','restore','↑')+'</div><input id="restoreFile" aria-label="백업 파일 선택" class="offscreen" type="file" accept="application/json,.json"></div>'+
 (BM_CONFIG.mode==='preview'?'<div class="settings-group"><h2>프로토타입</h2><div class="settings-card">'+row('구매 되돌리기','bmPreviewReset','↺')+'</div></div>':'')+
 '<div class="settings-group"><h2>서비스</h2><div class="settings-card">'+row('이용약관','terms')+row('개인정보처리방침','privacy')+row('로그아웃','flowLogout')+button('<span>회원탈퇴</span>','deleteAccount','menu-row danger')+'</div></div></section>';
}
let modalReturnFocus=null,modalFocusTimer=null;
function showModal(title,html,kind='generic'){
 if(kind!=='link'&&linkImportSession)cancelLinkImport();
 dismissNotification(false);
 if(!modal)modalReturnFocus=document.activeElement;
 clearTimeout(modalFocusTimer);
 dismissToast();modal=kind;const composer=kind==='scrap-composer',collection=kind==='collection';
 $('overlay').innerHTML='<div class="sheet-back '+(composer?'scrap-composer-back':collection?'collection-back':'')+'" data-kind="'+esc(kind)+'" data-action="backdrop"><section class="sheet '+(composer?'scrap-composer-sheet':collection?'collection-sheet':'')+'" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><div class="sheet-head"><h2 id="sheetTitle" tabindex="-1">'+esc(title)+'</h2>'+button(icon('close'),'close','iconbtn','aria-label="닫기"')+'</div>'+html+'</section></div>';
 document.querySelector('.app').inert=true;
 document.body.style.overflow='hidden';modalFocusTimer=setTimeout(()=>{const sheet=$('overlay').querySelector('.sheet');const target=['scrap-filters','scrap-composer','record-done','planted','finish'].includes(kind)?sheet?.querySelector('#sheetTitle'):kind==='confirm'?sheet?.querySelector('#sheetTitle'):(sheet?.querySelector('input:not([type=hidden]):not([type=file]):not([hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled)')||sheet?.querySelector('#sheetTitle')||sheet?.querySelector('button'));target?.focus({preventScroll:true})},35);;window.initRatingPicker?.();
}
function closeModal(){if(modal==='link')cancelLinkImport();if(modal==='profile'&&profileEdit){profileEdit.request++;profileEdit=null}clearTimeout(modalFocusTimer);document.querySelector('.app').inert=false;if(ocrBusy){ocrGeneration++;ocrBusy=false}if(modal==='scrap-composer')scrapFlowActive=false;modal=null;$('overlay').innerHTML='';document.body.style.overflow='';if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});modalReturnFocus=null;}
function confirmBox(title,text,onConfirm,label='확인',danger=false){window.pendingConfirm=onConfirm;showModal(title,'<p>'+esc(text)+'</p>'+button(label,'confirm',danger?'primary danger':'primary')+button('취소','close','textbtn'),'confirm')}
function pick(){clearTimeout(mainSearchRenderTimer);pickingFilters={q:'',type:'all',status:'all',sort:'recent'};picking=true;view='scrap';closeModal();render();scrollPageTop();focusPageHeading()}
let scrapFlowActive=false;
const scrapSessionAdds=new Map();
let scrapComposerState={type:'book',queries:{book:'',album:'',movie:''},count:0};
function scrapTypeLabel(type){return {book:'책',album:'음악',movie:'영화'}[type]||'책'}
function scrapComposerConfig(type){
 return {
  book:{input:'catalogSearch',results:'catalogResults',placeholder:'책 제목·저자 검색',note:'카카오 책 검색'},
  album:{input:'musicCatalogSearch',results:'musicCatalogResults',placeholder:'앨범명·아티스트 검색',note:'Apple Music/iTunes 앨범 검색'},
  movie:{input:'movieCatalogSearch',results:'movieCatalogResults',placeholder:'영화 제목 검색',note:'TMDB 영화 검색'}
 }[type]||null;
}
function updateScrapSessionCount(delta=0){
 scrapComposerState.count=Math.max(0,scrapComposerState.count+Number(delta||0));
 const el=$('scrapSessionCount');if(el)el.innerHTML='이번에 <b>'+scrapComposerState.count+'개</b> 추가';
 const done=document.querySelector('[data-action="scrapDone"]');if(done)done.disabled=scrapComposerState.count===0;
}
function openScrapComposer(type='book',query=null,reset=false){
 if(reset){scrapSessionAdds.clear();scrapComposerState={type:'book',queries:{book:'',album:'',movie:''},count:0};scrapFlowActive=true}
 if(!scrapFlowActive)scrapFlowActive=true;
 type=['book','movie'].includes(type)?type:'book';scrapComposerState.type=type;
 if(query!==null)scrapComposerState.queries[type]=String(query||'');
 const cfg=scrapComposerConfig(type),q=scrapComposerState.queries[type]||'';
 const tabs=['book','movie'].map(t=>button(scrapTypeLabel(t),'scrapType','composer-type-tab '+(t===type?'active':''),'data-type="'+t+'" aria-pressed="'+(t===type)+'"')).join('');
 const linkIcon='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',cameraIcon='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
 const body='<div class="scrap-composer-body"><div class="composer-toolbar"><div class="composer-type-tabs" role="group" aria-label="스크랩 유형">'+tabs+'</div><div class="scrap-shortcuts">'+button(linkIcon,'linkAdd','composer-icon','aria-label="링크에서 가져오기"')+button(cameraIcon,'photoAdd','composer-icon','aria-label="사진에서 가져오기"')+'</div></div><div class="scrap-search-block">'+icon('search')+'<input id="'+cfg.input+'" type="search" value="'+esc(q)+'" placeholder="'+cfg.placeholder+'" aria-label="'+cfg.placeholder+'" autocomplete="off"></div><div id="'+cfg.results+'" class="scrap-results"></div></div><div class="scrap-session-footer"><span id="scrapSessionCount" class="scrap-session-count">이번에 <b>'+scrapComposerState.count+'개</b> 추가</span>'+button('완료','scrapDone','primary',scrapComposerState.count===0?'disabled':'')+'</div>';
 showModal('스크랩 추가',body,'scrap-composer');
 if(type==='book')searchResults(q);else if(type==='album')musicSearchResults(q);else movieSearchResults(q);
}
function addMenu(){openScrapComposer('book','',true)}
const BOOK_SEARCH_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/super-service';
// Google Books는 키 없이 호출하면 요청 한도가 매우 낮아 429가 쉽게 뜬다.
// https://console.cloud.google.com 에서 무료 API 키를 발급해 여기에 넣으면 한도가 크게 늘어난다.
const GOOGLE_BOOKS_API_KEY='AIzaSyDq4oOZxvJbO9UTR53V9Mm3sGJyCsL8Cvs';
// 콘텐츠 객체에 _loaded 플래그를 직접 심으면 persist()가 그 값을 그대로
// localStorage에 저장해버려서, 키 적용 전에 실패했던 책은 키를 넣은 뒤에도
// 영영 재시도되지 않는 문제가 생긴다. 그래서 시도 상태는 이 페이지가 열려있는
// 동안만 사는 별도의 Map으로 관리하고, 콘텐츠 객체 자체(=저장되는 데이터)는 건드리지 않는다.
const detailIntroAttempts=new Map();
function detailIntroKey(c){return c?.id||('preview:'+(c?.isbn||'')+'|'+(c?.title||''))}
const BOOK_POPULARITY_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/book-popularity';
let remoteBookResults=[],bookSearchSeq=0,bookSearchTimer=null;
let bookSearchRawResults=[],bookSearchActiveQuery='',bookSearchNextPage=2,bookSearchHasMore=false,bookSearchLoadingMore=false,bookSearchStagnantPages=0,bookSearchObserver=null;
let scrapAddedBookKeys=new Set();
const BOOK_SEARCH_PAGE_SIZE=20;
const MUSIC_SEARCH_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/music-search';
const MUSIC_POPULARITY_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/music-popularity';
const MOVIE_SEARCH_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/movie-search';
const MOVIE_RECOMMEND_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/movie-recommend';
const IMAGE_OCR_ENDPOINT='https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/image-ocr';
let remoteAlbumResults=[],musicSearchSeq=0,musicSearchTimer=null;
let remoteMovieResults=[],movieSearchSeq=0,movieSearchTimer=null;
function unwrapBookDocuments(payload){
 if(Array.isArray(payload))return payload;
 const candidates=[payload?.documents,payload?.books,payload?.items,payload?.results,payload?.data?.documents,payload?.data?.books,payload?.data?.items,payload?.body?.documents];
 return candidates.find(Array.isArray)||[];
}
function normalizeRemoteBook(d){
 const creators=Array.isArray(d?.authors)?d.authors:Array.isArray(d?.author)?d.author:[d?.author||d?.creator||''];
 const popularityCount=Number(d?.ratingsCount??d?.ratingCount??d?.reviewCount??d?.reviews??d?.salesCount??d?.sales_count??d?.popularity??0)||0;
 const averageRating=Number(d?.averageRating??d?.rating??0)||0;
 const base={type:'book',title:String(d?.title||d?.bookTitle||'').replace(/<[^>]+>/g,'').trim(),creator:creators.filter(Boolean).join(', ').trim(),publisher:String(d?.publisher||'').trim(),isbn:String(d?.isbn||d?.isbn13||d?.isbn10||'').trim(),cover:String(d?.thumbnail||d?.cover||d?.image||d?.imageUrl||d?.image_url||d?.coverUrl||d?.cover_url||d?.thumbnailUrl||d?.thumbnail_url||'').trim(),catalogUrl:String(d?.url||d?.link||'').trim(),publishedAt:String(d?.datetime||d?.publishedAt||d?.pubdate||'').trim(),contents:String(d?.contents||d?.description||d?.overview||'').trim(),source:'카카오 책 검색',searchPopularity:popularityCount,averageRating,adultYn:String(d?.adultYn||d?.adult||'').toUpperCase()};
 const rawGenre=cleanGenreValue(d?.genre||d?.category||d?.categoryName||d?.subject||''),genre=normalizeBookGenre(rawGenre,base);return {...base,genre,rawGenre,genreSource:'auto',genreCandidates:genre?[[genre,rawGenre?'외부 분류':'자동분류']]:[]};
}


function bookSearchCoreTitle(value){
 return Model.norm(String(value||'')
   .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g,' ')
   .replace(/[:：\-–—]\s*[^:：\-–—]+$/,' ')
   .replace(/\s+/g,' '));
}

const BOOK_PUBLISHER_TIERS=[
 {score:1.00,names:['민음사','문학동네','황금가지','창비','문학과지성사','열린책들','을유문화사']},
 {score:.82,names:['현대문학','시공사','아르테','은행나무','문학수첩','비채','웅진지식하우스','김영사','북하우스','세계사','돌베개']},
 {score:.68,names:['나무의철학','다산책방','알에이치코리아','RHK','위즈덤하우스','해냄','자음과모음','민음인']}
];
function bookPublisherTrust(book){
 const p=Model.norm(book?.publisher||'');
 if(!p)return 0;
 for(const tier of BOOK_PUBLISHER_TIERS)if(tier.names.some(name=>p.includes(Model.norm(name))))return tier.score;
 return .18;
}
function bookEditionTrust(book){
 let score=0;
 if(book?.isbn)score+=.26;
 if(book?.publisher)score+=.18;
 if(book?.publishedAt)score+=.10;
 if(book?.cover)score+=.08;
 score+=bookPublisherTrust(book)*.38;
 return Math.min(1,score);
}


function primaryIsbn13(value){
 const parts=String(value||'').match(/\d{10,13}/g)||[];
 return parts.find(x=>x.length===13)||'';
}
function applyPopularityInfo(book,info){
 if(!book||!info)return;
 book.yes24Found=Boolean(info?.found);
 book.yes24PopularityScore=Number(info?.popularityScore)||0;
 book.yes24SalePoint=Number(info?.salePoint)||0;
 book.yes24StarScore=Number(info?.starScore)||0;
 book.yes24BestsellerRank=Number(info?.bestsellerRank)||null;
 book.yes24SteadyRank=Number(info?.steadyRank)||null;
 // YES24 상세/보강 응답의 성인 여부 유지
 if(info?.adultYn!==undefined)book.adultYn=String(info.adultYn).toUpperCase();
 if(info?.adult!==undefined && !book.adultYn)book.adultYn=String(info.adult).toUpperCase();
 // YES24 상세/보강 응답의 쪽수 필드를 내부 length로 통일
 const yes24Pages=Number(info?.length||info?.pages||info?.pageCount||info?.page)||0;
 if(yes24Pages>0)book.length=yes24Pages;
 if(!book.cover&&info?.cover)book.cover=String(info.cover);
 if(!book.catalogUrl&&info?.link)book.catalogUrl=String(info.link);
 if(!book.publisher&&info?.publisher)book.publisher=String(info.publisher);
 if(!book.publishedAt&&info?.publishDate)book.publishedAt=String(info.publishDate);
}
async function enrichBookPopularity(results,seq){
 const candidates=(results||[]).filter(book=>primaryIsbn13(book?.isbn)).slice(0,30);
 const isbns=[...new Set(candidates.map(book=>primaryIsbn13(book.isbn)).filter(Boolean))];
 if(!isbns.length)return;

 try{
  const res=await fetch(BOOK_POPULARITY_ENDPOINT,{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({isbns})
  });
  if(!res.ok)return;

  const payload=await res.json();
  const responseBooks = Array.isArray(payload?.books)
    ? payload.books
    : Array.isArray(payload?.data?.books)
      ? payload.data.books
      : (payload?.isbn ? [payload] : []);

  // 단일 ISBN 응답도 보강 API 응답으로 처리
  if(!responseBooks.length && payload?.length && payload?.isbn){
    responseBooks.push(payload);
  }

  const infoMap=new Map(
   responseBooks
    .map(info=>[primaryIsbn13(info?.isbn13||info?.isbn),info])
    .filter(([isbn])=>isbn)
  );

  const applyTo=list=>{
   for(const book of list||[]){
    const info=infoMap.get(primaryIsbn13(book?.isbn));
    if(info)applyPopularityInfo(book,info);
   }
  };

  applyTo(results);
  applyTo(bookSearchRawResults);

  if(seq!==bookSearchSeq||!$('catalogResults'))return;

  // 이미 화면에 보여준 목록의 순서를 흔들지 않도록, 재정렬 없이
  // 같은 순서 그대로(내용만 갱신된 상태로) 다시 그린다.
  renderRemoteBooks(remoteBookResults);
 }catch{}
}

const ADULT_PUBLISHER_RE=/(자투리북스|19금|성인|에로|야설|성애|하드코어|소프트코어)/i;
function isAdultBook(book){
 const text=[book?.title,book?.genre,book?.rawGenre,book?.publisher,book?.creator,book?.contents].filter(Boolean).join(' ');
 return String(book?.adultYn||'').toUpperCase()==='Y'
   || ADULT_PUBLISHER_RE.test(text)
   || /(성인|19금|19세|adult|섹스|에로|야설|정사|외설|음란|노출|야한|19세미만|하드코어|소프트코어)/i.test(text);
}

function bookSearchScore(book,query,index=0){
 const q=Model.norm(query),title=Model.norm(book?.title),core=bookSearchCoreTitle(book?.title),creator=Model.norm(book?.creator);
 if(!q||!title)return -9999-index;

 const tokens=q.split(/\s+/).filter(Boolean);
 const creatorParts=String(book?.creator||'')
   .split(/[,/&·]|\s+저|\s+역/)
   .map(Model.norm)
   .filter(Boolean);

 const creatorExact=creator===q||creatorParts.includes(q);
 const creatorStarts=creator.startsWith(q)||creatorParts.some(x=>x.startsWith(q));
 const adultCandidate=isAdultBook(book);
 const titleExact=title===q;
 const coreExact=core===q;

 let score=0;

 // Query relevance itself remains the strongest signal.
 if(titleExact)score+=1450;
 else if(coreExact)score+=1320;
 else if(title.startsWith(q))score+=850;
 else if(title.includes(q))score+=680;
 else if(core.includes(q)||q.includes(core))score+=440;

 // 성인 콘텐츠의 저자 필드가 시리즈명/브랜드명처럼 검색어와 일치하는 경우를 방지
 if(creatorExact && !adultCandidate)score+=1420;
 else if(creatorStarts && !adultCandidate)score+=930;
 else if(creator.includes(q) && !adultCandidate)score+=720;

 const matched=tokens.filter(t=>title.includes(t)||creator.includes(t)).length;
 score+=matched*75;
 if(tokens.length&&matched===tokens.length)score+=130;

 // Generic server search-mode evidence:
 // - title-target result + exact title => stronger edition candidate
 // - person-target result + exact creator => stronger author candidate
 if(book?.serverTargets?.includes('title')&&(titleExact||coreExact))score+=520;
 if(book?.serverTargets?.includes('person')&&(creatorExact||creatorStarts)&&!adultCandidate)score+=560;
 if(book?.serverTargets?.includes('general'))score+=80;

 // A result returned by the server through multiple query modes is
 // stronger evidence than a one-off fringe hit.
 const hits=Math.max(1,Number(book?.serverHitCount)||1);
 score+=Math.min(260,(hits-1)*85);

 // Prefer complete, usable Korean-edition metadata.
 if(book?.isbn)score+=30;
 if(book?.publisher)score+=22;
 if(book?.cover)score+=22;
 if(book?.publishedAt)score+=12;
 score+=bookEditionTrust(book)*175;
 score+=bookPublisherTrust(book)*145;

 // Use popularity only when the server actually supplies it.
 const pop=Math.max(0,Number(book?.searchPopularity)||0);
 if(pop)score+=Math.min(190,Math.log10(pop+1)*42);
 const rating=Math.max(0,Number(book?.averageRating)||0);
 if(rating)score+=Math.min(35,rating*6);

 // YES24 popularity enrichment. Query relevance still dominates.
 const yesPop=Math.max(0,Number(book?.yes24PopularityScore)||0);
 if(yesPop)score+=Math.min(220,yesPop*1.25);

 const salePoint=Math.max(0,Number(book?.yes24SalePoint)||0);
 if(salePoint)score+=Math.min(120,Math.log10(salePoint+1)*28);

 const yesStar=Math.max(0,Number(book?.yes24StarScore)||0);
 if(yesStar)score+=Math.min(24,yesStar*2.4);

 if(book?.yes24Found)score+=18;
 if(book?.yes24BestsellerRank)score+=Math.max(0,70-Math.log10(book.yes24BestsellerRank+1)*24);
 if(book?.yes24SteadyRank)score+=Math.max(0,45-Math.log10(book.yes24SteadyRank+1)*18);

 // For broad/common keywords, popularity should help decide between similarly
 // relevant titles (e.g. general nouns like 편의점, 사랑, 여행).
 if(q.length<=4){
   const broadPop=(Number(book?.yes24SalePoint)||0)+(Number(book?.searchPopularity)||0);
   score+=Math.min(260,Math.log10(broadPop+1)*55);
 }

 // Server/provider ordering is a tie-breaker, not the main ranker.
 const providerRank=Math.max(0,Number(book?.bestServerRank)||index);
 score+=Math.max(0,55-providerRank*1.5);

 return score;
}



function creatorMatchTier(book,query){
 const q=Model.norm(query),creator=Model.norm(book?.creator);
 if(!q||!creator)return 0;
 const parts=String(book?.creator||'')
   .split(/[,/&·]|\s+저|\s+역/)
   .map(Model.norm)
   .filter(Boolean);

 if(creator===q||parts.includes(q))return 3;
 if(creator.startsWith(q)||parts.some(x=>x.startsWith(q)))return 2;
 if(creator.includes(q))return 1;
 return 0;
}

function titleMatchTier(book,query){
 const q=Model.norm(query),title=Model.norm(book?.title),core=bookSearchCoreTitle(book?.title);
 if(!q||!title)return 0;
 if(title===q||core===q)return 4;
 if(title.startsWith(q))return 3;
 if(title.includes(q))return 2;
 if(core.includes(q)||q.includes(core))return 1;
 return 0;
}

function bookPopularityRankScore(book){
 let score=0;

 // YES24 signals
 const yesPop=Math.max(0,Number(book?.yes24PopularityScore)||0);
 const salePoint=Math.max(0,Number(book?.yes24SalePoint)||0);
 const star=Math.max(0,Number(book?.yes24StarScore)||0);
 if(yesPop)score+=Math.min(260,yesPop*1.45);
 if(salePoint)score+=Math.min(180,Math.log10(salePoint+1)*40);
 if(book?.yes24BestsellerRank)score+=Math.max(0,95-Math.log10(Number(book.yes24BestsellerRank)+1)*28);
 if(book?.yes24SteadyRank)score+=Math.max(0,70-Math.log10(Number(book.yes24SteadyRank)+1)*22);
 if(star)score+=Math.min(28,star*2.8);
 if(book?.yes24Found)score+=15;

 // Server/provider popularity if present
 const pop=Math.max(0,Number(book?.searchPopularity)||0);
 if(pop)score+=Math.min(180,Math.log10(pop+1)*40);

 // Provider rank is only a weak fallback when explicit popularity is sparse.
 const providerRank=Math.max(0,Number(book?.bestServerRank)||0);
 score+=Math.max(0,45-providerRank*1.2);

 // Edition trust remains a small tie-breaker, not "popularity".
 score+=bookPublisherTrust(book)*24;
 score+=bookEditionTrust(book)*18;

 return score;
}

function detectBookQueryMode(list,query){
 const q=Model.norm(query);
 if(!q)return 'general';

 let creatorStrong=0,titleStrong=0;
 for(const book of list||[]){
  if(creatorMatchTier(book,q)>=2)creatorStrong++;
  if(titleMatchTier(book,q)>=3)titleStrong++;
 }

 // If several results clearly identify the query as an author/person,
 // treat it as author search. No hardcoded author list is used.
 if(creatorStrong>=2 && creatorStrong>titleStrong)return 'author';
 return 'general';
}

function compareBooksForQuery(a,b,query,mode){
 if(mode==='author'){
  const ca=creatorMatchTier(a,query),cb=creatorMatchTier(b,query);
  if(ca!==cb)return cb-ca;

  // Within the same author-match group, popularity is the primary order.
  const pa=bookPopularityRankScore(a),pb=bookPopularityRankScore(b);
  if(Math.abs(pa-pb)>.001)return pb-pa;

  // Then fall back to detailed relevance/edition quality.
  return bookSearchScore(b,query,b.__searchIndex||0)-bookSearchScore(a,query,a.__searchIndex||0);
 }

 return bookSearchScore(b,query,b.__searchIndex||0)-bookSearchScore(a,query,a.__searchIndex||0);
}

function mergeAndRankBooks(primary,supplement,query){
 const map=new Map();

 const put=(book,index,origin)=>{
  const isbn=String(book?.isbn||'').replace(/\D/g,'');
  const key=isbn.length>=10
    ?'isbn:'+isbn
    :'work:'+Model.norm(book?.title)+'|'+Model.norm(book?.creator)+'|'+Model.norm(book?.publisher);

  const incomingTargets=Array.isArray(book?.serverTargets)?book.serverTargets:[];
  const candidate={
   ...book,
   serverTargets:[...new Set(incomingTargets)],
   serverHitCount:Number(book?.serverHitCount)||1,
   bestServerRank:Number.isFinite(Number(book?.bestServerRank))?Number(book.bestServerRank):index,
   __searchIndex:index,
   __searchOrigin:origin
  };

  const existing=map.get(key);
  if(!existing){
   map.set(key,candidate);
   return;
  }

  const merged={
   ...existing,
   ...candidate,
   cover:existing.cover||candidate.cover,
   publisher:existing.publisher||candidate.publisher,
   isbn:existing.isbn||candidate.isbn,
   publishedAt:existing.publishedAt||candidate.publishedAt,
   contents:[existing.contents,candidate.contents].filter(Boolean).sort((a,b)=>b.length-a.length)[0]||'',
   searchPopularity:Math.max(Number(existing.searchPopularity)||0,Number(candidate.searchPopularity)||0),
   averageRating:Math.max(Number(existing.averageRating)||0,Number(candidate.averageRating)||0),
   yes24Found:Boolean(existing.yes24Found||candidate.yes24Found),
   yes24PopularityScore:Math.max(Number(existing.yes24PopularityScore)||0,Number(candidate.yes24PopularityScore)||0),
   yes24SalePoint:Math.max(Number(existing.yes24SalePoint)||0,Number(candidate.yes24SalePoint)||0),
   yes24StarScore:Math.max(Number(existing.yes24StarScore)||0,Number(candidate.yes24StarScore)||0),
   yes24BestsellerRank:[existing.yes24BestsellerRank,candidate.yes24BestsellerRank].filter(Boolean).sort((a,b)=>a-b)[0]||null,
   yes24SteadyRank:[existing.yes24SteadyRank,candidate.yes24SteadyRank].filter(Boolean).sort((a,b)=>a-b)[0]||null,
   length:existing.length||candidate.length||null,
   serverTargets:[...new Set([...(existing.serverTargets||[]),...(candidate.serverTargets||[])])],
   serverHitCount:(Number(existing.serverHitCount)||1)+(Number(candidate.serverHitCount)||1),
   bestServerRank:Math.min(Number(existing.bestServerRank)||999,Number(candidate.bestServerRank)||999),
   __searchIndex:Math.min(Number(existing.__searchIndex)||999,index)
  };
  map.set(key,merged);
 };

 (primary||[]).forEach((b,i)=>put(b,i,'server'));
 (supplement||[]).forEach((b,i)=>put(b,i+100,'server-extra'));

 const ranked=[...map.values()].filter(b=>!isExcludedBookCandidate(b));
 const mode=detectBookQueryMode(ranked,query);

 // 성인 콘텐츠는 점수 경쟁에서 제외하고 항상 일반 콘텐츠 뒤로 보낸다.
 const normalBooks=ranked.filter(b=>!isAdultBook(b));
 const adultBooks=ranked.filter(b=>isAdultBook(b));

 normalBooks.sort((a,b)=>compareBooksForQuery(a,b,query,mode));
 adultBooks.sort((a,b)=>compareBooksForQuery(a,b,query,mode));

 return [...normalBooks,...adultBooks]
   .map(({__searchIndex,__searchOrigin,...b})=>b);
}



async function lookupSecondaryBookGenre(book){
 try{
  const isbnParts=String(book?.isbn||'').replace(/[^0-9Xx\s]/g,' ').trim().split(/\s+/).filter(Boolean),isbn=isbnParts.sort((a,b)=>b.length-a.length)[0]||'';
  const title=String(book?.title||'').replace(/<[^>]+>/g,'').trim(),author=String(book?.creator||'').split(',')[0].trim();
  if(!title&&!isbn)return null;
  const q=isbn?('isbn:'+isbn):('intitle:'+title+(author?' inauthor:'+author:''));
  const res=await fetch('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(q)+'&maxResults=5&printType=books');
  if(!res.ok)return null;
  const payload=await res.json(),items=Array.isArray(payload?.items)?payload.items:[];
  if(!items.length)return null;
  const tn=Model.norm(title),an=Model.norm(author);
  const ranked=items.map(it=>{const v=it?.volumeInfo||{},vt=Model.norm(v.title||''),va=Model.norm((v.authors||[]).join(' '));let score=0;if(tn&&vt===tn)score+=10;else if(tn&&(vt.includes(tn)||tn.includes(vt)))score+=6;if(an&&va.includes(an))score+=4;if(Array.isArray(v.categories)&&v.categories.length)score+=3;if(v.description)score+=1;return {v,score}}).sort((a,b)=>b.score-a.score);
  const info=ranked[0]?.v||{},categories=(info.categories||[]).map(String).filter(Boolean),raw=categories.join(' / '),description=String(info.description||'');
  const genre=normalizeBookGenre(raw,{...book,title:info.title||title,contents:[book?.contents,description].filter(Boolean).join(' '),rawGenre:raw});
  return genre?{genre,rawGenre:raw||genre,candidates:[[genre,'Google Books'],...(categories.filter(x=>x!==genre).slice(0,3).map(x=>[x,'Google Books 원본']))],description}:null;
 }catch{return null}
}
async function enrichBookGenre(book){
 if(!book||book.type!=='book'||cleanGenreValue(book.genre))return book;
 const local=normalizeBookGenre(book.rawGenre,book);
 if(local){book.genre=local;book.genreSource='auto';book.treeCategory=mappedCategory('book',local).id;book.genreMappingVersion=3;return book;}
 const extra=await lookupSecondaryBookGenre(book);
 if(extra){book.genre=extra.genre;book.rawGenre=extra.rawGenre||book.rawGenre||'';book.genreSource='auto-secondary';book.genreCandidates=extra.candidates||[];book.treeCategory=mappedCategory('book',book.genre).id;book.genreMappingVersion=3;if(!book.contents&&extra.description)book.contents=extra.description;}
 return book;
}
let bookGenreRepairRunning=false;
async function repairMissingBookGenres(limit=36){
 if(bookGenreRepairRunning)return;bookGenreRepairRunning=true;
 try{
  const missing=state.items.filter(c=>c.type==='book'&&!cleanGenreValue(c.genre)&&c.genreSource!=='user').sort((a,b)=>Number(!!b.completed)-Number(!!a.completed)||(b.saves?.at(-1)?.at||0)-(a.saves?.at(-1)?.at||0)).slice(0,limit);
  let changed=false;
  for(let i=0;i<missing.length;i++){
   const c=missing[i],before=c.genre||'';await enrichBookGenre(c);if(c.genre&&c.genre!==before)changed=true;
   if(i%4===3)await new Promise(r=>setTimeout(r,180));
  }
  if(changed){ensureCompletedSpeciesAssignments();persist();if(['forest','detail','today','scrap'].includes(view))render();}
 }finally{bookGenreRepairRunning=false}
}
function stopBookSearchObserver(){
 if(bookSearchObserver){try{bookSearchObserver.disconnect()}catch{}bookSearchObserver=null}
}
function observeBookSearchSentinel(){
 stopBookSearchObserver();
 const sentinel=$('bookSearchSentinel');
 if(!sentinel||!bookSearchHasMore||!bookSearchActiveQuery)return;

 bookSearchObserver=new IntersectionObserver(entries=>{
  if(entries.some(entry=>entry.isIntersecting))loadMoreBookResults();
 },{root:null,rootMargin:'700px 0px',threshold:.01});

 bookSearchObserver.observe(sentinel);
}
function renderRemoteBooks(results,message=''){
 const el=$('catalogResults');if(!el)return;
 stopBookSearchObserver();

 if(message){
  el.innerHTML='<div class="scrap-empty"><p>'+esc(message)+'</p>'+button('직접 입력하기','manual','textbtn scrap-manual')+'</div>';
  return
 }

 if(!results.length){
  el.innerHTML='<div class="scrap-empty"><p>검색 결과가 없어요.</p>'+button('직접 입력하기','manual','textbtn scrap-manual')+'</div>';
  return
 }

 const rows=results.map((c,i)=>
  '<div class="content-row" style="align-items:flex-start">'+
   cover(c)+
   '<div class="grow">'+
    '<div class="title">'+esc(c.title)+'</div>'+
    '<div class="creator">'+[c.creator||'저자 미확인',String(c.publishedAt||'').slice(0,4),c.publisher].filter(Boolean).map(esc).join(' · ')+'</div>'+
   '</div>'+
   remoteScrapButton(c,i,'Book')+
  '</div>'
 ).join('');

 const tail=bookSearchHasMore
  ?'<div id="bookSearchSentinel" style="padding:18px 0 30px;text-align:center"><p class="creator">'+(bookSearchLoadingMore?'더 불러오는 중…':'아래로 내리면 더 불러와요')+'</p></div>'
  :'<div style="height:18px"></div>';

 el.innerHTML='<div class="content-list">'+rows+'</div>'+tail;
 observeBookSearchSentinel();
}
async function fetchServerBookBatch(query,{target='',page=1,size=50}={}){
 try{
  const params=new URLSearchParams({query,q:query,size:String(size),page:String(page)});
  if(target)params.set('target',target);

  const body={query,q:query,size,page};
  if(target)body.target=target;

  const res=await fetch(BOOK_SEARCH_ENDPOINT+'?'+params.toString(),{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(body)
  });

  const raw=await res.text();
  let payload={};
  try{payload=raw?JSON.parse(raw):{}}catch{payload={message:raw}}
  if(!res.ok)return [];

  const docs=unwrapBookDocuments(payload);
  return docs
   .map((d,i)=>{
    const book=normalizeRemoteBook(d);
    return {
     ...book,
     serverTargets:[target||'general'],
     serverHitCount:1,
     bestServerRank:(page-1)*size+i
    };
   })
   .filter(c=>c.title&&!isExcludedBookCandidate(c));
 }catch{
  return [];
 }
}

async function searchServerBookPage(query,page){
 const batches=await Promise.all([
  fetchServerBookBatch(query,{page,size:BOOK_SEARCH_PAGE_SIZE}),
  fetchServerBookBatch(query,{target:'title',page,size:BOOK_SEARCH_PAGE_SIZE}),
  fetchServerBookBatch(query,{target:'person',page,size:BOOK_SEARCH_PAGE_SIZE})
 ]);
 return batches.flat();
}

async function searchPrimaryBooks(query){
 return searchServerBookPage(query,1);
}

function bookResultKey(book){
 const isbn=String(book?.isbn||'').replace(/\D/g,'');
 if(isbn.length>=10)return 'isbn:'+isbn;
 return 'work:'+Model.norm(book?.title)+'|'+Model.norm(book?.creator)+'|'+Model.norm(book?.publisher);
}

async function loadMoreBookResults(){
 if(bookSearchLoadingMore||!bookSearchHasMore||!bookSearchActiveQuery)return;

 const query=bookSearchActiveQuery,page=bookSearchNextPage,seq=bookSearchSeq;
 bookSearchLoadingMore=true;
 renderRemoteBooks(remoteBookResults);

 try{
  const before=new Set(bookSearchRawResults.map(bookResultKey));
  const more=await searchServerBookPage(query,page);

  if(seq!==bookSearchSeq||query!==bookSearchActiveQuery)return;

  const fresh=more.filter(book=>!before.has(bookResultKey(book)));
  if(fresh.length){
   bookSearchRawResults.push(...more);
   bookSearchStagnantPages=0;
  }else{
   bookSearchStagnantPages++;
  }

  bookSearchNextPage=page+1;

  // Stop only when the server truly runs out, or repeats the same page
  // several times (some providers ignore page parameters).
  if(!more.length||bookSearchStagnantPages>=2||page>=30){
   bookSearchHasMore=false;
  }

  remoteBookResults=mergeAndRankBooks(bookSearchRawResults,[],query)
   .filter(c=>!isExcludedBookCandidate(c));

  // 여기서 다시 그리지 않는다 - 아래 finally에서 한 번만 그린다.
  // (여기서도 그리면 finally와 연달아 두 번 그려져 감지기가 중복 발동한다.)
  enrichBookPopularity(remoteBookResults,seq).catch(()=>{});

  const pending=remoteBookResults
   .filter(book=>!cleanGenreValue(book.genre))
   .slice(0,8);
  if(pending.length){
   Promise.all(pending.map(enrichBookGenre))
    .then(()=>{if(seq===bookSearchSeq&&$('catalogResults'))renderRemoteBooks(remoteBookResults)})
    .catch(()=>{});
  }
 }catch{
  if(seq===bookSearchSeq){
   bookSearchHasMore=false;
  }
 }finally{
  if(seq===bookSearchSeq){bookSearchLoadingMore=false;if($('catalogResults'))renderRemoteBooks(remoteBookResults)}
 }
}

async function searchResults(q){
 const query=String(q||'').trim(),seq=++bookSearchSeq;
 stopBookSearchObserver();

 if(!query){
  remoteBookResults=[];
  bookSearchRawResults=[];
  bookSearchActiveQuery='';
  bookSearchHasMore=false;
  renderRemoteBooks([], '책 제목이나 저자를 입력해주세요.');
  return
 }

 bookSearchActiveQuery=query;
 bookSearchNextPage=2;
 bookSearchHasMore=true;
 bookSearchLoadingMore=false;
 bookSearchStagnantPages=0;
 bookSearchRawResults=[];

 const el=$('catalogResults');
 if(el)el.innerHTML='<p class="creator">검색 중…</p>';

 try{
  const serverBooks=await searchPrimaryBooks(query);
  if(seq!==bookSearchSeq||!$('catalogResults'))return;

  bookSearchRawResults=serverBooks;
  remoteBookResults=mergeAndRankBooks(bookSearchRawResults,[],query)
   .filter(c=>!isExcludedBookCandidate(c));

  if(!serverBooks.length)bookSearchHasMore=false;

  renderRemoteBooks(remoteBookResults);
  enrichBookPopularity(remoteBookResults,seq).catch(()=>{});

  const pending=remoteBookResults
   .filter(book=>!cleanGenreValue(book.genre))
   .slice(0,8);

  if(pending.length){
   Promise.all(pending.map(enrichBookGenre))
    .then(()=>{if(seq===bookSearchSeq&&$('catalogResults'))renderRemoteBooks(remoteBookResults)})
    .catch(()=>{});
  }
 }catch(err){
  if(seq!==bookSearchSeq||!$('catalogResults'))return;
  remoteBookResults=[];
  bookSearchRawResults=[];
  bookSearchHasMore=false;
  renderRemoteBooks([],err?.message||'책 검색 서버에 연결하지 못했어요.');
 }
}
function unwrapAlbums(payload){
 if(Array.isArray(payload))return payload;
 const candidates=[payload?.albums,payload?.results,payload?.items,payload?.data?.albums,payload?.data?.results];
 return candidates.find(Array.isArray)||[];
}
function normalizeRemoteAlbum(d){
 const providerId=d?.provider_id??d?.providerId??d?.collectionId??'',release=String(d?.release_date||d?.releaseDate||'').trim(),rawGenre=String(d?.genre||d?.primaryGenreName||'').trim(),genre=normalizeAlbumGenre(rawGenre);
 const searchPopularity=Number(d?.popularity??d?.playCount??d?.play_count??d?.listeners??d?.ratingCount??0)||0;
 // Apple Music/iTunes 검색 응답에는 보통 소개문구가 없음. 있을 때만 채우고, 없으면 빈 문자열로 유지해 book/movie와 필드 구조를 통일한다.
 const albumDescription=String(d?.albumDescription||d?.description||d?.longDescription||d?.notes||'').trim();
 return {type:'album',title:String(d?.title||d?.collectionName||'').trim(),creator:String(d?.artist||d?.artistName||d?.creator||'').trim(),cover:String(d?.cover_url||d?.artworkUrl100||d?.cover||'').trim(),genre,rawGenre,genreSource:'auto',genreCandidates:genre?[[genre,'Apple Music'],...(rawGenre&&rawGenre!==genre?[[rawGenre,'원본 장르']]:[])]:[],provider:String(d?.provider||'apple').trim(),providerId:String(providerId||'').trim(),releaseDate:release,trackCount:Number(d?.track_count??d?.trackCount)||null,copyright:String(d?.copyright||'').trim(),albumDescription,catalogUrl:String(d?.external_url||d?.collectionViewUrl||d?.catalogUrl||'').trim(),source:'Apple Music 앨범 검색',searchPopularity,averageRating:Number(d?.averageRating??d?.rating??0)||0};
}
function renderRemoteAlbums(results,message=''){
 const el=$('musicCatalogResults');if(!el)return;
 if(message){el.innerHTML='<div class="scrap-empty"><p>'+esc(message)+'</p>'+button('직접 입력하기','manual','textbtn scrap-manual')+'</div>';return}
 el.innerHTML=results.length?'<div class="content-list">'+results.map((c,i)=>'<div class="content-row" style="align-items:flex-start">'+cover(c)+'<div class="grow"><div class="title">'+esc(c.title)+'</div><div class="creator">'+esc(c.creator||'아티스트 미확인')+'</div>'+(c.genre?'<div class="badge">'+esc(c.genre)+'</div>':'')+(c.releaseDate?'<div class="badge">'+esc(c.releaseDate.slice(0,4))+(c.trackCount?' · '+c.trackCount+'곡':'')+'</div>':(c.trackCount?'<div class="badge">'+c.trackCount+'곡</div>':''))+'</div>'+remoteScrapButton(c,i,'Album')+'</div>').join('')+'</div>':'<div class="scrap-empty"><p>검색 결과가 없어요.</p>'+button('직접 입력하기','manual','textbtn scrap-manual')+'</div>';
}
async function musicSearchResults(q){
 const query=String(q||'').trim(),seq=++musicSearchSeq;
 if(!query){remoteAlbumResults=[];renderRemoteAlbums([], '앨범명이나 아티스트를 입력해주세요.');return}
 const el=$('musicCatalogResults');if(el)el.innerHTML='<p class="creator">검색 중…</p>';
 try{
  const res=await fetch(MUSIC_SEARCH_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query})});
  const text=await res.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={message:text}}
  if(!res.ok){const detail=payload?.error||payload?.message||('HTTP '+res.status);if(res.status===401)throw Error('검색 서버에서 인증 오류가 발생했어요. Edge Function의 Verify JWT 설정을 확인해주세요.');throw Error(detail)}
  if(seq!==musicSearchSeq||!$('musicCatalogResults'))return;
  remoteAlbumResults=unwrapAlbums(payload).map(normalizeRemoteAlbum).filter(c=>c.title).slice(0,12);
  renderRemoteAlbums(remoteAlbumResults);
 }catch(err){if(seq!==musicSearchSeq||!$('musicCatalogResults'))return;remoteAlbumResults=[];renderRemoteAlbums([],err?.message||'음악 검색 서버에 연결하지 못했어요.');}
}
function unwrapMovies(payload){
 if(Array.isArray(payload))return payload;
 const candidates=[payload?.movies,payload?.results,payload?.items,payload?.data?.movies,payload?.data?.results];
 return candidates.find(Array.isArray)||[];
}
// 책 검색의 Model.norm(공백+문장부호 제거)은 그대로 쓰되, 부제를 통째로
// 잘라내는 bookSearchCoreTitle의 콜론-부제 제거는 영화에 그대로 옮기지 않는다.
// 책은 "제목: 부제"가 대개 같은 책의 다른 판(edition)이라 부제를 떼도 같은
// 작품이지만, 영화는 "제목: 부제"가 서로 다른 별개 작품인 경우가 흔하다
// (예: "식스센스: 속보이는 여자들"은 "식스 센스"(1999)와 무관한 작품).
// 그 규칙을 그대로 썼다가 오히려 동명이작을 "핵심 제목 완전 일치"로
// 오판하게 만든 게 바로 이번에 재현된 버그였다. 그래서 여기서는 괄호/대괄호
// 안의 부가 정보(예: "(2020)", "(리마스터판)")만 걷어내고, 콜론 뒤 부제는
// 그대로 남겨 둔다 — Model.norm이 콜론 "문자"만 지워도 부제 "텍스트"는
// 남으므로 동명이작과는 여전히 구분된다.
function movieSearchCoreTitle(value){
 return Model.norm(String(value||'')
   .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g,' ')
   .replace(/\s+/g,' '));
}
function normalizeRemoteMovie(d){
 const providerId=d?.provider_id??d?.providerId??d?.id??'';
 const release=String(d?.release_date||d?.releaseDate||'').trim();
 const originalTitle=String(d?.original_title||d?.originalTitle||'').trim();
 const genres=movieGenreInfo(d?.genre_ids??d?.genreIds);
 const searchPopularity=Number(d?.popularity??0)||0;
 const voteCount=Number(d?.vote_count??d?.voteCount??0)||0;
 const averageRating=Number(d?.vote_average??d?.voteAverage??d?.rating??0)||0;
 const runtime=Number(d?.runtime??d?.runtime_minutes??d?.runtimeMinutes??0)||null;
 return {type:'movie',title:String(d?.title||'').trim(),creator:String(d?.director||d?.creator||'').trim(),cover:String(d?.poster_url||d?.posterUrl||d?.poster||'').trim(),genre:genres.primary,rawGenre:genres.candidates.map(x=>x[0]).join(', '),genreSource:'auto',genreCandidates:genres.candidates,provider:String(d?.provider||'tmdb').trim(),providerId:String(providerId||'').trim(),releaseDate:release,originalTitle,originalLanguage:String(d?.original_language||d?.originalLanguage||'').trim(),overview:String(d?.overview||'').trim(),genreIds:Array.isArray(d?.genre_ids)?d.genre_ids.map(Number).filter(Number.isFinite):Array.isArray(d?.genreIds)?d.genreIds.map(Number).filter(Number.isFinite):[],catalogUrl:String(d?.external_url||d?.externalUrl||d?.catalogUrl||'').trim(),source:'TMDB 영화 검색',searchPopularity,voteCount,averageRating,runtime};
}

function movieSearchScore(movie,query,index=0){
 // 공백만 지우는 게 아니라 책 검색과 같은 기준(Model.norm)으로 비교하고,
 // 부제/괄호를 뗀 핵심 제목(core title)까지 함께 봐서 "정확히 그 작품"을
 // 콜론-부제가 붙은 동명이작과 확실히 구분한다.
 const q=Model.norm(query);
 const title=Model.norm(movie?.title),core=movieSearchCoreTitle(movie?.title);
 const original=Model.norm(movie?.originalTitle),originalCore=movieSearchCoreTitle(movie?.originalTitle);
 if(!q||!title)return -9999-index;
 let score=0;
 const titleExact=title===q||core===q;
 const originalExact=original===q||originalCore===q;
 if(titleExact)score+=1200;
 else if(originalExact)score+=1080;
 else if(title.startsWith(q)||core.startsWith(q))score+=760;
 else if(title.includes(q)||original.includes(q))score+=620;
 else if(core.includes(q)||originalCore.includes(q)||(core&&q.includes(core)))score+=380;
 // 감독/출연자 매칭 — 현재 원격 응답에 creator(감독)가 채워지지 않는 경우가
 // 많아 당장은 대부분 발동하지 않지만, 나중에 채워지면 바로 반영되도록 둔다.
 const creator=Model.norm(movie?.creator);
 if(creator&&creator===q)score+=900;
 else if(creator&&creator.startsWith(q))score+=500;
 else if(creator&&creator.includes(q))score+=300;
 const pop=Math.max(0,Number(movie?.searchPopularity)||0),votes=Math.max(0,Number(movie?.voteCount)||0),rating=Math.max(0,Number(movie?.averageRating)||0);
 if(pop)score+=Math.min(220,Math.log10(pop+1)*75);
 if(votes)score+=Math.min(220,Math.log10(votes+1)*62);
 if(votes>=100)score+=Math.min(75,rating*8);
 if(movie?.cover)score+=15;
 if(movie?.releaseDate)score+=8;
 score+=Math.max(0,24-index);
 return score;
}
function rankMovies(results,query){
 return [...results].sort((a,b)=>movieSearchScore(b,query)-movieSearchScore(a,query)).slice(0,12);
}
// 결과 중 "이 정도면 정답으로 확신할 만한" 매치가 있는지 — 있으면 굳이
// 추가 조회(재조회)를 하지 않는다. 없으면 아래 rescue 단계로 넘어간다.
// 주의: startsWith는 "확신"의 기준으로 쓰면 안 된다. 바로 이 버그 케이스
// ("식스센스: 속보이는 여자들"이 "식스센스"로 시작함)가 startsWith를
// 확신 기준에 넣었을 때 rescue를 건너뛰게 만든 원인이었다. 완전 일치만
// 확신으로 인정한다.
function movieHasConfidentMatch(results,query){
 const q=Model.norm(query);
 if(!q)return true;
 return (results||[]).some(c=>{
  const title=Model.norm(c?.title),core=movieSearchCoreTitle(c?.title);
  const original=Model.norm(c?.originalTitle),originalCore=movieSearchCoreTitle(c?.originalTitle);
  return title===q||core===q||original===q||originalCore===q;
 });
}
// "식스센스"(공백 없음) vs "식스 센스"(공백 있음)처럼, 원격 검색 API가
// 띄어쓰기 차이만으로 완전히 다른 결과 집합을 돌려주는 경우를 대비한다.
// 입력값을 그대로 1회만 조회하지 않고, 확신할 만한 매치가 없을 때만
// 공백을 뗀/끼워 넣은 변형들을 추가로 조회해 후보를 넓힌다.
function movieSpacingRescueQueries(query){
 const trimmed=String(query||'').trim();
 const variants=new Set();
 const noSpace=trimmed.replace(/\s+/g,'');
 if(noSpace&&noSpace!==trimmed)variants.add(noSpace);
 if(!/\s/.test(trimmed)){
  const chars=[...trimmed];
  if(chars.length>=2&&chars.length<=10){
   for(let i=1;i<chars.length;i++)variants.add(chars.slice(0,i).join('')+' '+chars.slice(i).join(''));
  }
 }
 variants.delete(trimmed);
 return [...variants].slice(0,8);
}

function renderRemoteMovies(results,message=''){
 const el=$('movieCatalogResults');if(!el)return;
 if(message){el.innerHTML='<div class="scrap-empty"><p>'+esc(message)+'</p>'+button('직접 입력하기','manual','textbtn scrap-manual')+'</div>';return}
 el.innerHTML=results.length?'<div class="content-list">'+results.map((c,i)=>'<div class="content-row" style="align-items:flex-start">'+cover(c)+'<div class="grow"><div class="title">'+esc(c.title)+'</div>'+(c.originalTitle&&Model.norm(c.originalTitle)!==Model.norm(c.title)?'<div class="creator">'+esc(c.originalTitle)+'</div>':'')+'<div class="creator">'+[c.releaseDate?c.releaseDate.slice(0,4):'',c.genre||''].filter(Boolean).map(esc).join(' · ')+'</div></div>'+remoteScrapButton(c,i,'Movie')+'</div>').join('')+'</div>':'<div class="scrap-empty"><p>검색 결과가 없어요.</p>'+button('직접 입력하기','manual','textbtn scrap-manual')+'</div>';
}
async function fetchMovieSearchPayload(query){
 const res=await fetch(MOVIE_SEARCH_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query})});
 const text=await res.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{payload={message:text}}
 if(!res.ok){const detail=payload?.error||payload?.message||('HTTP '+res.status);if(res.status===401)throw Error('검색 서버에서 인증 오류가 발생했어요. Edge Function의 Verify JWT 설정을 확인해주세요.');throw Error(detail)}
 return payload;
}
// Recommended movies arrive without credits. After one is scrapped, look it up in movie search
// (which returns the director and runtime) and fill in whatever is missing.
const movieEnrichPending=new Set();
async function enrichMovieDetails(id){
 const c=get(id);if(!c||c.type!=='movie'||c.creator&&c.runtime||movieEnrichPending.has(id))return;
 movieEnrichPending.add(id);
 try{
  const list=unwrapMovies(await fetchMovieSearchPayload(c.title)).map(normalizeRemoteMovie).filter(x=>x?.title);
  const year=String(c.releaseDate||c.published||'').slice(0,4);
  const pick=list.find(x=>c.providerId&&x.providerId===String(c.providerId))||list.filter(x=>!year||String(x.releaseDate||'').startsWith(year)).sort((a,b)=>movieSearchScore(b,c.title)-movieSearchScore(a,c.title))[0];
  const cur=get(id);if(!pick||!cur)return;
  let changed=false;const fill=(k,v)=>{if(v&&!cur[k]){cur[k]=v;changed=true}};
  fill('creator',pick.creator);fill('runtime',pick.runtime);fill('cover',pick.cover);fill('releaseDate',pick.releaseDate);
  if(changed&&persist())render();
 }catch{}finally{movieEnrichPending.delete(id)}
}
function backfillMovieDetails(){state.items.filter(c=>c.type==='movie'&&!c.creator).slice(0,6).forEach((c,i)=>setTimeout(()=>void enrichMovieDetails(c.id),400*i))}
function movieResultKey(c){
 if(c?.provider&&c?.providerId)return c.provider+'|'+c.providerId;
 return Model.norm(c?.title)+'|'+String(c?.releaseDate||'').slice(0,4);
}
async function movieSearchResults(q){
 const query=String(q||'').trim(),seq=++movieSearchSeq;
 if(!query){remoteMovieResults=[];renderRemoteMovies([], '영화 제목을 입력해주세요.');return}
 const el=$('movieCatalogResults');if(el)el.innerHTML='<p class="creator">검색 중…</p>';
 const pool=new Map();
 const absorb=payload=>{
  unwrapMovies(payload).map(normalizeRemoteMovie).filter(c=>c.title).forEach(c=>{
   const key=movieResultKey(c);
   if(!pool.has(key))pool.set(key,c);
  });
 };
 try{
  // 1차 결과는 반드시 먼저 사용자에게 보여준다.
  // rescue 조회를 기다리면서 렌더링을 막으면 입력 중 요청 폭주와
  // 화면 재시작처럼 보이는 현상이 발생하므로 책 검색과 같은 흐름으로 분리한다.
  const primary=await fetchMovieSearchPayload(query);
  if(seq!==movieSearchSeq||!$('movieCatalogResults'))return;
  absorb(primary);

  remoteMovieResults=rankMovies([...pool.values()],query);
  renderRemoteMovies(remoteMovieResults);

  // 보강 조회는 렌더링 이후 백그라운드에서 한 번만 수행한다.
  if(!movieHasConfidentMatch(remoteMovieResults,query)){
   const rescueQueries=movieSpacingRescueQueries(query);
   if(rescueQueries.length){
    const settled=await Promise.all(rescueQueries.map(v=>fetchMovieSearchPayload(v).catch(()=>null)));
    if(seq!==movieSearchSeq||!$('movieCatalogResults'))return;
    const before=new Set([...pool.keys()]);
    settled.forEach(p=>{if(p)absorb(p)});
    const changed=[...pool.keys()].some(k=>!before.has(k));
    if(changed){
     remoteMovieResults=rankMovies([...pool.values()],query);
     renderRemoteMovies(remoteMovieResults);
    }
   }
  }
 }catch(err){
  if(seq!==movieSearchSeq||!$('movieCatalogResults'))return;
  remoteMovieResults=[];
  renderRemoteMovies([],err?.message||'영화 검색 서버에 연결하지 못했어요.');
 }
}

function infoForm(c=null,source=''){
 const defaultType=scrapFlowActive&&scrapComposerState.type==='movie'||modal==='movie-search'?'movie':'book';
 const d=c||{type:defaultType,title:$('catalogSearch')?.value||$('musicCatalogSearch')?.value||$('movieCatalogSearch')?.value||'',creator:'',source};
 const editable=!c||!c.providerId&&!c.isbn;
 const locked=c&&!editable?' disabled aria-disabled="true"':'';
 showModal(c?'나의 분류 수정':'직접 입력','<form id="infoForm" data-edit="'+esc(c?.id||'')+'"><label for="contentType">유형</label><select id="contentType"'+locked+'>'+Object.entries(typeName).map(([k,v])=>'<option value="'+k+'" '+(d.type===k?'selected':'')+'>'+v+'</option>').join('')+'</select><label for="contentTitle">제목</label><input id="contentTitle" required maxlength="200" value="'+esc(d.title)+'"'+(c&&!editable?' readonly':'')+'><label for="contentCreator">제작자 · 모르면 비워두세요</label><input id="contentCreator" maxlength="100" value="'+esc(d.creator)+'"'+(c&&!editable?' readonly':'')+'>'+(c&&!editable?'<p class="muted tiny">검색에서 가져온 원본 정보예요. 장르와 나의 기록을 수정할 수 있어요.</p>':'')+metadataFields(d)+'<label for="contentScrapCount">스크랩 횟수</label><input id="contentScrapCount" type="number" min="0" step="1" value="'+(d.saves?.length||0)+'"><label for="contentSource">출처·메모 · 선택</label><input id="contentSource" maxlength="500" value="'+esc(d.source||'')+'"><label for="contentCover">표지 사진 · 선택</label><input id="contentCover" type="file" accept="image/*"><p class="muted tiny">표지는 스크랩과 달력에만 사용해요.</p><div id="formError" class="form-error" role="alert"></div><button class="primary" type="submit">'+(c?'나의 분류 저장':'스크랩')+'</button></form>','info');
}
function findSavedWork(candidate){
 const keys=new Set(tasteKeys(candidate));
 return state.items.find(item=>tasteKeys(item).some(key=>keys.has(key)));
}
const REMOTE_ADD_HTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',REMOTE_ADDED_HTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>담음';
function remoteScrapButton(candidate,index,type){
 const saved=findSavedWork(candidate);
 if(!saved)return button(REMOTE_ADD_HTML,'addRemote'+type,'remote-add','data-index="'+index+'" aria-label="'+esc(candidate.title)+' 스크랩"');
 if(scrapSessionAdds.has(saved.id))return button(REMOTE_ADDED_HTML,'removeRemote'+type,'remote-added','data-index="'+index+'" aria-label="'+esc(candidate.title)+' 스크랩 취소"');
 return button('이미 있음','detail','remote-saved',attr(saved.id)+' aria-label="'+esc(candidate.title)+' 이미 있음 · 상세 보기"');
}
function undoSessionScrap(candidate,index,type){
 const item=candidate&&findSavedWork(candidate),eventId=item&&scrapSessionAdds.get(item.id);
 if(!item||!eventId){toast('기존 스크랩은 상세 화면에서 관리할 수 있어요.');return}
 item.saves=item.saves.filter(event=>event.id!==eventId);
 if(!item.saves.length&&!item.completed&&!item.logs.length&&!item.rating&&!item.review)Model.remove(state,item.id);
 if(!persist())return;scrapSessionAdds.delete(item.id);updateScrapSessionCount(-1);
 const el=document.querySelector('[data-action="removeRemote'+type+'"][data-index="'+index+'"]');
 if(el)el.outerHTML=remoteScrapButton(candidate,index,type);
}
function updateRemoteScrapButton(index,fromAction,toAction,text){
 const buttonEl=[...document.querySelectorAll('[data-index=\"'+index+'\"]')].find(el=>el.dataset.action===fromAction);
 if(buttonEl){
  buttonEl.dataset.action=toAction;
  if(toAction.startsWith('removeRemote')){buttonEl.className='remote-added';buttonEl.innerHTML=REMOTE_ADDED_HTML;buttonEl.setAttribute('aria-label',text)}else buttonEl.textContent=text;
 }
}
function markScrapped(action,index){
 const buttonAction={
  addRemoteBook:'removeRemoteBook',
  addRemoteAlbum:'removeRemoteAlbum',
  addRemoteMovie:'removeRemoteMovie'
 }[action];
 if(buttonAction)updateRemoteScrapButton(index,action,buttonAction,'스크랩 취소');
}
function removeRemoteBook(index){const c=remoteBookResults[index];undoSessionScrap(c,index,'Book');if(c)scrapAddedBookKeys.delete(bookResultKey(c));}

function saved(c,eventId,options={}){
 state.onboarded=true;if(!persist())return false;dismissToast();
 if(options.keepOpen&&scrapFlowActive){scrapSessionAdds.set(c.id,eventId);updateScrapSessionCount(1);if(options.action!==undefined&&options.index!==undefined)markScrapped(options.action,options.index);return true}
 if(modal==='info'&&scrapFlowActive&&!options.closeAfter){updateScrapSessionCount(1);openScrapComposer(scrapComposerState.type,null,false);return true}
 if(options.keepOpen){render();if(options.action!==undefined&&options.index!==undefined)markScrapped(options.action,options.index);return true}
 closeModal();render();return true;
}
function addRemoteBook(index){
 const d=remoteBookResults[index];if(!d||findSavedWork(d))return;
 const id=Model.uid(),c=Model.add(state,d,id);
 if(!saved(c,id,{keepOpen:true,action:'addRemoteBook',index}))return;
 scrapAddedBookKeys.add(bookResultKey(d));
 // 장르·인기도 보강은 백그라운드로 미룬다. 예전엔 이 두 네트워크 요청이
 // 끝나야 스크랩이 저장돼서(버튼엔 아무 표시도 없이) 응답이 느릴 때
 // 사용자가 다시 검색창/탭을 건드리게 됐고, 그게 searchResults()를
 // 재실행시켜 "검색 중…"이 다시 뜨는 원인이었다. 이제는 탭 즉시
 // 저장부터 하고, 보강 결과는 도착하는 대로 조용히 반영한다.
 (async()=>{
  try{
   if(!cleanGenreValue(c.genre))await enrichBookGenre(c);
   if(!(Number(c.length)>0)&&primaryIsbn13(c?.isbn))await enrichBookPopularity([c],bookSearchSeq).catch(()=>{});
   if(get(c.id)!==c)return;
   ensureCompletedSpeciesAssignments();persist();
   if(!modal&&view==='detail'&&detailId===c.id)refreshWhenIdle();
  }catch{}
 })();
}
function addRemoteAlbum(){toast('음반 기록은 지원하지 않아요. 책이나 영화를 찾아주세요.');}
function addRemoteMovie(index){const d=remoteMovieResults[index];if(!d||findSavedWork(d))return;const id=Model.uid(),c=Model.add(state,d,id);saved(c,id,{keepOpen:true,action:'addRemoteMovie',index})}
function removeRemoteAlbum(index){const c=remoteAlbumResults[index];undoSessionScrap(c,index,'Album');}

function removeRemoteMovie(index){const c=remoteMovieResults[index];undoSessionScrap(c,index,'Movie');}

function startExperience(id){
 const c=get(id);if(!c||c.completed||!['book','movie'].includes(c.type))return;
 const previousStage=Model.stage(c);Model.start(state,id,now());
 state.selected=id;view='today';
 if(!commit())return;
 if(previousStage===0){pendingForestArrival=c.id;document.querySelector('.growth')?.classList.add('is-growing')}
 toast(previousStage===0?'숲에 새싹이 자라기 시작했어요.':'이어가던 경험으로 이동했어요.');
}
function record(id){
 const c=get(id);if(!c||c.completed)return;
 const previousStage=Model.stage(c),previousKey=growthKey(c,previousStage);if(Model.log(state,id,now())){state.selected=id;if(!commit())return;if(previousStage===0)pendingForestArrival=c.id;recordDone(c,previousStage,previousKey)}else toast('오늘 기록이 이미 있어요.');
}
// After recording, Today itself plays the moment: the stamp slams down and, when the stage
// changes, the old tree shrinks away while the new one pops up in the same disc.
function recordDone(c,previousStage,previousKey=growthKey(c,previousStage)){
 const stage=Model.stage(c),key=growthKey(c,stage),grew=key!==previousKey,name=k=>GROWTH_NAMES[k];
 const josa=(word,a,b)=>{const code=word.charCodeAt(word.length-1)-0xAC00;return word+(code>=0&&code<=11171&&code%28?a:b)};
 // 으로/로: a final consonant takes 으로, except ㄹ which takes 로 (덤불로, 어린 나무로).
 const toward=word=>{const code=word.charCodeAt(word.length-1)-0xAC00,fin=code>=0&&code<=11171?code%28:0;return word+(fin&&fin!==8?'으로':'로')};
 const message=grew?josa(name(previousKey),'이','가')+' '+toward(name(key))+' 자랐어요.':'오늘 기록했어요. 한 칸 더 자랐어요.';
 const stamp=view==='today'?document.querySelector('.stamp-done .stamp-button'):null;
 if(!stamp){toast(message);return}
 stamp.classList.add('is-slam');
 if(grew){
  const tree=document.querySelector('.today-panel .today-tree');
  if(tree){
   const prev=tree.cloneNode();prev.src=(SONGLIM_TREE_ASSETS[previousKey]||SONGLIM_TREE_ASSETS.young).src;prev.alt='';prev.classList.add('is-leaving');
   if(previousStage<=1)prev.classList.add('is-small');
   tree.classList.add('is-arriving');tree.after(prev);setTimeout(()=>prev.remove(),1300);
   document.querySelector('.today-panel .today-stage')?.classList.add('is-pop');
  }
 }
 setTimeout(()=>toast(message),grew?900:450);
}
// Planted (redesign 13a): the finished work's tree, its stamp and a way into this month's forest.
// Planted moment: a soft gradient page in the work's colours with light rays, sparkles and the
// coral DONE stamp, then the work and three big numbers (tree no. this month, record days, rating).
function plantedMoment(c){
 const done=c.completed&&c.completed!=='unknown'?c.completed:now(),month=Number(done.slice(5,7)),months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 const number=Math.max(1,state.items.filter(x=>x.completed&&x.completed!=='unknown'&&x.completed.slice(0,7)===done.slice(0,7)).length);
 const logs=new Set(c.logs.map(l=>l.date)).size;
 const tree=c.hiddenTree?bmTreeName('mystery-'+c.hiddenTree):contentSpecies(c)?.name||'나무';
 const spark=(x,y,s,d)=>'<i class="planted-spark" style="left:'+x+'%;top:'+y+'%;width:'+s+'px;height:'+s+'px;animation-delay:'+d+'s"></i>';
 const stat=(value,unit,label)=>'<div class="planted-stat"><b>'+value+'<small>'+unit+'</small></b><span>'+label+'</span></div>';
 showModal('큰 나무를 숲에 심었어요','<div class="planted-bg" data-type="'+c.type+'" aria-hidden="true"><i class="planted-glow"></i></div>'+
 '<p class="moment-kicker">'+months[month-1]+' FOREST · NO.'+number+'</p><h3 class="moment-title" aria-hidden="true">큰 나무를<br>숲에 심었어요.</h3>'+
 '<div class="planted-stage" data-type="'+c.type+'"><i class="planted-rays" aria-hidden="true"></i><i class="planted-sun" aria-hidden="true"></i>'+
  spark(14,18,14,0)+spark(80,58,10,.6)+spark(22,70,9,1.1)+spark(70,12,8,1.6)+spark(88,30,12,.3)+spark(8,46,7,1.9)+
  stickerTree(c,3,'planted-tree')+'<div class="planted-stamp-real" aria-hidden="true">'+stampSVG(c,true)+'</div>'+
  '<span class="planted-cover">'+(c.cover?'<img src="'+esc(c.cover)+'" alt="" decoding="async" loading="lazy">':'')+'</span></div>'+
 '<div class="planted-copy"><strong>'+esc(c.title)+'</strong><span>'+esc(tree)+((code=>{const fin=code>=0&&code<=11171?code%28:0;return fin&&fin!==8?'으로':'로'})(tree.charCodeAt(tree.length-1)-0xAC00))+' 자랐어요</span></div>'+
 '<div class="planted-stats">'+stat(number,'번째','이달의 나무')+stat(logs||1,'일','함께한 기록')+stat(validRating(c.rating)?'<i class="planted-star" aria-hidden="true">★</i>'+Number(c.rating).toFixed(1):'–','','별점')+'</div>'+
 '<div class="planted-actions">'+button(month+'월의 숲 보기','completionForest','primary',attr(c.id))+button(icon('share'),'shareWork','planted-share',attr(c.id)+' aria-label="'+esc(c.title)+' 공유하기"')+'</div>','planted');
}
function complete(id){const c=get(id);if(!c||c.completed)return;ratingPrompt(c,true)}
function editLog(id,logId){
 const c=get(id),l=c?.logs.find(l=>l.id===logId);if(!l)return;
 showModal('경험 기록 수정','<form id="logForm" data-id="'+id+'" data-log="'+logId+'"><label for="logDate">기록 날짜</label><input id="logDate" type="date" max="'+now()+'" required value="'+l.date+'">'+(c.type==='book'?'<label for="logPage">마지막으로 읽은 쪽 · 선택</label><input id="logPage" type="number" min="0" max="100000" value="'+esc(l.page)+'">':'')+'<label for="logMemo">메모 · 선택</label><textarea id="logMemo" maxlength="4000">'+esc(l.memo)+'</textarea><div id="formError" class="form-error" role="alert"></div><button type="submit" class="primary">수정 저장</button>'+button('이 기록 삭제','deleteLog','textbtn danger',attr(id)+' data-log="'+logId+'"')+'</form>','log');
}
function themes(){openCollection('floors')}

// Free memos on a work, not tied to a record day.
function editNote(id,noteId=''){
 const c=get(id);if(!c)return;const n=(c.notes||[]).find(x=>x.id===noteId);
 showModal(n?'메모 수정':'메모 남기기','<form id="noteForm" data-id="'+esc(id)+'" data-note="'+esc(noteId)+'"><label for="noteText" class="sr-only">메모</label><textarea id="noteText" maxlength="4000" placeholder="기억하고 싶은 문장이나 생각">'+esc(n?.text||'')+'</textarea><button type="submit" class="primary">저장</button>'+(n?button('메모 삭제','deleteNote','textbtn',attr(id)+' data-note="'+esc(noteId)+'"'):'')+'</form>','memo');
}
function editMemo(id,logId){
 const l=get(id)?.logs.find(l=>l.id===logId);if(!l)return;
 showModal(l.memo?'메모 수정':'메모 남기기','<form id="memoForm" data-id="'+esc(id)+'" data-log="'+esc(logId)+'"><label for="todayMemo">오늘 읽으며 남기고 싶은 생각</label><textarea id="todayMemo" maxlength="4000" placeholder="짧은 생각이나 기억하고 싶은 문장">'+esc(l.memo)+'</textarea><button type="submit" class="primary">저장</button></form>','memo');
}
