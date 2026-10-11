/*
 * 기록하기·다 읽었어요·숲에 심기 순간, 기록/메모 편집.
 */

// 감상 and 메모 are one thing now: an old one-line review becomes a memo on the day the work was finished.
function itemNotesWithReview(c) {
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
  const day = () => (typeof now === "function" ? now() : new Date().toISOString().slice(0, 10));
  const notes = Array.isArray(c.notes)
    ? c.notes
        .filter((n) => n && typeof n.text === "string" && n.text.trim())
        .map((n) => ({
          id: String(n.id || "n" + Math.random().toString(36).slice(2, 10)),
          date: ok(n.date) ? n.date : day(),
          text: String(n.text).trim().slice(0, 4000),
        }))
    : [];
  const review = String(c.review || "").trim();
  if (review && !notes.some((n) => n.text === review))
    notes.push({
      id: "review-" + String(c.id || "").slice(0, 40),
      date: ok(c.completed) ? c.completed : day(),
      text: review.slice(0, 4000),
    });
  return notes;
}

function ratingPrompt(c, advance = false) {
  const finishing = advance && !c.completed,
    done = c.completed && c.completed !== "unknown" ? c.completed : now();
  const cover =
    '<span class="finish-cover is-' +
    c.type +
    '">' +
    (c.cover ? '<img src="' + esc(c.cover) + '" alt="">' : "") +
    "</span>";
  showModal(
    finishing ? (c.type === "movie" ? "다 봤어요" : "다 읽었어요") : "별점",
    '<form id="ratingForm" class="finish-form" data-id="' +
      esc(c.id) +
      '" data-advance="' +
      (advance ? "yes" : "no") +
      '"><div class="finish-head">' +
      cover +
      "<div><span>" +
      (c.completed || finishing ? "FINISHED · " + done.slice(5).replace("-", ".") : "") +
      "</span><strong>" +
      esc(c.title) +
      "</strong></div></div>" +
      '<div class="finish-rating"><span>어땠어요?</span><div class="rating"><div class="rating-half-stars" data-rating-picker></div></div><input type="hidden" id="ratingValue" value="' +
      (c.rating || "") +
      '"><p id="ratingText">' +
      (c.rating ? Number(c.rating).toFixed(1) : "선택 안 함") +
      "</p></div>" +
      '<label class="sr-only" for="finishMemo">메모 남기기 · 선택</label><textarea id="finishMemo" maxlength="4000" placeholder="메모 남기기 · 선택"></textarea>' +
      (finishing
        ? '<label class="finish-date"><span>완료일</span><b id="finishDateText">' +
          finishDateLabel(now()) +
          ' ›</b><input id="finishDate" type="date" max="' +
          now() +
          '" value="' +
          now() +
          '" aria-label="완료일"></label>'
        : "") +
      '<div class="finish-actions"><button class="primary" type="submit">' +
      (finishing
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6A55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2-6 8h3l-5 7h6v5h4v-5h6l-5-7h3z"/></svg>숲에 심기'
        : "별점 저장") +
      "</button>" +
      (c.rating ? button("평점만 지우기", "clearRating", "textbtn", attr(c.id)) : "") +
      "</div></form>",
    "finish",
  );
}

function startExperience(id) {
  const c = get(id);
  if (!c || c.completed || !["book", "movie"].includes(c.type)) return;
  const previousStage = Model.stage(c);
  Model.start(state, id, now());
  state.selected = id;
  view = "today";
  if (!commit()) return;
  if (previousStage === 0) {
    pendingForestArrival = c.id;
    document.querySelector(".growth")?.classList.add("is-growing");
  }
  toast(previousStage === 0 ? "숲에 새싹이 자라기 시작했어요." : "이어가던 경험으로 이동했어요.");
}

function record(id) {
  const c = get(id);
  if (!c || c.completed) return;
  const previousStage = Model.stage(c),
    previousKey = growthKey(c, previousStage);
  if (Model.log(state, id, now())) {
    state.selected = id;
    if (!commit()) return;
    if (previousStage === 0) pendingForestArrival = c.id;
    recordDone(c, previousStage, previousKey);
  } else toast("오늘 기록이 이미 있어요.");
}

// After recording, Today itself plays the moment: the stamp slams down and, when the stage
// changes, the old tree shrinks away while the new one pops up in the same disc.
function recordDone(c, previousStage, previousKey = growthKey(c, previousStage)) {
  const stage = Model.stage(c),
    key = growthKey(c, stage),
    grew = key !== previousKey,
    name = (k) => GROWTH_NAMES[k];
  const josa = (word, a, b) => {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return word + (code >= 0 && code <= 11171 && code % 28 ? a : b);
  };
  // 으로/로: a final consonant takes 으로, except ㄹ which takes 로 (덤불로, 어린 나무로).
  const toward = (word) => {
    const code = word.charCodeAt(word.length - 1) - 0xac00,
      fin = code >= 0 && code <= 11171 ? code % 28 : 0;
    return word + (fin && fin !== 8 ? "으로" : "로");
  };
  const message = grew
    ? josa(name(previousKey), "이", "가") + " " + toward(name(key)) + " 자랐어요."
    : "오늘 기록했어요. 한 칸 더 자랐어요.";
  const stamp = view === "today" ? document.querySelector(".stamp-done .stamp-button") : null;
  if (!stamp) {
    toast(message);
    return;
  }
  stamp.classList.add("is-slam");
  if (grew) {
    const tree = document.querySelector(".today-panel .today-tree");
    if (tree) {
      const prev = tree.cloneNode();
      prev.src = (SONGLIM_TREE_ASSETS[previousKey] || SONGLIM_TREE_ASSETS.young).src;
      prev.alt = "";
      prev.classList.add("is-leaving");
      if (previousStage <= 1) prev.classList.add("is-small");
      tree.classList.add("is-arriving");
      tree.after(prev);
      setTimeout(() => prev.remove(), 1300);
      document.querySelector(".today-panel .today-stage")?.classList.add("is-pop");
    }
  }
  setTimeout(() => toast(message), grew ? 900 : 450);
}

// Planted moment (sticker page, like the share cards): white page, a left-aligned headline, the tree
// as a sticker on a disc in the work's colour with the DONE stamp slammed on and the cover stuck to its
// side, then the work and three tilted stat stickers.
function plantedMoment(c) {
  const done = c.completed && c.completed !== "unknown" ? c.completed : now(),
    month = Number(done.slice(5, 7)),
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const number = Math.max(
    1,
    state.items.filter(
      (x) => x.completed && x.completed !== "unknown" && x.completed.slice(0, 7) === done.slice(0, 7),
    ).length,
  );
  const logs = new Set(c.logs.map((l) => l.date)).size;
  const tree = c.hiddenTree ? bmTreeName("mystery-" + c.hiddenTree) : contentSpecies(c)?.name || "나무";
  const spark = (cls, x, y, s, d) =>
    '<i class="pl-spark ' +
    cls +
    '" style="left:' +
    x +
    "%;top:" +
    y +
    "%;width:" +
    s +
    "px;height:" +
    s +
    "px;animation-delay:" +
    d +
    's"></i>';
  const pill = (label, value, cls, rot) =>
    '<span class="pl-pill ' + cls + '" style="--rot:' + rot + 'deg">' + label + "<b>" + value + "</b></span>";
  const eul = ((code) => {
    const fin = code >= 0 && code <= 11171 ? code % 28 : 0;
    return fin && fin !== 8 ? "으로" : "로";
  })(tree.charCodeAt(tree.length - 1) - 0xac00);
  showModal(
    "숲에 한 그루 더 자랐어요",
    '<div class="pl-page" data-type="' +
      c.type +
      '">' +
      '<p class="pl-kicker">' +
      months[month - 1] +
      " FOREST · NO." +
      number +
      '</p><h3 class="pl-title" aria-hidden="true">숲에 한 그루<br>더 자랐어요</h3>' +
      '<div class="pl-confetti" aria-hidden="true">' +
      Array.from({ length: 26 }, (_, i) => {
        const r = (k) => (((Math.sin((i + 1) * k) * 10000) % 1) + 1) % 1;
        return (
          '<i style="--x:' +
          (4 + r(12.9) * 92).toFixed(1) +
          "%;--d:" +
          (r(78.2) * 2.4).toFixed(2) +
          "s;--t:" +
          (2.6 + r(39.4) * 1.6).toFixed(2) +
          "s;--r:" +
          Math.round(r(7.1) * 360) +
          "deg;--s:" +
          (r(5.3) * 60 - 30).toFixed(0) +
          "px;--c:" +
          ["#F2B84B", "#6CC092", "#E85A47", "#CBE4FF", "#F9D9C8"][i % 5] +
          '"></i>'
        );
      }).join("") +
      "</div>" +
      '<div class="pl-stage"><i class="pl-disc" aria-hidden="true"></i>' +
      stickerTree(c, 3, "pl-tree") +
      '<div class="planted-stamp-real pl-stamp" aria-hidden="true">' +
      stampSVG(c, true) +
      "</div>" +
      '<span class="pl-cover">' +
      (c.cover ? '<img src="' + esc(c.cover) + '" alt="" decoding="async">' : "") +
      "</span></div>" +
      '<div class="pl-copy"><strong>' +
      esc(c.title) +
      "</strong><span>" +
      esc(tree) +
      eul +
      " 자랐어요</span></div>" +
      '<div class="pl-pills">' +
      pill("이달의 나무 ", number + "번째", "is-butter", -5) +
      pill("함께한 기록 ", (logs || 1) + "일", "is-mint", 4) +
      (validRating(c.rating) ? pill("★ ", Number(c.rating).toFixed(1), "is-coral", -3) : "") +
      "</div></div>" +
      '<div class="planted-actions">' +
      button(month + "월의 숲 보기", "completionForest", "primary", attr(c.id)) +
      "</div>",
    "planted",
  );
}

function complete(id) {
  const c = get(id);
  if (!c || c.completed) return;
  ratingPrompt(c, true);
}

function editLog(id, logId) {
  const c = get(id),
    l = c?.logs.find((l) => l.id === logId);
  if (!l) return;
  showModal(
    "경험 기록 수정",
    '<form id="logForm" data-id="' +
      id +
      '" data-log="' +
      logId +
      '"><label for="logDate">기록 날짜</label><input id="logDate" type="date" max="' +
      now() +
      '" required value="' +
      l.date +
      '">' +
      (c.type === "book"
        ? '<label for="logPage">마지막으로 읽은 쪽 · 선택</label><input id="logPage" type="number" min="0" max="100000" value="' +
          esc(l.page) +
          '">'
        : "") +
      '<label for="logMemo">메모 · 선택</label><textarea id="logMemo" maxlength="4000">' +
      esc(l.memo) +
      '</textarea><div id="formError" class="form-error" role="alert"></div><button type="submit" class="primary">수정 저장</button>' +
      button("이 기록 삭제", "deleteLog", "textbtn danger", attr(id) + ' data-log="' + logId + '"') +
      "</form>",
    "log",
  );
}

function themes() {
  openCollection("floors");
}

// Free memos on a work, not tied to a record day.
function editNote(id, noteId = "") {
  const c = get(id);
  if (!c) return;
  const n = (c.notes || []).find((x) => x.id === noteId);
  showModal(
    n ? "메모 수정" : "메모 남기기",
    '<form id="noteForm" data-id="' +
      esc(id) +
      '" data-note="' +
      esc(noteId) +
      '"><label for="noteText" class="sr-only">메모</label><textarea id="noteText" maxlength="4000" placeholder="기억하고 싶은 문장이나 생각">' +
      esc(n?.text || "") +
      '</textarea><button type="submit" class="primary">저장</button>' +
      (n ? button("메모 삭제", "deleteNote", "textbtn", attr(id) + ' data-note="' + esc(noteId) + '"') : "") +
      "</form>",
    "memo",
  );
}

function editMemo(id, logId) {
  const l = get(id)?.logs.find((l) => l.id === logId);
  if (!l) return;
  showModal(
    l.memo ? "메모 수정" : "메모 남기기",
    '<form id="memoForm" data-id="' +
      esc(id) +
      '" data-log="' +
      esc(logId) +
      '"><label for="todayMemo">오늘 읽으며 남기고 싶은 생각</label><textarea id="todayMemo" maxlength="4000" placeholder="짧은 생각이나 기억하고 싶은 문장">' +
      esc(l.memo) +
      '</textarea><button type="submit" class="primary">저장</button></form>',
    "memo",
  );
}

function editCompletion(id) {
  const c = get(id);
  showModal(
    "완료일 수정",
    '<form id="completionForm" data-id="' +
      id +
      '"><label for="completionDate">완료 날짜</label><input id="completionDate" type="date" max="' +
      now() +
      '" value="' +
      (c.completed === "unknown" ? "" : c.completed) +
      '" required><p class="creator">해당 날짜의 숲과 달력에 반영돼요.</p><div id="formError" class="form-error" role="alert"></div><button type="submit" class="primary">수정 저장</button></form>',
    "completion",
  );
}
