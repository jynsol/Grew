/* original script block 12 */
/* Conservative, dependency-free extraction of work queries from article text.
 * This parser treats page content only as data; it never evaluates page markup.
 * It proposes queries for a subsequent catalogue lookup, not verified metadata.
 */
(function (root) {
  'use strict';
  var MAX_TEXT = 60000, MAX_WORKS = 30;
  var TYPE_LABEL = '(?:책|도서|서적|소설|에세이|영화|음반|앨범|book|movie|film|album)';
  var RECOMMEND = /추천|권하는|읽어\s*볼|읽을\s*만|볼\s*만|들을\s*만|추천작|recommend(?:ed|ation)?|picks?\b/i;
  var NO_RECOMMEND = /추천\s*(?:하지\s*않|하지\s*마|안\s*함|안\s*해|못|하지\s*못)|비추천|권하지\s*않|not\s+recommend|do\s+not\s+recommend/i;
  var NAVIGATION = /^(?:광고|광고성|관련\s*기사|다음\s*기사|이전\s*기사|인기\s*기사|많이\s*본\s*기사|검색\s*결과|더\s*보기|함께\s*읽기|추천\s*기사|관련\s*링크|관련\s*콘텐츠|이전\s*글|다음\s*글|참고\s*링크|목차|메뉴|navigation|advertisement|related\s+(?:articles|posts)|search\s+results)\s*[:：]?\s*$/i;
  var DIRECTIVE = /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|system\s*prompt|이전\s*(?:의\s*)?(?:지시|명령)|시스템\s*(?:프롬프트|명령)|명령을\s*실행|api[_ -]?key\s*[:=]/i;
  var META_LINE = /^(?:[-*+]\s*)?(?:\*\*)?(작가|저자|지은이|글쓴이|감독|연출|아티스트|가수|뮤지션|밴드|음악가|author|director|artist)(?:\*\*)?\s*[:：]\s*(.+)$/i;

  function typeOf(value) {
    var s = String(value || '').toLowerCase();
    var found = [];
    if (/(?:📚|📖|책|도서|서적|소설|세계문학|문학전집|에세이|작가|저자|지은이|글쓴이|\bbooks?\b|\bauthor\b)/i.test(s)) found.push('book');
    if (/(?:영화|감독|연출|\bmovies?\b|\bfilms?\b|\bdirector\b)/i.test(s)) found.push('movie');
    if (/(?:음반|앨범|아티스트|가수|뮤지션|밴드|음악가|\balbums?\b|\bartist\b)/i.test(s)) found.push('album');
    return found.length === 1 ? found[0] : '';
  }

  function plain(value) {
    return String(value || '')
      .replace(/!\[[^\]]*\]\([^\n)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^\n)]*\)/g, '$1')
      .replace(/<\/?(?:a|p|div|span|h[1-6]|strong|b|em|i|li|ul|ol|br|section|article|table|tr|td|th|img|svg|path|button|input|form|video|audio|source)\b[^>]*>/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/[*_~]/g, '').replace(/[\u200b-\u200f\ufeff]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  function cleanTitle(value) {
    var s = plain(value).replace(/^#{1,6}\s*/, '').replace(/^(?:\d{1,2}[.)]|[-+•])\s+/, '').trim();
    s = s.replace(/^[《〈『「\[“"]+|[》〉』」\]”"]+$/g, '').trim();
    s = s.replace(/\s*\((?:19|20)\d{2}(?:년)?\)\s*$/, '').trim();
    return s;
  }

  function validTitle(value, allowShort) {
    if (value.length < (allowShort ? 1 : 2) || value.length > 100 || /^@[A-Za-z0-9_.]+$/.test(value)) return false;
    if (!/[\p{L}\p{N}]/u.test(value) || /^(?:타임\s*스탬프|타임\s*라인|목차|챕터|timestamps?|chapters?)$/i.test(value)) return false;
    if (/https?:\/\/|www\.|mailto:|javascript:|data:|<\/?\w+[^>]*>|[{};=]|\b(?:function|console|document|window)\s*[.(]/i.test(value)) return false;
    if (/^[\d\s.,/:-]+$/.test(value) || NAVIGATION.test(value) || DIRECTIVE.test(value)) return false;
    if (/^(?:책|도서|영화|음반|앨범|작품|콘텐츠|추천|추천작|정보|제목|작품명|줄거리|소개|리뷰|서평|감상|후기|목록|베스트|best|top|books?|movies?|albums?)(?:\s*(?:추천|목록|리스트|소개|리뷰|서평|정보|베스트|best|top|\d+|선|권|편|개|가지|모음))*$/i.test(value)) return false;
    if (/^(?:오늘의?|이번\s*주|이번\s*달|이달의?|올해의?|나의|내가|에디터의|추천하는|꼭\s*(?:읽어야|봐야|들어야))\s*(?:추천\s*)?(?:책|도서|영화|음반|앨범|작품)/i.test(value)) return false;
    if (/(?:추천|리스트|목록|모음)\s*(?:\d+\s*(?:선|권|편|개|가지))?$/.test(value) && typeOf(value)) return false;
    if (/(?:합니다|입니다|하세요|해보세요|해\s*보세요|했습니다|하는\s*방법|하시기\s*바랍니다)[.!?]?$/.test(value)) return false;
    return true;
  }

  function cleanCreator(value) {
    var s = plain(value).replace(/^(?:작가|저자|지은이|감독|연출|아티스트|가수|author|director|artist)\s*[:：]?\s*/i, '').trim();
    s = s.replace(/\s*\((?:19|20)\d{2}(?:년)?\)\s*$/, '').replace(/\s+(?:지음|저|감독|연출)$/, '').trim();
    if (!s || s.length > 60 || /https?:|[<>={};]|추천|소개|입니다|합니다/.test(s)) return '';
    return s;
  }

  function splitTitleCreator(value) {
    var s = plain(value), creator = '';
    // An em/en dash is an intentional title/byline separator; plain hyphens
    // require surrounding spaces so a hyphen inside a work title survives.
    var m = s.match(/^(.+?)\s+(?:[—–]|-)\s+(.+)$/);
    if (m) { s = m[1]; creator = cleanCreator(m[2]); }
    else {
      m = s.match(/^(.+?)\s*\((?:작가|저자|지은이|감독|연출|아티스트|가수)\s*[:：]?\s*([^()]+)\)\s*$/);
      if (m) { s = m[1]; creator = cleanCreator(m[2]); }
    }
    return {title: cleanTitle(s), creator: creator};
  }

  function extractLinkWorkQueries(input, options) {
    options = options || {};
    var text = String(input || '').slice(0, MAX_TEXT)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
      .replace(/<\/?(?:p|div|li|h[1-6])\b[^>]*>/gi, '')
      .replace(/\r\n?/g, '\n');
    var lines = text.split('\n'), works = [], sections = [];
    var pageTitle = plain(String(options.pageTitle || '').slice(0, 300));
    var pageType = typeOf(pageTitle), pageRecommended = RECOMMEND.test(pageTitle);
    var fenced = false, table = null, plainSection = null;

    function context() {
      var type = pageType, recommended = pageRecommended, blocked = NO_RECOMMEND.test(pageTitle) || NAVIGATION.test(pageTitle);
      sections.forEach(function (s) {
        if (s.type) type = s.type;
        if (s.recommended) recommended = true;
        if (s.blocked) blocked = true;
      });
      if (plainSection) {
        if (plainSection.type) type = plainSection.type;
        if (plainSection.recommended) recommended = true;
        if (plainSection.blocked) blocked = true;
      }
      return {type: type, recommended: recommended, blocked: blocked};
    }

    function add(title, creator, type, evidence, explicit) {
      title = cleanTitle(title);
      // A credited original title/year is metadata, not part of the search title.
      var movieMeta = type === 'movie' && title.match(/^(.+?)\s*\(([^()]+?),\s*((?:19|20)\d{2})\)\s*$/);
      if (movieMeta) title = cleanTitle(movieMeta[1]);
      evidence = plain(evidence).slice(0, 240);
      if (!validTitle(title, !!type && explicit) || !evidence || NO_RECOMMEND.test(evidence) || DIRECTIVE.test(evidence)) return;
      type = ['book', 'movie', 'album'].indexOf(type) >= 0 ? type : '';
      var key = title.normalize('NFKC').toLowerCase().replace(/[\s《》〈〉『』「」\[\]“”"'.,!?·:：-]/g, '');
      var existing = works.find(function (w) { return w._key === key && (!w.type || !type || w.type === type); });
      if (existing) {
        if (!existing.type && type) existing.type = type;
        if (!existing.creator && creator) existing.creator = cleanCreator(creator);
        if (explicit) existing.confidence = 'explicit';
        if (movieMeta) Object.assign(existing, {originalTitle:movieMeta[2].trim(), releaseYear:movieMeta[3], requiresReview:true});
        return;
      }
      if (works.length < MAX_WORKS) works.push({title: title, creator: cleanCreator(creator), type: type, evidence: evidence, confidence: explicit ? 'explicit' : 'possible', ...(movieMeta ? {originalTitle: movieMeta[2].trim(), releaseYear: movieMeta[3], requiresReview: true} : {}), _key: key});
    }

    function cells(line) {
      return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(function (s) { return plain(s.replace(/\\\|/g, '|')); });
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (/^\s*(?:```|~~~)/.test(raw)) { fenced = !fenced; table = null; continue; }
      if (fenced || !raw || DIRECTIVE.test(raw)) { if (!raw) table = null; continue; }
      var line = plain(raw.replace(/`[^`]*`/g, '')), heading = raw.match(/^(#{1,6})\s+(.+)$/);
      var ctx = context();
      if (heading) {
        plainSection = null;
        while (sections.length && sections[sections.length - 1].level >= heading[1].length) sections.pop();
        ctx = context();
        var headingText = plain(heading[2]), headingType = typeOf(headingText);
        var blocked = NAVIGATION.test(headingText) || NO_RECOMMEND.test(headingText);
        sections.push({level: heading[1].length, type: headingType, recommended: RECOMMEND.test(headingText), blocked: blocked});
        ctx = context(); table = null;
        if (ctx.blocked) continue;
        // Metadata immediately below a work heading is strong local evidence.
        var meta = null;
        for (var k = i + 1; k < Math.min(lines.length, i + 7); k++) {
          if (/^\s*#{1,6}\s|^\s*(?:```|~~~)/.test(lines[k])) break;
          var next = plain(lines[k]);
          if (NO_RECOMMEND.test(next) || DIRECTIVE.test(next)) { meta = null; break; }
          var field = next.match(META_LINE);
          if (field) { meta = {type: typeOf(field[1]), creator: field[2], evidence: headingText + ' · ' + next}; break; }
        }
        if (meta) {
          var titlePart = headingText.replace(new RegExp('^' + TYPE_LABEL + '\\s*[:：]\\s*', 'i'), '');
          add(titlePart, meta.creator, meta.type || ctx.type, meta.evidence, true);
        }
      }
      // Captions and video descriptions frequently use emoji section labels
      // instead of Markdown headings. Accept only short, recognizable labels.
      var sectionLabel = line.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, '').replace(/\s*[:：]\s*$/, '');
      if (!heading && sectionLabel.length <= 40 && NO_RECOMMEND.test(sectionLabel) && !/[《〈『「\[<]/.test(raw)) {
        plainSection = {type: typeOf(sectionLabel), recommended: false, blocked: true};
        table = null; continue;
      }
      if (!heading && /^(?:(?:추천|이번\s*주\s*추천|이달의\s*추천)\s*)?(?:책|도서|영화|음반|앨범)\s*(?:추천|추천작|목록|리스트)?$/.test(sectionLabel)) {
        plainSection = {type: typeOf(sectionLabel), recommended: RECOMMEND.test(sectionLabel), blocked: false};
        table = null; continue;
      }
      if (!heading && NAVIGATION.test(sectionLabel)) {
        plainSection = {type: '', recommended: false, blocked: true};
        table = null; continue;
      }
      if (ctx.blocked || NO_RECOMMEND.test(line) || NAVIGATION.test(line)) { table = null; continue; }

      // Markdown tables require a title column and a real delimiter row.
      if (raw.indexOf('|') >= 0 && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[i + 1])) {
        var headers = cells(raw);
        var titleColumn = headers.findIndex(function (s) { return /^(?:제목|작품명|작품|추천작|도서명|책\s*제목|영화명|영화\s*제목|앨범명|음반명|title|work)$/i.test(s); });
        var creatorColumn = headers.findIndex(function (s) { return /^(?:작가|저자|지은이|감독|연출|아티스트|가수|뮤지션|밴드|음악가|제작자|author|director|artist|creator)$/i.test(s); });
        var typeColumn = headers.findIndex(function (s) { return /^(?:분류|구분|종류|유형|매체|type|category)$/i.test(s); });
        table = titleColumn >= 0 ? {title: titleColumn, creator: creatorColumn, type: typeColumn, inferredType: typeOf(headers[titleColumn]) || typeOf(headers[creatorColumn]) || ctx.type} : null;
        i++; continue;
      }
      if (table && raw.indexOf('|') >= 0) {
        var row = cells(raw), rowType = typeOf(row[table.type]) || table.inferredType;
        if (rowType || ctx.recommended) add(row[table.title], row[table.creator], rowType, line, !!rowType);
        continue;
      } else if (table) table = null;

      // Explicit labels work in mixed lists without relying on a page-wide type.
      var timeEntry = /^(?:\[)?\d{1,2}:\d{2}(?::\d{2})?(?:\])?\s+/.test(line);
      var entry = line.replace(/^#{1,6}\s*/, '').replace(/^(?:\d{1,2}[.)]|[-+•])\s+/, '')
        .replace(/^(?:\[)?\d{1,2}:\d{2}(?::\d{2})?(?:\])?\s+/, '').replace(/^(?:📖|📚|🎬|🎥|💿|📀)\uFE0F?\s*/u, '');
      var label = entry.match(new RegExp('^(' + TYPE_LABEL + ')\\s*[:：]\\s*(.+)$', 'i'));
      if (label) {
        var parts = splitTitleCreator(label[2]);
        add(parts.title, parts.creator, typeOf(label[1]), line, true);
      }

      // A media emoji at the start of a short line can itself label a title.
      // Exclude metadata, questions and sentences; comma lists are handled below.
      if (!label && /^(?:📖|📚|🎬|🎥|💿|📀)/u.test(line) && entry.length <= 80 &&
          !/[,，、/:：@#]|^(?:19|20)\d{2}|추천|리스트|목록|top\s*\d|다시보기|OTT|평점|구독|팔로우|[.!?]|(?:해요|이에요|예요|입니다|합니다|주세요)$/i.test(entry)) {
        var emojiType = /^(?:📖|📚)/u.test(line) ? 'book' : /^(?:🎬|🎥)/u.test(line) ? 'movie' : 'album';
        add(entry, '', emojiType, line, true);
      }

      // Delimited titles need nearby work/recommendation context. Square
      // brackets in normal text are not sufficient on their own.
      var bracket = /《([^《》\n]{1,100})》|〈([^〈〉\n]{1,100})〉|『([^『』\n]{1,100})』|「([^「」\n]{1,100})」|\[([^\[\]\n]{1,100})\]|<([^<>\n]{1,100})>/g;
      var match;
      while ((match = bracket.exec(raw))) {
        var bracketTitle = match.slice(1).find(function (s) { return s != null; });
        var prior = plain(raw.slice(Math.max(0, match.index - 35), match.index));
        var after = plain(raw.slice(match.index + match[0].length, match.index + match[0].length + 35));
        // Prefer an immediately preceding media label over unrelated mixed
        // media words elsewhere in a sentence.
        var nearbyLabel = prior.match(new RegExp('(' + TYPE_LABEL + ')\\s*[:：]?\\s*$', 'i'));
        var contextLine = line.replace(/《[^》]*》|〈[^〉]*〉|『[^』]*』|「[^」]*」|\[[^\]]*\]|<[^>]*>/g, '');
        var localType = nearbyLabel ? typeOf(nearbyLabel[1]) : typeOf(contextLine) || ctx.type;
        var hasWorkContext = localType || RECOMMEND.test(line) || /작품|읽었다|읽었|읽는다|관람|감상/.test(prior + ' ' + after) || ctx.recommended;
        var urlTarget = raw.slice(match.index + match[0].length).match(/^\([^)]*\)/);
        if (!hasWorkContext || (urlTarget && /(?:관련\s*기사|다음\s*글|바로가기|자세히|구매|광고)/.test(bracketTitle))) continue;
        if (/^\/?(?:script|style|iframe|img|div|span|a|p|br)\b/i.test(bracketTitle)) continue;
        add(bracketTitle, '', localType, line, !!localType);
      }

      // A plain list item is a work query only in a typed recommendation list.
      if (!label && (/^(?:\d{1,2}[.)]|[-+•])\s+/.test(line) || timeEntry) && ctx.type && ctx.recommended && !META_LINE.test(line)) {
        var listParts = splitTitleCreator(entry);
        add(listParts.title, listParts.creator, ctx.type, line, false);
      }
    }

    // Caption lists often use media emoji and commas instead of bullets or
    // delimiters. Scope each run to its emoji, require list context, and never
    // treat arbitrary prose commas as title separators.
    var captionContext = pageTitle + '\n' + text;
    var captionBlocked = NO_RECOMMEND.test(captionContext) || DIRECTIVE.test(captionContext);
    var captionList = RECOMMEND.test(captionContext) || /인생\s*(?:책|영화|앨범)|재독|다시\s*읽|(?:top|베스트)\s*\d+|(?:책|영화|앨범)\s*(?:모음|목록|리스트)/i.test(captionContext);
    if (!captionBlocked && captionList) {
      var runs = text.matchAll(/(📖|📚|🎬|🎥|💿|📀)\uFE0F?\s*([^📖📚🎬🎥💿📀\r\n]{1,600})/gu);
      for (var run of runs) {
        var listType = /📖|📚/.test(run[1]) ? 'book' : /🎬|🎥/.test(run[1]) ? 'movie' : 'album';
        // Public captions sometimes lose newlines. Cut off recognizable reader
        // questions and promotional footers, not words inside a work title.
        var segment = run[2].split(/\s+(?:여러분(?:에게도|은|의|도)?|댓글(?:로|에)?|저도|팔로우|구독)\s|[─━]{2,}/)[0].trim();
        if (/^(?:영화|책|도서|음반|앨범)\s*[:：]/.test(segment) || /\([^()]*[,，][^()]*\)/.test(segment)) continue;
        var titles = segment.split(/\s*[,，、]\s*/);
        if (titles.length < 2 || titles.length > 15) continue;
        for (var candidate of titles) {
          var parts = splitTitleCreator(candidate), name = parts.title;
          if (name.length > 60 || /[@#\n]|알려주세요|추천해주세요|^좋아요$|좋아해요|고맙|감사|팔로우|구독|https?:/i.test(name)) continue;
          add(name, parts.creator, listType, run[1] + ' ' + segment, false);
        }
      }
    }

    return works.map(function (w) {
      return {title: w.title, creator: w.creator, type: w.type, evidence: w.evidence, confidence: w.confidence, ...(w.originalTitle ? {originalTitle:w.originalTitle, releaseYear:w.releaseYear, requiresReview:true} : {})};
    });
  }
  root.extractLinkWorkQueries = extractLinkWorkQueries;
  if (typeof module !== 'undefined' && module.exports) module.exports = {extractLinkWorkQueries: extractLinkWorkQueries};
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* original script block 13 */
/* YouTube work-query proposals, not verified catalogue metadata.
 * Input must be the video's own title, description and transcript, never an
 * entire watch page (which may contain unrelated recommended videos).
 * Unquoted narration is deliberately conservative and always needs review.
 */
(function (root) {
  'use strict';
  var MAX_TEXT = 60000, MAX_QUERIES = 30;
  var UNSAFE = /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|system\s*prompt|이전\s*(?:의\s*)?(?:지시|명령)|시스템\s*(?:프롬프트|명령)|명령을\s*실행|api[_ -]?key\s*[:=]|https?:\/\/|javascript:|data:|[<>{};=]/i;
  var LIST_CONTEXT = /추천|추천작|만점|별\s*(?:다섯|5)\s*개|모음|목록|리스트|\d+\s*(?:선|편|권|장|가지)|best\b|top\s*\d|recommend(?:ed|ations?)?|picks?\b/i;
  var NEGATIVE = /추천\s*(?:하지\s*않|하지\s*마|안\s*함|안\s*해|못)|비추천|권하지\s*않|not\s+recommend|do\s+not\s+recommend/i;
  var NON_TITLE = /구독|좋아요|알림\s*설정|댓글|광고|협찬|프로모션|링크|채널|시청|안녕하세요|감사합니다|영상|평론가|영화계|작품들|작품은|이\s*책은|이\s*영화는|이\s*앨범은|일\s*뿐|라는\s|이라고\s|바로\s|오로지\s|(?:만점|추천|모음|목록|리스트)\s*$/i;
  var SENTENCE_END = /(?:습니다|입니다|합니다|됩니다|했어요|했죠|거예요|거죠|하세요|해요|보세요|라고요|니까요|하는데|되는데|나오는데|이유|사례|풍경|집중력|코미디|코미티|이야기|부분|성취|작품)\s*$/;

  function clean(value) {
    return String(value == null ? '' : value).replace(/[\u200b-\u200f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  }
  function typeOf(value) {
    var s = String(value || ''), types = [];
    if (/(?:📚|📖|책|도서|서적|소설|에세이|저자|작가|\bbooks?\b|\bauthor\b)/i.test(s)) types.push('book');
    if (/(?:영화|감독|\bmovies?\b|\bfilms?\b|\bdirector\b)/i.test(s)) types.push('movie');
    if (/(?:음반|앨범|아티스트|\balbums?\b|\bartist\b)/i.test(s)) types.push('album');
    return types.length === 1 ? types[0] : '';
  }
  function seconds(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (!/^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?$/.test(String(value))) return null;
    return String(value).replace(',', '.').split(':').reduce(function (n, part) { return n * 60 + Number(part); }, 0);
  }
  function timestamp(value) {
    if (value == null) return '';
    var n = Math.max(0, Math.floor(value));
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  }
  function segmentsOf(input) {
    if (Array.isArray(input)) return input.slice(0, 6000).map(function (s) {
      return {text: clean(s && s.text), start: seconds(s && s.start)};
    }).filter(function (s) { return s.text; });
    var text = String(input || '').slice(0, MAX_TEXT).replace(/\r\n?/g, '\n');
    // Bracketed timestamps can be inline; plain timestamps must start a line.
    var markers = /\[(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]\s*|(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s+/g;
    var out = [], last = 0, start = null, m;
    while ((m = markers.exec(text))) {
      var before = clean(text.slice(last, m.index));
      if (before) out.push({text: before, start: start});
      start = seconds(m[1] || m[2]); last = markers.lastIndex;
    }
    var tail = clean(text.slice(last));
    if (tail) out.push({text: tail, start: start});
    return out;
  }
  function validShort(value) {
    if (value.length < 2 || value.length > 32 || value.split(/\s+/).length > 6) return false;
    if (!/[\p{L}]/u.test(value) || UNSAFE.test(value) || NON_TITLE.test(value) || SENTENCE_END.test(value) || NEGATIVE.test(value)) return false;
    if (/^(?:그|이|저|그런|이런|오늘|이번|정말|아주|너무|그리고|하지만|그래서|왜냐하면|첫\s*번째|두\s*번째|마지막)\s/.test(value)) return false;
    if (/(?:벗어날|따라가는|조롱하는|존재하는|장악한|되돌아보는|무기가\s*된|라고\s*하는|이라고\s*하는|일\s*수\s*있는)/.test(value)) return false;
    if (/^(?:책|도서|영화|음반|앨범|작품|제목|소개|추천|추천작|모음|목록|리스트|만점|book|movie|film|album)$/i.test(value)) return false;
    if (/\s(?:때문|것|거|수|뿐)(?:\s|$)/.test(value)) return false;
    return true;
  }
  function titleKey(value) { return clean(value).normalize('NFKC').toLowerCase().replace(/[\s《》〈〉『』「」\[\]“”"'.,!?·:：-]/g, ''); }

  function extractYouTubeWorkQueries(input, options) {
    input = input || {}; options = options || {};
    var title = clean(input.title).slice(0, 300), description = String(input.description || '').slice(0, MAX_TEXT);
    var baseExtract = options.extractLinkWorkQueries || root.extractLinkWorkQueries;
    var works = [], seen = new Map(), maxQueries = Math.min(MAX_QUERIES, Math.max(1, Number(options.maxQueries) || MAX_QUERIES));
    function add(query, source, start, evidence) {
      var value = clean(query.title).replace(/^[《〈『「\[“"]+|[》〉』」\]”"]+$/g, '').trim();
      if (!value || value.length > 100 || UNSAFE.test(value) || NEGATIVE.test(evidence || query.evidence || '')) return;
      var type = ['book', 'movie', 'album'].indexOf(query.type) >= 0 ? query.type : '';
      var key = type + ':' + titleKey(value);
      if (seen.has(key) || works.length >= maxQueries) return;
      var narration = source === 'transcript';
      var item = {
        title: value, creator: clean(query.creator).slice(0, 60), type: type,
        evidence: clean(evidence || query.evidence || value).slice(0, 240),
        confidence: narration ? 'possible' : query.confidence === 'explicit' ? 'explicit' : 'possible',
        source: source, timestampSeconds: start == null ? null : start,
        requiresReview: narration || query.confidence !== 'explicit'
      };
      seen.set(key, item); works.push(item);
    }
    // Description/title retain their deliberate punctuation and list structure.
    if (typeof baseExtract === 'function') {
      baseExtract(description, {pageTitle: title}).forEach(function (q) { add(q, 'description', null); });
      baseExtract(title, {pageTitle: title}).forEach(function (q) { add(q, 'title', null); });
    }

    var segments = segmentsOf(input.transcript), joined = '', offsets = [];
    segments.forEach(function (s) {
      if (joined.length >= MAX_TEXT) return;
      if (joined) joined += ' ';
      offsets.push({offset: joined.length, start: s.start, text: s.text});
      joined += s.text.slice(0, MAX_TEXT - joined.length);
    });
    function segmentAt(offset) {
      var current = offsets[0] || {start: null, text: ''};
      for (var i = 0; i < offsets.length && offsets[i].offset <= offset; i++) current = offsets[i];
      return current;
    }
    function propose(value, type, offset, sentence) {
      value = clean(value).replace(/^(?:제?\s*\d+\s*[.)]|[-•])\s*/, '').trim();
      if (!validShort(value)) return;
      var segment = segmentAt(offset), time = timestamp(segment.start);
      add({title: value, creator: '', type: type}, 'transcript', segment.start, (time ? '[' + time + '] ' : '') + sentence);
    }

    // Quoted titles are usable even in a normal interview. Feed whole sentences,
    // not every timestamp cue, to avoid treating ASR cue boundaries as titles.
    if (typeof baseExtract === 'function') {
      var quoted = /《([^《》]{2,100})》|〈([^〈〉]{2,100})〉|『([^『』]{2,100})』|「([^「」]{2,100})」/g, qmatch;
      while ((qmatch = quoted.exec(joined))) {
        var a = Math.max(joined.lastIndexOf('.', qmatch.index), joined.lastIndexOf('!', qmatch.index), joined.lastIndexOf('?', qmatch.index)) + 1;
        var ending = joined.slice(qmatch.index + qmatch[0].length).search(/[.!?](?:\s|$)/);
        var b = ending < 0 ? Math.min(joined.length, qmatch.index + qmatch[0].length + 120) : qmatch.index + qmatch[0].length + ending + 1;
        var local = joined.slice(a, b).trim(), wanted = titleKey(qmatch.slice(1).find(function (v) { return v != null; }));
        var segment = segmentAt(qmatch.index);
        baseExtract(local, {pageTitle: title}).filter(function (q) { return titleKey(q.title) === wanted; }).forEach(function (q) {
          var time = timestamp(segment.start);
          add(q, 'transcript', segment.start, (time ? '[' + time + '] ' : '') + local);
        });
      }
    }

    // Explicit labels remain useful when the surrounding video is not a list.
    var labelRE = /(?:^|[.!?]\s+)(책|도서|영화|음반|앨범)\s*[:：]\s*([^.!?]+)(?=[.!?]|$)/g, lm;
    while ((lm = labelRE.exec(joined))) {
      propose(lm[2], typeOf(lm[1]), lm.index, clean(lm[0]));
    }

    // Optional short punctuated entries only in a clear recommendation list.
    // Disabled by default: sentence boundaries alone cannot prove a work title.
    // No guessed spelling repairs: catalogue matching or the user must resolve ASR.
    var intro = joined.slice(0, 180), mediaType = typeOf(title) || typeOf(intro);
    var isList = mediaType && !NEGATIVE.test(title) && (LIST_CONTEXT.test(title) || LIST_CONTEXT.test(intro));
    if (isList && options.allowSpokenListItems === true) {
      var sentenceRE = /[^.!?]+(?:[.!?]+|$)/g, sm;
      while ((sm = sentenceRE.exec(joined))) {
        var raw = sm[0], sentence = clean(raw.replace(/[.!?]+$/, ''));
        var offset = sm.index + raw.search(/\S/);
        if (UNSAFE.test(sentence) || NEGATIVE.test(sentence)) continue;
        // A spoken introduction often ends with a comma before the first title.
        var comma = sentence.lastIndexOf(',');
        if (comma >= 0 && LIST_CONTEXT.test(sentence.slice(0, comma)) && typeOf(sentence.slice(0, comma))) {
          propose(sentence.slice(comma + 1), mediaType, offset + comma + 1, sentence);
        } else if (!/[《〈『「》〉』」]/.test(sentence)) {
          var labeled = sentence.match(/^(책|도서|영화|음반|앨범)\s*[:：]\s*(.+)$/);
          propose(labeled ? labeled[2] : sentence, labeled ? typeOf(labeled[1]) : mediaType, offset, sentence);
        }
      }
    }
    return works;
  }
  root.extractYouTubeWorkQueries = extractYouTubeWorkQueries;
  if (typeof module !== 'undefined' && module.exports) module.exports = {extractYouTubeWorkQueries: extractYouTubeWorkQueries};
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* original script block 14 */
function youtubeImportVideoID(value){
 try{
  const u=new URL(value),host=u.hostname.toLowerCase();
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return '';
  if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host))return '';
  const id=host==='youtu.be'?u.pathname.slice(1).split('/')[0]:u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
  return /^[\w-]{11}$/.test(id||'')?id:'';
 }catch{return ''}
}
function validVideoTimestamp(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=86400?Math.floor(value):null}
function videoTimestampLabel(value){const t=validVideoTimestamp(value);if(t===null)return '';const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0')}
function videoEvidenceLink(url,value){const id=youtubeImportVideoID(url),time=validVideoTimestamp(value);return id&&time!==null?'<a href="https://www.youtube.com/watch?v='+id+'&amp;t='+time+'s" target="_blank" rel="noopener noreferrer">영상 '+videoTimestampLabel(time)+'에서 확인 ↗</a>':''}
function extractYouTubeDescriptionQueries(text,title){
 const clean=String(text||'').slice(0,60000).normalize('NFKC').replace(/https?:\/\/[^\s<>]+/gi,'').split('\n').filter(line=>!/^\s*(?:채널\s*구독|구독\s*하기|subscribe)\b/i.test(line)).join('\n');
 const chapterPattern=/^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+(.+)$/;
 const lines=clean.split('\n'), prose=lines.filter(line=>!chapterPattern.test(line)).join('\n');
 const queries=extractLinkWorkQueries(prose,{pageTitle:title});
 const context=String(title||'')+'\n'+prose.split('\n').slice(0,12).join('\n');
 const types=[[/책|도서|소설|세계문학|문학전집|에세이|\bbooks?\b/i,'book'],[/영화|\bmovies?\b|\bfilms?\b/i,'movie'],[/음반|앨범|\balbums?\b/i,'album']].filter(([pattern])=>pattern.test(context)).map(([,type])=>type);
 const type=types.length===1?types[0]:'';
 const creator=type==='book'?(context.match(/(?:^|[\s#])([가-힣A-Za-z][가-힣A-Za-z .·]{1,30}?)\s*(?:작가|저자)(?:\s|의|:)/)?.[1]||'').trim():'';
 const bare=[];
 for(const line of lines){
  const match=line.match(chapterPattern);if(!match)continue;
  const parts=match[1].split(':').map(Number);if(parts.slice(1).some(n=>n>59))continue;
  const name=match[2].trim(), timestampSeconds=parts.reduce((n,v)=>n*60+v,0);
  // Process delimited/labelled titles independently: tournament labels are not titles.
  if(/[《〈『「\[<]/.test(name)||/^(?:책|도서|소설|영화|음반|앨범)\s*[:：]/.test(name)){
   const explicit=extractLinkWorkQueries(name,{pageTitle:type?({book:'책 추천',movie:'영화 추천',album:'앨범 추천'}[type]):title});
   const credited=type==='book'&&name.match(/^(?:\d+강\s+[A-Z]조|중간광고)\s+([가-힣A-Za-z· .]{2,60}?)\s*[『《]/i);
   for(const q of explicit)queries.push({...q,creator:q.creator||(credited?credited[1].trim():''),evidence:line.trim(),timestampSeconds});
   continue;
  }
  if(!type||!/추천|모음|몰아보기|리스트|목록|\bpicks?\b|recommend|collection/i.test(context))continue;
  // Ordinals and programme segments mean there is no title in this chapter.
  if(name.length<2||name.length>100||/^(?:인트로|인사|소개|오프닝|광고|중간광고|협찬|공지|구독|마무리|엔딩|아웃트로|하이라이트|하이하이|오늘의?\s*주제|intro|outro|sponsor|opening|ending)(?:\s|$|[:：])/i.test(name)||
   /^(?:(?:첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열|\d+)\s*번째|제\s*\d+)\s*(?:책|소설|작품|영화|음반|앨범|추천)(?:\s|$)/.test(name)||
   /^(?:\d+강|[A-Z]조|결승|준결승)(?:\s|$)|맞대결|명문장\s*대결|명장면\s*대결|밸런스\s*게임|독후감|읽는\s*이유|이전.*지시|시스템.*프롬프트|ignore.*instructions|https?:|[<>]/i.test(name))continue;
  bare.push({title:name,creator,type,evidence:line.trim(),timestampSeconds});
 }
 if(bare.length>=2)queries.push(...bare);
 const seen=new Set();
 return queries.filter(q=>{const key=q.type+':'+q.title.normalize('NFKC').toLowerCase().replace(/\s/g,'');if(seen.has(key))return false;seen.add(key);return true}).slice(0,30).map(q=>({...q,source:'description',requiresReview:true,confidence:'possible'}));
}

async function readYouTubeDescription(url,signal){
 if(!cloudSession?.access_token)throw Error('유튜브 내용을 가져오려면 '+APP_BRAND.ko+'에 다시 로그인해주세요.');
 const res=await fetch(SUPABASE_URL+'/functions/v1/youtube-import',{method:'POST',signal,credentials:'omit',referrerPolicy:'no-referrer',headers:cloudAuthHeaders(cloudSession.access_token),body:JSON.stringify({url,mode:'description'})});
 if(res.status===401)throw Error(APP_BRAND.ko+' 로그인이 만료됐어요. 다시 로그인해주세요.');
 if(res.status===429)throw Error('가져오기 요청이 많아요. 잠시 뒤 다시 시도해주세요.');
 if(!res.ok){
  if(res.status===400||res.status===404)throw Error('설명란 읽기 서버를 업데이트해야 해요. youtube-import 함수를 최신 코드로 다시 배포해주세요.');
  throw Error('유튜브 설명란을 불러오지 못했어요. 서버의 YouTube Data API 연결을 확인하거나 설명란을 직접 붙여넣어주세요.');
 }
 let raw='',size=0;const reader=res.body?.getReader();
 if(reader){const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>200000){await reader.cancel();throw Error('설명란 응답이 너무 커요. 추천 부분을 직접 붙여넣어주세요.')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}}else raw=await res.text();
 let data;try{data=JSON.parse(raw)}catch{throw Error('설명란 서버의 응답을 확인하지 못했어요. 잠시 뒤 다시 시도해주세요.')}
 if(!data.ok||data.source?.url!==url||typeof data.description?.text!=='string')throw Error('설명란을 읽지 못했어요. 작품이 없는 경우와 달라 영상 분석을 시작하지 않았어요. 설명란을 직접 붙여넣거나 서버 연결을 확인해주세요.');
 const title=String(data.description.title||'유튜브 설명란').slice(0,200),queries=extractYouTubeDescriptionQueries(data.description.text,title);
 return {title,queries,truncated:!!data.description.truncated};
}

async function readYouTubeImport(url,signal){
 const id=youtubeImportVideoID(url);
 if(!id)throw Error('유튜브 영상의 공유 링크를 넣어주세요. 채널이나 재생목록 링크는 사용할 수 없어요.');
 if(!cloudSession?.access_token)throw Error('유튜브 영상을 분석하려면 '+APP_BRAND.ko+'에 다시 로그인해주세요. 본문·자막 붙여넣기는 바로 사용할 수 있어요.');
 const requestURL='https://www.youtube.com/watch?v='+id;
 const res=await fetch(SUPABASE_URL+'/functions/v1/youtube-import',{
  method:'POST',signal,credentials:'omit',referrerPolicy:'no-referrer',
  headers:cloudAuthHeaders(cloudSession.access_token),body:JSON.stringify({url:requestURL})
 });
 let raw='',bytes=0;const reader=res.body?.getReader();
 if(reader){const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>300000){await reader.cancel();throw Error('영상 분석 결과를 읽지 못했어요. 잠시 뒤 다시 시도해주세요.')}raw+=decoder.decode(part.value,{stream:true})}raw+=decoder.decode()}
 else raw=await res.text();
 let data;try{data=JSON.parse(raw)}catch{throw Error('영상 분석 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요.')}
 if(!res.ok||data?.ok!==true){
  const code=data?.error?.code;
  if(res.status===404||code==='CONFIGURATION_REQUIRED')throw Error('영상 분석 서버 연결이 아직 완료되지 않았어요. 연결 후 다시 시도하거나 본문·자막을 붙여넣어주세요.');
  if(res.status===401||code==='AUTH_REQUIRED')throw Error('로그인이 만료되었어요. '+APP_BRAND.ko+'에 다시 로그인한 뒤 시도해주세요.');
  if(res.status===429)throw Error('영상 분석 요청이 많아요. 잠시 뒤 다시 시도해주세요.');
  if(['VIDEO_UNAVAILABLE','UNSUPPORTED_VIDEO','NO_VIDEO_ACCESS'].includes(code))throw Error('이 영상을 읽을 수 없어요. 공개 영상을 사용하거나 본문·자막을 붙여넣어주세요.');
  if(res.status===504||code==='TIMEOUT')throw Error('영상을 분석하는 데 시간이 오래 걸려요. 잠시 뒤 다시 시도하거나 본문·자막을 붙여넣어주세요.');
  throw Error('영상 분석을 완료하지 못했어요. 잠시 뒤 다시 시도하거나 본문·자막을 붙여넣어주세요.');
 }
 if(youtubeImportVideoID(data.source?.url)!==id||!Array.isArray(data.queries)||data.queries.length>30)throw Error('영상 분석 결과가 올바르지 않아요. 다시 시도해주세요.');
 const seen=new Set(),queries=[];
 for(const item of data.queries){
  if(!item||!['book','movie','album'].includes(item.type)||typeof item.title!=='string'||typeof item.evidence!=='string')continue;
  const title=item.title.trim(),evidence=item.evidence.trim();
  if(!title||title.length>200||!evidence||evidence.length>600)continue;
  const key=item.type+'|'+title.normalize('NFKC').toLowerCase().replace(/[\s.,!?·:：-]/g,'');if(seen.has(key))continue;seen.add(key);
  const q={title,creator:typeof item.creator==='string'?item.creator.trim().slice(0,100):'',type:item.type,evidence,confidence:'possible',requiresReview:true,source:'video'};
  const timestamp=validVideoTimestamp(item.timestampSeconds);if(timestamp!==null)q.timestampSeconds=timestamp;
  queries.push(q);
 }
 if(data.queries.length&&!queries.length)throw Error('확인할 수 있는 작품 정보가 없어요. 본문·자막을 붙여넣어 다시 찾아주세요.');
 return {title:String(data.source?.title||'YouTube 영상').slice(0,200),queries,notice:typeof data.analysis?.notice==='string'?data.analysis.notice.slice(0,300):'',method:'video'};
}

/* original script block 15 */
// Public URL reading is separate from catalog matching; page text is always data.
let linkImportSession=null;
const LINK_IMPORT_TEXT_LIMIT=60000;
function normalizeImportURL(value){
 const raw=String(value||'').trim();if(!raw)return '';
 if(raw.length>4096)throw Error('링크가 너무 길어요. 게시글이나 영상의 공유 링크를 사용해주세요.');
 let u;try{u=new URL(raw)}catch{throw Error('https://로 시작하는 올바른 링크를 입력해주세요.')}
 const host=u.hostname.toLowerCase();
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!host.includes('.')||host.includes(':')||/^\d+(?:\.\d+){3}$/.test(host)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)||[...u.searchParams.keys()].some(k=>/^(?:access_token|token|auth|authorization|password|secret|signature|key|api_key)$/i.test(k)))throw Error('공개된 게시글 링크를 사용해주세요. 비공개 글은 본문을 붙여넣어 가져올 수 있어요.');
 u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|igsh|si|feature)$/i.test(k))u.searchParams.delete(k);
 if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host)){
  const id=host==='youtu.be'?u.pathname.slice(1).split('/')[0]:u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
  if(id&&/^[\w-]{11}$/.test(id))return 'https://www.youtube.com/watch?v='+id;
  throw Error('유튜브 영상의 공유 링크를 넣어주세요. 채널이나 재생목록 링크는 사용할 수 없어요.');
 }
 if(['instagram.com','www.instagram.com','m.instagram.com'].includes(host)){
  const match=u.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]{5,64})\/?$/);
  if(u.protocol!=='https:'||host==='m.instagram.com'||!match)throw Error('인스타그램 게시물의 https 링크를 확인해주세요.');
  return 'https://www.instagram.com/'+match[1]+'/'+match[2]+'/';
 }
 return u.href;
}
function normalizeLinkSources(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set(),out=[];
 for(const item of raw){try{const url=normalizeImportURL(item?.url);if(!url||seen.has(url))continue;seen.add(url);const entry={url,title:String(item?.title||'').slice(0,200)};const timestamp=validVideoTimestamp(item?.timestampSeconds);if(youtubeImportVideoID(url)&&timestamp!==null)entry.timestampSeconds=timestamp;out.push(entry);if(out.length===20)break}catch{}}
 return out;
}
function renderLinkSources(c){
 const sources=normalizeLinkSources(c.linkSources);if(!sources.length)return '';
 return '<div class="detail-link-sources"><h3>이 작품을 만난 곳</h3>'+sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title||new URL(s.url).hostname)+' ↗</a>'+videoEvidenceLink(s.url,s.timestampSeconds)).join('')+'</div>';
}
function cancelLinkImport(){if(linkImportSession){linkImportSession.controller?.abort();linkImportSession.run++;linkImportSession=null}}
function linkImportOwner(){return (cloudSession?.user?.id||'local')+':'+authSession.signedIn}
function linkImportCurrent(session,run){return linkImportSession===session&&session.run===run&&modal==='link'&&session.owner===linkImportOwner()&&authRoute==='app'}
function openLinkImport(){
 cancelLinkImport();linkImportSession={owner:linkImportOwner(),run:0,url:'',text:'',pageTitle:'',rows:[],error:'',stage:'input',controller:null};renderLinkImportInput();
}
function syncLinkImport(){if(linkImportSession&&(authRoute!=='app'||linkImportSession.owner!==linkImportOwner())){cancelLinkImport();if(modal==='link')closeModal()}}
function rememberLinkImportInput(){const s=linkImportSession;if(!s)return;s.url=$('linkImportURL')?.value.trim()??s.url;s.text=$('linkImportText')?.value??s.text}
function renderLinkImportInput(message=''){
 const s=linkImportSession;if(!s)return;s.stage='input';s.error=message;
 const instagramFallback=!!message&&s.instagramReadFailed;
 const readPreview=message&&s.analyzedText?'<details class="link-import-paste"><summary>불러온 본문 확인</summary><p class="link-import-help">제목이 포함되어 있는지 확인해주세요. 필요한 부분을 아래 입력란에 붙여넣어 다시 찾을 수 있어요.</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit">'+esc(s.analyzedText)+'</pre></details>':'';
 const fallback=instagramFallback?'<p class="link-import-help">글에 제목이 있다면 본문을 붙여넣고, 사진이나 릴스 화면에 있다면 제목이 보이는 캡처를 가져와주세요. 원본 링크는 출처로 함께 보관해요.</p><div class="link-import-alternatives">'+button('본문 붙여넣기','linkImportPaste','textbtn')+button('사진·캡처 가져오기','linkImportPhoto','textbtn')+'</div>':'';
 showModal('링크에서 가져오기','<p class="link-import-intro">추천 글 속 책과 영화를 찾아 모아드려요.<br>찾은 작품을 확인한 뒤 한 번에 저장할 수 있어요.</p><form id="linkImportForm" class="link-import-input"><label for="linkImportURL">게시글·영상 링크</label><input id="linkImportURL" type="url" maxlength="4096" placeholder="https://" value="'+esc(s.url)+'" autocomplete="off"><p class="link-import-help">인스타그램 게시글이나 유튜브 영상의 공유 링크를 붙여넣어주세요.</p><div id="linkImportError" class="link-import-error" role="status">'+esc(message)+fallback+'</div>'+readPreview+'<details class="link-import-paste" '+(message||s.text?'open':'')+'><summary>본문·설명·자막 직접 붙여넣기</summary><label class="sr-only" for="linkImportText">추천 내용</label><textarea id="linkImportText" maxlength="'+LINK_IMPORT_TEXT_LIMIT+'" placeholder="게시글 본문이나 영상 설명·자막에서 추천 내용을 복사해 붙여넣어주세요.">'+esc(s.text)+'</textarea><p class="link-import-help">본문이 있으면 링크를 읽지 않고 붙여넣은 내용에서 찾아요. 링크 없이도 사용할 수 있어요.</p></details><button type="submit" class="primary">추천 작품 찾기</button></form><div class="link-import-alternatives">'+button('추천 장면을 사진으로 가져오기','linkImportPhoto','textbtn')+button('작품 직접 입력','linkImportManual','textbtn')+'</div><p class="link-import-help">유튜브는 설명란에서 먼저 찾고, 작품명이 없으면 영상의 음성·화면을 분석해요. 인스타그램 사진 속 작품은 사진으로 가져와주세요.</p><details class="link-import-paste"><summary>링크 읽기 안내</summary><p class="link-import-help">유튜브 설명란은 '+esc(APP_BRAND.ko)+' 서버에서 먼저 읽고, 영상 분석이 필요할 때만 링크를 Google Gemini에 전달해요. 인스타그램은 '+esc(APP_BRAND.ko)+' 서버에서 공개 본문을 읽고, 다른 공개 페이지는 Jina Reader로 읽어요. 외부 분석 서비스에 로그인 정보와 나의 기록은 보내지 않아요. 본문을 붙여넣으면 외부 영상 분석 없이 제목을 찾아요.</p></details>','link');
}
function renderLinkImportLoading(label){
 const s=linkImportSession;if(!s)return;s.stage='loading';
 showModal('추천 작품 찾는 중','<div class="link-import-loading"><span class="link-import-spinner" aria-hidden="true"></span><strong>소개된 작품을 찾고 있어요</strong><p class="link-import-progress" id="linkImportProgress" role="status" aria-live="polite">'+esc(label)+'</p></div>'+button('취소하고 돌아가기','linkImportStop','textbtn'),'link');
}
async function readInstagramImportPage(url,signal){
 if(!cloudSession?.access_token)throw Error('인스타그램 본문을 읽으려면 '+APP_BRAND.ko+'에 다시 로그인해주세요.');
 const res=await fetch(SUPABASE_URL+'/functions/v1/instagram-import',{method:'POST',signal,credentials:'omit',referrerPolicy:'no-referrer',headers:cloudAuthHeaders(cloudSession.access_token),body:JSON.stringify({url})});
 if(!res.ok){
  if(res.status===401)throw Error(APP_BRAND.ko+' 로그인이 만료됐어요. 다시 로그인해주세요.');
  if(res.status===404||res.status===503)throw Error('인스타그램 본문 읽기 서버가 아직 연결되지 않았어요. 연결 후 다시 시도해주세요.');
  if(res.status===429)throw Error('본문 읽기 요청이 많아요. 잠시 뒤 다시 시도해주세요.');
  let code='';try{code=(await res.json())?.error?.code||''}catch{}
  const messages={SOURCE_RATE_LIMITED:'인스타그램이 잠시 요청을 제한하고 있어요. 조금 뒤 다시 시도하거나 본문을 붙여넣어주세요.',SOURCE_ACCESS_RESTRICTED:'인스타그램이 '+APP_BRAND.ko+' 서버의 본문 읽기를 제한하고 있어요. 게시글 본문이나 캡처를 가져와주세요.',SOURCE_REDIRECT:'인스타그램이 게시글 대신 다른 화면으로 연결했어요. 게시글 본문이나 캡처를 가져와주세요.',SOURCE_LOGIN_REQUIRED:'인스타그램이 로그인 화면을 보여줘 본문을 읽지 못했어요. 게시글 본문이나 캡처를 가져와주세요.',TIMED_OUT:'인스타그램 응답이 늦어지고 있어요. 잠시 뒤 다시 시도해주세요.'};
  throw Error(messages[code]||'인스타그램에서 이 게시글의 공개 본문을 확인하지 못했어요. 본문이나 캡처를 가져와 이어서 작품을 찾을 수 있어요.');
 }
 const reader=res.body?.getReader();let raw='';
 if(reader){const decoder=new TextDecoder();let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>200000){await reader.cancel();throw Error('본문이 너무 길어요. 추천 부분을 복사해 붙여넣어주세요.')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}}
 else raw=await res.text();
 let data;try{data=JSON.parse(raw)}catch{throw Error('게시글 본문을 읽지 못했어요. 잠시 뒤 다시 시도해주세요.')}
 if(!data.ok||normalizeImportURL(data.source?.url||'')!==url||typeof data.text!=='string'||data.text.length<3||data.text.length>30000)throw Error('게시글 본문을 확인하지 못했어요. 본문이나 사진을 가져와주세요.');
 return {title:String(data.title||'Instagram 게시글').slice(0,200),text:data.text.slice(0,LINK_IMPORT_TEXT_LIMIT),truncated:!!data.truncated||data.text.length>LINK_IMPORT_TEXT_LIMIT};
}
async function readLinkImportPage(url,signal){
 if(/(^|\.)instagram\.com$/.test(new URL(url).hostname))return readInstagramImportPage(url,signal);
 const youtube=new URL(url).hostname==='www.youtube.com';
 const headers={Accept:'application/json','X-Timeout':'20','X-Robots-Txt':'*','X-Remove-Selector':'nav,footer,script,style,noscript','X-Retain-Images':'none','X-Retain-Media':'none','DNT':'1'};
 // Only the current video's own title/description may supply work candidates.
 // Do not fall back to the full watch page, which contains unrelated videos.
 if(youtube){headers['X-Target-Selector']='#above-the-fold h1, #description-inline-expander';headers['X-Respond-With']='text'}
 const res=await fetch('https://r.jina.ai/'+url,{signal,credentials:'omit',referrerPolicy:'no-referrer',headers});
 if(!res.ok)throw Error(res.status===429?'링크 읽기 요청이 많아요. 잠시 뒤 다시 시도하거나 본문을 붙여넣어주세요.':'이 링크의 공개 본문을 읽지 못했어요. 게시글 본문이나 영상 설명을 붙여넣어주세요.');
 const reader=res.body?.getReader();let raw='';
 if(reader){const decoder=new TextDecoder();let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000){await reader.cancel();throw Error('페이지가 너무 길어요. 추천 부분만 복사해 붙여넣어주세요.')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}
 else raw=await res.text();
 let payload;try{payload=JSON.parse(raw)}catch{throw Error('페이지 내용을 읽지 못했어요. 추천 부분을 복사해 붙여넣어주세요.')}
 const data=payload.data,text=youtube?data?.text:data?.content;
 if(!data||typeof text!=='string'||text.trim().length<20||payload.code>=400)throw Error('공개된 추천 내용을 찾지 못했어요. 게시글 본문이나 영상 설명을 붙여넣어주세요.');
 if(Number(data.httpStatus)>=400||/(?:Target URL returned error (?:40[13]|429|451)|captcha|verify you are human)/i.test(String(data.warning||'')+'\n'+text.slice(0,700)))throw Error('이 페이지는 직접 열어서 확인해야 해요. 추천 내용을 복사해 붙여넣어주세요.');
 return {title:String(data.title||'').slice(0,200),text:text.slice(0,LINK_IMPORT_TEXT_LIMIT),truncated:text.length>LINK_IMPORT_TEXT_LIMIT};
}
function linkWorkKey(c){return c.type+'|'+(c.providerId?c.provider+':'+c.providerId:Model.norm(c.title)+'|'+Model.norm(c.creator)+'|'+ocrEditionKey(c.title))}
async function resolveLinkImportQuery(query,isCurrent){
 if(query?.type==='album')return {query,options:[],picked:0,selected:false,needsReview:false,failed:false,unsupported:true};
 const q={...query,geometryScore:query.confidence==='explicit'||(query.type&&query.evidence)?95:65},pool=new Map();let failed=false;
 const search=async term=>{
  if(!isCurrent())return;
  try{
   let found;
   const cfg={book:[BOOK_SEARCH_ENDPOINT,unwrapBookDocuments,normalizeRemoteBook],movie:[MOVIE_SEARCH_ENDPOINT,unwrapMovies,normalizeRemoteMovie],album:[MUSIC_SEARCH_ENDPOINT,unwrapAlbums,normalizeRemoteAlbum]}[q.type];
   found=cfg?await ocrFetch(cfg[0],term,cfg[1],cfg[2]):await ocrSearchAll(term);
   if(found.errors?.length)failed=true;
   found.forEach((c,rank)=>{if(!['book','movie'].includes(c.type)||q.type&&c.type!==q.type)return;if(q.originalTitle&&c.originalTitle&&Model.norm(q.originalTitle)!==Model.norm(c.originalTitle))return;let match=ocrEvaluateCandidate(c,q,c.ocrSearchRank??rank,q.type);
    // Video analysis can spell a credited creator in another language. Keep
    // exact-title alternatives for explicit user review, never auto-select them.
    if(q.requiresReview&&match.reason==='creator'&&match.title>=.92){const titleOnly=ocrEvaluateCandidate(c,{...q,creator:''},c.ocrSearchRank??rank,q.type);if(titleOnly.valid)match={...titleOnly,creator:null,creatorUnverified:true}}
    if(match.valid&&match.title>=.75){const key=linkWorkKey(c),item={...c,linkMatch:match};if(!pool.has(key)||pool.get(key).linkMatch.score<match.score)pool.set(key,item)}});
  }catch{failed=true}
 };
 await search(q.title);
 if(!isCurrent())return null;
 if(!pool.size&&q.originalTitle)await search(q.originalTitle);
 if(!pool.size&&q.creator)await search(q.title+' '+q.creator);
 const options=[...pool.values()].sort((a,b)=>b.linkMatch.score-a.linkMatch.score).slice(0,4),best=options[0],second=options[1];
 const ambiguous=second&&!ocrSameResolvedWork(best,second)&&best.linkMatch.score-second.linkMatch.score<5;
 const sure=!!best&&!q.requiresReview&&!!q.type&&q.confidence==='explicit'&&best.linkMatch.title>=.92&&best.linkMatch.editionExact&&(best.linkMatch.creator===null||best.linkMatch.creator>=.75)&&!ambiguous;
 return {query,options,picked:0,selected:sure,needsReview:!sure,failed};
}
async function runLinkImport(){
 const s=linkImportSession;if(!s||s.stage==='loading')return;rememberLinkImportInput();
 let url;try{url=normalizeImportURL(s.url)}catch(e){renderLinkImportInput(e.message);return}
 if(!url&&!s.text.trim()){renderLinkImportInput('링크 또는 추천 내용을 입력해주세요.');return}
 s.url=url;s.controller?.abort();s.controller=new AbortController();const run=++s.run,isCurrent=()=>linkImportCurrent(s,run);s.rows=[];s.truncated=false;s.analysisMethod='';s.instagramReadFailed=false;s.analyzedText='';
 const video=!!youtubeImportVideoID(url)&&!s.text.trim();
 renderLinkImportLoading(s.text.trim()?'붙여넣은 내용에서 제목을 찾고 있어요.':video?'영상 설명란에서 추천 작품을 먼저 찾고 있어요.':'공개된 게시글 본문·영상 설명을 읽고 있어요.');
 const timeout=setTimeout(()=>s.controller.abort(),video?140000:25000);
 try{
  let text=s.text.trim(),queries;
  if(video){
   let description=null;
   description=await readYouTubeDescription(url,s.controller.signal);
   if(!isCurrent())return;
   if(description?.queries.length){queries=description.queries;s.pageTitle=description.title;s.analysisMethod='description';s.truncated=description.truncated}
   else{if($('linkImportProgress'))$('linkImportProgress').textContent='설명란에서 작품을 찾지 못해 영상의 음성과 화면을 확인하고 있어요. 1~2분 정도 걸릴 수 있어요.';
    const read=await readYouTubeImport(url,s.controller.signal);if(!isCurrent())return;
    queries=read.queries;s.pageTitle=read.title;s.analysisMethod='video';}

   if(!queries.length){renderLinkImportInput('영상에서 추천하거나 리뷰하는 책·영화를 확인하지 못했어요. 제목이 나온 설명·자막을 붙여넣거나 직접 입력해주세요.');return}
  }else{
   if(!text){let read;try{read=await readLinkImportPage(url,s.controller.signal)}catch(error){if(/(^|\.)instagram\.com$/.test(new URL(url).hostname)){s.instagramReadFailed=true;throw error}throw error}if(!isCurrent())return;text=read.text;s.pageTitle=read.title;s.truncated=read.truncated}
   else s.pageTitle=url?new URL(url).hostname:'붙여넣은 추천 글';
   const transcript=/^(?:\[)?\d{1,2}:\d{2}(?::\d{2})?(?:\])?\s/m.test(text);
   queries=transcript?extractYouTubeWorkQueries({transcript:text},{extractLinkWorkQueries}):extractLinkWorkQueries(text,{pageTitle:s.pageTitle});
   if(transcript)s.analysisMethod='transcript';
  }
  clearTimeout(timeout);if(!isCurrent())return;s.analyzedText=text;
  s.unsupportedCount=queries.filter(q=>q.type==='album').length;queries=queries.filter(q=>q.type!=='album');
  if(!queries.length&&s.unsupportedCount){renderLinkImportInput('음반으로 인식된 작품은 현재 지원하지 않아요. 책이나 영화가 맞다면 작품 직접 입력에서 유형과 제목을 확인해주세요.');return}
  if(!queries.length){renderLinkImportInput('본문은 읽었지만 작품 제목을 구분하지 못했어요. 불러온 본문을 확인하거나 제목이 나온 부분을 붙여넣어주세요. 사진에만 제목이 있다면 사진으로 가져올 수 있어요.');return}
  let done=0;const results=await ocrMapLimit(queries,3,async q=>{if(!isCurrent())return null;const result=await resolveLinkImportQuery(q,isCurrent);done++;if(isCurrent()&&$('linkImportProgress'))$('linkImportProgress').textContent='작품 정보 확인 중 · '+done+' / '+queries.length+'개';return result});
  if(!isCurrent())return;
  const seen=new Set();s.rows=results.filter(Boolean).filter(row=>{if(!row.options.length)return true;const key=linkWorkKey(row.options[0]);if(seen.has(key))return false;seen.add(key);return true});
  s.rows.forEach(row=>{const c=row.options[row.picked],saved=c&&findSavedWork(c);if(saved&&s.url&&saved.saves.some(e=>e.source===s.url))row.selected=false});
  renderLinkImportResults();
 }catch(e){if(isCurrent())renderLinkImportInput(e.name==='AbortError'?(video?'영상을 분석하는 데 시간이 오래 걸려요. 잠시 뒤 다시 시도하거나 설명·자막을 붙여넣어주세요.':'페이지를 읽는 데 시간이 걸리고 있어요. 다시 시도하거나 추천 내용을 붙여넣어주세요.'):e.message||'내용을 불러오지 못했어요. 본문 붙여넣기를 이용해주세요.')}
 finally{clearTimeout(timeout)}
}
function linkImportRowHTML(row,index){
 const c=row.options[row.picked],saved=findSavedWork(c),sameSource=saved&&linkImportSession.url&&saved.saves.some(e=>e.source===linkImportSession.url);
 const status=sameSource?'이미 이 링크에서 저장됨':saved?'저장된 작품 · 출처 추가':row.needsReview?'작품 확인 필요':'작품 정보 일치';
 return '<div class="link-import-result"><div class="link-import-result-top"><label class="link-import-select"><input type="checkbox" data-link-select="'+index+'" '+(row.selected?'checked':'')+' aria-label="'+esc(c.title)+' 저장 선택"></label>'+cover(c)+'<div><div class="link-import-result-title">'+esc(c.title)+'</div><div class="link-import-result-meta">'+esc(c.creator||'제작자 미확인')+(c.releaseDate?' · '+esc(c.releaseDate.slice(0,4)):'')+'</div><span class="link-import-status '+(row.needsReview?'check':'')+'">'+status+'</span></div></div>'+(row.options.length>1?'<select class="link-import-options" data-link-option="'+index+'" aria-label="'+esc(row.query.title)+' 작품 선택">'+row.options.map((v,i)=>'<option value="'+i+'" '+(row.picked===i?'selected':'')+'>'+esc(typeName[v.type]+' · '+v.title+' · '+(v.creator||v.releaseDate?.slice(0,4)||'제작자 미확인'))+'</option>').join('')+'</select>':'')+'<details class="link-import-evidence"><summary>'+(row.query.source==='description'?'설명란에서 찾은 부분':row.query.source==='video'?'영상에서 찾은 부분':row.query.source==='transcript'?'자막에서 찾은 부분':'글에서 찾은 부분')+'</summary><p>'+esc(row.query.evidence||row.query.title)+'</p>'+videoEvidenceLink(linkImportSession.url,row.query.timestampSeconds)+'</details></div>';
}
function renderLinkImportResults(){
 const s=linkImportSession;if(!s)return;s.stage='review';
 const found=s.rows.filter(r=>r.options.length),unmatched=s.rows.filter(r=>!r.options.length),failed=s.rows.some(r=>r.failed);
 const groups=['book','movie'].map(type=>{const indices=s.rows.map((r,i)=>r.options[r.picked]?.type===type?i:-1).filter(i=>i>=0);return indices.length?'<section class="link-import-group"><h3>'+typeName[type]+' '+indices.length+'</h3>'+indices.map(i=>linkImportRowHTML(s.rows[i],i)).join('')+'</section>':''}).join('');
 const source=s.url?'<a class="link-import-source" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.pageTitle||new URL(s.url).hostname)+' ↗</a>':'<p class="link-import-source">붙여넣은 추천 글</p>';
 const manual=unmatched.length?'<details class="link-import-unmatched" '+(!found.length?'open':'')+'><summary>정보 확인이 필요한 제목 '+unmatched.length+'개</summary><p class="link-import-help">검색 정보가 없거나 제목이 모호해요. 글에서 확인한 작품만 직접 추가해주세요.</p>'+s.rows.map((r,i)=>r.options.length?'':'<form class="link-import-manual" data-link-manual="'+i+'"><label for="linkManualTitle'+i+'">제목</label><input id="linkManualTitle'+i+'" name="title" required maxlength="200" value="'+esc(r.query.title)+'"><label for="linkManualType'+i+'">유형</label><select id="linkManualType'+i+'" name="type" required><option value="">유형 선택</option>'+['book','movie'].map(t=>'<option value="'+t+'" '+(r.query.type===t?'selected':'')+'>'+typeName[t]+'</option>').join('')+'</select><label for="linkManualCreator'+i+'">작가·감독 · 선택</label><input id="linkManualCreator'+i+'" name="creator" maxlength="100" value="'+esc(r.query.creator||'')+'"><button class="textbtn" type="submit">확인한 작품으로 추가</button></form>').join('')+'</details>':'';
 showModal('찾은 작품 확인',source+(s.unsupportedCount?'<p class="link-import-help">음반 '+s.unsupportedCount+'개는 제외했어요. 책이나 영화가 맞다면 직접 입력에서 확인해주세요.</p>':'')+'<p class="link-import-summary">'+found.length+'개 작품을 찾았어요. 저장할 작품을 골라주세요.</p>'+(s.analysisMethod==='description'?'<p class="link-import-help">영상 설명란에서 찾은 작품이에요. 작품과 시간 표시를 확인한 뒤 선택해주세요.</p>':s.analysisMethod==='video'?'<p class="link-import-help">영상 분석 결과예요. 작품과 원본 장면을 확인한 뒤 선택해주세요.</p>':'')+(failed?'<p class="link-import-error">일부 검색에 연결하지 못했어요. 누락된 작품은 다시 찾거나 직접 추가할 수 있어요.</p>':'')+(s.truncated?'<p class="link-import-help">긴 글의 앞부분을 확인했어요. 빠진 부분은 본문 붙여넣기로 추가할 수 있어요.</p>':'')+groups+manual+'<div class="link-import-footer">'+button('선택한 작품 저장','linkImportSave','primary','id="linkImportSave"')+button('본문 수정·다시 찾기','linkImportEdit','textbtn')+'</div>','link');updateLinkImportSelection();
}
function updateLinkImportSelection(){const s=linkImportSession,b=$('linkImportSave');if(!s||!b)return;const n=s.rows.filter(r=>r.options.length&&r.selected&&['book','movie'].includes(r.options[r.picked]?.type)).length;b.disabled=n===0;b.textContent=n?'선택한 '+n+'개 저장':'저장할 작품을 선택해주세요'}
function linkImportHash(text){let n=2166136261;for(const c of text){n^=c.codePointAt(0);n=Math.imul(n,16777619)}return (n>>>0).toString(36)}
function saveLinkImport(){
 const s=linkImportSession;if(!s||s.stage!=='review'||s.owner!==linkImportOwner()||authRoute!=='app')return;
 const chosen=s.rows.filter(r=>r.options.length&&r.selected&&['book','movie'].includes(r.options[r.picked]?.type));if(!chosen.length)return;
 const before=Model.clone(state),source=s.url||'붙여넣은 추천 글',request='link-import:'+linkImportHash(s.url||s.analyzedText||s.text);let added=0,updated=0,skipped=0;
 for(const row of chosen){
  const data=row.options[row.picked];let item=findSavedWork(data);
  if(item){
   if(item.saves.some(e=>e.id===request||s.url&&e.source===s.url)){skipped++;continue}
   item.saves.push({id:request,at:Date.now(),source});updated++;
  }else{item=Model.add(state,{...data,source},request);added++}
  if(s.url)item.linkSources=normalizeLinkSources([{url:s.url,title:s.pageTitle,timestampSeconds:row.query.timestampSeconds},...(item.linkSources||[])]);
 }
 state.onboarded=true;
 if(!persist()){state=before;const el=document.createElement('p');el.className='link-import-error';el.setAttribute('role','alert');el.textContent='저장 공간이 부족해 반영하지 못했어요. 기존 기록은 유지했어요.';document.querySelector('.link-import-footer')?.prepend(el);return}
 scrapFlowActive=false;closeModal();render();toast(added+'개 스크랩했어요.'+(updated?' 기존 '+updated+'개에 출처를 추가했어요.':'')+(skipped?' 중복 '+skipped+'개는 건너뛰었어요.':''));
}
document.addEventListener('submit',e=>{
 if(e.target.id==='linkImportForm'){e.preventDefault();void runLinkImport();return}
 const form=e.target.closest('[data-link-manual]');if(!form||!linkImportSession)return;e.preventDefault();
 const index=Number(form.dataset.linkManual),row=linkImportSession.rows[index],values=new FormData(form),type=values.get('type'),title=String(values.get('title')||'').trim();
 if(!row||!['book','movie'].includes(type)||!title)return;
 row.options=[{type,title,creator:String(values.get('creator')||'').trim(),cover:'',source:'직접 확인'}];row.picked=0;row.selected=true;row.needsReview=false;renderLinkImportResults();
});
document.addEventListener('change',e=>{
 const s=linkImportSession;if(!s)return;
 if(e.target.matches('[data-link-select]')){const r=s.rows[Number(e.target.dataset.linkSelect)];if(r)r.selected=e.target.checked;updateLinkImportSelection()}
 if(e.target.matches('[data-link-option]')){const r=s.rows[Number(e.target.dataset.linkOption)],index=Number(e.target.value);if(r?.options[index]){r.picked=index;r.selected=true;r.needsReview=false;renderLinkImportResults()}}
});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,s=linkImportSession;
 if(!s||!a.startsWith('linkImport'))return;
 if(a==='linkImportStop'){s.controller?.abort();s.run++;renderLinkImportInput();return}
 if(a==='linkImportEdit'){renderLinkImportInput();return}
 if(a==='linkImportPaste'){const input=$('linkImportText');if(input){input.closest('details').open=true;input.focus();input.scrollIntoView({block:'nearest',behavior:'smooth'})}return}
 if(a==='linkImportPhoto'){rememberLinkImportInput();let url='';try{url=normalizeImportURL(s.url)}catch{}photoAdd(url?{url,title:s.pageTitle||new URL(url).hostname}:null);return}
 if(a==='linkImportManual'){rememberLinkImportInput();const url=s.url;infoForm(null,url);return}
 if(a==='linkImportSave')saveLinkImport();
});
