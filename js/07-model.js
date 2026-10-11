/*
 * 데이터 모델(작품·기록·완료)과 예전 데이터 변환.
 */

const Model = (() => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const today = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const norm = (x) =>
    String(x || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\p{P}]/gu, "");
  const validDate = (x) => {
    if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
    const d = new Date(x + "T00:00:00.000Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === x;
  };
  const empty = () => ({
    version: 3,
    items: [],
    selected: null,
    themes: {},
    profile: { name: "나", bio: "", photo: "", tastes: [] },
    collection: { treeChoices: {}, disabledSpeciesIds: [], visitorsSeen: [], bm: bmFresh() },
    onboarded: false,
    offset: 0,
    filters: { q: "", status: "all", type: "all", sort: "recent" },
  });
  // Starting is explicit and persists independently of the editable daily logs.
  const firstExperienceDate = (c) => {
    const dates = [c.startedAt, ...(c.logs || []).map((l) => l.date)].filter(validDate).sort();
    if (dates.length) return dates[0];
    if (!c.importedProgress) return "";
    const at = (c.saves || [])
      .map((e) => Number(e.at))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)[0];
    const d = at ? new Date(at) : new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const stage = (c) =>
    c.completed
      ? 3
      : Math.max(
          validDate(c.startedAt) || c.importedProgress ? 1 : 0,
          Math.min(2, new Set((c.logs || []).map((l) => l.date).filter(validDate)).size),
        );
  const status = (c) => (c.completed ? "done" : stage(c) > 0 ? "active" : "saved");
  const get = (s, id) => s.items.find((c) => c.id === id);
  const uid = () =>
    globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const add = (s, data, request = uid()) => {
    if (!data || !["book", "movie"].includes(data.type)) throw Error("지금은 책과 영화만 기록할 수 있어요.");
    const providerId = String(data.providerId ?? data.provider_id ?? "").trim(),
      provider = String(data.provider || "").trim();
    const providerDefault = data.type === "album" ? "apple" : data.type === "movie" ? "tmdb" : "";
    let c =
      ((data.type === "album" || data.type === "movie") && providerId
        ? s.items.find(
            (c) =>
              c.type === data.type &&
              String(c.providerId || "") === providerId &&
              String(c.provider || "") === (provider || providerDefault),
          )
        : null) ||
      s.items.find(
        (c) =>
          c.type === data.type &&
          norm(c.title) === norm(data.title) &&
          norm(c.creator) === norm(data.creator),
      );
    if (!c) {
      c = {
        id: uid(),
        type: data.type,
        title: data.title.trim(),
        creator: (data.creator || "").trim(),
        ...contentMetadata(data),
        tracks: data.tracks || [],
        logs: [],
        completed: null,
        rating: null,
        saves: [],
        cover: data.cover || "",
        source: data.source || "",
        publisher: String(data.publisher || ""),
        isbn: String(data.isbn || ""),
        catalogUrl: String(data.catalogUrl || ""),
        publishedAt: String(data.publishedAt || ""),
        provider: provider,
        providerId: providerId,
        releaseDate: String(data.releaseDate || data.release_date || ""),
        trackCount: Number(data.trackCount ?? data.track_count) || null,
        copyright: String(data.copyright || ""),
        originalTitle: String(data.originalTitle || data.original_title || ""),
        originalLanguage: String(data.originalLanguage || data.original_language || ""),
        overview: String(data.overview || data.description || ""),
        runtime: Number(data.runtime ?? data.runtime_minutes ?? data.runtimeMinutes) || null,
        contents: String(data.contents || data.description || ""),
        albumDescription: String(data.albumDescription || ""),
        genreIds: Array.isArray(data.genreIds)
          ? data.genreIds.map(Number).filter(Number.isFinite)
          : Array.isArray(data.genre_ids)
            ? data.genre_ids.map(Number).filter(Number.isFinite)
            : [],
        trackIndex: 0,
      };
      s.items.push(c);
    }
    if (Array.isArray(data.linkSources))
      c.linkSources = normalizeLinkSources([...data.linkSources, ...(c.linkSources || [])]);
    if (!c.saves.some((e) => e.id === request))
      c.saves.push({ id: request, at: Date.now(), source: data.source || "직접 입력" });
    return c;
  };
  const start = (s, id, date) => {
    const c = get(s, id);
    if (!c || c.completed || !["book", "movie"].includes(c.type) || !validDate(date)) return false;
    if (validDate(c.startedAt)) return false;
    c.startedAt = firstExperienceDate(c) || date;
    return true;
  };
  const log = (s, id, date) => {
    const c = get(s, id);
    if (!c || c.completed || !["book", "movie"].includes(c.type) || !validDate(date)) return false;
    if (c.logs.some((l) => l.date === date)) return false;
    c.logs.push({ id: uid(), date, page: "", memo: "" });
    return true;
  };
  const complete = (s, id, date) => {
    const c = get(s, id);
    if (!c || c.completed || !validDate(date)) return false;
    c.completed = date;
    c.completedAt = Date.now();
    bmRefresh(s);
    bmAssignItem(s, c);
    return true;
  };
  const undoComplete = (s, id) => {
    bmRefresh(s);
    const c = get(s, id);
    if (c) {
      c.completed = null;
      c.completedAt = null;
    }
  };
  const remove = (s, id) => {
    bmRefresh(s);
    s.items = s.items.filter((c) => c.id !== id);
    if (s.selected === id) s.selected = null;
  };
  const completed = (s, period) =>
    s.items
      .filter(
        (c) =>
          c.completed &&
          (c.completed === "unknown"
            ? period.length === 4 && forestRecordYear(c) === period
            : c.completed.startsWith(period)),
      )
      .sort((a, b) => a.completed.localeCompare(b.completed) || a.id.localeCompare(b.id));
  const refs = [
    ["작은 화단", 75],
    ["텃밭", 150],
    ["뒷마당", 225],
    ["작은 놀이터", 300],
    ["농구장", 420],
    ["넓은 놀이터", 750],
    ["작은 공원", 1500],
    ["축구장", 7140],
  ];
  const compare = (n) => {
    if (!n) return "";
    if (n < 5) return "화분 하나에 심어졌어요";
    const area = Math.floor(n / 5) * 75;
    return (
      [...refs].sort((a, b) => Math.abs(a[1] - area) - Math.abs(b[1] - area) || a[1] - b[1])[0][0] +
      "만큼 넓어졌어요"
    );
  };
  const stats = (items) => {
    const supported = items.filter((c) => c.type === "book" || c.type === "movie");
    return {
      n: supported.length,
      area: supported.length * 15,
      book: supported.filter((c) => c.type === "book").length,
      movie: supported.filter((c) => c.type === "movie").length,
    };
  };
  function validate(raw) {
    if (!raw || raw.version !== 3 || !Array.isArray(raw.items) || raw.items.length > 10000)
      throw Error(APP_BRAND.ko + " 백업 파일인지 확인해주세요.");
    const s = empty();
    s.items = raw.items
      .filter((c) => c?.type !== "album")
      .map((c) => {
        if (
          !c ||
          typeof c.id !== "string" ||
          !["book", "movie"].includes(c.type) ||
          typeof c.title !== "string" ||
          !c.title.trim() ||
          !Array.isArray(c.logs) ||
          !Array.isArray(c.saves)
        )
          throw Error("백업 파일의 작품 정보가 올바르지 않아요.");
        if (c.completed && c.completed !== "unknown" && !validDate(c.completed))
          throw Error("완료 날짜가 올바르지 않아요.");
        if (
          c.logs.some((l) => !validDate(l.date) || typeof l.id !== "string") ||
          new Set(c.logs.map((l) => l.date)).size !== c.logs.length
        )
          throw Error("기록 날짜를 확인해주세요.");
        return {
          ...c,
          ...contentMetadata(c),
          startedAt: validDate(c.startedAt)
            ? c.startedAt
            : c.importedProgress
              ? firstExperienceDate(c)
              : null,
          importedProgress: !!c.importedProgress,
          linkSources: normalizeLinkSources(c.linkSources),
          rating: validRating(c.rating),
          notes: itemNotesWithReview(c),
          review: "",
          creator: String(c.creator || ""),
          logs: c.logs.map((l) => ({ ...l, page: String(l.page || ""), memo: String(l.memo || "") })),
          tracks: Array.isArray(c.tracks) ? c.tracks.map(String) : [],
          saves: c.saves.map((e) => ({
            id: String(e.id),
            at: Number(e.at) || 0,
            source: String(e.source || ""),
          })),
          cover: /^(?:data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(c.cover || "")
            ? String(c.cover)
            : "",
          source: String(c.source || ""),
          publisher: String(c.publisher || ""),
          isbn: String(c.isbn || ""),
          catalogUrl: /^https:\/\//.test(c.catalogUrl || "") ? String(c.catalogUrl) : "",
          publishedAt: String(c.publishedAt || ""),
          provider: String(c.provider || ""),
          providerId: String(c.providerId || ""),
          releaseDate: String(c.releaseDate || ""),
          trackCount: Number(c.trackCount) || null,
          copyright: String(c.copyright || ""),
          originalTitle: String(c.originalTitle || ""),
          originalLanguage: String(c.originalLanguage || ""),
          overview: String(c.overview || ""),
          runtime: Number(c.runtime ?? c.runtime_minutes ?? c.runtimeMinutes) || null,
          contents: String(c.contents || ""),
          genreIds: Array.isArray(c.genreIds) ? c.genreIds.map(Number).filter(Number.isFinite) : [],
          hiddenTree: ["A", "B"].includes(c.hiddenTree) ? c.hiddenTree : null,
        };
      });
    if (new Set(s.items.map((c) => c.id)).size !== s.items.length)
      throw Error("백업 파일이 손상됐어요. 다른 백업 파일로 다시 시도해주세요.");
    s.selected = s.items.some((c) => c.id === raw.selected) ? raw.selected : null;
    s.themes = Object.fromEntries(
      Object.entries(raw.themes || {})
        .filter(([k]) => /^\d{4}$/.test(k))
        .map(([k]) => [k, "basic"]),
    );
    s.profile = {
      name:
        String(raw.profile?.name || "나")
          .trim()
          .slice(0, 30) || "나",
      bio: String(raw.profile?.bio || "")
        .trim()
        .slice(0, 120),
      photo: profilePhotoSource(raw.profile?.photo),
      tastes: Array.isArray(raw.profile?.tastes)
        ? raw.profile.tastes.filter((x) => typeof x === "string")
        : [],
    };
    s.profile.recommendationHistory = Array.isArray(raw.profile?.recommendationHistory)
      ? [
          ...new Set(
            raw.profile.recommendationHistory.filter(
              (key) => typeof key === "string" && !key.startsWith("album:"),
            ),
          ),
        ]
      : [];
    s.profile.responses =
      raw.profile?.responses && typeof raw.profile.responses === "object"
        ? Object.fromEntries(
            Object.entries(raw.profile.responses).filter(([key]) => !key.startsWith("album:")),
          )
        : {};
    const validSpecies = new Set(TREE_SPECIES.map((t) => t.id)),
      validCats = new Set(TREE_CATEGORIES.map((t) => t.id)),
      validVisitors = new Set(FOREST_VISITORS.map((v) => v.id));
    const rawChoices =
      raw.collection?.treeChoices && typeof raw.collection.treeChoices === "object"
        ? raw.collection.treeChoices
        : {};
    s.collection = {
      treeChoices: Object.fromEntries(
        Object.entries(rawChoices).filter(([cat, id]) => validCats.has(cat) && validSpecies.has(String(id))),
      ),
      disabledSpeciesIds: Array.isArray(raw.collection?.disabledSpeciesIds)
        ? [...new Set(raw.collection.disabledSpeciesIds.map(String).filter((id) => validSpecies.has(id)))]
        : [],
      visitorsSeen: Array.isArray(raw.collection?.visitorsSeen)
        ? [...new Set(raw.collection.visitorsSeen.map(String).filter((id) => validVisitors.has(id)))]
        : [],
    };
    s.collection.bm = bmSanitize(raw.collection?.bm, s.items);
    s.onboarded = !!raw.onboarded;
    s.offset = Number.isInteger(raw.offset) && raw.offset >= 0 && raw.offset <= 365 ? raw.offset : 0;
    s.filters = {
      q: String(raw.filters?.q || ""),
      status: ["saved", "active", "done", "all"].includes(raw.filters?.status) ? raw.filters.status : "all",
      type: ["all", "book", "movie"].includes(raw.filters?.type) ? raw.filters.type : "all",
      sort:
        raw.filters?.sort === "old"
          ? "completed"
          : ["recent", "completed", "many", "rating"].includes(raw.filters?.sort)
            ? raw.filters.sort
            : "recent",
    };
    return s;
  }
  return {
    clone,
    today,
    norm,
    validDate,
    empty,
    status,
    stage,
    firstExperienceDate,
    get,
    uid,
    add,
    start,
    log,
    complete,
    undoComplete,
    remove,
    completed,
    compare,
    stats,
    validate,
    refs,
  };
})();

function migrateLegacy(raw) {
  if (!Array.isArray(raw?.contents)) throw Error("기존 기록 형식을 확인해주세요.");
  const s = Model.empty(),
    mapping = {};
  const date = (x) => {
    const v = String(x || "").replace(/[./]/g, "-");
    return Model.validDate(v) ? v : null;
  };
  for (const old of raw.contents) {
    if (!["book", "movie"].includes(old.type) || !String(old.title || "").trim()) continue;
    const c = Model.add(s, {
      type: old.type,
      title: String(old.title),
      creator: String(old.creator || ""),
      genre: old.genre,
      length: old.length || old.pages || old.duration,
      review: old.review,
      source: String(old.source || "기존 기록"),
      tracks: old.tracks || [],
    });
    mapping[old.id] = c.id;
    const count = Math.max(1, Math.min(10000, Number(old.saveCount) || 1));
    for (let n = c.saves.length; n < count; n++) Model.add(s, c, "legacy-" + old.id + "-" + n);
    for (const r of old.records || []) {
      const d = date(r.date);
      if (d && !c.logs.some((l) => l.date === d))
        c.logs.push({
          id: Model.uid(),
          date: d,
          page: String(r.page || r.pages || ""),
          memo: String(r.memo || ""),
        });
    }
    if (old.status === "experienced" || old.status === "Finished") {
      c.completed = date(old.completed) || "unknown";
      c.rating = Number(old.rating) || null;
    }
    c.trackIndex = Number(old.trackIndex) || 0;
    c.importedProgress = old.status === "in_progress" || !!old.legacyProgress;
  }
  s.selected = mapping[raw.state?.currentId] || null;
  s.onboarded = !!s.items.length;
  return s;
}

const SEED_BOOKS = [];

const CATALOG = [];
