/* original script block 5 */
/* iOS Safari는 요소에 touch 이벤트 리스너가 연결돼 있어야 :active 상태(눌림 효과)를 인식해요.
   버튼 등에 별도 touch 핸들러가 없으면 :active CSS가 있어도 모바일에서 눌림 반응이 전혀 보이지 않기 때문에,
   문서 전체에 빈 touchstart 리스너를 하나 달아 :active 인식을 활성화해요. */
document.addEventListener('touchstart',function(){},{passive:true});

/* original script block 6 */
/* Genre classification policy (MVP)
   1) Provider raw genre is preserved in rawGenre.
   2) genre stores a user-facing normalized specific genre.
   3) treeCategory is a broad internal grouping only; it must not replace the specific genre.
   4) Multi-genre movies keep all provider candidates, while a deterministic priority selects the primary genre.
   5) User-edited genres (genreSource='user') are never auto-overwritten.
*/
const TREE_CATEGORIES=[
 {id:'book-literature',type:'book',label:'책 · 문학',color:'#7fa989',pattern:/문학|소설|수필|에세이|추리|미스터리|스릴러|시|시집|판타지|로맨스|SF|아동|청소년|만화|fiction|romance/i},
 {id:'book-humanities',type:'book',label:'책 · 인문·사회',color:'#b6a075',pattern:/인문|철학|역사|사회|정치|심리|예술|경제|경영|자기계발|교육/},
 {id:'book-science',type:'book',label:'책 · 과학·기술',color:'#78a9a4',pattern:/과학|수학|생물|물리|화학|의학|기술|컴퓨터|IT|프로그래밍|자연|환경/i},
 {id:'album-classical',type:'album',label:'음악 · 클래식',color:'#9994b5',pattern:/고전|클래식|오페라|관현악|실내악|classical|opera/i},
 {id:'album-popular',type:'album',label:'음악 · 대중음악',color:'#c18e9b',pattern:/대중|팝|K-POP|록|락|얼터너티브|인디|메탈|펑크|힙합|R&B|소울|일렉트로닉|댄스|OST|pop|rock|alternative|indie|metal|punk|hip|soul|electronic|dance|soundtrack/i},
 {id:'album-roots',type:'album',label:'음악 · 재즈·루츠',color:'#b6936e',pattern:/뿌리|재즈|블루스|포크|컨트리|레게|라틴|월드|국악|민속|jazz|blues|folk|country|reggae|latin|world/i},
 {id:'movie-drama',type:'movie',label:'영화 · 이야기',color:'#94ac76',pattern:/드라마|로맨스|코미디|가족|음악|역사|drama|romance|comedy|family/i},
 {id:'movie-sf',type:'movie',label:'영화 · 상상·모험',color:'#7c9ebc',pattern:/sf|공상|판타지|애니메이션|모험|animation|fantasy|adventure/i},
 {id:'movie-action',type:'movie',label:'영화 · 긴장·액션',color:'#b48778',pattern:/액션|스릴러|범죄|공포|미스터리|전쟁|서부|action|thriller|crime|horror|mystery/i},
 {id:'other',type:'all',label:'기타',color:'#9da89e'}
];

const MUSIC_GENRE_RULES=[
 ['클래식',/classical|opera|orchestral|chamber|baroque|클래식|고전|오페라/i],
 ['재즈',/jazz|재즈/i],['블루스',/blues|블루스/i],['포크',/folk|singer\s*[-/]?\s*songwriter|포크|싱어송라이터/i],
 ['컨트리',/country|컨트리/i],['힙합',/hip\s*[-]?\s*hop|rap|힙합|랩/i],['R&B/소울',/r\s*&\s*b|soul|알앤비|소울/i],
 ['K-POP',/k\s*[-]?\s*pop|케이팝/i],['얼터너티브',/alternative|얼터너티브/i],['인디',/indie|인디/i],
 ['메탈',/metal|메탈/i],['펑크',/punk|펑크/i],['록',/rock|록|락/i],['일렉트로닉',/electronic|electronica|edm|house|techno|ambient|dance|일렉트로닉|전자음악|댄스/i],
 ['OST',/soundtrack|original\s+score|film\s+score|ost|사운드트랙/i],['레게',/reggae|레게/i],['라틴',/latin|라틴/i],['월드',/world|월드/i],['팝',/pop|팝/i]
];
function normalizeAlbumGenre(raw){const value=cleanGenreValue(raw);if(!value)return '';for(const [name,re] of MUSIC_GENRE_RULES)if(re.test(value))return name;return value}

const BOOK_GENRE_OVERRIDES=[
 ['달러구트 꿈 백화점','소설'],['불편한 편의점','소설'],['아몬드','소설'],['채식주의자','소설'],['소년이 온다','소설'],['데미안','소설'],['노인과 바다','소설'],['어린 왕자','소설'],
 ['1984','SF'],['멋진 신세계','SF'],['파친코','소설'],['모순','소설'],['작별하지 않는다','소설'],['어서 오세요, 휴남동 서점입니다','소설'],['메리골드 마음 세탁소','소설'],
 ['해리 포터와 마법사의 돌','판타지'],['해리포터와 마법사의 돌','판타지'],['반지의 제왕','판타지'],['나미야 잡화점의 기적','소설'],
 ['사피엔스','역사'],['호모 데우스','철학·인문'],['코스모스','과학'],['이기적 유전자','과학'],['총, 균, 쇠','역사'],['총균쇠','역사'],
 ['아주 작은 습관의 힘','자기계발'],['원씽','자기계발'],['역행자','자기계발'],['돈의 심리학','경제·경영'],['부자 아빠 가난한 아빠','경제·경영']
];
function cleanGenreValue(raw){
 const value=String(raw||'').normalize('NFKC').trim();
 return /^(?:미입력|미분류|분류없음|unknown|n\/?a|none|null|기타)$/i.test(value)?'':value;
}
const BOOK_GENRE_RULES=[
 ['SF',[/\bsf\b|science\s*fiction|speculative\s*fiction|dystopian|과학소설|디스토피아|사이버펑크|우주\s*(?:소설|전쟁|여행)|외계/i]],
 ['판타지',[/fantasy|magical\s*realism|판타지|마법|마법사|드래곤|이세계|요정|마법학교/i]],
 ['추리·미스터리',[/mystery|detective|crime\s*fiction|suspense|추리|미스터리|탐정|살인사건|범죄소설|스릴러/i]],
 ['로맨스',[/romance|love\s*stories|로맨스|연애소설|사랑\s*이야기/i]],
 ['아동·청소년',[/juvenile\s*(?:fiction|literature|nonfiction)|children'?s\s*(?:books|fiction)|young\s*adult|어린이|아동|청소년|그림책|동화/i]],
 ['만화',[/comics?|graphic\s*novels?|manga|만화|코믹|그래픽노블/i]],
 ['시',[/poetry|poems?|시집|시선집|시인/i]],
 ['에세이',[/essays?|memoir|autobiograph|수필|에세이|산문|회고록/i]],
 ['철학·인문',[/philosophy|humanities|ethics|철학|인문|사상|윤리|존재론|인문학/i]],
 ['역사',[/history|civilization|archaeology|역사|한국사|세계사|고대사|근현대사|문명사|사료/i]],
 ['사회·정치',[/social\s*science|sociology|political\s*science|politics|사회학|사회과학|정치|정책|민주주의|젠더|문화비평|사회\s*문제/i]],
 ['심리',[/psychology|psychoanalysis|cognitive|심리|정신분석|마음|감정|인지/i]],
 ['경제·경영',[/business|economics|finance|investing|marketing|management|entrepreneur|경제|경영|투자|마케팅|브랜딩|비즈니스|금융|주식/i]],
 ['과학',[/science|physics|chemistry|biology|astronomy|neuroscience|evolution|medicine|과학|물리|화학|생물|천문|뇌과학|진화|의학/i]],
 ['기술·컴퓨터',[/computers?|programming|software|artificial\s*intelligence|machine\s*learning|technology|컴퓨터|프로그래밍|코딩|인공지능|AI|머신러닝|데이터|소프트웨어|기술/i]],
 ['예술',[/art|design|architecture|photography|미술|예술|디자인|건축|사진|영화론|음악론/i]],
 ['자기계발',[/self[- ]help|personal\s*growth|productivity|habits?|leadership|자기계발|습관|성공|생산성|리더십|커리어/i]],
 ['소설',[/fiction|literary\s*fiction|literature\s*&?\s*fiction|novels?|장편소설|단편소설|소설집|소설|픽션/i]]
];
function overrideBookGenre(title){
 const norm=Model.norm(String(title||'').replace(/\s*\d+\s*$/,''));
 const hit=BOOK_GENRE_OVERRIDES.find(([name])=>norm===Model.norm(name)||norm.startsWith(Model.norm(name)));
 return hit?.[1]||'';
}
function inferBookGenre(data){
 const title=String(data?.title||'').normalize('NFKC'),body=[data?.contents,data?.overview,data?.description,data?.publisher,data?.creator,data?.rawGenre].filter(Boolean).join(' ').normalize('NFKC');
 const override=overrideBookGenre(title);if(override)return override;
 let best='',bestScore=0;
 for(const [name,res] of BOOK_GENRE_RULES){let score=0;for(const re of res){re.lastIndex=0;if(re.test(title))score+=5;re.lastIndex=0;if(re.test(body))score+=3;re.lastIndex=0}if(score>bestScore){best=name;bestScore=score}}
 if(bestScore>=3)return best;
 const narrative=(body.match(/주인공|등장인물|장편|단편|작가의\s*데뷔작|소설가|이야기의\s*배경|서사|허구/g)||[]).length;
 return narrative>=2?'소설':'';
}
function normalizeBookGenre(raw,data){
 const value=cleanGenreValue(raw),merged={...(data||{}),rawGenre:value};
 const known=BOOK_GENRE_RULES.find(([name])=>name.toLocaleLowerCase()===value.toLocaleLowerCase());
 if(known)return known[0];
 if(value){const normalized=inferBookGenre({title:'',contents:value,creator:'',publisher:'',rawGenre:value});if(normalized)return normalized;}
 return inferBookGenre(merged);
}

const BOOK_EXCLUDED_SEARCH_RE=/(평가문제집|문제집|기출\s*문제|기출문제|모의고사|수능|내신|자습서|학습서|참고서|교과서|수험서|워크북|workbook|test\s*prep|토익|toeic|토플|toefl|jlpt|ebs|개념원리|쎈\s*수학|라이트쎈|개념쎈|rpm|n제|자이스토리|마더텅|블랙라벨|숨마쿰라우데|완자|수능특강|수능완성|올림포스|개념\+유형|기본서|실전서|해설서|공무원\s*시험|자격증\s*시험|학습지|연산\s*문제|연산력|기탄\s*(수학|국어|영어|한자)|사고력\s*수학|유형\s*문제|단원평가|진단평가|학력평가|초등\s*참고서|중등\s*참고서|고등\s*참고서|초등\s*[1-6]?\s*학년|중[123]\s*(국어|영어|수학|과학|사회)|고[123]\s*(국어|영어|수학|과학|사회)|초등\s*(국어|영어|수학|과학|사회)|중학\s*(국어|영어|수학|과학|사회)|고등\s*(국어|영어|수학|과학|사회))/i;
const BOOK_EDUCATIONAL_COLLECTION_RE=/((중고생|중학생|고등학생|청소년|초등학생).{0,16}(필독|권장|추천|꼭\s*읽어야|읽어야\s*할|논술|교과)|필독.{0,12}(고전|문학|소설|명작|도서)|권장도서\s*\d+|필독서\s*\d+|(한국\s*)?고전소설\s*(\d+|선|선집|모음|컬렉션)|명작소설\s*(\d+|선|선집)|교과서\s*수록|교과\s*연계|논술\s*(대비|필독|고전|문학)|수행평가\s*(대비|필독)|독서평설|중고등\s*필독|중등\s*필독|고등\s*필독)/i;
const BOOK_ANTHOLOGY_COLLECTION_RE=/((한국|세계|동양|서양|현대|고전|명작)?\s*(단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)\s*(\d{1,3}\s*(선|편|권)?|선집|모음|컬렉션)|((단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)\s*(베스트|대표|엄선)?\s*\d{1,3}\s*(선|편)?))/i;

const BOOK_PERIODICAL_RE=/((한국소설|한국문학|문학|소설)\s*[\(\[]?\s*(19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,4}\s*호[\)\]]?|((19|20)\d{2}\s*년\s*\d{1,2}\s*월).{0,12}\d{1,4}\s*호|\b\d{1,4}\s*호\b)/i;
function compactBookTitle(value){
 return String(value||'')
  .replace(/<[^>]+>/g,' ')
  .replace(/[·•ㆍ:：\-–—_/\\()[\]{}]/g,' ')
  .replace(/\s+/g,' ')
  .trim();
}
const BOOK_EXCLUDED_PUBLISHER_RE=/(천재교육|비상교육|좋은책신사고|마더텅|수경출판사|이투스북|메가스터디북스|디딤돌교육|NE능률|능률교육|지학사|개념원리|키출판사|쎄듀|오르비북스|기탄교육|기탄출판|동아출판|미래엔|교학사|금성출판사|에듀윌|해커스|시대고시|박문각)/i;
function isExcludedBookCandidate(book){
 // 소개문(contents)은 보지 않는다. 일반 문학의 '스릴러의 교과서' 같은 표현 오탐 방지.
 const title=compactBookTitle(book?.title);
 const searchable=[
  title,
  book?.genre,
  book?.rawGenre
 ].filter(Boolean).join(' ').replace(/<[^>]+>/g,' ');
 const publisher=String(book?.publisher||'');

 // '한국소설'은 정기간행물/잡지 계열 제목으로 취급해 제목에 포함되면 제외.
 // 또한 연+월/호 조합이 있는 문학 정기간행물형 제목도 제외한다.
 const normalizedTitle=title.replace(/\s+/g,' ').trim();
 const koreanNovelPeriodical=
   normalizedTitle.includes('한국소설')
   ||/(계간|계간지|봄호|여름호|가을호|겨울호|\d{1,2}\s*월호|월호)/i.test(normalizedTitle)
   ||(/(19|20)\d{2}\s*년/.test(normalizedTitle)&&/\d{1,2}\s*월/.test(normalizedTitle)&&/\d{1,4}\s*호/.test(normalizedTitle))
   ||(/(문학|소설|시|비평|문예)/.test(normalizedTitle)&&/\d{1,4}\s*호/.test(normalizedTitle))
   ||(/(문학|소설|시|비평|문예)/.test(normalizedTitle)&&/(봄|여름|가을|겨울)\s*(호|편)?/i.test(normalizedTitle));

 // 띄어쓰기/괄호/구두점 차이에도 잡히도록 제목의 공백 제거본도 함께 본다.
 const compact=title.replace(/\s+/g,'');

 const anthologyCompact=
   /((한국|세계|동양|서양|현대|고전|명작)?(단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)\d{1,3}(선|편|권)?$)|((단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)(선집|모음|컬렉션)$)/i.test(compact);

 return BOOK_EXCLUDED_SEARCH_RE.test(searchable)
   ||BOOK_EDUCATIONAL_COLLECTION_RE.test(title)
   ||BOOK_ANTHOLOGY_COLLECTION_RE.test(title)
   ||anthologyCompact
   ||koreanNovelPeriodical
   ||BOOK_PERIODICAL_RE.test(title)
   ||BOOK_EXCLUDED_PUBLISHER_RE.test(publisher);
}
function allowDiscoveryCandidate(item){
 if(!item||!item.title||!['book','movie'].includes(item.type))return false;
 if(item.type==='book'&&isExcludedBookCandidate(item))return false;
 return true;
}

const TMDB_GENRES={28:'액션',12:'모험',16:'애니메이션',35:'코미디',80:'범죄',99:'다큐멘터리',18:'드라마',10751:'가족',14:'판타지',36:'역사',27:'공포',10402:'음악',9648:'미스터리',10749:'로맨스',878:'SF',10770:'TV 영화',53:'스릴러',10752:'전쟁',37:'서부'};
const MOVIE_PRIMARY_PRIORITY=['애니메이션','다큐멘터리','SF','판타지','공포','스릴러','미스터리','범죄','액션','로맨스','코미디','드라마','가족','모험','역사','전쟁','서부','음악','TV 영화'];
function movieGenreInfo(ids){const list=[...new Set((Array.isArray(ids)?ids:[]).map(id=>TMDB_GENRES[Number(id)]).filter(Boolean))];const primary=MOVIE_PRIMARY_PRIORITY.find(x=>list.includes(x))||list[0]||'';return {primary,candidates:list.map(x=>[x,'TMDB'])}}
function normalizeGenreForType(type,genre,data={}){if(type==='album')return normalizeAlbumGenre(genre);if(type==='book')return normalizeBookGenre(genre,data);return cleanGenreValue(genre)}

const TREE_SPECIES=[
 {id:'birch',category:'book-humanities',name:'자작나무',need:1,shape:'airy',colors:['#6F8F63','#A0B77A','#56745D'],trunk:'#EAE7DC'},
 {id:'oak',category:'book-literature',name:'참나무',need:1,shape:'broad',colors:['#3E674D','#718A5B','#94A56A'],trunk:'#6B5745'},
 {id:'cherry',category:'book-literature',name:'벚나무',need:3,shape:'blossom',colors:['#6F8E5E','#C9A5A7','#A7BA78'],trunk:'#806A64'},
 {id:'zelkova',category:'book-humanities',name:'느티나무',need:3,shape:'umbrella',colors:['#75935E','#A8B874','#527557'],trunk:'#8C8579'},
 {id:'ginkgo',category:'book-science',name:'은행나무',need:1,shape:'fan',colors:['#C7A94C','#E4CE74','#A9833D'],trunk:'#77634D'},
 {id:'metasequoia',category:'book-science',name:'메타세쿼이아',need:3,shape:'spire',colors:['#3F6C60','#698B72','#31564D'],trunk:'#675747'},
 {id:'maple',category:'album-classical',name:'단풍나무',need:1,shape:'open',colors:['#5F8A5C','#87A46B','#6C9463'],trunk:'#755F4A'},
 {id:'willow',category:'album-classical',name:'버드나무',need:3,shape:'weeping',colors:['#759A76','#9FB388','#5A7D66'],trunk:'#715E4E'},
 {id:'magnolia',category:'album-popular',name:'목련',need:1,shape:'openblossom',colors:['#9EBB72','#87A36A','#C4D19E'],trunk:'#836C58'},
 {id:'crape',category:'album-popular',name:'배롱나무',need:3,shape:'airyblossom',colors:['#789466','#B79C7D','#98AC7E'],trunk:'#C7A78C'},
 {id:'pine',category:'album-roots',name:'소나무',need:1,shape:'pine',colors:['#315D4D','#4E7558','#70885E'],trunk:'#715944'},
 {id:'cedar',category:'album-roots',name:'삼나무',need:3,shape:'tallconifer',colors:['#4E736C','#779A92','#365851'],trunk:'#645445'},
 {id:'hackberry',category:'movie-drama',name:'팽나무',need:1,shape:'wide',colors:['#70875B','#96A56B','#536D50'],trunk:'#7C664F'},
 {id:'fringe',category:'movie-drama',name:'이팝나무',need:3,shape:'fringe',colors:['#96B66F','#DDD8B8','#7D9E63'],trunk:'#786453'},
 {id:'fir',category:'movie-sf',name:'전나무',need:1,shape:'tiered',colors:['#365D58','#50766B','#294B49'],trunk:'#3E362D'},
 {id:'cypress',category:'movie-sf',name:'편백나무',need:3,shape:'column',colors:['#678877','#9FC2D2','#4C725F'],trunk:'#6F5B49'},
 {id:'yew',category:'movie-action',name:'주목',need:1,shape:'oval',colors:['#3F6048','#5B7655','#304A3A'],trunk:'#655342'},
 {id:'juniper',category:'movie-action',name:'향나무',need:3,shape:'windswept',colors:['#597168','#7B8D7C','#425B54'],trunk:'#705A47'},
 {id:'paulownia',category:'other',name:'오동나무',need:1,shape:'twigleaf',colors:['#849B6B','#A6B985','#C4CEAA'],trunk:'#7A614D'},
 {id:'evergreen',category:'other',name:'후박나무',need:3,shape:'dense',colors:['#375F51','#57775F','#2B4B43'],trunk:'#6C5847'}
];
// Winter trees reuse their summer species' shape and size, with a 겨울 name.
TREE_SPECIES.push(...['zelkova','metasequoia','pine','cedar','juniper','fringe','yew','willow','cherry','birch'].map(id=>{const t=TREE_SPECIES.find(x=>x.id===id);return {...t,id:'winter'+id,name:'겨울 '+t.name,need:3}}));
// Songlim launch-flow preview. This module has no network, advertisement, or payment operations.
// Production entitlements must be issued and verified by a server before release.
// Paid trees, floors, the pack and ad coupons stay closed until real payments and ads are connected.
// Flip to true then; while false the shop is a catalogue and nothing pretends to charge.
const BM_STORE_OPEN=true;
const BM_CONFIG=Object.freeze({mode:'preview',future:Object.freeze({regularTrees:26,mysteryTrees:4,totalTrees:30,paidFloorCount:2,treePriceKRW:1100,floorPriceKRW:2200,packagePriceKRW:9900,packageTreeCount:10,rewardedViewsPerDay:2,viewsPerCoupon:1,couponCostPerTree:14,collectionMysteryAt:20,cashMysteryAt:10})});
const BM_FLOORS=[{id:'basic',name:'기본 바닥',ready:true,free:true},{id:'meadow',name:'꽃이끼 정원',ready:true,free:false},{id:'snow',name:'겨울 숲',ready:true,free:false},{id:'floor-reserved-01',name:'새 바닥',ready:false,free:false}];
const BM_BASE_IDS=['oak','birch','fir'];
const BM_RECORD_IDS=['zelkova','ginkgo','metasequoia','yew','cedar','evergreen','cypress'];
const BM_EXISTING_SHOP_IDS=['cherry','maple','magnolia','crape','fringe','hackberry','willow','pine','juniper','paulownia'];
// Winter pack: snowy versions of ten trees, sold as their own special trees (one per genre).
const BM_WINTER_IDS=['winterzelkova','wintermetasequoia','winterpine','wintercedar','winterjuniper','winterfringe','winteryew','winterwillow','wintercherry','winterbirch'];
// 10 special trees still to be drawn: together with the next new floor they make the third pack.
const BM_RESERVED_IDS=Array.from({length:10},(_,i)=>'paid-reserved-'+String(i+1).padStart(2,'0'));
const BM_SALE_IDS=[...BM_EXISTING_SHOP_IDS,...BM_WINTER_IDS];
const BM_SHOP_IDS=[...BM_SALE_IDS,...BM_RESERVED_IDS];
const BM_READY_IDS=[...BM_BASE_IDS,...BM_RECORD_IDS,...BM_SALE_IDS];
const BM_PAID_FLOOR_IDS=BM_FLOORS.filter(f=>!f.free).map(f=>f.id);
const BM_SOURCE_KINDS=['base','growth','cash','coupon','legacy','beta'];
// Each genre: 1 classic tree + 1 special tree (first pack) + 1 winter tree (winter pack) + 1 still to be drawn.
const BM_POOLS=[
 {id:'book-literature',type:'book',label:'순문학',free:'zelkova',paid:['magnolia','winterzelkova','paid-reserved-01']},
 {id:'book-genre',type:'book',label:'장르문학',free:'metasequoia',paid:['maple','wintermetasequoia','paid-reserved-02']},
 {id:'book-humanities',type:'book',label:'인문',free:'ginkgo',paid:['pine','winterpine','paid-reserved-03']},
 {id:'book-science',type:'book',label:'과학',free:'cedar',paid:['paulownia','wintercedar','paid-reserved-04']},
 {id:'book-other',type:'book',label:'기타',free:'oak',paid:['juniper','winterjuniper','paid-reserved-05']},
 {id:'movie-drama',type:'movie',label:'드라마',free:'evergreen',paid:['fringe','winterfringe','paid-reserved-06']},
 {id:'movie-action',type:'movie',label:'액션·스릴러',free:'yew',paid:['hackberry','winteryew','paid-reserved-07']},
 {id:'movie-sf',type:'movie',label:'SF·판타지',free:'cypress',paid:['willow','winterwillow','paid-reserved-08']},
 {id:'movie-comedy',type:'movie',label:'로맨스·코미디',free:'fir',paid:['cherry','wintercherry','paid-reserved-09']},
 {id:'movie-other',type:'movie',label:'기타',free:'birch',paid:['crape','winterbirch','paid-reserved-10']}
];
// Tree themes for the whole forest. 'mix' deals each genre's trees in turn; the others use one slot
// per genre (0 classic, 1 special, 2 winter) and fall back to the classic tree when it isn't owned.
// Sale themes: how special trees are grouped in the shop and codex (each is also a pack).
const BM_SALE_THEMES=[{id:'special',name:'꽃이끼 정원',pack:'first',ids:BM_EXISTING_SHOP_IDS},{id:'winter',name:'겨울 숲',pack:'winter',ids:BM_WINTER_IDS},{id:'third',name:'새 나무',pack:'third',ids:BM_RESERVED_IDS}];
// Each floor's matching tree theme: picking the floor also dresses the forest in that theme.
const BM_FLOOR_THEME={basic:'classic',meadow:'special',snow:'winter'};
// Forest sets: one tap dresses the forest — a floor plus its matching trees. The decorate dock leads with these.
const BM_FOREST_SETS=[{id:'basic',name:'기본 숲',floor:'basic',theme:'classic',shop:'floors',trees:['zelkova','ginkgo','fir']},{id:'meadow',name:'꽃이끼 정원',floor:'meadow',theme:'special',shop:'special',trees:['cherry','maple','magnolia']},{id:'snow',name:'겨울 숲',floor:'snow',theme:'winter',shop:'winter',trees:['wintercherry','winteryew','winterbirch']}];
const BM_TREE_THEMES=[{id:'mix',name:'섞어서'},{id:'classic',name:'클래식',slot:0},{id:'special',name:'스페셜',slot:1},{id:'winter',name:'겨울',slot:2}];
function bmThemeSpecies(b,poolId,available){const t=BM_TREE_THEMES.find(t=>t.id===(b?.treeTheme||'mix'));if(!t||t.slot===undefined)return null;const p=BM_POOLS.find(p=>p.id===poolId);if(!p)return null;const id=t.slot===0?p.free:p.paid[t.slot-1];return available.includes(id)?id:p.free}
function bmThemeAvailable(id){const t=BM_TREE_THEMES.find(t=>t.id===id);if(!t||!t.slot)return true;const own=new Set(bmReadyTreeIds());return BM_POOLS.some(p=>own.has(p.paid[t.slot-1]))}
const BM_GROWTH_RULES=[
 {id:'first-record',speciesId:'zelkova',label:'첫 기록 남기기',target:1,metric:'record'},
 {id:'first-completion',speciesId:'ginkgo',label:'첫 작품 완료하기',target:1,metric:'completed'},
 {id:'three-completions',speciesId:'metasequoia',label:'작품 3개 완료하기',target:3,metric:'completed'},
 {id:'book-and-movie',speciesId:'yew',label:'책과 영화 각각 1개 완료하기',target:2,metric:'media'},
 {id:'thirty-record-days',speciesId:'cedar',label:'서로 다른 30일에 기록 남기기',target:30,metric:'days'},
 {id:'ten-completions',speciesId:'evergreen',label:'작품 10개 완료하기',target:10,metric:'completed'},
 {id:'twenty-completions',speciesId:'cypress',label:'작품 20개 완료하기',target:20,metric:'completed'}
];
// Genre trees: the free tree of each of the 10 genre pools (5 book, 5 movie). All open from the start;
// paid trees stay paid and hidden trees open by planted count.
const BM_GENRE_IDS=BM_POOLS.map(p=>p.free);
function bmGenreLabel(id){const p=BM_POOLS.find(p=>p.free===id||p.paid.includes(id));return p?(p.type==='book'?'책':'영화')+' · '+p.label:''}
function bmFresh(){return {version:2,previewVersion:2,completedKeys:[],recordDays:[],hasRecorded:false,earnedTreeIds:[],legacyTreeIds:[],legacyMysteryIds:[],ownership:{},floorOwnership:{},previewOwnership:{},previewFloorOwnership:{},previewCouponViews:{},previewCouponSpent:0,nextByPool:{},floor:'basic',treeTheme:'mix'}}
function bmNorm(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'')}
function bmCompletionKey(c){return [c.type,bmNorm(c.title),bmNorm(c.creator)].join('|')}
function bmValidDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
function bmTracked(c){return !!c&&['book','movie'].includes(c.type)}
function bmKnownRegular(id){return BM_READY_IDS.includes(id)||BM_RESERVED_IDS.includes(id)}
function bmTreeReady(id){return BM_READY_IDS.includes(id)||id==='mystery-A'||id==='mystery-B'}
function bmCatalogGroup(id){return BM_GENRE_IDS.includes(id)?'base':BM_SHOP_IDS.includes(id)?'shop':'mystery'}
function bmAddSource(target,id,kind){if(!BM_SOURCE_KINDS.includes(kind))return false;const before=Array.isArray(target[id])?target[id]:[];if(before.includes(kind))return false;target[id]=[...before,kind];return true}
function bmRealSources(b,id,floor=false){const kinds=(floor?b.floorOwnership:b.ownership)?.[id];return Array.isArray(kinds)?kinds.filter(k=>BM_SOURCE_KINDS.includes(k)&&k!=='beta'):[]}
function bmPreviewSources(b,id,floor=false){if(BM_CONFIG.mode!=='preview')return [];const kinds=(floor?b.previewFloorOwnership:b.previewOwnership)?.[id];return Array.isArray(kinds)?kinds.filter(k=>k==='cash'||!floor&&k==='coupon'):[]}
function bmOwnedFrom(b){return [...new Set([...BM_GENRE_IDS,...Object.keys(b.ownership||{}).filter(id=>bmKnownRegular(id)&&bmRealSources(b,id).length),...Object.keys(b.previewOwnership||{}).filter(id=>bmTreeReady(id)&&BM_SHOP_IDS.includes(id)&&bmPreviewSources(b,id).length)])]}
function bmCashOwnedFrom(b,id){return bmRealSources(b,id).includes('cash')||bmPreviewSources(b,id).includes('cash')}
function bmCashCountFrom(b){return BM_SHOP_IDS.filter(id=>bmCashOwnedFrom(b,id)).length}
// Hidden trees are never sold: each one opens when you have planted enough trees (finished works).
const BM_MYSTERY_AT={A:30,B:50,C:75,D:100};
function bmMysteryAvailableFrom(b,kind){if(!['A','B','C','D'].includes(kind))return false;if(b.legacyMysteryIds?.includes(kind))return true;return bmProgressFrom(b).completed>=BM_MYSTERY_AT[kind]}
function bmCanUseFrom(b,id){if(id==='mystery-A'||id==='mystery-B')return bmMysteryAvailableFrom(b,id.slice(-1));return bmTreeReady(id)&&bmOwnedFrom(b).includes(id)}
function bmPool(c){
 if(!bmTracked(c))return null;
 const g=String(c.genre||'').normalize('NFKC').trim();
 if(!g||g==='기타')return c.type==='book'?'book-other':'movie-other';
 if(c.type==='book'){
  if(/과학|수학|생물|물리|화학|의학|기술|컴퓨터|프로그래밍|자연|환경|science|technology|\bIT\b/i.test(g))return 'book-science';
  if(/인문|철학|역사|사회|정치|심리|예술|경제|경영|자기계발|교육|humanities|history|philosophy|business/i.test(g))return 'book-humanities';
  if(/장르문학|추리|미스터리|스릴러|판타지|로맨스|공포|무협|\bSF\b|mystery|thriller|fantasy|romance|horror/i.test(g))return 'book-genre';
  if(/문학|소설|수필|에세이|시집|^시$|아동|청소년|만화|fiction|literature|poetry|essay/i.test(g))return 'book-literature';
 }else{
  if(/코미디|로맨스|가족|comedy|romance|family/i.test(g))return 'movie-comedy';
  if(/액션|스릴러|범죄|공포|미스터리|전쟁|서부|action|thriller|crime|horror|mystery|war|western/i.test(g))return 'movie-action';
  if(/\bSF\b|공상|판타지|애니메이션|모험|animation|fantasy|adventure|science fiction/i.test(g))return 'movie-sf';
  if(/드라마|로맨스|음악|역사|다큐|drama|romance|music|history|documentary/i.test(g))return 'movie-drama';
 }
 return c.type==='book'?'book-other':'movie-other';
}
function bmFallback(c){return c?.type==='movie'?'birch':'oak'}
function bmAvailablePool(c,s=state){const b=s.collection?.bm||bmRefresh(s),p=BM_POOLS.find(p=>p.id===bmPool(c));if(!p)return [];const owned=new Set(bmOwnedFrom(b));return [p.free,...p.paid].filter(id=>bmTreeReady(id)&&owned.has(id))}
function bmProgressFrom(b){return {record:b.hasRecorded?1:0,completed:b.completedKeys.length,media:new Set(b.completedKeys.map(k=>k.split('|')[0])).size,days:b.recordDays.length}}
function bmGrowthFrom(b){const p=bmProgressFrom(b);return BM_GROWTH_RULES.map(r=>({...r,progress:Math.min(r.target,p[r.metric]),done:b.earnedTreeIds.includes(r.speciesId)||p[r.metric]>=r.target}))}
function bmSyncLedger(b,items){
 const keys=new Set(b.completedKeys),days=new Set(b.recordDays);
 for(const c of items){if(!bmTracked(c))continue;
  if(c.completed){keys.add(bmCompletionKey(c));b.hasRecorded=true;if(bmValidDate(c.completed))days.add(c.completed)}
  for(const l of Array.isArray(c.logs)?c.logs:[])if(bmValidDate(l?.date)){days.add(l.date);b.hasRecorded=true}
 }
 b.completedKeys=[...keys];b.recordDays=[...days].sort();
 for(const r of bmGrowthFrom(b))if(r.done){if(!b.earnedTreeIds.includes(r.speciesId))b.earnedTreeIds.push(r.speciesId);bmAddSource(b.ownership,r.speciesId,'growth')}
 for(const id of BM_BASE_IDS)bmAddSource(b.ownership,id,'base');
 if(BM_CONFIG.mode==='beta'){for(const id of BM_READY_IDS)bmAddSource(b.ownership,id,'beta');bmAddSource(b.floorOwnership,'meadow','beta')}
}
function bmSanitize(raw,items=[]){
 const b=bmFresh(),regular=new Set([...BM_READY_IDS,...BM_RESERVED_IDS]);
 const unique=(v,test)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&test(x)))]:[];
 const sourceMap=(v,allowed)=>{const out={};if(v&&typeof v==='object'&&!Array.isArray(v))for(const [id,kinds] of Object.entries(v))if(allowed(id)){const good=unique(kinds,k=>BM_SOURCE_KINDS.includes(k));if(good.length)out[id]=good}return out};
 if(raw?.version===2){
  b.completedKeys=unique(raw.completedKeys,k=>/^(book|movie)\|[^|]+\|/.test(k)&&k.length<=2000);
  b.recordDays=unique(raw.recordDays,bmValidDate);b.hasRecorded=raw.hasRecorded===true;
  b.earnedTreeIds=unique(raw.earnedTreeIds,id=>BM_RECORD_IDS.includes(id));
  b.legacyTreeIds=unique(raw.legacyTreeIds,id=>regular.has(id));b.legacyMysteryIds=unique(raw.legacyMysteryIds,id=>['A','B','C','D'].includes(id));
  b.ownership=sourceMap(raw.ownership,id=>regular.has(id));b.floorOwnership=sourceMap(raw.floorOwnership,id=>BM_PAID_FLOOR_IDS.includes(id));
  b.previewOwnership=sourceMap(raw.previewOwnership,id=>BM_SALE_IDS.includes(id));b.previewFloorOwnership=sourceMap(raw.previewFloorOwnership,id=>BM_PAID_FLOOR_IDS.includes(id));
  for(const [id,kinds] of Object.entries(b.previewOwnership)){const good=kinds.filter(k=>k==='cash'||k==='coupon');if(good.length)b.previewOwnership[id]=good;else delete b.previewOwnership[id]}
  for(const [id,kinds] of Object.entries(b.previewFloorOwnership)){if(kinds.includes('cash'))b.previewFloorOwnership[id]=['cash'];else delete b.previewFloorOwnership[id]}
  if(raw.previewCouponViews&&typeof raw.previewCouponViews==='object'&&!Array.isArray(raw.previewCouponViews))for(const [date,n] of Object.entries(raw.previewCouponViews))if(bmValidDate(date)&&Number.isSafeInteger(n)&&n>0)b.previewCouponViews[date]=Math.min(n,BM_CONFIG.future.rewardedViewsPerDay);
  // previewVersion 1 used 12 views per coupon and 1 coupon per tree; trees opened then are kept.
  const cost=BM_CONFIG.future.couponCostPerTree,legacyCoupons=raw.previewVersion!==2;
  const earned=Math.floor(Object.values(b.previewCouponViews).reduce((sum,n)=>sum+n,0)/BM_CONFIG.future.viewsPerCoupon);
  const allowed=legacyCoupons?Math.floor(earned/12):Math.floor(earned/cost);
  let couponOwned=0;for(const id of BM_SALE_IDS)if(b.previewOwnership[id]?.includes('coupon')){if(couponOwned<allowed)couponOwned++;else{b.previewOwnership[id]=b.previewOwnership[id].filter(k=>k!=='coupon');if(!b.previewOwnership[id].length)delete b.previewOwnership[id]}}
  b.previewCouponSpent=legacyCoupons?Math.min(earned,couponOwned*cost):Math.max(couponOwned*cost,Number.isSafeInteger(raw.previewCouponSpent)&&raw.previewCouponSpent>=0?Math.min(raw.previewCouponSpent,earned):0);
  b.treeTheme=BM_TREE_THEMES.some(t=>t.id===raw.treeTheme)?raw.treeTheme:'mix';b.themeCustom=raw.themeCustom===true;
  for(const p of BM_POOLS){const n=raw.nextByPool?.[p.id];if(Number.isSafeInteger(n)&&n>=0)b.nextByPool[p.id]=Math.min(n,1000000)}
 }else{
  // v1 purchase demos were never money payments and cannot unlock cash rewards.
  if(raw?.version===1){
   b.completedKeys=unique(raw.completedKeys,k=>/^(book|movie)\|[^|]+\|/.test(k)&&k.length<=2000);
   b.legacyTreeIds=[...unique(raw.legacyTreeIds,id=>regular.has(id)),...unique(raw.earnedTreeIds,id=>BM_RECORD_IDS.includes(id))];
   b.legacyMysteryIds=unique(raw.legacyMysteryIds,id=>['A','B'].includes(id));
   for(const id of unique(raw.demoOwnedTreeIds,id=>regular.has(id)))bmAddSource(b.ownership,id,'beta');
   if(raw.demoOwnedFloorIds?.includes('meadow'))bmAddSource(b.floorOwnership,'meadow','beta');
  }
  // Existing drawings are kept during the model transition, independent of genre.
  for(const c of items)if(bmTracked(c)&&c.completed){if(BM_READY_IDS.includes(c.speciesId))b.legacyTreeIds.push(c.speciesId);if(['A','B'].includes(c.hiddenTree))b.legacyMysteryIds.push(c.hiddenTree)}
  b.legacyTreeIds=[...new Set(b.legacyTreeIds)];b.legacyMysteryIds=[...new Set(b.legacyMysteryIds)];
 }
 // Beta access was temporary; retain genuine ownership and per-record artwork instead.
 for(const target of [b.ownership,b.floorOwnership])for(const [id,kinds] of Object.entries(target)){const real=kinds.filter(k=>k!=='beta');if(real.length)target[id]=real;else delete target[id]}
 for(const id of b.legacyTreeIds)bmAddSource(b.ownership,id,'legacy');
 for(const id of b.earnedTreeIds)bmAddSource(b.ownership,id,'growth');
 bmSyncLedger(b,items);
 b.floor=BM_PAID_FLOOR_IDS.includes(raw?.floor)&&bmFloorOwnedFrom(b,raw.floor)?raw.floor:'basic';
 for(const c of items){
  if(!bmTracked(c))continue;
  const a=c.bmAssignment,validMode=['auto','manual','legacy'].includes(a?.mode);
  if(raw?.version===2&&a?.version===2&&validMode){c.bmAssignment={version:2,mode:a.mode,pool:BM_POOLS.some(p=>p.id===a.pool)?a.pool:null,fallback:a.fallback===true,sequence:Number.isSafeInteger(a.sequence)&&a.sequence>=0?a.sequence:0}}
  else if(c.completed&&(BM_READY_IDS.includes(c.speciesId)||['A','B'].includes(c.hiddenTree)))c.bmAssignment={version:2,mode:'legacy',pool:bmPool(c),fallback:false,sequence:0};
  else delete c.bmAssignment;
 }
 return b;
}
function bmRefresh(s){
 if(!s.collection||typeof s.collection!=='object')s.collection={treeChoices:{},disabledSpeciesIds:[],visitorsSeen:[]};
 if(s.collection.bm?.version!==2||s.collection.bm?.previewVersion!==2)s.collection.bm=bmSanitize(s.collection.bm,s.items||[]);
 const b=s.collection.bm;bmSyncLedger(b,s.items||[]);
 for(const c of s.items||[]){if(!bmTracked(c))continue;
  if(typeof launchGenre==='function'&&!GENRE_POOL[c.type]?.includes(c.genre)){if(!c.rawGenre)c.rawGenre=c.genre||'';c.genre=launchGenre(c.type,c.genre,c)}
  if(!c.bmAssignment&&BM_READY_IDS.includes(c.speciesId)){c.bmAssignment={version:2,mode:'legacy',pool:bmPool(c),fallback:false,sequence:0};bmAddSource(b.ownership,c.speciesId,'legacy')}
  const a=c.bmAssignment;
  if(!a||!bmTreeReady(c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId)||(a.mode==='auto'&&(!bmCanUseFrom(b,c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId)||a.pool!==bmPool(c)||a.fallback&&bmAvailablePool(c,s).length||b.treeTheme&&b.treeTheme!=='mix'&&!c.hiddenTree&&c.speciesId!==bmThemeSpecies(b,a.pool,bmAvailablePool(c,s)))))bmAssignItem(s,c,true);
 }
 return b;
}
function bmState(){const b=state.collection?.bm;return b?.version===2&&b.previewVersion===2&&b.ownership?.oak?b:bmRefresh(state)}
function bmOwnedTreeIds(){return bmOwnedFrom(bmState())}
function bmCashTreeCount(){return bmCashCountFrom(bmState())}
function bmGrowthMilestones(s=state){return bmGrowthFrom(bmRefresh(s))}
function bmMysteries(){const b=bmState(),planted=bmProgressFrom(b).completed;return [{id:'A',name:'반짝이는 나무',ready:true},{id:'B',name:'달빛나무',ready:true},{id:'C',name:'미스터리 나무',ready:false},{id:'D',name:'미스터리 나무',ready:false}].map(t=>({...t,at:BM_MYSTERY_AT[t.id],metric:'trees',progress:planted,unlocked:bmMysteryAvailableFrom(b,t.id)}))}
function bmAutoSpecies(c,s=state){const pool=bmAvailablePool(c,s),b=s.collection?.bm,sequence=c.bmAssignment?.sequence??b?.nextByPool?.[bmPool(c)]??0;return pool.length?pool[sequence%pool.length]:bmFallback(c)}
function bmAssignItem(s,c,force=false){
 if(!bmTracked(c))return c;
 const b=s.collection?.bm?.version===2?s.collection.bm:bmRefresh(s);
 if(['manual','legacy'].includes(c.bmAssignment?.mode)&&bmTreeReady(c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId))return c;
 if(!force&&c.bmAssignment&&bmTreeReady(c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId))return c;
 const pool=bmPool(c),available=bmAvailablePool(c,s),sequence=b.nextByPool[pool]||0,themed=bmThemeSpecies(b,pool,available);
 c.speciesId=themed||(available.length?available[sequence%available.length]:bmFallback(c));c.hiddenTree=null;c.bmAppearance=true;
 c.bmAssignment={version:2,mode:'auto',pool,fallback:!available.length,sequence};
 if(pool&&available.length)b.nextByPool[pool]=sequence+1;
 return c;
}
function bmAssignManual(s,c,id){
 if(!bmTracked(c))return false;
 const b=s.collection?.bm?.version===2?s.collection.bm:bmRefresh(s);if(!bmCanUseFrom(b,id))return false;
 c.speciesId=id.startsWith('mystery-')?bmFallback(c):id;c.hiddenTree=id.startsWith('mystery-')?id.slice(-1):null;c.bmAppearance=true;
 c.bmAssignment={version:2,mode:'manual',pool:bmPool(c),fallback:false,sequence:c.bmAssignment?.sequence||0};return true;
}
function bmResetItemAppearance(s,c){if(!bmTracked(c))return false;delete c.bmAssignment;bmAssignItem(s,c,true);return true}
function bmFloorOwnedFrom(b,id){return id==='basic'||BM_PAID_FLOOR_IDS.includes(id)&&!!(bmRealSources(b,id,true).length||bmPreviewSources(b,id,true).length)}
function bmFloorOwned(id){return bmFloorOwnedFrom(bmState(),id)}
function bmFloorId(){const b=bmState();return bmFloorOwnedFrom(b,b.floor)?b.floor:'basic'}
function bmSetFloor(id){if(!bmFloorOwned(id))return false;bmState().floor=id;return true}
function bmCouponStatus(s=state,date=now()){
 const b=bmRefresh(s),totalViews=Object.values(b.previewCouponViews).reduce((sum,n)=>sum+n,0),required=BM_CONFIG.future.viewsPerCoupon;
 return {watchedToday:bmValidDate(date)?b.previewCouponViews[date]||0:0,dailyLimit:BM_CONFIG.future.rewardedViewsPerDay,progress:totalViews%required,required,balance:Math.max(0,Math.floor(totalViews/required)-b.previewCouponSpent),totalViews,cost:BM_CONFIG.future.couponCostPerTree};
}
function bmPreviewWatchAd(s=state,date=now()){
 if(BM_CONFIG.mode!=='preview')return {ok:false,reason:'mode-disabled',couponEarned:0};
 if(!bmValidDate(date))return {ok:false,reason:'invalid-date',couponEarned:0};
 const status=bmCouponStatus(s,date);if(status.watchedToday>=status.dailyLimit)return {ok:false,reason:'daily-limit',couponEarned:0};
 const b=s.collection.bm;b.previewCouponViews[date]=status.watchedToday+1;
 return {ok:true,reason:'',couponEarned:(status.progress+1===status.required)?1:0};
}
function bmPreviewTreeCheck(id,s){
 if(BM_CONFIG.mode!=='preview')return {ok:false,reason:'mode-disabled'};
 if(!BM_SHOP_IDS.includes(id))return {ok:false,reason:'not-for-sale'};
 if(!bmTreeReady(id))return {ok:false,reason:'not-ready'};
 const b=bmRefresh(s);if(bmOwnedFrom(b).includes(id))return {ok:false,reason:'already-owned'};
 return {ok:true,reason:''};
}
function bmPreviewRedeem(id,s=state){
 const check=bmPreviewTreeCheck(id,s);if(!check.ok)return check;
 const status=bmCouponStatus(s);if(status.balance<BM_CONFIG.future.couponCostPerTree)return {ok:false,reason:'no-coupon'};
 const b=s.collection.bm;bmAddSource(b.previewOwnership,id,'coupon');b.previewCouponSpent+=BM_CONFIG.future.couponCostPerTree;bmRefresh(s);
 return {ok:true,reason:'',id};
}
function bmPreviewBuyTree(id,s=state){
 const check=bmPreviewTreeCheck(id,s);if(!check.ok)return check;
 bmAddSource(s.collection.bm.previewOwnership,id,'cash');bmRefresh(s);return {ok:true,reason:'',id};
}
function bmPreviewBuyFloor(id,s=state){
 if(BM_CONFIG.mode!=='preview')return {ok:false,reason:'mode-disabled'};
 const floor=BM_FLOORS.find(f=>f.id===id);if(!floor||floor.free)return {ok:false,reason:'not-for-sale'};
 if(!floor.ready)return {ok:false,reason:'not-ready'};
 const b=bmRefresh(s);if(bmFloorOwnedFrom(b,id))return {ok:false,reason:'already-owned'};
 bmAddSource(b.previewFloorOwnership,id,'cash');return {ok:true,reason:'',id};
}
// Packs: a discount on the single prices, sold only while you own none of what's inside (open one tree or the
// floor any way and that pack is gone). The third (10 trees + a new floor) appears once its art is ready.
const BM_PACKS=[
 {id:'first',name:'꽃이끼 정원 패키지',trees:BM_EXISTING_SHOP_IDS,floors:['meadow'],price:9900,list:13200,art:'./assets/images/shop/pack-first.webp'},
 {id:'winter',name:'겨울 숲 패키지',trees:BM_WINTER_IDS,floors:['snow'],price:11000,list:13200,art:'./assets/images/shop/pack-winter.webp',tone:'sky'},
 {id:'third',name:'세 번째 숲 패키지',trees:BM_RESERVED_IDS,floors:['floor-reserved-01'],price:9900,list:13200}
];
let bmActivePack='first';
function bmPackDef(id=bmActivePack){return BM_PACKS.find(p=>p.id===id)||BM_PACKS[0]}
function bmPackageInfo(s=state,packId=bmActivePack){
 const pack=bmPackDef(packId),b=bmRefresh(s),ids=[...pack.trees],floorIds=[...pack.floors],floorId=floorIds[0],owned=new Set(bmOwnedFrom(b));
 const ready=ids.every(bmTreeReady)&&floorIds.every(f=>BM_FLOORS.find(x=>x.id===f)?.ready);
 const newTreeIds=ids.filter(id=>!owned.has(id)),duplicateTreeIds=ids.filter(id=>owned.has(id)),newCashTreeIds=ids.filter(id=>!bmCashOwnedFrom(b,id));
 const couponDuplicateIds=duplicateTreeIds.filter(id=>bmRealSources(b,id).includes('coupon')||bmPreviewSources(b,id).includes('coupon')),newFloorIds=floorIds.filter(f=>!bmFloorOwnedFrom(b,f)),floorNew=newFloorIds.length>0;
 return {pack,ready,ids,floorId,floorIds,newFloorIds,newTreeIds,newTreeCount:newTreeIds.length,duplicateTreeIds,couponDuplicateIds,newCashTreeIds,newCashTreeCount:newCashTreeIds.length,floorNew,untouched:!duplicateTreeIds.length&&newFloorIds.length===floorIds.length,canBuy:BM_CONFIG.mode==='preview'&&ready&&!duplicateTreeIds.length&&newFloorIds.length===floorIds.length};
}
function bmPreviewBuyPackage(s=state,packId=bmActivePack){
 if(BM_CONFIG.mode!=='preview')return {ok:false,reason:'mode-disabled'};
 const info=bmPackageInfo(s,packId);if(!info.canBuy)return {ok:false,reason:'nothing-new'};
 const b=s.collection.bm;for(const id of info.newCashTreeIds)bmAddSource(b.previewOwnership,id,'cash');for(const f of info.newFloorIds)bmAddSource(b.previewFloorOwnership,f,'cash');bmRefresh(s);
 return {ok:true,reason:'',newTreeCount:info.newTreeCount,newCashTreeCount:info.newCashTreeCount,floorNew:info.floorNew};
}
// Compatibility helpers are beta-only and never create cash/coupon provenance.

const FOREST_VISITORS=[
 {id:'rabbit',name:'산토끼',need:1,emoji:'🐇'},
 {id:'bird',name:'박새',need:6,emoji:'🐦'},
 {id:'butterfly',name:'호랑나비',need:10,emoji:'🦋'},
 {id:'squirrel',name:'다람쥐',need:15,emoji:'🐿️'},
 {id:'fox',name:'여우',need:20,emoji:'🦊'},
 {id:'hedgehog',name:'고슴도치',need:25,emoji:'🦔'},
 {id:'deer',name:'아기사슴',need:30,emoji:'🦌'},
 {id:'firefly',name:'반딧불이',need:40,emoji:'✨'},
 {id:'owl',name:'부엉이',need:50,emoji:'🦉'}
];

function mappedCategory(type,genre){return TREE_CATEGORIES.find(t=>t.type===type&&t.pattern?.test(String(genre||'').normalize('NFKC')))||TREE_CATEGORIES[9]}
function category(c){
 // Explicit category is only for legend samples, never a user's cached override.
 if(!Object.prototype.hasOwnProperty.call(c,'genre')&&!c.id&&c.treeCategory)return TREE_CATEGORIES.find(t=>t.id===c.treeCategory&&(t.type===c.type||t.id==='other'))||TREE_CATEGORIES[9];
 return mappedCategory(c.type,c.genre);
}
function shortCategoryLabel(cat){return String(cat?.label||'기타').replace(/^(책|음악|영화)\s*·\s*/,'')}
function mappedForestCategoryLabel(type,genre){return shortCategoryLabel(mappedCategory(type,genre))}
function validRating(n){n=Number(n);return Number.isFinite(n)&&n>=0.5&&n<=5?n:null}
function contentMetadata(c){
 const seed=typeof SEED_BOOKS!=='undefined'&&c.type==='book'?SEED_BOOKS.find(b=>Model.norm(b.title)===Model.norm(c.title)&&Model.norm(b.creator)===Model.norm(c.creator)):null;
 const genreSource=String(c.genreSource||'');
 const rawGenre=cleanGenreValue(c.rawGenre||c.genre||seed?.genre||'');
 let genre=cleanGenreValue(c.genre||seed?.genre||'');
 let candidates=Array.isArray(c.genreCandidates)?c.genreCandidates:[];
 if(genreSource!=='user'){
  if(c.type==='movie'&&Array.isArray(c.genreIds)&&c.genreIds.length){const info=movieGenreInfo(c.genreIds);genre=info.primary||genre;candidates=info.candidates.length?info.candidates:candidates}
  else genre=normalizeGenreForType(c.type,genre||rawGenre,{...c,genre:genre||rawGenre});
 }
 genre=GENRE_POOL[c.type]?.includes(c.genre)?c.genre:launchGenre(c.type,genre,c);
 return {genre,rawGenre,genreSource:genreSource||'auto',treeCategory:mappedCategory(c.type,genre).id,genreMappingVersion:3,genreCandidates:candidates,length:Number(c.length)>0?Number(c.length):null,review:String(c.review||'')};
}
// Launch labels live together so the native client can localize them by group id.
const LAUNCH_GENRES={
 book:[['book-literature','순문학'],['book-genre','장르문학'],['book-humanities','인문'],['book-science','과학'],['book-other','기타']],
 movie:[['movie-drama','드라마'],['movie-comedy','로맨스·코미디'],['movie-action','액션·스릴러'],['movie-sf','SF·판타지'],['movie-other','기타']]
};
function launchGenre(type,value,data={}){
 const text=String(value||'').normalize('NFKC').trim(),exact=LAUNCH_GENRES[type]?.find(x=>x[1]===text);if(exact)return exact[1];
 if(type==='book'){
  if(/장르문학|추리|미스터리|스릴러|판타지|로맨스|공포|무협|\bSF\b|science fiction|mystery|thriller|fantasy|romance|horror/i.test(text))return '장르문학';
  if(/과학|수학|생물|물리|화학|의학|기술|컴퓨터|프로그래밍|자연|환경|science|technology/i.test(text))return '과학';
  if(/인문|철학|역사|사회|정치|심리|예술|경제|경영|자기계발|교육|humanities|history|philosophy|business/i.test(text))return '인문';
  if(/문학|소설|수필|에세이|시집|^시$|fiction|literature|poetry|essay/i.test(text))return '순문학';
 }else if(type==='movie'){
  if(/로맨스|코미디|romance|comedy/i.test(text))return '로맨스·코미디';
  if(/액션|스릴러|범죄|공포|미스터리|전쟁|서부|action|thriller|crime|horror|mystery|war|western/i.test(text))return '액션·스릴러';
  if(/\bSF\b|공상|판타지|애니메이션|모험|animation|fantasy|adventure|science fiction/i.test(text))return 'SF·판타지';
  if(/드라마|drama/i.test(text))return '드라마';
 }
 return '기타';
}
const GENRE_POOL=Object.fromEntries(Object.entries(LAUNCH_GENRES).map(([type,groups])=>[type,groups.map(x=>x[1])]));

function genreCandidates(c){return (GENRE_POOL[c.type]||[]).map(label=>[label,''])}
function genreOptions(c){const selected=launchGenre(c.type,c.genre,c);return genreCandidates(c).map(([label])=>'<option value="'+esc(label)+'" '+(label===selected?'selected':'')+'>'+esc(label)+'</option>').join('')}
function metadataFields(c){return '<label for="contentGenre">장르</label><select id="contentGenre">'+genreOptions(c)+'</select><span id="genreTreePreview" hidden></span><p class="muted tiny">직접 고른 장르는 자동으로 바뀌지 않아요.</p>'}
document.addEventListener('change',e=>{if(e.target.id==='contentType'){$('contentGenre').innerHTML=genreOptions({type:e.target.value,genre:''});const isBook=e.target.value==='book';}if(['contentType','contentGenre'].includes(e.target.id))$('genreTreePreview').textContent='나무 · '+mappedForestCategoryLabel($('contentType').value,$('contentGenre').value)+' 계열'});
// Work info as one quiet line (date · length); the values speak for themselves, no labels.
function detailMetadata(c){
 const day=v=>{const m=String(v||'').match(/^(\d{4})-?(\d{2})-?(\d{2})/);return m?m[1]+'.'+m[2]+'.'+m[3]:esc(String(v).slice(0,10))};
 const bits=[];
 if((c.type==='movie'||c.type==='album')&&c.releaseDate)bits.push(day(c.releaseDate));
 if(c.type==='book'&&c.publishedAt)bits.push(day(c.publishedAt));
 if(c.runtime&&c.type!=='movie')bits.push(esc(c.runtime)+'분');
 if(c.length&&c.type==='book')bits.push(esc(c.length)+'쪽');
 return bits.length?'<p class="detail-meta-line">'+bits.join(' · ')+'</p>':'';
}
function recentCompleted(){
 const items=state.items.filter(c=>c.completed).sort((a,b)=>(b.completed==='unknown'?'':b.completed).localeCompare(a.completed==='unknown'?'':a.completed)||(b.completedAt||0)-(a.completedAt||0)||b.id.localeCompare(a.id)).slice(0,2);
 if(!items.length)return '';
 const labels={book:'BOOK',movie:'MOVIE'};
 return '<section class="recent-completed sticker-recent"><div class="row between"><h2>최근 완료</h2>'+button('나의 숲 <span aria-hidden="true">›</span>','tab','textbtn','data-tab="forest"')+'</div><div class="sticker-recent-list">'+items.map(c=>'<button type="button" class="sticker-recent-card" data-type="'+c.type+'" data-action="detail" '+attr(c.id)+'><div class="sticker-recent-art">'+stickerTree(c,3,'is-cut')+'</div><span class="sticker-recent-type">'+labels[c.type]+'</span><strong>'+esc(c.title)+'</strong><small>'+(c.completed==='unknown'?'완료일 미상':esc(c.completed.slice(5).replace('-','.')))+(validRating(c.rating)?' · <span class="rating-star" aria-hidden="true">★</span> '+c.rating:'')+'</small></button>').join('')+'</div></section>';
}
function renderToday(){return renderTodayBase()+recentCompleted()}
// Count the selected year's completed works once each, using their saved primary genre.
// Candidate genres and tree choices describe different things and never add votes.
function collectionState(){if(!state.collection||typeof state.collection!=='object')state.collection={treeChoices:{},disabledSpeciesIds:[],visitorsSeen:[]};if(!state.collection.treeChoices)state.collection.treeChoices={};if(!Array.isArray(state.collection.disabledSpeciesIds))state.collection.disabledSpeciesIds=[];if(!Array.isArray(state.collection.visitorsSeen))state.collection.visitorsSeen=[];return state.collection}
function completedAll(){return state.items.filter(c=>c.completed)}
function speciesForCategory(categoryId){return TREE_SPECIES.filter(t=>t.category===categoryId)}
function autoSpecies(c){return TREE_SPECIES.find(t=>t.id===bmAutoSpecies(c))||TREE_SPECIES[0]}
function contentSpecies(c){return TREE_SPECIES.find(t=>t.id===c?.speciesId)||autoSpecies(c)}
function assignAutoSpecies(c,force=false){if(!c)return false;const before=JSON.stringify([c.speciesId,c.hiddenTree,c.bmAssignment]);bmRefresh(state);bmAssignItem(state,c);return before!==JSON.stringify([c.speciesId,c.hiddenTree,c.bmAssignment])}
function ensureCompletedSpeciesAssignments(){const before=JSON.stringify(state.items.map(c=>[c.speciesId,c.hiddenTree,c.bmAssignment]));bmRefresh(state);return before!==JSON.stringify(state.items.map(c=>[c.speciesId,c.hiddenTree,c.bmAssignment]))}
function remapDefaultSpeciesByCategory(){return false}
function previewSpeciesArt(speciesId,theme='basic'){
 const key=((theme==='snow'||theme==='winter')?'winter':'')+speciesId,b=(SONGLIM_TREE_ASSETS[key]||SONGLIM_TREE_ASSETS.birch).bounds;
 return '<g transform="translate('+(-(b.x+b.width/2)).toFixed(3)+' 0)">'+speciesArt(speciesId,theme)+'</g>';
}
let collectionTab='inventory';
let bmCollectionTab='inventory',bmPreview=null,bmCodexTab='trees',bmSelectedWork='',bmTreeFilter='shop',bmCheckout=null,bmPendingProduct=null;
const BM_NAMES={base:'기본 나무',record:'성장 나무',shop:'스페셜 나무',mystery:'히든 나무'};
const BM_FLOOR_NAMES={basic:'기본 바닥',meadow:'꽃이끼 정원'};
const BM_KRW_FORMAT=new Intl.NumberFormat('ko-KR'),bmKRW=n=>BM_KRW_FORMAT.format(n)+'원';
function bmTreeName(id){return id.startsWith('mystery-')?bmMysteries().find(t=>t.id===id.slice(-1))?.name||'히든 나무':TREE_SPECIES.find(t=>t.id===id)?.name||'새 나무 '+String(BM_RESERVED_IDS.indexOf(id)+1)}
function bmPlaceholder(label='디자인 준비 중'){return '<div class="bm-placeholder" aria-label="'+esc(label)+'"><span aria-hidden="true">✧</span><small>'+esc(label)+'</small></div>'}
// Hidden trees follow the floor: on 겨울 숲 they show (and are named for) their winter look.
function bmHiddenSnow(){return bmFloorId()==='snow'}
function bmTreeSVG(id,snow=false){if(!bmTreeReady(id))return bmPlaceholder();const special=id.startsWith('mystery-'),key=special?(snow?'winter':'')+(id==='mystery-A'?'shining':'moonlight'):id,b=(SONGLIM_TREE_ASSETS[key]||SONGLIM_TREE_ASSETS[key.replace('winter','')])?.bounds;if(!b)return bmPlaceholder();const w=Math.max(94,b.width+12);return '<svg viewBox="'+[-w/2,b.y-7,w,b.height+15].join(' ')+'" aria-hidden="true">'+(special?hiddenTreeArt(id.slice(-1),snow?'snow':'basic'):previewSpeciesArt(id,'basic'))+'</svg>'}
function bmReadyTreeIds(){return [...bmOwnedTreeIds().filter(bmTreeReady),...bmMysteries().filter(t=>t.ready&&t.unlocked).map(t=>'mystery-'+t.id)]}
function bmWorkItems(){return state.items.filter(c=>['book','movie'].includes(c.type)).sort((a,b)=>Number(Model.stage(b)>0)-Number(Model.stage(a)>0)||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0))}
function bmWork(){const items=bmWorkItems();return items.find(c=>c.id===bmSelectedWork)||items[0]||null}
function bmNotice(){return ''}
function bmBadge(group){return '<span class="bm-badge '+(group==='shop'?'paid':group==='mystery'?'hidden':'free')+'">'+(group==='shop'?'스페셜':group==='mystery'?'조건 해금':'무료')+'</span>'}
function bmMysteryCondition(t){return '나무 '+t.at+'그루 심기'}
function bmConditionHTML(id){const group=bmCatalogGroup(id);if(group==='record'){const m=bmGrowthMilestones().find(t=>t.speciesId===id);return '<div class="bm-condition"><p>'+esc(m.label)+' · '+m.progress+'/'+m.target+'</p><progress max="'+m.target+'" value="'+m.progress+'" aria-label="'+esc(m.label)+'"></progress></div>'}if(group==='mystery'){const m=bmMysteries().find(t=>t.id===id.slice(-1));return '<div class="bm-condition"><p>'+bmMysteryCondition(m)+' · '+Math.min(m.at,m.progress)+'/'+m.at+'</p><progress max="'+m.at+'" value="'+Math.min(m.at,m.progress)+'" aria-label="'+bmMysteryCondition(m)+'"></progress></div>'}return '<p>'+(group==='base'?'처음부터 함께해요':BM_STORE_OPEN?'광고 쿠폰 14장 또는 '+bmKRW(1100):'곧 열려요')+'</p>'}
function bmWorkSelect(){const items=bmWorkItems(),c=bmWork();if(c)bmSelectedWork=c.id;return c?'<div class="bm-work-select"><label for="bmWorkSelect">모습을 바꿀 작품</label><select id="bmWorkSelect">'+items.map(x=>'<option value="'+esc(x.id)+'" '+(c.id===x.id?'selected':'')+'>'+esc(x.title)+' · '+(['씨앗','새싹','어린 나무','나무'][Model.stage(x)])+'</option>').join('')+'</select></div>':'<p class="bm-subtitle">작품을 담으면 해금한 나무로 꾸밀 수 있어요.</p>'}
// Preview = the real month board (same ground art as the forest tab), empty, 3×3.
function bmFloorPreviewArt(floor){return forestSVG([],'basic',false,{grid:'month',minCols:3,transient:true,preview:true,floor}).replace(/viewBox="[^"]*"/,'viewBox="215 168 290 240" aria-hidden="true"').replace(/ role="group" aria-label="[^"]*"/,'')}
function bmFloorCard(f){const current=bmFloorId()===f.id,owned=bmFloorOwned(f.id);return '<article class="bm-floor-card">'+(f.ready?button(bmFloorPreviewArt(f.id),'bmPreviewFloor','bm-floor-art','data-floor="'+f.id+'" aria-label="'+f.name+' 미리보기"'):bmPlaceholder())+'<div><h3>'+f.name+'</h3>'+bmBadge(f.free?'base':'shop')+'<p>'+(f.free?'처음부터 무료':'한 번 구매로 계속 사용')+'</p><small>'+(current?'사용 중':!f.ready?'디자인 준비 중':owned?'보유 중':'내 숲에 미리보기')+'</small>'+(f.ready?(!owned&&!BM_STORE_OPEN?'<span class="bm-card-buy is-soon">곧 열려요</span>':button(owned?'바꿔보기':'2,200원',owned?'bmPreviewFloor':'bmQuickBuy','bm-card-buy','data-floor="'+f.id+'" data-kind="floor" '+(!owned?'aria-label="'+f.name+' 2,200원 구매 체험"':''))):'')+'</div></article>'}
let bmShopFilter='all';
function openCollection(tab=bmCollectionTab){if(forestEditMode&&view!=='forest')forestEditMode=false;bmShopFilter=BM_SALE_THEMES.some(t=>t.id===tab)?tab:tab==='inventory'?'all':bmShopFilter;if(tab==='visitors'){bmOpenCodex('visitors');return}bmRefresh(state);bmPreview=null;bmCheckout=null;bmCollectionTab=['floors','coupons'].includes(tab)?tab:'inventory';collectionTab=tab;const same=view==='shop';closeModal();view='shop';forestEditMode=false;render();if(!same)scrollPageTop()}
function bmOpenCodex(tab='trees'){bmRefresh(state);bmPreview=null;bmCodexTab=tab==='visitors'?'visitors':'trees';const same=view==='codex';closeModal();view='codex';render();if(!same)scrollPageTop()}
function bmPreviewItems(){return (typeof forestMonthItems==='function'?forestMonthItems(month):forestItems(state,year)).map(c=>Model.clone(c))}
function bmPreviewHTML(){const p=bmPreview,isTree=p.kind==='tree',name=isTree?bmTreeName(p.id):BM_FLOOR_NAMES[p.id],owned=isTree?bmReadyTreeIds().includes(p.id):bmFloorOwned(p.id),group=isTree?bmCatalogGroup(p.id):p.id==='basic'?'base':'shop',q=bmCouponStatus();const art=isTree?'<div class="bm-preview-specimen">'+bmTreeSVG(p.id)+'</div>':'<div class="bm-live-scene" id="bmPreviewScene" inert>'+forestSVG(bmPreviewItems(),'basic',false,{floor:p.id,preview:true,grid:'month',transient:true})+'</div>';let actions='';if(owned)actions=button(isTree?'숲에서 꾸미기':'바닥 바꾸기',isTree?'bmDecorateForest':'bmDecorateFloors','primary');else if(group==='shop'&&!BM_STORE_OPEN)actions='<p class="bm-money-note">스페셜 나무와 바닥은 곧 열려요.</p>';else if(group==='shop')actions=(isTree?button(q.balance>=q.cost?'쿠폰 '+q.cost+'장으로 해금하기':'쿠폰 모으기 · '+q.balance+'/'+q.cost,q.balance>=q.cost?'bmRedeemStart':'bmCoupons','secondary'):'')+button(bmKRW(isTree?1100:2200)+' 구매 체험','bmBuyStart','primary');else actions='<p class="bm-money-note">'+(group==='record'?'기록으로 조건을 채우면 무료로 열려요.':'나무를 심어 조건을 채우면 자동으로 열려요. 판매하지 않아요.')+'</p>';return '<div class="bm-preview-body">'+art+'<div class="bm-preview-copy">'+bmBadge(group)+'<h3>'+esc(name)+'</h3>'+(isTree?(owned?'<p>'+(bmGenreLabel(p.id)||'열렸어요')+'</p>':bmConditionHTML(p.id)):'<p>'+(owned?'보유 중':BM_STORE_OPEN?'2,200원 · 한 번 사면 계속 써요':'곧 열려요')+'</p>')+'</div>'+bmNotice()+'<p id="formError" class="form-error" role="alert"></p><div class="bm-acquire-actions">'+actions+'</div>'+button('돌아가기','bmBackCollection','textbtn')+'</div>'}
function bmOpenPreview(kind,id,itemId=''){if(kind==='tree'&&!bmTreeReady(id)||kind==='floor'&&!BM_FLOORS.some(f=>f.id===id&&f.ready))return;if(itemId&&get(itemId))bmSelectedWork=itemId;bmPreview={kind,id,itemId:itemId||bmWork()?.id||'',backTab:bmCollectionTab,source:'preview'};bmCheckout=null;showModal(kind==='tree'?'나무 살펴보기':'내 숲에 미리보기',bmPreviewHTML(),'collection');if(kind==='floor')requestAnimationFrame(bmFitPreview)}
function bmFitPreview(){const svg=document.querySelector('#bmPreviewScene>svg'),world=svg?.querySelector('#forest-world');if(!svg||!world)return;const b=world.getBBox(),pad=22;svg.setAttribute('viewBox',[b.x-pad,b.y-pad,b.width+2*pad,b.height+2*pad].join(' '))}
function bmApplyPreview(){if(!bmPreview)return;const p={...bmPreview},before=Model.clone(state);const ok=p.kind==='floor'?bmSetFloor(p.id):bmAssignManual(state,get(p.itemId),p.id);if(!ok){state=before;return}if(!persist())return;bmPreview=null;closeModal();view='forest';forestEditMode=false;render();toast(p.kind==='floor'?'바닥을 바꿨어요.':'이 작품의 나무를 바꿨어요.')}
function bmOpenCheckout(kind){const p=bmPreview;if(['tree','floor','coupon'].includes(kind)&&!p)return;bmCheckout={kind,id:p?.id||'',preview:p?{...p}:null};let title='',body='',action='',disabled=false;if(kind==='ad'){const q=bmCouponStatus();title='광고 쿠폰 모으기';body='<p>오늘 '+q.watchedToday+'/2회 · 쿠폰 '+Math.min(q.balance,q.cost)+'/'+q.cost+'장</p><p>실제 광고는 재생되지 않아요. 아래 버튼으로 시청 완료 흐름을 체험해요.</p>';action='시청 완료로 체험하기';disabled=q.watchedToday>=2}else if(kind==='package'){const pack=bmPackageInfo();title=pack.pack.name;body='<p>나무 '+pack.ids.length+'종 + 바닥 '+pack.floorIds.length+'종</p>'+'<p class="bm-money-note">구성 나무가 하나도 없을 때만 살 수 있어요. 한 그루라도 열면 이 패키지는 사라져요.</p>'+'<div class="bm-package-grid">'+pack.ids.map(id=>'<div>'+bmTreeSVG(id)+'<small>'+esc(bmTreeName(id))+'</small></div>').join('')+'</div>'+pack.floorIds.map(f=>'<div class="bm-package-floor"><span class="bm-package-floor-art">'+bmFloorPreviewArt(f)+'</span><div><small>바닥</small><strong>'+esc(BM_FLOORS.find(x=>x.id===f)?.name||'바닥')+'</strong></div></div>').join('')+'<div class="bm-price-summary"><small>단품 합 <del>'+bmKRW(pack.pack.list)+'</del></small><strong>'+bmKRW(pack.pack.price)+'</strong></div><p>새로 열리는 나무 '+pack.newTreeCount+'종'+(pack.newFloorIds.length?' · 바닥 '+pack.newFloorIds.length+'종':'')+'</p>'+(pack.duplicateTreeIds.length?'<p class="bm-money-note">이미 보유한 '+pack.duplicateTreeIds.length+'종도 포함돼요. 중복 나무가 추가되거나 가격이 차감되지는 않아요.'+(pack.couponDuplicateIds.length?'':'')+'</p>':'');action=pack.canBuy?bmKRW(pack.pack.price)+' 구매 체험하기':'이미 모두 보유하고 있어요';disabled=!pack.canBuy}else{const coupon=kind==='coupon',floor=kind==='floor',q=bmCouponStatus();title='해금하기';body='<div class="bm-checkout-product">'+(floor?bmFloorPreviewArt(p.id):bmTreeSVG(p.id))+'<div><h3>'+esc(floor?BM_FLOOR_NAMES[p.id]:bmTreeName(p.id))+'</h3><small>한 번 열면 계속 사용할 수 있어요</small></div></div>'+bmPackWarning(p.id)+(!floor?'<div class="bm-payment-methods" role="group" aria-label="해금 방법">'+button('단품 구매<strong>1,100원</strong>','bmPayCash',!coupon?'active':'','aria-pressed="'+!coupon+'"')+button('쿠폰 '+q.balance+'장 보유<strong>쿠폰 '+q.cost+'장</strong>','bmPayCoupon',coupon?'active':'','aria-pressed="'+coupon+'" '+(q.balance>=q.cost?'':'disabled'))+'</div>':'')+'<div class="bm-price-summary"><small>'+(coupon?'사용할 쿠폰':'결제 금액')+'</small><strong>'+(coupon?q.cost+'장':bmKRW(floor?2200:1100))+'</strong></div><p>'+(coupon?'쿠폰으로 연 나무도 수집 보상에 포함돼요.':floor?'바닥 구매는 나무 구매 종 수에 포함되지 않아요.':'')+'</p>';action=coupon?'쿠폰 '+q.cost+'장 사용하기':bmKRW(floor?2200:1100)+' 구매 체험 완료하기';disabled=coupon&&q.balance<q.cost}showModal(title,'<div class="bm-checkout">'+body+bmNotice()+'<p id="formError" class="form-error" role="alert"></p><div class="bm-acquire-actions">'+button(action,'bmConfirmAcquire','primary',disabled?'disabled':'')+button('취소','bmCancelAcquire','textbtn')+'</div></div>','collection')}
function bmConfirmAcquire(){if(!bmCheckout)return;const request={...bmCheckout},before=Model.clone(state);let result;try{result=request.kind==='ad'?bmPreviewWatchAd():request.kind==='package'?bmPreviewBuyPackage():request.kind==='coupon'?bmPreviewRedeem(request.id):request.kind==='floor'?bmPreviewBuyFloor(request.id):bmPreviewBuyTree(request.id)}catch{state=before;result={ok:false}}if(!result?.ok){state=before;const error=$('formError');if(error)error.textContent='이미 해금했거나 지금 진행할 수 없어요. 보유 상태와 오늘의 횟수를 확인해 주세요.';return}if(!persist())return;bmCheckout=null;render();if(request.kind==='ad'){openCollection('coupons');toast('쿠폰 1장을 받았어요.')}else if(request.kind==='package'){openCollection('inventory');toast('패키지 구매 체험을 완료했어요.')}else{const p=request.preview;bmOpenPreview(p.kind,p.id,p.itemId);toast('나무와 바닥은 한 번 해금하면 계속 사용할 수 있어요.')}}
function bmPickerName(id){return id.startsWith('mystery-')&&bmHiddenSnow()?(id==='mystery-A'?'반짝이는 트리':'눈꽃 달빛나무'):bmTreeName(id)}
// Tree picker grouped by theme. The theme that matches the floor comes first; hidden trees sit with it.
function treePickerHTML(c){const current=c.hiddenTree?'mystery-'+c.hiddenTree:contentSpecies(c).id,own=new Set(bmReadyTreeIds()),match=BM_FLOOR_THEME[bmFloorId()]||'classic';
 const card=id=>button('<span class="bm-decoration-art">'+bmTreeSVG(id,bmHiddenSnow())+'</span><span class="bm-decoration-name">'+esc(bmPickerName(id).replace(/^겨울 /,''))+(id===current?'<b aria-hidden="true">✓</b>':'')+'</span>','bmChooseOwnedTree','bm-decoration-card '+(id===current?'selected':''),'data-id="'+esc(c.id)+'" data-species="'+id+'" aria-label="'+esc(bmTreeName(id))+' 선택" aria-pressed="'+(id===current)+'"');
 const groups=[{id:'classic',name:'클래식 나무',ids:BM_GENRE_IDS},{id:'hidden',name:'히든 나무',ids:bmMysteries().filter(t=>t.ready).map(t=>'mystery-'+t.id)},...BM_SALE_THEMES.map(t=>({id:t.id,name:t.name+' 나무',ids:t.ids}))].map(g=>({...g,ids:g.ids.filter(id=>own.has(id))})).filter(g=>g.ids.length);
 groups.sort((a,b)=>(b.id===match)-(a.id===match)||(b.id==='hidden'&&a.id!==match)-(a.id==='hidden'&&b.id!==match));
 const floorName=BM_FLOORS.find(f=>f.id===bmFloorId())?.name||'';
 return '<div class="bm-decoration-body"><div class="bm-decoration-work"><span>'+typeName[c.type]+'</span><h3>'+esc(c.title)+'</h3>'+(Model.stage(c)<3?'<p>다 자라면 선택한 모습이 돼요.</p>':'')+'</div>'+
  groups.map(g=>'<h4 class="bm-decoration-label">'+g.name+(g.id===match&&groups.length>1?'<small>'+esc(floorName)+'에 어울려요</small>':'')+'</h4><div class="bm-decoration-grid">'+g.ids.map(card).join('')+'</div>').join('')+
  '<p id="formError" class="form-error" role="alert"></p>'+button('장르에 맞춰 자동으로 고르기','bmAutoOwnedTree','textbtn bm-reset','data-id="'+esc(c.id)+'"')+'</div>'}
function openTreePicker(id){const c=get(id);if(!c)return;bmRefresh(state);bmSelectedWork=c.id;bmPreview=null;bmCheckout=null;showModal('나무 바꾸기',treePickerHTML(c),'collection');requestAnimationFrame(()=>document.querySelector('.bm-decoration-card.selected')?.scrollIntoView({block:'center'}))}
document.addEventListener('change',e=>{if(e.target.id==='bmWorkSelect'&&get(e.target.value)){bmSelectedWork=e.target.value;if(bmPreview){bmPreview.itemId=bmSelectedWork;showModal('나무 살펴보기',bmPreviewHTML(),'collection')}else openCollection('inventory');$('bmWorkSelect')?.focus({preventScroll:true})}});

function bmOpenShop(tab='inventory'){forestEditMode=false;bmTreeFilter='shop';bmPendingProduct=null;openCollection(tab)}
function bmDecorateForest(){closeModal();bmPreview=null;bmCheckout=null;view='forest';forestEditMode=true;render();scrollPageTop()}
function bmChooseOwnedTree(itemId,id,automatic=false){const c=get(itemId);if(!c||(!automatic&&!bmReadyTreeIds().includes(id)))return;const before=Model.clone(state);const ok=automatic?bmResetItemAppearance(state,c):bmAssignManual(state,c,id);if(ok!==false&&!automatic)bmState().themeCustom=true;if(ok===false){state=before;return}if(!persist())return;closeModal();bmPreview=null;view='forest';forestEditMode=true;render();toast(Model.stage(c)<3?(c.type==='movie'?'다 보면 ':'다 읽으면 ')+bmTreeName(c.hiddenTree?'mystery-'+c.hiddenTree:contentSpecies(c).id)+' 모습으로 자라요.':'나무 모습을 바꿨어요.')}
// Re-deal every tree by genre in planting order (manual picks dropped). With the 'mix' theme a genre
// alternates the trees you own; with a theme each genre takes that theme's tree.
function bmApplyTreeTheme(s,theme){const b=bmRefresh(s);b.themeCustom=false;b.treeTheme=BM_TREE_THEMES.some(t=>t.id===theme)?theme:'mix';return bmResetToGenre(s,true)}
function bmResetToGenre(s=state,keepHidden=false){const b=bmRefresh(s);b.nextByPool={};const key=c=>(c.completed||'9999-99-99')+String(c.completedAt||c.createdAt||'').padStart(16,'0');for(const c of [...(s.items||[])].filter(bmTracked).sort((x,y)=>key(x)<key(y)?-1:1)){if(keepHidden&&c.hiddenTree)continue;delete c.bmAssignment;c.hiddenTree=null;bmAssignItem(s,c,true)}return b}
// Prototype only: undo every preview purchase, coupon and ad view, and any special tree/floor carried
// over from older data, so the shop and packs can be tried again from scratch.
function bmPreviewResetPurchases(s=state){const b=bmRefresh(s);b.previewOwnership={};b.previewFloorOwnership={};for(const id of BM_SHOP_IDS)delete b.ownership[id];for(const f of BM_PAID_FLOOR_IDS)delete b.floorOwnership[f];b.legacyTreeIds=b.legacyTreeIds.filter(id=>!BM_SHOP_IDS.includes(id));b.previewCouponViews={};b.previewCouponSpent=0;if(!bmFloorOwnedFrom(b,b.floor))b.floor='basic';for(const c of s.items||[]){if(!bmTracked(c))continue;const id=c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId;if(!bmCanUseFrom(b,id))bmResetItemAppearance(s,c)}bmRefresh(s);return b}
function bmPreviewResetConfirm(){confirmBox('구매 되돌리기','체험으로 산 나무·바닥·패키지와 모은 쿠폰을 모두 되돌릴까요? 그 나무로 꾸민 자리는 클래식 나무로 돌아가요.',()=>{const before=Model.clone(state);bmPreviewResetPurchases(state);if(!persist()){state=before;return}closeModal();render();toast('구매를 되돌렸어요.')},'되돌리기',true)}
// Floor swatches scroll sideways, so more floors can be added without crowding the bar.
const bmFloorSwatchCache={};
function bmFloorSwatch(id){return bmFloorSwatchCache[id]||(bmFloorSwatchCache[id]=bmFloorPreviewArt(id))}
// Decorate dock: forest-set cards first (floor + trees in one tap). Fine-tuning stays one step away:
// 바닥만 바꾸기 opens the floor row, and any tree in the forest can still be tapped to change just that tree.
let bmEditTab='sets';
function bmSetActive(st){const b=bmState();return bmFloorId()===st.floor&&!b.themeCustom&&(b.treeTheme===st.theme||st.theme==='classic'&&b.treeTheme==='mix'&&!BM_POOLS.some(p=>bmReadyTreeIds().includes(p.paid[0])||bmReadyTreeIds().includes(p.paid[1])))}
function bmSetCardArt(st){return '<span class="forest-set-art" aria-hidden="true">'+bmFloorSwatch(st.floor)+'<span class="forest-set-trees">'+st.trees.map(id=>'<img src="./assets/images/trees/thumb/'+id+'.webp" alt="" decoding="async">').join('')+'</span></span>'}
function bmEditBarHTML(){const cur=bmFloorId(),lock='<svg class="forest-edit-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
 const head='<div class="forest-edit-head"><strong class="forest-edit-title">'+(bmEditTab==='floor'?'바닥만 바꾸기':'숲 꾸미기')+'</strong>'+button('완료','forestEdit','forest-edit-done')+'</div>';
 const sets='<div class="forest-edit-row forest-edit-sets" role="group" aria-label="숲 세트">'+BM_FOREST_SETS.map(st=>{const owned=bmFloorOwned(st.floor),on=owned&&bmSetActive(st);return button(bmSetCardArt(st)+'<span class="forest-set-name">'+esc(st.name)+(owned?'':lock)+'</span>','bmForestSet','forest-set'+(on?' active':'')+(owned?'':' is-locked'),'data-set="'+st.id+'" aria-pressed="'+on+'"'+(owned?'':' aria-label="'+esc(st.name)+' · 상점에서 보기"'))}).join('')+'</div>';
 const floors='<div class="forest-edit-row forest-edit-floors" role="group" aria-label="바닥">'+BM_FLOORS.filter(f=>f.ready).map(f=>{const owned=bmFloorOwned(f.id),on=cur===f.id;return button('<span class="forest-edit-swatch" aria-hidden="true">'+bmFloorSwatch(f.id)+'</span>'+(owned?'':lock),owned?'bmFloorOnly':'bmPreviewFloor','forest-edit-floor'+(on?' active':'')+(owned?'':' is-locked'),'data-floor="'+f.id+'" aria-pressed="'+on+'" aria-label="'+esc(f.name)+(owned?'':' · 미리보기')+'" title="'+esc(f.name)+'"')}).join('')+'</div>';
 const foot=bmEditTab==='floor'?'<div class="forest-edit-foot">'+button('← 숲 세트로','bmEditTab','forest-edit-link','data-tab="sets"')+'<span>나무는 그대로 두고 바닥만 바뀌어요</span></div>':'<div class="forest-edit-foot"><span>'+(bmState().themeCustom?'직접 고른 나무가 있어요 · ':'')+'숲에서 나무를 누르면 하나씩 바꿀 수 있어요</span>'+button('바닥만 바꾸기','bmEditTab','forest-edit-link','data-tab="floor"')+'</div>';
 return '<div class="forest-edit-bar is-dock">'+head+(bmEditTab==='floor'?floors:sets)+foot+'</div>'}
function bmOpenFloorPicker(){bmRefresh(state);const floors=BM_FLOORS.filter(f=>f.ready&&bmFloorOwned(f.id));showModal('바닥 바꾸기','<div class="bm-decoration-body"><div class="bm-decoration-floors">'+floors.map(f=>button(bmFloorPreviewArt(f.id)+'<span>'+f.name+(bmFloorId()===f.id?'<b aria-hidden="true">✓</b>':'')+'</span>','bmChooseOwnedFloor','bm-decoration-floor '+(bmFloorId()===f.id?'selected':''),'data-floor="'+f.id+'" aria-pressed="'+(bmFloorId()===f.id)+'"')).join('')+'</div><p id="formError" class="form-error" role="alert"></p></div>','collection')}
function bmUndoTo(before){return ()=>{state=before;persist();view='forest';forestEditMode=true;render();toast('되돌렸어요.')}}
function bmChooseOwnedFloor(id){if(!BM_FLOORS.some(f=>f.id===id&&f.ready&&bmFloorOwned(id)))return;if(bmFloorId()===id)return;const before=Model.clone(state);if(!bmSetFloor(id)){state=before;return}const t=BM_FLOOR_THEME[id],applied=t&&bmThemeAvailable(t)&&bmState().treeTheme!==t;if(applied)bmApplyTreeTheme(state,t);if(!persist()){state=before;return}closeModal();view='forest';forestEditMode=true;render();if(applied)toast(BM_TREE_THEMES.find(x=>x.id===t).name+' 나무로 함께 바꿨어요.',bmUndoTo(before))}

function bmAction(a,b){
 if(!BM_STORE_OPEN&&['bmQuickBuy','bmBuyStart','bmPackage','bmAdStart','bmRedeemStart','bmCoupons'].includes(a)){toast('스페셜 나무와 바닥은 곧 열려요.');return true}
 if(a==='bmDecorateForest'){bmDecorateForest();return true}
 if(a==='bmDecorateFloors'){bmDecorateForest();bmOpenFloorPicker();return true}
 if(a==='bmChooseOwnedTree'){bmChooseOwnedTree(b.dataset.id,b.dataset.species);return true}
 if(a==='bmAutoOwnedTree'){bmChooseOwnedTree(b.dataset.id,'',true);return true}
 if(a==='bmEditTab'){bmEditTab=b.dataset.tab==='floor'?'floor':'sets';render();return true}
 if(a==='bmForestSet'){const st=BM_FOREST_SETS.find(x=>x.id===b.dataset.set);if(!st)return true;if(!bmFloorOwned(st.floor)){forestEditMode=false;openCollection(st.shop);return true}if(bmSetActive(st))return true;const before=Model.clone(state);bmSetFloor(st.floor);bmApplyTreeTheme(state,bmThemeAvailable(st.theme)?st.theme:'classic');if(!persist()){state=before;return true}view='forest';forestEditMode=true;render();toast(st.name+'으로 꾸몄어요.',bmUndoTo(before));return true}
 if(a==='bmFloorOnly'){const id=b.dataset.floor;if(!bmFloorOwned(id)||bmFloorId()===id)return true;const before=Model.clone(state);bmSetFloor(id);if(!persist()){state=before;return true}view='forest';forestEditMode=true;render();toast('바닥만 바꿨어요.',bmUndoTo(before));return true}
 if(a==='bmTreeTheme'){const t=b.dataset.theme;if(!bmThemeAvailable(t)){forestEditMode=false;openCollection(t);return true}if(bmState().treeTheme===t&&t!=='mix'&&!bmState().themeCustom)return true;const before=Model.clone(state);bmApplyTreeTheme(state,t);if(!persist()){state=before;return true}view='forest';forestEditMode=true;render();toast(t==='mix'?'가진 나무를 섞어서 심었어요.':BM_TREE_THEMES.find(x=>x.id===t).name+' 나무로 바꿨어요.',bmUndoTo(before));return true}
 if(a==='bmPreviewReset'){bmPreviewResetConfirm();return true}
 if(a==='bmChooseOwnedFloor'){bmChooseOwnedFloor(b.dataset.floor);return true}
 if(a==='bmCodex'||a==='bmCodexTab'){bmOpenCodex(b.dataset.tab);return true}
 if(a==='bmPreviewTree'){bmOpenPreview('tree',b.dataset.species,b.dataset.id);return true}
 if(a==='bmPreviewFloor'){bmOpenPreview('floor',b.dataset.floor);return true}
 if(a==='bmApplyPreview'){bmApplyPreview();return true}
 if(a==='bmBackCollection'){openCollection(bmPreview?.backTab||bmCollectionTab);return true}
 if(a==='bmCoupons'){if(bmPreview?.kind==='tree')bmPendingProduct={...bmPreview};openCollection('coupons');return true}
 if(a==='bmReturnProduct'){const p=bmPendingProduct;bmPendingProduct=null;if(p)bmOpenPreview(p.kind,p.id,p.itemId);return true}
 if(a==='bmQuickBuy'){const kind=b.dataset.kind,id=kind==='floor'?b.dataset.floor:b.dataset.species;if(kind==='tree'&&(!bmTreeReady(id)||bmReadyTreeIds().includes(id))||kind==='floor'&&(!BM_FLOORS.some(f=>f.id===id&&f.ready)||bmFloorOwned(id)))return true;bmPreview={kind,id,itemId:b.dataset.id||bmWork()?.id||'',backTab:bmCollectionTab,source:'store'};bmOpenCheckout(kind);return true}
 if(a==='bmPayCash'){bmOpenCheckout('tree');return true}
 if(a==='bmPayCoupon'){const q=bmCouponStatus();if(q.balance>=q.cost)bmOpenCheckout('coupon');return true}
 if(a==='bmBrowsePaid'){bmTreeFilter='shop';openCollection('inventory');return true}
 if(a==='bmTreeFilter'){bmTreeFilter=['free','shop','mystery','owned'].includes(b.dataset.filter)?b.dataset.filter:'all';openCollection('inventory');return true}
 if(a==='bmPackage'){if(b.dataset.pack)bmActivePack=b.dataset.pack;if(!bmPackageInfo().canBuy){toast('이미 가진 나무가 있어서 이 패키지는 살 수 없어요.');return true}bmOpenCheckout('package');return true}
 if(a==='bmAdStart'){bmOpenCheckout('ad');return true}
 if(a==='bmBuyStart'){if(bmPreview)bmOpenCheckout(bmPreview.kind);return true}
 if(a==='bmRedeemStart'){const q=bmCouponStatus();if(q.balance>=q.cost)bmOpenCheckout('coupon');else{if(bmPreview?.kind==='tree')bmPendingProduct={...bmPreview};openCollection('coupons')}return true}
 if(a==='bmConfirmAcquire'){bmConfirmAcquire();return true}
 if(a==='bmCancelAcquire'){const request=bmCheckout;bmCheckout=null;if(request?.preview?.source==='store')openCollection(request.preview.backTab);else if(request?.preview)bmOpenPreview(request.preview.kind,request.preview.id,request.preview.itemId);else openCollection(request?.kind==='ad'?'coupons':'inventory');return true}
 if(a==='bmResetAppearance'){const c=get(b.dataset.id);if(c){bmResetItemAppearance(state,c);if(persist()){render();openCollection('inventory');toast('장르에 맞는 나무를 골랐어요.')}}return true}
 return false;
}


// 감상 and 메모 are one thing now: an old one-line review becomes a memo on the day the work was finished.
function itemNotesWithReview(c){const ok=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''));const day=()=>typeof now==='function'?now():new Date().toISOString().slice(0,10);
 const notes=Array.isArray(c.notes)?c.notes.filter(n=>n&&typeof n.text==='string'&&n.text.trim()).map(n=>({id:String(n.id||('n'+Math.random().toString(36).slice(2,10))),date:ok(n.date)?n.date:day(),text:String(n.text).trim().slice(0,4000)})):[];
 const review=String(c.review||'').trim();if(review&&!notes.some(n=>n.text===review))notes.push({id:'review-'+String(c.id||'').slice(0,40),date:ok(c.completed)?c.completed:day(),text:review.slice(0,4000)});return notes}
function ratingPrompt(c,advance=false){
 const finishing=advance&&!c.completed,done=c.completed&&c.completed!=='unknown'?c.completed:now();
 const cover='<span class="finish-cover is-'+c.type+'">'+(c.cover?'<img src="'+esc(c.cover)+'" alt="">':'')+'</span>';
 showModal(finishing?(c.type==='movie'?'다 봤어요':'다 읽었어요'):'별점','<form id="ratingForm" class="finish-form" data-id="'+esc(c.id)+'" data-advance="'+(advance?'yes':'no')+'"><div class="finish-head">'+cover+'<div><span>'+(c.completed||finishing?'FINISHED · '+done.slice(5).replace('-','.'):'')+'</span><strong>'+esc(c.title)+'</strong></div></div>'+
 '<div class="finish-rating"><span>어땠어요?</span><div class="rating"><div class="rating-half-stars" data-rating-picker></div></div><input type="hidden" id="ratingValue" value="'+(c.rating||'')+'"><p id="ratingText">'+(c.rating?Number(c.rating).toFixed(1):'선택 안 함')+'</p></div>'+
 
 '<label class="sr-only" for="finishMemo">메모 남기기 · 선택</label><textarea id="finishMemo" maxlength="4000" placeholder="메모 남기기 · 선택"></textarea>'+(finishing?'<label class="finish-date"><span>완료일</span><b id="finishDateText">'+finishDateLabel(now())+' ›</b><input id="finishDate" type="date" max="'+now()+'" value="'+now()+'" aria-label="완료일"></label>':'')+
 '<div class="finish-actions"><button class="primary" type="submit">'+(finishing?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2-6 8h3l-5 7h6v5h4v-5h6l-5-7h3z"/></svg>숲에 심기':'별점 저장')+'</button>'+
 (c.rating?button('평점만 지우기','clearRating','textbtn',attr(c.id)):'')+'</div></form>','finish')}

function profilePhotoSource(value){
 return typeof value==='string'&&value.length<=300000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';
}
const Model=(()=>{
 const clone=x=>JSON.parse(JSON.stringify(x));
 const today=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
 const validDate=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const d=new Date(x+'T00:00:00.000Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x};
 const empty=()=>({version:3,items:[],selected:null,themes:{},profile:{name:'나',bio:'',photo:'',tastes:[]},collection:{treeChoices:{},disabledSpeciesIds:[],visitorsSeen:[],bm:bmFresh()},onboarded:false,offset:0,filters:{q:'',status:'all',type:'all',sort:'recent'}});
 // Starting is explicit and persists independently of the editable daily logs.
 const firstExperienceDate=c=>{
  const dates=[c.startedAt,...(c.logs||[]).map(l=>l.date)].filter(validDate).sort();
  if(dates.length)return dates[0];
  if(!c.importedProgress)return '';
  const at=(c.saves||[]).map(e=>Number(e.at)).filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b)[0];
  const d=at?new Date(at):new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 };
 const stage=c=>c.completed?3:Math.max((validDate(c.startedAt)||c.importedProgress)?1:0,Math.min(2,new Set((c.logs||[]).map(l=>l.date).filter(validDate)).size));
 const status=c=>c.completed?'done':stage(c)>0?'active':'saved';
 const get=(s,id)=>s.items.find(c=>c.id===id);
 const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
 const add=(s,data,request=uid())=>{
  if(!data||!['book','movie'].includes(data.type))throw Error('지금은 책과 영화만 기록할 수 있어요.');
  const providerId=String(data.providerId??data.provider_id??'').trim(),provider=String(data.provider||'').trim();
  const providerDefault=data.type==='album'?'apple':data.type==='movie'?'tmdb':'';
  let c=((data.type==='album'||data.type==='movie')&&providerId?s.items.find(c=>c.type===data.type&&String(c.providerId||'')===providerId&&String(c.provider||'')===(provider||providerDefault)):null) || s.items.find(c=>c.type===data.type&&norm(c.title)===norm(data.title)&&norm(c.creator)===norm(data.creator));
  if(!c){c={id:uid(),type:data.type,title:data.title.trim(),creator:(data.creator||'').trim(),...contentMetadata(data),tracks:data.tracks||[],logs:[],completed:null,rating:null,saves:[],cover:data.cover||'',source:data.source||'',publisher:String(data.publisher||''),isbn:String(data.isbn||''),catalogUrl:String(data.catalogUrl||''),publishedAt:String(data.publishedAt||''),provider:provider,providerId:providerId,releaseDate:String(data.releaseDate||data.release_date||''),trackCount:Number(data.trackCount??data.track_count)||null,copyright:String(data.copyright||''),originalTitle:String(data.originalTitle||data.original_title||''),originalLanguage:String(data.originalLanguage||data.original_language||''),overview:String(data.overview||data.description||''),runtime:Number(data.runtime??data.runtime_minutes??data.runtimeMinutes)||null,contents:String(data.contents||data.description||''),albumDescription:String(data.albumDescription||''),genreIds:Array.isArray(data.genreIds)?data.genreIds.map(Number).filter(Number.isFinite):Array.isArray(data.genre_ids)?data.genre_ids.map(Number).filter(Number.isFinite):[],trackIndex:0};s.items.push(c)}
  if(Array.isArray(data.linkSources))c.linkSources=normalizeLinkSources([...data.linkSources,...(c.linkSources||[])]);
  if(!c.saves.some(e=>e.id===request))c.saves.push({id:request,at:Date.now(),source:data.source||'직접 입력'});
  return c;
 };
 const start=(s,id,date)=>{const c=get(s,id);if(!c||c.completed||!['book','movie'].includes(c.type)||!validDate(date))return false;if(validDate(c.startedAt))return false;c.startedAt=firstExperienceDate(c)||date;return true};
 const log=(s,id,date)=>{const c=get(s,id);if(!c||c.completed||!['book','movie'].includes(c.type)||!validDate(date))return false;if(c.logs.some(l=>l.date===date))return false;c.logs.push({id:uid(),date,page:'',memo:''});return true};
 const complete=(s,id,date)=>{const c=get(s,id);if(!c||c.completed||!validDate(date))return false;c.completed=date;c.completedAt=Date.now();bmRefresh(s);bmAssignItem(s,c);return true};
 const undoComplete=(s,id)=>{bmRefresh(s);const c=get(s,id);if(c){c.completed=null;c.completedAt=null}};
 const remove=(s,id)=>{bmRefresh(s);s.items=s.items.filter(c=>c.id!==id);if(s.selected===id)s.selected=null};
 const completed=(s,period)=>s.items.filter(c=>c.completed&&(c.completed==='unknown'?period.length===4&&forestRecordYear(c)===period:c.completed.startsWith(period))).sort((a,b)=>a.completed.localeCompare(b.completed)||a.id.localeCompare(b.id));
 const refs=[['작은 화단',75],['텃밭',150],['뒷마당',225],['작은 놀이터',300],['농구장',420],['넓은 놀이터',750],['작은 공원',1500],['축구장',7140]];
 const compare=n=>{if(!n)return '';if(n<5)return '화분 하나에 심어졌어요';const area=Math.floor(n/5)*75;return [...refs].sort((a,b)=>Math.abs(a[1]-area)-Math.abs(b[1]-area)||a[1]-b[1])[0][0]+'만큼 넓어졌어요'};
 const stats=items=>{const supported=items.filter(c=>c.type==='book'||c.type==='movie');return {n:supported.length,area:supported.length*15,book:supported.filter(c=>c.type==='book').length,movie:supported.filter(c=>c.type==='movie').length}};
 function validate(raw){
  if(!raw||raw.version!==3||!Array.isArray(raw.items)||raw.items.length>10000)throw Error(APP_BRAND.ko+' 백업 파일인지 확인해주세요.');
  const s=empty();s.items=raw.items.filter(c=>c?.type!=='album').map(c=>{
   if(!c||typeof c.id!=='string'||!['book','movie'].includes(c.type)||typeof c.title!=='string'||!c.title.trim()||!Array.isArray(c.logs)||!Array.isArray(c.saves))throw Error('콘텐츠 형식이 올바르지 않아요.');
   if(c.completed&&c.completed!=='unknown'&&!validDate(c.completed))throw Error('완료 날짜가 올바르지 않아요.');
   if(c.logs.some(l=>!validDate(l.date)||typeof l.id!=='string')||new Set(c.logs.map(l=>l.date)).size!==c.logs.length)throw Error('경험 기록 날짜를 확인해주세요.');
   return {...c,...contentMetadata(c),startedAt:validDate(c.startedAt)?c.startedAt:(c.importedProgress?firstExperienceDate(c):null),importedProgress:!!c.importedProgress,linkSources:normalizeLinkSources(c.linkSources),rating:validRating(c.rating),notes:itemNotesWithReview(c),review:'',creator:String(c.creator||''),logs:c.logs.map(l=>({...l,page:String(l.page||''),memo:String(l.memo||'')})),tracks:Array.isArray(c.tracks)?c.tracks.map(String):[],saves:c.saves.map(e=>({id:String(e.id),at:Number(e.at)||0,source:String(e.source||'')})),cover:/^(?:data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(c.cover||'')?String(c.cover):'',source:String(c.source||''),publisher:String(c.publisher||''),isbn:String(c.isbn||''),catalogUrl:/^https:\/\//.test(c.catalogUrl||'')?String(c.catalogUrl):'',publishedAt:String(c.publishedAt||''),provider:String(c.provider||''),providerId:String(c.providerId||''),releaseDate:String(c.releaseDate||''),trackCount:Number(c.trackCount)||null,copyright:String(c.copyright||''),originalTitle:String(c.originalTitle||''),originalLanguage:String(c.originalLanguage||''),overview:String(c.overview||''),runtime:Number(c.runtime??c.runtime_minutes??c.runtimeMinutes)||null,contents:String(c.contents||''),genreIds:Array.isArray(c.genreIds)?c.genreIds.map(Number).filter(Number.isFinite):[],hiddenTree:['A','B'].includes(c.hiddenTree)?c.hiddenTree:null};
  });
  if(new Set(s.items.map(c=>c.id)).size!==s.items.length)throw Error('중복된 콘텐츠 ID가 있어요.');
  s.selected=s.items.some(c=>c.id===raw.selected)?raw.selected:null;
  s.themes=Object.fromEntries(Object.entries(raw.themes||{}).filter(([k])=>/^\d{4}$/.test(k)).map(([k])=>[k,'basic']));
  s.profile={name:String(raw.profile?.name||'나').trim().slice(0,30)||'나',bio:String(raw.profile?.bio||'').trim().slice(0,120),photo:profilePhotoSource(raw.profile?.photo),tastes:Array.isArray(raw.profile?.tastes)?raw.profile.tastes.filter(x=>typeof x==='string'):[]};
  s.profile.recommendationHistory=Array.isArray(raw.profile?.recommendationHistory)?[...new Set(raw.profile.recommendationHistory.filter(key=>typeof key==='string'&&!key.startsWith('album:')))]:[];
  s.profile.responses=raw.profile?.responses&&typeof raw.profile.responses==='object'?Object.fromEntries(Object.entries(raw.profile.responses).filter(([key])=>!key.startsWith('album:'))):{};
  const validSpecies=new Set(TREE_SPECIES.map(t=>t.id)),validCats=new Set(TREE_CATEGORIES.map(t=>t.id)),validVisitors=new Set(FOREST_VISITORS.map(v=>v.id));
  const rawChoices=raw.collection?.treeChoices&&typeof raw.collection.treeChoices==='object'?raw.collection.treeChoices:{};
  s.collection={treeChoices:Object.fromEntries(Object.entries(rawChoices).filter(([cat,id])=>validCats.has(cat)&&validSpecies.has(String(id)))),disabledSpeciesIds:Array.isArray(raw.collection?.disabledSpeciesIds)?[...new Set(raw.collection.disabledSpeciesIds.map(String).filter(id=>validSpecies.has(id)))]:[],visitorsSeen:Array.isArray(raw.collection?.visitorsSeen)?[...new Set(raw.collection.visitorsSeen.map(String).filter(id=>validVisitors.has(id)))]:[]};
  s.collection.bm=bmSanitize(raw.collection?.bm,s.items);
  s.onboarded=!!raw.onboarded;s.offset=Number.isInteger(raw.offset)&&raw.offset>=0&&raw.offset<=365?raw.offset:0;
  s.filters={q:String(raw.filters?.q||''),status:['saved','active','done','all'].includes(raw.filters?.status)?raw.filters.status:'all',type:['all','book','movie'].includes(raw.filters?.type)?raw.filters.type:'all',sort:raw.filters?.sort==='old'?'completed':['recent','completed','many','rating'].includes(raw.filters?.sort)?raw.filters.sort:'recent'};
  return s;
 }
 return {clone,today,norm,validDate,empty,status,stage,firstExperienceDate,get,uid,add,start,log,complete,undoComplete,remove,completed,compare,stats,validate,refs};
})();
function migrateLegacy(raw){
 if(!Array.isArray(raw?.contents))throw Error('기존 기록 형식을 확인해주세요.');
 const s=Model.empty(),mapping={};
 const date=x=>{const v=String(x||'').replace(/[./]/g,'-');return Model.validDate(v)?v:null};
 for(const old of raw.contents){
  if(!['book','movie'].includes(old.type)||!String(old.title||'').trim())continue;
  const c=Model.add(s,{type:old.type,title:String(old.title),creator:String(old.creator||''),genre:old.genre,length:old.length||old.pages||old.duration,review:old.review,source:String(old.source||'기존 기록'),tracks:old.tracks||[]});mapping[old.id]=c.id;
  const count=Math.max(1,Math.min(10000,Number(old.saveCount)||1));for(let n=c.saves.length;n<count;n++)Model.add(s,c,'legacy-'+old.id+'-'+n);
  for(const r of old.records||[]){const d=date(r.date);if(d&&!c.logs.some(l=>l.date===d))c.logs.push({id:Model.uid(),date:d,page:String(r.page||r.pages||''),memo:String(r.memo||'')})}
  if(old.status==='experienced'||old.status==='Finished'){c.completed=date(old.completed)||'unknown';c.rating=Number(old.rating)||null}
  c.trackIndex=Number(old.trackIndex)||0;c.importedProgress=old.status==='in_progress'||!!old.legacyProgress;
 }
 s.selected=mapping[raw.state?.currentId]||null;s.onboarded=!!s.items.length;
 return s;
}

/* original script block 7 */
const SEED_BOOKS=[];
const CATALOG=[];

/* Shop and codex pages (redesign 14a). Previews and checkout stay as sheets over these pages. */
function bmTreeImgSrc(id){const key=id.startsWith('mystery-')?(id==='mystery-A'?'shining':'moonlight'):id;return SONGLIM_TREE_ASSETS[key]?.src||''}
function bmTreeImg(id,cls='',variant='thumb'){const src=bmTreeImgSrc(id).replace('/trees/','/trees/'+variant+'/');return src&&bmTreeReady(id)?'<img class="bm-img '+cls+'" src="'+esc(src)+'" alt="" decoding="async" loading="lazy">':'<span class="bm-img-soon">곧<br>만나요</span>'}
const BM_PAGE_ICONS={coupon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/></svg>',arrow:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',lock:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'};
function bmPageTabs(tabs,current,action){return '<div class="bm-page-tabs" role="group">'+tabs.map(([id,label])=>button(label,action,id===current?'active':'','data-tab="'+id+'" aria-pressed="'+(id===current)+'"')).join('')+'</div>'}
function bmShopCard(id){
 const owned=bmReadyTreeIds().includes(id),ready=bmTreeReady(id),group=bmCatalogGroup(id);
 const action=!ready?'<span class="bm-shop-action is-soon">곧 만나요</span>':owned?button(BM_PAGE_ICONS.check.replace('#FF6A55','currentColor')+'보유 중','bmPreviewTree','bm-shop-action is-owned','data-species="'+id+'"'):group==='shop'&&!BM_STORE_OPEN?'<span class="bm-shop-action is-soon">곧 열려요</span>':group==='shop'?button('1,100원','bmQuickBuy','bm-shop-action','data-species="'+id+'" data-kind="tree" aria-label="'+esc(bmTreeName(id))+' 1,100원 구매 체험"'):'<span class="bm-shop-action is-soon">'+(group==='mystery'?'나무 '+BM_MYSTERY_AT[id.slice(-1)]+'그루':'기록으로 열려요')+'</span>';
 return '<article class="bm-shop-card'+(ready?'':' is-soon')+'">'+(ready?button(bmTreeImg(id),'bmPreviewTree','bm-shop-art','data-species="'+id+'" aria-label="'+esc(bmTreeName(id))+' 살펴보기"'):'<div class="bm-shop-art">'+bmTreeImg(id)+'</div>')+'<div class="bm-shop-meta"><strong>'+esc(bmTreeName(id))+'</strong><small class="bm-shop-genre">'+esc(bmGenreLabel(id)||({base:'클래식',shop:'스페셜',mystery:'히든'}[group]))+'</small></div>'+action+'</article>';
}
// Shop = things you can buy. Genre trees are free and hidden trees are earned, so they live in the codex.
function bmShopTreesHTML(){
 const theme=BM_SALE_THEMES.find(t=>t.id===bmShopFilter),groups=(theme?[theme]:BM_SALE_THEMES).map(t=>({...t,ids:t.ids.filter(bmTreeReady)})).filter(t=>t.ids.length);
 const missing=BM_SHOP_IDS.filter(id=>bmTreeReady(id)&&!bmReadyTreeIds().includes(id)).length,note=BM_STORE_OPEN||!missing?'':'<div class="bm-store-note"><div><strong>스페셜 나무는 곧 살 수 있어요</strong><p>결제를 준비하고 있어요. 아직 없는 나무 '+missing+'종을 미리 구경해 보세요.</p></div></div>';
 const section=t=>{const owned=t.ids.filter(id=>bmReadyTreeIds().includes(id)).length;return '<div class="bm-shop-head"><h2>'+t.name+' 나무 '+t.ids.length+'종</h2>'+(owned?'<span>보유 '+owned+'종</span>':'')+'</div><div class="bm-shop-grid">'+t.ids.map(bmShopCard).join('')+'</div>'};
 return bmShopHeroHTML(theme?.pack)+(theme?'':note+bmWeeklyHTML())+groups.map(section).join('');
}
// Hero carousel: one big card per pack on sale (a first-purchase pack disappears after any paid purchase).
function bmPackWarning(id){const pk=BM_PACKS.map(x=>bmPackageInfo(state,x.id)).find(x=>x.ready&&x.untouched&&(x.ids.includes(id)||x.floorIds.includes(id)));return pk?'<p class="bm-money-note">이 '+(pk.floorIds.includes(id)?'바닥':'나무')+'를 열면 '+esc(pk.pack.name)+'는 사라져요.</p>':''}
// The pack's trees planted on its floor; used until the pack has its own baked image (pack.art).
function bmPackSceneArt(ids,floor){const s=Model.empty(),pick=ids.filter(bmTreeReady).slice(0,5);const items=pick.map((id,i)=>{const c=Model.add(s,{type:'book',title:bmTreeName(id),creator:''});Model.complete(s,c.id,'2026-01-0'+(i+1));c.speciesId=id;c.bmAppearance=true;c.bmAssignment={version:2,mode:'manual',pool:null,fallback:false,sequence:0};return c});
 return forestSVG(items,'basic',false,{grid:'month',minCols:3,transient:true,preview:true,floor}).replace(/viewBox="[^"]*"/,'viewBox="222 168 276 246" aria-hidden="true"').replace(/ role="group" aria-label="[^"]*"/,'')}
function bmShopHeroHTML(only){
 const packs=BM_PACKS.filter(p=>!only||p.id===only).map(p=>bmPackageInfo(state,p.id)).filter(p=>p.ready&&p.untouched&&(!BM_STORE_OPEN||p.canBuy));
 if(!packs.length)return '';
 const slide=p=>{const f=p.floorIds[0],trees=p.ids.slice(0,3);return '<article class="bm-hero'+(p.pack.tone?' is-'+p.pack.tone:'')+'">'+'<div class="bm-hero-copy"><span class="bm-hero-tag">'+'묶음 '+Math.round((1-p.pack.price/p.pack.list)*100)+'% 할인'+'</span><strong>'+esc(p.pack.name)+'</strong><small>나무 '+p.ids.length+'종 + '+esc(BM_FLOORS.find(x=>x.id===f)?.name||'')+' 바닥</small></div>'+
  '<div class="bm-hero-art" aria-hidden="true">'+(p.pack.art?'<img src="'+p.pack.art+'" alt="" decoding="async">':bmPackSceneArt(p.ids,f))+'</div>'+
  '<div class="bm-hero-price"><div><strong>'+bmKRW(p.pack.price)+'</strong><del>'+bmKRW(p.pack.list)+'</del></div>'+(BM_STORE_OPEN?button('구매하기','bmPackage','bm-hero-buy','data-pack="'+p.pack.id+'"'):'<span class="bm-hero-buy is-soon">곧 열려요</span>')+'</div>'+
  '<p class="bm-hero-fine">구성 나무가 하나도 없을 때만 살 수 있어요</p>'+'</article>'};
 return '<div class="bm-hero-track'+(packs.length>1?' is-multi':'')+'">'+packs.map(slide).join('')+'</div>';
}
// Weekly pick: a special tree from the genre you've finished most lately. Changes every Monday.
function bmWeekIndex(){const d=new Date();return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5+3)/7)}
function bmWeeklyPick(){
 const ready=BM_SHOP_IDS.filter(bmTreeReady),own=new Set(bmReadyTreeIds()),fresh=ready.filter(id=>!own.has(id)),pickFrom=fresh.length?fresh:ready,week=bmWeekIndex();
 if(!pickFrom.length)return null;
 const done=completedAll(),since=new Date(Date.now()-90*864e5).toISOString().slice(0,10),recent=done.filter(c=>String(c.completed)>=since),base=recent.length>=3?recent:done,count={};
 base.forEach(c=>{const p=bmPool(c);if(p)count[p]=(count[p]||0)+1});
 for(const [poolId] of Object.entries(count).sort((a,b)=>b[1]-a[1])){const pool=BM_POOLS.find(p=>p.id===poolId),cand=pool?.paid.filter(id=>pickFrom.includes(id))||[];if(cand.length&&!/other$/.test(poolId))return {id:cand[week%cand.length],reason:'요즘 '+pool.label+' '+(pool.type==='book'?'책을 많이 읽었네요':'영화를 많이 봤네요')}}
 return {id:pickFrom[week%pickFrom.length],reason:'그루가 고른 나무'};
}
function bmWeeklyHTML(){
 const pick=bmWeeklyPick();if(!pick||bmReadyTreeIds().includes(pick.id))return '';const id=pick.id,owned=bmReadyTreeIds().includes(id);
 const action=owned?'<span class="bm-shop-action is-owned">보유 중</span>':!BM_STORE_OPEN?'<span class="bm-shop-action is-soon">곧 열려요</span>':button('1,100원','bmQuickBuy','bm-shop-action','data-species="'+id+'" data-kind="tree" aria-label="'+esc(bmTreeName(id))+' 1,100원 구매 체험"');
 return '<div class="bm-shop-head"><h2>이번 주 추천</h2><span>월요일에 바뀌어요</span></div><article class="bm-weekly">'+button(bmTreeImg(id),'bmPreviewTree','bm-weekly-art','data-species="'+id+'" aria-label="'+esc(bmTreeName(id))+' 살펴보기"')+'<div class="bm-weekly-copy"><small>'+esc(pick.reason)+'</small><strong>'+esc(bmTreeName(id))+'</strong><span>'+esc(bmGenreLabel(id))+'</span></div>'+action+'</article>';
}
function bmCouponBoardHTML(){
 const q=bmCouponStatus(),have=Math.min(q.balance,q.cost),left=Math.max(0,q.cost-q.balance),target=BM_SALE_IDS.find(id=>!bmReadyTreeIds().includes(id))||'maple';
 const stamps=Array.from({length:q.cost},(_,i)=>i<have?'<span class="bm-stamp is-filled">'+BM_PAGE_ICONS.check+'</span>':i===q.cost-1?'<span class="bm-stamp is-goal">'+bmTreeImg(target)+'</span>':'<span class="bm-stamp">'+(i+1)+'</span>').join('');
 return '<div class="bm-coupon-board"><div class="bm-coupon-top"><div><span class="bm-pack-kicker">TREE COUPON</span><strong>'+have+' / '+q.cost+'장</strong><small>'+(left?left+'장 더 모으면 나무 1종':'나무 1종을 열 수 있어요')+'</small></div><span class="bm-coupon-today">오늘 '+q.watchedToday+' / '+q.dailyLimit+'회</span></div><div class="bm-stamps" role="img" aria-label="쿠폰 '+have+'장, 14장 중">'+stamps+'</div>'+
 button('<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="#FF6A55"/></svg>'+(q.watchedToday>=q.dailyLimit?'오늘 2장을 모두 모았어요':'광고 보고 쿠폰 받기'),'bmAdStart','bm-ad-button',q.watchedToday>=q.dailyLimit?'disabled':'')+'</div>'+
 (bmPendingProduct?button(bmTreeName(bmPendingProduct.id)+'로 돌아가기','bmReturnProduct','bm-coupon-return'):'')+
 '<ul class="bm-coupon-notes"><li>광고 1회에 쿠폰 1장, 하루 최대 2장이에요.</li><li>쿠폰 14장으로 스페셜 나무 1종을 영구로 열어요.</li><li>매일 모으면 7일에 한 그루씩 열 수 있어요.</li></ul>';
}
function bmShopChips(current){const chips=[['inventory','전체'],...BM_SALE_THEMES.filter(t=>t.ids.some(bmTreeReady)).map(t=>[t.id,t.name]),['floors','바닥']];return '<div class="bm-filter-chips bm-shop-chips" role="group" aria-label="상점 분류">'+chips.map(([id,label])=>button(label,'collectionTab',id===current?'active':'','data-tab="'+id+'" aria-pressed="'+(id===current)+'"')).join('')+'</div>'}
function renderShopPage(){
 bmRefresh(state);const tab=['floors',...(BM_STORE_OPEN?['coupons']:[])].includes(bmCollectionTab)?bmCollectionTab:'inventory';
 return '<section class="bm-page"><div class="bm-page-heading"><h1 class="page-title">상점</h1></div>'+bmShopChips(tab==='inventory'?(bmShopFilter==='all'?'inventory':bmShopFilter):tab)+
 (tab==='coupons'?bmCouponBoardHTML():tab==='floors'?'<p class="bm-page-note">'+(BM_STORE_OPEN?'기본 바닥은 무료 · 스페셜 바닥은 2,200원':'기본 바닥은 무료 · 스페셜 바닥은 곧 열려요')+'</p><div class="bm-floor-list">'+BM_FLOORS.map(bmFloorCard).join('')+'</div>':bmShopTreesHTML())+''+(BM_STORE_OPEN||tab!=='floors'?'':'')+'</section>';
}
function bmCodexTreeCard(id){
 const owned=id.startsWith('mystery-')?bmMysteries().find(t=>'mystery-'+t.id===id)?.unlocked:bmReadyTreeIds().includes(id),group=bmCatalogGroup(id);let note=bmGenreLabel(id)||'처음부터';
 if(group==='record'){const m=bmGrowthMilestones().find(t=>t.speciesId===id);note=owned?m.label:m.label+' · '+Math.max(0,m.target-m.progress)+' 남음'}
 else if(group==='shop')note=bmGenreLabel(id)||'스페셜';
 else if(group==='mystery'){const m=bmMysteries().find(t=>'mystery-'+t.id===id);note=owned?'열렸어요':bmMysteryCondition(m)+' · '+Math.min(m.progress,m.at)+'/'+m.at}
 return '<div class="bm-codex-tree'+(owned?'':' is-locked')+'">'+(bmTreeReady(id)?button(bmTreeImg(id,owned?'is-sticker':'',owned?'sticker':'thumb'),'bmPreviewTree','bm-codex-art','data-species="'+id+'" aria-label="'+esc(bmTreeName(id))+' 살펴보기"'):'<div class="bm-codex-art is-mystery"><span aria-hidden="true">?</span></div>')+(owned||!bmTreeReady(id)?'':'<span class="bm-codex-lock">'+BM_PAGE_ICONS.lock+'</span>')+'<strong>'+esc(bmTreeName(id))+'</strong><small>'+esc(note)+'</small></div>';
}
// Hidden trees' winter looks: open once the hidden tree is open and you have the snow floor. Never sold.
function bmWinterLooks(){const snow=bmFloorOwned('snow');return bmMysteries().filter(t=>t.ready).map(t=>({id:'winter'+(t.id==='A'?'shining':'moonlight'),name:t.id==='A'?'반짝이는 트리':'눈꽃 달빛나무',base:t,open:t.unlocked&&snow,note:t.unlocked&&snow?'겨울 숲에서':!t.unlocked?t.name+'를 열면':'겨울 숲 바닥이 있으면'}))}
function bmWinterLookCard(w){const src='./assets/images/trees/'+(w.open?'sticker':'thumb')+'/'+w.id+'.webp';return '<div class="bm-codex-tree'+(w.open?'':' is-locked')+'"><div class="bm-codex-art"><img class="bm-img'+(w.open?' is-sticker':'')+'" src="'+src+'" alt="" decoding="async" loading="lazy"></div>'+(w.open?'':'<span class="bm-codex-lock">'+BM_PAGE_ICONS.lock+'</span>')+'<strong>'+esc(w.name)+'</strong><small>'+esc(w.note)+'</small></div>'}
function renderCodexPage(){
 bmRefresh(state);const tab=bmCodexTab==='visitors'?'visitors':'trees';
 const head='<div class="bm-page-heading"><h1 class="page-title">도감</h1>'+bmPageTabs([['trees','나무'],['visitors','방문객']],tab,'bmCodexTab')+'</div>';
 if(tab==='visitors'){
  const seen=new Set(collectionState().visitorsSeen),done=completedAll().length,found=FOREST_VISITORS.filter(v=>seen.has(v.id)),next=FOREST_VISITORS.find(v=>!seen.has(v.id));
  const hero=found.at(-1)||FOREST_VISITORS[0];
  const card=v=>{const met=seen.has(v.id),near=!met&&v===next;return '<div class="bm-visitor'+(met?'':' is-locked')+'">'+'<i class="bm-visitor-art is-thumb" style="background-image:url(./assets/images/forest/'+(met?'sticker':'thumb')+'/visitor-'+v.id+'.webp)"></i>'+'<strong>'+esc(v.name)+'</strong><small>'+(met?'만났어요':(done>=v.need?'곧 찾아와요':near?'완료 '+(v.need-done)+'개 더':'완료 '+v.need+'개'))+'</small></div>'};
  return '<section class="bm-page">'+head+'<div class="bm-codex-hero is-visitors"><div><span>숲을 찾은 친구</span><strong>'+found.length+'<small>/'+FOREST_VISITORS.length+'</small></strong><p>작품을 완료할수록 새 친구가 와요.'+(next?'<br>다음은 '+esc(next.name)+' · '+(done>=next.need?'곧 찾아와요':(next.need-done)+'개 남음'):'')+'</p></div><span class="bm-codex-hero-art'+(found.length?'':' is-locked')+'"><i class="bm-visitor-art is-thumb" style="background-image:url(./assets/images/forest/thumb/visitor-'+hero.id+'.webp)"></i></span></div><div class="bm-visitor-grid">'+FOREST_VISITORS.map(card).join('')+'</div></section>';
 }
 const paid=BM_SHOP_IDS.filter(bmTreeReady),mysteries=bmMysteries().map(t=>'mystery-'+t.id),winterLooks=bmWinterLooks(),total=BM_GENRE_IDS.length+paid.length+mysteries.length+winterLooks.length,hidden=bmMysteries().filter(t=>t.unlocked).length+winterLooks.filter(w=>w.open).length,owned=[...BM_GENRE_IDS,...paid].filter(id=>bmReadyTreeIds().includes(id)),regular=owned.length;
 const count=g=>g.filter(id=>bmReadyTreeIds().includes(id)).length,latest=owned.at(-1)||'oak';
 const section=(title,sub,ids,mystery=false)=>'<section class="bm-codex-section"><div class="bm-shop-head"><div><h2>'+title+'</h2><p class="bm-codex-sub">'+sub+'</p></div><span>'+(mystery?bmMysteries().filter(t=>t.unlocked).length:count(ids))+' / '+ids.length+'</span></div><div class="bm-codex-grid">'+ids.map(bmCodexTreeCard).join('')+'</div></section>';
 return '<section class="bm-page">'+head+'<div class="bm-codex-hero"><div><span>모은 나무</span><strong>'+(regular+hidden)+'<small>/'+total+'종</small></strong><i class="bm-codex-bar"><b style="width:'+Math.round((regular+hidden)/total*100)+'%"></b></i></div><span class="bm-codex-hero-art">'+bmTreeImg(latest)+'</span></div>'+
 section('클래식 나무','책과 영화의 장르마다 한 그루씩, 처음부터 열려 있어요.',BM_GENRE_IDS)+section('히든 나무','나무를 심을수록 하나씩 열려요. 판매하지 않아요.',mysteries,true)+(winterLooks.length?'<section class="bm-codex-section"><div class="bm-shop-head"><div><h2>히든 나무 · 겨울 모습</h2><p class="bm-codex-sub">겨울 숲 바닥에서 바뀐 모습이에요.</p></div><span>'+winterLooks.filter(w=>w.open).length+' / '+winterLooks.length+'</span></div><div class="bm-codex-grid">'+winterLooks.map(bmWinterLookCard).join('')+'</div></section>':'')+BM_SALE_THEMES.map(t=>({...t,ids:t.ids.filter(bmTreeReady)})).filter(t=>t.ids.length).map(t=>section(t.name+' 나무',(t.id==='winter'?'겨울 숲과 어울리는 나무예요. ':'')+(BM_STORE_OPEN?'상점에서 열 수 있어요.':'상점에서 곧 열려요.'),t.ids)).join('')+'</section>';
}

// The finish date reads like the design ("10.07 오늘 ›"); the native date picker sits on top, invisible.
function finishDateLabel(date){return date.slice(5).replace('-','.')+(date===now()?' 오늘':'')}
document.addEventListener('input',e=>{if(e.target.id==='finishDate'&&Model.validDate(e.target.value)){const t=$('finishDateText');if(t)t.textContent=finishDateLabel(e.target.value)+' ›'}if(e.target.id==='notificationTime'){const t=$('notificationTimeText');if(t)t.textContent=e.target.value}});
