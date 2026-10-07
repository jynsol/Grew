/* original script block 8 */
/* Nature recordings. Source and individual license retained with each clip. */
const FOREST_SOUND_RECORDINGS={"birds":{"mime":"audio/mpeg","title":"Forest ambience","creator":"AudioPapkin (Paweł Spychała)","source":"https://pixabay.com/ko/sound-effects/자연-forest-ambience-296528/","license":"Pixabay Content License","licenseUrl":"https://pixabay.com/service/license-summary/","src":"./assets/audio/birds.mp3"},"night":{"mime":"audio/mpeg","title":"Evening Sound Effect in Village","creator":"Subhasis Mandal (subhamita)","source":"https://pixabay.com/ko/sound-effects/자연-evening-sound-effect-in-village-348670/","license":"Pixabay Content License","licenseUrl":"https://pixabay.com/service/license-summary/","src":"./assets/audio/night.mp3"}};

/* original script block 9 */
/* Local field recordings. FOREST_SOUND_RECORDINGS metadata is loaded before this script.
 * Audio files are fetched lazily after the first user-gesture unlock().
 * Keeps the two decoded buffers and at most two loop sources while crossfading.
 */
const FOREST_SOUND_PRESETS=Object.freeze({
 birds:Object.freeze({name:'낮의 숲'}),
 night:Object.freeze({name:'밤의 숲'})
});
function forestSoundParam(param,value,time,fade=.1){
 if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(time);
 else{const previous=param.value;param.cancelScheduledValues(time);param.setValueAtTime(previous,time);}
 param.linearRampToValueAtTime(value,time+Math.max(.012,fade));
}
async function forestSoundRecordingBytes(preset){
 const recording=FOREST_SOUND_RECORDINGS[preset];
 if(!recording||typeof recording.src!=='string'||!recording.src)throw new Error('숲의 소리 파일을 찾을 수 없어요.');
 const response=await fetch(recording.src,{cache:'force-cache'});
 if(!response.ok)throw new Error('숲의 소리 파일을 불러오지 못했어요.');
 return response.arrayBuffer();
}
class ForestAmbience{
 constructor({onStateChange,enabled=true,volume=.38,preset='birds'}={}){
  this._onStateChange=typeof onStateChange==='function'?onStateChange:null;
  this._enabled=!!enabled;this._active=false;this._volume=Math.max(0,Math.min(1,Number(volume)||0));
  this._preset=FOREST_SOUND_PRESETS[preset]?preset:'birds';
  this._context=null;this._master=null;this._voice=null;this._voices=new Set();
  this._buffers=new Map();this._decodes=new Map();this._loadingPreset=null;this._loadSerial=0;
  this._stopTimer=null;this._resumeAttempt=null;this._resumeSerial=0;this._resumeCancellations=new Set();
  this._unlocked=false;this._disposed=false;this._blocked=false;this._error=null;
 }
 getState(){
  const running=this._context?.state==='running',wanted=this._enabled&&this._active;
  const supported=!!(globalThis.AudioContext||globalThis.webkitAudioContext);
  const loading=wanted&&this._loadingPreset===this._preset;
  const playing=!this._disposed&&wanted&&running&&!!this._voice;
  const status=this._disposed?'disposed':!supported?'unsupported':!this._enabled?'off':!this._active?'inactive':this._error?'error':loading?'loading':playing?'playing':this._resumeAttempt?'unlocking':this._blocked?'blocked':this._unlocked?'suspended':'locked';
  return {status,playing,loading,needsGesture:wanted&&!running&&(this._blocked||!this._unlocked),supported,enabled:this._enabled,active:this._active,volume:this._volume,preset:this._preset,unlocked:this._unlocked,contextState:this._context?.state||'uninitialized',error:this._error,wantsAudio:wanted};
 }
 _notify(){
  if(this._onStateChange){try{this._onStateChange(this.getState());}catch(error){console.warn('Forest ambience state listener:',error);}}
 }
 unlock(){
  if(this._disposed)return Promise.resolve(false);
  this._error=null;
  if(!this._context){
   try{
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Context)throw new Error('이 브라우저에서 숲의 소리를 지원하지 않아요.');
    this._context=new Context({latencyHint:'playback'});
    this._master=this._context.createGain();this._master.gain.value=0;this._master.connect(this._context.destination);
    this._context.onstatechange=()=>{
     if(this._disposed)return;
     if(this._context.state==='running'){
      this._unlocked=true;this._blocked=false;this._reconcile();
     }else if(this._context.state==='suspended'&&this._active&&this._enabled&&this._unlocked){
      void this._resume();
     }
     this._notify();
    };
   }catch(error){
    this._error=error.message||String(error);
    if(this._context){this._context.onstatechange=null;try{void this._context.close().catch(()=>{});}catch(_){}}
    this._context=null;this._master=null;this._notify();return Promise.resolve(false);
   }
  }
  return this._resume(true);
 }
 _resume(userGesture=false){
  if(this._disposed||!this._context)return Promise.resolve(false);
  if(this._context.state==='running'){
   this._unlocked=true;this._blocked=false;this._reconcile();return Promise.resolve(true);
  }
  if(this._resumeAttempt&&!userGesture)return this._resumeAttempt;
  const serial=++this._resumeSerial;let timeout,cancelResume;
  let resume;
  try{resume=Promise.resolve(this._context.resume()).then(()=>this._context?.state==='running',()=>false);}
  catch(_){resume=Promise.resolve(false);}
  const attempt=Promise.race([resume,new Promise(resolve=>{
   cancelResume=()=>resolve(false);this._resumeCancellations.add(cancelResume);timeout=setTimeout(cancelResume,1500);
  })]).then(ok=>{
   clearTimeout(timeout);this._resumeCancellations.delete(cancelResume);
   if(this._disposed||serial!==this._resumeSerial)return false;
   this._resumeAttempt=null;
   if(ok){this._unlocked=true;this._blocked=false;this._reconcile();}
   else{this._blocked=true;this._notify();}
   return !!ok;
  });
  this._resumeAttempt=attempt;this._notify();return attempt;
 }
 setActive(value){
  if(this._disposed||this._active===!!value)return;
  this._active=!!value;this._reconcile();
 }
 setEnabled(value){
  if(this._disposed||this._enabled===!!value)return;
  this._enabled=!!value;this._reconcile();
 }
 setVolume(value){
  if(this._disposed)return;const parsed=Number(value);if(!Number.isFinite(parsed))return;
  const clamped=Math.max(0,Math.min(1,parsed));if(clamped===this._volume)return;
  this._volume=clamped;
  if(this._context?.state==='running'&&this._active&&this._enabled)forestSoundParam(this._master.gain,this._volume,this._context.currentTime,.16);
  this._notify();
 }
 setPreset(value){
  if(this._disposed||!FOREST_SOUND_PRESETS[value]||value===this._preset)return;
  this._preset=value;this._error=null;this._loadSerial++;this._loadingPreset=null;this._reconcile();
 }
 _reconcile(){
  if(this._disposed)return;
  if(this._active&&this._enabled){
   const returning=this._stopTimer!==null;
   if(returning){clearTimeout(this._stopTimer);this._stopTimer=null;}
   if(this._context?.state==='running'){
    if(returning)forestSoundParam(this._master.gain,this._volume,this._context.currentTime,.9);
    if(!this._error)void this._prepare();
   }else if(this._context&&this._unlocked)void this._resume();
  }else this._fadeAndSuspend();
  this._notify();
 }
 async _buffer(preset){
  if(this._buffers.has(preset))return this._buffers.get(preset);
  if(this._decodes.has(preset))return this._decodes.get(preset);
  const context=this._context;
  const decode=(async()=>{
   const buffer=await context.decodeAudioData(await forestSoundRecordingBytes(preset));
   if(!buffer.length||!Number.isFinite(buffer.duration)||buffer.duration<=0)throw new Error('숲의 소리 파일을 읽을 수 없어요.');
   if(!this._disposed)this._buffers.set(preset,buffer);
   return buffer;
  })();
  this._decodes.set(preset,decode);
  try{return await decode;}finally{if(this._decodes.get(preset)===decode)this._decodes.delete(preset);}
 }
 async _prepare(){
  const preset=this._preset;
  if(this._disposed||!this._active||!this._enabled||this._context?.state!=='running'||this._voice?.preset===preset||this._loadingPreset===preset)return;
  const serial=++this._loadSerial;this._loadingPreset=preset;this._notify();
  try{
   const buffer=await this._buffer(preset);
   if(this._disposed||serial!==this._loadSerial)return;
   this._loadingPreset=null;
   if(this._active&&this._enabled&&this._context.state==='running'&&this._preset===preset)this._playBuffer(preset,buffer);
  }catch(error){
   if(this._disposed||serial!==this._loadSerial)return;
   this._loadingPreset=null;this._error=error.message||'숲의 소리를 준비하지 못했어요. 다시 시도해 주세요.';
  }
  this._notify();
 }
 _playBuffer(preset,buffer){
  if(this._disposed||!this._active||!this._enabled||this._context.state!=='running')return;
  const now=this._context.currentTime,old=this._voice,fade=old?.7:.9;
  // Finish any previous fade before starting another pair of sources.
  for(const voice of this._voices)if(voice!==old)this._stopVoice(voice);
  const source=this._context.createBufferSource(),gain=this._context.createGain();
  source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;
  gain.gain.value=0;source.connect(gain);gain.connect(this._master);
  const voice={preset,source,gain,ended:false};this._voices.add(voice);this._voice=voice;
  source.onended=()=>this._cleanupVoice(voice);
  source.start(now,0);forestSoundParam(gain.gain,1,now,fade);
  if(old){
   forestSoundParam(old.gain.gain,0,now,fade);
   try{old.source.stop(now+fade+.03);}catch(_){this._cleanupVoice(old);}
  }
  forestSoundParam(this._master.gain,this._volume,now,old?.16:.9);
 }
 _cleanupVoice(voice){
  if(voice.ended)return;voice.ended=true;voice.source.onended=null;
  try{voice.source.disconnect();}catch(_){}try{voice.gain.disconnect();}catch(_){}
  this._voices.delete(voice);if(this._voice===voice)this._voice=null;
 }
 _stopVoice(voice){try{voice.source.stop();}catch(_){}this._cleanupVoice(voice);}
 _fadeAndSuspend(){
  this._loadSerial++;this._loadingPreset=null;
  if(!this._context)return;
  if(this._context.state!=='running'){
   for(const voice of this._voices)this._stopVoice(voice);
   return;
  }
  if(this._stopTimer!==null)return;
  forestSoundParam(this._master.gain,0,this._context.currentTime,.3);
  this._stopTimer=setTimeout(()=>{
   this._stopTimer=null;
   if(this._disposed||this._active&&this._enabled)return;
   for(const voice of this._voices)this._stopVoice(voice);
   try{void this._context.suspend().catch(()=>{});}catch(_){}
   this._notify();
  },340);
 }
 dispose(){
  if(this._disposed)return;this._disposed=true;this._loadSerial++;this._loadingPreset=null;this._resumeSerial++;
  for(const cancel of this._resumeCancellations)cancel();this._resumeCancellations.clear();this._resumeAttempt=null;
  if(this._stopTimer!==null)clearTimeout(this._stopTimer);this._stopTimer=null;
  for(const voice of this._voices)this._stopVoice(voice);
  this._buffers.clear();this._decodes.clear();
  if(this._context){this._context.onstatechange=null;if(this._context.state!=='closed'){try{void this._context.close().catch(()=>{});}catch(_){}}}
  try{this._master?.disconnect();}catch(_){}
  this._notify();this._onStateChange=null;
 }
}

/* original script block 10 */
const FOREST_SOUND_STORAGE='songrim.forest-sound.v1';
const FOREST_SOUND_CHOICES=[
 {id:'birds',name:'낮의 숲',desc:'새소리와 자연의 기척이 어우러지는 낮',symbol:'sun'},
 {id:'night',name:'밤의 숲',desc:'저녁의 자연 소리가 차분하게 이어지는 밤',symbol:'moon'}
];
function readForestSoundPrefs(){
 let value;try{value=JSON.parse(localStorage.getItem(FOREST_SOUND_STORAGE)||'null')}catch{}
 return {enabled:typeof value?.enabled==='boolean'?value.enabled:true,preset:FOREST_SOUND_CHOICES.some(p=>p.id===value?.preset)?value.preset:'birds',volume:typeof value?.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):.38};
}
let forestSoundPrefs=readForestSoundPrefs(),forestSoundEngine=null,forestSoundPreviewing=false;
function saveForestSoundPrefs(){try{localStorage.setItem(FOREST_SOUND_STORAGE,JSON.stringify(forestSoundPrefs))}catch{}}
function forestSoundIcon(name='speaker'){
 const art={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',speaker:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14"/>',mute:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',leaf:'<path d="M19 4C9 3 3 7 5 14s13 5 14-10Z"/><path d="M4 20 15 9M8 16l-1-5m4 1 5 1"/>',bird:'<path d="M4 16c1-7 7-7 10-9 0-3 5-4 6 0l2 2-3 1c0 7-10 11-15 6Z"/><path d="m4 16-3-4m6 7-1 2m7-3 1 3m-7-7c3 2 6 1 7-2"/><circle cx="17" cy="7" r=".55" fill="currentColor" stroke="none"/>',moon:'<path d="M19 14A8 8 0 0 1 10 4a8 8 0 1 0 9 10Z"/><path d="M17 3v4m-2-2h4m2 5v2m-1-1h2"/>'};
 return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+art[name]+'</svg>';
}
function forestSoundCurrent(){return FOREST_SOUND_CHOICES.find(p=>p.id===forestSoundPrefs.preset)||FOREST_SOUND_CHOICES[0]}
function forestSoundState(){return forestSoundEngine?.getState()||{status:'locked',playing:false}}
function forestSoundInstance(){
 if(!forestSoundEngine)forestSoundEngine=new ForestAmbience({enabled:forestSoundPrefs.enabled,volume:forestSoundPrefs.volume,preset:forestSoundPrefs.preset,onStateChange:()=>updateForestSoundUI()});
 return forestSoundEngine;
}
function syncForestSound(unlock=false){
 if(authRoute!=='app'||view!=='sound')forestSoundPreviewing=false;
 const active=authRoute==='app'&&!document.hidden&&(view==='forest'||view==='sound'&&forestSoundPreviewing);
 if(!active&&!forestSoundEngine)return;
 const engine=forestSoundInstance();engine.setEnabled(forestSoundPrefs.enabled||forestSoundPreviewing);engine.setActive(active);
 if(active&&(forestSoundPrefs.enabled||forestSoundPreviewing)&&(unlock||navigator.userActivation?.isActive))void engine.unlock().catch(()=>updateForestSoundUI());
 updateForestSoundUI();
}
function updateForestSoundUI(){
 const current=forestSoundCurrent(),audio=forestSoundState(),playing=audio.playing===true||audio.status==='playing',loading=audio.status==='loading',unavailable=audio.status==='unsupported',failed=audio.status==='error';
 const auto=document.getElementById('forestSoundAuto');if(auto){auto.setAttribute('aria-checked',String(forestSoundPrefs.enabled));auto.querySelector('span').textContent=forestSoundPrefs.enabled?'켜짐':'꺼짐'}
 const preview=document.getElementById('forestSoundPreview');if(preview){preview.innerHTML=forestSoundIcon(playing||loading?'mute':'speaker')+'<span>'+(failed?'다시 듣기':playing||loading?'미리듣기 멈추기':'미리 듣기')+'</span>';preview.setAttribute('aria-pressed',String(playing||loading));preview.disabled=unavailable}
 const status=document.getElementById('forestSoundStatus');if(status)status.textContent=unavailable?'이 브라우저에서는 숲의 소리를 재생할 수 없어요.':failed?'소리를 불러오지 못했어요. 다시 듣기를 눌러주세요.':loading?'숲의 소리를 준비하고 있어요.':playing?(forestSoundPrefs.volume===0?'음량 0% · 슬라이더로 소리를 높여주세요.':current.name+' · 미리 듣는 중'):forestSoundPreviewing?'미리 듣기를 눌러 소리를 시작해보세요.':'선택한 소리를 미리 들어볼 수 있어요.';
 const output=document.getElementById('forestSoundVolumeLabel');if(output)output.textContent=Math.round(forestSoundPrefs.volume*100)+'%';
 const slider=document.getElementById('forestSoundVolume');if(slider){slider.style.setProperty('--fill',Math.round(forestSoundPrefs.volume*100)+'%');if(document.activeElement!==slider)slider.value=Math.round(forestSoundPrefs.volume*100);slider.setAttribute('aria-valuetext',Math.round(forestSoundPrefs.volume*100)+'퍼센트')}
 document.querySelectorAll('[data-action="forestSoundPreset"]').forEach(b=>{const selected=b.dataset.preset===forestSoundPrefs.preset;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));const check=b.querySelector('.forest-sound-choice-check');if(check)check.textContent=selected?'✓':''});
 const summary=document.getElementById('forestSoundSummary');if(summary)summary.textContent=forestSoundPrefs.enabled?current.name:'꺼짐';
}
function forestSoundCredits(){
 return '<details class="forest-sound-credits"><summary>음원 출처</summary><p>낮의 숲 · <a href="https://pixabay.com/ko/sound-effects/자연-forest-ambience-296528/" target="_blank" rel="noopener noreferrer">Forest ambience</a><br>AudioPapkin (Paweł Spychała)</p><p>밤의 숲 · <a href="https://pixabay.com/ko/sound-effects/자연-evening-sound-effect-in-village-348670/" target="_blank" rel="noopener noreferrer">Evening Sound Effect in Village</a><br>Subhasis Mandal (subhamita)</p><p><a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noopener noreferrer">Pixabay Content License</a><br>음량 조정 및 반복 구간 편집</p></details>';
}
function renderForestSoundSettings(){
 const check='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>';
 return '<section class="forest-sound-settings">'+
 '<div class="page-heading"><h1 class="page-title">숲의 소리</h1></div><p class="page-caption">나의 숲에 어울리는 소리를 골라보세요.</p>'+
 '<div class="forest-sound-choices" role="group" aria-label="소리 선택">'+
 FOREST_SOUND_CHOICES.map((p,i)=>button('<span class="forest-sound-choice-icon">'+forestSoundIcon(p.symbol)+'</span><span class="forest-sound-choice-copy"><strong>'+p.name+'</strong><small>'+p.desc+'</small></span><span class="forest-sound-choice-check" aria-hidden="true">'+(p.id===forestSoundPrefs.preset?check:'')+'</span>','forestSoundPreset','forest-sound-choice is-'+i+' '+(p.id===forestSoundPrefs.preset?'selected':''),'data-preset="'+p.id+'" aria-pressed="'+(p.id===forestSoundPrefs.preset)+'"')).join('')+'</div>'+
 '<div class="settings-card forest-sound-card"><div class="forest-sound-auto"><div><strong>숲에서 자동 재생</strong><small>숲을 나가면 소리가 멈춰요.</small></div>'+button('<span>'+(forestSoundPrefs.enabled?'켜짐':'꺼짐')+'</span><i aria-hidden="true"></i>','forestSoundAuto','forest-sound-switch','id="forestSoundAuto" role="switch" aria-checked="'+forestSoundPrefs.enabled+'" aria-label="숲의 소리 자동 재생"')+'</div>'+
 '<div class="forest-sound-volume"><div class="forest-sound-volume-heading"><label for="forestSoundVolume">음량</label><output id="forestSoundVolumeLabel" for="forestSoundVolume">'+Math.round(forestSoundPrefs.volume*100)+'%</output></div><input type="range" id="forestSoundVolume" min="0" max="100" step="1" value="'+Math.round(forestSoundPrefs.volume*100)+'" style="--fill:'+Math.round(forestSoundPrefs.volume*100)+'%"></div></div>'+
 '<div class="forest-sound-listen">'+button(forestSoundIcon('speaker')+'<span>미리 듣기</span>','forestSoundPreview','primary','id="forestSoundPreview" aria-pressed="false"')+'<p id="forestSoundStatus" role="status" aria-live="polite">선택한 소리를 미리 들어볼 수 있어요.</p></div>'+
 '<p class="forest-sound-note">설정은 자동으로 저장돼요.</p>'+forestSoundCredits()+'</section>';
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(a==='forestSoundSettings'){go('sound');return}
 if(a==='forestSoundPreset'){
  if(!FOREST_SOUND_CHOICES.some(p=>p.id===b.dataset.preset))return;
  forestSoundPrefs.preset=b.dataset.preset;forestSoundInstance().setPreset(forestSoundPrefs.preset);saveForestSoundPrefs();syncForestSound(forestSoundPreviewing);updateForestSoundUI();return;
 }
 if(a==='forestSoundAuto'){forestSoundPrefs.enabled=!forestSoundPrefs.enabled;if(!forestSoundPrefs.enabled)forestSoundPreviewing=false;saveForestSoundPrefs();syncForestSound();updateForestSoundUI();return}
 if(a==='forestSoundPreview'){const audio=forestSoundState();forestSoundPreviewing=audio.status==='error'||!(audio.playing===true||audio.status==='playing'||audio.status==='loading');syncForestSound(forestSoundPreviewing);return}
});
document.addEventListener('click',e=>{if(!e.isTrusted||authRoute!=='app'||view!=='forest'||!forestSoundPrefs.enabled)return;syncForestSound(true)},true);
document.addEventListener('input',e=>{if(e.target.id!=='forestSoundVolume')return;const value=Number(e.target.value);if(!Number.isFinite(value))return;forestSoundPrefs.volume=Math.max(0,Math.min(1,value/100));forestSoundInstance().setVolume(forestSoundPrefs.volume);saveForestSoundPrefs();updateForestSoundUI()});
document.addEventListener('visibilitychange',()=>syncForestSound());
window.addEventListener('pagehide',()=>{forestSoundPreviewing=false;forestSoundEngine?.setActive(false)});
window.addEventListener('pageshow',()=>syncForestSound());
window.addEventListener('storage',e=>{if(e.key!==FOREST_SOUND_STORAGE)return;forestSoundPrefs=readForestSoundPrefs();if(forestSoundEngine){forestSoundEngine.setPreset(forestSoundPrefs.preset);forestSoundEngine.setVolume(forestSoundPrefs.volume)}syncForestSound();updateForestSoundUI()});
