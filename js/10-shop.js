/*
 * 상점·도감·꾸미기 화면: 미리보기, 결제(체험), 나무/바닥 고르기, 숲 세트.
 */

let collectionTab = "inventory";

let bmCollectionTab = "inventory",
  bmPreview = null,
  bmCodexTab = "trees",
  bmSelectedWork = "",
  bmTreeFilter = "shop",
  bmCheckout = null,
  bmPendingProduct = null;

const BM_FLOOR_NAMES = { basic: "기본 바닥", meadow: "꽃이끼 정원" };

const BM_KRW_FORMAT = new Intl.NumberFormat("ko-KR"),
  bmKRW = (n) => BM_KRW_FORMAT.format(n) + "원";

function bmTreeName(id) {
  return id.startsWith("mystery-")
    ? bmMysteries().find((t) => t.id === id.slice(-1))?.name || "히든 나무"
    : TREE_SPECIES.find((t) => t.id === id)?.name || "새 나무 " + String(BM_RESERVED_IDS.indexOf(id) + 1);
}

function bmPlaceholder(label = "디자인 준비 중") {
  return (
    '<div class="bm-placeholder" aria-label="' +
    esc(label) +
    '"><span aria-hidden="true">✧</span><small>' +
    esc(label) +
    "</small></div>"
  );
}

// Hidden trees follow the floor: on 겨울 숲 they show (and are named for) their winter look.
function bmHiddenSnow() {
  return bmFloorId() === "snow";
}

function bmTreeSVG(id, snow = false) {
  if (!bmTreeReady(id)) return bmPlaceholder();
  const special = id.startsWith("mystery-"),
    key = special ? (snow ? "winter" : "") + (id === "mystery-A" ? "shining" : "moonlight") : id,
    b = (SONGLIM_TREE_ASSETS[key] || SONGLIM_TREE_ASSETS[key.replace("winter", "")])?.bounds;
  if (!b) return bmPlaceholder();
  const w = Math.max(94, b.width + 12);
  return (
    '<svg viewBox="' +
    [-w / 2, b.y - 7, w, b.height + 15].join(" ") +
    '" aria-hidden="true">' +
    (special ? hiddenTreeArt(id.slice(-1), snow ? "snow" : "basic") : previewSpeciesArt(id, "basic")) +
    "</svg>"
  );
}

function bmReadyTreeIds() {
  return [
    ...bmOwnedTreeIds().filter(bmTreeReady),
    ...bmMysteries()
      .filter((t) => t.ready && t.unlocked)
      .map((t) => "mystery-" + t.id),
  ];
}

function bmWorkItems() {
  return state.items
    .filter((c) => ["book", "movie"].includes(c.type))
    .sort(
      (a, b) =>
        Number(Model.stage(b) > 0) - Number(Model.stage(a) > 0) ||
        (b.saves.at(-1)?.at || 0) - (a.saves.at(-1)?.at || 0),
    );
}

function bmWork() {
  const items = bmWorkItems();
  return items.find((c) => c.id === bmSelectedWork) || items[0] || null;
}

function bmNotice() {
  return "";
}

function bmBadge(group) {
  return (
    '<span class="bm-badge ' +
    (group === "shop" ? "paid" : group === "mystery" ? "hidden" : "free") +
    '">' +
    (group === "shop" ? "스페셜" : group === "mystery" ? "조건 해금" : "무료") +
    "</span>"
  );
}

function bmMysteryCondition(t) {
  return "나무 " + t.at + "그루 심기";
}

function bmConditionHTML(id) {
  const group = bmCatalogGroup(id);
  if (group === "record") {
    const m = bmGrowthMilestones().find((t) => t.speciesId === id);
    return (
      '<div class="bm-condition"><p>' +
      esc(m.label) +
      " · " +
      m.progress +
      "/" +
      m.target +
      '</p><progress max="' +
      m.target +
      '" value="' +
      m.progress +
      '" aria-label="' +
      esc(m.label) +
      '"></progress></div>'
    );
  }
  if (group === "mystery") {
    const m = bmMysteries().find((t) => t.id === id.slice(-1));
    return (
      '<div class="bm-condition"><p>' +
      bmMysteryCondition(m) +
      " · " +
      Math.min(m.at, m.progress) +
      "/" +
      m.at +
      '</p><progress max="' +
      m.at +
      '" value="' +
      Math.min(m.at, m.progress) +
      '" aria-label="' +
      bmMysteryCondition(m) +
      '"></progress></div>'
    );
  }
  return (
    "<p>" +
    (group === "base"
      ? "처음부터 함께해요"
      : BM_STORE_OPEN
        ? "광고 쿠폰 14장 또는 " + bmKRW(1100)
        : "곧 열려요") +
    "</p>"
  );
}

function bmWorkSelect() {
  const items = bmWorkItems(),
    c = bmWork();
  if (c) bmSelectedWork = c.id;
  return c
    ? '<div class="bm-work-select"><label for="bmWorkSelect">모습을 바꿀 작품</label><select id="bmWorkSelect">' +
        items
          .map(
            (x) =>
              '<option value="' +
              esc(x.id) +
              '" ' +
              (c.id === x.id ? "selected" : "") +
              ">" +
              esc(x.title) +
              " · " +
              ["씨앗", "새싹", "어린 나무", "나무"][Model.stage(x)] +
              "</option>",
          )
          .join("") +
        "</select></div>"
    : '<p class="bm-subtitle">작품을 담으면 해금한 나무로 꾸밀 수 있어요.</p>';
}

// Preview = the real month board (same ground art as the forest tab), empty, 3×3.
function bmFloorPreviewArt(floor) {
  return forestSVG([], "basic", false, { grid: "month", minCols: 3, transient: true, preview: true, floor })
    .replace(/viewBox="[^"]*"/, 'viewBox="215 168 290 240" aria-hidden="true"')
    .replace(/ role="group" aria-label="[^"]*"/, "");
}

function bmFloorCard(f) {
  const current = bmFloorId() === f.id,
    owned = bmFloorOwned(f.id);
  return (
    '<article class="bm-floor-card">' +
    (f.ready
      ? button(
          bmFloorPreviewArt(f.id),
          "bmPreviewFloor",
          "bm-floor-art",
          'data-floor="' + f.id + '" aria-label="' + f.name + ' 미리보기"',
        )
      : bmPlaceholder()) +
    "<div><h3>" +
    f.name +
    "</h3>" +
    bmBadge(f.free ? "base" : "shop") +
    "<p>" +
    (f.free ? "처음부터 무료" : "한 번 구매로 계속 사용") +
    "</p><small>" +
    (current ? "사용 중" : !f.ready ? "디자인 준비 중" : owned ? "보유 중" : "내 숲에 미리보기") +
    "</small>" +
    (f.ready
      ? !owned && !BM_STORE_OPEN
        ? '<span class="bm-card-buy is-soon">곧 열려요</span>'
        : button(
            owned ? "바꿔보기" : "2,200원",
            owned ? "bmPreviewFloor" : "bmQuickBuy",
            "bm-card-buy",
            'data-floor="' +
              f.id +
              '" data-kind="floor" ' +
              (!owned ? 'aria-label="' + f.name + ' 2,200원 구매 체험"' : ""),
          )
      : "") +
    "</div></article>"
  );
}

let bmShopFilter = "all";

function openCollection(tab = bmCollectionTab) {
  if (forestEditMode && view !== "forest") forestEditMode = false;
  bmShopFilter = BM_SALE_THEMES.some((t) => t.id === tab) ? tab : tab === "inventory" ? "all" : bmShopFilter;
  if (tab === "visitors") {
    bmOpenCodex("visitors");
    return;
  }
  bmRefresh(state);
  bmPreview = null;
  bmCheckout = null;
  bmCollectionTab = ["floors", "coupons"].includes(tab) ? tab : "inventory";
  collectionTab = tab;
  const same = view === "shop";
  closeModal();
  view = "shop";
  forestEditMode = false;
  render();
  if (!same) scrollPageTop();
}

function bmOpenCodex(tab = "trees") {
  bmRefresh(state);
  bmPreview = null;
  bmCodexTab = tab === "visitors" ? "visitors" : "trees";
  const same = view === "codex";
  closeModal();
  view = "codex";
  render();
  if (!same) scrollPageTop();
}

function bmPreviewItems() {
  return (typeof forestMonthItems === "function" ? forestMonthItems(month) : forestItems(state, year)).map(
    (c) => Model.clone(c),
  );
}

function bmPreviewHTML() {
  const p = bmPreview,
    isTree = p.kind === "tree",
    name = isTree ? bmTreeName(p.id) : BM_FLOOR_NAMES[p.id],
    owned = isTree ? bmReadyTreeIds().includes(p.id) : bmFloorOwned(p.id),
    group = isTree ? bmCatalogGroup(p.id) : p.id === "basic" ? "base" : "shop",
    q = bmCouponStatus();
  const art = isTree
    ? '<div class="bm-preview-specimen">' + bmTreeSVG(p.id) + "</div>"
    : '<div class="bm-live-scene" id="bmPreviewScene" inert>' +
      forestSVG(bmPreviewItems(), "basic", false, {
        floor: p.id,
        preview: true,
        grid: "month",
        transient: true,
      }) +
      "</div>";
  let actions = "";
  if (owned)
    actions = button(
      isTree ? "숲에서 꾸미기" : "바닥 바꾸기",
      isTree ? "bmDecorateForest" : "bmDecorateFloors",
      "primary",
    );
  else if (group === "shop" && !BM_STORE_OPEN)
    actions = '<p class="bm-money-note">스페셜 나무와 바닥은 곧 열려요.</p>';
  else if (group === "shop")
    actions =
      (isTree
        ? button(
            q.balance >= q.cost
              ? "쿠폰 " + q.cost + "장으로 해금하기"
              : "쿠폰 모으기 · " + q.balance + "/" + q.cost,
            q.balance >= q.cost ? "bmRedeemStart" : "bmCoupons",
            "secondary",
          )
        : "") + button(bmKRW(isTree ? 1100 : 2200) + " 구매 체험", "bmBuyStart", "primary");
  else
    actions =
      '<p class="bm-money-note">' +
      (group === "record"
        ? "기록으로 조건을 채우면 무료로 열려요."
        : "나무를 심어 조건을 채우면 자동으로 열려요. 판매하지 않아요.") +
      "</p>";
  return (
    '<div class="bm-preview-body">' +
    art +
    '<div class="bm-preview-copy">' +
    bmBadge(group) +
    "<h3>" +
    esc(name) +
    "</h3>" +
    (isTree
      ? owned
        ? "<p>" + (bmGenreLabel(p.id) || "열렸어요") + "</p>"
        : bmConditionHTML(p.id)
      : "<p>" +
        (owned ? "보유 중" : BM_STORE_OPEN ? "2,200원 · 한 번 사면 계속 써요" : "곧 열려요") +
        "</p>") +
    "</div>" +
    bmNotice() +
    '<p id="formError" class="form-error" role="alert"></p><div class="bm-acquire-actions">' +
    actions +
    "</div>" +
    button("돌아가기", "bmBackCollection", "textbtn") +
    "</div>"
  );
}

function bmOpenPreview(kind, id, itemId = "") {
  if (
    (kind === "tree" && !bmTreeReady(id)) ||
    (kind === "floor" && !BM_FLOORS.some((f) => f.id === id && f.ready))
  )
    return;
  if (itemId && get(itemId)) bmSelectedWork = itemId;
  bmPreview = { kind, id, itemId: itemId || bmWork()?.id || "", backTab: bmCollectionTab, source: "preview" };
  bmCheckout = null;
  showModal(kind === "tree" ? "나무 살펴보기" : "내 숲에 미리보기", bmPreviewHTML(), "collection");
  if (kind === "floor") requestAnimationFrame(bmFitPreview);
}

function bmFitPreview() {
  const svg = document.querySelector("#bmPreviewScene>svg"),
    world = svg?.querySelector("#forest-world");
  if (!svg || !world) return;
  const b = world.getBBox(),
    pad = 22;
  svg.setAttribute("viewBox", [b.x - pad, b.y - pad, b.width + 2 * pad, b.height + 2 * pad].join(" "));
}

function bmApplyPreview() {
  if (!bmPreview) return;
  const p = { ...bmPreview },
    before = Model.clone(state);
  const ok = p.kind === "floor" ? bmSetFloor(p.id) : bmAssignManual(state, get(p.itemId), p.id);
  if (!ok) {
    state = before;
    return;
  }
  if (!persist()) return;
  bmPreview = null;
  closeModal();
  view = "forest";
  forestEditMode = false;
  render();
  toast(p.kind === "floor" ? "바닥을 바꿨어요." : "이 작품의 나무를 바꿨어요.");
}

function bmOpenCheckout(kind) {
  const p = bmPreview;
  if (["tree", "floor", "coupon"].includes(kind) && !p) return;
  bmCheckout = { kind, id: p?.id || "", preview: p ? { ...p } : null };
  let title = "",
    body = "",
    action = "",
    disabled = false;
  if (kind === "ad") {
    const q = bmCouponStatus();
    title = "광고 쿠폰 모으기";
    body =
      "<p>오늘 " +
      q.watchedToday +
      "/2회 · 쿠폰 " +
      Math.min(q.balance, q.cost) +
      "/" +
      q.cost +
      "장</p><p>실제 광고는 재생되지 않아요. 아래 버튼으로 시청 완료 흐름을 체험해요.</p>";
    action = "시청 완료로 체험하기";
    disabled = q.watchedToday >= 2;
  } else if (kind === "package") {
    const pack = bmPackageInfo();
    title = pack.pack.name;
    body =
      "<p>나무 " +
      pack.ids.length +
      "종 + 바닥 " +
      pack.floorIds.length +
      "종</p>" +
      '<p class="bm-money-note">구성 나무가 하나도 없을 때만 살 수 있어요. 한 그루라도 열면 이 패키지는 사라져요.</p>' +
      '<div class="bm-package-grid">' +
      pack.ids
        .map((id) => "<div>" + bmTreeSVG(id) + "<small>" + esc(bmTreeName(id)) + "</small></div>")
        .join("") +
      "</div>" +
      pack.floorIds
        .map(
          (f) =>
            '<div class="bm-package-floor"><span class="bm-package-floor-art">' +
            bmFloorPreviewArt(f) +
            "</span><div><small>바닥</small><strong>" +
            esc(BM_FLOORS.find((x) => x.id === f)?.name || "바닥") +
            "</strong></div></div>",
        )
        .join("") +
      '<div class="bm-price-summary"><small>단품 합 <del>' +
      bmKRW(pack.pack.list) +
      "</del></small><strong>" +
      bmKRW(pack.pack.price) +
      "</strong></div><p>새로 열리는 나무 " +
      pack.newTreeCount +
      "종" +
      (pack.newFloorIds.length ? " · 바닥 " + pack.newFloorIds.length + "종" : "") +
      "</p>" +
      (pack.duplicateTreeIds.length
        ? '<p class="bm-money-note">이미 보유한 ' +
          pack.duplicateTreeIds.length +
          "종도 포함돼요. 중복 나무가 추가되거나 가격이 차감되지는 않아요." +
          (pack.couponDuplicateIds.length ? "" : "") +
          "</p>"
        : "");
    action = pack.canBuy ? bmKRW(pack.pack.price) + " 구매 체험하기" : "이미 모두 보유하고 있어요";
    disabled = !pack.canBuy;
  } else {
    const coupon = kind === "coupon",
      floor = kind === "floor",
      q = bmCouponStatus();
    title = "해금하기";
    body =
      '<div class="bm-checkout-product">' +
      (floor ? bmFloorPreviewArt(p.id) : bmTreeSVG(p.id)) +
      "<div><h3>" +
      esc(floor ? BM_FLOOR_NAMES[p.id] : bmTreeName(p.id)) +
      "</h3><small>한 번 열면 계속 사용할 수 있어요</small></div></div>" +
      bmPackWarning(p.id) +
      (!floor
        ? '<div class="bm-payment-methods" role="group" aria-label="해금 방법">' +
          button(
            "단품 구매<strong>1,100원</strong>",
            "bmPayCash",
            !coupon ? "active" : "",
            'aria-pressed="' + !coupon + '"',
          ) +
          button(
            "쿠폰 " + q.balance + "장 보유<strong>쿠폰 " + q.cost + "장</strong>",
            "bmPayCoupon",
            coupon ? "active" : "",
            'aria-pressed="' + coupon + '" ' + (q.balance >= q.cost ? "" : "disabled"),
          ) +
          "</div>"
        : "") +
      '<div class="bm-price-summary"><small>' +
      (coupon ? "사용할 쿠폰" : "결제 금액") +
      "</small><strong>" +
      (coupon ? q.cost + "장" : bmKRW(floor ? 2200 : 1100)) +
      "</strong></div><p>" +
      (coupon
        ? "쿠폰으로 연 나무도 수집 보상에 포함돼요."
        : floor
          ? "바닥 구매는 나무 구매 종 수에 포함되지 않아요."
          : "") +
      "</p>";
    action = coupon ? "쿠폰 " + q.cost + "장 사용하기" : bmKRW(floor ? 2200 : 1100) + " 구매 체험 완료하기";
    disabled = coupon && q.balance < q.cost;
  }
  showModal(
    title,
    '<div class="bm-checkout">' +
      body +
      bmNotice() +
      '<p id="formError" class="form-error" role="alert"></p><div class="bm-acquire-actions">' +
      button(action, "bmConfirmAcquire", "primary", disabled ? "disabled" : "") +
      button("취소", "bmCancelAcquire", "textbtn") +
      "</div></div>",
    "collection",
  );
}

function bmConfirmAcquire() {
  if (!bmCheckout) return;
  const request = { ...bmCheckout },
    before = Model.clone(state);
  let result;
  try {
    result =
      request.kind === "ad"
        ? bmPreviewWatchAd()
        : request.kind === "package"
          ? bmPreviewBuyPackage()
          : request.kind === "coupon"
            ? bmPreviewRedeem(request.id)
            : request.kind === "floor"
              ? bmPreviewBuyFloor(request.id)
              : bmPreviewBuyTree(request.id);
  } catch {
    state = before;
    result = { ok: false };
  }
  if (!result?.ok) {
    state = before;
    const error = $("formError");
    if (error)
      error.textContent = "이미 해금했거나 지금 진행할 수 없어요. 보유 상태와 오늘의 횟수를 확인해 주세요.";
    return;
  }
  if (!persist()) return;
  bmCheckout = null;
  render();
  if (request.kind === "ad") {
    openCollection("coupons");
    toast("쿠폰 1장을 받았어요.");
  } else if (request.kind === "package") {
    openCollection("inventory");
    toast("패키지 구매 체험을 완료했어요.");
  } else {
    const p = request.preview;
    bmOpenPreview(p.kind, p.id, p.itemId);
    toast("나무와 바닥은 한 번 해금하면 계속 사용할 수 있어요.");
  }
}

function bmPickerName(id) {
  return id.startsWith("mystery-") && bmHiddenSnow()
    ? id === "mystery-A"
      ? "반짝이는 트리"
      : "눈꽃 달빛나무"
    : bmTreeName(id);
}

// Tree picker grouped by theme. The theme that matches the floor comes first; hidden trees sit with it.
function treePickerHTML(c) {
  const current = c.hiddenTree ? "mystery-" + c.hiddenTree : contentSpecies(c).id,
    own = new Set(bmReadyTreeIds()),
    match = BM_FLOOR_THEME[bmFloorId()] || "classic";
  const card = (id) =>
    button(
      '<span class="bm-decoration-art">' +
        bmTreeSVG(id, bmHiddenSnow()) +
        '</span><span class="bm-decoration-name">' +
        esc(bmPickerName(id).replace(/^겨울 /, "")) +
        (id === current ? '<b aria-hidden="true">✓</b>' : "") +
        "</span>",
      "bmChooseOwnedTree",
      "bm-decoration-card " + (id === current ? "selected" : ""),
      'data-id="' +
        esc(c.id) +
        '" data-species="' +
        id +
        '" aria-label="' +
        esc(bmTreeName(id)) +
        ' 선택" aria-pressed="' +
        (id === current) +
        '"',
    );
  const groups = [
    { id: "classic", name: "클래식 나무", ids: BM_GENRE_IDS },
    {
      id: "hidden",
      name: "히든 나무",
      ids: bmMysteries()
        .filter((t) => t.ready)
        .map((t) => "mystery-" + t.id),
    },
    ...BM_SALE_THEMES.map((t) => ({ id: t.id, name: t.name + " 나무", ids: t.ids })),
  ]
    .map((g) => ({ ...g, ids: g.ids.filter((id) => own.has(id)) }))
    .filter((g) => g.ids.length);
  groups.sort(
    (a, b) =>
      (b.id === match) - (a.id === match) ||
      (b.id === "hidden" && a.id !== match) - (a.id === "hidden" && b.id !== match),
  );
  const floorName = BM_FLOORS.find((f) => f.id === bmFloorId())?.name || "";
  return (
    '<div class="bm-decoration-body"><div class="bm-decoration-work"><span>' +
    typeName[c.type] +
    "</span><h3>" +
    esc(c.title) +
    "</h3>" +
    (Model.stage(c) < 3 ? "<p>다 자라면 선택한 모습이 돼요.</p>" : "") +
    "</div>" +
    groups
      .map(
        (g) =>
          '<h4 class="bm-decoration-label">' +
          g.name +
          (g.id === match && groups.length > 1 ? "<small>" + esc(floorName) + "에 어울려요</small>" : "") +
          '</h4><div class="bm-decoration-grid">' +
          g.ids.map(card).join("") +
          "</div>",
      )
      .join("") +
    '<p id="formError" class="form-error" role="alert"></p>' +
    button(
      "장르에 맞춰 자동으로 고르기",
      "bmAutoOwnedTree",
      "textbtn bm-reset",
      'data-id="' + esc(c.id) + '"',
    ) +
    "</div>"
  );
}

function openTreePicker(id) {
  const c = get(id);
  if (!c) return;
  bmRefresh(state);
  bmSelectedWork = c.id;
  bmPreview = null;
  bmCheckout = null;
  showModal("나무 바꾸기", treePickerHTML(c), "collection");
  requestAnimationFrame(() =>
    document.querySelector(".bm-decoration-card.selected")?.scrollIntoView({ block: "center" }),
  );
}

document.addEventListener("change", (e) => {
  if (e.target.id === "bmWorkSelect" && get(e.target.value)) {
    bmSelectedWork = e.target.value;
    if (bmPreview) {
      bmPreview.itemId = bmSelectedWork;
      showModal("나무 살펴보기", bmPreviewHTML(), "collection");
    } else openCollection("inventory");
    $("bmWorkSelect")?.focus({ preventScroll: true });
  }
});

function bmOpenShop(tab = "inventory") {
  forestEditMode = false;
  bmTreeFilter = "shop";
  bmPendingProduct = null;
  openCollection(tab);
}

function bmDecorateForest() {
  closeModal();
  bmPreview = null;
  bmCheckout = null;
  view = "forest";
  forestEditMode = true;
  render();
  scrollPageTop();
}

function bmChooseOwnedTree(itemId, id, automatic = false) {
  const c = get(itemId);
  if (!c || (!automatic && !bmReadyTreeIds().includes(id))) return;
  const before = Model.clone(state);
  const ok = automatic ? bmResetItemAppearance(state, c) : bmAssignManual(state, c, id);
  if (ok !== false && !automatic) bmState().themeCustom = true;
  if (ok === false) {
    state = before;
    return;
  }
  if (!persist()) return;
  closeModal();
  bmPreview = null;
  view = "forest";
  forestEditMode = true;
  render();
  toast(
    Model.stage(c) < 3
      ? (c.type === "movie" ? "다 보면 " : "다 읽으면 ") +
          bmTreeName(c.hiddenTree ? "mystery-" + c.hiddenTree : contentSpecies(c).id) +
          " 모습으로 자라요."
      : "나무 모습을 바꿨어요.",
  );
}

// Re-deal every tree by genre in planting order (manual picks dropped). With the 'mix' theme a genre
// alternates the trees you own; with a theme each genre takes that theme's tree.
function bmApplyTreeTheme(s, theme) {
  const b = bmRefresh(s);
  b.themeCustom = false;
  b.treeTheme = BM_TREE_THEMES.some((t) => t.id === theme) ? theme : "mix";
  return bmResetToGenre(s, true);
}

function bmResetToGenre(s = state, keepHidden = false) {
  const b = bmRefresh(s);
  b.nextByPool = {};
  const key = (c) =>
    (c.completed || "9999-99-99") + String(c.completedAt || c.createdAt || "").padStart(16, "0");
  for (const c of [...(s.items || [])].filter(bmTracked).sort((x, y) => (key(x) < key(y) ? -1 : 1))) {
    if (keepHidden && c.hiddenTree) continue;
    delete c.bmAssignment;
    c.hiddenTree = null;
    bmAssignItem(s, c, true);
  }
  return b;
}

// Prototype only: undo every preview purchase, coupon and ad view, and any special tree/floor carried
// over from older data, so the shop and packs can be tried again from scratch.
function bmPreviewResetPurchases(s = state) {
  const b = bmRefresh(s);
  b.previewOwnership = {};
  b.previewFloorOwnership = {};
  for (const id of BM_SHOP_IDS) delete b.ownership[id];
  for (const f of BM_PAID_FLOOR_IDS) delete b.floorOwnership[f];
  b.legacyTreeIds = b.legacyTreeIds.filter((id) => !BM_SHOP_IDS.includes(id));
  b.previewCouponViews = {};
  b.previewCouponSpent = 0;
  if (!bmFloorOwnedFrom(b, b.floor)) b.floor = "basic";
  for (const c of s.items || []) {
    if (!bmTracked(c)) continue;
    const id = c.hiddenTree ? "mystery-" + c.hiddenTree : c.speciesId;
    if (!bmCanUseFrom(b, id)) bmResetItemAppearance(s, c);
  }
  bmRefresh(s);
  return b;
}

function bmPreviewResetConfirm() {
  confirmBox(
    "구매 되돌리기",
    "체험으로 산 나무·바닥·패키지와 모은 쿠폰을 모두 되돌릴까요? 그 나무로 꾸민 자리는 클래식 나무로 돌아가요.",
    () => {
      const before = Model.clone(state);
      bmPreviewResetPurchases(state);
      if (!persist()) {
        state = before;
        return;
      }
      closeModal();
      render();
      toast("구매를 되돌렸어요.");
    },
    "되돌리기",
    true,
  );
}

// Floor swatches scroll sideways, so more floors can be added without crowding the bar.
const bmFloorSwatchCache = {};

function bmFloorSwatch(id) {
  return bmFloorSwatchCache[id] || (bmFloorSwatchCache[id] = bmFloorPreviewArt(id));
}

// Decorate dock: forest-set cards first (floor + trees in one tap). Fine-tuning stays one step away:
// 바닥만 바꾸기 opens the floor row, and any tree in the forest can still be tapped to change just that tree.
let bmEditTab = "sets";

function bmSetActive(st) {
  const b = bmState();
  return (
    bmFloorId() === st.floor &&
    !b.themeCustom &&
    (b.treeTheme === st.theme ||
      (st.theme === "classic" &&
        b.treeTheme === "mix" &&
        !BM_POOLS.some((p) => bmReadyTreeIds().includes(p.paid[0]) || bmReadyTreeIds().includes(p.paid[1]))))
  );
}

function bmSetCardArt(st) {
  return (
    '<span class="forest-set-art" aria-hidden="true">' +
    bmFloorSwatch(st.floor) +
    '<span class="forest-set-trees">' +
    st.trees
      .map((id) => '<img src="./assets/images/trees/thumb/' + id + '.webp" alt="" decoding="async">')
      .join("") +
    "</span></span>"
  );
}

function bmEditBarHTML() {
  const cur = bmFloorId(),
    lock =
      '<svg class="forest-edit-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const head =
    '<div class="forest-edit-head"><strong class="forest-edit-title">' +
    (bmEditTab === "floor" ? "바닥만 바꾸기" : "숲 꾸미기") +
    "</strong>" +
    button("완료", "forestEdit", "forest-edit-done") +
    "</div>";
  const sets =
    '<div class="forest-edit-row forest-edit-sets" role="group" aria-label="숲 세트">' +
    BM_FOREST_SETS.map((st) => {
      const owned = bmFloorOwned(st.floor),
        on = owned && bmSetActive(st);
      return button(
        bmSetCardArt(st) + '<span class="forest-set-name">' + esc(st.name) + (owned ? "" : lock) + "</span>",
        "bmForestSet",
        "forest-set" + (on ? " active" : "") + (owned ? "" : " is-locked"),
        'data-set="' +
          st.id +
          '" aria-pressed="' +
          on +
          '"' +
          (owned ? "" : ' aria-label="' + esc(st.name) + ' · 상점에서 보기"'),
      );
    }).join("") +
    "</div>";
  const floors =
    '<div class="forest-edit-row forest-edit-floors" role="group" aria-label="바닥">' +
    BM_FLOORS.filter((f) => f.ready)
      .map((f) => {
        const owned = bmFloorOwned(f.id),
          on = cur === f.id;
        return button(
          '<span class="forest-edit-swatch" aria-hidden="true">' +
            bmFloorSwatch(f.id) +
            "</span>" +
            (owned ? "" : lock),
          owned ? "bmFloorOnly" : "bmPreviewFloor",
          "forest-edit-floor" + (on ? " active" : "") + (owned ? "" : " is-locked"),
          'data-floor="' +
            f.id +
            '" aria-pressed="' +
            on +
            '" aria-label="' +
            esc(f.name) +
            (owned ? "" : " · 미리보기") +
            '" title="' +
            esc(f.name) +
            '"',
        );
      })
      .join("") +
    "</div>";
  const foot =
    bmEditTab === "floor"
      ? '<div class="forest-edit-foot">' +
        button("← 숲 세트로", "bmEditTab", "forest-edit-link", 'data-tab="sets"') +
        "<span>나무는 그대로 두고 바닥만 바뀌어요</span></div>"
      : '<div class="forest-edit-foot"><span>' +
        (bmState().themeCustom ? "직접 고른 나무가 있어요 · " : "") +
        "숲에서 나무를 누르면 하나씩 바꿀 수 있어요</span>" +
        button("바닥만 바꾸기", "bmEditTab", "forest-edit-link", 'data-tab="floor"') +
        "</div>";
  return (
    '<div class="forest-edit-bar is-dock">' + head + (bmEditTab === "floor" ? floors : sets) + foot + "</div>"
  );
}

function bmOpenFloorPicker() {
  bmRefresh(state);
  const floors = BM_FLOORS.filter((f) => f.ready && bmFloorOwned(f.id));
  showModal(
    "바닥 바꾸기",
    '<div class="bm-decoration-body"><div class="bm-decoration-floors">' +
      floors
        .map((f) =>
          button(
            bmFloorPreviewArt(f.id) +
              "<span>" +
              f.name +
              (bmFloorId() === f.id ? '<b aria-hidden="true">✓</b>' : "") +
              "</span>",
            "bmChooseOwnedFloor",
            "bm-decoration-floor " + (bmFloorId() === f.id ? "selected" : ""),
            'data-floor="' + f.id + '" aria-pressed="' + (bmFloorId() === f.id) + '"',
          ),
        )
        .join("") +
      '</div><p id="formError" class="form-error" role="alert"></p></div>',
    "collection",
  );
}

function bmUndoTo(before) {
  return () => {
    state = before;
    persist();
    view = "forest";
    forestEditMode = true;
    render();
    toast("되돌렸어요.");
  };
}

function bmChooseOwnedFloor(id) {
  if (!BM_FLOORS.some((f) => f.id === id && f.ready && bmFloorOwned(id))) return;
  if (bmFloorId() === id) return;
  const before = Model.clone(state);
  if (!bmSetFloor(id)) {
    state = before;
    return;
  }
  const t = BM_FLOOR_THEME[id],
    applied = t && bmThemeAvailable(t) && bmState().treeTheme !== t;
  if (applied) bmApplyTreeTheme(state, t);
  if (!persist()) {
    state = before;
    return;
  }
  closeModal();
  view = "forest";
  forestEditMode = true;
  render();
  if (applied)
    toast(BM_TREE_THEMES.find((x) => x.id === t).name + " 나무로 함께 바꿨어요.", bmUndoTo(before));
}

function bmAction(a, b) {
  if (
    !BM_STORE_OPEN &&
    ["bmQuickBuy", "bmBuyStart", "bmPackage", "bmAdStart", "bmRedeemStart", "bmCoupons"].includes(a)
  ) {
    toast("스페셜 나무와 바닥은 곧 열려요.");
    return true;
  }
  if (a === "bmDecorateForest") {
    bmDecorateForest();
    return true;
  }
  if (a === "bmDecorateFloors") {
    bmDecorateForest();
    bmOpenFloorPicker();
    return true;
  }
  if (a === "bmChooseOwnedTree") {
    bmChooseOwnedTree(b.dataset.id, b.dataset.species);
    return true;
  }
  if (a === "bmAutoOwnedTree") {
    bmChooseOwnedTree(b.dataset.id, "", true);
    return true;
  }
  if (a === "bmEditTab") {
    bmEditTab = b.dataset.tab === "floor" ? "floor" : "sets";
    render();
    return true;
  }
  if (a === "bmForestSet") {
    const st = BM_FOREST_SETS.find((x) => x.id === b.dataset.set);
    if (!st) return true;
    if (!bmFloorOwned(st.floor)) {
      forestEditMode = false;
      openCollection(st.shop);
      return true;
    }
    if (bmSetActive(st)) return true;
    const before = Model.clone(state);
    bmSetFloor(st.floor);
    bmApplyTreeTheme(state, bmThemeAvailable(st.theme) ? st.theme : "classic");
    if (!persist()) {
      state = before;
      return true;
    }
    view = "forest";
    forestEditMode = true;
    render();
    toast(st.name + "으로 꾸몄어요.", bmUndoTo(before));
    return true;
  }
  if (a === "bmFloorOnly") {
    const id = b.dataset.floor;
    if (!bmFloorOwned(id) || bmFloorId() === id) return true;
    const before = Model.clone(state);
    bmSetFloor(id);
    if (!persist()) {
      state = before;
      return true;
    }
    view = "forest";
    forestEditMode = true;
    render();
    toast("바닥만 바꿨어요.", bmUndoTo(before));
    return true;
  }
  if (a === "bmTreeTheme") {
    const t = b.dataset.theme;
    if (!bmThemeAvailable(t)) {
      forestEditMode = false;
      openCollection(t);
      return true;
    }
    if (bmState().treeTheme === t && t !== "mix" && !bmState().themeCustom) return true;
    const before = Model.clone(state);
    bmApplyTreeTheme(state, t);
    if (!persist()) {
      state = before;
      return true;
    }
    view = "forest";
    forestEditMode = true;
    render();
    toast(
      t === "mix"
        ? "가진 나무를 섞어서 심었어요."
        : BM_TREE_THEMES.find((x) => x.id === t).name + " 나무로 바꿨어요.",
      bmUndoTo(before),
    );
    return true;
  }
  if (a === "bmPreviewReset") {
    bmPreviewResetConfirm();
    return true;
  }
  if (a === "bmChooseOwnedFloor") {
    bmChooseOwnedFloor(b.dataset.floor);
    return true;
  }
  if (a === "bmCodex" || a === "bmCodexTab") {
    bmOpenCodex(b.dataset.tab);
    return true;
  }
  if (a === "bmPreviewTree") {
    bmOpenPreview("tree", b.dataset.species, b.dataset.id);
    return true;
  }
  if (a === "bmPreviewFloor") {
    bmOpenPreview("floor", b.dataset.floor);
    return true;
  }
  if (a === "bmApplyPreview") {
    bmApplyPreview();
    return true;
  }
  if (a === "bmBackCollection") {
    openCollection(bmPreview?.backTab || bmCollectionTab);
    return true;
  }
  if (a === "bmCoupons") {
    if (bmPreview?.kind === "tree") bmPendingProduct = { ...bmPreview };
    openCollection("coupons");
    return true;
  }
  if (a === "bmReturnProduct") {
    const p = bmPendingProduct;
    bmPendingProduct = null;
    if (p) bmOpenPreview(p.kind, p.id, p.itemId);
    return true;
  }
  if (a === "bmQuickBuy") {
    const kind = b.dataset.kind,
      id = kind === "floor" ? b.dataset.floor : b.dataset.species;
    if (
      (kind === "tree" && (!bmTreeReady(id) || bmReadyTreeIds().includes(id))) ||
      (kind === "floor" && (!BM_FLOORS.some((f) => f.id === id && f.ready) || bmFloorOwned(id)))
    )
      return true;
    bmPreview = {
      kind,
      id,
      itemId: b.dataset.id || bmWork()?.id || "",
      backTab: bmCollectionTab,
      source: "store",
    };
    bmOpenCheckout(kind);
    return true;
  }
  if (a === "bmPayCash") {
    bmOpenCheckout("tree");
    return true;
  }
  if (a === "bmPayCoupon") {
    const q = bmCouponStatus();
    if (q.balance >= q.cost) bmOpenCheckout("coupon");
    return true;
  }
  if (a === "bmBrowsePaid") {
    bmTreeFilter = "shop";
    openCollection("inventory");
    return true;
  }
  if (a === "bmTreeFilter") {
    bmTreeFilter = ["free", "shop", "mystery", "owned"].includes(b.dataset.filter) ? b.dataset.filter : "all";
    openCollection("inventory");
    return true;
  }
  if (a === "bmPackage") {
    if (b.dataset.pack) bmActivePack = b.dataset.pack;
    if (!bmPackageInfo().canBuy) {
      toast("이미 가진 나무가 있어서 이 패키지는 살 수 없어요.");
      return true;
    }
    bmOpenCheckout("package");
    return true;
  }
  if (a === "bmAdStart") {
    bmOpenCheckout("ad");
    return true;
  }
  if (a === "bmBuyStart") {
    if (bmPreview) bmOpenCheckout(bmPreview.kind);
    return true;
  }
  if (a === "bmRedeemStart") {
    const q = bmCouponStatus();
    if (q.balance >= q.cost) bmOpenCheckout("coupon");
    else {
      if (bmPreview?.kind === "tree") bmPendingProduct = { ...bmPreview };
      openCollection("coupons");
    }
    return true;
  }
  if (a === "bmConfirmAcquire") {
    bmConfirmAcquire();
    return true;
  }
  if (a === "bmCancelAcquire") {
    const request = bmCheckout;
    bmCheckout = null;
    if (request?.preview?.source === "store") openCollection(request.preview.backTab);
    else if (request?.preview)
      bmOpenPreview(request.preview.kind, request.preview.id, request.preview.itemId);
    else openCollection(request?.kind === "ad" ? "coupons" : "inventory");
    return true;
  }
  if (a === "bmResetAppearance") {
    const c = get(b.dataset.id);
    if (c) {
      bmResetItemAppearance(state, c);
      if (persist()) {
        render();
        openCollection("inventory");
        toast("장르에 맞는 나무를 골랐어요.");
      }
    }
    return true;
  }
  return false;
}

/* Shop and codex pages (redesign 14a). Previews and checkout stay as sheets over these pages. */
function bmTreeImgSrc(id) {
  const key = id.startsWith("mystery-") ? (id === "mystery-A" ? "shining" : "moonlight") : id;
  return SONGLIM_TREE_ASSETS[key]?.src || "";
}

function bmTreeImg(id, cls = "", variant = "thumb") {
  const src = bmTreeImgSrc(id).replace("/trees/", "/trees/" + variant + "/");
  return src && bmTreeReady(id)
    ? '<img class="bm-img ' + cls + '" src="' + esc(src) + '" alt="" decoding="async" loading="lazy">'
    : '<span class="bm-img-soon">곧<br>만나요</span>';
}

const BM_PAGE_ICONS = {
  coupon:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/></svg>',
  arrow:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  check:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};

function bmPageTabs(tabs, current, action) {
  return (
    '<div class="bm-page-tabs" role="group">' +
    tabs
      .map(([id, label]) =>
        button(
          label,
          action,
          id === current ? "active" : "",
          'data-tab="' + id + '" aria-pressed="' + (id === current) + '"',
        ),
      )
      .join("") +
    "</div>"
  );
}

function bmShopCard(id) {
  const owned = bmReadyTreeIds().includes(id),
    ready = bmTreeReady(id),
    group = bmCatalogGroup(id);
  const action = !ready
    ? '<span class="bm-shop-action is-soon">곧 만나요</span>'
    : owned
      ? button(
          BM_PAGE_ICONS.check.replace("#FF6A55", "currentColor") + "보유 중",
          "bmPreviewTree",
          "bm-shop-action is-owned",
          'data-species="' + id + '"',
        )
      : group === "shop" && !BM_STORE_OPEN
        ? '<span class="bm-shop-action is-soon">곧 열려요</span>'
        : group === "shop"
          ? button(
              "1,100원",
              "bmQuickBuy",
              "bm-shop-action",
              'data-species="' +
                id +
                '" data-kind="tree" aria-label="' +
                esc(bmTreeName(id)) +
                ' 1,100원 구매 체험"',
            )
          : '<span class="bm-shop-action is-soon">' +
            (group === "mystery" ? "나무 " + BM_MYSTERY_AT[id.slice(-1)] + "그루" : "기록으로 열려요") +
            "</span>";
  return (
    '<article class="bm-shop-card' +
    (ready ? "" : " is-soon") +
    '">' +
    (ready
      ? button(
          bmTreeImg(id),
          "bmPreviewTree",
          "bm-shop-art",
          'data-species="' + id + '" aria-label="' + esc(bmTreeName(id)) + ' 살펴보기"',
        )
      : '<div class="bm-shop-art">' + bmTreeImg(id) + "</div>") +
    '<div class="bm-shop-meta"><strong>' +
    esc(bmTreeName(id)) +
    '</strong><small class="bm-shop-genre">' +
    esc(bmGenreLabel(id) || { base: "클래식", shop: "스페셜", mystery: "히든" }[group]) +
    "</small></div>" +
    action +
    "</article>"
  );
}

// Shop = things you can buy. Genre trees are free and hidden trees are earned, so they live in the codex.
function bmShopTreesHTML() {
  const theme = BM_SALE_THEMES.find((t) => t.id === bmShopFilter),
    groups = (theme ? [theme] : BM_SALE_THEMES)
      .map((t) => ({ ...t, ids: t.ids.filter(bmTreeReady) }))
      .filter((t) => t.ids.length);
  const missing = BM_SHOP_IDS.filter((id) => bmTreeReady(id) && !bmReadyTreeIds().includes(id)).length,
    note =
      BM_STORE_OPEN || !missing
        ? ""
        : '<div class="bm-store-note"><div><strong>스페셜 나무는 곧 살 수 있어요</strong><p>결제를 준비하고 있어요. 아직 없는 나무 ' +
          missing +
          "종을 미리 구경해 보세요.</p></div></div>";
  const section = (t) => {
    const owned = t.ids.filter((id) => bmReadyTreeIds().includes(id)).length;
    return (
      '<div class="bm-shop-head"><h2>' +
      t.name +
      " 나무 " +
      t.ids.length +
      "종</h2>" +
      (owned ? "<span>보유 " + owned + "종</span>" : "") +
      '</div><div class="bm-shop-grid">' +
      t.ids.map(bmShopCard).join("") +
      "</div>"
    );
  };
  return bmShopHeroHTML(theme?.pack) + (theme ? "" : note + bmWeeklyHTML()) + groups.map(section).join("");
}

// Hero carousel: one big card per pack on sale (a first-purchase pack disappears after any paid purchase).
function bmPackWarning(id) {
  const pk = BM_PACKS.map((x) => bmPackageInfo(state, x.id)).find(
    (x) => x.ready && x.untouched && (x.ids.includes(id) || x.floorIds.includes(id)),
  );
  return pk
    ? '<p class="bm-money-note">이 ' +
        (pk.floorIds.includes(id) ? "바닥" : "나무") +
        "를 열면 " +
        esc(pk.pack.name) +
        "는 사라져요.</p>"
    : "";
}

// The pack's trees planted on its floor; used until the pack has its own baked image (pack.art).
function bmPackSceneArt(ids, floor) {
  const s = Model.empty(),
    pick = ids.filter(bmTreeReady).slice(0, 5);
  const items = pick.map((id, i) => {
    const c = Model.add(s, { type: "book", title: bmTreeName(id), creator: "" });
    Model.complete(s, c.id, "2026-01-0" + (i + 1));
    c.speciesId = id;
    c.bmAppearance = true;
    c.bmAssignment = { version: 2, mode: "manual", pool: null, fallback: false, sequence: 0 };
    return c;
  });
  return forestSVG(items, "basic", false, {
    grid: "month",
    minCols: 3,
    transient: true,
    preview: true,
    floor,
  })
    .replace(/viewBox="[^"]*"/, 'viewBox="222 168 276 246" aria-hidden="true"')
    .replace(/ role="group" aria-label="[^"]*"/, "");
}

function bmShopHeroHTML(only) {
  const packs = BM_PACKS.filter((p) => !only || p.id === only)
    .map((p) => bmPackageInfo(state, p.id))
    .filter((p) => p.ready && p.untouched && (!BM_STORE_OPEN || p.canBuy));
  if (!packs.length) return "";
  const slide = (p) => {
    const f = p.floorIds[0],
      trees = p.ids.slice(0, 3);
    return (
      '<article class="bm-hero' +
      (p.pack.tone ? " is-" + p.pack.tone : "") +
      '">' +
      '<div class="bm-hero-copy"><span class="bm-hero-tag">' +
      "묶음 " +
      Math.round((1 - p.pack.price / p.pack.list) * 100) +
      "% 할인" +
      "</span><strong>" +
      esc(p.pack.name) +
      "</strong><small>나무 " +
      p.ids.length +
      "종 + " +
      esc(BM_FLOORS.find((x) => x.id === f)?.name || "") +
      " 바닥</small></div>" +
      '<div class="bm-hero-art" aria-hidden="true">' +
      (p.pack.art ? '<img src="' + p.pack.art + '" alt="" decoding="async">' : bmPackSceneArt(p.ids, f)) +
      "</div>" +
      '<div class="bm-hero-price"><div><strong>' +
      bmKRW(p.pack.price) +
      "</strong><del>" +
      bmKRW(p.pack.list) +
      "</del></div>" +
      (BM_STORE_OPEN
        ? button("구매하기", "bmPackage", "bm-hero-buy", 'data-pack="' + p.pack.id + '"')
        : '<span class="bm-hero-buy is-soon">곧 열려요</span>') +
      "</div>" +
      '<p class="bm-hero-fine">구성 나무가 하나도 없을 때만 살 수 있어요</p>' +
      "</article>"
    );
  };
  return (
    '<div class="bm-hero-track' +
    (packs.length > 1 ? " is-multi" : "") +
    '">' +
    packs.map(slide).join("") +
    "</div>"
  );
}

// Weekly pick: a special tree from the genre you've finished most lately. Changes every Monday.
function bmWeekIndex() {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5 + 3) / 7);
}

function bmWeeklyPick() {
  const ready = BM_SHOP_IDS.filter(bmTreeReady),
    own = new Set(bmReadyTreeIds()),
    fresh = ready.filter((id) => !own.has(id)),
    pickFrom = fresh.length ? fresh : ready,
    week = bmWeekIndex();
  if (!pickFrom.length) return null;
  const done = completedAll(),
    since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10),
    recent = done.filter((c) => String(c.completed) >= since),
    base = recent.length >= 3 ? recent : done,
    count = {};
  base.forEach((c) => {
    const p = bmPool(c);
    if (p) count[p] = (count[p] || 0) + 1;
  });
  for (const [poolId] of Object.entries(count).sort((a, b) => b[1] - a[1])) {
    const pool = BM_POOLS.find((p) => p.id === poolId),
      cand = pool?.paid.filter((id) => pickFrom.includes(id)) || [];
    if (cand.length && !/other$/.test(poolId))
      return {
        id: cand[week % cand.length],
        reason:
          "요즘 " + pool.label + " " + (pool.type === "book" ? "책을 많이 읽었네요" : "영화를 많이 봤네요"),
      };
  }
  return { id: pickFrom[week % pickFrom.length], reason: "그루가 고른 나무" };
}

function bmWeeklyHTML() {
  const pick = bmWeeklyPick();
  if (!pick || bmReadyTreeIds().includes(pick.id)) return "";
  const id = pick.id,
    owned = bmReadyTreeIds().includes(id);
  const action = owned
    ? '<span class="bm-shop-action is-owned">보유 중</span>'
    : !BM_STORE_OPEN
      ? '<span class="bm-shop-action is-soon">곧 열려요</span>'
      : button(
          "1,100원",
          "bmQuickBuy",
          "bm-shop-action",
          'data-species="' +
            id +
            '" data-kind="tree" aria-label="' +
            esc(bmTreeName(id)) +
            ' 1,100원 구매 체험"',
        );
  return (
    '<div class="bm-shop-head"><h2>이번 주 추천</h2><span>월요일에 바뀌어요</span></div><article class="bm-weekly">' +
    button(
      bmTreeImg(id),
      "bmPreviewTree",
      "bm-weekly-art",
      'data-species="' + id + '" aria-label="' + esc(bmTreeName(id)) + ' 살펴보기"',
    ) +
    '<div class="bm-weekly-copy"><small>' +
    esc(pick.reason) +
    "</small><strong>" +
    esc(bmTreeName(id)) +
    "</strong><span>" +
    esc(bmGenreLabel(id)) +
    "</span></div>" +
    action +
    "</article>"
  );
}

function bmCouponBoardHTML() {
  const q = bmCouponStatus(),
    have = Math.min(q.balance, q.cost),
    left = Math.max(0, q.cost - q.balance),
    target = BM_SALE_IDS.find((id) => !bmReadyTreeIds().includes(id)) || "maple";
  const stamps = Array.from({ length: q.cost }, (_, i) =>
    i < have
      ? '<span class="bm-stamp is-filled">' + BM_PAGE_ICONS.check + "</span>"
      : i === q.cost - 1
        ? '<span class="bm-stamp is-goal">' + bmTreeImg(target) + "</span>"
        : '<span class="bm-stamp">' + (i + 1) + "</span>",
  ).join("");
  return (
    '<div class="bm-coupon-board"><div class="bm-coupon-top"><div><span class="bm-pack-kicker">TREE COUPON</span><strong>' +
    have +
    " / " +
    q.cost +
    "장</strong><small>" +
    (left ? left + "장 더 모으면 나무 1종" : "나무 1종을 열 수 있어요") +
    '</small></div><span class="bm-coupon-today">오늘 ' +
    q.watchedToday +
    " / " +
    q.dailyLimit +
    '회</span></div><div class="bm-stamps" role="img" aria-label="쿠폰 ' +
    have +
    '장, 14장 중">' +
    stamps +
    "</div>" +
    button(
      '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="#FF6A55"/></svg>' +
        (q.watchedToday >= q.dailyLimit ? "오늘 2장을 모두 모았어요" : "광고 보고 쿠폰 받기"),
      "bmAdStart",
      "bm-ad-button",
      q.watchedToday >= q.dailyLimit ? "disabled" : "",
    ) +
    "</div>" +
    (bmPendingProduct
      ? button(bmTreeName(bmPendingProduct.id) + "로 돌아가기", "bmReturnProduct", "bm-coupon-return")
      : "") +
    '<ul class="bm-coupon-notes"><li>광고 1회에 쿠폰 1장, 하루 최대 2장이에요.</li><li>쿠폰 14장으로 스페셜 나무 1종을 영구로 열어요.</li><li>매일 모으면 7일에 한 그루씩 열 수 있어요.</li></ul>'
  );
}

function bmShopChips(current) {
  const chips = [
    ["inventory", "전체"],
    ...BM_SALE_THEMES.filter((t) => t.ids.some(bmTreeReady)).map((t) => [t.id, t.name]),
    ["floors", "바닥"],
  ];
  return (
    '<div class="bm-filter-chips bm-shop-chips" role="group" aria-label="상점 분류">' +
    chips
      .map(([id, label]) =>
        button(
          label,
          "collectionTab",
          id === current ? "active" : "",
          'data-tab="' + id + '" aria-pressed="' + (id === current) + '"',
        ),
      )
      .join("") +
    "</div>"
  );
}

function renderShopPage() {
  bmRefresh(state);
  const tab = ["floors", ...(BM_STORE_OPEN ? ["coupons"] : [])].includes(bmCollectionTab)
    ? bmCollectionTab
    : "inventory";
  return (
    '<section class="bm-page"><div class="bm-page-heading"><h1 class="page-title">상점</h1></div>' +
    bmShopChips(tab === "inventory" ? (bmShopFilter === "all" ? "inventory" : bmShopFilter) : tab) +
    (tab === "coupons"
      ? bmCouponBoardHTML()
      : tab === "floors"
        ? '<p class="bm-page-note">' +
          (BM_STORE_OPEN
            ? "기본 바닥은 무료 · 스페셜 바닥은 2,200원"
            : "기본 바닥은 무료 · 스페셜 바닥은 곧 열려요") +
          '</p><div class="bm-floor-list">' +
          BM_FLOORS.map(bmFloorCard).join("") +
          "</div>"
        : bmShopTreesHTML()) +
    "" +
    (BM_STORE_OPEN || tab !== "floors" ? "" : "") +
    "</section>"
  );
}

function bmCodexTreeCard(id) {
  const owned = id.startsWith("mystery-")
      ? bmMysteries().find((t) => "mystery-" + t.id === id)?.unlocked
      : bmReadyTreeIds().includes(id),
    group = bmCatalogGroup(id);
  let note = bmGenreLabel(id) || "처음부터";
  if (group === "record") {
    const m = bmGrowthMilestones().find((t) => t.speciesId === id);
    note = owned ? m.label : m.label + " · " + Math.max(0, m.target - m.progress) + " 남음";
  } else if (group === "shop") note = bmGenreLabel(id) || "스페셜";
  else if (group === "mystery") {
    const m = bmMysteries().find((t) => "mystery-" + t.id === id);
    note = owned ? "열렸어요" : bmMysteryCondition(m) + " · " + Math.min(m.progress, m.at) + "/" + m.at;
  }
  return (
    '<div class="bm-codex-tree' +
    (owned ? "" : " is-locked") +
    '">' +
    (bmTreeReady(id)
      ? button(
          bmTreeImg(id, owned ? "is-sticker" : "", owned ? "sticker" : "thumb"),
          "bmPreviewTree",
          "bm-codex-art",
          'data-species="' + id + '" aria-label="' + esc(bmTreeName(id)) + ' 살펴보기"',
        )
      : '<div class="bm-codex-art is-mystery"><span aria-hidden="true">?</span></div>') +
    (owned || !bmTreeReady(id) ? "" : '<span class="bm-codex-lock">' + BM_PAGE_ICONS.lock + "</span>") +
    "<strong>" +
    esc(bmTreeName(id)) +
    "</strong><small>" +
    esc(note) +
    "</small></div>"
  );
}

// Hidden trees' winter looks: open once the hidden tree is open and you have the snow floor. Never sold.
function bmWinterLooks() {
  const snow = bmFloorOwned("snow");
  return bmMysteries()
    .filter((t) => t.ready)
    .map((t) => ({
      id: "winter" + (t.id === "A" ? "shining" : "moonlight"),
      name: t.id === "A" ? "반짝이는 트리" : "눈꽃 달빛나무",
      base: t,
      open: t.unlocked && snow,
      note: t.unlocked && snow ? "겨울 숲에서" : !t.unlocked ? t.name + "를 열면" : "겨울 숲 바닥이 있으면",
    }));
}

function bmWinterLookCard(w) {
  const src = "./assets/images/trees/" + (w.open ? "sticker" : "thumb") + "/" + w.id + ".webp";
  return (
    '<div class="bm-codex-tree' +
    (w.open ? "" : " is-locked") +
    '"><div class="bm-codex-art"><img class="bm-img' +
    (w.open ? " is-sticker" : "") +
    '" src="' +
    src +
    '" alt="" decoding="async" loading="lazy"></div>' +
    (w.open ? "" : '<span class="bm-codex-lock">' + BM_PAGE_ICONS.lock + "</span>") +
    "<strong>" +
    esc(w.name) +
    "</strong><small>" +
    esc(w.note) +
    "</small></div>"
  );
}

function renderCodexPage() {
  bmRefresh(state);
  const tab = bmCodexTab === "visitors" ? "visitors" : "trees";
  const head =
    '<div class="bm-page-heading"><h1 class="page-title">도감</h1>' +
    bmPageTabs(
      [
        ["trees", "나무"],
        ["visitors", "방문객"],
      ],
      tab,
      "bmCodexTab",
    ) +
    "</div>";
  if (tab === "visitors") {
    const seen = new Set(collectionState().visitorsSeen),
      done = completedAll().length,
      found = FOREST_VISITORS.filter((v) => seen.has(v.id)),
      next = FOREST_VISITORS.find((v) => !seen.has(v.id));
    const hero = found.at(-1) || FOREST_VISITORS[0];
    const card = (v) => {
      const met = seen.has(v.id),
        near = !met && v === next;
      return (
        '<div class="bm-visitor' +
        (met ? "" : " is-locked") +
        '">' +
        '<i class="bm-visitor-art is-thumb" style="background-image:url(./assets/images/forest/' +
        (met ? "sticker" : "thumb") +
        "/visitor-" +
        v.id +
        '.webp)"></i>' +
        "<strong>" +
        esc(v.name) +
        "</strong><small>" +
        (met
          ? "만났어요"
          : done >= v.need
            ? "곧 찾아와요"
            : near
              ? "완료 " + (v.need - done) + "개 더"
              : "완료 " + v.need + "개") +
        "</small></div>"
      );
    };
    return (
      '<section class="bm-page">' +
      head +
      '<div class="bm-codex-hero is-visitors"><div><span>숲을 찾은 친구</span><strong>' +
      found.length +
      "<small>/" +
      FOREST_VISITORS.length +
      "</small></strong><p>작품을 완료할수록 새 친구가 와요." +
      (next
        ? "<br>다음은 " +
          esc(next.name) +
          " · " +
          (done >= next.need ? "곧 찾아와요" : next.need - done + "개 남음")
        : "") +
      '</p></div><span class="bm-codex-hero-art' +
      (found.length ? "" : " is-locked") +
      '"><i class="bm-visitor-art is-thumb" style="background-image:url(./assets/images/forest/thumb/visitor-' +
      hero.id +
      '.webp)"></i></span></div><div class="bm-visitor-grid">' +
      FOREST_VISITORS.map(card).join("") +
      "</div></section>"
    );
  }
  const paid = BM_SHOP_IDS.filter(bmTreeReady),
    mysteries = bmMysteries().map((t) => "mystery-" + t.id),
    winterLooks = bmWinterLooks(),
    total = BM_GENRE_IDS.length + paid.length + mysteries.length + winterLooks.length,
    hidden = bmMysteries().filter((t) => t.unlocked).length + winterLooks.filter((w) => w.open).length,
    owned = [...BM_GENRE_IDS, ...paid].filter((id) => bmReadyTreeIds().includes(id)),
    regular = owned.length;
  const count = (g) => g.filter((id) => bmReadyTreeIds().includes(id)).length,
    latest = owned.at(-1) || "oak";
  const section = (title, sub, ids, mystery = false) =>
    '<section class="bm-codex-section"><div class="bm-shop-head"><div><h2>' +
    title +
    '</h2><p class="bm-codex-sub">' +
    sub +
    "</p></div><span>" +
    (mystery ? bmMysteries().filter((t) => t.unlocked).length : count(ids)) +
    " / " +
    ids.length +
    '</span></div><div class="bm-codex-grid">' +
    ids.map(bmCodexTreeCard).join("") +
    "</div></section>";
  return (
    '<section class="bm-page">' +
    head +
    '<div class="bm-codex-hero"><div><span>모은 나무</span><strong>' +
    (regular + hidden) +
    "<small>/" +
    total +
    '종</small></strong><i class="bm-codex-bar"><b style="width:' +
    Math.round(((regular + hidden) / total) * 100) +
    '%"></b></i></div><span class="bm-codex-hero-art">' +
    bmTreeImg(latest) +
    "</span></div>" +
    section("클래식 나무", "책과 영화의 장르마다 한 그루씩, 처음부터 열려 있어요.", BM_GENRE_IDS) +
    section("히든 나무", "나무를 심을수록 하나씩 열려요. 판매하지 않아요.", mysteries, true) +
    (winterLooks.length
      ? '<section class="bm-codex-section"><div class="bm-shop-head"><div><h2>히든 나무 · 겨울 모습</h2><p class="bm-codex-sub">겨울 숲 바닥에서 바뀐 모습이에요.</p></div><span>' +
        winterLooks.filter((w) => w.open).length +
        " / " +
        winterLooks.length +
        '</span></div><div class="bm-codex-grid">' +
        winterLooks.map(bmWinterLookCard).join("") +
        "</div></section>"
      : "") +
    BM_SALE_THEMES.map((t) => ({ ...t, ids: t.ids.filter(bmTreeReady) }))
      .filter((t) => t.ids.length)
      .map((t) =>
        section(
          t.name + " 나무",
          (t.id === "winter" ? "겨울 숲과 어울리는 나무예요. " : "") +
            (BM_STORE_OPEN ? "상점에서 열 수 있어요." : "상점에서 곧 열려요."),
          t.ids,
        ),
      )
      .join("") +
    "</section>"
  );
}

// The finish date reads like the design ("10.07 오늘 ›"); the native date picker sits on top, invisible.
function finishDateLabel(date) {
  return date.slice(5).replace("-", ".") + (date === now() ? " 오늘" : "");
}

document.addEventListener("input", (e) => {
  if (e.target.id === "finishDate" && Model.validDate(e.target.value)) {
    const t = $("finishDateText");
    if (t) t.textContent = finishDateLabel(e.target.value) + " ›";
  }
  if (e.target.id === "notificationTime") {
    const t = $("notificationTimeText");
    if (t) t.textContent = e.target.value;
  }
});
