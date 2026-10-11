/*
 * 공통 도우미: 아이콘, 글자 이스케이프, 해시, DOM 찾기, 버튼 HTML, 이미지 읽기·내려받기.
 */

const ICON = {
  today: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
  scrap: '<path d="M6 3h12v19l-6-4-6 4z"/>',
  forest: '<path d="m12 2-6 8h3l-5 7h6v5h4v-5h6l-5-7h3z"/>',
  my: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  filter:
    '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  book: '<path d="M3 4h6l3 3 3-3h6v16h-6l-3 2-3-2H3zM12 7v15"/>',
  album: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  movie: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 11h18M7 6l4 5m3-5 4 5M3 6l17-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.4 1.4 0 0 1 .7-2.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z"/><circle cx="8" cy="8" r=".7"/><circle cx="13" cy="7" r=".7"/><circle cx="6" cy="13" r=".7"/>',
  store:
    '<path d="M4 10v11h16V10M3 10l2-7h14l2 7M3 10c1 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0 1 2 3 2 3 0M9 21v-7h6v7"/>',
  share: '<path d="M7 10H4v12h16V10h-3M12 16V2m-5 5 5-5 5 5"/>',
};

function icon(name) {
  return (
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (ICON[name] || ICON.book) +
    "</svg>"
  );
}

const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function hash(s) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}

const $ = (id) => document.getElementById(id);

function now() {
  return Model.today(state.offset);
}

function selected() {
  return Model.get(state, state.selected);
}

function button(text, action, cls = "primary", attrs = "") {
  return (
    '<button type="button" class="' +
    cls +
    '" data-action="' +
    action +
    '" ' +
    attrs +
    ">" +
    text +
    "</button>"
  );
}

function attr(id) {
  return 'data-id="' + esc(id) + '"';
}

async function imageData(file) {
  if (!file) return "";
  if (file.size > 15000000) throw Error("사진은 15MB 이하로 선택해주세요.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url),
      canvas = document.createElement("canvas"),
      scale = Math.min(1, 300 / img.width, 400 / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("이미지를 읽지 못했어요."));
    img.src = src;
  });
}

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// Error text for people: our own messages are Korean and pass through; browser/network errors
// (English, e.g. "Failed to fetch") become a plain Korean line instead of leaking to the screen.
function userMessage(err, fallback) {
  const m = String(err?.message || err || "");
  if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(m))
    return "인터넷 연결을 확인하고 다시 시도해주세요.";
  // Korean but technical (server/HTTP/setup details) also gets the plain fallback.
  if (/HTTP\s*\d|Supabase|JWT|Edge Function|OCR 서버|API/i.test(m)) return fallback;
  return /[가-힣]/.test(m) ? m : fallback;
}

// Empty search results: say "offline" instead of "nothing found" when there is no connection.
function noResultsText() {
  return navigator.onLine
    ? "검색 결과가 없어요."
    : "인터넷에 연결되어 있지 않아요. 연결 후 다시 검색해주세요.";
}

// Korean particles that depend on the last syllable: josa("나무", "을", "를") -> "나무를".
function josa(word, withFinal, withoutFinal) {
  const code = String(word).charCodeAt(String(word).length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? withFinal : withoutFinal);
}

// 으로/로: a final consonant takes 으로, except ㄹ which takes 로 (목련으로, 주목으로, 덤불로, 나무로).
function withRo(word) {
  const code = String(word).charCodeAt(String(word).length - 1) - 0xac00,
    fin = code >= 0 && code <= 11171 ? code % 28 : 0;
  return word + (fin && fin !== 8 ? "으로" : "로");
}

// "올해의 숲" only for the current year; past years read "2025년의 숲".
function yearWord(y) {
  return String(y) === now().slice(0, 4) ? "올해" : y + "년";
}
