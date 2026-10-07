/* original script block 5 */
/* iOS Safari는 요소에 touch 이벤트 리스너가 연결돼 있어야 :active 상태(눌림 효과)를 인식합니다.
   버튼 등에 별도 touch 핸들러가 없으면 :active CSS가 있어도 모바일에서 눌림 반응이 전혀 보이지 않기 때문에,
   문서 전체에 빈 touchstart 리스너를 하나 달아 :active 인식을 활성화합니다. */
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
// Songlim launch-flow preview. This module has no network, advertisement, or payment operations.
// Production entitlements must be issued and verified by a server before release.
const BM_CONFIG=Object.freeze({mode:'preview',future:Object.freeze({regularTrees:26,mysteryTrees:4,totalTrees:30,paidFloorCount:3,treePriceKRW:1100,floorPriceKRW:2200,packagePriceKRW:9900,packageTreeCount:10,rewardedViewsPerDay:2,viewsPerCoupon:12,couponCostPerTree:1,collectionMysteryAt:20,cashMysteryAt:10})});
const BM_FLOORS=[{id:'basic',name:'기본 바닥',ready:true,free:true},{id:'meadow',name:'꽃이끼 정원',ready:true,free:false},{id:'floor-reserved-01',name:'새 바닥',ready:false,free:false},{id:'floor-reserved-02',name:'새 바닥',ready:false,free:false}];
const BM_BASE_IDS=['oak','birch','fir'];
const BM_RECORD_IDS=['zelkova','ginkgo','metasequoia','yew','cedar','evergreen','cypress'];
const BM_EXISTING_SHOP_IDS=['cherry','maple','magnolia','crape','fringe','hackberry','willow','pine','juniper','paulownia'];
const BM_RESERVED_IDS=Array.from({length:6},(_,i)=>'paid-reserved-'+String(i+1).padStart(2,'0'));
const BM_SHOP_IDS=[...BM_EXISTING_SHOP_IDS,...BM_RESERVED_IDS];
const BM_READY_IDS=[...BM_BASE_IDS,...BM_RECORD_IDS,...BM_EXISTING_SHOP_IDS];
const BM_SOURCE_KINDS=['base','growth','cash','coupon','legacy','beta'];
const BM_POOLS=[
 {id:'book-literature',type:'book',label:'순문학',free:'zelkova',paid:['cherry','magnolia']},
 {id:'book-genre',type:'book',label:'장르문학',free:'metasequoia',paid:['maple','willow']},
 {id:'book-humanities',type:'book',label:'인문',free:'ginkgo',paid:['pine','juniper']},
 {id:'book-science',type:'book',label:'과학',free:'cedar',paid:['paulownia','paid-reserved-01']},
 {id:'book-other',type:'book',label:'기타',free:'oak',paid:['paid-reserved-03']},
 {id:'movie-drama',type:'movie',label:'드라마',free:'evergreen',paid:['hackberry','fringe']},
 {id:'movie-action',type:'movie',label:'액션·스릴러',free:'yew',paid:['paid-reserved-04']},
 {id:'movie-sf',type:'movie',label:'SF·판타지',free:'cypress',paid:['paid-reserved-05']},
 {id:'movie-comedy',type:'movie',label:'로맨스·코미디',free:'fir',paid:['crape','paid-reserved-02']},
 {id:'movie-other',type:'movie',label:'기타',free:'birch',paid:['paid-reserved-06']}
];
const BM_GROWTH_RULES=[
 {id:'first-record',speciesId:'zelkova',label:'첫 기록 남기기',target:1,metric:'record'},
 {id:'first-completion',speciesId:'ginkgo',label:'첫 작품 완료하기',target:1,metric:'completed'},
 {id:'three-completions',speciesId:'metasequoia',label:'작품 3개 완료하기',target:3,metric:'completed'},
 {id:'book-and-movie',speciesId:'yew',label:'책과 영화 각각 1개 완료하기',target:2,metric:'media'},
 {id:'thirty-record-days',speciesId:'cedar',label:'서로 다른 30일에 기록 남기기',target:30,metric:'days'},
 {id:'ten-completions',speciesId:'evergreen',label:'작품 10개 완료하기',target:10,metric:'completed'},
 {id:'twenty-completions',speciesId:'cypress',label:'작품 20개 완료하기',target:20,metric:'completed'}
];
function bmFresh(){return {version:2,previewVersion:1,completedKeys:[],recordDays:[],hasRecorded:false,earnedTreeIds:[],legacyTreeIds:[],legacyMysteryIds:[],ownership:{},floorOwnership:{},previewOwnership:{},previewFloorOwnership:{},previewCouponViews:{},previewCouponSpent:0,nextByPool:{},floor:'basic'}}
function bmNorm(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'')}
function bmCompletionKey(c){return [c.type,bmNorm(c.title),bmNorm(c.creator)].join('|')}
function bmValidDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
function bmTracked(c){return !!c&&['book','movie'].includes(c.type)}
function bmKnownRegular(id){return BM_READY_IDS.includes(id)||BM_RESERVED_IDS.includes(id)}
function bmTreeReady(id){return BM_READY_IDS.includes(id)||id==='mystery-A'||id==='mystery-B'}
function bmCatalogGroup(id){return BM_BASE_IDS.includes(id)?'base':BM_RECORD_IDS.includes(id)?'record':BM_SHOP_IDS.includes(id)?'shop':'mystery'}
function bmAddSource(target,id,kind){if(!BM_SOURCE_KINDS.includes(kind))return false;const before=Array.isArray(target[id])?target[id]:[];if(before.includes(kind))return false;target[id]=[...before,kind];return true}
function bmRealSources(b,id,floor=false){const kinds=(floor?b.floorOwnership:b.ownership)?.[id];return Array.isArray(kinds)?kinds.filter(k=>BM_SOURCE_KINDS.includes(k)&&k!=='beta'):[]}
function bmPreviewSources(b,id,floor=false){if(BM_CONFIG.mode!=='preview')return [];const kinds=(floor?b.previewFloorOwnership:b.previewOwnership)?.[id];return Array.isArray(kinds)?kinds.filter(k=>k==='cash'||!floor&&k==='coupon'):[]}
function bmOwnedFrom(b){return [...new Set([...BM_BASE_IDS,...Object.keys(b.ownership||{}).filter(id=>bmKnownRegular(id)&&bmRealSources(b,id).length),...Object.keys(b.previewOwnership||{}).filter(id=>bmTreeReady(id)&&BM_SHOP_IDS.includes(id)&&bmPreviewSources(b,id).length)])]}
function bmCashOwnedFrom(b,id){return bmRealSources(b,id).includes('cash')||bmPreviewSources(b,id).includes('cash')}
function bmCashCountFrom(b){return BM_SHOP_IDS.filter(id=>bmCashOwnedFrom(b,id)).length}
function bmRegularCountFrom(b){return bmOwnedFrom(b).length}
function bmMysteryAvailableFrom(b,kind){if(!['A','B','C','D'].includes(kind))return false;if(b.legacyMysteryIds?.includes(kind))return true;return kind==='A'||kind==='B'?bmRegularCountFrom(b)>=BM_CONFIG.future.collectionMysteryAt:bmCashCountFrom(b)>=BM_CONFIG.future.cashMysteryAt}
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
function bmAvailablePool(c,s=state){const b=s.collection?.bm||bmRefresh(s),p=BM_POOLS.find(p=>p.id===bmPool(c));return p?[p.free,...p.paid].filter(id=>bmTreeReady(id)&&bmCanUseFrom(b,id)):[]}
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
  b.ownership=sourceMap(raw.ownership,id=>regular.has(id));b.floorOwnership=sourceMap(raw.floorOwnership,id=>id==='meadow');
  b.previewOwnership=sourceMap(raw.previewOwnership,id=>BM_EXISTING_SHOP_IDS.includes(id));b.previewFloorOwnership=sourceMap(raw.previewFloorOwnership,id=>id==='meadow');
  for(const [id,kinds] of Object.entries(b.previewOwnership)){const good=kinds.filter(k=>k==='cash'||k==='coupon');if(good.length)b.previewOwnership[id]=good;else delete b.previewOwnership[id]}
  for(const [id,kinds] of Object.entries(b.previewFloorOwnership)){if(kinds.includes('cash'))b.previewFloorOwnership[id]=['cash'];else delete b.previewFloorOwnership[id]}
  if(raw.previewCouponViews&&typeof raw.previewCouponViews==='object'&&!Array.isArray(raw.previewCouponViews))for(const [date,n] of Object.entries(raw.previewCouponViews))if(bmValidDate(date)&&Number.isSafeInteger(n)&&n>0)b.previewCouponViews[date]=Math.min(n,BM_CONFIG.future.rewardedViewsPerDay);
  const earned=Math.floor(Object.values(b.previewCouponViews).reduce((sum,n)=>sum+n,0)/BM_CONFIG.future.viewsPerCoupon);
  let couponOwned=0;for(const id of BM_EXISTING_SHOP_IDS)if(b.previewOwnership[id]?.includes('coupon')){if(couponOwned<earned)couponOwned++;else{b.previewOwnership[id]=b.previewOwnership[id].filter(k=>k!=='coupon');if(!b.previewOwnership[id].length)delete b.previewOwnership[id]}}
  b.previewCouponSpent=Math.max(couponOwned,Number.isSafeInteger(raw.previewCouponSpent)&&raw.previewCouponSpent>=0?Math.min(raw.previewCouponSpent,earned):0);
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
 b.floor=raw?.floor==='meadow'&&bmFloorOwnedFrom(b,'meadow')?'meadow':'basic';
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
 if(s.collection.bm?.version!==2||s.collection.bm?.previewVersion!==1)s.collection.bm=bmSanitize(s.collection.bm,s.items||[]);
 const b=s.collection.bm;bmSyncLedger(b,s.items||[]);
 for(const c of s.items||[]){if(!bmTracked(c))continue;
  if(typeof launchGenre==='function'&&!GENRE_POOL[c.type]?.includes(c.genre)){if(!c.rawGenre)c.rawGenre=c.genre||'';c.genre=launchGenre(c.type,c.genre,c)}
  if(!c.bmAssignment&&BM_READY_IDS.includes(c.speciesId)){c.bmAssignment={version:2,mode:'legacy',pool:bmPool(c),fallback:false,sequence:0};bmAddSource(b.ownership,c.speciesId,'legacy')}
  const a=c.bmAssignment;
  if(!a||!bmTreeReady(c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId)||(a.mode==='auto'&&(!bmCanUseFrom(b,c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId)||a.pool!==bmPool(c)||a.fallback&&bmAvailablePool(c,s).length)))bmAssignItem(s,c,true);
 }
 return b;
}
function bmState(){const b=state.collection?.bm;return b?.version===2&&b.previewVersion===1&&b.ownership?.oak?b:bmRefresh(state)}
function bmOwnedTreeIds(){return bmOwnedFrom(bmState())}
function bmRecordProgress(){return bmState().completedKeys.length}
function bmCashTreeCount(){return bmCashCountFrom(bmState())}
function bmGrowthMilestones(s=state){return bmGrowthFrom(bmRefresh(s))}
function bmMysteries(){const b=bmState();return [{id:'A',name:'반짝이는 나무',at:20,metric:'regular',ready:true},{id:'B',name:'달빛나무',at:20,metric:'regular',ready:true},{id:'C',name:'미스터리 나무',at:10,metric:'cash',ready:false},{id:'D',name:'미스터리 나무',at:10,metric:'cash',ready:false}].map(t=>({...t,progress:t.metric==='cash'?bmCashCountFrom(b):bmRegularCountFrom(b),unlocked:bmMysteryAvailableFrom(b,t.id)}))}
function bmAutoSpecies(c,s=state){const pool=bmAvailablePool(c,s),b=s.collection?.bm,sequence=c.bmAssignment?.sequence??b?.nextByPool?.[bmPool(c)]??0;return pool.length?pool[sequence%pool.length]:bmFallback(c)}
function bmAssignItem(s,c,force=false){
 if(!bmTracked(c))return c;
 const b=s.collection?.bm?.version===2?s.collection.bm:bmRefresh(s);
 if(['manual','legacy'].includes(c.bmAssignment?.mode)&&bmTreeReady(c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId))return c;
 if(!force&&c.bmAssignment&&bmTreeReady(c.hiddenTree?'mystery-'+c.hiddenTree:c.speciesId))return c;
 const pool=bmPool(c),available=bmAvailablePool(c,s),sequence=b.nextByPool[pool]||0;
 c.speciesId=available.length?available[sequence%available.length]:bmFallback(c);c.hiddenTree=null;c.bmAppearance=true;
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
function bmFloorOwnedFrom(b,id){return id==='basic'||id==='meadow'&&!!(bmRealSources(b,id,true).length||bmPreviewSources(b,id,true).length)}
function bmFloorOwned(id){return bmFloorOwnedFrom(bmState(),id)}
function bmFloorId(){const b=bmState();return bmFloorOwnedFrom(b,b.floor)?b.floor:'basic'}
function bmSetFloor(id){if(!bmFloorOwned(id))return false;bmState().floor=id;return true}
function bmCouponStatus(s=state,date=now()){
 const b=bmRefresh(s),totalViews=Object.values(b.previewCouponViews).reduce((sum,n)=>sum+n,0),required=BM_CONFIG.future.viewsPerCoupon;
 return {watchedToday:bmValidDate(date)?b.previewCouponViews[date]||0:0,dailyLimit:BM_CONFIG.future.rewardedViewsPerDay,progress:totalViews%required,required,balance:Math.max(0,Math.floor(totalViews/required)-b.previewCouponSpent),totalViews};
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
function bmPackageInfo(s=state){
 const b=bmRefresh(s),ids=[...BM_EXISTING_SHOP_IDS],floorId='meadow',owned=new Set(bmOwnedFrom(b));
 const newTreeIds=ids.filter(id=>!owned.has(id)),duplicateTreeIds=ids.filter(id=>owned.has(id)),newCashTreeIds=ids.filter(id=>!bmCashOwnedFrom(b,id));
 const couponDuplicateIds=duplicateTreeIds.filter(id=>bmRealSources(b,id).includes('coupon')||bmPreviewSources(b,id).includes('coupon')),floorNew=!bmFloorOwnedFrom(b,floorId);
 return {ids,floorId,newTreeIds,newTreeCount:newTreeIds.length,duplicateTreeIds,couponDuplicateIds,newCashTreeIds,newCashTreeCount:newCashTreeIds.length,floorNew,canBuy:BM_CONFIG.mode==='preview'&&(newCashTreeIds.length>0||floorNew)};
}
function bmPreviewBuyPackage(s=state){
 if(BM_CONFIG.mode!=='preview')return {ok:false,reason:'mode-disabled'};
 const info=bmPackageInfo(s);if(!info.canBuy)return {ok:false,reason:'nothing-new'};
 const b=s.collection.bm;for(const id of info.newCashTreeIds)bmAddSource(b.previewOwnership,id,'cash');if(info.floorNew)bmAddSource(b.previewFloorOwnership,info.floorId,'cash');bmRefresh(s);
 return {ok:true,reason:'',newTreeCount:info.newTreeCount,newCashTreeCount:info.newCashTreeCount,floorNew:info.floorNew};
}
// Compatibility helpers are beta-only and never create cash/coupon provenance.
function bmDemoUnlockTree(id){if(BM_CONFIG.mode!=='beta'||!BM_READY_IDS.includes(id))return false;bmAddSource(bmState().ownership,id,'beta');return true}
function bmDemoUnlockFloor(id){if(BM_CONFIG.mode!=='beta'||id!=='meadow')return false;bmAddSource(bmState().floorOwnership,id,'beta');return true}

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
function experiencedGenresForCategory(categoryId){const counts=new Map();state.items.filter(c=>c.completed&&category(c).id===categoryId).forEach(c=>{const g=String(c.genre||'').trim();if(g)counts.set(g,(counts.get(g)||0)+1)});return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([g])=>g)}
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
function detailMetadata(c){
 const top=c.genre?esc(c.genre.replace(/_/g,' · ')):'';
 const tree='';
 const meta=[];
 if(c.type==='movie'&&c.releaseDate)meta.push('개봉일 '+esc(c.releaseDate.slice(0,10)));
 if(c.type==='album'&&c.releaseDate)meta.push('발매일 '+esc(c.releaseDate.slice(0,10)));
 if(c.type==='book'&&c.publishedAt)meta.push('발매일 '+esc(c.publishedAt.slice(0,10)));
 if(c.runtime)meta.push('러닝타임 '+esc(c.runtime)+'분');
 if(c.trackCount)meta.push('곡 수 '+esc(c.trackCount)+'곡');
 if(c.length&&c.type==='book')meta.push('페이지 '+esc(c.length)+'쪽');
 const idLine=[];
 if(c.providerId)idLine.push('ID '+esc(c.providerId));
 else if(c.type==='book'&&c.isbn)idLine.push('ISBN '+esc(c.isbn));
 if(Array.isArray(c.saves))idLine.push('스크랩 '+c.saves.length+'회');
 if(idLine.length)meta.push(idLine.join(' · '));
 return '<div class="detail-metrics compact-meta"><div><div class="content-meta-head"><strong>'+top+'</strong>'+tree+'</div><div class="content-meta-line">'+meta.map(m=>'<div>'+m+'</div>').join('')+'</div></div>'+(c.completed?'<div class="current-tree"><small>현재 나무</small><strong>'+esc(c.hiddenTree?bmTreeName('mystery-'+c.hiddenTree):contentSpecies(c)?.name||'나무')+'</strong></div>':'')+'</div>'
}
function recentCompleted(){
 const items=state.items.filter(c=>c.completed).sort((a,b)=>(b.completed==='unknown'?'':b.completed).localeCompare(a.completed==='unknown'?'':a.completed)||(b.completedAt||0)-(a.completedAt||0)||b.id.localeCompare(a.id)).slice(0,2);
 if(!items.length)return '';
 return '<section class="recent-completed"><div class="row between"><h3>최근 완료</h3>'+button('나의 숲 <span aria-hidden="true">›</span>','tab','textbtn','data-tab="forest"')+'</div><div class="stack">'+items.map(c=>'<button class="content-row" data-type="'+c.type+'" data-action="detail" '+attr(c.id)+'>'+cover(c)+'<div class="grow"><span class="badge">'+typeName[c.type]+'</span><div class="title">'+esc(c.title)+'</div><small>'+(c.completed==='unknown'?'완료일 미상':esc(c.completed.replaceAll('-','.')))+(c.rating?' · <span class="rating-star" aria-hidden="true">★</span> '+c.rating:'')+'</small></div><span class="muted" aria-hidden="true">›</span></button>').join('')+'</div></section>';
}
function renderToday(){return renderTodayBase()+recentCompleted()}
function averageStars(value){
 const score=Math.max(0,Math.min(5,Number(value)||0));
 return '<span class="average-stars" role="img" aria-label="5점 만점에 '+score.toFixed(1)+'점">'+Array.from({length:5},(_,i)=>'<span class="average-star" aria-hidden="true"><span class="star-empty">★</span><span class="star-fill" style="width:'+Math.max(0,Math.min(100,(score-i)*100))+'%">★</span></span>').join('')+'</span>';
}
// Count the selected year's completed works once each, using their saved primary genre.
// Candidate genres and tree choices describe different things and never add votes.
function forestGenreLabel(c){return launchGenre(c.type,c.genre,c)}
function forestGenreStats(items){
 const completed=items.filter(c=>c.completed),counts=new Map();let classified=0;
 for(const c of completed){
  const label=forestGenreLabel(c);if(!label)continue;classified++;
  const key=Model.norm(label),entry=counts.get(key);
  const latest=c.completed==='unknown'?'':c.completed,latestAt=Number(c.completedAt)||0;
  if(entry){entry.count++;if(latest>entry.latest||(latest===entry.latest&&latestAt>entry.latestAt)){entry.latest=latest;entry.latestAt=latestAt}}
  else counts.set(key,{label,count:1,latest,latestAt});
 }
 const ranked=[...counts.values()].sort((a,b)=>b.count-a.count||b.latest.localeCompare(a.latest)||b.latestAt-a.latestAt||a.label.localeCompare(b.label,'ko'));
 const count=ranked[0]?.count||0,top=ranked.slice(0,1);
 return {total:completed.length,classified,unclassified:completed.length-classified,ranked,top,count};
}
function forestSummary(items){
 const genres=forestGenreStats(items),rated=items.filter(c=>c.completed&&validRating(c.rating));
 const names=genres.top.map(entry=>entry.label),fullName=names.join(' · ');
 const headline=names.length?names.slice(0,2).join(' · ')+(names.length>2?' 외 '+(names.length-2):''):'—';
 const countLabel=names.length?(names.length>1?'각 ':'')+genres.count+'개':'';
 const average=rated.length?(rated.reduce((n,c)=>n+Number(c.rating),0)/rated.length).toFixed(1):null;
 return '<div class="forest-summary"><div><small>많이 본 장르</small><div class="forest-summary-value"><h3 title="'+esc(fullName)+'">'+esc(headline)+'</h3>'+(countLabel?'<small class="forest-summary-count">'+esc(countLabel)+'</small>':'')+'</div></div><div><small>평균 별점</small><div class="average-score">'+(average?'<span aria-hidden="true">★</span>'+average+'<small>/ 5</small>':'—')+'</div></div></div>';
}
function collectionState(){if(!state.collection||typeof state.collection!=='object')state.collection={treeChoices:{},disabledSpeciesIds:[],visitorsSeen:[]};if(!state.collection.treeChoices)state.collection.treeChoices={};if(!Array.isArray(state.collection.disabledSpeciesIds))state.collection.disabledSpeciesIds=[];if(!Array.isArray(state.collection.visitorsSeen))state.collection.visitorsSeen=[];return state.collection}
function completedAll(){return state.items.filter(c=>c.completed)}
function speciesForCategory(categoryId){return TREE_SPECIES.filter(t=>t.category===categoryId)}
function speciesUnlocked(species){return !!species&&bmOwnedTreeIds().includes(species.id)}
function autoSpecies(c){return TREE_SPECIES.find(t=>t.id===bmAutoSpecies(c))||TREE_SPECIES[0]}
function contentSpecies(c){return TREE_SPECIES.find(t=>t.id===c?.speciesId)||autoSpecies(c)}
function assignAutoSpecies(c,force=false){if(!c)return false;const before=JSON.stringify([c.speciesId,c.hiddenTree,c.bmAssignment]);bmRefresh(state);bmAssignItem(state,c);return before!==JSON.stringify([c.speciesId,c.hiddenTree,c.bmAssignment])}
function ensureCompletedSpeciesAssignments(){const before=JSON.stringify(state.items.map(c=>[c.speciesId,c.hiddenTree,c.bmAssignment]));bmRefresh(state);return before!==JSON.stringify(state.items.map(c=>[c.speciesId,c.hiddenTree,c.bmAssignment]))}
function remapDefaultSpeciesByCategory(){return false}
function collectionCounts(){const trees=bmOwnedTreeIds().length,seen=new Set(collectionState().visitorsSeen);return {trees,totalTrees:26,visitors:FOREST_VISITORS.filter(v=>seen.has(v.id)).length,totalVisitors:FOREST_VISITORS.length}}
function currentCollectionTheme(){return 'basic'}
function hiddenVisuals(theme=currentCollectionTheme()){
 const snow=theme==='snow'||theme==='winter';
 return snow?[{id:'A',name:'트리',desc:'설산의 특별한 나무'},{id:'B',name:'얼음나무',desc:'빛을 머금은 결정 나무'}]:[{id:'A',name:'반짝이는 나무',desc:'작은 빛이 맺힌 특별한 나무'},{id:'B',name:'달빛나무',desc:'층진 초록 수관에 은·금빛이 맺힌 나무'}];
}
function previewSpeciesArt(speciesId,theme='basic'){
 const key=((theme==='snow'||theme==='winter')?'winter':'')+speciesId,b=(SONGLIM_TREE_ASSETS[key]||SONGLIM_TREE_ASSETS.birch).bounds;
 return '<g transform="translate('+(-(b.x+b.width/2)).toFixed(3)+' 0)">'+speciesArt(speciesId,theme)+'</g>';
}
function collectionRepresentatives(){
 const found=TREE_SPECIES.filter(speciesUnlocked),known=new Set(found.map(t=>t.id));
 const recent=[...completedAll()].sort((a,b)=>(b.completedAt||0)-(a.completedAt||0)).map(contentSpecies).filter(t=>t&&known.has(t.id));
 return [...new Map([...recent,...found].map(t=>[t.id,t])).values()];
}
let collectionTab='inventory';
function visitorCollectionHTML(){const seen=new Set(collectionState().visitorsSeen),counts=collectionCounts();return '<div class="collection-progress"><strong>'+counts.visitors+' / '+counts.totalVisitors+'종</strong><small>만난 방문객</small></div><div class="visitor-grid">'+FOREST_VISITORS.map(v=>{const found=seen.has(v.id);return '<div class="visitor-card '+(found?'':'locked')+'"><div class="visitor-art">'+(found?'<svg viewBox="-36 -44 72 60" aria-hidden="true">'+visitorArt(v.id)+'</svg>':'●')+'</div><strong>'+(found?esc(v.name):'???')+'</strong><small>'+(found?'만난 방문객':'아직 만나지 못했어요')+'</small></div>'}).join('')+'</div><div class="visitor-hint">숲에서 만난 방문객은 도감에 기록돼요.</div>'}
let bmCollectionTab='inventory',bmPreview=null,bmCodexTab='trees',bmSelectedWork='',bmTreeFilter='shop',bmCheckout=null,bmPendingProduct=null;
const BM_NAMES={base:'기본 나무',record:'성장 나무',shop:'유료 나무',mystery:'히든 나무'};
const BM_FLOOR_NAMES={basic:'기본 바닥',meadow:'꽃이끼 정원'};
const bmKRW=n=>n.toLocaleString('ko-KR')+'원';
function bmTreeName(id){return id.startsWith('mystery-')?bmMysteries().find(t=>t.id===id.slice(-1))?.name||'히든 나무':TREE_SPECIES.find(t=>t.id===id)?.name||'새 나무 '+String(BM_RESERVED_IDS.indexOf(id)+1)}
function bmPlaceholder(label='디자인 준비 중'){return '<div class="bm-placeholder" aria-label="'+esc(label)+'"><span aria-hidden="true">✧</span><small>'+esc(label)+'</small></div>'}
function bmTreeSVG(id){if(!bmTreeReady(id))return bmPlaceholder();const special=id.startsWith('mystery-'),key=special?(id==='mystery-A'?'shining':'moonlight'):id,b=SONGLIM_TREE_ASSETS[key]?.bounds;if(!b)return bmPlaceholder();const w=Math.max(94,b.width+12);return '<svg viewBox="'+[-w/2,b.y-7,w,b.height+15].join(' ')+'" aria-hidden="true">'+(special?hiddenTreeArt(id.slice(-1),'basic'):previewSpeciesArt(id,'basic'))+'</svg>'}
function bmReadyTreeIds(){return [...bmOwnedTreeIds().filter(bmTreeReady),...bmMysteries().filter(t=>t.ready&&t.unlocked).map(t=>'mystery-'+t.id)]}
function bmWorkItems(){return state.items.filter(c=>['book','movie'].includes(c.type)).sort((a,b)=>Number(Model.stage(b)>0)-Number(Model.stage(a)>0)||(b.saves.at(-1)?.at||0)-(a.saves.at(-1)?.at||0))}
function bmWork(){const items=bmWorkItems();return items.find(c=>c.id===bmSelectedWork)||items[0]||null}
function bmNotice(){return '<p class="bm-preview-notice">출시형 체험 · 실제 결제나 광고 없이 해금 흐름을 확인해요.</p>'}
function bmBadge(group){return '<span class="bm-badge '+(group==='shop'?'paid':group==='mystery'?'hidden':'free')+'">'+(group==='shop'?'유료':group==='mystery'?'조건 해금':'무료')+'</span>'}
function bmTreeStatus(id){const b=bmState(),real=b.ownership?.[id]||[],demo=b.previewOwnership?.[id]||[];if(real.includes('cash')||demo.includes('cash'))return '구매로 해금';if(real.includes('coupon')||demo.includes('coupon'))return '쿠폰으로 해금';if(real.includes('legacy'))return '기존 보유';return '해금 완료'}
function bmMysteryCondition(t){return t.id==='A'||t.id==='B'?'일반 나무 20종 해금':'현금으로 나무 10종 구매'}
function bmConditionHTML(id){const group=bmCatalogGroup(id);if(group==='record'){const m=bmGrowthMilestones().find(t=>t.speciesId===id);return '<div class="bm-condition"><p>'+esc(m.label)+' · '+m.progress+'/'+m.target+'</p><progress max="'+m.target+'" value="'+m.progress+'" aria-label="'+esc(m.label)+'"></progress></div>'}if(group==='mystery'){const m=bmMysteries().find(t=>t.id===id.slice(-1));return '<div class="bm-condition"><p>'+bmMysteryCondition(m)+' · '+Math.min(m.at,m.progress)+'/'+m.at+'</p><progress max="'+m.at+'" value="'+Math.min(m.at,m.progress)+'" aria-label="'+bmMysteryCondition(m)+'"></progress></div>'}return '<p>'+(group==='base'?'처음부터 함께해요':'광고 쿠폰 1장 또는 '+bmKRW(1100))+'</p>'}
function bmTreeCard(id,readOnly=false){const group=bmCatalogGroup(id),owned=bmReadyTreeIds().includes(id),ready=bmTreeReady(id),c=null,selected=owned&&!!c&&(c.hiddenTree?'mystery-'+c.hiddenTree:contentSpecies(c).id)===id;const attrs='data-species="'+id+'" '+(c?'data-id="'+c.id+'"':'');const art=ready?button(bmTreeSVG(id),'bmPreviewTree','bm-tree-art',attrs+' aria-label="'+esc(bmTreeName(id))+' 미리보기"'):bmPlaceholder();let action='';if(ready&&group==='shop'&&!owned&&!readOnly)action=button('1,100원','bmQuickBuy','bm-card-buy',attrs+' data-kind="tree" aria-label="'+esc(bmTreeName(id))+' 1,100원 구매 체험"');else if(ready&&owned&&!readOnly)action=button('보유 중','bmPreviewTree','bm-card-buy',attrs);return '<article class="bm-tree-card '+(!owned?'is-locked ':'')+(selected?'bm-selected':'')+'">'+art+'<div class="bm-card-meta"><header><h3>'+esc(bmTreeName(id))+'</h3>'+bmBadge(group)+'</header>'+(group==='shop'?'<p>'+(owned?bmTreeStatus(id):'쿠폰 1장으로도 해금')+'</p>':bmConditionHTML(id))+(!ready?'<div class="bm-card-status">디자인 준비 중</div>':group!=='shop'?'<div class="bm-card-status">'+(owned?'해금 완료':'아직 잠겨 있어요')+'</div>':'')+action+'</div></article>'}
function bmEconomySummary(){return '<div class="bm-economy-summary" aria-label="전체 나무 30종"><div><b>무료 10종</b><span>기본 3 · 성장 7</span></div><div><b>유료 16종</b><span>쿠폰 또는 구매</span></div><div><b>히든 4종</b><span>조건 달성 · 판매 안 함</span></div></div>'}
function bmCouponPanel(compact=false){const q=bmCouponStatus();return '<section class="bm-coupon-panel '+(compact?'is-compact':'')+'" aria-label="광고 쿠폰"><div class="bm-panel-head"><strong>나무 쿠폰 '+q.balance+'장</strong><span>오늘 '+q.watchedToday+'/'+q.dailyLimit+'회</span></div><p>광고 12회마다 쿠폰 1장 · 유료 나무 1종</p><progress max="12" value="'+q.progress+'" aria-label="다음 쿠폰까지 광고 시청 '+q.progress+'회, 총 12회"></progress><div class="bm-coupon-detail"><span>다음 쿠폰 '+q.progress+'/12</span><span>'+ (12-q.progress)+'회 남음</span></div>'+button(compact?'쿠폰 모으기':q.watchedToday>=q.dailyLimit?'오늘 2회를 모두 모았어요':'광고 시청 체험하기',compact?'bmCoupons':'bmAdStart','secondary',!compact&&q.watchedToday>=q.dailyLimit?'disabled':'')+'</section>'}
function bmPackageBanner(){const pack=bmPackageInfo();return '<section class="bm-feature" aria-label="첫 숲 패키지"><div class="bm-feature-art" aria-hidden="true">'+['cherry','magnolia','juniper','maple'].map(bmTreeSVG).join('')+'</div><div class="bm-feature-copy"><div><h3>첫 숲 패키지</h3><p>나무 10종 + 꽃이끼 바닥</p><small>단품 합 <del>13,200원</del></small></div>'+button(pack.canBuy?'9,900원':'보유 중','bmPackage','bm-feature-price',pack.canBuy?'aria-label="첫 숲 패키지 9,900원 구매 체험"':'disabled')+'</div></section>'}
function bmWorkSelect(){const items=bmWorkItems(),c=bmWork();if(c)bmSelectedWork=c.id;return c?'<div class="bm-work-select"><label for="bmWorkSelect">모습을 바꿀 작품</label><select id="bmWorkSelect">'+items.map(x=>'<option value="'+esc(x.id)+'" '+(c.id===x.id?'selected':'')+'>'+esc(x.title)+' · '+(['씨앗','새싹','어린 나무','나무'][Model.stage(x)])+'</option>').join('')+'</select></div>':'<p class="bm-subtitle">작품을 담으면 해금한 나무로 꾸밀 수 있어요.</p>'}
function bmInventoryHTML(){const ownedView=bmTreeFilter==='owned',c=null,groups=[['base',BM_BASE_IDS],['record',BM_RECORD_IDS],['shop',BM_SHOP_IDS],['mystery',bmMysteries().map(t=>'mystery-'+t.id)]];return (bmTreeFilter==='shop'?bmPackageBanner():'')+'<div class="bm-filters" role="group" aria-label="나무 구분">'+[['shop','유료 16'],['free','무료 10'],['mystery','히든 4'],['owned','보유'],['all','전체 30']].map(([key,label])=>button(label,'bmTreeFilter',bmTreeFilter===key?'active':'','data-filter="'+key+'" aria-pressed="'+(bmTreeFilter===key)+'"')).join('')+'</div>'+groups.map(([group,ids])=>{if(bmTreeFilter==='free'&&!['base','record'].includes(group)||['shop','mystery'].includes(bmTreeFilter)&&bmTreeFilter!==group)return '';const visible=ownedView?ids.filter(id=>bmReadyTreeIds().includes(id)):ids;if(!visible.length)return '';return '<section class="bm-group"><div class="bm-section-head"><h3>'+BM_NAMES[group]+'</h3><span>'+visible.length+'종</span></div>'+(group==='shop'?'<p class="bm-subtitle">구매하거나 쿠폰으로 열어요 · 6종은 준비 중</p>':'')+'<div class="bm-tree-grid">'+visible.map(id=>bmTreeCard(id)).join('')+'</div></section>'}).join('')+(c?button('장르에 맞춰 자동으로 고르기','bmResetAppearance','textbtn bm-reset','data-id="'+c.id+'"'):'')}
function bmFloorPreviewArt(floor){const g=meadowGroundArtwork(forestLayoutConfig(8),360,286,floor);return '<svg viewBox="80 132 560 320" aria-hidden="true"><defs>'+g.defs+'</defs>'+g.body+'</svg>'}
function bmFloorCard(f){const current=bmFloorId()===f.id,owned=bmFloorOwned(f.id);return '<article class="bm-floor-card">'+(f.ready?button(bmFloorPreviewArt(f.id),'bmPreviewFloor','bm-floor-art','data-floor="'+f.id+'" aria-label="'+f.name+' 미리보기"'):bmPlaceholder())+'<div><h3>'+f.name+'</h3>'+bmBadge(f.free?'base':'shop')+'<p>'+(f.free?'처음부터 무료':'한 번 구매로 계속 사용')+'</p><small>'+(current?'사용 중':!f.ready?'디자인 준비 중':owned?'보유 중':'내 숲에 미리보기')+'</small>'+(f.ready?button(owned?'바꿔보기':'2,200원',owned?'bmPreviewFloor':'bmQuickBuy','bm-card-buy','data-floor="'+f.id+'" data-kind="floor" '+(!owned?'aria-label="'+f.name+' 2,200원 구매 체험"':'')):'')+'</div></article>'}
function bmCouponsHTML(){return bmCouponPanel()+'<ul class="bm-info-list"><li>하루 2회, 광고 12회마다 쿠폰 1장을 받아요.</li><li>쿠폰 1장으로 원하는 유료 나무 1종을 열어요.</li><li>쿠폰 해금도 일반 나무 20종 조건에 포함돼요.</li><li>현금 구매 10종 조건에는 포함되지 않아요.</li></ul><p class="bm-money-note">출시 기준으로 매일 2회씩 모으면 쿠폰 나무 10종은 약 60일, 유료 16종 전체는 약 96일이에요.</p>'+bmEconomySummary()+'<p class="bm-subtitle">돈 없이 열 수 있는 나무는 30종 중 28종이에요. 나머지 히든 2종은 현금 구매 10종을 달성하면 열려요. 기록·성장·통계·공유는 무료예요.</p>'+button('유료 나무 둘러보기','bmBrowsePaid','secondary')}
function collectionHTML(tab=bmCollectionTab){bmCollectionTab=['floors','coupons'].includes(tab)?tab:'inventory';const q=bmCouponStatus();return '<div class="collection-body bm-collection" data-theme="basic"><div class="bm-shop-top"><span>출시형 체험 · 결제 없음</span>'+button('쿠폰 <b>'+q.balance+'장</b> →','bmCoupons','bm-wallet','aria-label="나무 쿠폰 '+q.balance+'장, 쿠폰 모으기"')+'</div><div class="bm-tabs" role="group" aria-label="상점 카테고리">'+[['inventory','나무'],['floors','바닥'],['coupons','쿠폰']].map(([id,label])=>button(label,'collectionTab','bm-tab '+(bmCollectionTab===id?'active':''),'data-tab="'+id+'" aria-pressed="'+(bmCollectionTab===id)+'"')).join('')+'</div>'+(bmCollectionTab==='coupons'?(bmPendingProduct?button(bmTreeName(bmPendingProduct.id)+'로 돌아가기','bmReturnProduct','secondary bm-coupon-return'):'')+bmCouponsHTML():bmCollectionTab==='floors'?'<p class="bm-subtitle">기본 바닥은 무료 · 유료 바닥은 2,200원</p>'+BM_FLOORS.map(bmFloorCard).join(''):bmInventoryHTML())+'</div>'}
function openCollection(tab=bmCollectionTab){if(tab==='visitors'){bmOpenCodex('visitors');return}bmRefresh(state);bmPreview=null;bmCheckout=null;collectionTab=tab;showModal('상점',collectionHTML(tab),'collection')}
function bmCodexMysteries(){return '<section class="bm-group"><div class="bm-section-head"><h3>히든 나무</h3><span>4종 · 판매 안 함</span></div><div class="bm-tree-grid">'+bmMysteries().map(t=>bmTreeCard('mystery-'+t.id,true)).join('')+'</div>'}
function bmMysteryHTML(){return bmCodexMysteries()}
function bmOpenCodex(tab='trees'){bmRefresh(state);bmPreview=null;bmCodexTab=tab==='visitors'?'visitors':'trees';const regular=bmOwnedTreeIds().length,hidden=bmMysteries().filter(t=>t.unlocked).length;const trees=bmEconomySummary()+'<div class="bm-progress"><div><small>일반 나무</small><strong>'+regular+'<span> / 26종</span></strong></div><p>히든 '+hidden+'/4종 · 현금 구매 '+bmCashTreeCount()+'/10종</p></div>'+[['base',BM_BASE_IDS],['record',BM_RECORD_IDS],['shop',BM_SHOP_IDS]].map(([group,ids])=>'<section class="bm-group"><div class="bm-section-head"><h3>'+BM_NAMES[group]+'</h3><span>'+ids.length+'종</span></div><div class="bm-tree-grid">'+ids.map(id=>bmTreeCard(id,true)).join('')+'</div></section>').join('')+bmCodexMysteries();showModal('도감','<div class="collection-body bm-collection">'+bmNotice()+'<div class="bm-tabs" role="group" aria-label="도감 종류">'+[['trees','나무'],['visitors','방문객']].map(([id,name])=>button(name,'bmCodexTab','bm-tab '+(bmCodexTab===id?'active':''),'data-tab="'+id+'" aria-pressed="'+(bmCodexTab===id)+'"')).join('')+'</div>'+(bmCodexTab==='trees'?trees:visitorCollectionHTML())+'</div>','collection')}
function bmPreviewItems(){return forestItems(state,year).map(c=>Model.clone(c))}
function bmPreviewHTML(){const p=bmPreview,isTree=p.kind==='tree',name=isTree?bmTreeName(p.id):BM_FLOOR_NAMES[p.id],owned=isTree?bmReadyTreeIds().includes(p.id):bmFloorOwned(p.id),group=isTree?bmCatalogGroup(p.id):p.id==='basic'?'base':'shop',q=bmCouponStatus();const art=isTree?'<div class="bm-preview-specimen">'+bmTreeSVG(p.id)+'</div>':'<div class="bm-live-scene" id="bmPreviewScene" inert>'+forestSVG(bmPreviewItems(),'basic',false,{floor:p.id,preview:true})+'</div>';let actions='';if(owned)actions=button(isTree?'숲에서 꾸미기':'바닥 바꾸기',isTree?'bmDecorateForest':'bmDecorateFloors','primary');else if(group==='shop')actions=(isTree?button(q.balance?'쿠폰 1장으로 해금하기':'쿠폰 모으기',q.balance?'bmRedeemStart':'bmCoupons','secondary'):'')+button(bmKRW(isTree?1100:2200)+' 구매 체험','bmBuyStart','primary');else actions='<p class="bm-money-note">'+(group==='record'?'기록으로 조건을 채우면 무료로 열려요.':'조건을 달성하면 자동으로 열려요. 판매하지 않아요.')+'</p>';return '<div class="bm-preview-body">'+art+'<div class="bm-preview-copy">'+bmBadge(group)+'<h3>'+esc(name)+'</h3>'+(isTree?(owned?'<p>'+bmTreeStatus(p.id)+'</p>':bmConditionHTML(p.id)):'<p>'+(owned?'보유 중': '2,200원 · 현금 구매')+'</p>')+'</div>'+bmNotice()+'<p id="formError" class="form-error" role="alert"></p><div class="bm-acquire-actions">'+actions+'</div>'+button('돌아가기','bmBackCollection','textbtn')+'</div>'}
function bmOpenPreview(kind,id,itemId=''){if(kind==='tree'&&!bmTreeReady(id)||kind==='floor'&&!BM_FLOORS.some(f=>f.id===id&&f.ready))return;if(itemId&&get(itemId))bmSelectedWork=itemId;bmPreview={kind,id,itemId:itemId||bmWork()?.id||'',backTab:bmCollectionTab,source:'preview'};bmCheckout=null;showModal(kind==='tree'?'나무 살펴보기':'내 숲에 미리보기',bmPreviewHTML(),'collection');if(kind==='floor')requestAnimationFrame(bmFitPreview)}
function bmFitPreview(){const svg=document.querySelector('#bmPreviewScene>svg'),world=svg?.querySelector('#forest-world');if(!svg||!world)return;const b=world.getBBox(),pad=22;svg.setAttribute('viewBox',[b.x-pad,b.y-pad,b.width+2*pad,b.height+2*pad].join(' '))}
function bmApplyPreview(){if(!bmPreview)return;const p={...bmPreview},before=Model.clone(state);const ok=p.kind==='floor'?bmSetFloor(p.id):bmAssignManual(state,get(p.itemId),p.id);if(!ok){state=before;return}if(!persist())return;bmPreview=null;closeModal();view='forest';forestEditMode=false;render();toast(p.kind==='floor'?'바닥을 바꿨어요.':'이 작품의 나무를 바꿨어요.')}
function bmOpenCheckout(kind){const p=bmPreview;if(['tree','floor','coupon'].includes(kind)&&!p)return;bmCheckout={kind,id:p?.id||'',preview:p?{...p}:null};let title='',body='',action='',disabled=false;if(kind==='ad'){const q=bmCouponStatus();title='광고 쿠폰 모으기';body='<p>오늘 '+q.watchedToday+'/2회 · 다음 쿠폰 '+q.progress+'/12회</p><p>실제 광고는 재생되지 않아요. 아래 버튼으로 시청 완료 흐름을 체험해요.</p>';action='시청 완료로 체험하기';disabled=q.watchedToday>=2}else if(kind==='package'){const pack=bmPackageInfo();title='첫 숲 패키지';body='<p>나무 10종 + 꽃이끼 정원 바닥 1종</p><div class="bm-package-grid">'+pack.ids.map(id=>'<div>'+bmTreeSVG(id)+'<small>'+esc(bmTreeName(id))+'</small></div>').join('')+'</div><div class="bm-price-summary"><small>단품 합 <del>13,200원</del></small><strong>9,900원</strong></div><p>새로 열리는 나무 '+pack.newTreeCount+'종 · 현금 구매 조건 '+bmCashTreeCount()+' → '+Math.min(16,bmCashTreeCount()+pack.newCashTreeCount)+'종</p>'+(pack.duplicateTreeIds.length?'<p class="bm-money-note">이미 보유한 '+pack.duplicateTreeIds.length+'종도 포함돼요. 중복 나무가 추가되거나 가격이 차감되지는 않아요.'+(pack.couponDuplicateIds.length?' 쿠폰으로 연 나무도 패키지 구매 시 현금 구매 이력에 포함돼요.':'')+'</p>':'')+'<p>구매 10종 달성 시 히든 2종 해금 조건을 채워요. 해당 그림은 준비 중이에요.</p>';action=pack.canBuy?'9,900원 구매 체험하기':'이미 모두 보유하고 있어요';disabled=!pack.canBuy}else{const coupon=kind==='coupon',floor=kind==='floor',q=bmCouponStatus();title='해금하기';body='<div class="bm-checkout-product">'+(floor?bmFloorPreviewArt(p.id):bmTreeSVG(p.id))+'<div><h3>'+esc(floor?BM_FLOOR_NAMES[p.id]:bmTreeName(p.id))+'</h3><small>한 번 열면 계속 사용할 수 있어요</small></div></div>'+(!floor?'<div class="bm-payment-methods" role="group" aria-label="해금 방법">'+button('단품 구매<strong>1,100원</strong>','bmPayCash',!coupon?'active':'','aria-pressed="'+!coupon+'"')+button('쿠폰 '+q.balance+'장 보유<strong>쿠폰 1장</strong>','bmPayCoupon',coupon?'active':'','aria-pressed="'+coupon+'" '+(q.balance?'':'disabled'))+'</div>':'')+'<div class="bm-price-summary"><small>'+(coupon?'사용할 쿠폰':'결제 금액')+'</small><strong>'+(coupon?'1장':bmKRW(floor?2200:1100))+'</strong></div><p>'+(coupon?'쿠폰으로 연 나무도 수집 보상에 포함돼요. 현금 구매 조건에는 포함되지 않아요.':floor?'바닥 구매는 나무 구매 종 수에 포함되지 않아요.':'현금 구매 나무 10종 조건에 포함돼요.')+'</p>';action=coupon?'쿠폰 1장 사용하기':bmKRW(floor?2200:1100)+' 구매 체험 완료하기';disabled=coupon&&q.balance<1}showModal(title,'<div class="bm-checkout">'+body+bmNotice()+'<p id="formError" class="form-error" role="alert"></p><div class="bm-acquire-actions">'+button(action,'bmConfirmAcquire','primary',disabled?'disabled':'')+button('취소','bmCancelAcquire','textbtn')+'</div></div>','collection')}
function bmConfirmAcquire(){if(!bmCheckout)return;const request={...bmCheckout},before=Model.clone(state);let result;try{result=request.kind==='ad'?bmPreviewWatchAd():request.kind==='package'?bmPreviewBuyPackage():request.kind==='coupon'?bmPreviewRedeem(request.id):request.kind==='floor'?bmPreviewBuyFloor(request.id):bmPreviewBuyTree(request.id)}catch{state=before;result={ok:false}}if(!result?.ok){state=before;const error=$('formError');if(error)error.textContent='이미 해금했거나 지금 진행할 수 없어요. 보유 상태와 오늘의 횟수를 확인해 주세요.';return}if(!persist())return;bmCheckout=null;render();if(request.kind==='ad'){openCollection('coupons');toast(result.couponEarned?'쿠폰 1장을 받았어요.':'시청 1회를 모았어요.')}else if(request.kind==='package'){openCollection('inventory');toast('패키지 구매 체험을 완료했어요.')}else{const p=request.preview;bmOpenPreview(p.kind,p.id,p.itemId);toast('나무와 바닥은 한 번 해금하면 계속 사용할 수 있어요.')}}
function treePickerHTML(c){const current=c.hiddenTree?'mystery-'+c.hiddenTree:contentSpecies(c).id;return '<div class="bm-decoration-body"><div class="bm-decoration-work"><span>'+typeName[c.type]+'</span><h3>'+esc(c.title)+'</h3>'+(Model.stage(c)<3?'<p>다 자라면 선택한 모습이 돼요.</p>':'')+'</div><div class="bm-decoration-grid">'+bmReadyTreeIds().map(id=>button('<span class="bm-decoration-art">'+bmTreeSVG(id)+'</span><span class="bm-decoration-name">'+esc(bmTreeName(id))+(id===current?'<b aria-hidden="true">✓</b>':'')+'</span>','bmChooseOwnedTree','bm-decoration-card '+(id===current?'selected':''),'data-id="'+esc(c.id)+'" data-species="'+id+'" aria-label="'+esc(bmTreeName(id))+' 선택" aria-pressed="'+(id===current)+'"')).join('')+'</div><p id="formError" class="form-error" role="alert"></p>'+button('장르에 맞춰 자동으로 고르기','bmAutoOwnedTree','textbtn bm-reset','data-id="'+esc(c.id)+'"')+'</div>'}
function openTreePicker(id){const c=get(id);if(!c)return;bmRefresh(state);bmSelectedWork=c.id;bmPreview=null;bmCheckout=null;showModal('나무 바꾸기',treePickerHTML(c),'collection')}
document.addEventListener('change',e=>{if(e.target.id==='bmWorkSelect'&&get(e.target.value)){bmSelectedWork=e.target.value;if(bmPreview){bmPreview.itemId=bmSelectedWork;showModal('나무 살펴보기',bmPreviewHTML(),'collection')}else openCollection('inventory');$('bmWorkSelect')?.focus({preventScroll:true})}});

function bmOpenShop(tab='inventory'){forestEditMode=false;bmTreeFilter='shop';bmPendingProduct=null;render();openCollection(tab)}
function bmDecorateForest(){closeModal();bmPreview=null;bmCheckout=null;view='forest';forestEditMode=true;render();window.scrollTo(0,0)}
function bmChooseOwnedTree(itemId,id,automatic=false){const c=get(itemId);if(!c||(!automatic&&!bmReadyTreeIds().includes(id)))return;const before=Model.clone(state);const ok=automatic?bmResetItemAppearance(state,c):bmAssignManual(state,c,id);if(ok===false){state=before;return}if(!persist())return;closeModal();bmPreview=null;view='forest';forestEditMode=true;render();toast('나무 모습을 바꿨어요.')}
function bmOpenFloorPicker(){bmRefresh(state);const floors=BM_FLOORS.filter(f=>f.ready&&bmFloorOwned(f.id));showModal('바닥 바꾸기','<div class="bm-decoration-body"><div class="bm-decoration-floors">'+floors.map(f=>button(bmFloorPreviewArt(f.id)+'<span>'+f.name+(bmFloorId()===f.id?'<b aria-hidden="true">✓</b>':'')+'</span>','bmChooseOwnedFloor','bm-decoration-floor '+(bmFloorId()===f.id?'selected':''),'data-floor="'+f.id+'" aria-pressed="'+(bmFloorId()===f.id)+'"')).join('')+'</div><p id="formError" class="form-error" role="alert"></p></div>','collection')}
function bmChooseOwnedFloor(id){if(!BM_FLOORS.some(f=>f.id===id&&f.ready&&bmFloorOwned(id)))return;if(!bmSetFloor(id)||!persist())return;closeModal();view='forest';forestEditMode=true;render();toast('바닥을 바꿨어요.')}

function bmAction(a,b){
 if(a==='bmDecorateForest'){bmDecorateForest();return true}
 if(a==='bmDecorateFloors'){bmDecorateForest();bmOpenFloorPicker();return true}
 if(a==='bmChooseOwnedTree'){bmChooseOwnedTree(b.dataset.id,b.dataset.species);return true}
 if(a==='bmAutoOwnedTree'){bmChooseOwnedTree(b.dataset.id,'',true);return true}
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
 if(a==='bmPayCoupon'){if(bmCouponStatus().balance)bmOpenCheckout('coupon');return true}
 if(a==='bmBrowsePaid'){bmTreeFilter='shop';openCollection('inventory');return true}
 if(a==='bmTreeFilter'){bmTreeFilter=['free','shop','mystery','owned'].includes(b.dataset.filter)?b.dataset.filter:'all';openCollection('inventory');return true}
 if(a==='bmPackage'){bmOpenCheckout('package');return true}
 if(a==='bmAdStart'){bmOpenCheckout('ad');return true}
 if(a==='bmBuyStart'){if(bmPreview)bmOpenCheckout(bmPreview.kind);return true}
 if(a==='bmRedeemStart'){bmOpenCheckout('coupon');return true}
 if(a==='bmConfirmAcquire'){bmConfirmAcquire();return true}
 if(a==='bmCancelAcquire'){const request=bmCheckout;bmCheckout=null;if(request?.preview?.source==='store')openCollection(request.preview.backTab);else if(request?.preview)bmOpenPreview(request.preview.kind,request.preview.id,request.preview.itemId);else openCollection(request?.kind==='ad'?'coupons':'inventory');return true}
 if(a==='bmResetAppearance'){const c=get(b.dataset.id);if(c){bmResetItemAppearance(state,c);if(persist()){render();openCollection('inventory');toast('장르에 맞는 나무를 골랐어요.')}}return true}
 return false;
}


function ratingPrompt(c,advance=false){showModal('이 경험은 어땠나요?','<p class="creator">'+esc(c.title)+(advance&&!c.completed?' · 저장하면 나의 숲에 다 자란 나무로 남아요.':'')+'</p><form id="ratingForm" data-id="'+esc(c.id)+'" data-advance="'+(advance?'yes':'no')+'"><div class="rating"><div class="rating-half-stars" data-rating-picker></div></div><input type="hidden" id="ratingValue" value="'+(c.rating||'')+'"><p id="ratingText" class="summary">'+(c.rating?c.rating+'점':'평점과 메모는 각각 선택이에요.')+'</p><label for="reviewMemo">감상·메모 · 선택</label><textarea id="reviewMemo" maxlength="4000" placeholder="어떤 장면이나 생각이 남았나요?">'+esc(c.review||'')+'</textarea><div class="space"></div><button class="primary" type="submit">'+(advance?'완료하고 나무 키우기':'평점·감상 저장')+'</button>'+button(advance&&!c.completed?'취소하고 돌아가기':'나중에 남기기','close','textbtn')+button('평점만 지우기','clearRating','textbtn',attr(c.id))+'</form>','rating')}

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
   return {...c,...contentMetadata(c),startedAt:validDate(c.startedAt)?c.startedAt:(c.importedProgress?firstExperienceDate(c):null),importedProgress:!!c.importedProgress,linkSources:normalizeLinkSources(c.linkSources),rating:validRating(c.rating),creator:String(c.creator||''),logs:c.logs.map(l=>({...l,page:String(l.page||''),memo:String(l.memo||'')})),tracks:Array.isArray(c.tracks)?c.tracks.map(String):[],saves:c.saves.map(e=>({id:String(e.id),at:Number(e.at)||0,source:String(e.source||'')})),cover:/^(?:data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(c.cover||'')?String(c.cover):'',source:String(c.source||''),publisher:String(c.publisher||''),isbn:String(c.isbn||''),catalogUrl:/^https:\/\//.test(c.catalogUrl||'')?String(c.catalogUrl):'',publishedAt:String(c.publishedAt||''),provider:String(c.provider||''),providerId:String(c.providerId||''),releaseDate:String(c.releaseDate||''),trackCount:Number(c.trackCount)||null,copyright:String(c.copyright||''),originalTitle:String(c.originalTitle||''),originalLanguage:String(c.originalLanguage||''),overview:String(c.overview||''),runtime:Number(c.runtime??c.runtime_minutes??c.runtimeMinutes)||null,contents:String(c.contents||''),genreIds:Array.isArray(c.genreIds)?c.genreIds.map(Number).filter(Number.isFinite):[],hiddenTree:['A','B'].includes(c.hiddenTree)?c.hiddenTree:null};
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
