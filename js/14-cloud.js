/*
 * 로그인과 클라우드 저장(Supabase): 세션, 소셜 로그인, 동기화, 충돌 처리.
 */

const SUPABASE_URL = "https://gytfefnvpqqxveryhopw.supabase.co";

const DELETE_ACCOUNT_ENDPOINT = SUPABASE_URL + "/functions/v1/delete-account";

const CLOUD_PUBLIC_KEY_STORAGE = "songrim.supabase.publishable-key.v1";

const CLOUD_SESSION_STORAGE = "songrim.supabase.session.v1";

const CLOUD_LAST_EMAIL_STORAGE = "songrim.supabase.last-email.v1";

let cloudSession = null,
  cloudApplying = false,
  cloudSyncTimer = null,
  cloudSyncStatus = "local";

// The publishable key is meant to ship in browser code (Row Level Security guards the data).
// Once it is set here, nobody has to paste it; a key saved on the device (?debug) still wins.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1aHPXqrU3WJP8zDTlh-y2g_9RLnt_lP";

function cloudPublicKey() {
  try {
    return localStorage.getItem(CLOUD_PUBLIC_KEY_STORAGE) || SUPABASE_PUBLISHABLE_KEY;
  } catch {
    return SUPABASE_PUBLISHABLE_KEY;
  }
}

function saveCloudPublicKey(v) {
  try {
    localStorage.setItem(CLOUD_PUBLIC_KEY_STORAGE, String(v || "").trim());
  } catch {}
}

function clearCloudSession() {
  cloudSession = null;
  try {
    localStorage.removeItem(CLOUD_SESSION_STORAGE);
  } catch {}
}

function saveCloudSession(session) {
  cloudSession = session || null;
  try {
    session
      ? localStorage.setItem(CLOUD_SESSION_STORAGE, JSON.stringify(session))
      : localStorage.removeItem(CLOUD_SESSION_STORAGE);
  } catch {}
}

function loadCloudSession() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_SESSION_STORAGE) || "null");
  } catch {
    return null;
  }
}

function cloudAuthHeaders(token = "") {
  const key = cloudPublicKey(),
    h = { "Content-Type": "application/json", apikey: key };
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

async function cloudRequest(path, options = {}) {
  const key = cloudPublicKey();
  if (!key) throw Error("Supabase Publishable key 연결이 필요해요.");
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    signal:
      options.signal ||
      (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined),
    headers: { ...cloudAuthHeaders(options.token || ""), ...(options.headers || {}) },
  });
  let body = null,
    text = "";
  try {
    text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const error = Error(
      body?.msg ||
        body?.message ||
        body?.error_description ||
        body?.error ||
        "Supabase 오류 · HTTP " + res.status,
    );
    error.status = res.status;
    throw error;
  }
  return body;
}

async function cloudRefresh() {
  if (cloudRefreshPromise) return cloudRefreshPromise;
  const owner = cloudSession?.user?.id,
    generation = dataGeneration;
  if (!owner || !cloudSession?.refresh_token) return false;
  const run = async () => {
    if (!ownerIsCurrent(owner, generation)) return false;
    const stored = loadCloudSession();
    if (stored?.access_token !== cloudSession.access_token) {
      cloudSession = stored;
      return true;
    }
    try {
      const data = await cloudRequest("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: cloudSession.refresh_token }),
      });
      if (!ownerIsCurrent(owner, generation) || data?.user?.id !== owner) return false;
      saveCloudSession(data);
      return true;
    } catch {
      return false;
    }
  };
  cloudRefreshPromise = navigator.locks?.request
    ? navigator.locks.request("songrim-token:" + owner, run)
    : run();
  try {
    return await cloudRefreshPromise;
  } finally {
    cloudRefreshPromise = null;
  }
}

async function cloudLogin(email, password) {
  const data = await cloudRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveCloudSession(data);
  activateDataOwner(data.user.id);
  return data;
}

async function cloudSignup(email, password) {
  return cloudRequest("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });
}

// Recovery credentials stay in memory and never replace the active account session.
let passwordRecoveryToken = "",
  passwordRecoveryEmail = "",
  passwordRecoveryError = "";

async function cloudRecover(email) {
  const redirect = ["http:", "https:"].includes(location.protocol) ? location.origin + location.pathname : "";
  return cloudRequest("/auth/v1/recover" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : ""), {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

async function readRecoveryLink(raw) {
  passwordRecoveryToken = "";
  passwordRecoveryEmail = "";
  const url = new URL(raw, location.href),
    hash = new URLSearchParams(url.hash.slice(1));
  const allowed =
    url.origin === new URL(SUPABASE_URL).origin ||
    (url.origin === location.origin && url.pathname === location.pathname);
  if (!allowed) throw Error(APP_BRAND.ko + " 비밀번호 재설정 메일의 링크를 붙여넣어주세요.");
  if (hash.get("error") || url.searchParams.get("error"))
    throw Error("만료되었거나 이미 사용한 링크예요. 재설정 메일을 다시 받아주세요.");
  const kind = hash.get("type") || url.searchParams.get("type");
  if (kind !== "recovery")
    throw Error("비밀번호 재설정 링크인지 확인해주세요. 새 메일을 받아 다시 시도할 수 있어요.");
  let token = hash.get("access_token");
  if (!token) {
    const tokenHash = url.searchParams.get("token_hash") || url.searchParams.get("token");
    if (!tokenHash) throw Error("재설정 인증 정보가 없어요. 새 메일을 받아주세요.");
    const result = await cloudRequest("/auth/v1/verify", {
      method: "POST",
      body: JSON.stringify({ token_hash: tokenHash, type: "recovery" }),
    });
    token = result?.access_token;
  }
  if (!token) throw Error("재설정 인증을 완료하지 못했어요.");
  const user = await cloudRequest("/auth/v1/user", { method: "GET", token });
  passwordRecoveryToken = token;
  passwordRecoveryEmail = user.email || "";
  passwordRecoveryError = "";
}

// Social login (Kakao, Apple, Google) through Supabase Auth. Each provider is switched on in the
// Supabase dashboard; the provider sends the user back here with the session tokens in the URL hash.
const OAUTH_PENDING = "grew.oauth.pending",
  OAUTH_LINKING = "grew.oauth.linking",
  OAUTH_NAMES = { kakao: "카카오", apple: "Apple", google: "Google" };

function cloudOAuthStart(provider) {
  if (!OAUTH_NAMES[provider]) return;
  try {
    sessionStorage.setItem(OAUTH_PENDING, provider);
  } catch {}
  location.assign(
    SUPABASE_URL +
      "/auth/v1/authorize?provider=" +
      encodeURIComponent(provider) +
      "&redirect_to=" +
      encodeURIComponent(location.origin + location.pathname),
  );
}

let oauthNotice = "";

async function finishOAuthReturn() {
  let provider = "";
  try {
    provider = sessionStorage.getItem(OAUTH_PENDING) || "";
  } catch {}
  const hash = new URLSearchParams(location.hash.slice(1)),
    query = new URLSearchParams(location.search);
  if (!provider || (!hash.has("access_token") && !hash.has("error") && !query.has("error"))) return "";
  let linking = false;
  try {
    linking = sessionStorage.getItem(OAUTH_LINKING) === "1";
    sessionStorage.removeItem(OAUTH_PENDING);
    sessionStorage.removeItem(OAUTH_LINKING);
  } catch {}
  try {
    history.replaceState(null, "", location.pathname);
  } catch {}
  if (hash.has("error") || query.has("error")) {
    if (linking) {
      oauthNotice =
        OAUTH_NAMES[provider] + " 계정을 연결하지 못했어요. 이미 다른 그루 계정에 연결돼 있을 수 있어요.";
      return "";
    }
    loginError = OAUTH_NAMES[provider] + " 로그인을 마치지 못했어요. 다시 시도해주세요.";
    return "";
  }
  try {
    const token = hash.get("access_token"),
      user = await cloudRequest("/auth/v1/user", { token }),
      expires = Number(hash.get("expires_in")) || 3600;
    saveCloudSession({
      access_token: token,
      refresh_token: hash.get("refresh_token") || "",
      token_type: hash.get("token_type") || "bearer",
      expires_in: expires,
      expires_at: Math.floor(Date.now() / 1000) + expires,
      user,
    });
    if (linking) oauthNotice = OAUTH_NAMES[provider] + " 계정을 연결했어요.";
    return provider;
  } catch {
    loginError = OAUTH_NAMES[provider] + " 로그인을 확인하지 못했어요. 다시 시도해주세요.";
    return "";
  }
}

async function beginPasswordRecovery() {
  const hash = new URLSearchParams(location.hash.slice(1)),
    query = new URLSearchParams(location.search);
  if (
    hash.get("type") !== "recovery" &&
    query.get("type") !== "recovery" &&
    !hash.has("error") &&
    !query.has("code")
  )
    return false;
  const raw = location.href;
  try {
    history.replaceState(null, "", location.pathname);
  } catch {}
  try {
    await readRecoveryLink(raw);
    authRoute = "resetPassword";
  } catch {
    passwordRecoveryError = "재설정 링크가 만료되었거나 이 기기에서 확인할 수 없어요. 새 메일을 받아주세요.";
    authRoute = "recover";
  }
  return true;
}

async function updateRecoveredPassword(password, confirmation) {
  if (password.length < 6) throw Error("비밀번호를 6자 이상 입력해주세요.");
  if (password !== confirmation) throw Error("비밀번호가 일치하지 않아요.");
  if (!passwordRecoveryToken) throw Error("재설정 메일을 다시 받아주세요.");
  await cloudRequest("/auth/v1/user", {
    method: "PUT",
    token: passwordRecoveryToken,
    body: JSON.stringify({ password }),
  });
  const token = passwordRecoveryToken;
  passwordRecoveryToken = "";
  passwordRecoveryEmail = "";
  try {
    await cloudRequest("/auth/v1/logout?scope=local", { method: "POST", token, body: "{}" });
  } catch {}
}

async function cloudLogout() {
  const session = cloudSession;
  clearTimeout(cloudSyncTimer);
  // All successful edits are already durable under this account key.
  clearCloudSession();
  activateDataOwner("local");
  try {
    if (session?.access_token)
      await cloudRequest("/auth/v1/logout?scope=local", {
        method: "POST",
        token: session.access_token,
        body: "{}",
      });
  } catch {}
}

async function deleteSongrimAccount() {
  const deletingOwner = dataOwner,
    deletingGeneration = dataGeneration;
  if (!cloudSession?.access_token) throw Error("다시 로그인한 뒤 회원탈퇴를 진행해주세요.");
  const key = cloudPublicKey();
  if (!key) throw Error("Supabase 연결 설정이 필요해요.");

  const res = await fetch(DELETE_ACCOUNT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: "Bearer " + cloudSession.access_token,
    },
    body: JSON.stringify({ confirm: true }),
  });

  let payload = null,
    text = "";
  try {
    text = await res.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!res.ok) throw Error(payload?.message || payload?.error || "회원탈퇴 처리 실패 · HTTP " + res.status);

  // 서버에서 확인된 이 계정의 로컬 스냅샷만 삭제한다.
  if (localStorage.getItem(KEY + ".legacy-owner") === deletingOwner) {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY + ".legacy-owner");
    localStorage.removeItem(KEY + ".legacy-reviewed");
  }
  for (const key of Object.keys(localStorage))
    if (key === accountDataKey(deletingOwner) || key.startsWith(accountDataKey(deletingOwner) + ":archive:"))
      localStorage.removeItem(key);
  if (!ownerIsCurrent(deletingOwner, deletingGeneration)) return true;
  clearCloudSession();
  activateDataOwner("local");
  authSession = { signedIn: false, finished: false };
  try {
    // Legacy unowned backups are retained; never delete another account snapshot.
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(CLOUD_LAST_EMAIL_STORAGE);
  } catch {}
  state = Model.empty();
  authRoute = "entry";
  view = "today";
  return true;
}

// Account-owned durable snapshots. Never use the legacy shared record as an upload source.
let dataOwner = "local",
  dataGeneration = 0,
  dataEnvelope = null,
  durableState = null,
  unsavedState = null;

let cloudWritePromise = null,
  cloudRefreshPromise = null,
  cloudReloadPending = false;

const accountDataKey = (owner) => "songrim.account-state.v1:" + encodeURIComponent(owner);

const stateFingerprint = (value) => JSON.stringify({ ...value, filters: undefined });

const revisionID = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

function readAccountEnvelope(owner = dataOwner) {
  const raw = localStorage.getItem(accountDataKey(owner));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value.owner !== owner || !value.state || typeof value.rev !== "string")
    throw Error("계정별 저장 기록을 확인해주세요.");
  return value;
}

function ownerIsCurrent(owner, generation = dataGeneration) {
  return (
    owner === dataOwner &&
    generation === dataGeneration &&
    owner === (cloudSession?.user?.id || "local") &&
    owner === (loadCloudSession()?.user?.id || "local")
  );
}

function activateDataOwner(owner) {
  clearTimeout(cloudSyncTimer);
  dataGeneration++;
  dataOwner = owner;
  notificationDataOwner = null;
  cloudReloadPending = false;
  unsavedState = null;
  dataEnvelope = null;
  state = Model.empty();
  try {
    dataEnvelope = readAccountEnvelope(owner);
    if (dataEnvelope) {
      const removeAlbums = dataEnvelope.state.items?.some((c) => c.type === "album");
      state = Model.validate(dataEnvelope.state);
      if (removeAlbums)
        saveEnvelope({ ...dataEnvelope, rev: revisionID(), state: Model.clone(state), dirty: true });
    }
    storageOK = true;
  } catch {
    storageOK = false;
  }
  durableState = JSON.stringify(state);
  cloudSyncStatus = dataEnvelope?.conflict
    ? "conflict"
    : dataEnvelope?.dirty
      ? "pending"
      : owner === "local"
        ? "local"
        : "synced";
}

function saveEnvelope(envelope) {
  localStorage.setItem(accountDataKey(envelope.owner), JSON.stringify(envelope));
  if (envelope.owner === dataOwner) {
    dataEnvelope = envelope;
    durableState = JSON.stringify(envelope.state);
  }
}

function legacyReviewPending() {
  try {
    return (
      dataOwner !== "local" &&
      localStorage.getItem(KEY + ".legacy-owner") === dataOwner &&
      !localStorage.getItem(KEY + ".legacy-reviewed") &&
      !!localStorage.getItem(KEY)
    );
  } catch {
    return false;
  }
}

function cloudSaveStatusLabel() {
  return !storageOK
    ? "기기 저장 확인 필요"
    : cloudSyncStatus === "conflict"
      ? "기록 충돌 확인 필요"
      : cloudSyncStatus === "reauth"
        ? "기기에 저장됨 · 다시 로그인 필요"
        : cloudSyncStatus === "error"
          ? "기기에 저장됨 · 전송 대기"
          : cloudSyncStatus === "pending" || cloudSyncStatus === "syncing"
            ? "기기에 저장됨 · 동기화 중"
            : dataOwner === "local"
              ? "이 기기에 저장 중"
              : "기기와 클라우드에 저장됨";
}

function showStorageStatus() {
  const status = $("cloudSaveStatus");
  if (status) status.textContent = cloudSaveStatusLabel();
  const el = $("storageAlert");
  if (!el) return;
  let message = "",
    actions = "";
  if (!storageOK) {
    message =
      "이 변경을 브라우저에 저장하지 못했어요. 입력 내용을 유지했어요. 공간을 확보한 뒤 다시 저장하거나 미저장 내용을 백업해주세요.";
    actions = button("미저장 내용 백업", "backupUnsaved", "textbtn");
  } else if (cloudReloadPending) {
    message = "다른 창에서 기록이 바뀌었어요. 작성 중인 내용을 백업한 뒤 최신 기록을 불러와주세요.";
    actions =
      button("작성 내용 백업", "backupUnsaved", "textbtn") +
      button("최신 기록 불러오기", "reloadAccountData", "textbtn");
  } else if (cloudSyncStatus === "conflict") {
    message = "다른 기기의 기록과 충돌했어요. 이 기기 기록은 보관되어 있어요.";
    actions = button("두 기록 확인", "resolveCloudConflict", "textbtn");
  } else if (cloudSyncStatus === "reauth") {
    message = "이 기기에 저장했어요. 로그인이 만료되어 클라우드 전송을 기다리고 있어요.";
    actions = button("다시 로그인", "flowEmailLogin", "textbtn");
  } else if (cloudSyncStatus === "error") {
    message = "이 기기에 저장했어요. 클라우드 전송을 다시 시도해주세요.";
    actions = button("다시 전송", "retryCloudSync", "textbtn") + button("백업", "backup", "textbtn");
  } else if (legacyReviewPending()) {
    message = "계정별 저장으로 전환했어요. 전환 전의 기기 기록도 보관했으니 한 번 확인해주세요.";
    actions = button("이전 기록 확인", "reviewLegacy", "textbtn");
  }
  el.innerHTML = message ? '<div class="storage-alert" role="status">' + message + actions + "</div>" : "";
}

function persist() {
  try {
    bmRefresh(state);
    if (!ownerIsCurrent(dataOwner)) throw Error("로그인 계정이 바뀌었어요.");
    const latest = readAccountEnvelope();
    if ((latest?.rev || null) !== (dataEnvelope?.rev || null)) {
      cloudReloadPending = true;
      throw Error("다른 창의 기록이 바뀌었어요.");
    }
    const changed = stateFingerprint(state) !== stateFingerprint(dataEnvelope?.state || Model.empty());
    const envelope = {
      ...dataEnvelope,
      owner: dataOwner,
      rev: revisionID(),
      state: JSON.parse(JSON.stringify(state)),
      dirty: !!dataEnvelope?.dirty || changed,
      baseKnown: !!dataEnvelope?.baseKnown,
      baseVersion: dataEnvelope?.baseVersion || null,
    };
    saveEnvelope(envelope);
    storageOK = true;
    unsavedState = null;
    if (envelope.dirty && dataOwner !== "local") {
      cloudSyncStatus = envelope.conflict ? "conflict" : "pending";
      scheduleCloudSync();
    }
    showStorageStatus();
    return true;
  } catch {
    unsavedState = JSON.parse(JSON.stringify(state));
    // Roll back the model, leaving live form controls intact for a retry.
    if (durableState) state = Model.validate(JSON.parse(durableState));
    storageOK = false;
    showStorageStatus();
    const error = $("formError") || $("flowError");
    if (error) error.textContent = "저장하지 못했어요. 입력 내용을 확인한 뒤 다시 저장해주세요.";
    document.querySelectorAll('form button[type="submit"]:disabled').forEach((el) => (el.disabled = false));
    return false;
  }
}

async function cloudAuthorized(path, options, owner, generation) {
  if (!ownerIsCurrent(owner, generation)) throw Error("계정이 변경되어 요청을 취소했어요.");
  try {
    return await cloudRequest(path, { ...options, token: cloudSession.access_token });
  } catch (err) {
    if (err.status !== 401 && !/JWT|token.*expired/i.test(err.message)) throw err;
    if (!(await cloudRefresh()) || !ownerIsCurrent(owner, generation)) throw err;
    return cloudRequest(path, { ...options, token: cloudSession.access_token });
  }
}

async function cloudFetchState(owner = dataOwner, generation = dataGeneration) {
  if (owner === "local" || !cloudSession?.access_token) return null;
  const rows = await cloudAuthorized(
    "/rest/v1/songrim_user_states?select=state,updated_at&user_id=eq." +
      encodeURIComponent(owner) +
      "&limit=1",
    { method: "GET", headers: { Accept: "application/json" } },
    owner,
    generation,
  );
  if (!ownerIsCurrent(owner, generation)) throw Error("로그인 계정이 변경됐어요.");
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function cloudUpsertState() {
  if (cloudWritePromise) return cloudWritePromise;
  const owner = dataOwner,
    generation = dataGeneration;
  if (cloudApplying || owner === "local" || !cloudSession?.access_token || !ownerIsCurrent(owner, generation))
    return false;
  const work = async () => {
    try {
      let envelope = readAccountEnvelope(owner);
      if (!envelope?.dirty) return true;
      if (envelope.conflict) {
        cloudSyncStatus = "conflict";
        return false;
      }
      cloudSyncStatus = "syncing";
      showStorageStatus();
      if (!envelope.baseKnown) {
        await cloudLoadForSignedInUser();
        envelope = readAccountEnvelope(owner);
        if (!envelope?.dirty) return true;
        if (envelope.conflict) return false;
      }
      if (!ownerIsCurrent(owner, generation)) return false;
      const revision = envelope.rev,
        version = envelope.baseVersion;
      // Compare-and-swap avoids overwriting a row modified by another device.
      const path =
        "/rest/v1/songrim_user_states" +
        (version
          ? "?user_id=eq." + encodeURIComponent(owner) + "&updated_at=eq." + encodeURIComponent(version)
          : "");
      const rows = await cloudAuthorized(
        path,
        {
          method: version ? "PATCH" : "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: owner,
            state: envelope.state,
            updated_at: new Date().toISOString(),
          }),
        },
        owner,
        generation,
      );
      if (!ownerIsCurrent(owner, generation)) return false;
      if (!Array.isArray(rows) || !rows.length) {
        await cloudLoadForSignedInUser();
        return false;
      }
      const latest = readAccountEnvelope(owner);
      if (!latest) return false;
      saveEnvelope({
        ...latest,
        baseKnown: true,
        baseVersion: rows[0].updated_at,
        dirty: latest.rev !== revision,
        rev: revisionID(),
      });
      cloudSyncStatus = dataEnvelope.dirty ? "pending" : "synced";
      if (dataEnvelope.dirty) scheduleCloudSync();
      return true;
    } catch (err) {
      if (!ownerIsCurrent(owner, generation)) return false;
      if (err.status === 409) {
        try {
          await cloudLoadForSignedInUser();
        } catch {
          cloudSyncStatus = "error";
        }
      } else cloudSyncStatus = err.status === 401 || err.status === 403 ? "reauth" : "error";
      return false;
    } finally {
      if (ownerIsCurrent(owner, generation)) showStorageStatus();
    }
  };
  cloudWritePromise = navigator.locks?.request
    ? navigator.locks.request("songrim-sync:" + owner, work)
    : work();
  try {
    return await cloudWritePromise;
  } finally {
    cloudWritePromise = null;
    if (dataGeneration !== generation && dataEnvelope?.dirty) scheduleCloudSync();
  }
}

function scheduleCloudSync() {
  if (cloudApplying || !cloudSession?.access_token || dataEnvelope?.conflict) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => void cloudUpsertState(), 500);
}

async function cloudLoadForSignedInUser() {
  const owner = cloudSession?.user?.id;
  if (!owner) return;
  if (dataOwner !== owner) activateDataOwner(owner);
  const generation = dataGeneration;
  notificationDataOwner = null;
  syncNotifications();
  const row = await cloudFetchState(owner, generation);
  if (!ownerIsCurrent(owner, generation)) return;
  const latest = readAccountEnvelope(owner),
    remote = row?.state ? Model.validate(row.state) : null,
    removeRemoteAlbums = !!row?.state?.items?.some((c) => c.type === "album");
  if (
    latest?.dirty &&
    remote &&
    (!latest.baseKnown || latest.baseVersion !== row.updated_at) &&
    stateFingerprint(latest.state) !== stateFingerprint(remote)
  ) {
    saveEnvelope({ ...latest, rev: revisionID(), conflict: { state: remote, version: row.updated_at } });
    cloudSyncStatus = "conflict";
  } else if (latest?.dirty && (!remote || stateFingerprint(latest.state) !== stateFingerprint(remote))) {
    saveEnvelope({ ...latest, rev: revisionID(), baseKnown: true, baseVersion: row?.updated_at || null });
    cloudSyncStatus = "pending";
    scheduleCloudSync();
  } else {
    const next = remote || latest?.state || Model.empty();
    // Do not replace a live editor while a background request completes.
    if (modal && latest && stateFingerprint(next) !== stateFingerprint(state)) {
      cloudReloadPending = true;
      cloudSyncStatus = "pending";
      return;
    }
    state = next;
    ensureCompletedSpeciesAssignments();
    saveEnvelope({
      owner,
      rev: revisionID(),
      state: JSON.parse(JSON.stringify(state)),
      baseKnown: true,
      baseVersion: row?.updated_at || null,
      dirty: !remote || removeRemoteAlbums,
    });
    cloudSyncStatus = remote && !removeRemoteAlbums ? "synced" : "pending";
    if (!remote || removeRemoteAlbums) scheduleCloudSync();
  }
  notificationDataOwner = owner;
  showStorageStatus();
}

async function cloudBootstrap() {
  const oauth = await finishOAuthReturn();
  if (!oauth && (await beginPasswordRecovery())) return;
  cloudSession = loadCloudSession();
  activateDataOwner(cloudSession?.user?.id || "local");
  const bootGeneration = dataGeneration;
  if (!cloudSession?.access_token) {
    authSession = { signedIn: false, finished: false };
    authRoute = loginError ? "login" : "entry";
    return;
  }
  authSession = {
    signedIn: true,
    finished: state.onboarded === true,
    name: state.profile?.name || "",
    method: oauth ? OAUTH_NAMES[oauth] : "이메일",
  };
  try {
    await cloudLoadForSignedInUser();
  } catch (err) {
    if (bootGeneration !== dataGeneration) return;
    cloudSyncStatus = err.status === 401 || err.status === 403 ? "reauth" : "error";
    notificationDataOwner = dataOwner;
    showStorageStatus();
  }
  if (bootGeneration !== dataGeneration) return;
  if (dataOwner !== (cloudSession?.user?.id || "local")) return;
  authSession.name = state.profile?.name || "";
  authSession.finished = state.onboarded === true;
  saveSession();
  // A first social login still asks for the terms consent before starting.
  authRoute = authSession.finished ? "app" : oauth ? "socialTerms" : "profile";
  if (oauthNotice) {
    const m = oauthNotice;
    oauthNotice = "";
    setTimeout(() => toast(m), 400);
  }
}

async function handleCloudStorage(event) {
  if (event.key === CLOUD_SESSION_STORAGE || event.key === null) {
    const next = loadCloudSession(),
      owner = next?.user?.id || "local";
    cloudSession = next;
    if (owner === dataOwner) return;
    // A pending response can no longer apply state after this generation change.
    closeModal();
    activateDataOwner(owner);
    authSession = { signedIn: owner !== "local", finished: false };
    authRoute = "entry";
    view = "today";
    render();
    if (owner !== "local") {
      await cloudBootstrap();
      render();
    }
    return;
  }
  if (event.key !== accountDataKey(dataOwner)) return;
  if (modal || document.activeElement?.matches("input,textarea,select")) {
    cloudReloadPending = true;
    showStorageStatus();
    return;
  }
  try {
    const latest = readAccountEnvelope();
    if (latest && latest.rev !== dataEnvelope?.rev) {
      dataEnvelope = latest;
      state = Model.validate(latest.state);
      durableState = JSON.stringify(state);
      cloudSyncStatus = latest.conflict ? "conflict" : latest.dirty ? "pending" : "synced";
      render();
      showStorageStatus();
    }
  } catch {
    storageOK = false;
    showStorageStatus();
  }
}

function downloadStateSnapshot(value, label) {
  download(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    "grew-" + label + "-" + Model.today() + ".json",
  );
}

function showCloudConflict() {
  const conflict = dataEnvelope?.conflict;
  if (!conflict) return;
  showModal(
    "두 기기의 기록을 확인해주세요",
    "<p>이 기기 " +
      state.items.length +
      "개 · 클라우드 " +
      conflict.state.items.length +
      "개. 선택하지 않은 기록도 이 기기에 별도 보관해요.</p>" +
      button("이 기기 기록 백업", "backup", "secondary") +
      button("클라우드 기록 백업", "backupRemoteConflict", "secondary") +
      button("클라우드 기록 사용", "useRemoteConflict", "primary") +
      button("이 기기 기록 사용", "useLocalConflict", "secondary"),
    "sync-conflict",
  );
}

async function resolveCloudConflict(useLocal) {
  const owner = dataOwner,
    generation = dataGeneration;
  try {
    const latest = readAccountEnvelope(),
      row = await cloudFetchState(owner, generation);
    if (!latest?.conflict || !row || !ownerIsCurrent(owner, generation)) return;
    if (row.updated_at !== latest.conflict.version) {
      await cloudLoadForSignedInUser();
      showCloudConflict();
      toast("클라우드 기록이 다시 바뀌었어요. 확인해주세요.");
      return;
    }
    // Archive both snapshots before either choice can replace data.
    localStorage.setItem(accountDataKey(owner) + ":archive:" + revisionID(), JSON.stringify(latest));
    state = Model.validate(useLocal ? latest.state : row.state);
    saveEnvelope({
      owner,
      rev: revisionID(),
      state,
      baseKnown: true,
      baseVersion: row.updated_at,
      dirty: useLocal,
    });
    cloudSyncStatus = useLocal ? "pending" : "synced";
    closeModal();
    render();
    if (useLocal) scheduleCloudSync();
    showStorageStatus();
  } catch {
    storageOK = false;
    showStorageStatus();
  }
}

function cloudSetupModal(message = "") {
  showModal(
    "Supabase 사용자 데이터 연결",
    '<p class="muted">브라우저용 <strong>Publishable key</strong>를 한 번 저장하면 이 기기에서는 다시 입력하지 않아도 돼요.</p>' +
      (message ? '<p class="form-error">' + esc(message) + "</p>" : "") +
      '<form id="cloudConfigForm"><label for="cloudPublicKey">Supabase Publishable key</label>' +
      '<input id="cloudPublicKey" type="password" autocomplete="off" spellcheck="false" placeholder="sb_publishable_...">' +
      '<p class="muted tiny">OCR.Space 키나 service_role 키를 넣지 마세요.</p>' +
      '<button class="primary" type="submit">연결 저장</button></form>',
    "cloud-config",
  );
}
