/*
 * 스크랩 탭과 작품 상세: 목록, 필터·정렬, 상세 화면, 직접 입력.
 */

// Scrap rows (redesign 11a): cover, title, type · creator, status chip, the work's tree sticker.
function stickerCover(c, cls = "") {
  return (
    '<span class="sticker-cover-art ' +
    cls +
    '" data-type="' +
    c.type +
    '">' +
    (c.cover
      ? '<img src="' +
        esc(c.cover) +
        '" alt="" decoding="async" loading="lazy" data-cover-kind="' +
        c.type +
        '">'
      : "") +
    "</span>"
  );
}

function scrapStatusLabel(c) {
  const status = Model.status(c);
  return status === "done" ? "완료" : status === "active" ? statusName.active : statusName.saved;
}

function scrapCard(c, choose = false) {
  const status = Model.status(c),
    stage = Model.stage(c);
  return (
    '<button type="button" class="scrap-row" data-type="' +
    c.type +
    '" data-action="' +
    (choose ? "choose" : "detail") +
    '" ' +
    attr(c.id) +
    ' aria-label="' +
    esc(c.title) +
    " · " +
    scrapStatusLabel(c) +
    '">' +
    stickerCover(c) +
    '<span class="scrap-row-body"><strong>' +
    esc(c.title) +
    "</strong><small>" +
    esc(c.creator || (c.type === "movie" ? "감독 미확인" : "저자 미확인")) +
    '</small><span class="scrap-row-marks"><span class="scrap-type is-' +
    c.type +
    '">' +
    (c.type === "movie" ? "MOVIE" : "BOOK") +
    "</span>" +
    (status === "done"
      ? ""
      : '<span class="scrap-status is-' + status + '">' + scrapStatusLabel(c) + "</span>") +
    (validRating(c.rating) ? '<span class="scrap-rating"><b>★</b> ' + c.rating + "</span>" : "") +
    "</span></span>" +
    '<span class="scrap-tree-slot">' +
    (c.completed ? stickerTree(c, stage, "is-cut-sm") : "") +
    "</span></button>"
  );
}

let pickingFilters = { q: "", type: "all", status: "all", sort: "recent" };

const SCRAP_SORT_LABELS = {
  recent: "최근 담은 순",
  many: "많이 담은 순",
  completed: "최근 완료한 순",
  rating: "별점 높은 순",
};

function scrapCompletionOrder(c) {
  if (!c.completed) return -1;
  const date = c.completed === "unknown" ? NaN : Date.parse(c.completed + "T12:00:00");
  return Number.isFinite(date) ? date : Number(c.completedAt) || 0;
}

function activeScrapFilters() {
  return picking ? pickingFilters : state.filters;
}

function updateScrapFilters(values, close = false) {
  clearTimeout(mainSearchRenderTimer);
  mainSearchRenderTimer = null;
  Object.assign(activeScrapFilters(), values);
  if (!picking && !persist()) return false;
  if (close) closeModal();
  render();
  return true;
}

function openScrapFilters() {
  clearTimeout(mainSearchRenderTimer);
  mainSearchRenderTimer = null;
  const f = activeScrapFilters();
  const option = (name, value, label, selected) =>
    '<label class="scrap-filter-option"><input type="radio" name="' +
    name +
    '" value="' +
    esc(value) +
    '" ' +
    (selected ? "checked" : "") +
    "><span>" +
    esc(label) +
    "</span></label>";
  const status = picking
    ? ""
    : '<fieldset class="scrap-filter-group is-chips"><legend>감상 상태</legend><div class="scrap-filter-options">' +
      ["all", "saved", "active", "done"]
        .map((value) => option("status", value, statusName[value], f.status === value))
        .join("") +
      "</div></fieldset>";
  const sort =
    '<fieldset class="scrap-filter-group is-list"><legend>정렬</legend><div class="scrap-filter-options">' +
    Object.entries(SCRAP_SORT_LABELS)
      .map(([value, label]) => option("sort", value, label, f.sort === value))
      .join("") +
    "</div></fieldset>";
  showModal(
    "필터·정렬",
    '<form id="scrapFilterForm">' +
      status +
      sort +
      '<div id="formError" class="form-error" role="alert"></div><div class="scrap-filter-footer">' +
      button("초기화", "scrapFilterDraftReset", "textbtn") +
      '<button type="submit" class="primary">적용하기</button></div></form>',
    "scrap-filters",
  );
}

function renderScrap() {
  const f = activeScrapFilters();
  const list = state.items.filter(
    (c) =>
      (!picking || !c.completed) &&
      (picking || f.status === "all" || Model.status(c) === f.status) &&
      (f.type === "all" || c.type === f.type) &&
      Model.norm(c.title + " " + c.creator).includes(Model.norm(f.q)),
  );
  list.sort((a, b) =>
    f.sort === "rating"
      ? (validRating(b.rating) ?? -1) - (validRating(a.rating) ?? -1) ||
        (b.saves.at(-1)?.at || 0) - (a.saves.at(-1)?.at || 0)
      : f.sort === "many"
        ? b.saves.length - a.saves.length || (b.saves.at(-1)?.at || 0) - (a.saves.at(-1)?.at || 0)
        : f.sort === "completed"
          ? scrapCompletionOrder(b) - scrapCompletionOrder(a) ||
            (b.completedAt || 0) - (a.completedAt || 0) ||
            (b.saves.at(-1)?.at || 0) - (a.saves.at(-1)?.at || 0)
          : (b.saves.at(-1)?.at || 0) - (a.saves.at(-1)?.at || 0),
  );
  const typeTabs =
    '<div class="type-tabs" role="group" aria-label="작품 유형">' +
    ["all", "book", "movie"]
      .map((t) =>
        button(
          t === "all" ? "전체" : typeName[t],
          "filterType",
          "type-tab " + (f.type === t ? "active" : ""),
          'data-type="' + t + '" aria-pressed="' + (f.type === t) + '"',
        ),
      )
      .join("") +
    "</div>";
  const applied = [];
  if (!picking && f.status !== "all")
    applied.push(
      button(
        esc(statusName[f.status]) + " " + icon("close"),
        "clearScrapStatus",
        "scrap-applied-filter",
        'aria-label="' + esc(statusName[f.status]) + ' 필터 해제"',
      ),
    );
  if (f.sort !== "recent")
    applied.push(
      button(
        esc(SCRAP_SORT_LABELS[f.sort]) + " " + icon("close"),
        "clearScrapSort",
        "scrap-applied-filter",
        'aria-label="최근 담은 순으로 초기화"',
      ),
    );
  const count =
    '<span class="sr-only" role="status" aria-live="polite">' +
    list.length +
    "개" +
    (picking ? " · 미완료 작품" : "") +
    "</span>";
  const filterLabel =
    icon("filter") +
    "필터·정렬" +
    (applied.length ? '<span class="scrap-filter-count">' + applied.length + "</span>" : "");
  const filterButton = button(
      filterLabel,
      "scrapFilters",
      "scrap-filter-trigger",
      'aria-haspopup="dialog" aria-label="필터와 정렬' +
        (applied.length ? " · " + applied.length + "개 적용" : "") +
        '"',
    ),
    appliedHTML = applied.length
      ? '<div class="scrap-applied-filters" aria-label="적용한 필터">' + applied.join("") + "</div>"
      : "";
  return (
    '<section class="scrap-page"><div class="page-heading"><h1 class="page-title">' +
    (picking
      ? "오늘 기록할 작품"
      : '나의 스크랩<span class="scrap-heading-count">' + state.items.length + "</span>") +
    "</h1>" +
    (picking ? button("취소", "cancelPick", "textbtn") : scrapAddButton()) +
    '</div><div class="scrap-tools">' +
    typeTabs +
    filterButton +
    '</div><div class="scrap-fixed-search">' +
    icon("search") +
    '<input id="search" type="search" placeholder="제목·저자·감독 검색" aria-label="스크랩 검색" value="' +
    esc(f.q) +
    '"></div>' +
    count +
    appliedHTML +
    '<div class="content-list scrap-list">' +
    (list.length
      ? list.map((c) => scrapCard(c, picking)).join("")
      : state.items.length
        ? '<div class="empty"><span class="empty-icon" aria-hidden="true">' +
          icon("search") +
          "</span><h3>일치하는 작품이 없어요</h3><p>다른 제목이나 저자·감독으로 검색하거나<br>선택한 필터를 초기화해보세요.</p>" +
          button("검색·필터 초기화", "resetFilters", "secondary") +
          "</div>"
        : '<div class="empty"><span class="empty-icon" aria-hidden="true">' +
          icon("scrap") +
          "</span><h3>첫 작품을 담아보세요</h3><p>읽고 싶은 책과<br>보고 싶은 영화를 모아보세요.</p>" +
          button("스크랩 추가하기", "add", "primary") +
          "</div>") +
    '</div><div class="list-footer"></div></section>'
  );
}

function contentIntroText(c) {
  // 상세 화면 전용: tasteIntroText()와 달리 절대 자르지 않고 원본 필드를 그대로 반환한다.
  if (!c) return "";
  if (c.type === "movie") return String(c.overview || "").trim();
  if (c.type === "album") return String(c.albumDescription || c.contents || c.description || "").trim();
  return String(c.contents || "").trim();
}

function detailMenu(c) {
  return (
    '<details class="more detail-more"><summary aria-label="작품 관리">⋯</summary><div class="more-menu">' +
    button("기본 정보 수정", "editInfo", "", attr(c.id)) +
    (c.completed
      ? button("완료 취소", "undoComplete", "", attr(c.id))
      : Model.stage(c) > 0
        ? button("기록 초기화", "resetRecords", "", attr(c.id))
        : "") +
    button("스크랩 삭제", "delete", "", attr(c.id)) +
    "</div></details>"
  );
}

function renderDetail() {
  const c = candidatePreview || get(detailId);
  if (!c)
    return '<div class="empty">이 작품이 없어요.' + button("스크랩으로", "toScrap", "textbtn") + "</div>";
  if (
    c.type === "book" &&
    !detailIntroAttempts.has(detailIntroKey(c)) &&
    (!c.contents || looksTruncatedIntro(c.contents))
  )
    setTimeout(() => ensureDetailIntro(c), 0);
  const introHTML = contentIntroText(c)
    ? '<div class="rule"></div><h3>작품 소개</h3><p class="detail-intro">' + esc(contentIntroText(c)) + "</p>"
    : "";
  if (candidatePreview) {
    // 추천 후보 미리보기: Model.add()를 호출하지 않으므로 id가 없다. 편집·삭제·기록 등 저장 전제 기능은 노출하지 않는다.
    return (
      '<section><div class="detail-title-row"><div><h1>' +
      esc(c.title) +
      "</h1>" +
      (c.originalTitle && c.originalTitle !== c.title
        ? '<p class="original-title">' + esc(c.originalTitle) + "</p>"
        : "") +
      '</div></div><p class="creator">' +
      esc(c.creator || (c.type === "movie" ? "감독 미확인" : "저자 미확인")) +
      " · " +
      typeName[c.type] +
      ' · 추천 후보 · 아직 스크랩 전</p><div class="row">' +
      cover(c) +
      "</div>" +
      detailMetadata(c) +
      introHTML +
      "</section>"
    );
  }
  const logs = [...c.logs].sort((a, b) => b.date.localeCompare(a.date)),
    stage = Model.stage(c),
    logDays = todayLogDates(c).size,
    days = todayDayCount(c);
  const genre = cleanGenreValue(c.genre) ? launchGenre(c.type, c.genre, c) : "";
  const chips = c.completed
    ? '<span class="detail-chip is-ink"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>완료 · ' +
      (c.completed === "unknown" ? "완료일 미상" : esc(c.completed.slice(5).replace("-", "."))) +
      "</span>" +
      '<button type="button" class="detail-chip detail-chip-rating" data-action="rating" ' +
      attr(c.id) +
      ' aria-label="별점 ' +
      (validRating(c.rating) ? c.rating + "점 · 수정" : "남기기") +
      '"><b>★</b> ' +
      (validRating(c.rating) ? c.rating : "별점 남기기") +
      "</button>"
    : '<span class="detail-chip is-ink">' +
      esc(growthAppearance(stage, c).name) +
      "</span>" +
      (stage > 0
        ? '<span class="detail-chip">' +
          [
            days && c.type === "book" ? days + "일째" : "",
            c.type === "movie" && Number(c.runtime) ? Number(c.runtime) + "분" : "",
            c.type === "movie" ? "기록 " + logDays + "회" : "",
          ]
            .filter(Boolean)
            .join(" · ") +
          "</span>"
        : "");
  const logRow = (l) =>
    '<button type="button" class="detail-log" data-action="editLog" ' +
    attr(c.id) +
    ' data-log="' +
    esc(l.id) +
    '"><span>' +
    esc(l.date.slice(5).replace("-", ".")) +
    '</span><span class="' +
    (l.memo || l.page ? "" : "is-empty") +
    '">' +
    (l.memo ? esc(l.memo) : l.page ? esc(l.page) + "쪽" : "+ 메모 남기기") +
    "</span></button>";
  const todayLog = c.logs.find((l) => l.date === now()),
    verb = c.type === "movie" ? "봤어요" : "읽었어요";
  const actions = c.completed
    ? ""
    : '<div class="detail-actions">' +
      (stage === 0
        ? button(
            c.type === "movie" ? "이미 다 봤어요" : "이미 다 읽었어요",
            "complete",
            "detail-action-secondary",
            attr(c.id),
          ) +
          button(
            c.type === "movie" ? "보기 시작하기" : "읽기 시작하기",
            "startExperience",
            "detail-action-primary",
            attr(c.id),
          )
        : button(
            c.type === "movie" ? "다 봤어요" : "다 읽었어요",
            "complete",
            "detail-action-secondary",
            attr(c.id),
          ) +
          (todayLog
            ? button(
                "오늘 기록했어요 · " + (todayLog.memo ? "메모 수정" : "메모"),
                "editLog",
                "detail-action-primary is-done",
                attr(c.id) + ' data-log="' + esc(todayLog.id) + '"',
              )
            : button(
                '<i aria-hidden="true"></i>오늘 ' + verb,
                "record",
                "detail-action-primary",
                attr(c.id),
              ))) +
      "</div>";
  // Records sit at the bottom: something to scroll down to, not the page's lead.
  // Memos, not reading dates: free notes plus any memo written on a record day, newest first.
  const memos = [
    ...(c.notes || []).map((n) => ({ kind: "note", id: n.id, date: n.date, text: n.text })),
    ...c.logs
      .filter((l) => String(l.memo || "").trim())
      .map((l) => ({ kind: "log", id: l.id, date: l.date, text: l.memo })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const memoRow = (m) =>
    '<button type="button" class="detail-memo" data-action="' +
    (m.kind === "note" ? "editNote" : "editMemo") +
    '" ' +
    attr(c.id) +
    (m.kind === "note" ? ' data-note="' : ' data-log="') +
    esc(m.id) +
    '"><span>' +
    esc(m.text) +
    "</span><small>" +
    esc(m.date.slice(2).replace(/-/g, ".")) +
    "</small></button>";
  const recordsHTML =
    '<div class="detail-section detail-memos"><div class="detail-memos-head"><h2>메모</h2>' +
    button("+ 메모 남기기", "addNote", "detail-memo-add", attr(c.id)) +
    "</div>" +
    (memos.length
      ? '<div class="detail-memo-list">' + memos.map(memoRow).join("") + "</div>"
      : '<p class="detail-empty">아직 메모가 없어요.</p>') +
    "</div>";
  return (
    '<section class="detail-page" data-type="' +
    c.type +
    '"><div class="detail-panel">' +
    stickerCover(c, "detail-cover") +
    '<span class="detail-tree">' +
    stickerTree(c, stage) +
    "</span>" +
    "</div>" +
    '<div class="detail-head"><span class="detail-kicker"><span class="scrap-type is-' +
    c.type +
    '">' +
    (c.type === "movie" ? "MOVIE" : "BOOK") +
    "</span>" +
    (genre ? esc(genre) : "") +
    "</span><h1>" +
    esc(c.title) +
    "</h1>" +
    (c.originalTitle && c.originalTitle !== c.title
      ? '<p class="original-title">' + esc(c.originalTitle) + "</p>"
      : "") +
    '<p class="detail-creator">' +
    esc(c.creator || (c.type === "movie" ? "감독 미확인" : "저자 미확인")) +
    (c.publisher ? " · " + esc(c.publisher) : "") +
    "</p></div>" +
    '<div class="detail-chips">' +
    chips +
    "</div>" +
    '<div class="detail-section detail-about">' +
    detailMetadata(c) +
    button("나무 모습 바꾸기", "bmWorkTree", "textbtn detail-tree-change", attr(c.id)) +
    "</div>" +
    (introHTML ? '<div class="detail-section">' + introHTML + "</div>" : "") +
    recordsHTML +
    renderLinkSources(c) +
    actions +
    "</section>"
  );
}

let scrapFlowActive = false;

const scrapSessionAdds = new Map();

let scrapComposerState = { type: "book", queries: { book: "", album: "", movie: "" }, count: 0 };

function scrapTypeLabel(type) {
  return { book: "책", album: "음악", movie: "영화" }[type] || "책";
}

function scrapComposerConfig(type) {
  return (
    {
      book: {
        input: "catalogSearch",
        results: "catalogResults",
        placeholder: "책 제목·저자 검색",
        note: "카카오 책 검색",
      },
      album: {
        input: "musicCatalogSearch",
        results: "musicCatalogResults",
        placeholder: "앨범명·아티스트 검색",
        note: "Apple Music/iTunes 앨범 검색",
      },
      movie: {
        input: "movieCatalogSearch",
        results: "movieCatalogResults",
        placeholder: "영화 제목 검색",
        note: "TMDB 영화 검색",
      },
    }[type] || null
  );
}

function updateScrapSessionCount(delta = 0) {
  scrapComposerState.count = Math.max(0, scrapComposerState.count + Number(delta || 0));
  const el = $("scrapSessionCount");
  if (el) el.innerHTML = "이번에 <b>" + scrapComposerState.count + "개</b> 추가";
  const done = document.querySelector('[data-action="scrapDone"]');
  if (done) done.disabled = scrapComposerState.count === 0;
}

function openScrapComposer(type = "book", query = null, reset = false) {
  if (reset) {
    scrapSessionAdds.clear();
    scrapComposerState = { type: "book", queries: { book: "", album: "", movie: "" }, count: 0 };
    scrapFlowActive = true;
  }
  if (!scrapFlowActive) scrapFlowActive = true;
  type = ["book", "movie"].includes(type) ? type : "book";
  scrapComposerState.type = type;
  if (query !== null) scrapComposerState.queries[type] = String(query || "");
  const cfg = scrapComposerConfig(type),
    q = scrapComposerState.queries[type] || "";
  const tabs = ["book", "movie"]
    .map((t) =>
      button(
        scrapTypeLabel(t),
        "scrapType",
        "composer-type-tab " + (t === type ? "active" : ""),
        'data-type="' + t + '" aria-pressed="' + (t === type) + '"',
      ),
    )
    .join("");
  const linkIcon =
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    cameraIcon =
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const body =
    '<div class="scrap-composer-body"><div class="composer-toolbar"><div class="composer-type-tabs" role="group" aria-label="스크랩 유형">' +
    tabs +
    '</div><div class="scrap-shortcuts">' +
    button(linkIcon, "linkAdd", "composer-icon", 'aria-label="링크에서 가져오기"') +
    button(cameraIcon, "photoAdd", "composer-icon", 'aria-label="사진에서 가져오기"') +
    '</div></div><div class="scrap-search-block">' +
    icon("search") +
    '<input id="' +
    cfg.input +
    '" type="search" value="' +
    esc(q) +
    '" placeholder="' +
    cfg.placeholder +
    '" aria-label="' +
    cfg.placeholder +
    '" autocomplete="off"></div><div id="' +
    cfg.results +
    '" class="scrap-results"></div></div><div class="scrap-session-footer"><span id="scrapSessionCount" class="scrap-session-count">이번에 <b>' +
    scrapComposerState.count +
    "개</b> 추가</span>" +
    button("완료", "scrapDone", "primary", scrapComposerState.count === 0 ? "disabled" : "") +
    "</div>";
  showModal("스크랩 추가", body, "scrap-composer");
  if (type === "book") searchResults(q);
  else if (type === "album") musicSearchResults(q);
  else movieSearchResults(q);
}

function addMenu() {
  openScrapComposer("book", "", true);
}

function infoForm(c = null, source = "") {
  const defaultType =
    (scrapFlowActive && scrapComposerState.type === "movie") || modal === "movie-search" ? "movie" : "book";
  const d = c || {
    type: defaultType,
    title:
      $("catalogSearch")?.value || $("musicCatalogSearch")?.value || $("movieCatalogSearch")?.value || "",
    creator: "",
    source,
  };
  const editable = !c || (!c.providerId && !c.isbn);
  const locked = c && !editable ? ' disabled aria-disabled="true"' : "";
  showModal(
    c ? "기본 정보 수정" : "직접 입력",
    '<form id="infoForm" data-edit="' +
      esc(c?.id || "") +
      '"><span class="info-label" id="contentTypeLabel">유형</span><input type="hidden" id="contentType" value="' +
      esc(d.type) +
      '"><div class="info-type" role="radiogroup" aria-labelledby="contentTypeLabel">' +
      Object.entries(typeName)
        .map(
          ([k, v]) =>
            '<button type="button" class="type-tab' +
            (d.type === k ? " active" : "") +
            '" role="radio" aria-checked="' +
            (d.type === k) +
            '" data-info-type="' +
            k +
            '"' +
            locked +
            ">" +
            v +
            "</button>",
        )
        .join("") +
      '</div><label for="contentTitle">제목</label><input id="contentTitle" required maxlength="200" value="' +
      esc(d.title) +
      '"' +
      (c && !editable ? " readonly" : "") +
      '><label for="contentCreator">저자·감독 · 모르면 비워두세요</label><input id="contentCreator" maxlength="100" value="' +
      esc(d.creator) +
      '"' +
      (c && !editable ? " readonly" : "") +
      ">" +
      (c && !editable
        ? '<p class="muted tiny">검색에서 가져온 원본 정보예요. 장르와 나의 기록을 수정할 수 있어요.</p>'
        : "") +
      metadataFields(d) +
      '<label for="contentSource">출처·메모 · 선택</label><input id="contentSource" maxlength="500" value="' +
      esc(d.source || "") +
      '"><span class="info-label">표지 사진 · 선택</span><input id="contentCover" class="info-file" type="file" accept="image/*"><label for="contentCover" class="info-cover"><span class="info-cover-thumb" id="contentCoverThumb" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg></span><span class="info-cover-text"><strong id="contentCoverName">사진 고르기</strong><small>스크랩과 달력에만 보여요</small></span></label><div id="formError" class="form-error" role="alert"></div><button class="primary" type="submit">' +
      (c ? "저장" : "스크랩") +
      "</button></form>",
    "info",
  );
}

function findSavedWork(candidate) {
  const keys = new Set(tasteKeys(candidate));
  return state.items.find((item) => tasteKeys(item).some((key) => keys.has(key)));
}

const REMOTE_ADD_HTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
  REMOTE_ADDED_HTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>담음';

function remoteScrapButton(candidate, index, type) {
  const saved = findSavedWork(candidate);
  if (!saved)
    return button(
      REMOTE_ADD_HTML,
      "addRemote" + type,
      "remote-add",
      'data-index="' + index + '" aria-label="' + esc(candidate.title) + ' 스크랩"',
    );
  if (scrapSessionAdds.has(saved.id))
    return button(
      REMOTE_ADDED_HTML,
      "removeRemote" + type,
      "remote-added",
      'data-index="' + index + '" aria-label="' + esc(candidate.title) + ' 스크랩 취소"',
    );
  return button(
    "이미 있음",
    "detail",
    "remote-saved",
    attr(saved.id) + ' aria-label="' + esc(candidate.title) + ' 이미 있음 · 상세 보기"',
  );
}

function undoSessionScrap(candidate, index, type) {
  const item = candidate && findSavedWork(candidate),
    eventId = item && scrapSessionAdds.get(item.id);
  if (!item || !eventId) {
    toast("기존 스크랩은 상세 화면에서 관리할 수 있어요.");
    return;
  }
  item.saves = item.saves.filter((event) => event.id !== eventId);
  if (!item.saves.length && !item.completed && !item.logs.length && !item.rating && !item.review)
    Model.remove(state, item.id);
  if (!persist()) return;
  scrapSessionAdds.delete(item.id);
  updateScrapSessionCount(-1);
  const el = document.querySelector('[data-action="removeRemote' + type + '"][data-index="' + index + '"]');
  if (el) el.outerHTML = remoteScrapButton(candidate, index, type);
}

function updateRemoteScrapButton(index, fromAction, toAction, text) {
  const buttonEl = [...document.querySelectorAll('[data-index="' + index + '"]')].find(
    (el) => el.dataset.action === fromAction,
  );
  if (buttonEl) {
    buttonEl.dataset.action = toAction;
    if (toAction.startsWith("removeRemote")) {
      buttonEl.className = "remote-added";
      buttonEl.innerHTML = REMOTE_ADDED_HTML;
      const title = (buttonEl.getAttribute("aria-label") || "").replace(/\s*스크랩.*$/, "");
      buttonEl.setAttribute("aria-label", (title ? title + " " : "") + text);
    } else buttonEl.textContent = text;
  }
}

function markScrapped(action, index) {
  const buttonAction = {
    addRemoteBook: "removeRemoteBook",
    addRemoteAlbum: "removeRemoteAlbum",
    addRemoteMovie: "removeRemoteMovie",
  }[action];
  if (buttonAction) updateRemoteScrapButton(index, action, buttonAction, "스크랩 취소");
}

function removeRemoteBook(index) {
  const c = remoteBookResults[index];
  undoSessionScrap(c, index, "Book");
  if (c) scrapAddedBookKeys.delete(bookResultKey(c));
}

function saved(c, eventId, options = {}) {
  state.onboarded = true;
  if (!persist()) return false;
  dismissToast();
  if (options.keepOpen && scrapFlowActive) {
    scrapSessionAdds.set(c.id, eventId);
    updateScrapSessionCount(1);
    if (options.action !== undefined && options.index !== undefined)
      markScrapped(options.action, options.index);
    return true;
  }
  if (modal === "info" && scrapFlowActive && !options.closeAfter) {
    updateScrapSessionCount(1);
    openScrapComposer(scrapComposerState.type, null, false);
    return true;
  }
  if (options.keepOpen) {
    render();
    if (options.action !== undefined && options.index !== undefined)
      markScrapped(options.action, options.index);
    return true;
  }
  closeModal();
  render();
  return true;
}

function addRemoteBook(index) {
  const d = remoteBookResults[index];
  if (!d || findSavedWork(d)) return;
  const id = Model.uid(),
    c = Model.add(state, d, id);
  if (!saved(c, id, { keepOpen: true, action: "addRemoteBook", index })) return;
  scrapAddedBookKeys.add(bookResultKey(d));
  // 장르·인기도 보강은 백그라운드로 미룬다. 예전엔 이 두 네트워크 요청이
  // 끝나야 스크랩이 저장돼서(버튼엔 아무 표시도 없이) 응답이 느릴 때
  // 사용자가 다시 검색창/탭을 건드리게 됐고, 그게 searchResults()를
  // 재실행시켜 "검색 중…"이 다시 뜨는 원인이었다. 이제는 탭 즉시
  // 저장부터 하고, 보강 결과는 도착하는 대로 조용히 반영한다.
  (async () => {
    try {
      if (!cleanGenreValue(c.genre)) await enrichBookGenre(c);
      if (!(Number(c.length) > 0) && primaryIsbn13(c?.isbn))
        await enrichBookPopularity([c], bookSearchSeq).catch(() => {});
      if (get(c.id) !== c) return;
      ensureCompletedSpeciesAssignments();
      persist();
      if (!modal && view === "detail" && detailId === c.id) refreshWhenIdle();
    } catch {}
  })();
}

function addRemoteAlbum() {
  toast("음반 기록은 지원하지 않아요. 책이나 영화를 찾아주세요.");
}

function addRemoteMovie(index) {
  const d = remoteMovieResults[index];
  if (!d || findSavedWork(d)) return;
  const id = Model.uid(),
    c = Model.add(state, d, id);
  saved(c, id, { keepOpen: true, action: "addRemoteMovie", index });
}

function removeRemoteAlbum(index) {
  const c = remoteAlbumResults[index];
  undoSessionScrap(c, index, "Album");
}

function removeRemoteMovie(index) {
  const c = remoteMovieResults[index];
  undoSessionScrap(c, index, "Movie");
}
