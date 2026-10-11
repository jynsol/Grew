/*
 * 작품 검색: 책·영화·음악 검색 API, 결과 순위, 장르 보강.
 */

const BOOK_SEARCH_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/super-service";

// Google Books는 키 없이 호출하면 요청 한도가 매우 낮아 429가 쉽게 뜬다.
// https://console.cloud.google.com 에서 무료 API 키를 발급해 여기에 넣으면 한도가 크게 늘어난다.
const GOOGLE_BOOKS_API_KEY = "AIzaSyDq4oOZxvJbO9UTR53V9Mm3sGJyCsL8Cvs";

// 콘텐츠 객체에 _loaded 플래그를 직접 심으면 persist()가 그 값을 그대로
// localStorage에 저장해버려서, 키 적용 전에 실패했던 책은 키를 넣은 뒤에도
// 영영 재시도되지 않는 문제가 생긴다. 그래서 시도 상태는 이 페이지가 열려있는
// 동안만 사는 별도의 Map으로 관리하고, 콘텐츠 객체 자체(=저장되는 데이터)는 건드리지 않는다.
const detailIntroAttempts = new Map();

function detailIntroKey(c) {
  return c?.id || "preview:" + (c?.isbn || "") + "|" + (c?.title || "");
}

const BOOK_POPULARITY_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/book-popularity";

let remoteBookResults = [],
  bookSearchSeq = 0,
  bookSearchTimer = null;

let bookSearchRawResults = [],
  bookSearchActiveQuery = "",
  bookSearchNextPage = 2,
  bookSearchHasMore = false,
  bookSearchLoadingMore = false,
  bookSearchStagnantPages = 0,
  bookSearchObserver = null;

let scrapAddedBookKeys = new Set();

const BOOK_SEARCH_PAGE_SIZE = 20;

const MUSIC_SEARCH_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/music-search";

const MUSIC_POPULARITY_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/music-popularity";

const MOVIE_SEARCH_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/movie-search";

const MOVIE_RECOMMEND_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/movie-recommend";

const IMAGE_OCR_ENDPOINT = "https://gytfefnvpqqxveryhopw.supabase.co/functions/v1/image-ocr";

let remoteAlbumResults = [],
  musicSearchSeq = 0,
  musicSearchTimer = null;

let remoteMovieResults = [],
  movieSearchSeq = 0,
  movieSearchTimer = null;

function unwrapBookDocuments(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.documents,
    payload?.books,
    payload?.items,
    payload?.results,
    payload?.data?.documents,
    payload?.data?.books,
    payload?.data?.items,
    payload?.body?.documents,
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeRemoteBook(d) {
  const creators = Array.isArray(d?.authors)
    ? d.authors
    : Array.isArray(d?.author)
      ? d.author
      : [d?.author || d?.creator || ""];
  const popularityCount =
    Number(
      d?.ratingsCount ??
        d?.ratingCount ??
        d?.reviewCount ??
        d?.reviews ??
        d?.salesCount ??
        d?.sales_count ??
        d?.popularity ??
        0,
    ) || 0;
  const averageRating = Number(d?.averageRating ?? d?.rating ?? 0) || 0;
  const base = {
    type: "book",
    title: String(d?.title || d?.bookTitle || "")
      .replace(/<[^>]+>/g, "")
      .trim(),
    creator: creators.filter(Boolean).join(", ").trim(),
    publisher: String(d?.publisher || "").trim(),
    isbn: String(d?.isbn || d?.isbn13 || d?.isbn10 || "").trim(),
    cover: String(
      d?.thumbnail ||
        d?.cover ||
        d?.image ||
        d?.imageUrl ||
        d?.image_url ||
        d?.coverUrl ||
        d?.cover_url ||
        d?.thumbnailUrl ||
        d?.thumbnail_url ||
        "",
    ).trim(),
    catalogUrl: String(d?.url || d?.link || "").trim(),
    publishedAt: String(d?.datetime || d?.publishedAt || d?.pubdate || "").trim(),
    contents: String(d?.contents || d?.description || d?.overview || "").trim(),
    source: "카카오 책 검색",
    searchPopularity: popularityCount,
    averageRating,
    adultYn: String(d?.adultYn || d?.adult || "").toUpperCase(),
  };
  const rawGenre = cleanGenreValue(d?.genre || d?.category || d?.categoryName || d?.subject || ""),
    genre = normalizeBookGenre(rawGenre, base);
  return {
    ...base,
    genre,
    rawGenre,
    genreSource: "auto",
    genreCandidates: genre ? [[genre, rawGenre ? "외부 분류" : "자동분류"]] : [],
  };
}

function bookSearchCoreTitle(value) {
  return Model.norm(
    String(value || "")
      .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
      .replace(/[:：\-–—]\s*[^:：\-–—]+$/, " ")
      .replace(/\s+/g, " "),
  );
}

const BOOK_PUBLISHER_TIERS = [
  { score: 1.0, names: ["민음사", "문학동네", "황금가지", "창비", "문학과지성사", "열린책들", "을유문화사"] },
  {
    score: 0.82,
    names: [
      "현대문학",
      "시공사",
      "아르테",
      "은행나무",
      "문학수첩",
      "비채",
      "웅진지식하우스",
      "김영사",
      "북하우스",
      "세계사",
      "돌베개",
    ],
  },
  {
    score: 0.68,
    names: [
      "나무의철학",
      "다산책방",
      "알에이치코리아",
      "RHK",
      "위즈덤하우스",
      "해냄",
      "자음과모음",
      "민음인",
    ],
  },
];

function bookPublisherTrust(book) {
  const p = Model.norm(book?.publisher || "");
  if (!p) return 0;
  for (const tier of BOOK_PUBLISHER_TIERS)
    if (tier.names.some((name) => p.includes(Model.norm(name)))) return tier.score;
  return 0.18;
}

function bookEditionTrust(book) {
  let score = 0;
  if (book?.isbn) score += 0.26;
  if (book?.publisher) score += 0.18;
  if (book?.publishedAt) score += 0.1;
  if (book?.cover) score += 0.08;
  score += bookPublisherTrust(book) * 0.38;
  return Math.min(1, score);
}

function primaryIsbn13(value) {
  const parts = String(value || "").match(/\d{10,13}/g) || [];
  return parts.find((x) => x.length === 13) || "";
}

function applyPopularityInfo(book, info) {
  if (!book || !info) return;
  book.yes24Found = Boolean(info?.found);
  book.yes24PopularityScore = Number(info?.popularityScore) || 0;
  book.yes24SalePoint = Number(info?.salePoint) || 0;
  book.yes24StarScore = Number(info?.starScore) || 0;
  book.yes24BestsellerRank = Number(info?.bestsellerRank) || null;
  book.yes24SteadyRank = Number(info?.steadyRank) || null;
  // YES24 상세/보강 응답의 성인 여부 유지
  if (info?.adultYn !== undefined) book.adultYn = String(info.adultYn).toUpperCase();
  if (info?.adult !== undefined && !book.adultYn) book.adultYn = String(info.adult).toUpperCase();
  // YES24 상세/보강 응답의 쪽수 필드를 내부 length로 통일
  const yes24Pages = Number(info?.length || info?.pages || info?.pageCount || info?.page) || 0;
  if (yes24Pages > 0) book.length = yes24Pages;
  if (!book.cover && info?.cover) book.cover = String(info.cover);
  if (!book.catalogUrl && info?.link) book.catalogUrl = String(info.link);
  if (!book.publisher && info?.publisher) book.publisher = String(info.publisher);
  if (!book.publishedAt && info?.publishDate) book.publishedAt = String(info.publishDate);
}

async function enrichBookPopularity(results, seq) {
  const candidates = (results || []).filter((book) => primaryIsbn13(book?.isbn)).slice(0, 30);
  const isbns = [...new Set(candidates.map((book) => primaryIsbn13(book.isbn)).filter(Boolean))];
  if (!isbns.length) return;

  try {
    const res = await fetch(BOOK_POPULARITY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ isbns }),
    });
    if (!res.ok) return;

    const payload = await res.json();
    const responseBooks = Array.isArray(payload?.books)
      ? payload.books
      : Array.isArray(payload?.data?.books)
        ? payload.data.books
        : payload?.isbn
          ? [payload]
          : [];

    // 단일 ISBN 응답도 보강 API 응답으로 처리
    if (!responseBooks.length && payload?.length && payload?.isbn) {
      responseBooks.push(payload);
    }

    const infoMap = new Map(
      responseBooks.map((info) => [primaryIsbn13(info?.isbn13 || info?.isbn), info]).filter(([isbn]) => isbn),
    );

    const applyTo = (list) => {
      for (const book of list || []) {
        const info = infoMap.get(primaryIsbn13(book?.isbn));
        if (info) applyPopularityInfo(book, info);
      }
    };

    applyTo(results);
    applyTo(bookSearchRawResults);

    if (seq !== bookSearchSeq || !$("catalogResults")) return;

    // 이미 화면에 보여준 목록의 순서를 흔들지 않도록, 재정렬 없이
    // 같은 순서 그대로(내용만 갱신된 상태로) 다시 그린다.
    renderRemoteBooks(remoteBookResults);
  } catch {}
}

const ADULT_PUBLISHER_RE = /(자투리북스|19금|성인|에로|야설|성애|하드코어|소프트코어)/i;

function isAdultBook(book) {
  const text = [book?.title, book?.genre, book?.rawGenre, book?.publisher, book?.creator, book?.contents]
    .filter(Boolean)
    .join(" ");
  return (
    String(book?.adultYn || "").toUpperCase() === "Y" ||
    ADULT_PUBLISHER_RE.test(text) ||
    /(성인|19금|19세|adult|섹스|에로|야설|정사|외설|음란|노출|야한|19세미만|하드코어|소프트코어)/i.test(text)
  );
}

function bookSearchScore(book, query, index = 0) {
  const q = Model.norm(query),
    title = Model.norm(book?.title),
    core = bookSearchCoreTitle(book?.title),
    creator = Model.norm(book?.creator);
  if (!q || !title) return -9999 - index;

  const tokens = q.split(/\s+/).filter(Boolean);
  const creatorParts = String(book?.creator || "")
    .split(/[,/&·]|\s+저|\s+역/)
    .map(Model.norm)
    .filter(Boolean);

  const creatorExact = creator === q || creatorParts.includes(q);
  const creatorStarts = creator.startsWith(q) || creatorParts.some((x) => x.startsWith(q));
  const adultCandidate = isAdultBook(book);
  const titleExact = title === q;
  const coreExact = core === q;

  let score = 0;

  // Query relevance itself remains the strongest signal.
  if (titleExact) score += 1450;
  else if (coreExact) score += 1320;
  else if (title.startsWith(q)) score += 850;
  else if (title.includes(q)) score += 680;
  else if (core.includes(q) || q.includes(core)) score += 440;

  // 성인 콘텐츠의 저자 필드가 시리즈명/브랜드명처럼 검색어와 일치하는 경우를 방지
  if (creatorExact && !adultCandidate) score += 1420;
  else if (creatorStarts && !adultCandidate) score += 930;
  else if (creator.includes(q) && !adultCandidate) score += 720;

  const matched = tokens.filter((t) => title.includes(t) || creator.includes(t)).length;
  score += matched * 75;
  if (tokens.length && matched === tokens.length) score += 130;

  // Generic server search-mode evidence:
  // - title-target result + exact title => stronger edition candidate
  // - person-target result + exact creator => stronger author candidate
  if (book?.serverTargets?.includes("title") && (titleExact || coreExact)) score += 520;
  if (book?.serverTargets?.includes("person") && (creatorExact || creatorStarts) && !adultCandidate)
    score += 560;
  if (book?.serverTargets?.includes("general")) score += 80;

  // A result returned by the server through multiple query modes is
  // stronger evidence than a one-off fringe hit.
  const hits = Math.max(1, Number(book?.serverHitCount) || 1);
  score += Math.min(260, (hits - 1) * 85);

  // Prefer complete, usable Korean-edition metadata.
  if (book?.isbn) score += 30;
  if (book?.publisher) score += 22;
  if (book?.cover) score += 22;
  if (book?.publishedAt) score += 12;
  score += bookEditionTrust(book) * 175;
  score += bookPublisherTrust(book) * 145;

  // Use popularity only when the server actually supplies it.
  const pop = Math.max(0, Number(book?.searchPopularity) || 0);
  if (pop) score += Math.min(190, Math.log10(pop + 1) * 42);
  const rating = Math.max(0, Number(book?.averageRating) || 0);
  if (rating) score += Math.min(35, rating * 6);

  // YES24 popularity enrichment. Query relevance still dominates.
  const yesPop = Math.max(0, Number(book?.yes24PopularityScore) || 0);
  if (yesPop) score += Math.min(220, yesPop * 1.25);

  const salePoint = Math.max(0, Number(book?.yes24SalePoint) || 0);
  if (salePoint) score += Math.min(120, Math.log10(salePoint + 1) * 28);

  const yesStar = Math.max(0, Number(book?.yes24StarScore) || 0);
  if (yesStar) score += Math.min(24, yesStar * 2.4);

  if (book?.yes24Found) score += 18;
  if (book?.yes24BestsellerRank) score += Math.max(0, 70 - Math.log10(book.yes24BestsellerRank + 1) * 24);
  if (book?.yes24SteadyRank) score += Math.max(0, 45 - Math.log10(book.yes24SteadyRank + 1) * 18);

  // For broad/common keywords, popularity should help decide between similarly
  // relevant titles (e.g. general nouns like 편의점, 사랑, 여행).
  if (q.length <= 4) {
    const broadPop = (Number(book?.yes24SalePoint) || 0) + (Number(book?.searchPopularity) || 0);
    score += Math.min(260, Math.log10(broadPop + 1) * 55);
  }

  // Server/provider ordering is a tie-breaker, not the main ranker.
  const providerRank = Math.max(0, Number(book?.bestServerRank) || index);
  score += Math.max(0, 55 - providerRank * 1.5);

  return score;
}

function creatorMatchTier(book, query) {
  const q = Model.norm(query),
    creator = Model.norm(book?.creator);
  if (!q || !creator) return 0;
  const parts = String(book?.creator || "")
    .split(/[,/&·]|\s+저|\s+역/)
    .map(Model.norm)
    .filter(Boolean);

  if (creator === q || parts.includes(q)) return 3;
  if (creator.startsWith(q) || parts.some((x) => x.startsWith(q))) return 2;
  if (creator.includes(q)) return 1;
  return 0;
}

function titleMatchTier(book, query) {
  const q = Model.norm(query),
    title = Model.norm(book?.title),
    core = bookSearchCoreTitle(book?.title);
  if (!q || !title) return 0;
  if (title === q || core === q) return 4;
  if (title.startsWith(q)) return 3;
  if (title.includes(q)) return 2;
  if (core.includes(q) || q.includes(core)) return 1;
  return 0;
}

function bookPopularityRankScore(book) {
  let score = 0;

  // YES24 signals
  const yesPop = Math.max(0, Number(book?.yes24PopularityScore) || 0);
  const salePoint = Math.max(0, Number(book?.yes24SalePoint) || 0);
  const star = Math.max(0, Number(book?.yes24StarScore) || 0);
  if (yesPop) score += Math.min(260, yesPop * 1.45);
  if (salePoint) score += Math.min(180, Math.log10(salePoint + 1) * 40);
  if (book?.yes24BestsellerRank)
    score += Math.max(0, 95 - Math.log10(Number(book.yes24BestsellerRank) + 1) * 28);
  if (book?.yes24SteadyRank) score += Math.max(0, 70 - Math.log10(Number(book.yes24SteadyRank) + 1) * 22);
  if (star) score += Math.min(28, star * 2.8);
  if (book?.yes24Found) score += 15;

  // Server/provider popularity if present
  const pop = Math.max(0, Number(book?.searchPopularity) || 0);
  if (pop) score += Math.min(180, Math.log10(pop + 1) * 40);

  // Provider rank is only a weak fallback when explicit popularity is sparse.
  const providerRank = Math.max(0, Number(book?.bestServerRank) || 0);
  score += Math.max(0, 45 - providerRank * 1.2);

  // Edition trust remains a small tie-breaker, not "popularity".
  score += bookPublisherTrust(book) * 24;
  score += bookEditionTrust(book) * 18;

  return score;
}

function detectBookQueryMode(list, query) {
  const q = Model.norm(query);
  if (!q) return "general";

  let creatorStrong = 0,
    titleStrong = 0;
  for (const book of list || []) {
    if (creatorMatchTier(book, q) >= 2) creatorStrong++;
    if (titleMatchTier(book, q) >= 3) titleStrong++;
  }

  // If several results clearly identify the query as an author/person,
  // treat it as author search. No hardcoded author list is used.
  if (creatorStrong >= 2 && creatorStrong > titleStrong) return "author";
  return "general";
}

function compareBooksForQuery(a, b, query, mode) {
  if (mode === "author") {
    const ca = creatorMatchTier(a, query),
      cb = creatorMatchTier(b, query);
    if (ca !== cb) return cb - ca;

    // Within the same author-match group, popularity is the primary order.
    const pa = bookPopularityRankScore(a),
      pb = bookPopularityRankScore(b);
    if (Math.abs(pa - pb) > 0.001) return pb - pa;

    // Then fall back to detailed relevance/edition quality.
    return bookSearchScore(b, query, b.__searchIndex || 0) - bookSearchScore(a, query, a.__searchIndex || 0);
  }

  return bookSearchScore(b, query, b.__searchIndex || 0) - bookSearchScore(a, query, a.__searchIndex || 0);
}

function mergeAndRankBooks(primary, supplement, query) {
  const map = new Map();

  const put = (book, index, origin) => {
    const isbn = String(book?.isbn || "").replace(/\D/g, "");
    const key =
      isbn.length >= 10
        ? "isbn:" + isbn
        : "work:" +
          Model.norm(book?.title) +
          "|" +
          Model.norm(book?.creator) +
          "|" +
          Model.norm(book?.publisher);

    const incomingTargets = Array.isArray(book?.serverTargets) ? book.serverTargets : [];
    const candidate = {
      ...book,
      serverTargets: [...new Set(incomingTargets)],
      serverHitCount: Number(book?.serverHitCount) || 1,
      bestServerRank: Number.isFinite(Number(book?.bestServerRank)) ? Number(book.bestServerRank) : index,
      __searchIndex: index,
      __searchOrigin: origin,
    };

    const existing = map.get(key);
    if (!existing) {
      map.set(key, candidate);
      return;
    }

    const merged = {
      ...existing,
      ...candidate,
      cover: existing.cover || candidate.cover,
      publisher: existing.publisher || candidate.publisher,
      isbn: existing.isbn || candidate.isbn,
      publishedAt: existing.publishedAt || candidate.publishedAt,
      contents:
        [existing.contents, candidate.contents].filter(Boolean).sort((a, b) => b.length - a.length)[0] || "",
      searchPopularity: Math.max(
        Number(existing.searchPopularity) || 0,
        Number(candidate.searchPopularity) || 0,
      ),
      averageRating: Math.max(Number(existing.averageRating) || 0, Number(candidate.averageRating) || 0),
      yes24Found: Boolean(existing.yes24Found || candidate.yes24Found),
      yes24PopularityScore: Math.max(
        Number(existing.yes24PopularityScore) || 0,
        Number(candidate.yes24PopularityScore) || 0,
      ),
      yes24SalePoint: Math.max(Number(existing.yes24SalePoint) || 0, Number(candidate.yes24SalePoint) || 0),
      yes24StarScore: Math.max(Number(existing.yes24StarScore) || 0, Number(candidate.yes24StarScore) || 0),
      yes24BestsellerRank:
        [existing.yes24BestsellerRank, candidate.yes24BestsellerRank]
          .filter(Boolean)
          .sort((a, b) => a - b)[0] || null,
      yes24SteadyRank:
        [existing.yes24SteadyRank, candidate.yes24SteadyRank].filter(Boolean).sort((a, b) => a - b)[0] ||
        null,
      length: existing.length || candidate.length || null,
      serverTargets: [...new Set([...(existing.serverTargets || []), ...(candidate.serverTargets || [])])],
      serverHitCount: (Number(existing.serverHitCount) || 1) + (Number(candidate.serverHitCount) || 1),
      bestServerRank: Math.min(
        Number(existing.bestServerRank) || 999,
        Number(candidate.bestServerRank) || 999,
      ),
      __searchIndex: Math.min(Number(existing.__searchIndex) || 999, index),
    };
    map.set(key, merged);
  };

  (primary || []).forEach((b, i) => put(b, i, "server"));
  (supplement || []).forEach((b, i) => put(b, i + 100, "server-extra"));

  const ranked = [...map.values()].filter((b) => !isExcludedBookCandidate(b));
  const mode = detectBookQueryMode(ranked, query);

  // 성인 콘텐츠는 점수 경쟁에서 제외하고 항상 일반 콘텐츠 뒤로 보낸다.
  const normalBooks = ranked.filter((b) => !isAdultBook(b));
  const adultBooks = ranked.filter((b) => isAdultBook(b));

  normalBooks.sort((a, b) => compareBooksForQuery(a, b, query, mode));
  adultBooks.sort((a, b) => compareBooksForQuery(a, b, query, mode));

  return [...normalBooks, ...adultBooks].map(({ __searchIndex, __searchOrigin, ...b }) => b);
}

async function lookupSecondaryBookGenre(book) {
  try {
    const isbnParts = String(book?.isbn || "")
        .replace(/[^0-9Xx\s]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean),
      isbn = isbnParts.sort((a, b) => b.length - a.length)[0] || "";
    const title = String(book?.title || "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      author = String(book?.creator || "")
        .split(",")[0]
        .trim();
    if (!title && !isbn) return null;
    const q = isbn ? "isbn:" + isbn : "intitle:" + title + (author ? " inauthor:" + author : "");
    const res = await fetch(
      "https://www.googleapis.com/books/v1/volumes?q=" +
        encodeURIComponent(q) +
        "&maxResults=5&printType=books",
    );
    if (!res.ok) return null;
    const payload = await res.json(),
      items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) return null;
    const tn = Model.norm(title),
      an = Model.norm(author);
    const ranked = items
      .map((it) => {
        const v = it?.volumeInfo || {},
          vt = Model.norm(v.title || ""),
          va = Model.norm((v.authors || []).join(" "));
        let score = 0;
        if (tn && vt === tn) score += 10;
        else if (tn && (vt.includes(tn) || tn.includes(vt))) score += 6;
        if (an && va.includes(an)) score += 4;
        if (Array.isArray(v.categories) && v.categories.length) score += 3;
        if (v.description) score += 1;
        return { v, score };
      })
      .sort((a, b) => b.score - a.score);
    const info = ranked[0]?.v || {},
      categories = (info.categories || []).map(String).filter(Boolean),
      raw = categories.join(" / "),
      description = String(info.description || "");
    const genre = normalizeBookGenre(raw, {
      ...book,
      title: info.title || title,
      contents: [book?.contents, description].filter(Boolean).join(" "),
      rawGenre: raw,
    });
    return genre
      ? {
          genre,
          rawGenre: raw || genre,
          candidates: [
            [genre, "Google Books"],
            ...categories
              .filter((x) => x !== genre)
              .slice(0, 3)
              .map((x) => [x, "Google Books 원본"]),
          ],
          description,
        }
      : null;
  } catch {
    return null;
  }
}

async function enrichBookGenre(book) {
  if (!book || book.type !== "book" || cleanGenreValue(book.genre)) return book;
  const local = normalizeBookGenre(book.rawGenre, book);
  if (local) {
    book.genre = local;
    book.genreSource = "auto";
    book.treeCategory = mappedCategory("book", local).id;
    book.genreMappingVersion = 3;
    return book;
  }
  const extra = await lookupSecondaryBookGenre(book);
  if (extra) {
    book.genre = extra.genre;
    book.rawGenre = extra.rawGenre || book.rawGenre || "";
    book.genreSource = "auto-secondary";
    book.genreCandidates = extra.candidates || [];
    book.treeCategory = mappedCategory("book", book.genre).id;
    book.genreMappingVersion = 3;
    if (!book.contents && extra.description) book.contents = extra.description;
  }
  return book;
}

let bookGenreRepairRunning = false;

async function repairMissingBookGenres(limit = 36) {
  if (bookGenreRepairRunning) return;
  bookGenreRepairRunning = true;
  try {
    const missing = state.items
      .filter((c) => c.type === "book" && !cleanGenreValue(c.genre) && c.genreSource !== "user")
      .sort(
        (a, b) =>
          Number(!!b.completed) - Number(!!a.completed) ||
          (b.saves?.at(-1)?.at || 0) - (a.saves?.at(-1)?.at || 0),
      )
      .slice(0, limit);
    let changed = false;
    for (let i = 0; i < missing.length; i++) {
      const c = missing[i],
        before = c.genre || "";
      await enrichBookGenre(c);
      if (c.genre && c.genre !== before) changed = true;
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 180));
    }
    if (changed) {
      ensureCompletedSpeciesAssignments();
      persist();
      if (["forest", "detail", "today", "scrap"].includes(view)) render();
    }
  } finally {
    bookGenreRepairRunning = false;
  }
}

function stopBookSearchObserver() {
  if (bookSearchObserver) {
    try {
      bookSearchObserver.disconnect();
    } catch {}
    bookSearchObserver = null;
  }
}

function observeBookSearchSentinel() {
  stopBookSearchObserver();
  const sentinel = $("bookSearchSentinel");
  if (!sentinel || !bookSearchHasMore || !bookSearchActiveQuery) return;

  bookSearchObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreBookResults();
    },
    { root: null, rootMargin: "700px 0px", threshold: 0.01 },
  );

  bookSearchObserver.observe(sentinel);
}

function renderRemoteBooks(results, message = "") {
  const el = $("catalogResults");
  if (!el) return;
  stopBookSearchObserver();

  if (message) {
    el.innerHTML =
      '<div class="scrap-empty"><p>' +
      esc(message) +
      "</p>" +
      button("직접 입력하기", "manual", "textbtn scrap-manual") +
      "</div>";
    return;
  }

  if (!results.length) {
    el.innerHTML =
      '<div class="scrap-empty"><p>검색 결과가 없어요.</p>' +
      button("직접 입력하기", "manual", "textbtn scrap-manual") +
      "</div>";
    return;
  }

  const rows = results
    .map(
      (c, i) =>
        '<div class="content-row" style="align-items:flex-start">' +
        cover(c) +
        '<div class="grow">' +
        '<div class="title">' +
        esc(c.title) +
        "</div>" +
        '<div class="creator">' +
        [c.creator || "저자 미확인", String(c.publishedAt || "").slice(0, 4), c.publisher]
          .filter(Boolean)
          .map(esc)
          .join(" · ") +
        "</div>" +
        "</div>" +
        remoteScrapButton(c, i, "Book") +
        "</div>",
    )
    .join("");

  const tail = bookSearchHasMore
    ? '<div id="bookSearchSentinel" style="padding:16px 0 32px;text-align:center"><p class="creator">' +
      (bookSearchLoadingMore ? "더 불러오는 중…" : "아래로 내리면 더 불러와요") +
      "</p></div>"
    : '<div style="height:18px"></div>';

  el.innerHTML = '<div class="content-list">' + rows + "</div>" + tail;
  observeBookSearchSentinel();
}

async function fetchServerBookBatch(query, { target = "", page = 1, size = 50 } = {}) {
  try {
    const params = new URLSearchParams({ query, q: query, size: String(size), page: String(page) });
    if (target) params.set("target", target);

    const body = { query, q: query, size, page };
    if (target) body.target = target;

    const res = await fetch(BOOK_SEARCH_ENDPOINT + "?" + params.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { message: raw };
    }
    if (!res.ok) return [];

    const docs = unwrapBookDocuments(payload);
    return docs
      .map((d, i) => {
        const book = normalizeRemoteBook(d);
        return {
          ...book,
          serverTargets: [target || "general"],
          serverHitCount: 1,
          bestServerRank: (page - 1) * size + i,
        };
      })
      .filter((c) => c.title && !isExcludedBookCandidate(c));
  } catch {
    return [];
  }
}

async function searchServerBookPage(query, page) {
  const batches = await Promise.all([
    fetchServerBookBatch(query, { page, size: BOOK_SEARCH_PAGE_SIZE }),
    fetchServerBookBatch(query, { target: "title", page, size: BOOK_SEARCH_PAGE_SIZE }),
    fetchServerBookBatch(query, { target: "person", page, size: BOOK_SEARCH_PAGE_SIZE }),
  ]);
  return batches.flat();
}

async function searchPrimaryBooks(query) {
  return searchServerBookPage(query, 1);
}

function bookResultKey(book) {
  const isbn = String(book?.isbn || "").replace(/\D/g, "");
  if (isbn.length >= 10) return "isbn:" + isbn;
  return (
    "work:" + Model.norm(book?.title) + "|" + Model.norm(book?.creator) + "|" + Model.norm(book?.publisher)
  );
}

async function loadMoreBookResults() {
  if (bookSearchLoadingMore || !bookSearchHasMore || !bookSearchActiveQuery) return;

  const query = bookSearchActiveQuery,
    page = bookSearchNextPage,
    seq = bookSearchSeq;
  bookSearchLoadingMore = true;
  renderRemoteBooks(remoteBookResults);

  try {
    const before = new Set(bookSearchRawResults.map(bookResultKey));
    const more = await searchServerBookPage(query, page);

    if (seq !== bookSearchSeq || query !== bookSearchActiveQuery) return;

    const fresh = more.filter((book) => !before.has(bookResultKey(book)));
    if (fresh.length) {
      bookSearchRawResults.push(...more);
      bookSearchStagnantPages = 0;
    } else {
      bookSearchStagnantPages++;
    }

    bookSearchNextPage = page + 1;

    // Stop only when the server truly runs out, or repeats the same page
    // several times (some providers ignore page parameters).
    if (!more.length || bookSearchStagnantPages >= 2 || page >= 30) {
      bookSearchHasMore = false;
    }

    remoteBookResults = mergeAndRankBooks(bookSearchRawResults, [], query).filter(
      (c) => !isExcludedBookCandidate(c),
    );

    // 여기서 다시 그리지 않는다 - 아래 finally에서 한 번만 그린다.
    // (여기서도 그리면 finally와 연달아 두 번 그려져 감지기가 중복 발동한다.)
    enrichBookPopularity(remoteBookResults, seq).catch(() => {});

    const pending = remoteBookResults.filter((book) => !cleanGenreValue(book.genre)).slice(0, 8);
    if (pending.length) {
      Promise.all(pending.map(enrichBookGenre))
        .then(() => {
          if (seq === bookSearchSeq && $("catalogResults")) renderRemoteBooks(remoteBookResults);
        })
        .catch(() => {});
    }
  } catch {
    if (seq === bookSearchSeq) {
      bookSearchHasMore = false;
    }
  } finally {
    if (seq === bookSearchSeq) {
      bookSearchLoadingMore = false;
      if ($("catalogResults")) renderRemoteBooks(remoteBookResults);
    }
  }
}

async function searchResults(q) {
  const query = String(q || "").trim(),
    seq = ++bookSearchSeq;
  stopBookSearchObserver();

  if (!query) {
    remoteBookResults = [];
    bookSearchRawResults = [];
    bookSearchActiveQuery = "";
    bookSearchHasMore = false;
    renderRemoteBooks([], "책 제목이나 저자를 입력해주세요.");
    return;
  }

  bookSearchActiveQuery = query;
  bookSearchNextPage = 2;
  bookSearchHasMore = true;
  bookSearchLoadingMore = false;
  bookSearchStagnantPages = 0;
  bookSearchRawResults = [];

  const el = $("catalogResults");
  if (el) el.innerHTML = '<p class="creator">검색 중…</p>';

  try {
    const serverBooks = await searchPrimaryBooks(query);
    if (seq !== bookSearchSeq || !$("catalogResults")) return;

    bookSearchRawResults = serverBooks;
    remoteBookResults = mergeAndRankBooks(bookSearchRawResults, [], query).filter(
      (c) => !isExcludedBookCandidate(c),
    );

    if (!serverBooks.length) bookSearchHasMore = false;

    renderRemoteBooks(remoteBookResults);
    enrichBookPopularity(remoteBookResults, seq).catch(() => {});

    const pending = remoteBookResults.filter((book) => !cleanGenreValue(book.genre)).slice(0, 8);

    if (pending.length) {
      Promise.all(pending.map(enrichBookGenre))
        .then(() => {
          if (seq === bookSearchSeq && $("catalogResults")) renderRemoteBooks(remoteBookResults);
        })
        .catch(() => {});
    }
  } catch (err) {
    if (seq !== bookSearchSeq || !$("catalogResults")) return;
    remoteBookResults = [];
    bookSearchRawResults = [];
    bookSearchHasMore = false;
    renderRemoteBooks([], err?.message || "책 검색 서버에 연결하지 못했어요.");
  }
}

function unwrapAlbums(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.albums,
    payload?.results,
    payload?.items,
    payload?.data?.albums,
    payload?.data?.results,
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeRemoteAlbum(d) {
  const providerId = d?.provider_id ?? d?.providerId ?? d?.collectionId ?? "",
    release = String(d?.release_date || d?.releaseDate || "").trim(),
    rawGenre = String(d?.genre || d?.primaryGenreName || "").trim(),
    genre = normalizeAlbumGenre(rawGenre);
  const searchPopularity =
    Number(d?.popularity ?? d?.playCount ?? d?.play_count ?? d?.listeners ?? d?.ratingCount ?? 0) || 0;
  // Apple Music/iTunes 검색 응답에는 보통 소개문구가 없음. 있을 때만 채우고, 없으면 빈 문자열로 유지해 book/movie와 필드 구조를 통일한다.
  const albumDescription = String(
    d?.albumDescription || d?.description || d?.longDescription || d?.notes || "",
  ).trim();
  return {
    type: "album",
    title: String(d?.title || d?.collectionName || "").trim(),
    creator: String(d?.artist || d?.artistName || d?.creator || "").trim(),
    cover: String(d?.cover_url || d?.artworkUrl100 || d?.cover || "").trim(),
    genre,
    rawGenre,
    genreSource: "auto",
    genreCandidates: genre
      ? [[genre, "Apple Music"], ...(rawGenre && rawGenre !== genre ? [[rawGenre, "원본 장르"]] : [])]
      : [],
    provider: String(d?.provider || "apple").trim(),
    providerId: String(providerId || "").trim(),
    releaseDate: release,
    trackCount: Number(d?.track_count ?? d?.trackCount) || null,
    copyright: String(d?.copyright || "").trim(),
    albumDescription,
    catalogUrl: String(d?.external_url || d?.collectionViewUrl || d?.catalogUrl || "").trim(),
    source: "Apple Music 앨범 검색",
    searchPopularity,
    averageRating: Number(d?.averageRating ?? d?.rating ?? 0) || 0,
  };
}

function renderRemoteAlbums(results, message = "") {
  const el = $("musicCatalogResults");
  if (!el) return;
  if (message) {
    el.innerHTML =
      '<div class="scrap-empty"><p>' +
      esc(message) +
      "</p>" +
      button("직접 입력하기", "manual", "textbtn scrap-manual") +
      "</div>";
    return;
  }
  el.innerHTML = results.length
    ? '<div class="content-list">' +
      results
        .map(
          (c, i) =>
            '<div class="content-row" style="align-items:flex-start">' +
            cover(c) +
            '<div class="grow"><div class="title">' +
            esc(c.title) +
            '</div><div class="creator">' +
            esc(c.creator || "아티스트 미확인") +
            "</div>" +
            (c.genre ? '<div class="badge">' + esc(c.genre) + "</div>" : "") +
            (c.releaseDate
              ? '<div class="badge">' +
                esc(c.releaseDate.slice(0, 4)) +
                (c.trackCount ? " · " + c.trackCount + "곡" : "") +
                "</div>"
              : c.trackCount
                ? '<div class="badge">' + c.trackCount + "곡</div>"
                : "") +
            "</div>" +
            remoteScrapButton(c, i, "Album") +
            "</div>",
        )
        .join("") +
      "</div>"
    : '<div class="scrap-empty"><p>검색 결과가 없어요.</p>' +
      button("직접 입력하기", "manual", "textbtn scrap-manual") +
      "</div>";
}

async function musicSearchResults(q) {
  const query = String(q || "").trim(),
    seq = ++musicSearchSeq;
  if (!query) {
    remoteAlbumResults = [];
    renderRemoteAlbums([], "앨범명이나 아티스트를 입력해주세요.");
    return;
  }
  const el = $("musicCatalogResults");
  if (el) el.innerHTML = '<p class="creator">검색 중…</p>';
  try {
    const res = await fetch(MUSIC_SEARCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }
    if (!res.ok) {
      const detail = payload?.error || payload?.message || "HTTP " + res.status;
      if (res.status === 401)
        throw Error("검색 서버에서 인증 오류가 발생했어요. Edge Function의 Verify JWT 설정을 확인해주세요.");
      throw Error(detail);
    }
    if (seq !== musicSearchSeq || !$("musicCatalogResults")) return;
    remoteAlbumResults = unwrapAlbums(payload)
      .map(normalizeRemoteAlbum)
      .filter((c) => c.title)
      .slice(0, 12);
    renderRemoteAlbums(remoteAlbumResults);
  } catch (err) {
    if (seq !== musicSearchSeq || !$("musicCatalogResults")) return;
    remoteAlbumResults = [];
    renderRemoteAlbums([], err?.message || "음악 검색 서버에 연결하지 못했어요.");
  }
}

function unwrapMovies(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.movies,
    payload?.results,
    payload?.items,
    payload?.data?.movies,
    payload?.data?.results,
  ];
  return candidates.find(Array.isArray) || [];
}

// 책 검색의 Model.norm(공백+문장부호 제거)은 그대로 쓰되, 부제를 통째로
// 잘라내는 bookSearchCoreTitle의 콜론-부제 제거는 영화에 그대로 옮기지 않는다.
// 책은 "제목: 부제"가 대개 같은 책의 다른 판(edition)이라 부제를 떼도 같은
// 작품이지만, 영화는 "제목: 부제"가 서로 다른 별개 작품인 경우가 흔하다
// (예: "식스센스: 속보이는 여자들"은 "식스 센스"(1999)와 무관한 작품).
// 그 규칙을 그대로 썼다가 오히려 동명이작을 "핵심 제목 완전 일치"로
// 오판하게 만든 게 바로 이번에 재현된 버그였다. 그래서 여기서는 괄호/대괄호
// 안의 부가 정보(예: "(2020)", "(리마스터판)")만 걷어내고, 콜론 뒤 부제는
// 그대로 남겨 둔다 — Model.norm이 콜론 "문자"만 지워도 부제 "텍스트"는
// 남으므로 동명이작과는 여전히 구분된다.
function movieSearchCoreTitle(value) {
  return Model.norm(
    String(value || "")
      .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
      .replace(/\s+/g, " "),
  );
}

function normalizeRemoteMovie(d) {
  const providerId = d?.provider_id ?? d?.providerId ?? d?.id ?? "";
  const release = String(d?.release_date || d?.releaseDate || "").trim();
  const originalTitle = String(d?.original_title || d?.originalTitle || "").trim();
  const genres = movieGenreInfo(d?.genre_ids ?? d?.genreIds);
  const searchPopularity = Number(d?.popularity ?? 0) || 0;
  const voteCount = Number(d?.vote_count ?? d?.voteCount ?? 0) || 0;
  const averageRating = Number(d?.vote_average ?? d?.voteAverage ?? d?.rating ?? 0) || 0;
  const runtime = Number(d?.runtime ?? d?.runtime_minutes ?? d?.runtimeMinutes ?? 0) || null;
  return {
    type: "movie",
    title: String(d?.title || "").trim(),
    creator: String(d?.director || d?.creator || "").trim(),
    cover: String(d?.poster_url || d?.posterUrl || d?.poster || "").trim(),
    genre: genres.primary,
    rawGenre: genres.candidates.map((x) => x[0]).join(", "),
    genreSource: "auto",
    genreCandidates: genres.candidates,
    provider: String(d?.provider || "tmdb").trim(),
    providerId: String(providerId || "").trim(),
    releaseDate: release,
    originalTitle,
    originalLanguage: String(d?.original_language || d?.originalLanguage || "").trim(),
    overview: String(d?.overview || "").trim(),
    genreIds: Array.isArray(d?.genre_ids)
      ? d.genre_ids.map(Number).filter(Number.isFinite)
      : Array.isArray(d?.genreIds)
        ? d.genreIds.map(Number).filter(Number.isFinite)
        : [],
    catalogUrl: String(d?.external_url || d?.externalUrl || d?.catalogUrl || "").trim(),
    source: "TMDB 영화 검색",
    searchPopularity,
    voteCount,
    averageRating,
    runtime,
  };
}

function movieSearchScore(movie, query, index = 0) {
  // 공백만 지우는 게 아니라 책 검색과 같은 기준(Model.norm)으로 비교하고,
  // 부제/괄호를 뗀 핵심 제목(core title)까지 함께 봐서 "정확히 그 작품"을
  // 콜론-부제가 붙은 동명이작과 확실히 구분한다.
  const q = Model.norm(query);
  const title = Model.norm(movie?.title),
    core = movieSearchCoreTitle(movie?.title);
  const original = Model.norm(movie?.originalTitle),
    originalCore = movieSearchCoreTitle(movie?.originalTitle);
  if (!q || !title) return -9999 - index;
  let score = 0;
  const titleExact = title === q || core === q;
  const originalExact = original === q || originalCore === q;
  if (titleExact) score += 1200;
  else if (originalExact) score += 1080;
  else if (title.startsWith(q) || core.startsWith(q)) score += 760;
  else if (title.includes(q) || original.includes(q)) score += 620;
  else if (core.includes(q) || originalCore.includes(q) || (core && q.includes(core))) score += 380;
  // 감독/출연자 매칭 — 현재 원격 응답에 creator(감독)가 채워지지 않는 경우가
  // 많아 당장은 대부분 발동하지 않지만, 나중에 채워지면 바로 반영되도록 둔다.
  const creator = Model.norm(movie?.creator);
  if (creator && creator === q) score += 900;
  else if (creator && creator.startsWith(q)) score += 500;
  else if (creator && creator.includes(q)) score += 300;
  const pop = Math.max(0, Number(movie?.searchPopularity) || 0),
    votes = Math.max(0, Number(movie?.voteCount) || 0),
    rating = Math.max(0, Number(movie?.averageRating) || 0);
  if (pop) score += Math.min(220, Math.log10(pop + 1) * 75);
  if (votes) score += Math.min(220, Math.log10(votes + 1) * 62);
  if (votes >= 100) score += Math.min(75, rating * 8);
  if (movie?.cover) score += 15;
  if (movie?.releaseDate) score += 8;
  score += Math.max(0, 24 - index);
  return score;
}

function rankMovies(results, query) {
  return [...results].sort((a, b) => movieSearchScore(b, query) - movieSearchScore(a, query)).slice(0, 12);
}

// 결과 중 "이 정도면 정답으로 확신할 만한" 매치가 있는지 — 있으면 굳이
// 추가 조회(재조회)를 하지 않는다. 없으면 아래 rescue 단계로 넘어간다.
// 주의: startsWith는 "확신"의 기준으로 쓰면 안 된다. 바로 이 버그 케이스
// ("식스센스: 속보이는 여자들"이 "식스센스"로 시작함)가 startsWith를
// 확신 기준에 넣었을 때 rescue를 건너뛰게 만든 원인이었다. 완전 일치만
// 확신으로 인정한다.
function movieHasConfidentMatch(results, query) {
  const q = Model.norm(query);
  if (!q) return true;
  return (results || []).some((c) => {
    const title = Model.norm(c?.title),
      core = movieSearchCoreTitle(c?.title);
    const original = Model.norm(c?.originalTitle),
      originalCore = movieSearchCoreTitle(c?.originalTitle);
    return title === q || core === q || original === q || originalCore === q;
  });
}

// "식스센스"(공백 없음) vs "식스 센스"(공백 있음)처럼, 원격 검색 API가
// 띄어쓰기 차이만으로 완전히 다른 결과 집합을 돌려주는 경우를 대비한다.
// 입력값을 그대로 1회만 조회하지 않고, 확신할 만한 매치가 없을 때만
// 공백을 뗀/끼워 넣은 변형들을 추가로 조회해 후보를 넓힌다.
function movieSpacingRescueQueries(query) {
  const trimmed = String(query || "").trim();
  const variants = new Set();
  const noSpace = trimmed.replace(/\s+/g, "");
  if (noSpace && noSpace !== trimmed) variants.add(noSpace);
  if (!/\s/.test(trimmed)) {
    const chars = [...trimmed];
    if (chars.length >= 2 && chars.length <= 10) {
      for (let i = 1; i < chars.length; i++)
        variants.add(chars.slice(0, i).join("") + " " + chars.slice(i).join(""));
    }
  }
  variants.delete(trimmed);
  return [...variants].slice(0, 8);
}

function renderRemoteMovies(results, message = "") {
  const el = $("movieCatalogResults");
  if (!el) return;
  if (message) {
    el.innerHTML =
      '<div class="scrap-empty"><p>' +
      esc(message) +
      "</p>" +
      button("직접 입력하기", "manual", "textbtn scrap-manual") +
      "</div>";
    return;
  }
  el.innerHTML = results.length
    ? '<div class="content-list">' +
      results
        .map(
          (c, i) =>
            '<div class="content-row" style="align-items:flex-start">' +
            cover(c) +
            '<div class="grow"><div class="title">' +
            esc(c.title) +
            "</div>" +
            (c.originalTitle && Model.norm(c.originalTitle) !== Model.norm(c.title)
              ? '<div class="creator">' + esc(c.originalTitle) + "</div>"
              : "") +
            '<div class="creator">' +
            [c.releaseDate ? c.releaseDate.slice(0, 4) : "", c.genre || ""]
              .filter(Boolean)
              .map(esc)
              .join(" · ") +
            "</div></div>" +
            remoteScrapButton(c, i, "Movie") +
            "</div>",
        )
        .join("") +
      "</div>"
    : '<div class="scrap-empty"><p>검색 결과가 없어요.</p>' +
      button("직접 입력하기", "manual", "textbtn scrap-manual") +
      "</div>";
}

async function fetchMovieSearchPayload(query) {
  const res = await fetch(MOVIE_SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!res.ok) {
    const detail = payload?.error || payload?.message || "HTTP " + res.status;
    if (res.status === 401)
      throw Error("검색 서버에서 인증 오류가 발생했어요. Edge Function의 Verify JWT 설정을 확인해주세요.");
    throw Error(detail);
  }
  return payload;
}

// Recommended movies arrive without credits. After one is scrapped, look it up in movie search
// (which returns the director and runtime) and fill in whatever is missing.
const movieEnrichPending = new Set();

async function enrichMovieDetails(id) {
  const c = get(id);
  if (!c || c.type !== "movie" || (c.creator && c.runtime) || movieEnrichPending.has(id)) return;
  movieEnrichPending.add(id);
  try {
    const list = unwrapMovies(await fetchMovieSearchPayload(c.title))
      .map(normalizeRemoteMovie)
      .filter((x) => x?.title);
    const year = String(c.releaseDate || c.published || "").slice(0, 4);
    const pick =
      list.find((x) => c.providerId && x.providerId === String(c.providerId)) ||
      list
        .filter((x) => !year || String(x.releaseDate || "").startsWith(year))
        .sort((a, b) => movieSearchScore(b, c.title) - movieSearchScore(a, c.title))[0];
    const cur = get(id);
    if (!pick || !cur) return;
    let changed = false;
    const fill = (k, v) => {
      if (v && !cur[k]) {
        cur[k] = v;
        changed = true;
      }
    };
    fill("creator", pick.creator);
    fill("runtime", pick.runtime);
    fill("cover", pick.cover);
    fill("releaseDate", pick.releaseDate);
    if (changed && persist()) render();
  } catch {
  } finally {
    movieEnrichPending.delete(id);
  }
}

function backfillMovieDetails() {
  state.items
    .filter((c) => c.type === "movie" && !c.creator)
    .slice(0, 6)
    .forEach((c, i) => setTimeout(() => void enrichMovieDetails(c.id), 400 * i));
}

function movieResultKey(c) {
  if (c?.provider && c?.providerId) return c.provider + "|" + c.providerId;
  return Model.norm(c?.title) + "|" + String(c?.releaseDate || "").slice(0, 4);
}

async function movieSearchResults(q) {
  const query = String(q || "").trim(),
    seq = ++movieSearchSeq;
  if (!query) {
    remoteMovieResults = [];
    renderRemoteMovies([], "영화 제목을 입력해주세요.");
    return;
  }
  const el = $("movieCatalogResults");
  if (el) el.innerHTML = '<p class="creator">검색 중…</p>';
  const pool = new Map();
  const absorb = (payload) => {
    unwrapMovies(payload)
      .map(normalizeRemoteMovie)
      .filter((c) => c.title)
      .forEach((c) => {
        const key = movieResultKey(c);
        if (!pool.has(key)) pool.set(key, c);
      });
  };
  try {
    // 1차 결과는 반드시 먼저 사용자에게 보여준다.
    // rescue 조회를 기다리면서 렌더링을 막으면 입력 중 요청 폭주와
    // 화면 재시작처럼 보이는 현상이 발생하므로 책 검색과 같은 흐름으로 분리한다.
    const primary = await fetchMovieSearchPayload(query);
    if (seq !== movieSearchSeq || !$("movieCatalogResults")) return;
    absorb(primary);

    remoteMovieResults = rankMovies([...pool.values()], query);
    renderRemoteMovies(remoteMovieResults);

    // 보강 조회는 렌더링 이후 백그라운드에서 한 번만 수행한다.
    if (!movieHasConfidentMatch(remoteMovieResults, query)) {
      const rescueQueries = movieSpacingRescueQueries(query);
      if (rescueQueries.length) {
        const settled = await Promise.all(
          rescueQueries.map((v) => fetchMovieSearchPayload(v).catch(() => null)),
        );
        if (seq !== movieSearchSeq || !$("movieCatalogResults")) return;
        const before = new Set([...pool.keys()]);
        settled.forEach((p) => {
          if (p) absorb(p);
        });
        const changed = [...pool.keys()].some((k) => !before.has(k));
        if (changed) {
          remoteMovieResults = rankMovies([...pool.values()], query);
          renderRemoteMovies(remoteMovieResults);
        }
      }
    }
  } catch (err) {
    if (seq !== movieSearchSeq || !$("movieCatalogResults")) return;
    remoteMovieResults = [];
    renderRemoteMovies([], err?.message || "영화 검색 서버에 연결하지 못했어요.");
  }
}
