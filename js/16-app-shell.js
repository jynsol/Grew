/*
 * 앱 틀: 화면 전환(go), 그리기(render), 토스트, 시트 열고 닫기, 공통 카드 조각.
 */

function toast(message, undo) {
  $("toast").classList.remove("planted");
  clearTimeout(toastTimer);
  undoAction = undo || null;
  $("toast").innerHTML = "<span>" + esc(message) + "</span>" + (undo ? button("취소", "toastUndo", "") : "");
  toastTimer = setTimeout(
    () => {
      $("toast").innerHTML = "";
      undoAction = null;
    },
    undo ? 4500 : 2200,
  );
}

// A tap on the toast (outside its undo button) dismisses it at once.
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("#toast");
  if (t && !e.target.closest("[data-action]")) dismissToast();
});

function dismissToast() {
  $("toast").classList.remove("planted");
  clearTimeout(toastTimer);
  $("toast").innerHTML = "";
  undoAction = null;
}

function focusPageHeading() {
  requestAnimationFrame(() => {
    if (modal) return;
    const heading = $("page").querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  });
}

function go(next) {
  forestMonthPopOpen = false;
  if (next === "calendar") {
    forestMode = "month";
    forestShow = "calendar";
    next = "forest";
  }
  if (next === "forest" && view !== "forest") forestViewportFrame = null;
  clearTimeout(mainSearchRenderTimer);
  mainSearchRenderTimer = null;
  if (view === "detail" && next !== "detail") candidatePreview = null;
  closeModal();
  if (next !== "forest") forestEditMode = false;
  if (view === "calendar") sessionStorageSafe("calendarScroll", String(window.scrollY));
  if (view === "scrap") sessionStorageSafe("scroll", String(window.scrollY));
  view = next;
  picking = false;
  render();
  scrollPageTop();
  if (next === "scrap") window.scrollTo(0, Number(sessionStorageSafe("scroll")) || 0);
  if (next === "calendar") window.scrollTo(0, Number(sessionStorageSafe("calendarScroll")) || 0);
  focusPageHeading();
}

function sessionStorageSafe(k, v) {
  try {
    if (v !== undefined) sessionStorage.setItem("sr3-" + k, v);
    return sessionStorage.getItem("sr3-" + k);
  } catch {
    return null;
  }
}

function openDetail(id, origin = view) {
  candidatePreview = null;
  detailId = id;
  detailOrigin = origin === "detail" ? detailOrigin : origin;
  go("detail");
  const c = get(id);
  if (c?.type === "book" && !cleanGenreValue(c.genre) && c.genreSource !== "user") {
    enrichBookGenre(c)
      .then(() => {
        if (c.genre && get(c.id) === c) {
          ensureCompletedSpeciesAssignments();
          persist();
          if (view === "detail" && detailId === id) render();
        }
      })
      .catch(() => {});
  }
}

function openCandidateDetail(c) {
  // 추천(취향) 카드의 미저장 후보를 상세 화면에서 미리보기 위한 진입점. Model.add()를 호출하지 않는다.
  if (!c) return;
  candidatePreview = {
    ...c,
    id: null,
    logs: [],
    saves: [],
    completed: c.completed || null,
    rating: null,
    review: "",
  };
  candidatePreviewReturn = authRoute;
  detailId = null;
  authRoute = "app";
  go("detail");
}

function closeCandidateDetail() {
  const back = candidatePreviewReturn || "taste";
  candidatePreview = null;
  candidatePreviewReturn = null;
  authRoute = back;
  render();
  scrollPageTop();
}

function cover(c, small = false) {
  return c.cover
    ? '<img class="cover ' +
        c.type +
        '" data-cover-kind="' +
        c.type +
        '" src="' +
        esc(c.cover) +
        '" alt="' +
        esc(c.title) +
        ' 표지" decoding="async" loading="lazy">'
    : '<div class="cover ' +
        c.type +
        '" aria-label="' +
        esc(c.title) +
        ' 표지 없음">' +
        icon(c.type) +
        "</div>";
}

function row(c, choose = false) {
  return (
    '<button class="content-row" data-action="' +
    (choose ? "choose" : "detail") +
    '" ' +
    attr(c.id) +
    ">" +
    cover(c) +
    '<div class="grow"><span class="badge">' +
    typeName[c.type] +
    '</span><div class="title">' +
    esc(c.title) +
    '</div><div class="creator">' +
    esc(c.creator || "제작자 미확인") +
    '</div><div class="content-row-meta"><span class="record-status ' +
    Model.status(c) +
    '">' +
    statusName[Model.status(c)] +
    "</span>" +
    (validRating(c.rating)
      ? '<span class="row-rating"><span class="rating-star" aria-hidden="true">★</span> ' +
        c.rating +
        "</span>"
      : "") +
    (c.saves.length > 1 ? "<span>스크랩 " + c.saves.length + "회</span>" : "") +
    '</div></div><span class="muted" aria-hidden="true">›</span></button>'
  );
}

function handleCoverError(event) {
  const img = event.target;
  if (!img?.matches?.("img[data-cover-kind]")) return;
  const type = ["book", "movie"].includes(img.dataset.coverKind) ? img.dataset.coverKind : "book";
  const fallback = document.createElement("span");
  fallback.className = img.dataset.coverMini ? "mini-cover" : "cover " + type + " cover-fallback";
  if (img.alt) {
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", img.alt + " · 이미지를 불러오지 못했어요");
  } else fallback.setAttribute("aria-hidden", "true");
  fallback.innerHTML = icon(type);
  img.replaceWith(fallback);
}

document.addEventListener("error", handleCoverError, true);

function menu(c) {
  return (
    '<details class="more"><summary aria-label="콘텐츠 메뉴">⋯</summary><div class="more-menu">' +
    button("다른 스크랩으로 바꾸기", "pick", "") +
    button("콘텐츠 상세 보기", "detail", "", attr(c.id)) +
    "</div></details>"
  );
}

// Status bar tint follows the page colour (intro slides; every other screen uses the app background).
const INTRO_THEME_COLORS = ["#EADFFC", "#FCF0C2", "#D2EED8"];

function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const color = authRoute === "intro" ? INTRO_THEME_COLORS[introductionStep] || "#F8F8F6" : "#F8F8F6";
  meta.setAttribute("content", color);
  document.documentElement.style.backgroundColor = color;
}

function render() {
  showStorageStatus();
  syncLinkImport();
  syncForestSound();
  syncNotifications();
  window.__songrimForestCleanup?.();
  window.__songrimForestCleanup = null;
  forestVisibilityObserver?.disconnect();
  forestVisibilityObserver = null;
  if (authRoute !== "app") {
    renderEntry();
    syncThemeColor();
    return;
  }
  syncThemeColor();
  $("tabs").hidden = false;
  $("page").classList.remove("entry-page", "taste-page", "intro-page", "ob-page");
  $("page").dataset.view = view;
  document.body.classList.toggle("is-decorating", view === "forest" && forestEditMode);
  $("head").dataset.view = view;
  document.body.dataset.view = view;
  const parentTab = view === "detail" ? detailOrigin : view;
  const tab = ["sound", "notifications"].includes(parentTab)
    ? "my"
    : ["calendar", "shop", "codex"].includes(parentTab)
      ? "forest"
      : parentTab;
  $("tabs").innerHTML = ["today", "scrap", "forest", "my"]
    .map(
      (t, i) =>
        '<button class="' +
        (tab === t ? "active" : "") +
        '" data-action="tab" data-tab="' +
        t +
        '" aria-current="' +
        (tab === t ? "page" : "false") +
        '">' +
        icon(t) +
        '<span class="tab-label">' +
        ["오늘", "스크랩", "숲", "마이"][i] +
        "</span></button>",
    )
    .join("");
  $("head").hidden = !["detail", "calendar", "sound", "notifications", "shop", "codex"].includes(view);
  $("head").innerHTML = !$("head").hidden
    ? '<div class="row">' +
      button(icon("back"), "back", "iconbtn", 'aria-label="뒤로가기"') +
      '<span class="back-title">' +
      (["shop", "codex"].includes(view)
        ? "나의 숲"
        : ["sound", "notifications"].includes(view)
          ? "설정"
          : view === "calendar"
            ? "나의 숲 · 월간 기록"
            : { today: "오늘", scrap: "스크랩", forest: "숲", calendar: "숲", my: "마이" }[detailOrigin] ||
              "스크랩") +
      "</span></div>" +
      (view === "detail" && !candidatePreview && get(detailId)
        ? detailMenu(get(detailId))
        : view === "shop" && BM_STORE_OPEN
          ? (() => {
              const q = bmCouponStatus();
              return button(
                BM_PAGE_ICONS.coupon +
                  "쿠폰 " +
                  q.balance +
                  '장<span class="bm-wallet-go">' +
                  BM_PAGE_ICONS.arrow +
                  "</span>",
                "collectionTab",
                "bm-wallet-pill",
                'data-tab="coupons" aria-label="쿠폰 ' + q.balance + '장, 쿠폰 모으기"',
              );
            })()
          : "")
    : "";
  $("tabs").hidden = view === "detail";
  $("page").innerHTML = (
    {
      today: renderToday,
      scrap: renderScrap,
      forest: renderForest,
      calendar: renderCalendar,
      my: renderMy,
      sound: renderForestSoundSettings,
      notifications: renderNotificationSettings,
      detail: renderDetail,
      shop: renderShopPage,
      codex: renderCodexPage,
    }[view] || renderToday
  )();
  if (view === "my") {
    let legacy = false,
      archives = false;
    try {
      legacy = localStorage.getItem(KEY) && localStorage.getItem(KEY + ".legacy-owner") === dataOwner;
      archives = Object.keys(localStorage).some((key) =>
        key.startsWith(accountDataKey(dataOwner) + ":archive:"),
      );
    } catch {}
    if (legacy || archives)
      $("page").insertAdjacentHTML(
        "beforeend",
        '<section class="settings-group"><h2>기록 보관함</h2><details class="settings-archive"><summary>이전 기록과 백업</summary>' +
          (archives
            ? "<p>다른 기기와 충돌했을 때 보관한 기록을 내려받을 수 있어요.</p>" +
              button("보관 기록 확인", "syncArchives", "secondary")
            : "") +
          (legacy
            ? "<p>계정별 저장으로 전환하기 전의 기록이에요. 필요한 경우 내려받아 복원할 수 있어요.</p>" +
              button("이전 기록 내려받기", "legacyBackup", "secondary")
            : "") +
          "</details></section>",
      );
  }
  if (view === "forest") setupForest();
  if (view === "today") fitTodayTitle();
  updateForestSoundUI();
  if (!storageOK && !$("storageAlert").innerHTML)
    $("storageAlert").innerHTML =
      '<div class="storage-alert">이 환경에서는 자동 저장을 사용할 수 없어요.</div>';
}

let modalReturnFocus = null,
  modalFocusTimer = null;

function showModal(title, html, kind = "generic") {
  if (kind !== "link" && linkImportSession) cancelLinkImport();
  dismissNotification(false);
  if (!modal) modalReturnFocus = document.activeElement;
  clearTimeout(modalFocusTimer);
  dismissToast();
  modal = kind;
  const composer = kind === "scrap-composer",
    collection = kind === "collection";
  $("overlay").innerHTML =
    '<div class="sheet-back ' +
    (composer ? "scrap-composer-back" : collection ? "collection-back" : "") +
    '" data-kind="' +
    esc(kind) +
    '" data-action="backdrop"><section class="sheet ' +
    (composer ? "scrap-composer-sheet" : collection ? "collection-sheet" : "") +
    '" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><div class="sheet-head"><h2 id="sheetTitle" tabindex="-1">' +
    esc(title) +
    "</h2>" +
    button(icon("close"), "close", "iconbtn", 'aria-label="닫기"') +
    "</div>" +
    html +
    "</section></div>";
  document.querySelector(".app").inert = true;
  document.body.style.overflow = "hidden";
  modalFocusTimer = setTimeout(() => {
    const sheet = $("overlay").querySelector(".sheet");
    const target = ["scrap-filters", "scrap-composer", "record-done", "planted", "finish"].includes(kind)
      ? sheet?.querySelector("#sheetTitle")
      : kind === "confirm"
        ? sheet?.querySelector("#sheetTitle")
        : sheet?.querySelector(
            "input:not([type=hidden]):not([type=file]):not([hidden]):not(:disabled),textarea:not(:disabled),select:not(:disabled)",
          ) ||
          sheet?.querySelector("#sheetTitle") ||
          sheet?.querySelector("button");
    target?.focus({ preventScroll: true });
  }, 35);
  window.initRatingPicker?.();
}

function closeModal() {
  if (modal === "link") cancelLinkImport();
  if (modal === "profile" && profileEdit) {
    profileEdit.request++;
    profileEdit = null;
  }
  clearTimeout(modalFocusTimer);
  document.querySelector(".app").inert = false;
  if (ocrBusy) {
    ocrGeneration++;
    ocrBusy = false;
  }
  if (modal === "scrap-composer") scrapFlowActive = false;
  modal = null;
  $("overlay").innerHTML = "";
  document.body.style.overflow = "";
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
  modalReturnFocus = null;
}

function confirmBox(title, text, onConfirm, label = "확인", danger = false) {
  window.pendingConfirm = onConfirm;
  showModal(
    title,
    "<p>" +
      esc(text) +
      "</p>" +
      button(label, "confirm", danger ? "primary danger" : "primary") +
      button("취소", "close", "textbtn"),
    "confirm",
  );
}

function pick() {
  clearTimeout(mainSearchRenderTimer);
  pickingFilters = { q: "", type: "all", status: "all", sort: "recent" };
  picking = true;
  view = "scrap";
  closeModal();
  render();
  scrollPageTop();
  focusPageHeading();
}
