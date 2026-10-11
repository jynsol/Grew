/*
 * 나무와 방문객 데이터, 작품 → 나무 종류(분류) 연결, 성장 단계 이름.
 */

const TREE_SPECIES = [
  {
    id: "birch",
    category: "book-humanities",
    name: "자작나무",
    need: 1,
    shape: "airy",
    colors: ["#6F8F63", "#A0B77A", "#56745D"],
    trunk: "#EAE7DC",
  },
  {
    id: "oak",
    category: "book-literature",
    name: "참나무",
    need: 1,
    shape: "broad",
    colors: ["#3E674D", "#718A5B", "#94A56A"],
    trunk: "#6B5745",
  },
  {
    id: "cherry",
    category: "book-literature",
    name: "벚나무",
    need: 3,
    shape: "blossom",
    colors: ["#6F8E5E", "#C9A5A7", "#A7BA78"],
    trunk: "#806A64",
  },
  {
    id: "zelkova",
    category: "book-humanities",
    name: "느티나무",
    need: 3,
    shape: "umbrella",
    colors: ["#75935E", "#A8B874", "#527557"],
    trunk: "#8C8579",
  },
  {
    id: "ginkgo",
    category: "book-science",
    name: "은행나무",
    need: 1,
    shape: "fan",
    colors: ["#C7A94C", "#E4CE74", "#A9833D"],
    trunk: "#77634D",
  },
  {
    id: "metasequoia",
    category: "book-science",
    name: "메타세쿼이아",
    need: 3,
    shape: "spire",
    colors: ["#3F6C60", "#698B72", "#31564D"],
    trunk: "#675747",
  },
  {
    id: "maple",
    category: "album-classical",
    name: "단풍나무",
    need: 1,
    shape: "open",
    colors: ["#5F8A5C", "#87A46B", "#6C9463"],
    trunk: "#755F4A",
  },
  {
    id: "willow",
    category: "album-classical",
    name: "버드나무",
    need: 3,
    shape: "weeping",
    colors: ["#759A76", "#9FB388", "#5A7D66"],
    trunk: "#715E4E",
  },
  {
    id: "magnolia",
    category: "album-popular",
    name: "목련",
    need: 1,
    shape: "openblossom",
    colors: ["#9EBB72", "#87A36A", "#C4D19E"],
    trunk: "#836C58",
  },
  {
    id: "crape",
    category: "album-popular",
    name: "배롱나무",
    need: 3,
    shape: "airyblossom",
    colors: ["#789466", "#B79C7D", "#98AC7E"],
    trunk: "#C7A78C",
  },
  {
    id: "pine",
    category: "album-roots",
    name: "소나무",
    need: 1,
    shape: "pine",
    colors: ["#315D4D", "#4E7558", "#70885E"],
    trunk: "#715944",
  },
  {
    id: "cedar",
    category: "album-roots",
    name: "삼나무",
    need: 3,
    shape: "tallconifer",
    colors: ["#4E736C", "#779A92", "#365851"],
    trunk: "#645445",
  },
  {
    id: "hackberry",
    category: "movie-drama",
    name: "팽나무",
    need: 1,
    shape: "wide",
    colors: ["#70875B", "#96A56B", "#536D50"],
    trunk: "#7C664F",
  },
  {
    id: "fringe",
    category: "movie-drama",
    name: "이팝나무",
    need: 3,
    shape: "fringe",
    colors: ["#96B66F", "#DDD8B8", "#7D9E63"],
    trunk: "#786453",
  },
  {
    id: "fir",
    category: "movie-sf",
    name: "전나무",
    need: 1,
    shape: "tiered",
    colors: ["#365D58", "#50766B", "#294B49"],
    trunk: "#3E362D",
  },
  {
    id: "cypress",
    category: "movie-sf",
    name: "편백나무",
    need: 3,
    shape: "column",
    colors: ["#678877", "#9FC2D2", "#4C725F"],
    trunk: "#6F5B49",
  },
  {
    id: "yew",
    category: "movie-action",
    name: "주목",
    need: 1,
    shape: "oval",
    colors: ["#3F6048", "#5B7655", "#304A3A"],
    trunk: "#655342",
  },
  {
    id: "juniper",
    category: "movie-action",
    name: "향나무",
    need: 3,
    shape: "windswept",
    colors: ["#597168", "#7B8D7C", "#425B54"],
    trunk: "#705A47",
  },
  {
    id: "paulownia",
    category: "other",
    name: "오동나무",
    need: 1,
    shape: "twigleaf",
    colors: ["#849B6B", "#A6B985", "#C4CEAA"],
    trunk: "#7A614D",
  },
  {
    id: "evergreen",
    category: "other",
    name: "후박나무",
    need: 3,
    shape: "dense",
    colors: ["#375F51", "#57775F", "#2B4B43"],
    trunk: "#6C5847",
  },
];

// Winter trees reuse their summer species' shape and size, with a 겨울 name.
TREE_SPECIES.push(
  ...["zelkova", "metasequoia", "pine", "cedar", "juniper", "fringe", "yew", "willow", "cherry", "birch"].map(
    (id) => {
      const t = TREE_SPECIES.find((x) => x.id === id);
      return { ...t, id: "winter" + id, name: "겨울 " + t.name, need: 3 };
    },
  ),
);

// Compatibility helpers are beta-only and never create cash/coupon provenance.

const FOREST_VISITORS = [
  { id: "rabbit", name: "산토끼", need: 1, emoji: "🐇" },
  { id: "bird", name: "박새", need: 6, emoji: "🐦" },
  { id: "butterfly", name: "호랑나비", need: 10, emoji: "🦋" },
  { id: "squirrel", name: "다람쥐", need: 15, emoji: "🐿️" },
  { id: "fox", name: "여우", need: 20, emoji: "🦊" },
  { id: "hedgehog", name: "고슴도치", need: 25, emoji: "🦔" },
  { id: "deer", name: "아기사슴", need: 30, emoji: "🦌" },
  { id: "firefly", name: "반딧불이", need: 40, emoji: "✨" },
  { id: "owl", name: "부엉이", need: 50, emoji: "🦉" },
];

function mappedCategory(type, genre) {
  return (
    TREE_CATEGORIES.find((t) => t.type === type && t.pattern?.test(String(genre || "").normalize("NFKC"))) ||
    TREE_CATEGORIES[9]
  );
}

function category(c) {
  // Explicit category is only for legend samples, never a user's cached override.
  if (!Object.prototype.hasOwnProperty.call(c, "genre") && !c.id && c.treeCategory)
    return (
      TREE_CATEGORIES.find((t) => t.id === c.treeCategory && (t.type === c.type || t.id === "other")) ||
      TREE_CATEGORIES[9]
    );
  return mappedCategory(c.type, c.genre);
}

function shortCategoryLabel(cat) {
  return String(cat?.label || "기타").replace(/^(책|음악|영화)\s*·\s*/, "");
}

function mappedForestCategoryLabel(type, genre) {
  return shortCategoryLabel(mappedCategory(type, genre));
}

function validRating(n) {
  n = Number(n);
  return Number.isFinite(n) && n >= 0.5 && n <= 5 ? n : null;
}

function contentMetadata(c) {
  const seed =
    typeof SEED_BOOKS !== "undefined" && c.type === "book"
      ? SEED_BOOKS.find(
          (b) =>
            Model.norm(b.title) === Model.norm(c.title) && Model.norm(b.creator) === Model.norm(c.creator),
        )
      : null;
  const genreSource = String(c.genreSource || "");
  const rawGenre = cleanGenreValue(c.rawGenre || c.genre || seed?.genre || "");
  let genre = cleanGenreValue(c.genre || seed?.genre || "");
  let candidates = Array.isArray(c.genreCandidates) ? c.genreCandidates : [];
  if (genreSource !== "user") {
    if (c.type === "movie" && Array.isArray(c.genreIds) && c.genreIds.length) {
      const info = movieGenreInfo(c.genreIds);
      genre = info.primary || genre;
      candidates = info.candidates.length ? info.candidates : candidates;
    } else genre = normalizeGenreForType(c.type, genre || rawGenre, { ...c, genre: genre || rawGenre });
  }
  genre = GENRE_POOL[c.type]?.includes(c.genre) ? c.genre : launchGenre(c.type, genre, c);
  return {
    genre,
    rawGenre,
    genreSource: genreSource || "auto",
    treeCategory: mappedCategory(c.type, genre).id,
    genreMappingVersion: 3,
    genreCandidates: candidates,
    length: Number(c.length) > 0 ? Number(c.length) : null,
    review: String(c.review || ""),
  };
}

// Count the selected year's completed works once each, using their saved primary genre.
// Candidate genres and tree choices describe different things and never add votes.
function collectionState() {
  if (!state.collection || typeof state.collection !== "object")
    state.collection = { treeChoices: {}, disabledSpeciesIds: [], visitorsSeen: [] };
  if (!state.collection.treeChoices) state.collection.treeChoices = {};
  if (!Array.isArray(state.collection.disabledSpeciesIds)) state.collection.disabledSpeciesIds = [];
  if (!Array.isArray(state.collection.visitorsSeen)) state.collection.visitorsSeen = [];
  return state.collection;
}

function completedAll() {
  return state.items.filter((c) => c.completed);
}

function speciesForCategory(categoryId) {
  return TREE_SPECIES.filter((t) => t.category === categoryId);
}

function autoSpecies(c) {
  return TREE_SPECIES.find((t) => t.id === bmAutoSpecies(c)) || TREE_SPECIES[0];
}

function contentSpecies(c) {
  return TREE_SPECIES.find((t) => t.id === c?.speciesId) || autoSpecies(c);
}

function assignAutoSpecies(c, force = false) {
  if (!c) return false;
  const before = JSON.stringify([c.speciesId, c.hiddenTree, c.bmAssignment]);
  bmRefresh(state);
  bmAssignItem(state, c);
  return before !== JSON.stringify([c.speciesId, c.hiddenTree, c.bmAssignment]);
}

function ensureCompletedSpeciesAssignments() {
  const before = JSON.stringify(state.items.map((c) => [c.speciesId, c.hiddenTree, c.bmAssignment]));
  bmRefresh(state);
  return before !== JSON.stringify(state.items.map((c) => [c.speciesId, c.hiddenTree, c.bmAssignment]));
}

function remapDefaultSpeciesByCategory() {
  return false;
}

function previewSpeciesArt(speciesId, theme = "basic") {
  const key = (theme === "snow" || theme === "winter" ? "winter" : "") + speciesId,
    b = (SONGLIM_TREE_ASSETS[key] || SONGLIM_TREE_ASSETS.birch).bounds;
  return (
    '<g transform="translate(' +
    (-(b.x + b.width / 2)).toFixed(3) +
    ' 0)">' +
    speciesArt(speciesId, theme) +
    "</g>"
  );
}

// Growth artwork shares the tree palette; the original four stages are unchanged.
// Growth steps: 씨앗 → 새싹 (1 record day) → 덤불 (2) → 어린 나무 (3+) → 나무 (finished).
// Stage 2 covers both 덤불 and 어린 나무; the record-day count tells them apart.
const GROWTH_NAMES = { seed: "씨앗", sprout: "새싹", bush: "덤불", young: "어린 나무", mature: "나무" };

function growthKey(c, stage = Model.stage(c)) {
  if (stage === 3) return "mature";
  if (stage === 1) return "sprout";
  if (stage === 0) return "seed";
  return c && new Set((c.logs || []).map((l) => l.date)).size < 3 ? "bush" : "young";
}

function growthAppearance(stage, c) {
  const key = growthKey(c, stage);
  return { key, name: GROWTH_NAMES[key] };
}

function growth(stage, c, featured = false) {
  const uid = "growth-" + (growth.serial = (growth.serial || 0) + 1),
    appearance = growthAppearance(stage, c);
  const mature = stage === 3 && c;
  const key = appearance.key === "mature" ? "young" : appearance.key,
    b = SONGLIM_TREE_ASSETS[key].bounds,
    scale = stage === 0 ? 2.05 : stage === 1 ? 1.95 : 1.5;
  const featuredArt =
    featured && !mature
      ? '<g class="growth-stage-art" transform="translate(' +
        (160 - (b.x + b.width / 2) * scale).toFixed(2) +
        " " +
        (184 - (b.y + b.height) * scale).toFixed(2) +
        ") scale(" +
        scale +
        ')">' +
        illustratedSpeciesArt(key) +
        "</g>"
      : "";
  const art =
    featured && !mature
      ? featuredArt
      : mature
        ? '<g transform="translate(160 160) scale(1.95)">' + treeArt(c, "basic") + "</g>"
        : '<g class="growth-stage-art" transform="translate(160 174)">' +
          illustratedSpeciesArt(appearance.key === "mature" ? "young" : appearance.key) +
          "</g>";
  const label = mature ? category(c).label + " 나무" : appearance.name;
  return (
    '<svg class="growth" viewBox="0 0 320 220" role="img" aria-label="' +
    esc(label) +
    '"><defs><radialGradient id="' +
    uid +
    '-bg" cx=".4" cy=".35" r=".7"><stop stop-color="#F9FBF1"/><stop offset="1" stop-color="#E6EFDF"/></radialGradient></defs><circle cx="160" cy="112" r="95" fill="url(#' +
    uid +
    '-bg)"/>' +
    art +
    "</svg>"
  );
}
