/*
 * 오늘 탭: 오늘 카드, 이번 주 점, 연속 기록, 도장, 최근 완료.
 */

// Work info as one quiet line (date · length); the values speak for themselves, no labels.
function detailMetadata(c) {
  const day = (v) => {
    const m = String(v || "").match(/^(\d{4})-?(\d{2})-?(\d{2})/);
    return m ? m[1] + "." + m[2] + "." + m[3] : esc(String(v).slice(0, 10));
  };
  const bits = [];
  if ((c.type === "movie" || c.type === "album") && c.releaseDate) bits.push(day(c.releaseDate));
  if (c.type === "book" && c.publishedAt) bits.push(day(c.publishedAt));
  if (c.runtime && c.type !== "movie") bits.push(esc(c.runtime) + "분");
  if (c.length && c.type === "book") bits.push(esc(c.length) + "쪽");
  return bits.length ? '<p class="detail-meta-line">' + bits.join(" · ") + "</p>" : "";
}

function recentCompleted() {
  const items = state.items
    .filter((c) => c.completed)
    .sort(
      (a, b) =>
        (b.completed === "unknown" ? "" : b.completed).localeCompare(
          a.completed === "unknown" ? "" : a.completed,
        ) ||
        (b.completedAt || 0) - (a.completedAt || 0) ||
        b.id.localeCompare(a.id),
    )
    .slice(0, 2);
  if (!items.length) return "";
  const labels = { book: "BOOK", movie: "MOVIE" };
  return (
    '<section class="recent-completed sticker-recent"><div class="row between"><h2>최근 완료</h2>' +
    button('나의 숲 <span aria-hidden="true">›</span>', "tab", "textbtn", 'data-tab="forest"') +
    '</div><div class="sticker-recent-list">' +
    items
      .map(
        (c) =>
          '<button type="button" class="sticker-recent-card" data-type="' +
          c.type +
          '" data-action="detail" ' +
          attr(c.id) +
          '><div class="sticker-recent-art">' +
          stickerTree(c, 3, "is-cut") +
          '</div><span class="sticker-recent-type">' +
          labels[c.type] +
          "</span><strong>" +
          esc(c.title) +
          "</strong><small>" +
          (c.completed === "unknown" ? "완료일 미상" : esc(c.completed.slice(5).replace("-", "."))) +
          (validRating(c.rating)
            ? ' · <span class="rating-star" aria-hidden="true">★</span> ' + c.rating
            : "") +
          "</small></button>",
      )
      .join("") +
    "</div></section>"
  );
}

function renderToday() {
  return renderTodayBase() + recentCompleted();
}

function todayLogDates(c) {
  return new Set(
    (c.logs || [])
      .map((l) => l.date)
      .filter(
        (date) =>
          typeof date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Number.isFinite(Date.parse(date + "T12:00:00Z")) &&
          new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date,
      ),
  );
}

// The streak and this week's dots are shared: any day you recorded any book or film counts.
// Which kinds were recorded on each day: {date: Set('book','movie')}.
function logKindsByDate() {
  const out = {};
  for (const c of state.items || []) {
    const add = (d) => {
      (out[d] = out[d] || new Set()).add(c.type);
    };
    todayLogDates(c).forEach(add);
    if (typeof c.completed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.completed)) add(c.completed);
  }
  return out;
}

function allLogDates() {
  const out = new Set();
  for (const c of state.items || []) {
    todayLogDates(c).forEach((d) => out.add(d));
    if (typeof c.completed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.completed)) out.add(c.completed);
  }
  return out;
}

function todayDateShift(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Calendar dates, not elapsed hours: this also keeps DST and year boundaries stable.
function weekDots(c, today = now()) {
  const kinds = logKindsByDate(),
    weekday = new Date(today + "T12:00:00Z").getUTCDay(),
    monday = todayDateShift(today, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = todayDateShift(monday, i),
      k = date <= today && kinds[date];
    const kind = !k ? "" : k.has("book") && k.has("movie") ? "both" : k.has("movie") ? "movie" : "book";
    return { date, logged: !!kind, kind, isToday: date === today, isFuture: date > today };
  });
}

function streakDays(c, today = now()) {
  const logged = allLogDates();
  let date = logged.has(today) ? today : todayDateShift(today, -1),
    days = 0;
  while (logged.has(date)) {
    days++;
    date = todayDateShift(date, -1);
  }
  return days;
}

function scrapAddButton() {
  return button(icon("plus") + "<span>스크랩</span>", "add", "heading-scrap", 'aria-label="스크랩 추가"');
}

function todayHeading(title = "오늘", actions = "") {
  return (
    '<div class="page-heading"><h1 class="page-title">' +
    title +
    '</h1><div class="page-heading-actions">' +
    scrapAddButton() +
    actions +
    "</div></div>"
  );
}

// The work in progress stays on Today: the most recently read one wins over unstarted scraps.
let todayPickedId = null;

function lastReadDate(c) {
  return [c.startedAt, ...(c.logs || []).map((l) => l.date)].filter(Model.validDate).sort().at(-1) || "";
}

function latestReading(exceptId) {
  return (
    state.items
      .filter((x) => !x.completed && Model.stage(x) > 0 && x.id !== exceptId)
      .sort((a, b) => lastReadDate(b).localeCompare(lastReadDate(a)))[0] || null
  );
}

function renderTodayBase() {
  let c = selected();
  if (c?.completed) c = null;
  // An unstarted scrap only replaces the reading work when it was picked in this session.
  if (!c || (Model.stage(c) === 0 && c.id !== todayPickedId)) c = latestReading() || c;
  if (!state.onboarded && !state.items.length)
    return (
      "<section>" +
      todayHeading() +
      '<div class="center today-empty">' +
      growth(0) +
      '<h2>첫 작품을 담아보세요</h2><p class="creator">책과 영화를 기록할 수 있어요.</p><div class="space"></div>' +
      button("첫 스크랩 추가하기", "add") +
      "</div></section>"
    );
  if (!c) {
    const candidates = state.items
      .filter((c) => !c.completed)
      .sort(
        (a, b) => b.saves.length - a.saves.length || (b.saves.at(-1)?.at || 0) - (a.saves.at(-1)?.at || 0),
      );
    const skip = Number(sessionStorageSafe("candidate")) || 0,
      chosen = candidates[skip % candidates.length];
    if (!chosen) return renderDiscovery();
    c = chosen;
  }

  return todayBoard(c);
}

// Sticker board (redesign 5a): the tree sticker leads, the stamp records, the week stays small.
function stickerTreeSrc(c, stage = Model.stage(c)) {
  const key =
    stage < 3
      ? growthKey(c, stage)
      : c.hiddenTree
        ? c.hiddenTree === "A"
          ? "shining"
          : "moonlight"
        : contentSpecies(c)?.id;
  return (SONGLIM_TREE_ASSETS[key] || SONGLIM_TREE_ASSETS.oak).src;
}

function stickerTree(c, stage = Model.stage(c), cls = "") {
  const name =
    stage < 3
      ? growthAppearance(stage, c).name
      : c.hiddenTree
        ? bmTreeName("mystery-" + c.hiddenTree)
        : contentSpecies(c)?.name || "나무";
  return (
    '<img class="sticker-tree ' +
    cls +
    '" src="' +
    esc(stickerTreeSrc(c, stage)) +
    '" alt="' +
    esc(name) +
    '" decoding="async">'
  );
}

// "N일째" counts the days actually recorded, not calendar days since the first one.
function todayDayCount(c) {
  return todayLogDates(c).size;
}

// Books show the day count; a film is watched in one sitting, so it shows its running time.
function todayStageSuffix(c) {
  if (c.type === "movie") {
    const minutes = Number(c.runtime) || 0;
    return minutes > 0 ? minutes + "분" : "";
  }
  const days = todayDayCount(c);
  return Model.stage(c) && days ? days + "일째" : "";
}

function todayLogOf(c) {
  return c.logs.find((l) => l.date === now());
}

// A rubber stamp: thick and thin rings, curved GREW / date lettering, stars and one bold word.
// Pressed, it prints as a rough-edged ink imprint in the work's colour.
function stampSVG(c, done) {
  const d = now(),
    date = d.slice(0, 4) + "." + d.slice(5, 7) + "." + d.slice(8, 10),
    movie = c.type === "movie";
  const word = done ? "DONE" : "";
  const center = done
    ? '<text class="stamp-word" x="60" y="71" text-anchor="middle">' + word + "</text>"
    : '<text class="stamp-small" x="60" y="61" text-anchor="middle">오늘</text><text class="stamp-mid" x="60" y="77" text-anchor="middle">' +
      (movie ? "봤어요" : "읽었어요") +
      "</text>";
  return (
    '<svg class="stamp-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="stampArcTop" d="M21 60a39 39 0 0 1 78 0"/><path id="stampArcBottom" d="M13 60a47 47 0 0 0 94 0"/>' +
    (done
      ? '<filter id="stampRough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.45" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>'
      : "") +
    "</defs>" +
    "<g" +
    (done ? ' filter="url(#stampRough)"' : "") +
    '><g fill="none" stroke="currentColor"><circle cx="60" cy="60" r="56" stroke-width="3.4"/><circle cx="60" cy="60" r="51" stroke-width="1.1"/><circle cx="60" cy="60" r="35" stroke-width="1.4"/></g>' +
    '<g fill="currentColor"><text class="stamp-arc"><textPath href="#stampArcTop" startOffset="50%" text-anchor="middle">GREW · TODAY</textPath></text><text class="stamp-arc"><textPath href="#stampArcBottom" startOffset="50%" text-anchor="middle">' +
    date +
    "</textPath></text>" +
    '<text class="stamp-stars" x="60" y="' +
    (done ? 47 : 44) +
    '" text-anchor="middle">★ ★ ★</text>' +
    center +
    '<circle cx="16" cy="60" r="1.6"/><circle cx="104" cy="60" r="1.6"/></g></g></svg>'
  );
}

function todayStamp(c) {
  const stage = Model.stage(c),
    log = c.logs.find((l) => l.date === now()),
    verb = c.type === "movie" ? "봤어요" : "읽었어요";
  if (stage === 0)
    return button(
      '<span class="stamp-start-label">' + (c.type === "movie" ? "보기<br>시작" : "읽기<br>시작") + "</span>",
      "startExperience",
      "stamp-button is-start",
      attr(c.id) + ' aria-label="' + (c.type === "movie" ? "보기 시작하기" : "읽기 시작하기") + '"',
    );
  if (log)
    return (
      '<div class="stamp-done"><div class="stamp-button is-done" role="img" aria-label="오늘 기록했어요">' +
      stampSVG(c, true) +
      "</div></div>"
    );
  // Not yet stamped: a plain grey face (no rings) so it reads clearly apart from the printed stamp.
  return button(
    '<span class="stamp-face"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>오늘<br>' +
      verb +
      "</span></span>",
    "record",
    "stamp-button",
    attr(c.id) + ' aria-label="오늘 ' + verb + '"',
  );
}

// Long titles shrink until the whole title fits in two lines next to the cover stickers.
// Long titles shrink until the whole title fits in two lines beside the cover.
function fitTodayTitle() {
  const el = document.querySelector(".today-panel-title h1 button");
  if (!el) return;
  el.classList.add("is-fitting");
  el.classList.remove("is-long");
  let size = 22;
  const apply = () => {
    el.style.fontSize = size + "px";
    el.style.letterSpacing = size >= 19 ? "" : "-.025em";
  };
  const fits = (lines = 2) =>
    el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= size * 1.2 * lines + 2;
  apply();
  while (size > 16 && !fits()) {
    size--;
    apply();
  }
  // Very long titles get up to four lines at the smallest size rather than an ellipsis.
  if (!fits()) el.classList.add("is-long");
  el.classList.remove("is-fitting");
}

addEventListener("resize", () => {
  if (view === "today") fitTodayTitle();
});

// Books are read and films are watched; a mixed list uses the app's shared status name.
function progressLabel() {
  return statusName.active;
}

function openReadingList(currentId) {
  const list = state.items
    .filter((x) => !x.completed && Model.stage(x) > 0 && x.id !== currentId)
    .sort(
      (a, b) =>
        Math.max(0, ...b.logs.map((l) => Date.parse(l.date) || 0)) -
        Math.max(0, ...a.logs.map((l) => Date.parse(l.date) || 0)),
    );
  showModal(
    progressLabel(list) + "인 작품",
    '<div class="content-list">' +
      list.map((x) => row(x, true)).join("") +
      "</div>" +
      button("다른 스크랩에서 고르기", "pick", "secondary"),
    "reading",
  );
}

function todayStickerWeek(c) {
  const streak = streakDays(c),
    names = ["월", "화", "수", "목", "금", "토", "일"];
  return (
    '<section class="sticker-week" aria-label="이번 주 기록"><h2>이번 주' +
    (streak ? '<span class="tv-streak">연속 ' + streak + "일</span>" : "") +
    "</h2><ol>" +
    weekDots(c)
      .map(
        (d, i) =>
          '<li class="' +
          (d.logged ? "is-logged is-" + d.kind + " " : "") +
          (d.isToday ? "is-today " : "") +
          (d.isFuture ? "is-future" : "") +
          '" aria-label="' +
          d.date +
          " " +
          names[i] +
          "요일" +
          (d.isToday ? " · 오늘" : "") +
          " · " +
          (d.logged ? "기록함" : d.isFuture ? "예정" : "기록 없음") +
          '"' +
          (d.isToday ? ' aria-current="date"' : "") +
          ">" +
          names[i] +
          "</li>",
      )
      .join("") +
    "</ol></section>"
  );
}

function todayBoard(c) {
  const stage = Model.stage(c),
    readingItems = state.items.filter((x) => !x.completed && x.id !== c.id && Model.stage(x) > 0),
    reading = readingItems.length,
    readingLabel = progressLabel(readingItems),
    others = state.items.some((x) => !x.completed && x.id !== c.id),
    date = new Date(now() + "T12:00:00Z");
  const dateLabel =
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "." +
    String(date.getUTCDate()).padStart(2, "0") +
    " " +
    ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()];
  const coverArt = c.cover
    ? '<img src="' + esc(c.cover) + '" alt="" decoding="async">'
    : '<span class="sticker-cover-blank" aria-hidden="true"></span>';
  const completeLabel =
    stage === 0
      ? c.type === "movie"
        ? "이미 다 봤어요"
        : "이미 다 읽었어요"
      : c.type === "movie"
        ? "다 봤어요"
        : "다 읽었어요";
  // A trailing "(…)" in a book title reads as its subtitle, as in the design.
  const split = String(c.title).match(/^(.+?)\s*[(（]([^()（）]+)[)）]\s*$/),
    mainTitle = split ? split[1] : c.title;
  const suffix = todayStageSuffix(c),
    sub = split ? split[2] : c.originalTitle && c.originalTitle !== c.title ? c.originalTitle : "";
  // Today (Apple-style): coral date over a large title, a gradient hero card with the work and its
  // tree in a soft disc, then a white week card with the stamp. Stages are not a goal, so no progress ring.
  // Big count: films with a known running time show minutes, everything else the days recorded.
  const minutes = c.type === "movie" ? Number(c.runtime) || 0 : 0,
    count = minutes || todayDayCount(c),
    unit = minutes ? "분" : "일째";
  return (
    '<section class="sticker-today today-v2" data-type="' +
    c.type +
    '" data-stage="' +
    stage +
    '">' +
    '<header class="tv-head"><div class="sticker-top"><div class="sticker-titles"><h1 class="page-title">오늘</h1></div><div class="page-heading-actions">' +
    scrapAddButton() +
    "</div></div></header>" +
    '<article class="today-panel tv-hero">' +
    '<div class="tv-hero-top"><span class="tv-tag">' +
    (stage ? statusName.active : statusName.saved) +
    "</span>" +
    (reading
      ? button(
          "⇄ " + readingLabel + " " + reading,
          "readingList",
          "sticker-switch",
          attr(c.id) + ' aria-label="함께 ' + readingLabel + "인 작품 " + reading + '개 보기"',
        )
      : others
        ? button("⇄ 다른 작품", "pick", "sticker-switch", 'aria-label="다른 작품 고르기"')
        : "") +
    "</div>" +
    '<div class="tv-hero-main"><div class="today-panel-title"><h1 class="page-title"><button type="button" data-action="detail" ' +
    attr(c.id) +
    ' aria-label="' +
    esc(c.title) +
    '">' +
    esc(mainTitle) +
    "</button></h1>" +
    (sub ? "<span>" + esc(sub) + "</span>" : "") +
    (c.creator ? '<span class="today-panel-kicker">' + esc(c.creator) + "</span>" : "") +
    (c.type === "movie" ? button("보러 가기 ↗", "external", "tv-watch", attr(c.id)) : "") +
    "</div>" +
    '<button type="button" class="sticker-cover" data-action="detail" ' +
    attr(c.id) +
    ' aria-label="' +
    esc(c.title) +
    ' 상세 보기">' +
    coverArt +
    "</button></div>" +
    '<i class="tv-sun" aria-hidden="true"></i>' +
    stickerTree(c, stage, "today-tree") +
    '<div class="today-stage tv-count">' +
    "<b>" +
    (stage ? count : 0) +
    "</b><small>" +
    (stage ? unit : "일째") +
    "</small><span>" +
    esc(growthAppearance(stage, c).name) +
    (stage ? "" : " · 시작 전") +
    "</span></div>" +
    "</article>" +
    '<article class="tv-week sticker-actions"><div class="sticker-actions-left">' +
    todayStickerWeek(c) +
    '<div class="sticker-links">' +
    button(completeLabel, "complete", "textbtn sticker-complete", attr(c.id)) +
    (todayLogOf(c) ? button("기록 취소", "undoLog", "textbtn", attr(c.id)) : "") +
    "</div></div>" +
    todayStamp(c) +
    "</article>" +
    "</section>"
  );
}
