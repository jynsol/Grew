/*
 * 마이 탭: 프로필, 연결된 로그인, 백업·복원, 라이선스, 문의.
 */

function profilePhotoSource(value) {
  return typeof value === "string" &&
    value.length <= 300000 &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : "";
}

let profileEdit = null;

function profileAvatarHTML(photo = state.profile.photo) {
  const source = profilePhotoSource(photo);
  return source ? '<img src="' + esc(source) + '" alt="프로필 사진">' : icon("my");
}

// Linked sign-in methods = Supabase identities. Linking a new provider needs "Allow manual linking"
// switched on in Supabase (Authentication → Sign In / Providers). A login method can be removed only
// while at least one other remains.
const LINKABLE = [
  ["email", "이메일"],
  ["kakao", "카카오"],
  ["google", "Google"],
];

let profileIdentities = [];

async function cloudAuthed(path, options = {}) {
  try {
    return await cloudRequest(path, { ...options, token: cloudSession?.access_token });
  } catch (err) {
    if (err.status !== 401 || !(await cloudRefresh())) throw err;
    return cloudRequest(path, { ...options, token: cloudSession?.access_token });
  }
}

function linkedAccountsHTML() {
  return LINKABLE.map(([id, label]) => {
    const it = profileIdentities.find((x) => x.provider === id);
    const right = it
      ? profileIdentities.length > 1 && id !== "email"
        ? button(
            "해제",
            "unlinkIdentity",
            "linked-action is-unlink",
            'data-id="' + esc(it.identity_id || it.id) + '" data-provider="' + id + '"',
          )
        : "<em>연결됨</em>"
      : id === "email"
        ? '<em class="is-off">연결 안 됨</em>'
        : button("연결", "linkIdentity", "linked-action", 'data-provider="' + id + '"');
    return (
      '<div class="linked-row"><strong>' +
      label +
      "</strong>" +
      (it && it.identity_data?.email && id !== "email"
        ? "<small>" + esc(it.identity_data.email) + "</small>"
        : "") +
      right +
      "</div>"
    );
  }).join("");
}

async function loadLinkedAccounts() {
  const box = $("linkedAccounts");
  if (!box) return;
  try {
    const user = await cloudAuthed("/auth/v1/user");
    profileIdentities = user.identities || [];
    if ($("linkedAccounts")) $("linkedAccounts").innerHTML = linkedAccountsHTML();
  } catch {
    if ($("linkedAccounts"))
      $("linkedAccounts").innerHTML = '<p class="linked-note">연결 정보를 불러오지 못했어요.</p>';
  }
}

async function cloudLinkIdentity(provider) {
  if (!OAUTH_NAMES[provider]) return;
  try {
    const data = await cloudAuthed(
      "/auth/v1/user/identities/authorize?provider=" +
        encodeURIComponent(provider) +
        "&skip_http_redirect=true&redirect_to=" +
        encodeURIComponent(location.origin + location.pathname),
    );
    if (!data?.url) throw Error("no url");
    try {
      sessionStorage.setItem(OAUTH_PENDING, provider);
      sessionStorage.setItem(OAUTH_LINKING, "1");
    } catch {}
    location.assign(data.url);
  } catch {
    toast(OAUTH_NAMES[provider] + " 연결을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
  }
}

async function cloudUnlinkIdentity(id, provider) {
  try {
    await cloudAuthed("/auth/v1/user/identities/" + encodeURIComponent(id), { method: "DELETE" });
    toast(OAUTH_NAMES[provider] + " 연결을 해제했어요.");
    await loadLinkedAccounts();
  } catch {
    toast("연결을 해제하지 못했어요. 다른 로그인 방법이 하나 이상 있어야 해요.");
  }
}

function openProfile() {
  profileEdit = { photo: profilePhotoSource(state.profile.photo), loading: false, request: 0 };
  const email = cloudSession?.user?.email || "";
  showModal(
    "프로필 설정",
    '<form id="profileForm"><div class="profile-photo-editor">' +
      button(
        '<span class="profile-avatar profile-avatar-large" id="profilePhotoPreview">' +
          profileAvatarHTML(profileEdit.photo) +
          "</span>",
        "profilePhotoChoose",
        "profile-photo-trigger",
        'aria-label="프로필 사진 변경"',
      ) +
      '<div class="profile-photo-actions">' +
      button("사진 변경", "profilePhotoChoose", "textbtn") +
      button(
        "기본 이미지로",
        "profilePhotoRemove",
        "textbtn",
        'id="profilePhotoRemove" ' + (profileEdit.photo ? "" : "disabled"),
      ) +
      '</div><input id="profilePhotoFile" type="file" accept="image/*" hidden><p id="profilePhotoStatus" class="profile-photo-status" role="status">사진은 가운데를 기준으로 동그랗게 보여요.</p></div><label for="profileName">이름 또는 별명</label><input id="profileName" maxlength="30" required autocomplete="nickname" value="' +
      esc(state.profile.name) +
      '"><label for="profileBio">한 줄 소개 · 선택</label><textarea id="profileBio" maxlength="120" rows="2" placeholder="나의 취향을 짧게 소개해보세요.">' +
      esc(state.profile.bio || "") +
      '</textarea><div class="profile-bio-count"><span id="profileBioCount">' +
      String(state.profile.bio || "").length +
      "</span> / 120</div>" +
      (email
        ? '<div class="profile-account"><span>로그인 계정</span><strong>' + esc(email) + "</strong></div>"
        : "") +
      (cloudSession?.access_token
        ? '<div class="linked-accounts"><span>연결된 로그인</span><div id="linkedAccounts" aria-live="polite"><p class="linked-note">불러오는 중…</p></div></div>'
        : "") +
      '<p id="profileError" class="form-error" role="alert"></p><button id="profileSave" class="primary" type="submit">저장</button>' +
      button("취소", "close", "textbtn") +
      "</form>",
    "profile",
  );
  if (cloudSession?.access_token) void loadLinkedAccounts();
}

function updateProfilePhotoPreview() {
  if (modal !== "profile" || !$("profileForm") || !profileEdit) return;
  $("profilePhotoPreview").innerHTML = profileAvatarHTML(profileEdit.photo);
  $("profilePhotoRemove").disabled = !profileEdit.photo && !profileEdit.loading;
  $("profileSave").disabled = profileEdit.loading;
  $("profilePhotoStatus").textContent = profileEdit.loading
    ? "사진을 준비하고 있어요…"
    : "사진은 가운데를 기준으로 동그랗게 보여요.";
}

async function changeProfilePhoto(file, form) {
  if (!file || !form?.isConnected || !profileEdit) return;
  const draft = profileEdit,
    ticket = ++draft.request;
  draft.loading = true;
  $("profileError").textContent = "";
  updateProfilePhotoPreview();
  let url = "";
  try {
    if (!file.type.startsWith("image/")) throw Error("사진 파일을 선택해주세요.");
    if (file.size > 15000000) throw Error("15MB 이하의 사진을 선택해주세요.");
    url = URL.createObjectURL(file);
    const img = await loadImage(url),
      width = img.naturalWidth,
      height = img.naturalHeight;
    if (!width || !height) throw Error("사진을 읽지 못했어요.");
    const side = Math.min(width, height),
      canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f7f4";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 256, 256);
    const photo = profilePhotoSource(canvas.toDataURL("image/jpeg", 0.86));
    if (!photo) throw Error("다른 사진을 선택해주세요.");
    if (profileEdit !== draft || draft.request !== ticket || !form.isConnected) return;
    draft.photo = photo;
  } catch (err) {
    if (profileEdit === draft && draft.request === ticket && form.isConnected)
      $("profileError").textContent =
        err.message === "이미지를 읽지 못했어요."
          ? "사진을 열지 못했어요. JPG, PNG 또는 WebP 사진을 선택해주세요."
          : userMessage(err, "사진을 불러오지 못했어요.");
  } finally {
    if (url) URL.revokeObjectURL(url);
    if (profileEdit === draft && draft.request === ticket && form.isConnected) {
      draft.loading = false;
      updateProfilePhotoPreview();
    }
  }
}

function saveProfile(form) {
  if (!profileEdit || profileEdit.loading || !form.isConnected) return;
  const name = $("profileName").value.trim().slice(0, 30);
  if (!name) {
    $("profileError").textContent = "이름 또는 별명을 입력해주세요.";
    $("profileName").focus();
    return;
  }
  const previous = state.profile;
  state.profile = {
    ...previous,
    name,
    bio: $("profileBio").value.trim().slice(0, 120),
    photo: profilePhotoSource(profileEdit.photo),
  };
  if (!persist()) {
    state.profile = previous;
    $("profileError").textContent = "저장하지 못했어요. 저장 공간을 확인한 뒤 다시 시도해주세요.";
    return;
  }
  authSession.name = name;
  saveSession();
  profileEdit = null;
  closeModal();
  render();
  toast("프로필을 저장했어요.");
}

// Third-party notices: fonts (SIL OFL 1.1), forest sounds (Pixabay), work data (TMDB, Google Books, 알라딘).
function openLicenses() {
  const item = (name, by, lic, url) =>
    "<li><strong>" +
    esc(name) +
    "</strong><span>" +
    esc(by) +
    '</span><a href="' +
    url +
    '" target="_blank" rel="noopener">' +
    esc(lic) +
    "</a></li>";
  showModal(
    "오픈소스 라이선스",
    '<div class="license-list"><h3>글꼴</h3><ul>' +
      item(
        "Pretendard",
        "Kil Hyung-jin",
        "SIL Open Font License 1.1",
        "https://github.com/orioncactus/pretendard/blob/main/LICENSE",
      ) +
      item(
        "Archivo",
        "Omnibus-Type",
        "SIL Open Font License 1.1",
        "https://fonts.google.com/specimen/Archivo/license",
      ) +
      item(
        "Bricolage Grotesque",
        "Mathieu Triay",
        "SIL Open Font License 1.1",
        "https://fonts.google.com/specimen/Bricolage+Grotesque/license",
      ) +
      "</ul>" +
      "<h3>숲의 소리</h3><ul>" +
      item(
        "Forest ambience",
        "AudioPapkin (Paweł Spychała)",
        "Pixabay Content License",
        "https://pixabay.com/service/license-summary/",
      ) +
      item(
        "Evening Sound Effect in Village",
        "Subhasis Mandal",
        "Pixabay Content License",
        "https://pixabay.com/service/license-summary/",
      ) +
      "</ul>" +
      "<h3>작품 정보</h3><ul>" +
      item("TMDB", "영화 정보와 포스터", "themoviedb.org", "https://www.themoviedb.org/") +
      item("Google Books", "책 정보와 표지", "books.google.com", "https://books.google.com/") +
      item("알라딘", "책 정보", "aladin.co.kr", "https://www.aladin.co.kr/") +
      '</ul><p class="license-note">이 앱은 TMDB API를 사용하지만 TMDB의 보증이나 인증을 받지 않았어요.<br>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div>',
    "licenses",
  );
}

function contactSupport() {
  if (!APP_BRAND.contact) {
    toast("문의 창구를 준비하고 있어요.");
    return;
  }
  const body = "\n\n\n---\n" + APP_BRAND.ko + " " + APP_BRAND.version + " · " + navigator.userAgent;
  location.href =
    "mailto:" +
    APP_BRAND.contact +
    "?subject=" +
    encodeURIComponent("[" + APP_BRAND.ko + "] 문의·피드백") +
    "&body=" +
    encodeURIComponent(body);
}

function renderMy() {
  const stats = Model.stats(state.items.filter((c) => c.completed)),
    row = (label, action, value = "›", cls = "") =>
      button(
        "<span>" + label + '</span><span class="menu-row-value">' + value + "</span>",
        action,
        "menu-row " + cls,
      );
  return (
    '<section class="my-page"><div class="page-heading"><h1 class="page-title">마이</h1></div>' +
    '<div class="my-profile"><button type="button" class="my-profile-head" data-action="profile"><span class="profile-avatar">' +
    profileAvatarHTML() +
    '</span><span class="my-profile-copy"><strong>' +
    esc(state.profile.name) +
    "</strong><small>" +
    esc(state.profile.bio || "읽고 본 것을 숲으로") +
    '</small></span><span class="my-profile-edit">수정</span></button>' +
    '<div class="my-stats"><div><strong>' +
    state.items.length +
    "</strong><span>스크랩</span></div><div><strong>" +
    state.items.filter((c) => !c.completed && Model.stage(c) > 0).length +
    "</strong><span>" +
    statusName.active +
    "</span></div><div><strong>" +
    stats.n +
    "</strong><span>" +
    statusName.done +
    "</span></div></div></div>" +
    '<div class="settings-group"><h2>나의 설정</h2><div class="settings-card">' +
    row("취향 관리", "tastes") +
    button(
      '<span>숲의 소리</span><span class="menu-row-value forest-sound-menu-value"><span id="forestSoundSummary">' +
        (forestSoundPrefs.enabled ? forestSoundCurrent().name : "꺼짐") +
        "</span> ›</span>",
      "forestSoundSettings",
      "menu-row",
    ) +
    row("알림", "notifications") +
    "</div></div>" +
    '<div class="settings-group"><div class="settings-group-head"><h2>기록 관리</h2><p id="cloudSaveStatus" class="save-status" role="status" aria-live="polite">' +
    cloudSaveStatusLabel() +
    '</p></div><div class="settings-card">' +
    row("데이터 백업", "backup", "↓") +
    row("백업 복원", "restore", "↑") +
    '</div><input id="restoreFile" aria-label="백업 파일 선택" class="offscreen" type="file" accept="application/json,.json"></div>' +
    (BM_CONFIG.mode === "preview"
      ? '<div class="settings-group"><h2>프로토타입</h2><div class="settings-card">' +
        row("구매 되돌리기", "bmPreviewReset", "↺") +
        "</div></div>"
      : "") +
    '<div class="settings-group"><h2>도움</h2><div class="settings-card">' +
    row("문의·피드백 보내기", "contact") +
    row("오픈소스 라이선스", "licenses") +
    '<div class="menu-row is-static"><span>앱 버전</span><span class="menu-row-value">' +
    APP_BRAND.version +
    "</span></div></div></div>" +
    '<div class="settings-group"><h2>서비스</h2><div class="settings-card">' +
    row("이용약관", "terms") +
    row("개인정보처리방침", "privacy") +
    row("로그아웃", "flowLogout") +
    button("<span>회원 탈퇴</span>", "deleteAccount", "menu-row danger") +
    "</div></div></section>"
  );
}

function exportBackup() {
  download(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    "grew-backup-" + now() + ".json",
  );
  toast("백업 파일을 저장했어요.");
}

function replaceData(s) {
  state = s;
  ensureCompletedSpeciesAssignments();
  if (!persist()) return;
  year = now().slice(0, 4);
  month = now().slice(0, 7);
  zoomState = { scale: 1, x: 0, y: 0 };
  forestViewportYear = null;
  closeModal();
  view = "today";
  render();
  scrollPageTop();
}

// Automatic deletion of records based on source labels was retired.
setTimeout(() => repairMissingBookGenres(36), 1200);

async function resetAll() {
  photoFiles = [];
  candidates = [];
  ocrGeneration++;
  undoAction = null;
  clearTimeout(toastTimer);
  $("toast").innerHTML = "";
  state = Model.empty();
  state.profile.name = authSession.name || "나";
  state.onboarded = authSession.finished === true;
  if (!persist()) return;
  await cloudUpsertState();
  view = "today";
  closeModal();
  render();
  toast("모든 스크랩과 기록을 삭제했어요.");
}

function inlinePicker(label, kind, options, value) {
  return (
    '<div class="inline-picker">' +
    button(
      esc(label) + " ▾",
      "inlinePicker",
      kind === "sort" ? "sort-button" : "textbtn",
      'data-picker="' + kind + '" aria-expanded="false" aria-controls="picker-' + kind + '"',
    ) +
    '<div id="picker-' +
    kind +
    '" class="inline-picker-panel ' +
    (kind === "year" ? "year-picker" : "") +
    '" role="group" aria-label="' +
    (kind === "year" ? "연도 선택" : "정렬") +
    '" hidden>' +
    options
      .map(([key, text]) =>
        button(
          "<span>" + esc(text) + '</span><span aria-hidden="true">' + (key === value ? "✓" : "") + "</span>",
          kind === "year" ? "year" : "inlineSort",
          "",
          "data-" +
            (kind === "year" ? "year" : "value") +
            '="' +
            esc(key) +
            '" aria-pressed="' +
            (key === value) +
            '"',
        ),
      )
      .join("") +
    "</div></div>"
  );
}

function closeInlinePickers() {
  document.querySelectorAll(".inline-picker").forEach((el) => {
    el.querySelector("button").setAttribute("aria-expanded", "false");
    el.querySelector(".inline-picker-panel").hidden = true;
  });
}

function toggleInlinePicker(b) {
  const opening = b.getAttribute("aria-expanded") !== "true";
  closeInlinePickers();
  if (opening) {
    b.setAttribute("aria-expanded", "true");
    document.getElementById(b.getAttribute("aria-controls")).hidden = false;
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".inline-picker")) closeInlinePickers();
});

document.addEventListener("keydown", (e) => {
  const panel = e.target.closest(".inline-picker");
  if (!panel) return;
  const trigger = panel.querySelector("button");
  if (e.key === "Escape") {
    closeInlinePickers();
    trigger.focus();
    e.preventDefault();
  }
  if (["ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    if (trigger.getAttribute("aria-expanded") !== "true") toggleInlinePicker(trigger);
    const buttons = [...panel.querySelectorAll(".inline-picker-panel button")],
      index = buttons.indexOf(document.activeElement);
    buttons[(index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  }
});

document.addEventListener("focusin", (e) => {
  if (!e.target.closest(".inline-picker")) closeInlinePickers();
});
