/*
 * 나의 숲 탭: 이달·올해·평생 숲, 달력, 확대/이동, 꾸미기 상태.
 */

function forestGrowthKey(c) {
  if (!c || !c.id || c._bmSample || !["book", "movie"].includes(c.type) || c.completed) return "";
  const stage = Model.stage(c);
  return stage === 1 || stage === 2 ? growthKey(c, stage) : "";
}

function forestRecordYear(c) {
  if (c.completed && c.completed !== "unknown") return c.completed.slice(0, 4);
  if (!c.completed) {
    const date = Model.firstExperienceDate(c);
    if (date) return date.slice(0, 4);
  }
  const date = new Date(c.completedAt || c.saves?.[0]?.at || Date.now());
  return Number.isNaN(date.getTime()) ? now().slice(0, 4) : String(date.getFullYear());
}

function forestItemOrder(c) {
  if (c.completedAt) return Number(c.completedAt) || 0;
  const date = c.completed && c.completed !== "unknown" ? c.completed : Model.firstExperienceDate(c);
  return (date ? new Date(date + "T12:00:00").getTime() : Number(c.saves?.[0]?.at)) || 0;
}

function forestItems(data, period) {
  return data.items
    .filter(
      (c) =>
        ["book", "movie"].includes(c.type) && Model.stage(c) > 0 && forestRecordYear(c) === String(period),
    )
    .sort((a, b) => forestItemOrder(a) - forestItemOrder(b) || a.id.localeCompare(b.id));
}

// Forest tab (redesign 11a): this month's board is the main view; the year is an island of
// twelve month plots; the calendar is the same month seen as stamps.
let forestMode = "month",
  forestShow = "forest",
  forestTypeFilter = "all";

function forestMonthOf(c) {
  if (c.completed) return c.completed === "unknown" ? "" : c.completed.slice(0, 7);
  return now().slice(0, 7);
}

function forestMonthItems(period, type = "all") {
  return state.items
    .filter(
      (c) =>
        ["book", "movie"].includes(c.type) &&
        (type === "all" || c.type === type) &&
        Model.stage(c) > 0 &&
        forestMonthOf(c) === period,
    )
    .sort((a, b) => forestItemOrder(a) - forestItemOrder(b) || a.id.localeCompare(b.id));
}

// With a type filter on, only that type's chip shows (no "영화 0편" next to a book filter).
function forestTypeChips(items, extra = "", type = "all") {
  const done = items.filter((c) => c.completed),
    b = done.filter((c) => c.type === "book").length,
    m = done.filter((c) => c.type === "movie").length;
  return (
    '<div class="forest-chips">' +
    (type !== "movie" ? '<span class="forest-chip is-book">책 <b>' + b + "권</b></span>" : "") +
    (type !== "book" ? '<span class="forest-chip is-movie">영화 <b>' + m + "편</b></span>" : "") +
    extra +
    "</div>"
  );
}

function forestNav(prevAction, nextAction, prevLabel, nextLabel, canNext, canPrev = true) {
  return (
    '<div class="forest-nav">' +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
      prevAction,
      "forest-nav-btn",
      'aria-label="' + prevLabel + '"' + (canPrev ? "" : " disabled"),
    ) +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
      nextAction,
      "forest-nav-btn",
      'aria-label="' + nextLabel + '"' + (canNext ? "" : " disabled"),
    ) +
    "</div>"
  );
}

// Years that actually have trees. A year with none does not exist in the year view.
function forestTreeYears() {
  const cur = now().slice(0, 4),
    c = new Set([cur]);
  state.items.forEach((x) => {
    if (x.completed && x.completed !== "unknown") c.add(forestRecordYear(x));
  });
  return [...c].filter((y) => y && y <= cur && yearForestItems(y, "all").length).sort();
}

function forestYearMonth(y) {
  return y === now().slice(0, 4) ? now().slice(0, 7) : y + "-12";
}

// Month picker: jump straight to any month instead of stepping back one at a time.
function forestMonthPickerHTML(y) {
  const cur = now().slice(0, 7),
    first =
      [
        ...state.items.map((c) => (c.completed && c.completed !== "unknown" ? c.completed : "")),
        ...state.items.flatMap((c) => c.logs.map((l) => l.date)),
        ...state.items.map((c) => c.startedAt || ""),
      ]
        .filter(Boolean)
        .sort()[0] || cur;
  const minY = first.slice(0, 4),
    maxY = cur.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, i) => {
    const period = y + "-" + String(i + 1).padStart(2, "0"),
      future = period > cur,
      n = future ? 0 : forestMonthItems(period).filter((c) => c.completed).length;
    return button(
      "<strong>" + (i + 1) + "월</strong><small>" + (future ? "" : n ? n + "그루" : "—") + "</small>",
      "forestPickMonth",
      "month-pick-cell" + (period === month ? " is-selected" : "") + (period === cur ? " is-current" : ""),
      'data-month="' + period + '" aria-pressed="' + (period === month) + '"' + (future ? " disabled" : ""),
    );
  }).join("");
  return (
    '<div class="month-pick" data-year="' +
    y +
    '"><div class="month-pick-year">' +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
      "forestPickYear",
      "forest-nav-btn",
      'data-year="' + (Number(y) - 1) + '" aria-label="지난해"' + (y > minY ? "" : " disabled"),
    ) +
    "<strong>" +
    y +
    "년</strong>" +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
      "forestPickYear",
      "forest-nav-btn",
      'data-year="' + (Number(y) + 1) + '" aria-label="다음 해"' + (y < maxY ? "" : " disabled"),
    ) +
    '</div><div class="month-pick-grid">' +
    months +
    "</div></div>"
  );
}

// Dropdown under the title (not a sheet). Closed by picking a month or tapping outside.
let forestMonthPopOpen = false;

function forestMonthPopHTML() {
  return forestMonthPopOpen
    ? button("", "forestMonthPickerClose", "month-pop-scrim", 'aria-label="닫기" tabindex="-1"') +
        '<div class="month-pop" role="dialog" aria-label="월 선택">' +
        forestMonthPickerHTML(month.slice(0, 4)) +
        "</div>"
    : "";
}

function renderForest() {
  if (!/^\d{4}-\d{2}$/.test(month) || month > now().slice(0, 7)) month = now().slice(0, 7);
  year = month.slice(0, 4);
  if (forestMode === "year") {
    const ys = forestTreeYears();
    if (ys.length && !ys.includes(year)) {
      year = ys.filter((y) => y <= year).at(-1) || ys[0];
      month = forestYearMonth(year);
    }
  }
  return forestMode === "year" ? renderForestYear() : renderForestMonth();
}

function renderForestMonth() {
  const m = Number(month.slice(5)),
    items = forestMonthItems(month),
    reading = items.filter((c) => !c.completed).length;
  const shareIcon =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
  const head =
    '<div class="forest-top"><h1 class="page-title">' +
    button(
      m +
        '월의 숲<svg class="month-pick-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
      "forestMonthPicker",
      "forest-title-btn" + (forestMonthPopOpen ? " is-open" : ""),
      'aria-label="' +
        month.slice(0, 4) +
        "년 " +
        m +
        '월의 숲, 다른 달 고르기" aria-haspopup="dialog" aria-expanded="' +
        forestMonthPopOpen +
        '"',
    ) +
    "</h1>" +
    forestMonthPopHTML() +
    button(shareIcon, "shareMonth", "forest-share", 'aria-label="' + m + '월의 숲 공유하기"') +
    "</div>" +
    '<div class="forest-title-row"><div>' +
    forestTypeChips(
      items,
      reading
        ? '<span class="forest-reading">' +
            progressLabel(items.filter((c) => !c.completed)) +
            " <b>" +
            reading +
            "</b></span>"
        : "",
    ) +
    "</div>" +
    "</div>"; // months are picked from the title dropdown, so no prev/next arrows here
  const toggle =
    '<div class="forest-toggle" role="group" aria-label="보기 방식">' +
    button(
      icon("forest") + "숲으로 보기",
      "forestShow",
      forestShow === "forest" ? "active" : "",
      'data-show="forest" aria-pressed="' + (forestShow === "forest") + '"',
    ) +
    button(
      icon("today") + "달력으로 보기",
      "forestShow",
      forestShow === "calendar" ? "active" : "",
      'data-show="calendar" aria-pressed="' + (forestShow === "calendar") + '"',
    ) +
    "</div>";
  // The year island sits with the other forest tools instead of above the title.
  const yearTool = button(
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>올해의 숲',
    "forestYearView",
    "forest-tool",
    'aria-label="' + esc(year) + ' 올해의 숲 보기"',
  );
  if (forestShow === "calendar")
    return (
      '<section class="forest-page-section forest-month">' +
      head +
      toggle +
      forestCalendarHTML(month) +
      '<div class="forest-tools-row is-static">' +
      yearTool +
      "</div></section>"
    );
  const board = items.map((c) => ({ ...c, forestTile: "" }));
  const tools =
    '<div class="forest-tools-row">' +
    button(
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>' +
        (forestEditMode ? "완료" : "꾸미기"),
      "forestEdit",
      "forest-tool is-ink",
      'aria-pressed="' + forestEditMode + '"',
    ) +
    button(
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9 5.5 4h13L20 9"/><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z"/><path d="M5 13v7h14v-7"/></svg>상점',
      "bmOpenShop",
      "forest-tool",
    ) +
    button(
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>도감',
      "bmCodex",
      "forest-tool",
    ) +
    yearTool +
    "</div>";
  return (
    '<section class="forest-page-section forest-month is-board">' +
    head +
    toggle +
    '<div class="forest-board"><div class="forest-viewport ' +
    (forestEditMode ? "editing" : "") +
    '" id="forestViewport" data-theme="basic" tabindex="0" aria-label="' +
    (forestEditMode
      ? "꾸미기 중. 바꿀 나무를 선택하세요."
      : m + "월의 숲, " + items.length + "그루. 나무를 선택해 기록을 볼 수 있어요.") +
    '">' +
    forestSVG(board, "basic", true, { transient: true, grid: "month" }) +
    "</div>" +
    '<div class="forest-float">' +
    (forestEditMode
      ? bmEditBarHTML()
      : (items.length
          ? ""
          : '<p class="forest-empty">' +
            (month === now().slice(0, 7)
              ? "이번 달 첫 기록을 남기면 새싹이 자라요"
              : "이 달에는 심은 나무가 없어요") +
            "</p>") + tools) +
    "</div></div></section>"
  );
}

const FOREST_MONTH_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function forestCalendarHTML(period) {
  const [y, m] = period.split("-").map(Number),
    start = new Date(y, m - 1, 1).getDay(),
    days = new Date(y, m, 0).getDate(),
    today = now();
  const check =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  let cells =
    FOREST_MONTH_NAMES.map(
      (d, i) => '<span class="fcal-weekday' + (i === 0 ? " is-sun" : "") + '">' + d + "</span>",
    ).join("") + "<span></span>".repeat(start);
  for (let d = 1; d <= days; d++) {
    const date = period + "-" + String(d).padStart(2, "0"),
      done = state.items.filter((c) => c.completed === date),
      logged = state.items.some((c) => c.logs.some((l) => l.date === date));
    const label =
      date +
      (done.length
        ? " · " + done.map((c) => c.title).join(", ") + " 완료"
        : logged
          ? " · 기록함"
          : " · 기록 없음");
    cells +=
      '<button type="button" class="fcal-day' +
      (date === today ? " is-today" : "") +
      (done.length ? " is-done" : logged ? " is-logged" : "") +
      '"' +
      (done.length ? ' data-type="' + done[0].type + '"' : "") +
      ' data-action="day" data-date="' +
      date +
      '" aria-label="' +
      esc(label) +
      '"' +
      (date > today ? " disabled" : "") +
      '><span class="fcal-num">' +
      d +
      "</span>" +
      (done.length
        ? '<span class="fcal-tree">' + stickerTree(done[0], 3) + "</span>"
        : logged
          ? '<span class="fcal-stamp">' + check + "</span>"
          : "") +
      "</button>";
  }
  const finished = state.items
    .filter((c) => c.completed && c.completed.startsWith(period))
    .sort((a, b) => b.completed.localeCompare(a.completed) || (b.completedAt || 0) - (a.completedAt || 0));
  const card = (c) => {
    const dt = new Date(c.completed + "T12:00:00Z");
    return (
      '<button type="button" class="fcal-card" data-action="detail" ' +
      attr(c.id) +
      ">" +
      stickerCover(c) +
      '<span class="fcal-card-copy"><small>' +
      (dt.getUTCMonth() + 1) +
      "월 " +
      dt.getUTCDate() +
      "일 " +
      FOREST_MONTH_NAMES[dt.getUTCDay()] +
      " · " +
      "완료" +
      "</small><strong>" +
      esc(c.title) +
      "</strong><span>" +
      (validRating(c.rating) ? "<b>★</b> " + c.rating + " · " : "") +
      esc(c.hiddenTree ? bmTreeName("mystery-" + c.hiddenTree) : contentSpecies(c)?.name || "나무") +
      "로 심었어요</span></span>" +
      stickerTree(c, 3, "is-cut-sm") +
      "</button>"
    );
  };
  return (
    '<div class="fcal"><div class="fcal-grid">' +
    cells +
    '</div><div class="fcal-legend"><span><i class="is-logged"></i>기록한 날</span><span><i class="is-done"></i>다 읽은 날</span><span><i class="is-done is-movie"></i>다 본 날</span></div></div>' +
    (finished.length ? '<div class="fcal-cards">' + finished.map(card).join("") + "</div>" : "")
  );
}

// Year island: twelve 5×5 plots, three per row, laid out on one isometric block.
// Each month plot is a 5×5 grid; trees take cells in a shuffled (but stable) order so they
// spread over the plot instead of filling it row by row.
// Trees scatter over each month plot: every tree takes the most open of a dozen seeded random
// spots inside the diamond, so the plot fills evenly without lining up in rows.
// Year forest: one square, slightly bumpy low-poly board. Every tree from the year is planted in order,
// from the back corner forward. The board is the smallest square that holds them, so it never looks empty.
// Past the latest year, › shows 평생의 숲: every tree ever planted on one board (y==='all').
let forestLifetime = false;

function yearForestItems(y, type) {
  const current = now().slice(0, 7);
  // Only finished works count as planted trees here (and in shares); growing ones live in the month forest.
  const items = state.items.filter(
    (c) =>
      ["book", "movie"].includes(c.type) &&
      (type === "all" || c.type === type) &&
      c.completed &&
      (y === "all" || forestRecordYear(c) === y),
  );
  const key = (c) =>
    c.completed && c.completed !== "unknown"
      ? c.completed
      : "9999" +
        (c.logs
          .map((l) => l.date)
          .sort()
          .at(-1) ||
          c.startedAt ||
          "");
  return items.sort((a, b) => key(a).localeCompare(key(b)));
}

function yearBoardGeometry(y, items) {
  const W = 390,
    H = 250,
    n = items.length,
    N = Math.max(2, Math.ceil(Math.sqrt(n)));
  const BW = Math.min(170, 95 + N * 9),
    y0 = 46 + (170 - BW) / 2,
    cx = W / 2,
    rnd = (k) => (hash(y + "|board|" + k) % 100000) / 100000;
  const ground = polyGround(
    cx,
    y0 + BW / 2,
    BW,
    BW / 2,
    16,
    Math.max(3, Math.min(6, N + 1)),
    "year" + y + N,
    POLY_FLOORS[bmFloorId()] ? bmFloorId() : "basic",
  );
  // cells back to front, centre-out along each diagonal
  const cellW = BW / N,
    cellH = cellW / 2,
    cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push({ r, c });
  cells.sort((p, q) => p.r + p.c - (q.r + q.c) || Math.abs(p.c - p.r) - Math.abs(q.c - q.r) || p.c - q.c);
  const center = ({ r, c }) => [cx + (c - r) * cellW, y0 + (c + r + 1) * cellH];
  const trees = items.map((it, k) => {
    const cell = cells[k],
      [x, yy] = center(cell),
      stage = it.completed ? 3 : Model.stage(it),
      base = cellW * 2.25;
    return {
      x: x + (rnd("tx" + it.id) - 0.5) * cellW * 0.5,
      y: yy + (rnd("ty" + it.id) - 0.5) * cellH * 0.5,
      src:
        stage === 3 && it.hiddenTree && bmFloorId() === "snow"
          ? (SONGLIM_TREE_ASSETS["winter" + (it.hiddenTree === "A" ? "shining" : "moonlight")] || {}).src ||
            stickerTreeSrc(it, stage)
          : stickerTreeSrc(it, stage),
      size: +(base * (stage === 3 ? 1 : stage === 2 ? 0.62 : 0.45)).toFixed(1),
      id: it.id,
    };
  });
  const dots = cells
    .slice(n)
    .filter((_, k) => k % 2 === 0)
    .map((cell) => {
      const [x, yy] = center(cell);
      return { x, y: yy };
    });
  return { W, H, ground, trees: trees.sort((a, b) => a.y - b.y), dots, cellW };
}

function forestYearIsland(y, type) {
  const g = yearBoardGeometry(y, yearForestItems(y, type));
  return (
    '<svg class="forest-island forest-year-board" viewBox="0 0 ' +
    g.W +
    " " +
    g.H +
    '" role="img" aria-label="' +
    (y === "all" ? forestLifetimeName() : y + "년의 숲") +
    ", " +
    g.trees.length +
    '그루">' +
    polyGroundSVG(g.ground) +
    g.dots
      .map(
        (d) =>
          '<ellipse cx="' +
          d.x.toFixed(1) +
          '" cy="' +
          d.y.toFixed(1) +
          '" rx="' +
          (g.cellW * 0.16).toFixed(1) +
          '" ry="' +
          (g.cellW * 0.08).toFixed(1) +
          '" fill="' +
          g.ground.dot +
          '"/>',
      )
      .join("") +
    g.trees
      .map(
        (t) =>
          '<image href="' +
          esc(t.src) +
          '" x="' +
          (t.x - t.size / 2).toFixed(1) +
          '" y="' +
          (t.y - t.size * 0.875).toFixed(1) +
          '" width="' +
          t.size +
          '" height="' +
          t.size +
          '" pointer-events="none"/>',
      )
      .join("") +
    "</svg>"
  );
}

function renderForestYear() {
  const treeYears = forestTreeYears();
  if (!treeYears.length)
    return (
      '<section class="forest-page-section forest-year"><div class="forest-top">' +
      button(
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>' +
          Number(month.slice(5)) +
          "월의 숲",
        "forestMonthView",
        "forest-back",
        'data-month="' + month + '"',
      ) +
      '</div><div class="empty"><span class="empty-icon" aria-hidden="true">' +
      icon("forest") +
      "</span><h3>아직 심은 나무가 없어요</h3><p>작품을 다 읽거나 보면<br>올해의 숲에 나무가 생겨요.</p></div></section>"
    );
  if (forestLifetime) return renderForestLifetime(treeYears);
  const type = forestTypeFilter,
    current = now().slice(0, 7),
    all = yearForestItems(year, type);
  const filters =
    '<div class="forest-type-filter" role="group" aria-label="종류">' +
    [
      ["all", "전체"],
      ["book", "책"],
      ["movie", "영화"],
    ]
      .map(([k, l]) =>
        button(
          l,
          "forestType",
          k === type ? "active" : "",
          'data-type="' + k + '" aria-pressed="' + (k === type) + '"',
        ),
      )
      .join("") +
    "</div>";
  const head =
    '<div class="forest-top">' +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>' +
        Number(month.slice(5)) +
        "월의 숲",
      "forestMonthView",
      "forest-back",
      'data-month="' + month + '"',
    ) +
    filters +
    "</div>" +
    '<div class="forest-title-row"><div><span class="forest-year-label">' +
    esc(year) +
    '</span><h1 class="page-title">올해의 숲</h1>' +
    forestTypeChips(all, '<span class="forest-reading">' + all.length + "그루</span>", forestTypeFilter) +
    "</div>" +
    forestNav(
      "forestPrevYear",
      "forestNextYear",
      "지난해",
      treeYears.some((y) => y > year) ? "다음 해" : forestLifetimeName(),
      true,
      treeYears.some((y) => y < year),
    ) +
    "</div>";
  const cards = Array.from({ length: 12 }, (_, i) => {
    const period = year + "-" + String(i + 1).padStart(2, "0"),
      future = period > current,
      items = future ? [] : forestMonthItems(period, type),
      done = items.filter((c) => c.completed),
      b = done.filter((c) => c.type === "book").length,
      m = done.filter((c) => c.type === "movie").length;
    return future
      ? '<div class="forest-month-card is-future"><strong>' + (i + 1) + "월</strong><small>—</small></div>"
      : button(
          "<strong>" +
            (i + 1) +
            "월<b>" +
            done.length +
            "</b></strong><small>" +
            (forestTypeFilter === "book"
              ? "책 " + b + "권"
              : forestTypeFilter === "movie"
                ? "영화 " + m + "편"
                : "책 " + b + " · 영화 " + m) +
            "</small>",
          "forestMonthView",
          "forest-month-card" + (period === current ? " is-current" : ""),
          'data-month="' + period + '"',
        );
  }).join("");
  return (
    '<section class="forest-page-section forest-year">' +
    head +
    '<div class="forest-island-wrap">' +
    forestYearIsland(year, type) +
    '</div><div class="forest-month-grid">' +
    cards +
    "</div>" +
    (all.length
      ? '<div class="forest-year-share">' +
        button(
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>올해의 숲 자랑하기',
          "shareForest",
          "primary",
        ) +
        "</div>"
      : "") +
    "</section>"
  );
}

function forestLifetimeName() {
  return (String(state.profile?.name || "").trim() || "나") + "의 숲";
}

function renderForestLifetime(treeYears) {
  const type = forestTypeFilter,
    all = yearForestItems("all", type),
    first = treeYears[0],
    last = treeYears.at(-1);
  const back =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
  const filters =
    '<div class="forest-type-filter" role="group" aria-label="종류">' +
    [
      ["all", "전체"],
      ["book", "책"],
      ["movie", "영화"],
    ]
      .map(([k, l]) =>
        button(
          l,
          "forestType",
          k === type ? "active" : "",
          'data-type="' + k + '" aria-pressed="' + (k === type) + '"',
        ),
      )
      .join("") +
    "</div>";
  const head =
    '<div class="forest-top">' +
    button(
      back + Number(month.slice(5)) + "월의 숲",
      "forestMonthView",
      "forest-back",
      'data-month="' + month + '"',
    ) +
    filters +
    "</div>" +
    '<div class="forest-title-row"><div><span class="forest-year-label">' +
    esc(first === last ? first : first + "–" + last) +
    '</span><h1 class="page-title">' +
    esc(forestLifetimeName()) +
    "</h1>" +
    forestTypeChips(all, '<span class="forest-reading">' + all.length + "그루</span>", type) +
    "</div>" +
    forestNav("forestPrevYear", "forestNextYear", last + "년의 숲", "", false, true) +
    "</div>";
  const cards = [...treeYears]
    .reverse()
    .map((y) => {
      const done = yearForestItems(y, type),
        b = done.filter((c) => c.type === "book").length,
        m = done.filter((c) => c.type === "movie").length;
      return button(
        "<strong>" +
          y +
          "<b>" +
          done.length +
          "</b></strong><small>" +
          (type === "book"
            ? "책 " + b + "권"
            : type === "movie"
              ? "영화 " + m + "편"
              : "책 " + b + " · 영화 " + m) +
          "</small>",
        "forestPickYearCard",
        "forest-month-card" + (y === now().slice(0, 4) ? " is-current" : ""),
        'data-year="' + y + '"',
      );
    })
    .join("");
  return (
    '<section class="forest-page-section forest-year is-lifetime">' +
    head +
    '<div class="forest-island-wrap">' +
    forestYearIsland("all", type) +
    '</div><div class="forest-month-grid">' +
    cards +
    "</div>" +
    (all.length
      ? '<div class="forest-year-share">' +
        button(
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>' +
            esc(forestLifetimeName()) +
            " 자랑하기",
          "shareForest",
          "primary",
        ) +
        "</div>"
      : "") +
    "</section>"
  );
}

function calendarHTML(period) {
  const [y, m] = period.split("-").map(Number),
    start = new Date(y, m - 1, 1).getDay(),
    days = new Date(y, m, 0).getDate();
  let html =
    '<div class="cal">' +
    ["일", "월", "화", "수", "목", "금", "토"].map((d) => '<div class="weekday">' + d + "</div>").join("") +
    "<div></div>".repeat(start);
  for (let d = 1; d <= days; d++) {
    const date = period + "-" + String(d).padStart(2, "0");
    const list = state.items
      .filter((c) => c.completed === date || c.logs.some((l) => l.date === date))
      .sort((a, b) => Number(b.completed === date) - Number(a.completed === date));
    const completed = list.filter((c) => c.completed === date),
      first = list[0];
    const label =
      date +
      (list.length
        ? " · " + list.map((c) => c.title + (c.completed === date ? " 완료" : " 기록")).join(", ")
        : " 기록 없음");
    html +=
      '<button class="day ' +
      (date === now() ? "today " : "") +
      (completed.length ? "completed " : "") +
      '" data-action="day" data-date="' +
      date +
      '" aria-label="' +
      esc(label) +
      '"><span>' +
      d +
      "</span>" +
      (first
        ? '<span class="day-cover">' +
          (first.cover
            ? '<img data-cover-kind="' +
              first.type +
              '" data-cover-mini="true" src="' +
              esc(first.cover) +
              '" alt="" decoding="async">'
            : '<span class="mini-cover">' + icon(first.type) + "</span>") +
          "</span>" +
          (list.length > 1 ? '<span class="plus">+' + (list.length - 1) + "</span>" : "")
        : "") +
      "</button>";
  }
  return html + "</div>";
}

function renderCalendar() {
  const stats = Model.stats(Model.completed(state, month));
  const recordedDays = new Set(
    state.items
      .flatMap((c) =>
        c.logs.map((l) => l.date).concat(c.completed && c.completed !== "unknown" ? [c.completed] : []),
      )
      .filter((d) => d.startsWith(month)),
  ).size;
  return (
    '<section><div class="page-heading"><h1 class="page-title">월간 기록</h1></div><p class="page-caption">한 달의 경험을 모아 살펴보세요.</p><div class="month-head">' +
    button("‹", "prevMonth", "iconbtn", 'aria-label="이전 달"') +
    button(month.replace("-", "년 ") + "월 ▾", "months", "textbtn") +
    button(
      "›",
      "nextMonth",
      "iconbtn",
      'aria-label="다음 달" ' + (month >= now().slice(0, 7) ? "disabled" : ""),
    ) +
    "</div>" +
    calendarHTML(month) +
    '<p class="summary">기록한 날 ' +
    recordedDays +
    '일</p><div class="rule"></div><p><strong>완료한 작품 ' +
    stats.n +
    '개</strong></p><p class="summary">책 ' +
    stats.book +
    " · 영화 " +
    stats.movie +
    "</p>" +
    button("기록 공유하기", "shareMonth", "primary", recordedDays ? "" : "disabled") +
    (!recordedDays ? '<p class="creator center">이달의 기록을 남기면 이미지로 공유할 수 있어요.</p>' : "") +
    "</section>"
  );
}

const TREE_UNLOCK_TEST_CASES = [
  ["book-literature", "book", "소설"],
  ["book-humanities", "book", "철학"],
  ["book-science", "book", "과학"],
  ["album-classical", "album", "클래식"],
  ["album-popular", "album", "팝"],
  ["album-roots", "album", "재즈"],
  ["movie-drama", "movie", "드라마"],
  ["movie-sf", "movie", "SF"],
  ["movie-action", "movie", "액션"],
  ["other", "movie", "다큐멘터리"],
];

function addTreeUnlockTestData() {
  const stamp = Date.now(),
    date = now();
  TREE_UNLOCK_TEST_CASES.forEach(([catId, type, genre], catIndex) => {
    for (let i = 1; i <= 3; i++) {
      const title = "도감 테스트 · " + catId + " " + i,
        creator = APP_BRAND.ko + " 테스트",
        request = "tree-unlock-" + catId + "-" + i;
      let c = state.items.find((x) => x.source === "나무 도감 테스트 데이터" && x.title === title);
      if (!c)
        c = Model.add(
          state,
          { type, title, creator, genre, genreSource: "user", source: "나무 도감 테스트 데이터" },
          request,
        );
      c.genre = genre;
      c.genreSource = "user";
      c.completed = date;
      c.completedAt = stamp + catIndex * 10 + i;
      c.source = "나무 도감 테스트 데이터";
      c.logs = [];
    }
  });
  ensureCompletedSpeciesAssignments();
  if (!persist()) return;
  render();
  toast("각 나무에 완료 경험 3개씩 넣었어요. 일반 나무 20종이 모두 해금돼요.");
}

let forestViewportYear = null,
  forestViewportFrame = null;

function forestCameraFrame(vp, world, bounds = world.getBBox()) {
  const unit = Math.min(vp.clientWidth / 720, vp.clientHeight / 540) || 1;
  // Floating controls cover part of a full-bleed board: fit the plot into what is left and
  // shift its centre by half the difference.
  const tools = vp.closest(".forest-board")?.querySelector(".forest-tools-row"),
    vr = vp.getBoundingClientRect();
  const insetTop = tools ? 18 : 0,
    insetBottom = tools ? Math.max(0, vr.bottom - tools.getBoundingClientRect().top + 10) : 0,
    shiftY = (insetTop - insetBottom) / 2 / unit;
  const padding = 14,
    visibleW = vp.clientWidth / unit,
    visibleH = vp.clientHeight / unit;
  const fit = Math.min(
    (vp.clientWidth - padding * 2) / (Math.max(1, bounds.width) * unit),
    (vp.clientHeight - insetTop - insetBottom - padding * 2) / (Math.max(1, bounds.height) * unit),
  );
  return {
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    unit,
    visibleW,
    visibleH,
    padding: padding / unit,
    fit,
    min: fit * 0.4,
    max: fit * 2.4,
    cx: bounds.x + bounds.width / 2,
    cy: bounds.y + bounds.height / 2,
    tier:
      forestBoardConfig(forestBoardCount(vp), vp.querySelector("svg[data-grid]")?.dataset.grid).tier +
      (vp.querySelector("svg[data-grid]") ? "m" : ""),
    shiftY,
  };
}

// The board on screen may be one month, not the whole year: size everything from what was drawn.
function forestBoardCount(vp) {
  const n = vp?.querySelector("svg[data-count]")?.dataset.count;
  return n != null ? +n : forestItems(state, year).length;
}

function forestFittedState(frame) {
  return {
    scale: frame.fit,
    x: (360 - frame.cx) * frame.fit,
    y: (270 - frame.cy) * frame.fit + (frame.shiftY || 0),
  };
}

function initializeForestViewport(frame) {
  const previous = forestViewportFrame;
  if (
    forestViewportYear !== year + "|" + month ||
    !previous ||
    previous.tier !== frame.tier ||
    zoomState.scale <= previous.fit * 1.03
  ) {
    zoomState = forestFittedState(frame);
  } else {
    const scale = Math.max(frame.min, Math.min(frame.max, (zoomState.scale / previous.fit) * frame.fit)),
      ratio = scale / zoomState.scale;
    zoomState = { scale, x: zoomState.x * ratio, y: zoomState.y * ratio };
  }
  forestViewportYear = year + "|" + month;
  forestViewportFrame = frame;
}

function setupForest() {
  const vp = $("forestViewport"),
    world = vp?.querySelector("#forest-world");
  if (!vp || !world) return;
  const pointers = new Map();
  let prev = null,
    suppressClick = false,
    sel = null;

  const SVG_NS = "http://www.w3.org/2000/svg",
    TYPE_LABEL = { book: "책", album: "음반", movie: "영화" },
    TAP_RADIUS = 24;
  const tip = document.createElement("button");
  tip.type = "button";
  tip.className = "forest-tree-tooltip";
  tip.setAttribute("aria-hidden", "true");
  tip.tabIndex = -1;
  vp.appendChild(tip);

  /* 선택/호버된 나무 발밑 링 — SVG 요소라 iOS Safari에서도 확실히 그려진다(CSS filter 글로우는 SVG 자식에 안 먹는 경우가 있음). */
  const setFocusRing = (g, mode) => {
    vp.querySelectorAll(".tree-ring").forEach((r) => r.remove());
    vp.querySelectorAll(".is-focus").forEach((x) => x.classList.remove("is-focus"));
    if (!g) return;
    // Selection is a soft warm glow on the ground under the tree, not an outlined ring.
    const svg = vp.querySelector("svg");
    if (svg && !svg.querySelector("#treeSelectGlow"))
      (
        svg.querySelector("defs") ||
        svg.insertBefore(document.createElementNS(SVG_NS, "defs"), svg.firstChild)
      ).insertAdjacentHTML(
        "beforeend",
        '<radialGradient id="treeSelectGlow"><stop offset="0" stop-color="#FFF6CF" stop-opacity=".95"/><stop offset=".5" stop-color="#FFF6CF" stop-opacity=".55"/><stop offset="1" stop-color="#FFF6CF" stop-opacity="0"/></radialGradient>',
      );
    const shadow = g.querySelector("ellipse"),
      rx = (parseFloat(shadow?.getAttribute("rx")) || 22) * 2.1 + 6;
    const ring = document.createElementNS(SVG_NS, "ellipse");
    ring.setAttribute("class", "tree-ring " + mode);
    ring.setAttribute("cx", shadow?.getAttribute("cx") || "0");
    ring.setAttribute("cy", shadow?.getAttribute("cy") || "10");
    ring.setAttribute("rx", rx.toFixed(1));
    ring.setAttribute("ry", (rx * 0.46).toFixed(1));
    ring.setAttribute("fill", "url(#treeSelectGlow)");
    if (shadow) shadow.after(ring);
    else g.prepend(ring);
    g.classList.add("is-focus");
  };
  const hideTip = () => {
    if (!sel && !tip.classList.contains("show")) return;
    sel = null;
    tip.classList.remove("show", "pinned");
    tip.setAttribute("aria-hidden", "true");
    tip.tabIndex = -1;
    tip.removeAttribute("data-action");
    tip.removeAttribute("data-id");
    tip.removeAttribute("aria-label");
    vp.classList.remove("has-pin");
    setFocusRing(null);
  };
  /* 카드는 마우스 커서가 아니라 '나무'에 붙는다: 머리 위 중앙, 공간이 없으면 발밑으로 뒤집히고, 화살표가 나무를 가리킨다. */
  const placeTip = (g) => {
    const vr = vp.getBoundingClientRect(),
      gr = g.getBoundingClientRect(),
      pad = 8,
      gap = 10;
    tip.style.left = "0px";
    tip.style.top = "0px";
    const tw = tip.offsetWidth,
      th = tip.offsetHeight,
      cx = gr.left + gr.width / 2 - vr.left;
    const x = Math.min(Math.max(cx - tw / 2, pad), Math.max(pad, vr.width - tw - pad));
    let y = gr.top - vr.top - th - gap,
      below = false;
    if (y < pad) {
      below = true;
      y = gr.bottom - vr.top + gap;
    }
    if (y + th > vr.height - pad) y = Math.max(pad, vr.height - th - pad);
    tip.style.left = x.toFixed(1) + "px";
    tip.style.top = y.toFixed(1) + "px";
    tip.style.setProperty("--ax", Math.min(Math.max(cx - x, 18), Math.max(18, tw - 18)).toFixed(1) + "px");
    tip.classList.toggle("below", below);
  };
  const showTip = (g, mode) => {
    const id = g.getAttribute("data-tree") || "",
      c = id ? get(id) : null;
    if (!c) {
      hideTip();
      return;
    }
    const pin = mode === "pin",
      genre = String(c.genre || "").trim() || "미분류";
    tip.innerHTML =
      '<span class="ftt-body"><strong>' +
      esc(c.title) +
      '</strong><small><i class="ftt-type" data-type="' +
      esc(c.type) +
      '">' +
      (TYPE_LABEL[c.type] || "콘텐츠") +
      "</i><span>" +
      esc(genre) +
      "</span></small></span>" +
      (pin ? '<span class="ftt-go" aria-hidden="true">›</span>' : "");
    tip.classList.toggle("pinned", pin);
    if (pin) {
      tip.removeAttribute("aria-hidden");
      tip.tabIndex = 0;
      tip.dataset.action = "detail";
      tip.dataset.id = id;
      tip.setAttribute("aria-label", c.title + " 상세 보기");
    } else {
      tip.setAttribute("aria-hidden", "true");
      tip.tabIndex = -1;
      tip.removeAttribute("data-action");
      tip.removeAttribute("data-id");
      tip.removeAttribute("aria-label");
    }
    vp.classList.toggle("has-pin", pin);
    setFocusRing(g, mode);
    placeTip(g);
    tip.classList.add("show");
    sel = { g, mode };
  };

  /* 터치는 손가락이 굵고 나무는 작다 → 나무 히트영역이 화면상 반지름 24px(지름 48px)보다 작으면 그만큼 넓혀서 가장 가까운 나무를 잡는다. */
  const nearestTree = (x, y, minR) => {
    let best = null,
      bestScore = 1;
    vp.querySelectorAll("[data-tree]").forEach((g) => {
      const h = g.querySelector(".tree-hit");
      if (!h) return;
      const r = h.getBoundingClientRect(),
        eff = Math.max(Math.max(r.width, r.height) / 2, minR),
        score = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) / eff;
      if (score < bestScore) {
        bestScore = score;
        best = g;
      }
    });
    return best;
  };
  const pickTree = (e) => {
    const hit = e.target.closest?.("[data-tree]");
    if (hit && !e.target.classList?.contains("tree-hit")) return hit;
    return nearestTree(e.clientX, e.clientY, e.pointerType === "mouse" ? 0 : TAP_RADIUS) || hit || null;
  };

  vp.addEventListener("pointerleave", () => {
    if (sel?.mode === "hover") hideTip();
  });
  vp.addEventListener("focusin", (e) => {
    const g = e.target.closest?.("[data-tree]");
    if (g && pointers.size === 0 && g.matches(":focus-visible")) showTip(g, "pin");
  });
  vp.addEventListener("focusout", (e) => {
    if (sel?.mode !== "pin" && e.target.closest?.("[data-tree]") && !tip.contains(e.relatedTarget)) hideTip();
  });
  let camera = forestCameraFrame(vp, world),
    zoomFrame = 0,
    zoomTarget,
    lastZoomFrame = 0;
  initializeForestViewport(camera);
  zoomTarget = { ...zoomState };
  const clampCamera = (s) => {
    s.scale = Math.max(camera.min, Math.min(camera.max, s.scale));
    const homeX = (360 - camera.cx) * s.scale,
      homeY = (270 - camera.cy) * s.scale + (camera.shiftY || 0);
    const maxX = Math.max(0, (camera.bounds.width * s.scale - camera.visibleW + camera.padding * 2) / 2);
    const maxY = Math.max(0, (camera.bounds.height * s.scale - camera.visibleH + camera.padding * 2) / 2);
    s.x = Math.max(homeX - maxX, Math.min(homeX + maxX, s.x));
    s.y = Math.max(homeY - maxY, Math.min(homeY + maxY, s.y));
    return s;
  };
  const apply = () => {
    clampCamera(zoomState);
    world.setAttribute(
      "transform",
      "translate(" +
        (360 * (1 - zoomState.scale) + zoomState.x) +
        " " +
        (270 * (1 - zoomState.scale) + zoomState.y) +
        ") scale(" +
        zoomState.scale +
        ")",
    );
  };
  const stopZoom = () => {
    cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
    lastZoomFrame = 0;
    zoomTarget = { ...zoomState };
  };
  const animateZoom = (timestamp) => {
    if (!vp.isConnected) {
      stopZoom();
      return;
    }
    const elapsed = lastZoomFrame ? Math.min(40, timestamp - lastZoomFrame) : 16;
    lastZoomFrame = timestamp;
    const ease = 1 - Math.exp(-elapsed / 65);
    for (const key of ["scale", "x", "y"]) zoomState[key] += (zoomTarget[key] - zoomState[key]) * ease;
    apply();
    if (
      Math.abs(zoomTarget.scale - zoomState.scale) < 0.0002 &&
      Math.abs(zoomTarget.x - zoomState.x) < 0.05 &&
      Math.abs(zoomTarget.y - zoomState.y) < 0.05
    ) {
      zoomState = { ...zoomTarget };
      apply();
      zoomFrame = 0;
      lastZoomFrame = 0;
    } else zoomFrame = requestAnimationFrame(animateZoom);
  };
  const smoothTo = (next) => {
    zoomTarget = clampCamera({ ...next });
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) {
      stopZoom();
      zoomState = { ...next };
      apply();
      zoomTarget = { ...zoomState };
      return;
    }
    if (!zoomFrame) zoomFrame = requestAnimationFrame(animateZoom);
  };
  const zoomAt = (scale, point = { x: 360, y: 270 }) => {
    const next = Math.max(camera.min, Math.min(camera.max, scale)),
      ratio = next / zoomTarget.scale;
    smoothTo({
      scale: next,
      x: point.x - 360 - (point.x - 360 - zoomTarget.x) * ratio,
      y: point.y - 270 - (point.y - 270 - zoomTarget.y) * ratio,
    });
  };
  const fitForest = () => {
    hideTip();
    smoothTo(forestFittedState(camera));
  };
  const svgPoint = (x, y) =>
    new DOMPoint(x, y).matrixTransform(vp.querySelector("svg").getScreenCTM().inverse());
  window.applyForest = () => {
    stopZoom();
    apply();
    zoomTarget = { ...zoomState };
  };
  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (!vp.isConnected) return;
          const next = forestCameraFrame(vp, world, camera.bounds);
          if (
            Math.abs(next.visibleW - camera.visibleW) < 0.01 &&
            Math.abs(next.visibleH - camera.visibleH) < 0.01 &&
            Math.abs(next.unit - camera.unit) < 0.00001
          )
            return;
          hideTip();
          stopZoom();
          const prior = camera;
          camera = next;
          if (zoomState.scale <= prior.fit * 1.03) zoomState = forestFittedState(camera);
          else {
            const scale = (zoomState.scale / prior.fit) * camera.fit,
              ratio = scale / zoomState.scale;
            zoomState = { scale, x: zoomState.x * ratio, y: zoomState.y * ratio };
          }
          forestViewportFrame = camera;
          apply();
          zoomTarget = { ...zoomState };
        })
      : null;
  observer?.observe(vp);
  window.__songrimForestCleanup = () => {
    stopZoom();
    observer?.disconnect();
    clearTimeout(window.__songrimVisitorTimer);
    window.__songrimVisitorTimer = null;
  };

  vp.addEventListener("pointerdown", (e) => {
    if (tip.contains(e.target)) return;
    stopZoom();
    const direct = e.target.closest?.("[data-tree]");
    if (direct && !forestEditMode && e.pointerType === "mouse") {
      e.preventDefault();
      try {
        direct.blur?.();
      } catch {}
    }
    if (pointers.size >= 1) {
      hideTip();
      pointers.forEach((p) => (p.moved = true));
    }
    const tree = pickTree(e);
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: pointers.size > 0,
      tree,
      treeId: tree?.getAttribute("data-tree") || "",
    });
    if (e.pointerType !== "mouse") {
      try {
        vp.setPointerCapture(e.pointerId);
      } catch {}
    }
    const pts = [...pointers.values()];
    prev =
      pts.length >= 2
        ? {
            d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2,
          }
        : null;
  });
  vp.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" && pointers.size === 0) {
      if (!sel || sel.mode === "hover") {
        const t = e.target.closest?.("[data-tree]");
        if (t) {
          if (!sel || sel.g !== t) showTip(t, "hover");
        } else hideTip();
      }
      return;
    }
    if (!pointers.has(e.pointerId)) return;
    const before = pointers.get(e.pointerId),
      moved =
        before.moved ||
        Math.hypot(e.clientX - before.startX, e.clientY - before.startY) >
          (e.pointerType === "mouse" ? 7 : 10);
    if (moved && !before.moved) {
      hideTip();
      if (e.pointerType === "mouse") {
        try {
          vp.setPointerCapture(e.pointerId);
        } catch {}
      }
    }
    pointers.set(e.pointerId, { ...before, x: e.clientX, y: e.clientY, moved });
    const pts = [...pointers.values()];
    if (pts.length >= 2) {
      hideTip();
      pointers.forEach((p) => (p.moved = true));
      const mid = {
        d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      if (prev && prev.d > 0) {
        const svg = vp.querySelector("svg"),
          m = svg.getScreenCTM().inverse();
        const old = new DOMPoint(prev.x, prev.y).matrixTransform(m),
          cur = new DOMPoint(mid.x, mid.y).matrixTransform(m);
        const scale = Math.max(camera.min, Math.min(camera.max, (zoomState.scale * mid.d) / prev.d)),
          ratio = scale / zoomState.scale;
        zoomState.x = cur.x - 360 - (old.x - 360 - zoomState.x) * ratio;
        zoomState.y = cur.y - 270 - (old.y - 270 - zoomState.y) * ratio;
        zoomState.scale = scale;
      }
      prev = mid;
    } else if (moved) {
      if (zoomState.scale > camera.fit * 1.03 || e.pointerType === "mouse") {
        zoomState.x += (e.clientX - before.x) / camera.unit;
        zoomState.y += (e.clientY - before.y) / camera.unit;
      } else if (e.pointerType !== "mouse") window.scrollBy(0, before.y - e.clientY);
    }
    apply();
    zoomTarget = { ...zoomState };
  });
  const up = (e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    prev = null;
    if (!p || p.moved || pointers.size > 0) return;
    // A touch tap is followed by a synthetic click at the same spot. Opening a sheet or page on
    // pointerup let that click land on whatever just appeared (the sheet backdrop or a tree card),
    // so the action runs once the click has been swallowed (or shortly after, if none comes).
    if (!forestEditMode && p.treeId && forestGrowthKey(get(p.treeId))) {
      hideTip();
      deferTap(() => openDetail(p.treeId));
      return;
    }
    if (forestEditMode) {
      if (p.treeId) {
        hideTip();
        deferTap(() => openTreePicker(p.treeId));
      }
      return;
    }
    if (!p.tree) {
      hideTip();
      return;
    }
    if (sel?.mode === "pin" && sel.g === p.tree) hideTip();
    else showTip(p.tree, "pin");
  };
  vp.addEventListener("pointerup", up);
  vp.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    prev = null;
  });
  vp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (!e.deltaY) return;
      hideTip();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vp.clientHeight : 1;
      const delta = Math.max(-64, Math.min(64, e.deltaY * unit));
      zoomAt(zoomTarget.scale * Math.exp(-delta * 0.001), svgPoint(e.clientX, e.clientY));
    },
    { passive: false },
  );
  let pendingTap = null,
    pendingTapTimer = 0;
  const runPendingTap = () => {
    clearTimeout(pendingTapTimer);
    const run = pendingTap;
    pendingTap = null;
    suppressClick = false;
    run?.();
  };
  const deferTap = (fn) => {
    suppressClick = true;
    pendingTap = fn;
    clearTimeout(pendingTapTimer);
    pendingTapTimer = setTimeout(runPendingTap, 350);
  };
  vp.addEventListener("click", (e) => {
    if (suppressClick || (!forestEditMode && e.target.closest?.("[data-tree]"))) {
      e.preventDefault();
      e.stopPropagation();
      if (pendingTap) setTimeout(runPendingTap, 0);
      return;
    }
  });
  vp.addEventListener("dblclick", (e) => {
    if (e.target.closest?.("[data-tree]") || tip.contains(e.target)) return;
    fitForest();
  });
  vp.addEventListener("keydown", (e) => {
    const tree = e.target.closest?.("[data-tree]");
    if (tree && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (!forestEditMode && forestGrowthKey(get(tree.dataset.tree))) {
        hideTip();
        openDetail(tree.dataset.tree);
        return;
      }
      if (forestEditMode) openTreePicker(tree.dataset.tree);
      else showTip(tree, "pin");
      return;
    }
    if (e.key === "Escape" && sel) {
      e.preventDefault();
      hideTip();
      vp.focus({ preventScroll: true });
      return;
    }
    if (!["+", "=", "-", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "0"].includes(e.key)) return;
    e.preventDefault();
    hideTip();
    if (e.key === "0") {
      fitForest();
      return;
    }
    if (["+", "=", "-"].includes(e.key)) {
      zoomAt(zoomTarget.scale * (e.key === "-" ? 1 / 1.12 : 1.12));
      return;
    }
    stopZoom();
    if (e.key === "ArrowLeft") zoomState.x += 25;
    if (e.key === "ArrowRight") zoomState.x -= 25;
    if (e.key === "ArrowUp") zoomState.y += 25;
    if (e.key === "ArrowDown") zoomState.y -= 25;
    apply();
    zoomTarget = { ...zoomState };
  });
  apply();
  if (pendingForestArrival) {
    const arrived = [...vp.querySelectorAll("[data-tree]")].find(
      (g) => g.dataset.tree === pendingForestArrival,
    );
    if (arrived) {
      const pos = arrived.transform.baseVal.getItem(0).matrix;
      zoomState.scale = Math.min(camera.max, Math.max(zoomState.scale, camera.fit * 1.15));
      zoomState.x = (360 - pos.e) * zoomState.scale;
      zoomState.y = (290 - pos.f) * zoomState.scale;
      apply();
      zoomTarget = { ...zoomState };
      showTip(arrived, "pin");
      arrived.querySelector(".tree-art")?.classList.add("forest-arrival");
      pendingForestArrival = null;
    }
  }
  clearTimeout(window.__songrimVisitorTimer);
  const layer = world.querySelector("#forest-visitor-layer"),
    cfg = forestBoardConfig(forestBoardCount(vp), vp.querySelector("svg[data-grid]")?.dataset.grid);
  let visitorElapsed = 0,
    visitorTickAt = performance.now();
  const syncVisitorVisibility = () => {
    layer?.classList.toggle("visitors-paused", document.hidden);
    visitorTickAt = performance.now();
  };
  document.addEventListener("visibilitychange", syncVisitorVisibility);
  syncVisitorVisibility();
  const cleanupForest = window.__songrimForestCleanup;
  window.__songrimForestCleanup = () => {
    cleanupForest?.();
    document.removeEventListener("visibilitychange", syncVisitorVisibility);
  };
  let visitorRolled = false;
  const spawnVisitor = () => {
    if (!layer) return;
    const boxes = [...world.querySelectorAll("[data-tree]")].map((g) => {
      const b = treeArtElementBounds(g.querySelector(".tree-art")),
        m = g.transform.baseVal.consolidate().matrix;
      return {
        left: m.e + b.x * m.a,
        right: m.e + (b.x + b.width) * m.a,
        top: m.f + b.y * m.d,
        bottom: m.f + (b.y + b.height) * m.d,
      };
    });
    const props = [...world.querySelectorAll("[data-decoration]")].map((g) => {
      const b = g.getBBox(),
        m = g.transform.baseVal.consolidate()?.matrix || { a: 1, d: 1, e: 0, f: 0 };
      return {
        left: m.e + b.x * m.a,
        right: m.e + (b.x + b.width) * m.a,
        top: m.f + b.y * m.d,
        bottom: m.f + (b.y + b.height) * m.d,
      };
    });
    const scale = cfg.treeScale * (cfg.month ? 0.9 : 1.05),
      pos = visitorPosition(cfg, boxes, scale, props);
    // No free spot yet: try again on the next tick without using up a visit.
    layer.innerHTML = "";
    if (!pos) return;
    // A visit may come up empty; the chance grows with each visitor milestone.
    visitorRolled = true;
    visitorElapsed = 0;
    if (Math.random() >= forestVisitorChance()) return;
    const chosen = nextForestVisitor();
    if (!chosen) return;

    // Depth-sort the visitor with the trees: it goes just before the first tree standing in front of it.
    const trees = [...world.querySelectorAll("[data-tree]")],
      front = trees.find((g) => g.transform.baseVal.consolidate().matrix.f > pos.y);
    if (front) front.parentNode.insertBefore(layer, front);
    else if (trees.length) trees[trees.length - 1].after(layer);
    layer.innerHTML =
      '<g data-visitor="' +
      chosen.id +
      '" role="img" aria-label="' +
      chosen.name +
      '" transform="translate(' +
      pos.x +
      " " +
      pos.y +
      ") scale(" +
      scale +
      ')"><g class="forest-visitor">' +
      animatedVisitorArt(chosen.id) +
      "</g></g>";
    visitorElapsed = 0;
  };
  const visitTick = () => {
    if (!vp.isConnected || view !== "forest" || !layer) return;
    const tickAt = performance.now(),
      elapsed = tickAt - visitorTickAt;
    visitorTickAt = tickAt;
    if (!document.hidden && !vp.classList.contains("paused")) {
      visitorElapsed += elapsed;
      const peek = layer
        .querySelector(".forest-visitor")
        ?.getAnimations()
        .find((a) => a.animationName === "visitorPeek");
      if (
        layer.firstChild
          ? peek
            ? peek.playState === "finished"
            : visitorElapsed >= 18000
          : !visitorRolled || visitorElapsed >= 18000
      )
        spawnVisitor();
      const v = layer?.querySelector("[data-visitor]");
      if (v && !collectionState().visitorsSeen.includes(v.dataset.visitor)) {
        const b = v.getBoundingClientRect(),
          r = vp.getBoundingClientRect();
        if (
          Number(getComputedStyle(v.firstElementChild).opacity) > 0.5 &&
          b.top >= Math.max(0, r.top) &&
          b.bottom <= Math.min(innerHeight, r.bottom) &&
          b.left >= r.left &&
          b.right <= r.right
        ) {
          collectionState().visitorsSeen.push(v.dataset.visitor);
          if (persist()) announceNewVisitor(v.dataset.visitor);
        }
      }
    }
    window.__songrimVisitorTimer = setTimeout(visitTick, 600);
  };
  spawnVisitor();
  visitTick();
  if ("IntersectionObserver" in window) {
    forestVisibilityObserver = new IntersectionObserver((es) =>
      vp.classList.toggle("paused", !es[0].isIntersecting),
    );
    forestVisibilityObserver.observe(vp);
  }
}

function changeMonth(delta) {
  const [y, m] = month.split("-").map(Number),
    d = new Date(y, m - 1 + delta, 1);
  const next = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  if (next <= now().slice(0, 7)) {
    month = next;
    render();
  }
}
