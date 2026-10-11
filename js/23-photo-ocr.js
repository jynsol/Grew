/*
 * 사진으로 추가(OCR)와 링크 추가 진입.
 */

function linkAdd() {
  openLinkImport();
}

let photoImportSource = null;

function photoAdd(source = null) {
  photoImportSource = normalizeLinkSources(source ? [source] : [])[0] || null;
  photoFiles = [];
  candidates = [];
  showModal(
    "사진에서 가져오기",
    (photoImportSource
      ? '<p class="link-import-source">이 게시물의 사진을 선택해주세요.<br><a href="' +
        esc(photoImportSource.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(photoImportSource.title || new URL(photoImportSource.url).hostname) +
        " ↗</a></p>"
      : "") +
      '<p class="muted">표지나 책장, 목록 스크린샷에서 작품 제목을 찾아드려요.</p><input id="photoFiles" class="file-hidden" type="file" accept="image/*" multiple><label for="photoFiles" class="file-pick"><span class="file-pick-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg></span><span class="file-pick-text"><strong id="photoPickName">사진 고르기</strong><small>최대 10장</small></span></label><div id="photoThumbs" class="thumbs"></div><div id="ocrProgress" class="summary"></div>' +
      button("사진 분석하기", "runOCR", "primary", 'id="ocrButton" disabled') +
      button("직접 입력하기", "manual", "textbtn"),
    "photo",
  );
}

function ocrCleanLine(line) {
  return String(line || "")
    .replace(/[|_~`^=*<>\\]/g, " ")
    .replace(/[●■□◆◇▶▷◀◁→←↑↓]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OCR_UI_WORDS = new Set([
  "서재",
  "기본책장",
  "내책장",
  "내 책장",
  "다운로드",
  "필터",
  "편집",
  "소장",
  "서점",
  "my",
  "검색",
  "메뉴",
  "공유",
  "저장",
  "취소",
  "확인",
  "완료",
  "홈",
  "home",
  "search",
  "share",
  "save",
  "cancel",
  "menu",
]);

function ocrUsefulLine(line) {
  const s = ocrCleanLine(line);
  if (s.length < 1 || s.length > 200) return false;
  if (!/[A-Za-z가-힣]/.test(s)) return false;
  const compact = s.toLowerCase().replace(/\s+/g, "");
  if (OCR_UI_WORDS.has(s.toLowerCase()) || OCR_UI_WORDS.has(compact)) return false;
  if (/^\d{1,3}(권|개)?$/.test(s) || /^\d{1,2}:\d{2}$/.test(s) || /^\d{1,3}%$/.test(s)) return false;
  if (/^(lte|5g|wifi|battery)$/i.test(s)) return false;
  if ((s.match(/[A-Za-z가-힣]/g) || []).length < 1) return false;
  const letters = (s.match(/[A-Za-z가-힣]/g) || []).length;
  if (letters / Math.max(1, s.length) < 0.42) return false;
  return true;
}

function ocrContextType(text) {
  const n = String(text || "").toLowerCase();
  if (/서재|책장|도서|읽는 중|읽고 싶|독서|소장/.test(n)) return "book";
  if (/앨범|음악|재생|아티스트|곡/.test(n)) return "album";
  if (/영화|상영|감독|개봉/.test(n)) return "movie";
  return "";
}

function ocrNoiseLine(text) {
  const s = ocrCleanLine(text),
    compact = s.toLowerCase().replace(/\s+/g, "");
  if (!s) return true;
  if (OCR_UI_WORDS.has(s.toLowerCase()) || OCR_UI_WORDS.has(compact)) return true;
  if (/^[^A-Za-z가-힣]*(?:소장|다운로드|필터|편집|기본책장|내\s*책장|MY)$/i.test(s)) return true;
  if (/^[^가-힣]*\d+일\s*남음$/.test(s)) return true;
  if (/^([.!·•\s]*)(LTE|5G|WiFi|wifi|battery)(\s*\d+)?$/i.test(s)) return true;
  if (/^\d{1,3}(권|개)?$/.test(s) || /^\d{1,2}\s*:\s*\d{2}$/.test(s)) return true;
  return false;
}

function ocrEditionGroups(text) {
  const s = String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
  const groups = [];
  const add = (k) => {
    if (!groups.includes(k)) groups.push(k);
  };
  if (/리커버|re-?cover/.test(s)) add("recover");
  if (/개정증보판|증보판/.test(s)) add("expanded");
  else if (/개정판|revisededition/.test(s)) add("revised");
  if (
    /특별판|스페셜(?:판|에디션)|specialedition|컬렉터스?에디션|collector'?sedition|기념판|anniversaryedition/.test(
      s,
    )
  )
    add("special");
  if (/한정판|limitededition/.test(s)) add("limited");
  if (/양장본?|양장판|hardcover/.test(s)) add("hardcover");
  if (/보급판/.test(s)) add("popular");
  if (/소장판/.test(s)) add("collector");
  if (/합본판?|옴니버스판|omnibus/.test(s)) add("omnibus");
  if (/완전판|completeedition/.test(s)) add("complete");
  if (/복간판|복각판/.test(s)) add("reprint");
  if (/리마스터(?:판|에디션)?|remaster(?:ed)?/.test(s)) add("remaster");
  if (/디럭스(?:판|에디션)?|deluxeedition/.test(s)) add("deluxe");
  if (/큰글자판|큰글씨책|대활자본?|largeprint/.test(s)) add("largeprint");
  return groups;
}

function ocrEditionOnlyLine(text) {
  const s = ocrCleanLine(text);
  if (!s) return false;
  const stripped = s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()\[\]{}〈〉《》「」『』·:：,./\s_-]/g, "");
  if (!ocrEditionGroups(s).length) return false;
  return /^(리커버(?:판|에디션)?|개정(?:증보)?판|증보판|특별판|스페셜(?:판|에디션)|한정판|양장(?:본|판)?|보급판|소장판|합본판?|옴니버스판|완전판|기념판|복간판|복각판|리마스터(?:판|에디션)?|디럭스(?:판|에디션)?|큰글자판|큰글씨책|대활자본?|recover|recoveredition|revisededition|specialedition|limitededition|hardcover|omnibus|completeedition|remastered|deluxeedition|largeprint)$/.test(
    stripped,
  );
}

function ocrBaseTitle(text) {
  let s = ocrCleanLine(text);
  s = s.replace(
    /[([]?\s*(?:리커버(?:판|\s*에디션)?|개정(?:증보)?판|증보판|특별판|스페셜(?:판|\s*에디션)|한정판|양장(?:본|판)?|보급판|소장판|합본판?|옴니버스판|완전판|기념판|복간판|복각판|리마스터(?:판|\s*에디션)?|디럭스(?:판|\s*에디션)?|큰글자판|큰글씨책|대활자본?|re-?cover(?:\s*edition)?|revised\s*edition|special\s*edition|limited\s*edition|hardcover|omnibus|complete\s*edition|remaster(?:ed)?|deluxe\s*edition|large\s*print)\s*[)\]]?/gi,
    " ",
  );
  return s.replace(/\s+/g, " ").trim();
}

function ocrTitleLike(text) {
  const s = ocrCleanLine(text);
  if (!ocrUsefulLine(s) || ocrNoiseLine(s)) return false;
  if (ocrEditionOnlyLine(s)) return false;
  if (s.length > 200) return false;
  if (/[.!?]{2,}/.test(s)) return false;

  return true;
}

function ocrWordBox(word) {
  const b = word?.bbox || word?.boundingBox || word?.box || {};
  const left = Number(word?.left ?? word?.x ?? b?.left ?? b?.x ?? b?.x0 ?? 0);
  const top = Number(word?.top ?? word?.y ?? b?.top ?? b?.y ?? b?.y0 ?? 0);
  let width = Number(word?.width ?? b?.width ?? 0),
    height = Number(word?.height ?? b?.height ?? 0);
  if (!width && Number.isFinite(Number(b?.x1))) width = Math.max(0, Number(b.x1) - left);
  if (!height && Number.isFinite(Number(b?.y1))) height = Math.max(0, Number(b.y1) - top);
  return { left, top, width, height };
}

function ocrStringSimilarity(a, b) {
  const x = Model.norm(a),
    y = Model.norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x))
    return (Math.min(x.length, y.length) / Math.max(x.length, y.length)) * 0.86 + 0.1;
  const grams = (s) => {
    const g = new Set();
    for (let i = 0; i < Math.max(1, s.length - 1); i++) g.add(s.slice(i, i + 2));
    return g;
  };
  const A = grams(x),
    B = grams(y);
  let hit = 0;
  A.forEach((v) => {
    if (B.has(v)) hit++;
  });
  return hit / Math.max(1, A.size + B.size - hit);
}

function ocrCandidateKey(c) {
  return [c.type, c.provider || "", c.providerId || "", Model.norm(c.title), Model.norm(c.creator)].join("|");
}

async function ocrFetchUncached(endpoint, query, unwrap, normalize) {
  const requestUrl = endpoint + "?query=" + encodeURIComponent(query) + "&q=" + encodeURIComponent(query);
  const res = await fetch(requestUrl, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, q: query, size: 50, page: 1 }),
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!res.ok) throw Error(payload?.error || payload?.message || "HTTP " + res.status);
  return unwrap(payload)
    .map(normalize)
    .filter((c) => c.title && ["book", "movie"].includes(c.type))
    .slice(0, 7);
}

async function ocrSearchAll(query) {
  const configs = [
    [BOOK_SEARCH_ENDPOINT, unwrapBookDocuments, normalizeRemoteBook],
    [MOVIE_SEARCH_ENDPOINT, unwrapMovies, normalizeRemoteMovie],
  ];
  const settled = await Promise.allSettled(configs.map((c) => ocrFetch(c[0], query, c[1], c[2])));
  const failed = settled.filter((r) => r.status === "rejected");
  if (failed.length === settled.length) throw Error("작품 검색 서버에 연결하지 못했어요.");
  const results = settled.flatMap((r) =>
    r.status === "fulfilled" ? r.value.map((c, rank) => ({ ...c, ocrSearchRank: rank })) : [],
  );
  results.errors = failed.map((r) => String(r.reason?.message || r.reason));
  return results;
}

async function ocrPostImage(imageBase64) {
  const res = await fetch(IMAGE_OCR_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  const raw = await res.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { message: raw };
  }
  if (!res.ok) throw Error(payload?.error || payload?.message || "OCR 서버 오류 · HTTP " + res.status);
  if (payload?.error) throw Error(payload.error);
  return payload;
}

function ocrStripTypeSuffix(text) {
  return ocrCleanLine(text)
    .replace(/\s*[·ㆍ]\s*(?:책|도서|음반|앨범|영화)\s*$/i, "")
    .trim();
}

function ocrStripCreatorFromTitle(title, creator) {
  let t = ocrCleanLine(title),
    c = ocrCleanLine(creator);
  if (!t || !c) return t;
  const m = t.match(/^(.*?)[\(（\[]\s*([^\)）\]]{2,30})\s*[\)）\]]\s*$/);
  if (!m) return t;
  if (ocrEditionGroups(m[2]).length) return t;
  if (Model.norm(m[2]) === Model.norm(c)) return ocrCleanLine(m[1]);
  return t;
}

function ocrRegionBox(item, region) {
  const b = ocrWordBox(item),
    scale = Math.max(0.0001, Number(region.scale) || 1);
  return {
    ...item,
    left: Math.max(0, (b.left - Number(region.padX || 0)) / scale + Number(region.sx || 0)),
    top: Math.max(0, (b.top - Number(region.padY || 0)) / scale + Number(region.sy || 0)),
    width: b.width / scale,
    height: b.height / scale,
    multipass: true,
  };
}

// Geometry is always expressed in original-image pixels. Passes never share
// word rows until their own words have been assembled into spatial lines.
function ocrSyntheticLines(words) {
  const tokens = (words || [])
    .map((w) => ({ ...w, ...ocrWordBox(w), text: ocrCleanLine(w.text || w.word || w.value || "") }))
    .filter((w) => w.text && w.width > 0 && w.height > 0);
  const passes = new Map();
  for (const w of tokens) {
    const p = w.passId || "default";
    if (!passes.has(p)) passes.set(p, []);
    passes.get(p).push(w);
  }
  const lines = [];
  for (const [passId, items] of passes) {
    const rows = [];
    for (const w of items.sort((a, b) => a.top + a.height / 2 - b.top - b.height / 2 || a.left - b.left)) {
      const cy = w.top + w.height / 2;
      const row = rows.find((r) => Math.abs(r.cy - cy) <= Math.min(r.height, w.height) * 0.45);
      if (row) {
        row.items.push(w);
        row.cy = (row.cy * (row.items.length - 1) + cy) / row.items.length;
      } else rows.push({ cy, height: w.height, items: [w] });
    }
    for (const row of rows) {
      let segment = [];
      const flush = () => {
        if (!segment.length) return;
        const left = Math.min(...segment.map((w) => w.left)),
          top = Math.min(...segment.map((w) => w.top));
        lines.push({
          text: segment.map((w) => w.text).join(" "),
          left,
          top,
          width: Math.max(...segment.map((w) => w.left + w.width)) - left,
          height: Math.max(...segment.map((w) => w.top + w.height)) - top,
          passId,
          synthetic: true,
        });
        segment = [];
      };
      for (const w of row.items.sort((a, b) => a.left - b.left)) {
        const prev = segment.at(-1);
        if (prev && w.left - prev.left - prev.width > Math.max(prev.height, w.height) * 1.4) flush();
        segment.push(w);
      }
      flush();
    }
  }
  return lines;
}

function ocrDedupePositioned(items) {
  const out = [];
  for (const item of items || []) {
    const text = ocrCleanLine(item.text || item.word || "");
    const b = ocrWordBox(item);
    if (!text || b.width <= 0 || b.height <= 0) continue;
    const old = out.find((o) => {
      const overlapX = Math.max(0, Math.min(b.left + b.width, o.left + o.width) - Math.max(b.left, o.left));
      const overlapY = Math.max(0, Math.min(b.top + b.height, o.top + o.height) - Math.max(b.top, o.top));
      const sharedPosition =
        overlapX / Math.max(b.width, o.width) > 0.7 && overlapY / Math.min(b.height, o.height) > 0.55;
      const independentPass = !o.passIds.includes(item.passId || "default");
      const sameFootprint =
        overlapX / Math.max(b.width, o.width) > 0.85 && overlapY / Math.max(b.height, o.height) > 0.75;
      return (
        sharedPosition && (ocrStringSimilarity(text, o.text) > 0.5 || (independentPass && sameFootprint))
      );
    });
    if (!old) {
      out.push({ ...item, ...b, text, alternatives: [text], passIds: [item.passId || "default"] });
      continue;
    }
    const ids = [...new Set([...old.passIds, item.passId || "default"])];
    const alternatives = [...new Set([...old.alternatives, text])];
    if (Number(item.confidence || 0) > Number(old.confidence || 0)) Object.assign(old, item, b, { text });
    old.passIds = ids;
    old.alternatives = alternatives;
  }
  return out;
}

function ocrSpatialLines(result, fileIndex) {
  const synthetic = ocrSyntheticLines(result.words || []);
  // A server line spanning two separated columns must not join those columns again.
  const raw = (result.lines || []).filter((line) => {
    const b = ocrWordBox(line);
    const parts = synthetic.filter(
      (s) =>
        (s.passId || "default") === (line.passId || "default") &&
        Math.abs(s.top + s.height / 2 - b.top - b.height / 2) < Math.min(s.height, b.height) * 0.6 &&
        s.left >= b.left - 3 &&
        s.left + s.width <= b.left + b.width + 3,
    );
    return parts.length < 2;
  });
  return ocrDedupePositioned([...raw, ...synthetic])
    .map((line, lineIndex) => ({
      ...line,
      fileIndex,
      lineIndex,
      cx: line.left + line.width / 2,
      cy: line.top + line.height / 2,
    }))
    .filter((x) => !ocrNoiseLine(x.text));
}

function ocrCreatorText(text) {
  return ocrStripTypeSuffix(text)
    .split(/\s*[·ㆍ•]\s*|(?<=[가-힣])\s+\.\s+(?=[가-힣]{2})/)[0]
    .replace(/\s*(?:지음|저자|감독|지은이)\s*$/, "")
    .trim();
}

function ocrCreatorLike(text) {
  const s = ocrCreatorText(text);
  return (
    ocrUsefulLine(s) && !ocrNoiseLine(s) && !ocrEditionGroups(s).length && s.length <= 80 && !/[!?]/.test(s)
  );
}

function ocrCanonicalQueryTitle(title, creator) {
  const c = ocrCreatorText(creator || "");
  return { title: ocrStripCreatorFromTitle(title, c), creator: c };
}

function ocrEditionKey(text) {
  return ocrEditionGroups(text).sort().join("|");
}

function ocrSpatialQueries(results) {
  const queries = [];
  (results || []).forEach((result, fileIndex) => {
    const lines = ocrSpatialLines(result, fileIndex)
      .filter((l) => ocrTitleLike(l.text) || ocrEditionOnlyLine(l.text))
      .sort((a, b) => a.top - b.top || a.left - b.left);
    const consumed = new Set(),
      local = [];
    const aligned = (a, b) => Math.abs(a.left - b.left) <= Math.max(a.height, b.height) * 0.8;
    const nextLine = (a) =>
      lines
        .filter(
          (b) =>
            b !== a &&
            !consumed.has(b) &&
            b.top >= a.top + a.height * 0.7 &&
            b.top - a.top - a.height <= Math.max(a.height, b.height) * 2.2 &&
            aligned(a, b),
        )
        .sort((a, b) => a.top - b.top)[0];
    for (const line of lines) {
      if (consumed.has(line) || ocrEditionOnlyLine(line.text)) continue;
      let title = line.text,
        tail = line,
        creator = "",
        creatorLine = null,
        parts = [line],
        hypotheses = [];
      let next = nextLine(tail);
      // A wrapped title is joined only when a third metadata line supports it.
      const third = next && nextLine(next);
      if (
        next &&
        third &&
        !ocrCreatorMetadata(next.text) &&
        !ocrEditionOnlyLine(next.text) &&
        Math.abs(next.height - line.height) < line.height * 0.18 &&
        third.height < line.height * 0.88 &&
        ocrCreatorLike(third.text) &&
        !/[·ㆍ•]/.test(next.text)
      ) {
        hypotheses.push({
          title: line.text,
          creator: ocrCreatorText(next.text),
          titleVariants: line.alternatives || [],
          creatorVariants: (next.alternatives || []).map(ocrCreatorText),
        });
        title += " " + next.text;
        parts.push(next);
        consumed.add(next);
        tail = next;
        next = third;
      }
      if (next && ocrEditionOnlyLine(next.text)) {
        title += " " + next.text;
        consumed.add(next);
        tail = next;
        next = nextLine(tail);
      }
      if (next && ocrCreatorLike(next.text) && next.height <= line.height * 1.2) {
        creatorLine = next;
        creator = ocrCreatorText(next.text);
        consumed.add(next);
      }
      consumed.add(line);
      const canonical = ocrCanonicalQueryTitle(title, creator);
      const repeat = lines.filter(
        (l) =>
          l !== line &&
          Math.abs(l.left - line.left) < line.height &&
          l.height >= line.height * 0.8 &&
          l.height <= line.height * 1.2,
      ).length;
      local.push({
        ...canonical,
        hypotheses,
        titleVariants:
          parts.length === 1
            ? (line.alternatives || []).filter((t) => ocrEditionKey(t) === ocrEditionKey(title))
            : [],
        creatorVariants: (creatorLine?.alternatives || []).map(ocrCreatorText),
        groupId: fileIndex + ":" + line.lineIndex,
        fileIndex,
        top: line.top,
        left: line.left,
        width: Math.max(...parts.map((p) => p.left + p.width)) - line.left,
        height: (creatorLine || tail).top + (creatorLine || tail).height - line.top,
        fontHeight: line.height,
        geometryScore: creatorLine ? Math.min(95, 78 + repeat * 3) : 48,
        edition: ocrEditionKey(title),
        localText: parts
          .map((p) => p.text)
          .concat(creatorLine ? [creatorLine.text] : [])
          .join("\n"),
        evidence: parts.map((p) => p.text),
        spatial: true,
      });
    }
    // Repeated, aligned title/metadata pairs are the primary text column.
    // Smaller lettering beside that column belongs to its illustration only
    // inside that item's vertical cell; a neighbouring card is not suppressed.
    const primaries = local.filter(
      (q) =>
        q.creator &&
        local.filter((p) => p.creator && Math.abs(p.left - q.left) < Math.max(p.fontHeight, q.fontHeight))
          .length >= 2,
    );
    for (const q of local) {
      const owner = primaries
        .filter(
          (p) =>
            p !== q &&
            q.left + q.width <= p.left + p.fontHeight * 0.5 &&
            q.fontHeight < p.fontHeight * 0.82 &&
            q.top >= p.top - p.fontHeight * 2 &&
            q.top <
              Math.min(
                ...primaries
                  .filter((n) => n.top > p.top + p.fontHeight * 2 && Math.abs(n.left - p.left) < p.fontHeight)
                  .map((n) => n.top - n.fontHeight * 2),
                p.top + p.fontHeight * 16,
              ),
        )
        .sort((a, b) => b.top - a.top)[0];
      if (owner) {
        owner.evidence.push(q.title);
        continue;
      }
      queries.push(q);
    }
  });
  return queries;
}

function ocrCanonicalResultTitle(title, creator) {
  return Model.norm(ocrBaseTitle(ocrStripCreatorFromTitle(title, ocrCreatorText(creator))));
}

function ocrSameResolvedWork(a, b) {
  if (
    !a ||
    !b ||
    a.type !== b.type ||
    ocrEditionKey(a.ocrQuery || a.title) !== ocrEditionKey(b.ocrQuery || b.title) ||
    ocrEditionKey(a.title) !== ocrEditionKey(b.title)
  )
    return false;
  if (a.provider && a.provider === b.provider && a.providerId && a.providerId === b.providerId) return true;
  const at = ocrCanonicalResultTitle(a.title, a.creator),
    bt = ocrCanonicalResultTitle(b.title, b.creator);
  if (!at || (at !== bt && ocrStringSimilarity(at, bt) < 0.94)) return false;
  return (
    !!a.creator &&
    !!b.creator &&
    ocrStringSimilarity(ocrCreatorText(a.creator), ocrCreatorText(b.creator)) >= 0.8
  );
}

function ocrEvaluateHypothesis(c, q, rank, preferredType = "") {
  const source = ocrCanonicalResultTitle(q.title, q.creator),
    target = ocrCanonicalResultTitle(c.title, c.creator);
  const title = Math.max(
      ...[q.title, ...(q.titleVariants || [])].map((t) =>
        ocrStringSimilarity(ocrCanonicalResultTitle(t, q.creator), target),
      ),
    ),
    creator =
      q.creator && c.creator
        ? Math.max(
            ...[q.creator, ...(q.creatorVariants || [])].map((v) =>
              ocrStringSimilarity(ocrCreatorText(c.creator), v),
            ),
          )
        : null;
  const wanted = ocrEditionGroups(q.title),
    actual = ocrEditionGroups(c.title);
  const editionExact = ocrEditionKey(q.title) === ocrEditionKey(c.title);
  if (source.length === 1 && !q.creator && q.geometryScore < 70)
    return { valid: false, reason: "isolated-glyph", title, creator };
  // Short titles require exact title evidence; a matching author cannot rescue an unrelated title.
  if (!source || title < (source.length <= 3 ? 1 : 0.56))
    return { valid: false, reason: "title", title, creator };
  if (wanted.includes("largeprint") !== actual.includes("largeprint"))
    return { valid: false, reason: "largeprint", title, creator };
  if (creator !== null && creator < 0.3) return { valid: false, reason: "creator", title, creator };
  const spatial = Math.min(1, (q.geometryScore || 45) / 100),
    relevance = 1 / (1 + rank);
  const score = Math.min(
    100,
    title * 65 +
      (creator === null ? 0 : creator * 20) +
      spatial * 8 +
      relevance * 3 +
      (editionExact ? 4 : -8) +
      (preferredType === c.type ? 1 : 0),
  );
  const high = score >= 82 && title >= 0.86 && editionExact && (creator === null || creator >= 0.75);
  return {
    valid: true,
    title,
    creator,
    editionExact,
    spatial,
    relevance,
    score,
    label: high ? "일치도 높음" : "확인 필요",
    level: high ? "high" : "medium",
    selected: high,
  };
}

async function ocrResolveQueries(queries, search, progress, preferredType = "") {
  const cache = new Map();
  const lookup = async (query) => {
    if (!cache.has(query))
      cache.set(
        query,
        Promise.resolve().then(() => search(query, "")),
      );
    return cache.get(query);
  };
  const resolved = await ocrMapLimit(queries, 3, async (q, i) => {
    if (progress) progress(q, i, queries.length);
    const pool = new Map(),
      errors = [];
    const add = async (query) => {
      try {
        const found = await lookup(query);
        errors.push(...(found.errors || []));
        found.forEach((c, rank) => {
          const key = ocrCandidateKey(c);
          if (!pool.has(key)) pool.set(key, { ...c, searchRank: c.ocrSearchRank ?? rank });
        });
      } catch (e) {
        errors.push(String(e.message || e));
      }
    };
    const ranked = () =>
      [...pool.values()]
        .map((c) => ({ ...c, match: ocrEvaluateCandidate(c, q, c.searchRank, preferredType) }))
        .filter((c) => c.match.valid)
        .sort((a, b) => b.match.score - a.match.score);
    await add(q.title);
    // Never discard the original title/creator interpretation after a geometric wrap.
    for (const h of q.hypotheses || []) await add(h.title);
    if (!ranked()[0] || !ranked()[0].match.selected) {
      for (const variant of [...new Set(q.titleVariants || [])].slice(0, 3)) {
        if (Model.norm(variant) !== Model.norm(q.title)) await add(variant);
      }
    }
    if (!ranked()[0] || !ranked()[0].match.selected) {
      for (const h of [q, ...(q.hypotheses || [])]) if (h.creator) await add(h.title + " " + h.creator);
    }
    const base = ocrBaseTitle(q.title);
    if (Model.norm(base) !== Model.norm(q.title) && (!ranked()[0] || !ranked()[0].match.editionExact))
      await add(base + (q.creator ? " " + q.creator : ""));
    const options = ranked(),
      best = options[0];
    const diagnostic = {
      groupId: q.groupId,
      query: q.title,
      creator: q.creator,
      hypotheses: q.hypotheses || [],
      errors,
      results: [...pool.values()].map((c) => ({
        candidateTitle: c.title,
        candidateCreator: c.creator,
        ...ocrEvaluateCandidate(c, q, c.searchRank, preferredType),
      })),
    };
    if (!best) return { diagnostic };
    const m = { ...best.match };
    if (options[1] && !ocrSameResolvedWork(best, options[1]) && m.score - options[1].match.score < 3) {
      m.selected = false;
      m.level = "medium";
      m.label = "확인 필요";
    }
    return {
      diagnostic,
      chosen: {
        ...best,
        score: m.score,
        selected: m.selected,
        confidence: m.label,
        confidenceLevel: m.level,
        source: "사진 자동 인식 · OCR.Space",
        ocrQuery: m.ocrTitle,
        ocrGroupId: q.groupId,
        ocrTop: q.top,
        ocrFileIndex: q.fileIndex,
        ocrGeometryScore: q.geometryScore,
      },
    };
  });
  const picked = [];
  for (const { chosen } of resolved) {
    if (!chosen) continue;
    const duplicate = picked.findIndex((p) => ocrSameResolvedWork(p, chosen));
    if (duplicate < 0) picked.push(chosen);
    else if (chosen.score > picked[duplicate].score) picked[duplicate] = chosen;
  }
  return { picked, diagnostics: resolved.map((r) => r.diagnostic) };
}

async function imageCanvasToOCRDataURL(canvas) {
  const data = canvas.toDataURL("image/png");
  return {
    data,
    width: canvas.width,
    height: canvas.height,
    bytes: Math.ceil((data.split(",")[1].length * 3) / 4),
  };
}

function ocrGenericRegionPlan(w, h) {
  const tw = Math.min(w, 850),
    th = Math.min(h, 900),
    plan = [];
  const positions = (size, tile) => {
    const out = [0];
    while (out.at(-1) + tile < size) out.push(Math.min(size - tile, out.at(-1) + Math.floor(tile * 0.78)));
    return out;
  };
  for (const sy of positions(h, th))
    for (const sx of positions(w, tw)) plan.push({ sx, sy, sw: tw, sh: th, scale: Math.min(2.5, 1500 / tw) });
  return plan;
}

async function ocrEncodeRegion(img, sx, sy, sw, sh, scale = 1) {
  const pad = 32,
    canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale) + pad * 2;
  canvas.height = Math.round(sh * scale) + pad * 2;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, pad, pad, Math.round(sw * scale), Math.round(sh * scale));
  return { ...(await imageCanvasToOCRDataURL(canvas)), sx, sy, sw, sh, scale, padX: pad, padY: pad };
}

async function requestServerOCRMultiPassUncached(file, progress, onPartial) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url),
      w = img.naturalWidth || img.width,
      h = img.naturalHeight || img.height;
    const plan = ocrGenericRegionPlan(w, h);
    if (w * h <= 12000000) plan.unshift({ sx: 0, sy: 0, sw: w, sh: h, scale: 1 });
    const tasks = [];
    async function prepare(region, depth = 0) {
      const enc = await ocrEncodeRegion(img, region.sx, region.sy, region.sw, region.sh, region.scale);
      if (enc.bytes > 850000 && depth < 8) {
        const axis = region.sw > region.sh ? "x" : "y",
          size = axis === "x" ? region.sw : region.sh,
          part = Math.ceil(size * 0.58);
        if (part < size) {
          for (const offset of [0, size - part])
            await prepare(
              {
                ...region,
                [axis === "x" ? "sx" : "sy"]: region[axis === "x" ? "sx" : "sy"] + offset,
                [axis === "x" ? "sw" : "sh"]: part,
              },
              depth + 1,
            );
          return;
        }
      }
      tasks.push({ region, enc });
    }
    for (const region of plan) await prepare(region);
    let completed = 0;
    const partials = [];
    const outputs = await ocrMapLimit(tasks, 3, async ({ region, enc }, i) => {
      const passId = "p" + i,
        started = performance.now();
      try {
        if (enc.bytes > 850000) throw Error("사진이 너무 커요. 더 작은 사진으로 다시 시도해주세요.");
        const payload = await ocrPostImage(enc.data);
        const output = {
          text: payload.text || "",
          lines: (payload.lines || []).map((x) => ({ ...ocrRegionBox(x, enc), passId })),
          words: (payload.words || []).map((x) => ({ ...ocrRegionBox(x, enc), passId })),
          pass: {
            passId,
            ...region,
            ok: true,
            lineCount: (payload.lines || []).length,
            ms: performance.now() - started,
          },
        };
        partials[i] = output;
        if (onPartial) {
          const ready = partials.filter(Boolean);
          try {
            onPartial({
              name: file.name,
              text: ready.map((o) => o.text).join("\n"),
              lines: ready.flatMap((o) => o.lines),
              words: ready.flatMap((o) => o.words),
              sourceWidth: w,
              sourceHeight: h,
            });
          } catch {
            /* Optional prefetch must never invalidate a successful OCR pass. */
          }
        }
        return output;
      } catch (e) {
        return {
          text: "",
          lines: [],
          words: [],
          pass: {
            passId,
            ...region,
            ok: false,
            error: String(e.message || e),
            ms: performance.now() - started,
          },
        };
      } finally {
        completed++;
        if (progress) progress("글자 영역을 읽고 있어요 · " + completed + "/" + tasks.length);
      }
    });
    const passes = outputs.map((o) => o.pass);
    if (!passes.some((p) => p.ok)) throw Error(passes[0]?.error || "사진을 읽지 못했어요.");
    return {
      name: file.name,
      text: outputs.map((o) => o.text).join("\n"),
      lines: outputs.flatMap((o) => o.lines),
      words: outputs.flatMap((o) => o.words),
      passes,
      sourceWidth: w,
      sourceHeight: h,
      multiPassCount: passes.length,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ocrCreatorMetadata(text) {
  const cleaned = ocrStripTypeSuffix(text);
  return ocrCreatorText(cleaned) !== cleaned || /(?:저자|지음|지은이|감독|아티스트)\s*[:：]/.test(cleaned);
}

async function ocrMapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index], index);
      }
    }),
  );
  return results;
}

function ocrEvaluateCandidate(c, q, rank, preferredType = "") {
  const interpretations = [q, ...(q.hypotheses || [])];
  const scores = interpretations.map((h) => ({
    ...ocrEvaluateHypothesis(c, { ...q, ...h, hypotheses: [] }, rank, preferredType),
    ocrTitle: h.title,
    ocrCreator: h.creator,
  }));
  return scores.filter((m) => m.valid).sort((a, b) => b.score - a.score)[0] || scores[0];
}

// Session memory only: no screenshots or OCR text are persisted in browser storage.
const OCR_IMAGE_CACHE = {
  values: new Map(),
  pending: new Map(),
  ttl: 10 * 60 * 1000,
  maxEntries: 12,
  maxBytes: 8 * 1024 * 1024,
};

const OCR_SEARCH_CACHE = {
  values: new Map(),
  pending: new Map(),
  ttl: 5 * 60 * 1000,
  maxEntries: 128,
  maxBytes: 2 * 1024 * 1024,
};

function ocrCacheCopy(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

async function ocrCached(cache, key, produce, accept = () => true, onReuse = () => {}) {
  const now = Date.now();
  for (const [k, v] of cache.values) if (v.expires <= now) cache.values.delete(k);
  const old = cache.values.get(key);
  if (old) {
    cache.values.delete(key);
    cache.values.set(key, old);
    onReuse("cached");
    return ocrCacheCopy(old.value);
  }
  if (cache.pending.has(key)) {
    onReuse("pending");
    return ocrCacheCopy(await cache.pending.get(key));
  }
  const job = Promise.resolve()
    .then(produce)
    .then((value) => {
      if (accept(value)) {
        const bytes = JSON.stringify(value).length * 2;
        if (bytes <= cache.maxBytes) {
          cache.values.set(key, { value: ocrCacheCopy(value), bytes, expires: Date.now() + cache.ttl });
          let total = [...cache.values.values()].reduce((n, v) => n + v.bytes, 0);
          while (cache.values.size > cache.maxEntries || total > cache.maxBytes) {
            const first = cache.values.keys().next().value;
            total -= cache.values.get(first).bytes;
            cache.values.delete(first);
          }
        }
      }
      return value;
    });
  cache.pending.set(key, job);
  try {
    return ocrCacheCopy(await job);
  } finally {
    if (cache.pending.get(key) === job) cache.pending.delete(key);
  }
}

async function ocrFileDigest(file) {
  if (typeof file?.arrayBuffer !== "function" || !globalThis.crypto?.subtle) return "";
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

async function ocrFetch(endpoint, query, unwrap, normalize) {
  // Preserve punctuation and case: different editions and creator queries stay distinct.
  const normalized = String(query || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return ocrCached(
    OCR_SEARCH_CACHE,
    JSON.stringify([endpoint, normalized]),
    () => ocrFetchUncached(endpoint, normalized, unwrap, normalize),
    (value) => Array.isArray(value) && value.length > 0,
  );
}

async function requestServerOCRMultiPass(file, progress, onPartial) {
  const digest = await ocrFileDigest(file);
  if (!digest) return requestServerOCRMultiPassUncached(file, progress, onPartial);
  let cacheState = "fresh";
  const value = await ocrCached(
    OCR_IMAGE_CACHE,
    "png-multipass-v2:" + digest,
    () => requestServerOCRMultiPassUncached(file, progress, onPartial),
    (r) => r.passes?.length > 0 && r.passes.every((p) => p.ok) && r.lines?.length > 0,
    (state) => {
      cacheState = state;
      if (progress)
        progress(
          state === "cached"
            ? "이미 읽은 사진의 인식 결과를 불러오고 있어요…"
            : "같은 사진의 진행 중인 분석을 기다리고 있어요…",
        );
    },
  );
  return { ...value, name: file.name, cacheState };
}

function ocrCreateSearchSession(search, isCurrent = () => true) {
  const entries = new Map(),
    queue = [];
  let active = 0,
    finalPhase = false,
    stopped = false;
  const stats = { prefetched: 0, reused: 0, discarded: 0, peak: 0 };
  const keyOf = (q) =>
    String(q || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
  function pump() {
    if (stopped || !isCurrent()) return;
    while (active < (finalPhase ? 3 : 2) && queue.length) {
      const job = queue.shift();
      job.state = "running";
      active++;
      stats.peak = Math.max(stats.peak, active);
      if (job.speculative) stats.prefetched++;
      Promise.resolve()
        .then(() => search(job.query))
        .then(
          (value) => {
            job.state = "done";
            job.value = value;
            // A failed speculative lookup must not suppress a normal retry.
            if (value.errors?.length) entries.delete(job.key);
            job.resolve(value);
          },
          (error) => {
            entries.delete(job.key);
            job.state = "failed";
            job.reject(error);
          },
        )
        .finally(() => {
          active--;
          pump();
        });
    }
  }
  function request(query, speculative) {
    const key = keyOf(query),
      existing = entries.get(key);
    if (existing) {
      if (!speculative && existing.speculative && !existing.used) {
        existing.used = true;
        stats.reused++;
      }
      return existing.promise;
    }
    if (stopped || !isCurrent()) return Promise.reject(Error("인식이 취소되었어요."));
    const job = { query: key, key, speculative, state: "queued", used: !speculative };
    job.promise = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });
    entries.set(key, job);
    if (speculative) queue.push(job);
    else queue.unshift(job);
    pump();
    return job.promise;
  }
  function discardQueued() {
    while (queue.length) {
      const job = queue.pop();
      entries.delete(job.key);
      stats.discarded++;
      job.reject(Error("추가 사전 검색을 종료했어요."));
    }
  }
  return {
    offer(queries) {
      if (finalPhase || stopped || !isCurrent()) return;
      // Speculation only: this budget never filters the final recognition candidates.
      for (const q of [...queries].sort((a, b) => b.geometryScore - a.geometryScore)) {
        if (stats.prefetched + queue.length >= 12) break;
        if (!q.creator || q.geometryScore < 85) continue;
        void request(q.title, true).catch(() => {});
      }
    },
    beginFinal() {
      finalPhase = true;
      discardQueued();
      pump();
    },
    async lookup(query) {
      const key = keyOf(query),
        job = entries.get(key);
      if (job?.speculative) {
        try {
          const value = await request(query, false);
          if (!value.errors?.length) return ocrCacheCopy(value);
        } catch {}
        if (entries.get(key) === job) entries.delete(key);
      }
      return ocrCacheCopy(await request(query, false));
    },
    stop() {
      stopped = true;
      discardQueued();
    },
    stats,
  };
}

async function runOCR() {
  if (!photoFiles.length || ocrBusy) return;
  const pipelineStarted = performance.now();
  let ocrFinished = 0,
    searchStarted = 0;
  ocrBusy = true;
  const ticket = ++ocrGeneration;
  $("ocrButton").disabled = true;
  $("ocrProgress").textContent = "사진을 읽고 있어요…";
  let results = [];
  const searchSession = ocrCreateSearchSession(ocrSearchAll, () => ticket === ocrGeneration);
  try {
    for (let fi = 0; fi < photoFiles.length; fi++) {
      if (ticket !== ocrGeneration) return;
      $("ocrProgress").textContent = "글자를 읽고 있어요 · " + (fi + 1) + "/" + photoFiles.length + "장";
      const result = await requestServerOCRMultiPass(
        photoFiles[fi],
        (msg) => {
          if (ticket === ocrGeneration && $("ocrProgress")) $("ocrProgress").textContent = msg;
        },
        (partial) => {
          if (ticket === ocrGeneration) searchSession.offer(ocrSpatialQueries([partial]));
        },
      );
      results.push(result);
    }
    if (ticket !== ocrGeneration) return;
    ocrFinished = performance.now();
    const text = results.map((r) => r.text).join("\n"),
      preferredType = ocrContextType(text);
    if (preferredType === "album")
      throw Error(
        "음반은 현재 지원하지 않아요. 책이나 영화라면 제목이 잘 보이는 사진을 가져오거나 직접 입력해주세요.",
      );
    $("ocrProgress").textContent = "제목과 저자·감독을 찾고 있어요…";
    const structured = ocrSpatialQueries(results, text);
    if (!structured.length)
      throw Error("검색할 만한 제목을 읽지 못했어요. 더 선명한 사진으로 다시 시도해주세요.");
    $("ocrProgress").textContent = "사진 속 작품을 찾고 있어요…";

    const queries = structured;
    searchStarted = performance.now();
    searchSession.beginFinal();
    const resolved = await ocrResolveQueries(
      queries,
      (q) => searchSession.lookup(q),
      (q, i, total) => {
        if (ticket !== ocrGeneration) throw Error("인식이 취소되었어요.");
        $("ocrProgress").textContent = "작품 찾는 중 · " + (i + 1) + "/" + total + " · " + q.title;
      },
      preferredType,
    );
    if (ticket !== ocrGeneration) return;
    candidates = resolved.picked
      .filter((c) => ["book", "movie"].includes(c.type) && !(c.type === "book" && isExcludedBookCandidate(c)))
      .map((c) =>
        photoImportSource ? { ...c, source: photoImportSource.url, linkSources: [photoImportSource] } : c,
      );
    window.songrimOCRDiagnostics = {
      images: results,
      queries,
      matching: resolved.diagnostics,
      prefetch: { ...searchSession.stats },
      timings: {
        ocrMs: ocrFinished - pipelineStarted,
        groupingMs: searchStarted - ocrFinished,
        searchMs: performance.now() - searchStarted,
        totalMs: performance.now() - pipelineStarted,
      },
    };
    const failures = results.flatMap((r) => (r.passes || []).filter((p) => !p.ok)).length;
    const searchFailures = resolved.diagnostics.reduce((n, d) => n + d.errors.length, 0);
    const auto = candidates.filter((c) => c.selected && c.confidenceLevel === "high").length,
      review = candidates.filter((c) => c.selected && c.confidenceLevel === "medium").length;
    const used = queries.map((q) => (q.creator ? q.title + " — " + q.creator : q.title));
    showModal(
      "사진에서 찾은 작품",
      '<div class="ocr-scan-status"><strong>' +
        candidates.length +
        "개를 찾았어요</strong><span>자동 선택 " +
        (auto + review) +
        "개</span></div>" +
        (failures || searchFailures
          ? '<div class="ocr-review-note">일부 인식·검색 요청이 실패했어요. 결과에 누락이 있을 수 있으니 다시 시도해주세요.</div>'
          : "") +
        '<div class="ocr-review-note">제목과 저자·감독을 확인하고, 저장할 작품을 골라주세요.</div><div id="candidateRows"></div><details class="collapse"><summary>인식한 제목·제작자 보기</summary><p class="muted">' +
        esc(used.join(" · ")) +
        '</p></details><details class="collapse"><summary>사진에서 읽은 글자 보기</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">' +
        esc(text || "글자를 찾지 못했어요.") +
        '</p></details><details class="collapse ocr-unmatched"><summary>직접 추가하기</summary><label for="ocrTitle">작품 제목</label><input id="ocrTitle" placeholder="제목 입력"><label for="ocrCreator">제작자 · 선택</label><input id="ocrCreator"><select id="ocrType" aria-label="콘텐츠 유형"><option value="book">책</option><option value="movie">영화</option></select>' +
        button("후보에 추가", "candidateManual", "secondary") +
        "</details>" +
        button("선택한 작품 저장", "saveCandidates", "primary", 'id="saveCandidates"'),
      "review",
    );
    renderCandidates();
  } catch (e) {
    if (ticket === ocrGeneration) {
      $("ocrProgress").textContent = userMessage(
        e,
        "사진을 읽지 못했어요. 다시 시도하거나 직접 입력해주세요.",
      );
      $("ocrButton").disabled = false;
    }
  } finally {
    searchSession.stop();
    if (ticket === ocrGeneration) ocrBusy = false;
  }
}

function renderCandidates() {
  const rows = $("candidateRows");
  if (!rows) return;
  candidates = candidates.filter((c) => ["book", "movie"].includes(c.type));
  rows.innerHTML = candidates.length
    ? '<div class="ocr-match-list">' +
      candidates
        .map(
          (c, i) =>
            '<div class="ocr-match"><input type="checkbox" id="candidate-' +
            i +
            '" data-candidate="' +
            i +
            '" ' +
            (c.selected ? "checked" : "") +
            ">" +
            cover(c) +
            '<label class="ocr-match-main" for="candidate-' +
            i +
            '"><div class="ocr-match-title">' +
            esc(c.title) +
            '</div><div class="ocr-match-meta">' +
            esc(c.creator || (c.type === "movie" ? "감독 미확인" : "저자 미확인")) +
            " · " +
            typeName[c.type] +
            '</div><div class="ocr-confidence ' +
            esc(c.confidenceLevel || "medium") +
            '">' +
            esc(c.confidence || "직접 추가") +
            "</div></label></div>",
        )
        .join("") +
      "</div>"
    : '<p class="note">확실하게 맞는 작품을 찾지 못했어요. 인식한 글자를 확인해 직접 추가하거나 다른 사진으로 다시 시도해주세요.</p>';
  if ($("saveCandidates")) $("saveCandidates").disabled = !candidates.some((c) => c.selected);
}
