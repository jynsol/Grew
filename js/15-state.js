/*
 * 앱 상태와 저장: 현재 화면·선택·데이터(state), 불러오기·저장(commit).
 */

const KEY = "songrim.prototype.v3";

let forestEditMode = false,
  forestVisibilityObserver = null;

const typeName = { book: "책", movie: "영화" },
  statusName = { all: "전체", saved: "시작 전", active: "감상 중", done: "완료" };

let pendingForestArrival = null;

let state = Model.empty(),
  view = "today",
  detailId = null,
  detailOrigin = "scrap",
  picking = false,
  year = String(new Date().getFullYear()),
  month = Model.today().slice(0, 7),
  modal = null,
  zoomState = { scale: 1, x: 0, y: 0 },
  storageOK = true,
  toastTimer,
  undoAction = null,
  shareBlob = null,
  shareURL = null,
  photoFiles = [],
  ocrGeneration = 0,
  ocrBusy = false,
  candidates = [],
  authMode = false,
  candidatePreview = null,
  candidatePreviewReturn = null;

function load() {
  cloudSession = loadCloudSession();
  activateDataOwner(cloudSession?.user?.id || "local");
  // Retain the original shared snapshot for review by the session present at migration.
  try {
    if (localStorage.getItem(KEY) && cloudSession?.user?.id && !localStorage.getItem(KEY + ".legacy-owner"))
      localStorage.setItem(KEY + ".legacy-owner", cloudSession.user.id);
  } catch {}
  // The pre-account shared key remains untouched for explicit backup/recovery.
  ensureCompletedSpeciesAssignments();
  remapDefaultSpeciesByCategory();
}

function get(id) {
  return Model.get(state, id);
}

function commit(close = false) {
  if (!persist()) return false;
  if (close) closeModal();
  render();
  return true;
}
