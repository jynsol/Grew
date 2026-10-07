/* original script block 19 */
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
 const a=b.dataset.action,id=b.dataset.id,c=id?get(id):null;
 // 스크랩 카드 액션은 검색창/상위 클릭 핸들러로 전파되지 않도록 고정한다.
 if(['addRemoteBook','removeRemoteBook','addRemoteAlbum','removeRemoteAlbum','addRemoteMovie','removeRemoteMovie'].includes(a)){
  e.preventDefault();
  e.stopPropagation();
 }
 if(a==='backdrop'&&e.target!==b)return;
 if(a==='tab'){go(b.dataset.tab);return}
 if(a==='close'||a==='backdrop'){
  if(scrapFlowActive&&modal!=='scrap-composer'&&['link','photo','info','review'].includes(modal)){openScrapComposer(scrapComposerState.type,null,false);return}
  closeModal();return
 }
 if(a==='completionForest'){const c=get(b.dataset.id);if(c){year=forestRecordYear(c);if(c.completed&&c.completed!=='unknown')month=c.completed.slice(0,7)}forestMode='month';forestShow='forest';zoomState={scale:1,x:0,y:0};forestViewportYear=null;go('forest');return}
 if(a==='completionNext'){go('today');return}
 if(a==='confirm'){const fn=window.pendingConfirm;window.pendingConfirm=null;closeModal();fn?.();return}
 if(a==='toastUndo'){const fn=undoAction;undoAction=null;$('toast').innerHTML='';fn?.();return}
 if(a==='add'){addMenu();return}
 if(a==='scrapType'){openScrapComposer(b.dataset.type,null,false);return}
 if(a==='scrapDone'){scrapFlowActive=false;closeModal();render();window.scrollTo(0,0);return}
 if(a==='manual'){infoForm();return}
 if(a==='linkAdd'){linkAdd();return}
 if(a==='photoAdd'){photoAdd();return}
 if(a==='runOCR'){runOCR();return}
 if(a==='candidateManual'){
  const title=$('ocrTitle').value.trim();if(!title){$('ocrTitle').focus();return}
  const data={title,creator:$('ocrCreator').value.trim(),type:$('ocrType').value,selected:true,source:photoImportSource?.url||'사진 확인',...(photoImportSource?{linkSources:[photoImportSource]}:{})};
  if(!['book','movie'].includes(data.type)){toast('책 또는 영화를 선택해주세요.');return}
  if(!candidates.some(c=>c.type===data.type&&Model.norm(c.title)===Model.norm(title)&&Model.norm(c.creator)===Model.norm(data.creator)))candidates.push(data);
  $('ocrTitle').value='';$('ocrCreator').value='';renderCandidates();return
 }
 if(a==='saveCandidates'){
  if(b.disabled)return;b.disabled=true;
  const batch=Model.uid(),chosen=candidates.filter(c=>c.selected&&['book','movie'].includes(c.type)),returnScroll=window.scrollY;
  if(!chosen.length){b.disabled=false;toast('저장할 책이나 영화를 선택해주세요.');return}
  chosen.forEach((c,i)=>Model.add(state,c,batch+'-'+i));state.onboarded=true;if(!persist()){b.disabled=false;return;}
  // Screenshot import is a single batch task. Once the selected works are saved,
  // close the whole add flow instead of reopening the scrap composer.
  if(scrapFlowActive)scrapFlowActive=false;
  closeModal();render();requestAnimationFrame(()=>window.scrollTo(0,returnScroll));
  toast(chosen.length+'개 스크랩했어요.');
  return
 }
 if(['addRemoteBook','removeRemoteBook','addRemoteAlbum','removeRemoteAlbum','addRemoteMovie','removeRemoteMovie'].includes(a)){
  e.preventDefault();
  e.stopPropagation();
 }
 if(a==='addRemoteBook'){addRemoteBook(Number(b.dataset.index));return}
 if(a==='removeRemoteBook'){removeRemoteBook(Number(b.dataset.index));return}
 if(a==='addRemoteAlbum'){addRemoteAlbum(Number(b.dataset.index));return}
 if(a==='removeRemoteAlbum'){removeRemoteAlbum(Number(b.dataset.index));return}
 if(a==='addRemoteMovie'){addRemoteMovie(Number(b.dataset.index));return}
 if(a==='removeRemoteMovie'){removeRemoteMovie(Number(b.dataset.index));return}
 if(a==='choose'){if(c&&!c.completed){state.selected=c.id;todayPickedId=c.id;state.onboarded=true;if(!persist())return;go('today')}return}
 if(a==='pick'){pick();return}
 if(a==='readingList'){openReadingList(id);return}
 if(a==='cancelPick'){go('today');return}
 if(a==='nextCandidate'){
  const pool=state.items.filter(item=>!item.completed).sort((a,b)=>b.saves.length-a.saves.length||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0));
  if(pool.length<2)return;
  const index=pool.findIndex(item=>item.id===b.dataset.id);
  state.selected=pool[(index+1)%pool.length].id;if(!commit())return;window.scrollTo(0,0);return
 }
 if(a==='detail'){openDetail(id);return}
 if(a==='back'){if(candidatePreview){closeCandidateDetail();return}go(['sound','notifications'].includes(view)?'my':['calendar','shop','codex'].includes(view)?'forest':detailOrigin);return}
 if(a==='toToday'){go('today');return}
 if(a==='toScrap'){go('scrap');return}
 if(a==='calendar'){forestMode='month';forestShow='calendar';go('forest');return}
 if(a==='forestYearView'){forestMode='year';forestEditMode=false;render();window.scrollTo(0,0);return}
 if(a==='forestMonthView'){if(/^\d{4}-\d{2}$/.test(b.dataset.month||''))month=b.dataset.month;forestMode='month';forestViewportYear=null;zoomState={scale:1,x:0,y:0};render();window.scrollTo(0,0);return}
 if(a==='forestShow'){forestShow=b.dataset.show==='calendar'?'calendar':'forest';forestEditMode=false;render();return}
 if(a==='forestType'){if(['all','book','movie'].includes(b.dataset.type))forestTypeFilter=b.dataset.type;render();return}
 if(a==='forestPrevMonth'||a==='forestNextMonth'){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+(a==='forestPrevMonth'?-1:1),1),next=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(next<=now().slice(0,7)){month=next;forestViewportYear=null;zoomState={scale:1,x:0,y:0};render()}return}
 if(a==='forestPrevYear'||a==='forestNextYear'){const y=Number(year)+(a==='forestPrevYear'?-1:1);if(String(y)<=now().slice(0,4)){year=String(y);month=y===Number(now().slice(0,4))?now().slice(0,7):y+'-12';render()}return}
 if(a==='scrapFilters'){openScrapFilters();return}
 if(a==='scrapFilterDraftReset'){const form=$('scrapFilterForm');if(form){const status=form.querySelector('input[name="status"][value="all"]');if(status)status.checked=true;form.querySelector('input[name="sort"][value="recent"]').checked=true}return}
 if(a==='clearScrapStatus'){if(updateScrapFilters({status:'all'}))document.querySelector('[data-action="scrapFilters"]')?.focus();return}
 if(a==='clearScrapSort'){if(updateScrapFilters({sort:'recent'}))document.querySelector('[data-action="scrapFilters"]')?.focus();return}
 if(a==='filterType'){if(['all','book','movie'].includes(b.dataset.type)&&updateScrapFilters({type:b.dataset.type}))document.querySelector('.type-tab.active')?.focus();return}
 if(a==='filterStatus'){if(['all','saved','active','done'].includes(b.dataset.status))updateScrapFilters({status:b.dataset.status});return}
 if(a==='resetFilters'){updateScrapFilters({q:'',status:'all',type:'all',sort:'recent'});return}
 if(a==='inlinePicker'){toggleInlinePicker(b);return}
 if(a==='inlineSort'){if(['recent','many','old','rating'].includes(b.dataset.value)){if(!updateScrapFilters({sort:b.dataset.value}))return;document.querySelector('[data-picker=sort]')?.focus()}return}
 if(a==='startExperience'){startExperience(id);return}
 if(a==='record'){record(id);return}
 if(a==='complete'){complete(id);return}
 if(a==='undoComplete'){Model.undoComplete(state,id);if(!commit(true))return;toast('완료를 취소했어요. 이전 경험 기록은 남아 있어요.');return}
 if(a==='undoLog'){const removed=c.logs.find(l=>l.date===now());c.logs=c.logs.filter(l=>l.date!==now());if(!commit())return;toast('오늘 기록을 취소했어요.',()=>{if(removed&&!c.logs.some(l=>l.date===removed.date)){c.logs.push(removed);commit()}});return}
 if(a==='editMemo'){editMemo(id,b.dataset.log);return}
 if(a==='editLog'){editLog(id,b.dataset.log);return}
 if(a==='deleteLog'){const logId=b.dataset.log;confirmBox('이 기록을 삭제할까요?','선택한 날의 경험 기록만 삭제합니다.',()=>{c.logs=c.logs.filter(l=>l.id!==logId);if(!commit())return;toast('기록을 삭제했어요.')},'기록 삭제',true);return}
 if(a==='editInfo'){infoForm(c);return}
 if(a==='rescrap'){const event=Model.uid();Model.add(state,c,event);saved(c,event);return}
 if(a==='delete'){confirmBox('스크랩을 삭제할까요?','이 콘텐츠의 스크랩·경험 기록·완료·숲의 나무가 함께 삭제됩니다.',()=>{Model.remove(state,id);if(!persist())return;go('scrap');toast('스크랩을 삭제했어요.')},'삭제',true);return}
 if(a==='rating'){ratingPrompt(c,view==='today'&&state.selected===c.id&&!!c.completed);return}
 if(a==='star'){$('ratingValue').value=b.dataset.value;$('ratingText').textContent=b.dataset.value+'점';document.querySelectorAll('.rating button').forEach(el=>el.classList.toggle('on',Number(el.dataset.value)<=Number(b.dataset.value)));return}
 if(a==='clearRating'){c.rating=null;if(!commit(true))return;return}
 if(a==='editCompletion'){editCompletion(id);return}
 if(a==='external'){
  const query=c.type==='album'&&c.tracks.length?c.creator+' '+c.tracks[c.trackIndex%c.tracks.length]:c.title+' '+c.creator;
  const url=c.type==='book'?'https://search.kyobobook.co.kr/search?keyword='+encodeURIComponent(query):c.type==='album'?(c.catalogUrl||('https://www.youtube.com/results?search_query='+encodeURIComponent(query))):(c.catalogUrl||('https://search.naver.com/search.naver?query='+encodeURIComponent(query+' 영화')));
  window.open(url,'_blank','noopener,noreferrer');return
 }
 if(a==='track'){c.trackIndex=Number(b.dataset.index);if(!commit())return;return}
 if(a==='year'){year=b.dataset.year;zoomState={scale:1,x:0,y:0};forestViewportYear=null;render();document.querySelector('[data-picker=year]')?.focus();return}
 if(a==='bmOpenShop'){bmOpenShop();return}
 if(a==='bmWorkTree'){openTreePicker(b.dataset.id);return}
 if(bmAction(a,b))return;
 if(a==='collection'){openCollection('inventory');return}
 if(a==='collectionTab'){openCollection(b.dataset.tab);return}
 if(a==='treeToggle'){bmOpenPreview('tree',b.dataset.species);return}
 if(a==='forestEdit'){forestEditMode=!forestEditMode;render();return}
 if(a==='contentTreePick'){const item=get(b.dataset.id);if(item)bmOpenPreview('tree',b.dataset.species,item.id);return}
 if(a==='contentHiddenPick'){const item=get(b.dataset.id);if(item)bmOpenPreview('tree','mystery-'+b.dataset.hidden,item.id);return}
 if(a==='contentHiddenClear'){const item=get(b.dataset.id);if(item){bmResetItemAppearance(state,item);commit(true)}return}
 if(a==='contentTreeAuto'){const item=get(b.dataset.id);if(item){bmResetItemAppearance(state,item);commit(true)}return}
 if(a==='themes'){themes();return}
 if(a==='theme'){themes();return}
 if(a==='prevMonth'){changeMonth(-1);return}
 if(a==='nextMonth'){changeMonth(1);return}
 if(a==='months'){showModal('월 선택','<label for="monthValue">연월</label><input id="monthValue" type="month" max="'+now().slice(0,7)+'" value="'+month+'"><p class="summary">선택하면 바로 반영됩니다.</p>','months');return}
 if(a==='day'){
  const list=state.items.filter(c=>c.completed===b.dataset.date||c.logs.some(l=>l.date===b.dataset.date));if(!list.length){toast('이날 남긴 기록이 없어요.');return}
  if(list.length===1)openDetail(list[0].id,'calendar');
  else showModal(b.dataset.date+'의 경험','<div class="content-list">'+list.map(c=>row(c)).join('')+'</div>','day');
  return
 }
 if(a==='shareForest'){makeShare('forest');return}
 if(a==='shareMonth'){makeShare('month');return}
 if(a==='retryShare'){makeShare(shareKind);return}
 if(a==='nativeShare'){nativeShare();return}
 if(a==='saveImage'){
  if(!shareFresh()){await makeShare(shareKind);toast('최신 기록으로 갱신했어요. 다시 저장해주세요.');return}
  if(shareBlob){download(shareBlob,'grew-'+(shareKind==='forest'?year:month)+'.png');toast('이미지를 다운로드했어요.')}return
 }
 if(a==='profile'){openProfile();return}
 if(a==='profilePhotoChoose'){if(modal==='profile')$('profilePhotoFile')?.click();return}
 if(a==='profilePhotoRemove'){if(modal==='profile'&&profileEdit){profileEdit.request++;profileEdit.photo='';profileEdit.loading=false;$('profileError').textContent='';updateProfilePhotoPreview()}return}
 if(a==='tastes'){tasteStart();return}
 if(a==='notifications'){go('notifications');return}
 if(a==='terms'){showModal('서비스 이용 안내','<p>결제는 진행하지 않습니다. 로그인한 사용자의 스크랩·경험 기록은 브라우저에 저장하면서 Supabase에도 동기화합니다. 책·영화 검색어는 검색 결과를 받기 위해 '+esc(APP_BRAND.ko)+'의 Supabase Edge Function으로 전송됩니다.</p><div class="space"></div><p>외부 검색 링크를 누르면 해당 서비스로 이동합니다. 데이터 보관을 위해 MY에서 백업을 다운로드할 수 있습니다.</p><p class="creator">계정 서비스용 약관과 개인정보 처리방침은 정식 서비스에서 별도로 제공합니다.</p>','terms');return}
 if(a==='backup'){exportBackup();return}
 if(a==='restore'){$('restoreFile').click();return}
 if(a==='treeUnlockTest'){addTreeUnlockTestData();return}
 if(a==='nextDay'){state.offset++;if(!persist())return;render();toast('체험 날짜를 '+now()+'로 바꿨어요.');return}
 if(a==='realDay'){state.offset=0;if(!persist())return;render();toast('실제 날짜로 돌아왔어요.');return}
 if(a==='clear'){confirmBox('모든 데이터를 삭제할까요?','이 브라우저의 '+APP_BRAND.ko+' 스크랩·경험·완료·테마·프로필이 모두 초기화됩니다.',resetAll,'전체 삭제');return}

});
const imeComposingIds=new Set();
let mainSearchRenderTimer=null;
const catalogSearchTimers={book:null,album:null,movie:null};

function catalogKindFromId(id){
 return id==='catalogSearch'?'book':id==='musicCatalogSearch'?'album':id==='movieCatalogSearch'?'movie':'';
}
function cancelCatalogTimer(kind){
 if(!kind)return;
 clearTimeout(catalogSearchTimers[kind]);
 catalogSearchTimers[kind]=null;
 if(kind==='book'){clearTimeout(bookSearchTimer);bookSearchTimer=null}
 if(kind==='album'){clearTimeout(musicSearchTimer);musicSearchTimer=null}
 if(kind==='movie'){clearTimeout(movieSearchTimer);movieSearchTimer=null}
}
function invalidateCatalogRequest(kind){
 if(kind==='book')bookSearchSeq++;
 else if(kind==='album')musicSearchSeq++;
 else if(kind==='movie')movieSearchSeq++;
}
function runCatalogSearch(kind,value){
 if(kind==='book')searchResults(value);
 else if(kind==='album')musicSearchResults(value);
 else if(kind==='movie')movieSearchResults(value);
}
function scheduleCatalogSearchFromLiveInput(input,delay=460){
 const id=input?.id,kind=catalogKindFromId(id);
 if(!kind)return;
 if(scrapFlowActive)scrapComposerState.queries[kind]=input.value;
 cancelCatalogTimer(kind);

 catalogSearchTimers[kind]=setTimeout(()=>{
  catalogSearchTimers[kind]=null;
  const current=document.getElementById(id);
  if(!current)return;

  // Windows/Chromium can keep the final Hangul syllable in composition
  // until another key is pressed. So do not wait for compositionend here.
  const value=current.value;
  if(scrapFlowActive)scrapComposerState.queries[kind]=value;
  runCatalogSearch(kind,value);
 },delay);
}

function scheduleMainSearchRender(input){
 const q=input.value,position=input.selectionStart??q.length;
 activeScrapFilters().q=q;if(!picking)persist();
 clearTimeout(mainSearchRenderTimer);
 mainSearchRenderTimer=setTimeout(()=>{
  mainSearchRenderTimer=null;
  if(imeComposingIds.has('search'))return;
  const current=$('search');
  if(current&&document.activeElement===current&&current.value!==q)return;
  if(view!=='scrap'||modal)return;
  const scroll=window.scrollY;
  render();
  const next=$('search');
  if(next){
   next.focus();
   try{next.setSelectionRange(Math.min(position,next.value.length),Math.min(position,next.value.length))}catch{}
  }
  window.scrollTo(0,scroll);
 },480);
}

document.addEventListener('compositionstart',e=>{
 const input=e.target,id=input?.id;
 if(!['search','catalogSearch','musicCatalogSearch','movieCatalogSearch'].includes(id))return;
 imeComposingIds.add(id);

 if(id==='search'){
  clearTimeout(mainSearchRenderTimer);
  mainSearchRenderTimer=null;
  return;
 }

 const kind=catalogKindFromId(id);
 invalidateCatalogRequest(kind);
 cancelCatalogTimer(kind);
});

document.addEventListener('compositionend',e=>{
 const id=e.target?.id;
 if(!['search','catalogSearch','musicCatalogSearch','movieCatalogSearch'].includes(id))return;
 imeComposingIds.delete(id);

 setTimeout(()=>{
  const current=document.getElementById(id);
  if(!current)return;
  if(id==='search')scheduleMainSearchRender(current);
  else scheduleCatalogSearchFromLiveInput(current,80);
 },0);
});

document.addEventListener('input',e=>{
 const input=e.target,id=input?.id;
 if(!['search','catalogSearch','musicCatalogSearch','movieCatalogSearch'].includes(id))return;

 if(id==='search'){
  activeScrapFilters().q=input.value;if(!picking)persist();
  if(e.isComposing||imeComposingIds.has(id))return;
  scheduleMainSearchRender(input);
  return;
 }

 const kind=catalogKindFromId(id);
 invalidateCatalogRequest(kind);

 // Always schedule from the latest visible text, even while composing.
 // Search result rendering does not replace the catalog input node.
 scheduleCatalogSearchFromLiveInput(input,460);
});

document.addEventListener('input',e=>{if(e.target.id==='profileBio'&&$('profileBioCount'))$('profileBioCount').textContent=e.target.value.length});
document.addEventListener('change',async e=>{
 const el=e.target;
 if(el.dataset.candidate!==undefined){candidates[Number(el.dataset.candidate)].selected=el.checked;renderCandidates()}
 if(el.id==='monthValue'){if(/^\d{4}-\d{2}$/.test(el.value)&&el.value<=now().slice(0,7)){month=el.value;closeModal();render()}else toast('미래 월은 선택할 수 없어요.')}
 if(el.id==='profilePhotoFile'){const file=el.files?.[0];el.value='';await changeProfilePhoto(file,el.form);return}
 if(el.id==='photoFiles'){
  photoFiles=[...el.files].filter(f=>f.type.startsWith('image/')).slice(0,10);
  $('photoThumbs').innerHTML=photoFiles.map(f=>'<span class="muted">'+esc(f.name)+'</span>').join('');
  $('ocrButton').disabled=!photoFiles.length;$('ocrProgress').textContent=photoFiles.length+'장 선택';
 }
 if(el.id==='restoreFile'){
  const file=el.files[0];if(!file)return;
  try{if(file.size>20000000)throw Error('백업 파일이 너무 커요.');const parsed=JSON.parse(await file.text());const s=Array.isArray(parsed.contents)?migrateLegacy(parsed):Model.validate(parsed);confirmBox('백업을 복원할까요?','현재 기록을 백업의 '+s.items.length+'개 콘텐츠로 대체합니다.',()=>replaceData(s),'복원')}catch(err){toast(err.message||'백업 파일을 확인해주세요.')}el.value='';
 }
});
document.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;
 if(f.id==='infoForm'){
  const old=f.dataset.edit?get(f.dataset.edit):null,type=$('contentType').value,genre=$('contentGenre').value,data={type,title:$('contentTitle').value.trim(),creator:$('contentCreator').value.trim(),source:$('contentSource').value.trim(),genre,rawGenre:old?.rawGenre||old?.genre||'',genreSource:'user',treeCategory:category({type,genre}).id,length:$('contentLength')?(Number($('contentLength').value)||null):(old?.length||null),rating:$('contentRating')?($('contentRating').value?Number($('contentRating').value):null):old?.rating||null,scrapCount:$('contentScrapCount')?Math.max(0,Number($('contentScrapCount').value)||0):old?.saves?.length||0};
  if(!['book','movie'].includes(data.type)){$('formError').textContent='책 또는 영화를 선택해주세요.';return}
  if(!data.title){$('formError').textContent='제목을 입력해주세요.';return}
  const submit=f.querySelector('[type=submit]');submit.disabled=true;
  try{
   const file=$('contentCover').files[0];if(file)data.cover=await imageData(file);
   if(!f.isConnected)return;
   if(old){
    const duplicate=state.items.find(c=>c.id!==old.id&&c.type===data.type&&Model.norm(c.title)===Model.norm(data.title)&&Model.norm(c.creator)===Model.norm(data.creator));
    if(duplicate){$('formError').textContent='같은 작품이 이미 있어요. 중복된 정보로 바꾸지 않았습니다.';submit.disabled=false;return}
    Object.assign(old,data);if(Number.isFinite(data.scrapCount)){while(old.saves.length<data.scrapCount)old.saves.push({id:Model.uid(),at:Date.now(),source:'직접 수정'});if(old.saves.length>data.scrapCount)old.saves=old.saves.slice(0,data.scrapCount)}delete old.scrapCount;if(!commit(true))return;toast('기본 정보를 저장했어요.');
   }else{const event=Model.uid(),c=Model.add(state,data,event);saved(c,event)}
  }catch(err){if($('formError'))$('formError').textContent=err.message;submit.disabled=false}
 }
 
 if(f.id==='scrapFilterForm'){
  const values=new FormData(f),status=picking?'all':values.get('status'),sort=values.get('sort');
  if(!['all','saved','active','done'].includes(status)||!Object.hasOwn(SCRAP_SORT_LABELS,sort))return;
  if(updateScrapFilters({status,sort},true))document.querySelector('[data-action="scrapFilters"]')?.focus();return;
 }
 if(f.id==='filterForm'){updateScrapFilters({sort:$('filterSort').value},true);return}
 if(f.id==='profileForm'){saveProfile(f);return}
 if(f.id==='tasteForm'){state.profile.tastes=[...f.querySelectorAll('input:checked')].map(x=>x.value);if(!commit(true))return;toast('취향을 저장했어요.')}
 if(f.id==='recordDoneForm'){const l=get(f.dataset.id)?.logs.find(l=>l.id===f.dataset.log),memo=$('recordDoneMemo').value.trim();if(l&&memo!==l.memo){l.memo=memo;if(!commit(true))return;toast('메모를 저장했어요.')}else closeModal();return}
 if(f.id==='memoForm'){const l=get(f.dataset.id)?.logs.find(l=>l.id===f.dataset.log);if(l){l.memo=$('todayMemo').value.trim();if(!commit(true))return;toast('메모를 저장했어요.')}return}
 if(f.id==='logForm'){
  const c=get(f.dataset.id),l=c.logs.find(l=>l.id===f.dataset.log),date=$('logDate').value,page=$('logPage')?.value||'',memo=$('logMemo').value;
  if(!Model.validDate(date)||date>now()){$('formError').textContent='오늘 또는 과거 날짜를 선택해주세요.';return}
  const duplicate=c.logs.find(x=>x.date===date&&x.id!==l.id);
  const apply=()=>{if(duplicate){duplicate.page=page||duplicate.page;duplicate.memo=[duplicate.memo,memo].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join('\n');c.logs=c.logs.filter(x=>x.id!==l.id)}else Object.assign(l,{date,page,memo});if(!commit(true))return;toast('기록을 수정했어요.')};
  if(duplicate)confirmBox('같은 날짜에 기록이 있어요','입력한 메모를 기존 기록과 합칩니다. 페이지를 입력했다면 해당 값으로 바꿉니다.',apply,'기록 합치기');else apply();
 }
 if(f.id==='completionForm'){const date=$('completionDate').value;if(!Model.validDate(date)||date>now()){$('formError').textContent='오늘 또는 과거 날짜를 선택해주세요.';return}const item=get(f.dataset.id);item.completed=date;item.completedAt=item.completedAt||Date.now();assignAutoSpecies(item);if(!commit(true))return;toast('완료일과 숲·달력을 갱신했어요.')}
 if(f.id==='ratingForm'){
  const c=get(f.dataset.id);if(!c)return;
  const returnView=view,returnScroll=window.scrollY;
  c.rating=validRating($('ratingValue').value);c.review=$('reviewMemo').value.trim();
  const advance=f.dataset.advance==='yes';
  if(advance&&!c.completed){const picked=$('finishDate')?.value;Model.complete(state,c.id,Model.validDate(picked)&&picked<=now()?picked:now());assignAutoSpecies(c,true);pendingForestArrival=c.id}
  if(advance){
   const next=latestReading(c.id)||state.items.filter(item=>!item.completed).sort((a,b)=>b.saves.length-a.saves.length||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0))[0];
   state.selected=next?.id||null;picking=false;sessionStorageSafe('candidate','0');
  }
  if(!commit(true))return;
  if(advance){plantedMoment(c);return}
  toast(advance?(returnView==='today'&&state.selected?'나무가 심어졌어요. 다음 콘텐츠를 준비했어요.':state.selected?'나무가 심어졌어요.':'나무가 심어졌어요. 모아둔 콘텐츠를 모두 경험했어요.'):'평점과 감상을 저장했어요.');
 }
 
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&modal){if(scrapFlowActive&&modal!=='scrap-composer'&&['link','photo','info','review'].includes(modal))openScrapComposer(scrapComposerState.type,null,false);else closeModal();return}
 if(e.key==='Tab'&&modal){
  const els=[...$('overlay').querySelectorAll('button:not(:disabled),input:not([type=hidden]),select,textarea,a[href],summary,[tabindex="0"]')].filter(x=>x.getClientRects().length);
  if(!els.length)return;
  const first=els[0],last=els.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});
function refreshWhenIdle(){if(modal||document.activeElement?.matches('input,textarea,select')||document.querySelector('#page form'))return false;render();return true}
let lastKnownDate=now();
function refreshDateIfNeeded(){const d=now();if(d!==lastKnownDate&&refreshWhenIdle())lastKnownDate=d}
document.addEventListener('visibilitychange',()=>{$('forestViewport')?.classList.toggle('paused',document.hidden);if(!document.hidden)refreshDateIfNeeded()});
setInterval(refreshDateIfNeeded,60000);
window.addEventListener('storage',e=>void handleCloudStorage(e));
window.addEventListener('online',()=>{if(cloudSession?.access_token)void cloudUpsertState()});
window.addEventListener('beforeunload',e=>{if(unsavedState){e.preventDefault();e.returnValue=''}});
window.addEventListener('error',e=>{console.error('[Songrim runtime]',e.error||e.message);});
load();
window.Songrim={get state(){return state},get view(){return view},Model,go,render,replaceData,complete,record,makeShare};
