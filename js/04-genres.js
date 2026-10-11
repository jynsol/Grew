/*
 * 장르: 책·영화 장르 정규화, 검색 결과 거르기, 장르 선택지.
 */

/* iOS Safari는 요소에 touch 이벤트 리스너가 연결돼 있어야 :active 상태(눌림 효과)를 인식해요.
   버튼 등에 별도 touch 핸들러가 없으면 :active CSS가 있어도 모바일에서 눌림 반응이 전혀 보이지 않기 때문에,
   문서 전체에 빈 touchstart 리스너를 하나 달아 :active 인식을 활성화해요. */
document.addEventListener("touchstart", function () {}, { passive: true });

/* Genre classification policy (MVP)
   1) Provider raw genre is preserved in rawGenre.
   2) genre stores a user-facing normalized specific genre.
   3) treeCategory is a broad internal grouping only; it must not replace the specific genre.
   4) Multi-genre movies keep all provider candidates, while a deterministic priority selects the primary genre.
   5) User-edited genres (genreSource='user') are never auto-overwritten.
*/
const TREE_CATEGORIES = [
  {
    id: "book-literature",
    type: "book",
    label: "책 · 문학",
    color: "#7fa989",
    pattern:
      /문학|소설|수필|에세이|추리|미스터리|스릴러|시|시집|판타지|로맨스|SF|아동|청소년|만화|fiction|romance/i,
  },
  {
    id: "book-humanities",
    type: "book",
    label: "책 · 인문·사회",
    color: "#b6a075",
    pattern: /인문|철학|역사|사회|정치|심리|예술|경제|경영|자기계발|교육/,
  },
  {
    id: "book-science",
    type: "book",
    label: "책 · 과학·기술",
    color: "#78a9a4",
    pattern: /과학|수학|생물|물리|화학|의학|기술|컴퓨터|IT|프로그래밍|자연|환경/i,
  },
  {
    id: "album-classical",
    type: "album",
    label: "음악 · 클래식",
    color: "#9994b5",
    pattern: /고전|클래식|오페라|관현악|실내악|classical|opera/i,
  },
  {
    id: "album-popular",
    type: "album",
    label: "음악 · 대중음악",
    color: "#c18e9b",
    pattern:
      /대중|팝|K-POP|록|락|얼터너티브|인디|메탈|펑크|힙합|R&B|소울|일렉트로닉|댄스|OST|pop|rock|alternative|indie|metal|punk|hip|soul|electronic|dance|soundtrack/i,
  },
  {
    id: "album-roots",
    type: "album",
    label: "음악 · 재즈·루츠",
    color: "#b6936e",
    pattern:
      /뿌리|재즈|블루스|포크|컨트리|레게|라틴|월드|국악|민속|jazz|blues|folk|country|reggae|latin|world/i,
  },
  {
    id: "movie-drama",
    type: "movie",
    label: "영화 · 이야기",
    color: "#94ac76",
    pattern: /드라마|로맨스|코미디|가족|음악|역사|drama|romance|comedy|family/i,
  },
  {
    id: "movie-sf",
    type: "movie",
    label: "영화 · 상상·모험",
    color: "#7c9ebc",
    pattern: /sf|공상|판타지|애니메이션|모험|animation|fantasy|adventure/i,
  },
  {
    id: "movie-action",
    type: "movie",
    label: "영화 · 긴장·액션",
    color: "#b48778",
    pattern: /액션|스릴러|범죄|공포|미스터리|전쟁|서부|action|thriller|crime|horror|mystery/i,
  },
  { id: "other", type: "all", label: "기타", color: "#9da89e" },
];

const MUSIC_GENRE_RULES = [
  ["클래식", /classical|opera|orchestral|chamber|baroque|클래식|고전|오페라/i],
  ["재즈", /jazz|재즈/i],
  ["블루스", /blues|블루스/i],
  ["포크", /folk|singer\s*[-/]?\s*songwriter|포크|싱어송라이터/i],
  ["컨트리", /country|컨트리/i],
  ["힙합", /hip\s*[-]?\s*hop|rap|힙합|랩/i],
  ["R&B/소울", /r\s*&\s*b|soul|알앤비|소울/i],
  ["K-POP", /k\s*[-]?\s*pop|케이팝/i],
  ["얼터너티브", /alternative|얼터너티브/i],
  ["인디", /indie|인디/i],
  ["메탈", /metal|메탈/i],
  ["펑크", /punk|펑크/i],
  ["록", /rock|록|락/i],
  ["일렉트로닉", /electronic|electronica|edm|house|techno|ambient|dance|일렉트로닉|전자음악|댄스/i],
  ["OST", /soundtrack|original\s+score|film\s+score|ost|사운드트랙/i],
  ["레게", /reggae|레게/i],
  ["라틴", /latin|라틴/i],
  ["월드", /world|월드/i],
  ["팝", /pop|팝/i],
];

function normalizeAlbumGenre(raw) {
  const value = cleanGenreValue(raw);
  if (!value) return "";
  for (const [name, re] of MUSIC_GENRE_RULES) if (re.test(value)) return name;
  return value;
}

const BOOK_GENRE_OVERRIDES = [
  ["달러구트 꿈 백화점", "소설"],
  ["불편한 편의점", "소설"],
  ["아몬드", "소설"],
  ["채식주의자", "소설"],
  ["소년이 온다", "소설"],
  ["데미안", "소설"],
  ["노인과 바다", "소설"],
  ["어린 왕자", "소설"],
  ["1984", "SF"],
  ["멋진 신세계", "SF"],
  ["파친코", "소설"],
  ["모순", "소설"],
  ["작별하지 않는다", "소설"],
  ["어서 오세요, 휴남동 서점입니다", "소설"],
  ["메리골드 마음 세탁소", "소설"],
  ["해리 포터와 마법사의 돌", "판타지"],
  ["해리포터와 마법사의 돌", "판타지"],
  ["반지의 제왕", "판타지"],
  ["나미야 잡화점의 기적", "소설"],
  ["사피엔스", "역사"],
  ["호모 데우스", "철학·인문"],
  ["코스모스", "과학"],
  ["이기적 유전자", "과학"],
  ["총, 균, 쇠", "역사"],
  ["총균쇠", "역사"],
  ["아주 작은 습관의 힘", "자기계발"],
  ["원씽", "자기계발"],
  ["역행자", "자기계발"],
  ["돈의 심리학", "경제·경영"],
  ["부자 아빠 가난한 아빠", "경제·경영"],
];

function cleanGenreValue(raw) {
  const value = String(raw || "")
    .normalize("NFKC")
    .trim();
  return /^(?:미입력|미분류|분류없음|unknown|n\/?a|none|null|기타)$/i.test(value) ? "" : value;
}

const BOOK_GENRE_RULES = [
  [
    "SF",
    [
      /\bsf\b|science\s*fiction|speculative\s*fiction|dystopian|과학소설|디스토피아|사이버펑크|우주\s*(?:소설|전쟁|여행)|외계/i,
    ],
  ],
  ["판타지", [/fantasy|magical\s*realism|판타지|마법|마법사|드래곤|이세계|요정|마법학교/i]],
  [
    "추리·미스터리",
    [/mystery|detective|crime\s*fiction|suspense|추리|미스터리|탐정|살인사건|범죄소설|스릴러/i],
  ],
  ["로맨스", [/romance|love\s*stories|로맨스|연애소설|사랑\s*이야기/i]],
  [
    "아동·청소년",
    [
      /juvenile\s*(?:fiction|literature|nonfiction)|children'?s\s*(?:books|fiction)|young\s*adult|어린이|아동|청소년|그림책|동화/i,
    ],
  ],
  ["만화", [/comics?|graphic\s*novels?|manga|만화|코믹|그래픽노블/i]],
  ["시", [/poetry|poems?|시집|시선집|시인/i]],
  ["에세이", [/essays?|memoir|autobiograph|수필|에세이|산문|회고록/i]],
  ["철학·인문", [/philosophy|humanities|ethics|철학|인문|사상|윤리|존재론|인문학/i]],
  ["역사", [/history|civilization|archaeology|역사|한국사|세계사|고대사|근현대사|문명사|사료/i]],
  [
    "사회·정치",
    [
      /social\s*science|sociology|political\s*science|politics|사회학|사회과학|정치|정책|민주주의|젠더|문화비평|사회\s*문제/i,
    ],
  ],
  ["심리", [/psychology|psychoanalysis|cognitive|심리|정신분석|마음|감정|인지/i]],
  [
    "경제·경영",
    [
      /business|economics|finance|investing|marketing|management|entrepreneur|경제|경영|투자|마케팅|브랜딩|비즈니스|금융|주식/i,
    ],
  ],
  [
    "과학",
    [
      /science|physics|chemistry|biology|astronomy|neuroscience|evolution|medicine|과학|물리|화학|생물|천문|뇌과학|진화|의학/i,
    ],
  ],
  [
    "기술·컴퓨터",
    [
      /computers?|programming|software|artificial\s*intelligence|machine\s*learning|technology|컴퓨터|프로그래밍|코딩|인공지능|AI|머신러닝|데이터|소프트웨어|기술/i,
    ],
  ],
  ["예술", [/art|design|architecture|photography|미술|예술|디자인|건축|사진|영화론|음악론/i]],
  [
    "자기계발",
    [
      /self[- ]help|personal\s*growth|productivity|habits?|leadership|자기계발|습관|성공|생산성|리더십|커리어/i,
    ],
  ],
  [
    "소설",
    [/fiction|literary\s*fiction|literature\s*&?\s*fiction|novels?|장편소설|단편소설|소설집|소설|픽션/i],
  ],
];

function overrideBookGenre(title) {
  const norm = Model.norm(String(title || "").replace(/\s*\d+\s*$/, ""));
  const hit = BOOK_GENRE_OVERRIDES.find(
    ([name]) => norm === Model.norm(name) || norm.startsWith(Model.norm(name)),
  );
  return hit?.[1] || "";
}

function inferBookGenre(data) {
  const title = String(data?.title || "").normalize("NFKC"),
    body = [data?.contents, data?.overview, data?.description, data?.publisher, data?.creator, data?.rawGenre]
      .filter(Boolean)
      .join(" ")
      .normalize("NFKC");
  const override = overrideBookGenre(title);
  if (override) return override;
  let best = "",
    bestScore = 0;
  for (const [name, res] of BOOK_GENRE_RULES) {
    let score = 0;
    for (const re of res) {
      re.lastIndex = 0;
      if (re.test(title)) score += 5;
      re.lastIndex = 0;
      if (re.test(body)) score += 3;
      re.lastIndex = 0;
    }
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  if (bestScore >= 3) return best;
  const narrative = (
    body.match(/주인공|등장인물|장편|단편|작가의\s*데뷔작|소설가|이야기의\s*배경|서사|허구/g) || []
  ).length;
  return narrative >= 2 ? "소설" : "";
}

function normalizeBookGenre(raw, data) {
  const value = cleanGenreValue(raw),
    merged = { ...(data || {}), rawGenre: value };
  const known = BOOK_GENRE_RULES.find(([name]) => name.toLocaleLowerCase() === value.toLocaleLowerCase());
  if (known) return known[0];
  if (value) {
    const normalized = inferBookGenre({
      title: "",
      contents: value,
      creator: "",
      publisher: "",
      rawGenre: value,
    });
    if (normalized) return normalized;
  }
  return inferBookGenre(merged);
}

const BOOK_EXCLUDED_SEARCH_RE =
  /(평가문제집|문제집|기출\s*문제|기출문제|모의고사|수능|내신|자습서|학습서|참고서|교과서|수험서|워크북|workbook|test\s*prep|토익|toeic|토플|toefl|jlpt|ebs|개념원리|쎈\s*수학|라이트쎈|개념쎈|rpm|n제|자이스토리|마더텅|블랙라벨|숨마쿰라우데|완자|수능특강|수능완성|올림포스|개념\+유형|기본서|실전서|해설서|공무원\s*시험|자격증\s*시험|학습지|연산\s*문제|연산력|기탄\s*(수학|국어|영어|한자)|사고력\s*수학|유형\s*문제|단원평가|진단평가|학력평가|초등\s*참고서|중등\s*참고서|고등\s*참고서|초등\s*[1-6]?\s*학년|중[123]\s*(국어|영어|수학|과학|사회)|고[123]\s*(국어|영어|수학|과학|사회)|초등\s*(국어|영어|수학|과학|사회)|중학\s*(국어|영어|수학|과학|사회)|고등\s*(국어|영어|수학|과학|사회))/i;

const BOOK_EDUCATIONAL_COLLECTION_RE =
  /((중고생|중학생|고등학생|청소년|초등학생).{0,16}(필독|권장|추천|꼭\s*읽어야|읽어야\s*할|논술|교과)|필독.{0,12}(고전|문학|소설|명작|도서)|권장도서\s*\d+|필독서\s*\d+|(한국\s*)?고전소설\s*(\d+|선|선집|모음|컬렉션)|명작소설\s*(\d+|선|선집)|교과서\s*수록|교과\s*연계|논술\s*(대비|필독|고전|문학)|수행평가\s*(대비|필독)|독서평설|중고등\s*필독|중등\s*필독|고등\s*필독)/i;

const BOOK_ANTHOLOGY_COLLECTION_RE =
  /((한국|세계|동양|서양|현대|고전|명작)?\s*(단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)\s*(\d{1,3}\s*(선|편|권)?|선집|모음|컬렉션)|((단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)\s*(베스트|대표|엄선)?\s*\d{1,3}\s*(선|편)?))/i;

const BOOK_PERIODICAL_RE =
  /((한국소설|한국문학|문학|소설)\s*[\(\[]?\s*(19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,4}\s*호[\)\]]?|((19|20)\d{2}\s*년\s*\d{1,2}\s*월).{0,12}\d{1,4}\s*호|\b\d{1,4}\s*호\b)/i;

function compactBookTitle(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[·•ㆍ:：\-–—_/\\()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BOOK_EXCLUDED_PUBLISHER_RE =
  /(천재교육|비상교육|좋은책신사고|마더텅|수경출판사|이투스북|메가스터디북스|디딤돌교육|NE능률|능률교육|지학사|개념원리|키출판사|쎄듀|오르비북스|기탄교육|기탄출판|동아출판|미래엔|교학사|금성출판사|에듀윌|해커스|시대고시|박문각)/i;

function isExcludedBookCandidate(book) {
  // 소개문(contents)은 보지 않는다. 일반 문학의 '스릴러의 교과서' 같은 표현 오탐 방지.
  const title = compactBookTitle(book?.title);
  const searchable = [title, book?.genre, book?.rawGenre]
    .filter(Boolean)
    .join(" ")
    .replace(/<[^>]+>/g, " ");
  const publisher = String(book?.publisher || "");

  // '한국소설'은 정기간행물/잡지 계열 제목으로 취급해 제목에 포함되면 제외.
  // 또한 연+월/호 조합이 있는 문학 정기간행물형 제목도 제외한다.
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  const koreanNovelPeriodical =
    normalizedTitle.includes("한국소설") ||
    /(계간|계간지|봄호|여름호|가을호|겨울호|\d{1,2}\s*월호|월호)/i.test(normalizedTitle) ||
    (/(19|20)\d{2}\s*년/.test(normalizedTitle) &&
      /\d{1,2}\s*월/.test(normalizedTitle) &&
      /\d{1,4}\s*호/.test(normalizedTitle)) ||
    (/(문학|소설|시|비평|문예)/.test(normalizedTitle) && /\d{1,4}\s*호/.test(normalizedTitle)) ||
    (/(문학|소설|시|비평|문예)/.test(normalizedTitle) &&
      /(봄|여름|가을|겨울)\s*(호|편)?/i.test(normalizedTitle));

  // 띄어쓰기/괄호/구두점 차이에도 잡히도록 제목의 공백 제거본도 함께 본다.
  const compact = title.replace(/\s+/g, "");

  const anthologyCompact =
    /((한국|세계|동양|서양|현대|고전|명작)?(단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)\d{1,3}(선|편|권)?$)|((단편소설|고전소설|명작소설|단편문학|고전문학|명작문학|한국문학|세계문학)(선집|모음|컬렉션)$)/i.test(
      compact,
    );

  return (
    BOOK_EXCLUDED_SEARCH_RE.test(searchable) ||
    BOOK_EDUCATIONAL_COLLECTION_RE.test(title) ||
    BOOK_ANTHOLOGY_COLLECTION_RE.test(title) ||
    anthologyCompact ||
    koreanNovelPeriodical ||
    BOOK_PERIODICAL_RE.test(title) ||
    BOOK_EXCLUDED_PUBLISHER_RE.test(publisher)
  );
}

function allowDiscoveryCandidate(item) {
  if (!item || !item.title || !["book", "movie"].includes(item.type)) return false;
  if (item.type === "book" && isExcludedBookCandidate(item)) return false;
  return true;
}

const TMDB_GENRES = {
  28: "액션",
  12: "모험",
  16: "애니메이션",
  35: "코미디",
  80: "범죄",
  99: "다큐멘터리",
  18: "드라마",
  10751: "가족",
  14: "판타지",
  36: "역사",
  27: "공포",
  10402: "음악",
  9648: "미스터리",
  10749: "로맨스",
  878: "SF",
  10770: "TV 영화",
  53: "스릴러",
  10752: "전쟁",
  37: "서부",
};

const MOVIE_PRIMARY_PRIORITY = [
  "애니메이션",
  "다큐멘터리",
  "SF",
  "판타지",
  "공포",
  "스릴러",
  "미스터리",
  "범죄",
  "액션",
  "로맨스",
  "코미디",
  "드라마",
  "가족",
  "모험",
  "역사",
  "전쟁",
  "서부",
  "음악",
  "TV 영화",
];

function movieGenreInfo(ids) {
  const list = [
    ...new Set((Array.isArray(ids) ? ids : []).map((id) => TMDB_GENRES[Number(id)]).filter(Boolean)),
  ];
  const primary = MOVIE_PRIMARY_PRIORITY.find((x) => list.includes(x)) || list[0] || "";
  return { primary, candidates: list.map((x) => [x, "TMDB"]) };
}

function normalizeGenreForType(type, genre, data = {}) {
  if (type === "album") return normalizeAlbumGenre(genre);
  if (type === "book") return normalizeBookGenre(genre, data);
  return cleanGenreValue(genre);
}

// Launch labels live together so the native client can localize them by group id.
const LAUNCH_GENRES = {
  book: [
    ["book-literature", "순문학"],
    ["book-genre", "장르문학"],
    ["book-humanities", "인문"],
    ["book-science", "과학"],
    ["book-other", "기타"],
  ],
  movie: [
    ["movie-drama", "드라마"],
    ["movie-comedy", "로맨스·코미디"],
    ["movie-action", "액션·스릴러"],
    ["movie-sf", "SF·판타지"],
    ["movie-other", "기타"],
  ],
};

function launchGenre(type, value, data = {}) {
  const text = String(value || "")
      .normalize("NFKC")
      .trim(),
    exact = LAUNCH_GENRES[type]?.find((x) => x[1] === text);
  if (exact) return exact[1];
  if (type === "book") {
    if (
      /장르문학|추리|미스터리|스릴러|판타지|로맨스|공포|무협|\bSF\b|science fiction|mystery|thriller|fantasy|romance|horror/i.test(
        text,
      )
    )
      return "장르문학";
    if (/과학|수학|생물|물리|화학|의학|기술|컴퓨터|프로그래밍|자연|환경|science|technology/i.test(text))
      return "과학";
    if (
      /인문|철학|역사|사회|정치|심리|예술|경제|경영|자기계발|교육|humanities|history|philosophy|business/i.test(
        text,
      )
    )
      return "인문";
    if (/문학|소설|수필|에세이|시집|^시$|fiction|literature|poetry|essay/i.test(text)) return "순문학";
  } else if (type === "movie") {
    if (/로맨스|코미디|romance|comedy/i.test(text)) return "로맨스·코미디";
    if (
      /액션|스릴러|범죄|공포|미스터리|전쟁|서부|action|thriller|crime|horror|mystery|war|western/i.test(text)
    )
      return "액션·스릴러";
    if (/\bSF\b|공상|판타지|애니메이션|모험|animation|fantasy|adventure|science fiction/i.test(text))
      return "SF·판타지";
    if (/드라마|drama/i.test(text)) return "드라마";
  }
  return "기타";
}

const GENRE_POOL = Object.fromEntries(
  Object.entries(LAUNCH_GENRES).map(([type, groups]) => [type, groups.map((x) => x[1])]),
);

function genreCandidates(c) {
  return (GENRE_POOL[c.type] || []).map((label) => [label, ""]);
}

function genreOptions(c) {
  const selected = launchGenre(c.type, c.genre, c);
  return genreCandidates(c)
    .map(
      ([label]) =>
        '<option value="' +
        esc(label) +
        '" ' +
        (label === selected ? "selected" : "") +
        ">" +
        esc(label) +
        "</option>",
    )
    .join("");
}

function metadataFields(c) {
  return (
    '<label for="contentGenre">장르</label><select id="contentGenre">' +
    genreOptions(c) +
    '</select><span id="genreTreePreview" hidden></span><p class="muted tiny">직접 고른 장르는 자동으로 바뀌지 않아요.</p>'
  );
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-info-type]");
  if (!b || b.disabled) return;
  const input = $("contentType");
  if (!input || input.value === b.dataset.infoType) return;
  input.value = b.dataset.infoType;
  b.parentElement.querySelectorAll("[data-info-type]").forEach((x) => {
    const on = x === b;
    x.classList.toggle("active", on);
    x.setAttribute("aria-checked", String(on));
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
});

document.addEventListener("change", (e) => {
  if (e.target.id !== "contentCover") return;
  const file = e.target.files[0],
    name = $("contentCoverName"),
    thumb = $("contentCoverThumb");
  if (!name || !thumb) return;
  name.textContent = file ? file.name : "사진 고르기";
  if (file) {
    const url = URL.createObjectURL(file);
    thumb.innerHTML = '<img src="' + url + '" alt="">';
    thumb.querySelector("img").onload = () => URL.revokeObjectURL(url);
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "contentType") {
    $("contentGenre").innerHTML = genreOptions({ type: e.target.value, genre: "" });
    const isBook = e.target.value === "book";
  }
  if (["contentType", "contentGenre"].includes(e.target.id))
    $("genreTreePreview").textContent =
      "나무 · " + mappedForestCategoryLabel($("contentType").value, $("contentGenre").value) + " 계열";
});
