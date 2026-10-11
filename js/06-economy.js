/*
 * 상점 규칙: 나무·바닥 보유 상태, 히든 나무 해금, 쿠폰, 패키지, 숲 세트와 테마.
 */

// Songlim launch-flow preview. This module has no network, advertisement, or payment operations.
// Production entitlements must be issued and verified by a server before release.
// Paid trees, floors, the pack and ad coupons stay closed until real payments and ads are connected.
// Flip to true then; while false the shop is a catalogue and nothing pretends to charge.
// Paid store and rewarded ads aren't wired to real payments yet. In the release build the store shows
// "곧 열려요"; the free trial (체험 구매, 광고 쿠폰, 구매 되돌리기) only runs with ?preview=1 in the address,
// which sticks on this device until ?preview=0.
const BM_PREVIEW = (() => {
  try {
    const q = new URLSearchParams(location.search).get("preview");
    if (q === "1") localStorage.setItem("grew.preview", "1");
    if (q === "0") localStorage.removeItem("grew.preview");
    return localStorage.getItem("grew.preview") === "1";
  } catch {
    return false;
  }
})();

const BM_STORE_OPEN = BM_PREVIEW;

const BM_CONFIG = Object.freeze({
  mode: BM_PREVIEW ? "preview" : "off",
  future: Object.freeze({
    regularTrees: 26,
    mysteryTrees: 4,
    totalTrees: 30,
    paidFloorCount: 2,
    treePriceKRW: 1100,
    floorPriceKRW: 2200,
    packagePriceKRW: 9900,
    packageTreeCount: 10,
    rewardedViewsPerDay: 2,
    viewsPerCoupon: 1,
    couponCostPerTree: 14,
    collectionMysteryAt: 20,
    cashMysteryAt: 10,
  }),
});

const BM_FLOORS = [
  { id: "basic", name: "기본 바닥", ready: true, free: true },
  { id: "meadow", name: "꽃이끼 정원", ready: true, free: false },
  { id: "snow", name: "겨울 숲", ready: true, free: false },
  { id: "floor-reserved-01", name: "새 바닥", ready: false, free: false },
];

const BM_BASE_IDS = ["oak", "birch", "fir"];

const BM_RECORD_IDS = ["zelkova", "ginkgo", "metasequoia", "yew", "cedar", "evergreen", "cypress"];

const BM_EXISTING_SHOP_IDS = [
  "cherry",
  "maple",
  "magnolia",
  "crape",
  "fringe",
  "hackberry",
  "willow",
  "pine",
  "juniper",
  "paulownia",
];

// Winter pack: snowy versions of ten trees, sold as their own special trees (one per genre).
const BM_WINTER_IDS = [
  "winterzelkova",
  "wintermetasequoia",
  "winterpine",
  "wintercedar",
  "winterjuniper",
  "winterfringe",
  "winteryew",
  "winterwillow",
  "wintercherry",
  "winterbirch",
];

// 10 special trees still to be drawn: together with the next new floor they make the third pack.
const BM_RESERVED_IDS = Array.from(
  { length: 10 },
  (_, i) => "paid-reserved-" + String(i + 1).padStart(2, "0"),
);

const BM_SALE_IDS = [...BM_EXISTING_SHOP_IDS, ...BM_WINTER_IDS];

const BM_SHOP_IDS = [...BM_SALE_IDS, ...BM_RESERVED_IDS];

const BM_READY_IDS = [...BM_BASE_IDS, ...BM_RECORD_IDS, ...BM_SALE_IDS];

const BM_PAID_FLOOR_IDS = BM_FLOORS.filter((f) => !f.free).map((f) => f.id);

const BM_SOURCE_KINDS = ["base", "growth", "cash", "coupon", "legacy", "beta"];

// Each genre: 1 classic tree + 1 special tree (first pack) + 1 winter tree (winter pack) + 1 still to be drawn.
const BM_POOLS = [
  {
    id: "book-literature",
    type: "book",
    label: "순문학",
    free: "zelkova",
    paid: ["magnolia", "winterzelkova", "paid-reserved-01"],
  },
  {
    id: "book-genre",
    type: "book",
    label: "장르문학",
    free: "metasequoia",
    paid: ["maple", "wintermetasequoia", "paid-reserved-02"],
  },
  {
    id: "book-humanities",
    type: "book",
    label: "인문",
    free: "ginkgo",
    paid: ["pine", "winterpine", "paid-reserved-03"],
  },
  {
    id: "book-science",
    type: "book",
    label: "과학",
    free: "cedar",
    paid: ["paulownia", "wintercedar", "paid-reserved-04"],
  },
  {
    id: "book-other",
    type: "book",
    label: "기타",
    free: "oak",
    paid: ["juniper", "winterjuniper", "paid-reserved-05"],
  },
  {
    id: "movie-drama",
    type: "movie",
    label: "드라마",
    free: "evergreen",
    paid: ["fringe", "winterfringe", "paid-reserved-06"],
  },
  {
    id: "movie-action",
    type: "movie",
    label: "액션·스릴러",
    free: "yew",
    paid: ["hackberry", "winteryew", "paid-reserved-07"],
  },
  {
    id: "movie-sf",
    type: "movie",
    label: "SF·판타지",
    free: "cypress",
    paid: ["willow", "winterwillow", "paid-reserved-08"],
  },
  {
    id: "movie-comedy",
    type: "movie",
    label: "로맨스·코미디",
    free: "fir",
    paid: ["cherry", "wintercherry", "paid-reserved-09"],
  },
  {
    id: "movie-other",
    type: "movie",
    label: "기타",
    free: "birch",
    paid: ["crape", "winterbirch", "paid-reserved-10"],
  },
];

// Tree themes for the whole forest. 'mix' deals each genre's trees in turn; the others use one slot
// per genre (0 classic, 1 special, 2 winter) and fall back to the classic tree when it isn't owned.
// Sale themes: how special trees are grouped in the shop and codex (each is also a pack).
const BM_SALE_THEMES = [
  { id: "special", name: "꽃이끼 정원", pack: "first", ids: BM_EXISTING_SHOP_IDS },
  { id: "winter", name: "겨울 숲", pack: "winter", ids: BM_WINTER_IDS },
  { id: "third", name: "새 나무", pack: "third", ids: BM_RESERVED_IDS },
];

// Each floor's matching tree theme: picking the floor also dresses the forest in that theme.
const BM_FLOOR_THEME = { basic: "classic", meadow: "special", snow: "winter" };

// Forest sets: one tap dresses the forest — a floor plus its matching trees. The decorate dock leads with these.
const BM_FOREST_SETS = [
  {
    id: "basic",
    name: "기본 숲",
    floor: "basic",
    theme: "classic",
    shop: "floors",
    trees: ["zelkova", "ginkgo", "fir"],
  },
  {
    id: "meadow",
    name: "꽃이끼 정원",
    floor: "meadow",
    theme: "special",
    shop: "special",
    trees: ["cherry", "maple", "magnolia"],
  },
  {
    id: "snow",
    name: "겨울 숲",
    floor: "snow",
    theme: "winter",
    shop: "winter",
    trees: ["wintercherry", "winteryew", "winterbirch"],
  },
];

const BM_TREE_THEMES = [
  { id: "mix", name: "섞어서" },
  { id: "classic", name: "클래식", slot: 0 },
  { id: "special", name: "스페셜", slot: 1 },
  { id: "winter", name: "겨울", slot: 2 },
];

function bmThemeSpecies(b, poolId, available) {
  const t = BM_TREE_THEMES.find((t) => t.id === (b?.treeTheme || "mix"));
  if (!t || t.slot === undefined) return null;
  const p = BM_POOLS.find((p) => p.id === poolId);
  if (!p) return null;
  const id = t.slot === 0 ? p.free : p.paid[t.slot - 1];
  return available.includes(id) ? id : p.free;
}

function bmThemeAvailable(id) {
  const t = BM_TREE_THEMES.find((t) => t.id === id);
  if (!t || !t.slot) return true;
  const own = new Set(bmReadyTreeIds());
  return BM_POOLS.some((p) => own.has(p.paid[t.slot - 1]));
}

const BM_GROWTH_RULES = [
  { id: "first-record", speciesId: "zelkova", label: "첫 기록 남기기", target: 1, metric: "record" },
  { id: "first-completion", speciesId: "ginkgo", label: "첫 작품 완료하기", target: 1, metric: "completed" },
  {
    id: "three-completions",
    speciesId: "metasequoia",
    label: "작품 3개 완료하기",
    target: 3,
    metric: "completed",
  },
  {
    id: "book-and-movie",
    speciesId: "yew",
    label: "책과 영화 각각 1개 완료하기",
    target: 2,
    metric: "media",
  },
  {
    id: "thirty-record-days",
    speciesId: "cedar",
    label: "서로 다른 30일에 기록 남기기",
    target: 30,
    metric: "days",
  },
  {
    id: "ten-completions",
    speciesId: "evergreen",
    label: "작품 10개 완료하기",
    target: 10,
    metric: "completed",
  },
  {
    id: "twenty-completions",
    speciesId: "cypress",
    label: "작품 20개 완료하기",
    target: 20,
    metric: "completed",
  },
];

// Genre trees: the free tree of each of the 10 genre pools (5 book, 5 movie). All open from the start;
// paid trees stay paid and hidden trees open by planted count.
const BM_GENRE_IDS = BM_POOLS.map((p) => p.free);

function bmGenreLabel(id) {
  const p = BM_POOLS.find((p) => p.free === id || p.paid.includes(id));
  return p ? (p.type === "book" ? "책" : "영화") + " · " + p.label : "";
}

function bmFresh() {
  return {
    version: 2,
    previewVersion: 2,
    completedKeys: [],
    recordDays: [],
    hasRecorded: false,
    earnedTreeIds: [],
    legacyTreeIds: [],
    legacyMysteryIds: [],
    ownership: {},
    floorOwnership: {},
    previewOwnership: {},
    previewFloorOwnership: {},
    previewCouponViews: {},
    previewCouponSpent: 0,
    nextByPool: {},
    floor: "basic",
    treeTheme: "mix",
  };
}

function bmNorm(v) {
  return String(v || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}]/gu, "");
}

function bmCompletionKey(c) {
  return [c.type, bmNorm(c.title), bmNorm(c.creator)].join("|");
}

function bmValidDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function bmTracked(c) {
  return !!c && ["book", "movie"].includes(c.type);
}

function bmKnownRegular(id) {
  return BM_READY_IDS.includes(id) || BM_RESERVED_IDS.includes(id);
}

function bmTreeReady(id) {
  return BM_READY_IDS.includes(id) || id === "mystery-A" || id === "mystery-B";
}

function bmCatalogGroup(id) {
  return BM_GENRE_IDS.includes(id) ? "base" : BM_SHOP_IDS.includes(id) ? "shop" : "mystery";
}

function bmAddSource(target, id, kind) {
  if (!BM_SOURCE_KINDS.includes(kind)) return false;
  const before = Array.isArray(target[id]) ? target[id] : [];
  if (before.includes(kind)) return false;
  target[id] = [...before, kind];
  return true;
}

function bmRealSources(b, id, floor = false) {
  const kinds = (floor ? b.floorOwnership : b.ownership)?.[id];
  return Array.isArray(kinds) ? kinds.filter((k) => BM_SOURCE_KINDS.includes(k) && k !== "beta") : [];
}

function bmPreviewSources(b, id, floor = false) {
  if (BM_CONFIG.mode !== "preview") return [];
  const kinds = (floor ? b.previewFloorOwnership : b.previewOwnership)?.[id];
  return Array.isArray(kinds) ? kinds.filter((k) => k === "cash" || (!floor && k === "coupon")) : [];
}

function bmOwnedFrom(b) {
  return [
    ...new Set([
      ...BM_GENRE_IDS,
      ...Object.keys(b.ownership || {}).filter((id) => bmKnownRegular(id) && bmRealSources(b, id).length),
      ...Object.keys(b.previewOwnership || {}).filter(
        (id) => bmTreeReady(id) && BM_SHOP_IDS.includes(id) && bmPreviewSources(b, id).length,
      ),
    ]),
  ];
}

function bmCashOwnedFrom(b, id) {
  return bmRealSources(b, id).includes("cash") || bmPreviewSources(b, id).includes("cash");
}

// Hidden trees are never sold: each one opens when you have planted enough trees (finished works).
const BM_MYSTERY_AT = { A: 30, B: 50, C: 75, D: 100 };

function bmMysteryAvailableFrom(b, kind) {
  if (!["A", "B", "C", "D"].includes(kind)) return false;
  if (b.legacyMysteryIds?.includes(kind)) return true;
  return bmProgressFrom(b).completed >= BM_MYSTERY_AT[kind];
}

function bmCanUseFrom(b, id) {
  if (id === "mystery-A" || id === "mystery-B") return bmMysteryAvailableFrom(b, id.slice(-1));
  return bmTreeReady(id) && bmOwnedFrom(b).includes(id);
}

function bmPool(c) {
  if (!bmTracked(c)) return null;
  const g = String(c.genre || "")
    .normalize("NFKC")
    .trim();
  if (!g || g === "기타") return c.type === "book" ? "book-other" : "movie-other";
  if (c.type === "book") {
    if (/과학|수학|생물|물리|화학|의학|기술|컴퓨터|프로그래밍|자연|환경|science|technology|\bIT\b/i.test(g))
      return "book-science";
    if (
      /인문|철학|역사|사회|정치|심리|예술|경제|경영|자기계발|교육|humanities|history|philosophy|business/i.test(
        g,
      )
    )
      return "book-humanities";
    if (
      /장르문학|추리|미스터리|스릴러|판타지|로맨스|공포|무협|\bSF\b|mystery|thriller|fantasy|romance|horror/i.test(
        g,
      )
    )
      return "book-genre";
    if (/문학|소설|수필|에세이|시집|^시$|아동|청소년|만화|fiction|literature|poetry|essay/i.test(g))
      return "book-literature";
  } else {
    if (/코미디|로맨스|가족|comedy|romance|family/i.test(g)) return "movie-comedy";
    if (/액션|스릴러|범죄|공포|미스터리|전쟁|서부|action|thriller|crime|horror|mystery|war|western/i.test(g))
      return "movie-action";
    if (/\bSF\b|공상|판타지|애니메이션|모험|animation|fantasy|adventure|science fiction/i.test(g))
      return "movie-sf";
    if (/드라마|로맨스|음악|역사|다큐|drama|romance|music|history|documentary/i.test(g)) return "movie-drama";
  }
  return c.type === "book" ? "book-other" : "movie-other";
}

function bmFallback(c) {
  return c?.type === "movie" ? "birch" : "oak";
}

function bmAvailablePool(c, s = state) {
  const b = s.collection?.bm || bmRefresh(s),
    p = BM_POOLS.find((p) => p.id === bmPool(c));
  if (!p) return [];
  const owned = new Set(bmOwnedFrom(b));
  return [p.free, ...p.paid].filter((id) => bmTreeReady(id) && owned.has(id));
}

function bmProgressFrom(b) {
  return {
    record: b.hasRecorded ? 1 : 0,
    completed: b.completedKeys.length,
    media: new Set(b.completedKeys.map((k) => k.split("|")[0])).size,
    days: b.recordDays.length,
  };
}

function bmGrowthFrom(b) {
  const p = bmProgressFrom(b);
  return BM_GROWTH_RULES.map((r) => ({
    ...r,
    progress: Math.min(r.target, p[r.metric]),
    done: b.earnedTreeIds.includes(r.speciesId) || p[r.metric] >= r.target,
  }));
}

function bmSyncLedger(b, items) {
  const keys = new Set(b.completedKeys),
    days = new Set(b.recordDays);
  for (const c of items) {
    if (!bmTracked(c)) continue;
    if (c.completed) {
      keys.add(bmCompletionKey(c));
      b.hasRecorded = true;
      if (bmValidDate(c.completed)) days.add(c.completed);
    }
    for (const l of Array.isArray(c.logs) ? c.logs : [])
      if (bmValidDate(l?.date)) {
        days.add(l.date);
        b.hasRecorded = true;
      }
  }
  b.completedKeys = [...keys];
  b.recordDays = [...days].sort();
  for (const r of bmGrowthFrom(b))
    if (r.done) {
      if (!b.earnedTreeIds.includes(r.speciesId)) b.earnedTreeIds.push(r.speciesId);
      bmAddSource(b.ownership, r.speciesId, "growth");
    }
  for (const id of BM_BASE_IDS) bmAddSource(b.ownership, id, "base");
  if (BM_CONFIG.mode === "beta") {
    for (const id of BM_READY_IDS) bmAddSource(b.ownership, id, "beta");
    bmAddSource(b.floorOwnership, "meadow", "beta");
  }
}

function bmSanitize(raw, items = []) {
  const b = bmFresh(),
    regular = new Set([...BM_READY_IDS, ...BM_RESERVED_IDS]);
  const unique = (v, test) =>
    Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && test(x)))] : [];
  const sourceMap = (v, allowed) => {
    const out = {};
    if (v && typeof v === "object" && !Array.isArray(v))
      for (const [id, kinds] of Object.entries(v))
        if (allowed(id)) {
          const good = unique(kinds, (k) => BM_SOURCE_KINDS.includes(k));
          if (good.length) out[id] = good;
        }
    return out;
  };
  if (raw?.version === 2) {
    b.completedKeys = unique(raw.completedKeys, (k) => /^(book|movie)\|[^|]+\|/.test(k) && k.length <= 2000);
    b.recordDays = unique(raw.recordDays, bmValidDate);
    b.hasRecorded = raw.hasRecorded === true;
    b.earnedTreeIds = unique(raw.earnedTreeIds, (id) => BM_RECORD_IDS.includes(id));
    b.legacyTreeIds = unique(raw.legacyTreeIds, (id) => regular.has(id));
    b.legacyMysteryIds = unique(raw.legacyMysteryIds, (id) => ["A", "B", "C", "D"].includes(id));
    b.ownership = sourceMap(raw.ownership, (id) => regular.has(id));
    b.floorOwnership = sourceMap(raw.floorOwnership, (id) => BM_PAID_FLOOR_IDS.includes(id));
    b.previewOwnership = sourceMap(raw.previewOwnership, (id) => BM_SALE_IDS.includes(id));
    b.previewFloorOwnership = sourceMap(raw.previewFloorOwnership, (id) => BM_PAID_FLOOR_IDS.includes(id));
    for (const [id, kinds] of Object.entries(b.previewOwnership)) {
      const good = kinds.filter((k) => k === "cash" || k === "coupon");
      if (good.length) b.previewOwnership[id] = good;
      else delete b.previewOwnership[id];
    }
    for (const [id, kinds] of Object.entries(b.previewFloorOwnership)) {
      if (kinds.includes("cash")) b.previewFloorOwnership[id] = ["cash"];
      else delete b.previewFloorOwnership[id];
    }
    if (
      raw.previewCouponViews &&
      typeof raw.previewCouponViews === "object" &&
      !Array.isArray(raw.previewCouponViews)
    )
      for (const [date, n] of Object.entries(raw.previewCouponViews))
        if (bmValidDate(date) && Number.isSafeInteger(n) && n > 0)
          b.previewCouponViews[date] = Math.min(n, BM_CONFIG.future.rewardedViewsPerDay);
    // previewVersion 1 used 12 views per coupon and 1 coupon per tree; trees opened then are kept.
    const cost = BM_CONFIG.future.couponCostPerTree,
      legacyCoupons = raw.previewVersion !== 2;
    const earned = Math.floor(
      Object.values(b.previewCouponViews).reduce((sum, n) => sum + n, 0) / BM_CONFIG.future.viewsPerCoupon,
    );
    const allowed = legacyCoupons ? Math.floor(earned / 12) : Math.floor(earned / cost);
    let couponOwned = 0;
    for (const id of BM_SALE_IDS)
      if (b.previewOwnership[id]?.includes("coupon")) {
        if (couponOwned < allowed) couponOwned++;
        else {
          b.previewOwnership[id] = b.previewOwnership[id].filter((k) => k !== "coupon");
          if (!b.previewOwnership[id].length) delete b.previewOwnership[id];
        }
      }
    b.previewCouponSpent = legacyCoupons
      ? Math.min(earned, couponOwned * cost)
      : Math.max(
          couponOwned * cost,
          Number.isSafeInteger(raw.previewCouponSpent) && raw.previewCouponSpent >= 0
            ? Math.min(raw.previewCouponSpent, earned)
            : 0,
        );
    b.treeTheme = BM_TREE_THEMES.some((t) => t.id === raw.treeTheme) ? raw.treeTheme : "mix";
    b.themeCustom = raw.themeCustom === true;
    for (const p of BM_POOLS) {
      const n = raw.nextByPool?.[p.id];
      if (Number.isSafeInteger(n) && n >= 0) b.nextByPool[p.id] = Math.min(n, 1000000);
    }
  } else {
    // v1 purchase demos were never money payments and cannot unlock cash rewards.
    if (raw?.version === 1) {
      b.completedKeys = unique(
        raw.completedKeys,
        (k) => /^(book|movie)\|[^|]+\|/.test(k) && k.length <= 2000,
      );
      b.legacyTreeIds = [
        ...unique(raw.legacyTreeIds, (id) => regular.has(id)),
        ...unique(raw.earnedTreeIds, (id) => BM_RECORD_IDS.includes(id)),
      ];
      b.legacyMysteryIds = unique(raw.legacyMysteryIds, (id) => ["A", "B"].includes(id));
      for (const id of unique(raw.demoOwnedTreeIds, (id) => regular.has(id)))
        bmAddSource(b.ownership, id, "beta");
      if (raw.demoOwnedFloorIds?.includes("meadow")) bmAddSource(b.floorOwnership, "meadow", "beta");
    }
    // Existing drawings are kept during the model transition, independent of genre.
    for (const c of items)
      if (bmTracked(c) && c.completed) {
        if (BM_READY_IDS.includes(c.speciesId)) b.legacyTreeIds.push(c.speciesId);
        if (["A", "B"].includes(c.hiddenTree)) b.legacyMysteryIds.push(c.hiddenTree);
      }
    b.legacyTreeIds = [...new Set(b.legacyTreeIds)];
    b.legacyMysteryIds = [...new Set(b.legacyMysteryIds)];
  }
  // Beta access was temporary; retain genuine ownership and per-record artwork instead.
  for (const target of [b.ownership, b.floorOwnership])
    for (const [id, kinds] of Object.entries(target)) {
      const real = kinds.filter((k) => k !== "beta");
      if (real.length) target[id] = real;
      else delete target[id];
    }
  for (const id of b.legacyTreeIds) bmAddSource(b.ownership, id, "legacy");
  for (const id of b.earnedTreeIds) bmAddSource(b.ownership, id, "growth");
  bmSyncLedger(b, items);
  b.floor = BM_PAID_FLOOR_IDS.includes(raw?.floor) && bmFloorOwnedFrom(b, raw.floor) ? raw.floor : "basic";
  for (const c of items) {
    if (!bmTracked(c)) continue;
    const a = c.bmAssignment,
      validMode = ["auto", "manual", "legacy"].includes(a?.mode);
    if (raw?.version === 2 && a?.version === 2 && validMode) {
      c.bmAssignment = {
        version: 2,
        mode: a.mode,
        pool: BM_POOLS.some((p) => p.id === a.pool) ? a.pool : null,
        fallback: a.fallback === true,
        sequence: Number.isSafeInteger(a.sequence) && a.sequence >= 0 ? a.sequence : 0,
      };
    } else if (c.completed && (BM_READY_IDS.includes(c.speciesId) || ["A", "B"].includes(c.hiddenTree)))
      c.bmAssignment = { version: 2, mode: "legacy", pool: bmPool(c), fallback: false, sequence: 0 };
    else delete c.bmAssignment;
  }
  return b;
}

function bmRefresh(s) {
  if (!s.collection || typeof s.collection !== "object")
    s.collection = { treeChoices: {}, disabledSpeciesIds: [], visitorsSeen: [] };
  if (s.collection.bm?.version !== 2 || s.collection.bm?.previewVersion !== 2)
    s.collection.bm = bmSanitize(s.collection.bm, s.items || []);
  const b = s.collection.bm;
  bmSyncLedger(b, s.items || []);
  for (const c of s.items || []) {
    if (!bmTracked(c)) continue;
    if (typeof launchGenre === "function" && !GENRE_POOL[c.type]?.includes(c.genre)) {
      if (!c.rawGenre) c.rawGenre = c.genre || "";
      c.genre = launchGenre(c.type, c.genre, c);
    }
    if (!c.bmAssignment && BM_READY_IDS.includes(c.speciesId)) {
      c.bmAssignment = { version: 2, mode: "legacy", pool: bmPool(c), fallback: false, sequence: 0 };
      bmAddSource(b.ownership, c.speciesId, "legacy");
    }
    const a = c.bmAssignment;
    if (
      !a ||
      !bmTreeReady(c.hiddenTree ? "mystery-" + c.hiddenTree : c.speciesId) ||
      (a.mode === "auto" &&
        (!bmCanUseFrom(b, c.hiddenTree ? "mystery-" + c.hiddenTree : c.speciesId) ||
          a.pool !== bmPool(c) ||
          (a.fallback && bmAvailablePool(c, s).length) ||
          (b.treeTheme &&
            b.treeTheme !== "mix" &&
            !c.hiddenTree &&
            c.speciesId !== bmThemeSpecies(b, a.pool, bmAvailablePool(c, s)))))
    )
      bmAssignItem(s, c, true);
  }
  return b;
}

function bmState() {
  const b = state.collection?.bm;
  return b?.version === 2 && b.previewVersion === 2 && b.ownership?.oak ? b : bmRefresh(state);
}

function bmOwnedTreeIds() {
  return bmOwnedFrom(bmState());
}

function bmGrowthMilestones(s = state) {
  return bmGrowthFrom(bmRefresh(s));
}

function bmMysteries() {
  const b = bmState(),
    planted = bmProgressFrom(b).completed;
  return [
    { id: "A", name: "반짝이는 나무", ready: true },
    { id: "B", name: "달빛나무", ready: true },
    { id: "C", name: "미스터리 나무", ready: false },
    { id: "D", name: "미스터리 나무", ready: false },
  ].map((t) => ({
    ...t,
    at: BM_MYSTERY_AT[t.id],
    metric: "trees",
    progress: planted,
    unlocked: bmMysteryAvailableFrom(b, t.id),
  }));
}

function bmAutoSpecies(c, s = state) {
  const pool = bmAvailablePool(c, s),
    b = s.collection?.bm,
    sequence = c.bmAssignment?.sequence ?? b?.nextByPool?.[bmPool(c)] ?? 0;
  return pool.length ? pool[sequence % pool.length] : bmFallback(c);
}

function bmAssignItem(s, c, force = false) {
  if (!bmTracked(c)) return c;
  const b = s.collection?.bm?.version === 2 ? s.collection.bm : bmRefresh(s);
  if (
    ["manual", "legacy"].includes(c.bmAssignment?.mode) &&
    bmTreeReady(c.hiddenTree ? "mystery-" + c.hiddenTree : c.speciesId)
  )
    return c;
  if (!force && c.bmAssignment && bmTreeReady(c.hiddenTree ? "mystery-" + c.hiddenTree : c.speciesId))
    return c;
  const pool = bmPool(c),
    available = bmAvailablePool(c, s),
    sequence = b.nextByPool[pool] || 0,
    themed = bmThemeSpecies(b, pool, available);
  c.speciesId = themed || (available.length ? available[sequence % available.length] : bmFallback(c));
  c.hiddenTree = null;
  c.bmAppearance = true;
  c.bmAssignment = { version: 2, mode: "auto", pool, fallback: !available.length, sequence };
  if (pool && available.length) b.nextByPool[pool] = sequence + 1;
  return c;
}

function bmAssignManual(s, c, id) {
  if (!bmTracked(c)) return false;
  const b = s.collection?.bm?.version === 2 ? s.collection.bm : bmRefresh(s);
  if (!bmCanUseFrom(b, id)) return false;
  c.speciesId = id.startsWith("mystery-") ? bmFallback(c) : id;
  c.hiddenTree = id.startsWith("mystery-") ? id.slice(-1) : null;
  c.bmAppearance = true;
  c.bmAssignment = {
    version: 2,
    mode: "manual",
    pool: bmPool(c),
    fallback: false,
    sequence: c.bmAssignment?.sequence || 0,
  };
  return true;
}

function bmResetItemAppearance(s, c) {
  if (!bmTracked(c)) return false;
  delete c.bmAssignment;
  bmAssignItem(s, c, true);
  return true;
}

function bmFloorOwnedFrom(b, id) {
  return (
    id === "basic" ||
    (BM_PAID_FLOOR_IDS.includes(id) &&
      !!(bmRealSources(b, id, true).length || bmPreviewSources(b, id, true).length))
  );
}

function bmFloorOwned(id) {
  return bmFloorOwnedFrom(bmState(), id);
}

function bmFloorId() {
  const b = bmState();
  return bmFloorOwnedFrom(b, b.floor) ? b.floor : "basic";
}

function bmSetFloor(id) {
  if (!bmFloorOwned(id)) return false;
  bmState().floor = id;
  return true;
}

function bmCouponStatus(s = state, date = now()) {
  const b = bmRefresh(s),
    totalViews = Object.values(b.previewCouponViews).reduce((sum, n) => sum + n, 0),
    required = BM_CONFIG.future.viewsPerCoupon;
  return {
    watchedToday: bmValidDate(date) ? b.previewCouponViews[date] || 0 : 0,
    dailyLimit: BM_CONFIG.future.rewardedViewsPerDay,
    progress: totalViews % required,
    required,
    balance: Math.max(0, Math.floor(totalViews / required) - b.previewCouponSpent),
    totalViews,
    cost: BM_CONFIG.future.couponCostPerTree,
  };
}

function bmPreviewWatchAd(s = state, date = now()) {
  if (BM_CONFIG.mode !== "preview") return { ok: false, reason: "mode-disabled", couponEarned: 0 };
  if (!bmValidDate(date)) return { ok: false, reason: "invalid-date", couponEarned: 0 };
  const status = bmCouponStatus(s, date);
  if (status.watchedToday >= status.dailyLimit) return { ok: false, reason: "daily-limit", couponEarned: 0 };
  const b = s.collection.bm;
  b.previewCouponViews[date] = status.watchedToday + 1;
  return { ok: true, reason: "", couponEarned: status.progress + 1 === status.required ? 1 : 0 };
}

function bmPreviewTreeCheck(id, s) {
  if (BM_CONFIG.mode !== "preview") return { ok: false, reason: "mode-disabled" };
  if (!BM_SHOP_IDS.includes(id)) return { ok: false, reason: "not-for-sale" };
  if (!bmTreeReady(id)) return { ok: false, reason: "not-ready" };
  const b = bmRefresh(s);
  if (bmOwnedFrom(b).includes(id)) return { ok: false, reason: "already-owned" };
  return { ok: true, reason: "" };
}

function bmPreviewRedeem(id, s = state) {
  const check = bmPreviewTreeCheck(id, s);
  if (!check.ok) return check;
  const status = bmCouponStatus(s);
  if (status.balance < BM_CONFIG.future.couponCostPerTree) return { ok: false, reason: "no-coupon" };
  const b = s.collection.bm;
  bmAddSource(b.previewOwnership, id, "coupon");
  b.previewCouponSpent += BM_CONFIG.future.couponCostPerTree;
  bmRefresh(s);
  return { ok: true, reason: "", id };
}

function bmPreviewBuyTree(id, s = state) {
  const check = bmPreviewTreeCheck(id, s);
  if (!check.ok) return check;
  bmAddSource(s.collection.bm.previewOwnership, id, "cash");
  bmRefresh(s);
  return { ok: true, reason: "", id };
}

function bmPreviewBuyFloor(id, s = state) {
  if (BM_CONFIG.mode !== "preview") return { ok: false, reason: "mode-disabled" };
  const floor = BM_FLOORS.find((f) => f.id === id);
  if (!floor || floor.free) return { ok: false, reason: "not-for-sale" };
  if (!floor.ready) return { ok: false, reason: "not-ready" };
  const b = bmRefresh(s);
  if (bmFloorOwnedFrom(b, id)) return { ok: false, reason: "already-owned" };
  bmAddSource(b.previewFloorOwnership, id, "cash");
  return { ok: true, reason: "", id };
}

// Packs: a discount on the single prices, sold only while you own none of what's inside (open one tree or the
// floor any way and that pack is gone). The third (10 trees + a new floor) appears once its art is ready.
const BM_PACKS = [
  {
    id: "first",
    name: "꽃이끼 정원 패키지",
    trees: BM_EXISTING_SHOP_IDS,
    floors: ["meadow"],
    price: 9900,
    list: 13200,
    art: "./assets/images/shop/pack-first.webp",
  },
  {
    id: "winter",
    name: "겨울 숲 패키지",
    trees: BM_WINTER_IDS,
    floors: ["snow"],
    price: 11000,
    list: 13200,
    art: "./assets/images/shop/pack-winter.webp",
    tone: "sky",
  },
  {
    id: "third",
    name: "세 번째 숲 패키지",
    trees: BM_RESERVED_IDS,
    floors: ["floor-reserved-01"],
    price: 9900,
    list: 13200,
  },
];

let bmActivePack = "first";

function bmPackDef(id = bmActivePack) {
  return BM_PACKS.find((p) => p.id === id) || BM_PACKS[0];
}

function bmPackageInfo(s = state, packId = bmActivePack) {
  const pack = bmPackDef(packId),
    b = bmRefresh(s),
    ids = [...pack.trees],
    floorIds = [...pack.floors],
    floorId = floorIds[0],
    owned = new Set(bmOwnedFrom(b));
  const ready = ids.every(bmTreeReady) && floorIds.every((f) => BM_FLOORS.find((x) => x.id === f)?.ready);
  const newTreeIds = ids.filter((id) => !owned.has(id)),
    duplicateTreeIds = ids.filter((id) => owned.has(id)),
    newCashTreeIds = ids.filter((id) => !bmCashOwnedFrom(b, id));
  const couponDuplicateIds = duplicateTreeIds.filter(
      (id) => bmRealSources(b, id).includes("coupon") || bmPreviewSources(b, id).includes("coupon"),
    ),
    newFloorIds = floorIds.filter((f) => !bmFloorOwnedFrom(b, f)),
    floorNew = newFloorIds.length > 0;
  return {
    pack,
    ready,
    ids,
    floorId,
    floorIds,
    newFloorIds,
    newTreeIds,
    newTreeCount: newTreeIds.length,
    duplicateTreeIds,
    couponDuplicateIds,
    newCashTreeIds,
    newCashTreeCount: newCashTreeIds.length,
    floorNew,
    untouched: !duplicateTreeIds.length && newFloorIds.length === floorIds.length,
    canBuy:
      BM_CONFIG.mode === "preview" &&
      ready &&
      !duplicateTreeIds.length &&
      newFloorIds.length === floorIds.length,
  };
}

function bmPreviewBuyPackage(s = state, packId = bmActivePack) {
  if (BM_CONFIG.mode !== "preview") return { ok: false, reason: "mode-disabled" };
  const info = bmPackageInfo(s, packId);
  if (!info.canBuy) return { ok: false, reason: "nothing-new" };
  const b = s.collection.bm;
  for (const id of info.newCashTreeIds) bmAddSource(b.previewOwnership, id, "cash");
  for (const f of info.newFloorIds) bmAddSource(b.previewFloorOwnership, f, "cash");
  bmRefresh(s);
  return {
    ok: true,
    reason: "",
    newTreeCount: info.newTreeCount,
    newCashTreeCount: info.newCashTreeCount,
    floorNew: info.floorNew,
  };
}
