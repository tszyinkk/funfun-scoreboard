const STORAGE_KEY = "funfun-scoreboard-v1";
const MAHJONG_ARCHIVE_KEY = "funfun-scoreboard-mahjong-archive-v1";
const COLORS = ["#ff6a3d", "#c9f558", "#67c8ff", "#c99bff", "#ffcf4a", "#57d6a3", "#ff8fbd", "#8ea0ff"];
const HK_SCORING_MODES = ["hk-table", "hk-half-spicy", "hk-full-spicy"];
const MAHJONG_SCORING_LABELS = {
  "hk-table": "簡易級別（預設）",
  "hk-half-spicy": "半辣上（香港朋友枱常見）",
  "hk-full-spicy": "辣辣上（每番跳一倍）",
  doubling: "舊式逐番倍增",
  linear: "自訂線性計分",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let state = null;
let undoStack = [];
let customCount = 3;
let pendingConfirmAction = null;
let pendingCancelAction = null;
let toastTimer = null;
let settingsParticipantsDraft = [];
let timerTicker = null;
let lockedScrollPosition = 0;
let activeScoreGesture = null;
let suppressScoreClick = false;
let isHomeVisible = false;
let waitingForServiceWorkerUpdate = false;
let chooserTouches = new Map();
let chooserCountdownTimer = null;
let chooserCountdown = 0;
let nextFingerNumber = 1;

const elements = {
  scoreGrid: $("#scoreGrid"),
  appMain: $("#appMain"),
  topbar: $(".topbar"),
  topActions: $(".top-actions"),
  matchHeading: $(".match-heading"),
  matchControls: $("#matchControls"),
  roundHistory: $("#roundHistory"),
  sportsLandscapeBoard: $("#sportsLandscapeBoard"),
  sportsLandscapeLeft: $("#sportsLandscapeLeft"),
  sportsLandscapeRight: $("#sportsLandscapeRight"),
  sportsLandscapeActions: $("#sportsLandscapeActions"),
  sportsLandscapeHeading: $("#sportsLandscapeHeading"),
  sportsLandscapeTimer: $("#sportsLandscapeTimer"),
  sportsLandscapeControls: $("#sportsLandscapeControls"),
  rotatePrompt: $("#rotatePrompt"),
  homeView: $("#homeView"),
  homeCurrent: $("#homeCurrent"),
  homeCurrentTitle: $("#homeCurrentTitle"),
  homeCurrentMeta: $("#homeCurrentMeta"),
  homeButton: $("#homeButton"),
  homeNewButton: $("#homeNewButton"),
  homeContinueButton: $("#homeContinueButton"),
  mahjongArchive: $("#mahjongArchive"),
  mahjongArchiveList: $("#mahjongArchiveList"),
  mahjongRecordModal: $("#mahjongRecordModal"),
  mahjongRecordContent: $("#mahjongRecordContent"),
  mahjongScoringModal: $("#mahjongScoringModal"),
  mahjongOpenScoringButton: $("#mahjongOpenScoringButton"),
  matchTitle: $("#matchTitle"),
  roundLabel: $("#roundLabel"),
  playerCountLabel: $("#playerCountLabel"),
  modeLabel: $("#modeLabel"),
  timerDisplay: $("#timerDisplay"),
  timerBar: $("#timerBar"),
  timerToggleButton: $("#timerToggleButton"),
  timerToggleLabel: $("#timerToggleLabel"),
  connectionBadge: $("#connectionBadge"),
  connectionLabel: $("#connectionLabel"),
  historyContent: $("#historyContent"),
  undoButton: $("#undoButton"),
  setupModal: $("#setupModal"),
  setupCloseButton: $("#setupCloseButton"),
  settingsModal: $("#settingsModal"),
  confirmModal: $("#confirmModal"),
  toast: $("#toast"),
  chooserPanel: $("#chooserPanel"),
  chooserStatus: $("#chooserStatus"),
  chooserResult: $("#chooserResult"),
  touchArena: $("#touchArena"),
  touchPoints: $("#touchPoints"),
  mahjongPanel: $("#mahjongPanel"),
  mahjongEntryForm: $("#mahjongEntryForm"),
  mahjongWinner: $("#mahjongWinner"),
  mahjongDiscarder: $("#mahjongDiscarder"),
  mahjongDealer: $("#mahjongDealer"),
  mahjongWinType: $("#mahjongWinType"),
  mahjongDiscarderField: $("#mahjongDiscarderField"),
  mahjongPatternChoices: $("#mahjongPatternChoices"),
  mahjongPatternEditor: $("#mahjongPatternEditor"),
  setupMahjongPatternEditor: $("#setupMahjongPatternEditor"),
  mahjongPreview: $("#mahjongPreview"),
  mahjongProgress: $("#mahjongProgress"),
  mahjongSessionBar: $("#mahjongSessionBar"),
  mahjongSettlement: $("#mahjongSettlement"),
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function participant(name, index) {
  return { id: uid(), name, color: COLORS[index % COLORS.length], score: 0, total: 0 };
}

function defaultMahjongRules() {
  return {
    prevailingWind: "east",
    minimumFan: 3,
    basePoints: 1,
    fanStep: 2,
    scoringMode: "hk-table",
    maxFan: 13,
    maxPoints: 0,
    selfDrawFan: 1,
    flowerFan: 1,
    dealerWinMultiplier: 1,
    dealerLoseMultiplier: 1,
    selfDrawMultiplier: 1,
    discardMultiplier: 1,
    ronPaymentMode: "discarder",
    patterns: [
      { id: "chicken", label: "雞糊", fan: 0, enabled: true },
      { id: "pinghu", label: "平糊", fan: 1, enabled: true },
      { id: "no-flower", label: "無花", fan: 1, enabled: true },
      { id: "proper-flower", label: "正花", fan: 1, enabled: true },
      { id: "concealed", label: "門前清", fan: 1, enabled: true },
      { id: "dragon-pung", label: "番牌（三元牌）", fan: 1, enabled: true },
      { id: "seat-wind", label: "門風（自己位）", fan: 1, enabled: true },
      { id: "prevailing-wind", label: "圈風（大圈）", fan: 1, enabled: true },
      { id: "rob-kong", label: "搶槓", fan: 1, enabled: true },
      { id: "one-flower-set", label: "一台花", fan: 2, enabled: true },
      { id: "kong-draw", label: "槓上開花", fan: 2, enabled: true, selfDrawIncluded: true },
      { id: "last-tile", label: "海底撈月", fan: 2, enabled: true, selfDrawIncluded: true },
      { id: "seven-flowers", label: "花糊", fan: 3, enabled: true, selfDrawIncluded: true },
      { id: "seven-pairs", label: "七對子", fan: 3, enabled: true },
      { id: "all-pungs", label: "對對糊", fan: 3, enabled: true },
      { id: "half-flush", label: "混一色", fan: 3, enabled: true },
      { id: "human-hand", label: "人糊", fan: 3, enabled: true },
      { id: "terminals-honors", label: "花么九", fan: 4, enabled: true },
      { id: "small-dragons", label: "小三元", fan: 5, enabled: true },
      { id: "small-winds", label: "小四喜", fan: 6, enabled: true },
      { id: "full-flush", label: "清一色", fan: 7, enabled: true },
      { id: "big-dragons", label: "大三元", fan: 8, enabled: true },
      { id: "big-flower", label: "大花糊／八仙過海", fan: 8, enabled: true, selfDrawIncluded: true },
      { id: "concealed-pungs", label: "坎坎糊（四暗刻）", fan: 8, enabled: true, selfDrawIncluded: true },
      { id: "kong-on-kong", label: "槓上槓自摸", fan: 8, enabled: true, selfDrawIncluded: true },
      { id: "mixed-terminals", label: "混么九", fan: 9, enabled: true },
      { id: "all-honors", label: "字一色", fan: 10, enabled: true },
      { id: "pure-terminals", label: "清么九", fan: 10, enabled: true },
      { id: "nine-gates", label: "九子連環／九蓮寶燈", fan: 10, enabled: true },
      { id: "big-winds", label: "大四喜", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "thirteen-orphans", label: "十三么", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "heavenly-hand", label: "天糊", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "earthly-hand", label: "地糊", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "four-kongs", label: "十八羅漢／四槓子", fan: 13, enabled: true, selfDrawIncluded: true },
    ],
  };
}

function sanitizeMahjongRules(rules = {}) {
  const defaults = defaultMahjongRules();
  const number = (key, min, max) => {
    const value = Number(rules[key]);
    if (!Number.isFinite(value)) return defaults[key];
    return Math.min(max, Math.max(min, value));
  };
  const suppliedPatterns = Array.isArray(rules.patterns) ? rules.patterns : [];
  const patterns = defaults.patterns.map((defaultPattern) => {
    const supplied = suppliedPatterns.find((pattern) => pattern?.id === defaultPattern.id);
    const suppliedFan = Number(supplied?.fan);
    const migratedLegacyNineGates = defaultPattern.id === "nine-gates"
      && supplied?.label === "九子連環"
      && suppliedFan === 13;
    const fan = migratedLegacyNineGates ? defaultPattern.fan : suppliedFan;
    return {
      ...defaultPattern,
      label: String(migratedLegacyNineGates ? defaultPattern.label : supplied?.label || defaultPattern.label).slice(0, 24),
      fan: Number.isFinite(fan) ? Math.min(99, Math.max(0, Math.round(fan))) : defaultPattern.fan,
      enabled: supplied?.enabled !== false,
    };
  });
  return {
    prevailingWind: ["east", "south", "west", "north"].includes(rules.prevailingWind) ? rules.prevailingWind : defaults.prevailingWind,
    minimumFan: Math.round(number("minimumFan", 0, 99)),
    basePoints: number("basePoints", 0, 999999),
    fanStep: number("fanStep", 1, 10),
    scoringMode: [...HK_SCORING_MODES, "doubling", "linear"].includes(rules.scoringMode) ? rules.scoringMode : defaults.scoringMode,
    maxFan: Math.round(number("maxFan", 0, 99)),
    maxPoints: number("maxPoints", 0, 999999),
    selfDrawFan: Math.round(number("selfDrawFan", 0, 99)),
    flowerFan: Math.round(number("flowerFan", 0, 99)),
    dealerWinMultiplier: number("dealerWinMultiplier", 0, 20),
    dealerLoseMultiplier: number("dealerLoseMultiplier", 0, 20),
    selfDrawMultiplier: number("selfDrawMultiplier", 0, 20),
    discardMultiplier: number("discardMultiplier", 0, 20),
    ronPaymentMode: rules.ronPaymentMode === "all" ? "all" : "discarder",
    patterns,
  };
}

function freshState(preset, title, count = 2, teamNames = {}) {
  const isCards = preset === "cards";
  const isMahjong = preset === "mahjong";
  const isChooser = preset === "chooser";
  const size = preset === "sports" ? 2 : isCards || isMahjong ? 4 : isChooser ? 0 : count;
  const names = preset === "sports"
    ? [teamNames.home, teamNames.away].map((name, index) => String(name || "").trim().slice(0, 18) || (index === 0 ? "主隊" : "客隊"))
    : Array.from({ length: size }, (_, index) => `玩家 ${index + 1}`);

  return {
    title: title.trim() || (isCards || isMahjong ? "今晚開枱" : isChooser ? "首家抽籤" : "今晚開波"),
    kind: preset,
    totalMode: isCards || isMahjong ? "cumulative" : "winner",
    winnerRule: "highest",
    round: 1,
    timer: { elapsed: 0, running: false, startedAt: null },
    participants: names.map((name, index) => participant(name, index)),
    history: [],
    mahjong: defaultMahjongRules(),
    mahjongSession: null,
    chooser: { resultId: "", resultName: "", resultFingerNumber: 0, resultX: 0, resultY: 0, drawnAt: null },
  };
}

function sanitizeState(candidate) {
  if (!candidate || !Array.isArray(candidate.participants)) return null;
  const kind = ["sports", "cards", "custom", "mahjong", "chooser"].includes(candidate.kind) ? candidate.kind : "custom";
  if (kind !== "chooser" && candidate.participants.length < 2) return null;
  const elapsed = Math.max(0, Math.floor(Number(candidate.timer?.elapsed) || 0));
  const startedAt = Number(candidate.timer?.startedAt);
  const timerIsRunning = candidate.timer?.running === true && Number.isFinite(startedAt) && startedAt > 0;
  const resultFingerNumber = Math.max(0, Math.floor(Number(candidate.chooser?.resultFingerNumber) || 0));
  const participants = (kind === "chooser" ? [] : candidate.participants.slice(0, 8)).map((item, index) => ({
    id: String(item.id || uid()),
    name: String(item.name || `玩家 ${index + 1}`).slice(0, 18),
    color: COLORS.includes(item.color) ? item.color : COLORS[index % COLORS.length],
    score: kind === "mahjong" ? Number(item.score) || 0 : Math.max(0, Number(item.score) || 0),
    total: kind === "mahjong" ? Number(item.total) || 0 : Math.max(0, Number(item.total) || 0),
  }));
  while (kind === "mahjong" && participants.length < 4) participants.push(participant(`玩家 ${participants.length + 1}`, participants.length));
  const history = Array.isArray(candidate.history) ? candidate.history.slice(-1000) : [];
  const storedMahjong = candidate.mahjong && typeof candidate.mahjong === "object" ? candidate.mahjong : {};
  // Older saved games did not identify the scoring system. Keep their original
  // per-fan doubling behaviour, while every newly created game uses the HK table.
  const mahjongSource = kind === "mahjong" && !Object.prototype.hasOwnProperty.call(storedMahjong, "scoringMode")
    ? { ...storedMahjong, scoringMode: "doubling" }
    : storedMahjong;
  const mahjong = sanitizeMahjongRules(mahjongSource);
  const mahjongSession = kind === "mahjong"
    ? sanitizeMahjongSession(candidate.mahjongSession, history, participants, mahjong.prevailingWind)
    : null;
  return {
    title: String(candidate.title || "我的計分板").slice(0, 30),
    kind,
    totalMode: ["winner", "cumulative", "manual"].includes(candidate.totalMode) ? candidate.totalMode : "manual",
    winnerRule: candidate.winnerRule === "lowest" ? "lowest" : "highest",
    round: Math.max(1, Number(candidate.round) || 1),
    timer: { elapsed, running: timerIsRunning, startedAt: timerIsRunning ? startedAt : null },
    participants,
    history,
    mahjong,
    mahjongSession,
    chooser: {
      resultId: String(candidate.chooser?.resultId || ""),
      resultName: kind === "chooser"
        ? (resultFingerNumber ? `手指 ${resultFingerNumber}` : "")
        : String(candidate.chooser?.resultName || "").slice(0, 18),
      resultFingerNumber,
      resultX: Math.min(100, Math.max(0, Number(candidate.chooser?.resultX) || 0)),
      resultY: Math.min(100, Math.max(0, Number(candidate.chooser?.resultY) || 0)),
      drawnAt: candidate.chooser?.drawnAt || null,
    },
  };
}

function newMahjongSession({ plannedCycles = 1, lengthMode = "east", plannedHands = 0, startingWind = "east", startedAt = new Date().toISOString() } = {}) {
  const cleanLengthMode = ["east", "half", "custom-hands", "legacy-cycles"].includes(lengthMode) ? lengthMode : "east";
  return {
    lengthMode: cleanLengthMode,
    plannedCycles: [0, 1, 2, 4, 8].includes(Number(plannedCycles)) ? Number(plannedCycles) : 1,
    plannedHands: cleanLengthMode === "custom-hands"
      ? Math.min(999, Math.max(1, Math.floor(Number(plannedHands) || 16)))
      : 0,
    startingWind: MahjongCore.WINDS.includes(startingWind) ? startingWind : "east",
    completedCycles: 0,
    handsInCycle: 0,
    dealerIdsInCycle: [],
    completedHands: 0,
    lastPromptedCycles: 0,
    lastPromptedHands: 0,
    nextDealerId: "",
    startedAt,
    settledAt: null,
    durationMs: 0,
    status: "active",
    earlyEnded: false,
    draft: { touched: false, values: {} },
    archiveRecordId: "",
  };
}

function sanitizeMahjongSession(saved, history, participants, startingWind = "east") {
  const ids = participants.map((player) => player.id);
  const derived = newMahjongSession({ startingWind, startedAt: history[0]?.createdAt || new Date().toISOString() });
  let progress = derived;
  history.forEach((hand) => {
    if (!hand?.mahjong) return;
    progress = MahjongCore.advanceProgress(progress, hand.mahjong.dealerId || hand.dealerId, ids);
  });
  const lastHand = [...history].reverse().find((hand) => hand?.mahjong?.dealerId);
  if (lastHand) {
    const dealerId = lastHand.mahjong.dealerId;
    if (lastHand.mahjong.winType === "draw" || lastHand.mahjong.winnerId === dealerId) progress.nextDealerId = dealerId;
    else {
      const dealerIndex = ids.indexOf(dealerId);
      progress.nextDealerId = dealerIndex >= 0 ? ids[(dealerIndex + 1) % ids.length] : "";
    }
  }
  const session = saved && typeof saved === "object" ? saved : {};
  const draft = session.draft && typeof session.draft === "object" ? session.draft : {};
  const knownHandCount = history.filter((hand) => hand?.mahjong).length;
  const hasSavedProgress = Number.isFinite(Number(session.completedHands))
    || Number.isFinite(Number(session.completedCycles))
    || Array.isArray(session.dealerIdsInCycle);
  const base = hasSavedProgress
    ? session
    : { ...progress, lengthMode: "legacy-cycles", plannedCycles: 4, lastPromptedCycles: progress.completedCycles };
  const lengthMode = ["east", "half", "custom-hands", "legacy-cycles"].includes(base.lengthMode) ? base.lengthMode : "legacy-cycles";
  const savedPlannedCycles = Number(base.plannedCycles);
  return {
    ...derived,
    ...base,
    lengthMode,
    plannedCycles: [0, 1, 2, 4, 8].includes(savedPlannedCycles) ? savedPlannedCycles : 4,
    plannedHands: lengthMode === "custom-hands"
      ? Math.min(999, Math.max(1, Math.floor(Number(base.plannedHands) || 16)))
      : 0,
    startingWind: MahjongCore.WINDS.includes(base.startingWind) ? base.startingWind : startingWind,
    completedCycles: Math.max(0, Math.floor(Number(base.completedCycles) || 0)),
    handsInCycle: Math.max(0, Math.floor(Number(base.handsInCycle) || 0)),
    dealerIdsInCycle: Array.isArray(base.dealerIdsInCycle) ? base.dealerIdsInCycle.filter((id) => ids.includes(id)) : [],
    completedHands: Math.max(knownHandCount, Math.floor(Number(base.completedHands) || 0)),
    lastPromptedCycles: Math.max(0, Math.floor(Number(base.lastPromptedCycles) || 0)),
    lastPromptedHands: Math.max(0, Math.floor(Number(base.lastPromptedHands) || 0)),
    nextDealerId: ids.includes(base.nextDealerId) ? base.nextDealerId : "",
    startedAt: base.startedAt || derived.startedAt,
    settledAt: base.settledAt || null,
    durationMs: Math.max(0, Number(base.durationMs) || 0),
    status: base.status === "settled" ? "settled" : "active",
    earlyEnded: base.earlyEnded === true,
    draft: { touched: draft.touched === true, values: draft.values && typeof draft.values === "object" ? draft.values : {} },
    archiveRecordId: String(base.archiveRecordId || ""),
  };
}

function loadState() {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The scoreboard still works if storage is unavailable (for example in private browsing).
  }
}

function clearStoredState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage restrictions; the in-memory scoreboard can still be replaced.
  }
}

function loadMahjongArchive() {
  try {
    const saved = JSON.parse(localStorage.getItem(MAHJONG_ARCHIVE_KEY));
    return Array.isArray(saved) ? saved.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveMahjongArchive(archive = loadMahjongArchive()) {
  try { localStorage.setItem(MAHJONG_ARCHIVE_KEY, JSON.stringify(archive.slice(0, 50))); } catch { /* Records stay available in this session if storage is full. */ }
}

let mahjongArchive = loadMahjongArchive();

function updateHome() {
  if (!elements.homeCurrent) return;
  elements.homeCurrent.hidden = !state;
  renderMahjongArchiveList();
  if (!state) return;
  elements.homeCurrentTitle.textContent = state.title;
  const modeText = state.kind === "mahjong" ? "香港麻雀" : state.kind === "chooser" ? "首家抽籤" : "普通計分";
  const settled = state.kind === "mahjong" && state.mahjongSession?.status === "settled";
  elements.homeContinueButton.textContent = settled ? "查看結算" : "繼續計分";
  elements.homeCurrentMeta.textContent = state.kind === "chooser"
    ? "任意位置多指觸控抽首家"
    : state.kind === "mahjong"
      ? `${modeText}・${state.participants.length} 人・${settled ? "已結算" : MahjongCore.progressLabel(state.mahjongSession, state.participants.map((player) => player.id))}`
      : `${modeText}・${state.participants.length} 人／隊・第 ${state.round} 局`;
}

function renderMahjongArchiveList() {
  if (!elements.mahjongArchiveList) return;
  mahjongArchive = loadMahjongArchive();
  elements.mahjongArchive.hidden = mahjongArchive.length === 0;
  elements.mahjongArchiveList.replaceChildren();
  mahjongArchive.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mahjong-archive-card";
    button.dataset.recordId = record.id;
    const title = document.createElement("strong");
    title.textContent = record.title || "今晚開枱";
    const meta = document.createElement("small");
    const date = record.settledAt ? new Date(record.settledAt).toLocaleString("zh-HK") : "已結算";
    const plan = record.lengthMode === "custom-hands"
      ? `原訂${record.plannedHands || 0}局`
      : record.lengthMode === "half"
        ? "半莊"
        : record.lengthMode === "east"
          ? "東圈"
          : "舊圈數設定";
    meta.textContent = `${record.earlyEnded ? "提早結束・" : "完成結算・"}${record.completedHands || 0} 局・${plan}・${date}`;
    button.append(title, meta);
    elements.mahjongArchiveList.appendChild(button);
  });
}

function sportsLandscapeMatches() {
  return window.matchMedia?.("(orientation: landscape)").matches === true;
}

function sportsPortraitPromptMatches() {
  return window.matchMedia?.("(orientation: portrait) and (max-width: 850px)").matches === true;
}

function syncSportsLayout() {
  const landscape = Boolean(state && !isHomeVisible && state.kind === "sports" && sportsLandscapeMatches());
  const rotatePrompt = Boolean(state && !isHomeVisible && state.kind === "sports" && !landscape && sportsPortraitPromptMatches());
  const chooserActive = Boolean(state && !isHomeVisible && state.kind === "chooser");
  document.body.classList.toggle("sports-landscape-active", landscape);
  document.body.classList.toggle("sports-portrait-active", rotatePrompt);
  document.body.classList.toggle("chooser-active", chooserActive);
  elements.sportsLandscapeBoard.hidden = !landscape;
  elements.rotatePrompt.hidden = !rotatePrompt;

  if (landscape) {
    elements.topbar.hidden = true;
    elements.appMain.hidden = true;
    elements.sportsLandscapeHeading.append(elements.matchHeading);
    elements.sportsLandscapeTimer.append(elements.timerBar);
    elements.sportsLandscapeControls.append(elements.matchControls);
    elements.sportsLandscapeActions.append(elements.topActions);
  } else {
    elements.topbar.hidden = false;
    elements.appMain.hidden = isHomeVisible || rotatePrompt;
    elements.topbar.append(elements.topActions);
    elements.appMain.append(
      elements.matchHeading,
      elements.timerBar,
      elements.chooserPanel,
      elements.mahjongPanel,
      elements.scoreGrid,
      elements.matchControls,
      elements.roundHistory,
    );
    [...elements.sportsLandscapeLeft.children, ...elements.sportsLandscapeRight.children].forEach((card) => elements.scoreGrid.append(card));
  }
}

function setHomeVisible(visible) {
  isHomeVisible = visible;
  document.body.classList.toggle("mahjong-minimal-active", !visible && state?.kind === "mahjong");
  elements.homeView.hidden = !visible;
  $("main").hidden = visible;
  $("footer").hidden = visible;
  elements.homeButton.hidden = visible || !state;
  elements.undoButton.hidden = visible;
  $("#settingsButton").hidden = visible;
  syncSportsLayout();
  updateHome();
  reloadForServiceWorkerUpdateIfSafe();
}

function reloadForServiceWorkerUpdateIfSafe() {
  if (!waitingForServiceWorkerUpdate || !isHomeVisible || $(".modal-backdrop.is-open")) return;
  window.location.reload();
}

function showHome() {
  if (elements.setupModal.classList.contains("is-open")) closeModal("setupModal");
  if (elements.settingsModal.classList.contains("is-open")) closeModal("settingsModal");
  if (elements.mahjongScoringModal.classList.contains("is-open")) closeModal("mahjongScoringModal");
  try { screen.orientation?.unlock?.(); } catch { /* Orientation lock is not supported on every device. */ }
  exitAppFullscreen();
  setHomeVisible(true);
}

function showScoreboard() {
  setHomeVisible(false);
  if (state?.kind === "sports") requestSportsLandscape();
  else {
    screen.orientation?.unlock?.();
    if (state?.kind === "chooser") requestAppFullscreen();
  }
  render();
}

function requestSportsLandscape() {
  const fullscreenRequest = requestAppFullscreen();
  Promise.resolve(fullscreenRequest).then(() => {
    try {
      const lockRequest = screen.orientation?.lock?.("landscape");
      lockRequest?.catch(() => {});
    } catch {
      // CSS shows a rotate prompt on devices that do not support orientation locking.
    }
  });
}

function requestAppFullscreen() {
  try {
    const request = document.documentElement.requestFullscreen?.();
    return request ? request.catch(() => {}) : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

function exitAppFullscreen() {
  try {
    const request = document.exitFullscreen?.();
    request?.catch(() => {});
  } catch {
    // Installed web apps may use display-mode fullscreen without a Fullscreen API element.
  }
}

function resetSetupForm(preset = "sports") {
  $("#setupForm").reset();
  setMahjongScoringControls($("#setupForm"), "hk-table");
  $("#setupMahjongAdvanced").open = false;
  renderMahjongPatternEditor(elements.setupMahjongPatternEditor, defaultMahjongRules().patterns);
  $("#setupName").value = preset === "chooser" ? "首家抽籤" : ["mahjong", "cards"].includes(preset) ? "今晚開枱" : preset === "custom" ? "自訂比賽" : "今晚開波";
  customCount = 3;
  $("#countOutput").textContent = customCount;
  const presetInput = $(`input[name="preset"][value="${preset}"]`, $("#setupForm"));
  if (presetInput) presetInput.checked = true;
  updateSetupFromPreset();
}

function beginNewActivity(preset = "sports") {
  const openSetup = () => {
    if (state?.kind === "mahjong" && state.mahjongSession?.status !== "settled") {
      settleMahjongGame(isMahjongEarly(state.mahjongSession));
    }
    clearStoredState();
    undoStack = [];
    state = null;
    resetSetupForm(preset);
    elements.setupCloseButton.hidden = true;
    setHomeVisible(true);
    openModal("setupModal");
  };
  if (state) {
    openConfirm({
      title: "開新活動？",
      message: state.kind === "mahjong" && state.mahjongSession?.status !== "settled"
        ? "已完成牌局會先儲存到主頁的「麻雀對局紀錄」；未完成輸入不會計入。確定要開始另一個玩法嗎？"
        : "目前活動的分數及紀錄會清除，確定要開始另一個玩法嗎？",
      acceptText: "開新活動",
      icon: "＋",
      action: openSetup,
    });
  } else openSetup();
}

function snapshot() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 50) undoStack.shift();
  elements.undoButton.disabled = false;
}

function render() {
  if (!state) {
    updateHome();
    return;
  }
  syncSportsLayout();
  const sportsLandscape = document.body.classList.contains("sports-landscape-active");
  elements.matchTitle.textContent = state.title;
  elements.roundLabel.textContent = `第 ${state.round} 局`;
  elements.playerCountLabel.textContent = state.kind === "chooser"
    ? "多人手指抽籤"
    : state.kind === "mahjong" ? `${state.participants.length} 位玩家` : `${state.participants.length} 個計分格`;
  elements.modeLabel.textContent = state.kind === "mahjong" ? "香港牌計番" : state.kind === "chooser" ? "隨機抽首家" : ({ winner: "勝方 +1", cumulative: "累加本局", manual: "手動總分" })[state.totalMode];
  const specialMode = state.kind === "mahjong" || state.kind === "chooser";
  const mahjongActive = state.kind === "mahjong";
  document.body.classList.toggle("mahjong-minimal-active", mahjongActive && !isHomeVisible);
  elements.matchHeading.hidden = mahjongActive;
  elements.timerBar.hidden = specialMode;
  elements.matchControls.hidden = specialMode;
  const mahjongSettled = state.kind === "mahjong" && state.mahjongSession?.status === "settled";
  elements.roundHistory.hidden = state.kind === "chooser" || state.kind === "mahjong" || sportsLandscape;
  elements.scoreGrid.hidden = state.kind === "chooser" || sportsLandscape || mahjongSettled;
  elements.mahjongPanel.hidden = state.kind !== "mahjong";
  elements.chooserPanel.hidden = state.kind !== "chooser";
  $("#settingsButton").hidden = isHomeVisible || !state || mahjongSettled;
  elements.undoButton.hidden = isHomeVisible || mahjongSettled;
  $("#clearHistoryButton").hidden = state.kind === "mahjong";
  if (state.kind === "mahjong") $("#historyTitle").textContent = "牌局紀錄";
  updateTimerDisplay();
  renderScoreCards();
  renderHistory();
  if (state.kind === "mahjong") renderMahjongEntry();
  if (state.kind === "chooser") renderChooser();
  elements.undoButton.disabled = undoStack.length === 0;
  saveState();
  updateHome();
}

function renderScoreCards() {
  elements.scoreGrid.replaceChildren();
  elements.scoreGrid.dataset.count = String(state.participants.length);
  elements.scoreGrid.classList.toggle("mahjong-score-grid", state.kind === "mahjong");
  elements.sportsLandscapeLeft.replaceChildren();
  elements.sportsLandscapeRight.replaceChildren();
  const landscapeTarget = document.body.classList.contains("sports-landscape-active");

  if (state.kind === "mahjong") {
    state.participants.forEach((player, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "mahjong-player-card";
      card.dataset.id = player.id;
      card.style.setProperty("--player-color", player.color);
      card.setAttribute("aria-label", `${player.name}，總分 ${formatPoints(player.total)}，按一下記錄食糊`);
      const icon = document.createElement("span");
      icon.className = "mahjong-player-icon";
      icon.textContent = String(index + 1);
      const name = document.createElement("strong");
      name.textContent = player.name;
      const score = document.createElement("b");
      score.textContent = formatPoints(player.total);
      const hint = document.createElement("small");
      hint.textContent = "按玩家開始計番";
      card.append(icon, name, score, hint);
      elements.scoreGrid.appendChild(card);
    });
    return;
  }

  state.participants.forEach((player, index) => {
    const fragment = $("#scoreCardTemplate").content.cloneNode(true);
    const card = $(".score-card", fragment);
    card.style.setProperty("--player-color", player.color);
    card.dataset.id = player.id;
    $(".total-score", card).hidden = false;
    $(".player-index", card).textContent = String(index + 1).padStart(2, "0");
    $(".player-name", card).textContent = player.name;
    $(".score-number", card).textContent = player.score;
    $(".total-score strong", card).textContent = player.total;
    $(".score-display", card).setAttribute("aria-label", `${player.name} 現時 ${player.score} 分，按一下加一分`);
    $(".score-tap-hint", card).textContent = "按一下 ＋1";
    const minusButton = $(".minus-button", card);
    minusButton.textContent = "按錯？減 1 分";
    minusButton.setAttribute("aria-label", `${player.name} 減一分`);
    $(".total-plus", card).setAttribute("aria-label", `${player.name} 總分加一`);
    $(".total-minus", card).setAttribute("aria-label", `${player.name} 總分減一`);
    const target = landscapeTarget ? (index === 0 ? elements.sportsLandscapeLeft : elements.sportsLandscapeRight) : elements.scoreGrid;
    target.appendChild(fragment);
  });
}

function currentElapsedSeconds() {
  if (!state?.timer) return 0;
  if (!state.timer.running || !state.timer.startedAt) return state.timer.elapsed;
  return state.timer.elapsed + Math.max(0, Math.floor((Date.now() - state.timer.startedAt) / 1000));
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const shortTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${shortTime}` : shortTime;
}

function updateTimerDisplay() {
  if (!state?.timer) return;
  elements.timerDisplay.textContent = formatTime(currentElapsedSeconds());
  elements.timerToggleButton.setAttribute("aria-pressed", String(state.timer.running));
  const timerActionLabel = state.timer.running ? "暫停計時" : "開始計時";
  elements.timerToggleButton.setAttribute("aria-label", timerActionLabel);
  elements.timerToggleButton.title = timerActionLabel;
  elements.timerToggleLabel.textContent = timerActionLabel;
  $(".timer-toggle-icon", elements.timerToggleButton).textContent = state.timer.running ? "Ⅱ" : "▶";
}

function toggleTimer() {
  if (state.timer.running) {
    state.timer.elapsed = currentElapsedSeconds();
    state.timer.running = false;
    state.timer.startedAt = null;
  } else {
    state.timer.running = true;
    state.timer.startedAt = Date.now();
  }
  updateTimerDisplay();
  saveState();
}

function renderHistory() {
  if (state.kind === "mahjong") {
    renderMahjongHistory();
    return;
  }
  if (!state.history.length) {
    elements.historyContent.innerHTML = `
      <div class="history-empty">
        <p><span>◇</span>完成第一局後，比分會顯示在這裡</p>
      </div>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["局數", ...state.participants.map((player) => player.name), "勝方"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  [...state.history].reverse().forEach((round) => {
    const row = document.createElement("tr");
    const roundCell = document.createElement("td");
    roundCell.textContent = `第 ${round.number} 局`;
    row.appendChild(roundCell);

    state.participants.forEach((player) => {
      const scoreCell = document.createElement("td");
      const saved = round.scores.find((entry) => entry.id === player.id);
      scoreCell.textContent = saved ? saved.score : "—";
      row.appendChild(scoreCell);
    });

    const winnerCell = document.createElement("td");
    winnerCell.className = "winner-cell";
    winnerCell.textContent = round.winners?.join("・") || "—";
    row.appendChild(winnerCell);
    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  elements.historyContent.replaceChildren(table);
}

function formatPoints(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function displayMahjongPatternLabel(pattern, wind) {
  if (pattern.id === "prevailing-wind" && pattern.label.startsWith("圈風")) {
    return `圈風（${MahjongCore.WIND_NAMES[wind] || "東圈"}）`;
  }
  return pattern.label;
}

function calculateMahjongHand({ winnerId, winType, discarderId, dealerId, handFan, patternFan = 0, patternIncludesSelfDraw = false, flowers, fanAdjustment = 0 }) {
  const rules = state.mahjong;
  if (winType === "draw") {
    return { valid: true, fan: 0, rawFan: 0, cappedByLimit: false, bonusFan: 0, patternFan: 0, points: 0, net: Object.fromEntries(state.participants.map((player) => [player.id, 0])), winner: null, discarder: null };
  }
  const cleanHandFan = Math.max(0, Math.round(Number(handFan) || 0));
  const cleanPatternFan = Math.max(0, Math.round(Number(patternFan) || 0));
  const cleanFlowers = Math.max(0, Math.round(Number(flowers) || 0));
  const cleanFanAdjustment = Math.round(Number(fanAdjustment) || 0);
  const selfDrawBonus = winType === "self" && !patternIncludesSelfDraw ? rules.selfDrawFan : 0;
  const bonusFan = cleanPatternFan + selfDrawBonus + cleanFlowers * rules.flowerFan;
  const rawFan = Math.max(0, cleanHandFan + bonusFan + cleanFanAdjustment);
  const score = MahjongCore.scoreForFan({
    rawFan,
    minimumFan: rules.minimumFan,
    maxFan: rules.maxFan,
    basePoints: rules.basePoints,
    fanStep: rules.fanStep,
    scoringMode: rules.scoringMode,
    maxPoints: rules.maxPoints,
  });
  const fan = score.fan;
  if (!score.valid) return { valid: false, fan, bonusFan, reason: `未夠 ${rules.minimumFan} 番起糊` };
  const cappedPoints = score.points;
  const winner = state.participants.find((player) => player.id === winnerId);
  const discarder = state.participants.find((player) => player.id === discarderId);
  if (!winner) return { valid: false, reason: "請選擇食糊者" };
  if (winType === "discard" && (!discarder || discarder.id === winner.id)) return { valid: false, reason: "出銃時要選另一位玩家" };

  const net = Object.fromEntries(state.participants.map((player) => [player.id, 0]));
  const dealerWinMultiplier = dealerId === winner.id ? rules.dealerWinMultiplier : 1;
  if (winType === "self") {
    state.participants.forEach((player) => {
      if (player.id === winner.id) return;
      const dealerMultiplier = player.id === dealerId ? rules.dealerLoseMultiplier : 1;
      const payment = cappedPoints * rules.selfDrawMultiplier * dealerWinMultiplier * dealerMultiplier;
      net[player.id] -= payment;
      net[winner.id] += payment;
    });
  } else {
    const payers = state.participants.filter((player) => player.id !== winner.id && (rules.ronPaymentMode === "all" || player.id === discarder.id));
    payers.forEach((player) => {
      const dealerMultiplier = player.id === dealerId ? rules.dealerLoseMultiplier : 1;
      const discardMultiplier = player.id === discarder.id ? rules.discardMultiplier : rules.selfDrawMultiplier;
      const payment = cappedPoints * discardMultiplier * dealerWinMultiplier * dealerMultiplier;
      net[player.id] -= payment;
      net[winner.id] += payment;
    });
  }

  return { valid: true, fan, rawFan, cappedByLimit: fan < rawFan, bonusFan, patternFan: cleanPatternFan, multiplier: score.multiplier, points: cappedPoints, net, winner, discarder };
}

function renderMahjongEntry() {
  const session = state.mahjongSession || newMahjongSession({ startingWind: state.mahjong.prevailingWind });
  state.mahjongSession = session;
  const settled = session.status === "settled";
  elements.mahjongEntryForm.hidden = settled;
  elements.mahjongSessionBar.hidden = settled;
  elements.mahjongSettlement.hidden = !settled;
  if (settled) {
    if (elements.mahjongScoringModal.classList.contains("is-open")) closeModal("mahjongScoringModal");
    renderMahjongSettlement();
    return;
  }

  elements.mahjongProgress.textContent = MahjongCore.progressLabel(session, state.participants.map((player) => player.id));
  const draft = session.draft;
  const draftValues = draft?.touched ? draft.values || {} : {};
  const winnerValue = elements.mahjongWinner.value;
  const discarderValue = elements.mahjongDiscarder.value;
  const dealerValue = draft?.touched
    ? (draftValues.dealer || elements.mahjongDealer.value || session.nextDealerId || state.participants[0]?.id)
    : (session.nextDealerId || elements.mahjongDealer.value || state.participants[0]?.id);
  const selectedPatternIds = new Set(draftValues.patterns || $$("input[name='patterns']:checked", elements.mahjongPatternChoices).map((input) => input.value));
  [elements.mahjongWinner, elements.mahjongDiscarder, elements.mahjongDealer].forEach((select) => {
    select.replaceChildren();
    state.participants.forEach((player) => {
      const option = document.createElement("option");
      option.value = player.id;
      option.textContent = player.name;
      select.appendChild(option);
    });
  });
  if (state.participants.some((player) => player.id === winnerValue)) elements.mahjongWinner.value = winnerValue;
  if (state.participants.some((player) => player.id === discarderValue)) elements.mahjongDiscarder.value = discarderValue;
  if (state.participants.some((player) => player.id === dealerValue)) elements.mahjongDealer.value = dealerValue;
  if (!elements.mahjongDealer.value && state.participants[0]) elements.mahjongDealer.value = state.participants[0].id;
  if (elements.mahjongWinner.value === elements.mahjongDiscarder.value && state.participants[1]) elements.mahjongDiscarder.value = state.participants[1].id;
  ["winner", "discarder", "winType", "dealer", "handFan", "flowers", "note"].forEach((name) => {
    const control = elements.mahjongEntryForm.elements.namedItem(name);
    if (control && draftValues[name] !== undefined) control.value = draftValues[name];
  });
  if (!elements.mahjongDealer.value && state.participants[0]) elements.mahjongDealer.value = state.participants[0].id;
  elements.mahjongDiscarderField.hidden = elements.mahjongWinType.value !== "discard";
  $("#mahjongWinnerField").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongHandFanField").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongFlowersField").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongPatternFieldset").hidden = elements.mahjongWinType.value === "draw";
  elements.mahjongPatternChoices.replaceChildren();
  const currentWind = MahjongCore.windForCycle(session.startingWind || state.mahjong.prevailingWind, session.completedCycles);
  const windLabels = MahjongCore.WIND_NAMES;
  state.mahjong.patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
    const label = document.createElement("label");
    label.className = "mahjong-pattern-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "patterns";
    input.value = pattern.id;
    input.checked = selectedPatternIds.has(pattern.id);
    const text = document.createElement("span");
    text.textContent = displayMahjongPatternLabel(pattern, currentWind);
    const fan = document.createElement("strong");
    const isCappedPattern = state.mahjong.maxFan > 0 && pattern.fan > state.mahjong.maxFan;
    fan.textContent = isCappedPattern ? `${pattern.fan}→${state.mahjong.maxFan} 番` : `${pattern.fan} 番`;
    label.append(input, text, fan);
    elements.mahjongPatternChoices.appendChild(label);
  });
  const limitLabel = state.mahjong.maxFan > 0 ? `${state.mahjong.maxFan} 番封頂` : "不限番";
  $("#mahjongRuleBadge").textContent = `${windLabels[currentWind] || "東圈"}・${state.mahjong.minimumFan} 番起糊・${limitLabel}`;
  updateMahjongPreview();
}

function openMahjongScoring(winnerId = "") {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status !== "active") return;
  renderMahjongEntry();
  if (winnerId && state.participants.some((player) => player.id === winnerId)) {
    elements.mahjongWinner.value = winnerId;
    if (elements.mahjongDiscarder.value === winnerId) {
      elements.mahjongDiscarder.value = state.participants.find((player) => player.id !== winnerId)?.id || "";
    }
    captureMahjongDraft();
    updateMahjongPreview();
  }
  const winner = state.participants.find((player) => player.id === elements.mahjongWinner.value);
  $("#mahjongScoringTitle").textContent = winnerId && winner ? `為 ${winner.name} 計番` : "今局計番";
  openModal("mahjongScoringModal");
}

function updateMahjongQuickPreview(form, preview, capHelp) {
  if (!form || !preview) return;
  const data = new FormData(form);
  const minimumFan = Number(data.get("mahjongMinFan")) || 1;
  const maxFan = Number(data.get("mahjongMaxFan")) || 0;
  const basePoints = Math.max(1, Number(data.get("mahjongBasePoints")) || 1);
  const fanStep = Math.max(1, Number(data.get("mahjongFanStep")) || 2);
  const scoringMode = data.get("mahjongScoringPreset") || data.get("mahjongAdvancedScoringMode") || "hk-table";
  renderMahjongScoringTable(form, scoringMode);
  const fanList = [...new Set([minimumFan, Math.max(minimumFan, 4), maxFan > 0 ? maxFan : Math.max(minimumFan, 13)])]
    .filter((fan) => fan >= minimumFan && (maxFan === 0 || fan <= maxFan))
    .sort((left, right) => left - right);
  const examples = fanList.map((fan) => {
    const result = MahjongCore.scoreForFan({ rawFan: fan, minimumFan, maxFan, basePoints, fanStep, scoringMode, maxPoints: data.get("mahjongMaxPoints") });
    return HK_SCORING_MODES.includes(scoringMode)
      ? `${fan}番計${result.multiplier}倍`
      : `${fan}番計${Math.round(result.points)}分`;
  });
  const capText = maxFan > 0 ? `${maxFan}番封頂` : "不設上限";
  preview.textContent = `目前玩法：${minimumFan}番起糊，${capText}；例如${examples.join("、")}。`;
  if (capHelp) capHelp.textContent = maxFan > 0
    ? `實際超過${maxFan}番，都會按${maxFan}番封頂。`
    : "沿用舊設定：不設番數上限。";
}

function renderMahjongScoringTable(form, scoringMode) {
  const body = $(".mahjong-score-table tbody", form);
  const help = $("[data-scoring-style-help]", form);
  if (!body) return;
  const rows = scoringMode === "hk-half-spicy"
    ? [["3番", "1倍"], ["4番", "2倍"], ["5番", "3倍"], ["6番", "4倍"], ["7番", "6倍"], ["8番", "8倍"], ["9番", "12倍"], ["10番", "16倍"], ["11番", "24倍"], ["12番", "32倍"], ["13番或以上", "48倍／封頂"]]
    : scoringMode === "hk-full-spicy"
      ? [["3番", "1倍"], ["4番", "2倍"], ["5番", "4倍"], ["6番", "8倍"], ["7番", "16倍"], ["8番", "32倍"], ["9番", "64倍"], ["10番", "128倍"], ["11番", "256倍"], ["12番", "512倍"], ["13番或以上", "1024倍／封頂"]]
      : [["3番", "1倍"], ["4番", "2倍"], ["5–6番", "4倍"], ["7–9番", "8倍"], ["10–12番", "16倍"], ["13番或以上", "32倍／封頂"]];
  body.replaceChildren(...rows.map(([fan, multiplier]) => {
    const row = document.createElement("tr");
    const fanCell = document.createElement("td");
    const multiplierCell = document.createElement("td");
    fanCell.textContent = fan;
    multiplierCell.textContent = multiplier;
    row.append(fanCell, multiplierCell);
    return row;
  }));
  if (help) help.textContent = scoringMode === "hk-half-spicy"
    ? "四番後交替加半級、再升一倍，銀碼上升較平順。"
    : scoringMode === "hk-full-spicy"
      ? "四番後每多一番都會再跳一倍，適合想高番差距更大。"
      : "將相近番數分成同一級，最容易睇同計。";
}

function setMahjongScoringControls(form, scoringMode) {
  if (!form) return;
  const mode = [...HK_SCORING_MODES, "doubling", "linear"].includes(scoringMode) ? scoringMode : "hk-table";
  const preset = $("[name='mahjongScoringPreset']", form);
  const advanced = $("[name='mahjongAdvancedScoringMode']", form);
  if (preset) {
    let customOption = $("option[data-advanced-mode]", preset);
    if (HK_SCORING_MODES.includes(mode)) {
      customOption?.remove();
    } else {
      if (!customOption) {
        customOption = document.createElement("option");
        customOption.dataset.advancedMode = "true";
        preset.appendChild(customOption);
      }
      customOption.value = mode;
      customOption.textContent = `進階自訂：${MAHJONG_SCORING_LABELS[mode]}`;
    }
    preset.value = mode;
  }
  if (advanced) advanced.value = mode;
}

function syncMahjongScoringControls(event) {
  const form = event.currentTarget;
  if (event.target.name === "mahjongScoringPreset") {
    setMahjongScoringControls(form, event.target.value);
  } else if (event.target.name === "mahjongAdvancedScoringMode") {
    setMahjongScoringControls(form, event.target.value);
  }
}

function updateMahjongLengthFields(form, prefix) {
  if (!form) return;
  const mode = $(`[name="mahjongLengthMode"]`, form)?.value || "east";
  const customField = $(`#${prefix}MahjongCustomHandsField`);
  const help = $(`#${prefix}MahjongLengthHelp`);
  if (customField) customField.hidden = mode !== "custom-hands";
  if (!help) return;
  help.textContent = mode === "half"
    ? "半莊代表東圈加南圈；有人連莊，實際局數會增加。"
    : mode === "custom-hands"
      ? "設定牌局總數；達到局數後會詢問是否結算。"
      : mode === "legacy-cycles"
        ? "為咗保留呢場舊對局原有局數設定，會沿用原定圈數。"
        : "東圈代表四位玩家最少各做一次莊；連莊時實際局數會增加。";
}

function updateMahjongSetupPreview() {
  const form = $("#setupForm");
  if (!form || $("input[name='preset']:checked", form)?.value !== "mahjong") return;
  updateMahjongLengthFields(form, "setup");
  updateMahjongQuickPreview(form, $("#mahjongSetupPreview"), $("#mahjongCapHelp"));
}

function updateMahjongSettingsPreview() {
  const form = $("#settingsForm");
  if (!form || state?.kind !== "mahjong") return;
  updateMahjongLengthFields(form, "settings");
  updateMahjongQuickPreview(form, $("#settingsMahjongSetupPreview"), $("#settingsMahjongCapHelp"));
}

function updateMahjongPreview() {
  if (!state || state.kind !== "mahjong") return;
  const formData = new FormData(elements.mahjongEntryForm);
  const patternIds = formData.getAll("patterns");
  const selectedPatterns = state.mahjong.patterns.filter((pattern) => patternIds.includes(pattern.id));
  const patternFan = selectedPatterns.reduce((sum, pattern) => sum + pattern.fan, 0);
  const result = calculateMahjongHand({
    winnerId: formData.get("winner"),
    winType: formData.get("winType"),
    discarderId: formData.get("discarder"),
    dealerId: formData.get("dealer"),
    handFan: formData.get("handFan"),
    patternFan,
    patternIncludesSelfDraw: selectedPatterns.some((pattern) => pattern.selfDrawIncluded),
    flowers: formData.get("flowers"),
  });
  if (!result.valid) {
    elements.mahjongPreview.textContent = result.reason || "請填寫資料";
    elements.mahjongPreview.classList.add("is-invalid");
    return;
  }
  elements.mahjongPreview.classList.remove("is-invalid");
  if (formData.get("winType") === "draw") {
    elements.mahjongPreview.textContent = "流局：今局不計分，莊家留莊。";
    return;
  }
  const winnerLine = `${result.winner.name} +${Math.round(result.net[result.winner.id])}`;
  const payLine = state.participants.filter((player) => player.id !== result.winner.id && result.net[player.id] < 0)
    .map((player) => `${player.name} ${formatPoints(result.net[player.id])}`).join("・");
  const activeWind = MahjongCore.windForCycle(state.mahjongSession?.startingWind || state.mahjong.prevailingWind, state.mahjongSession?.completedCycles || 0);
  const breakdown = selectedPatterns.map((pattern) => `${displayMahjongPatternLabel(pattern, activeWind)}${pattern.fan}番`);
  const flowers = Math.max(0, Math.round(Number(formData.get("flowers")) || 0));
  if (flowers > 0 && state.mahjong.flowerFan > 0) breakdown.push(`花牌${flowers}×${state.mahjong.flowerFan}番`);
  if (formData.get("winType") === "self" && !selectedPatterns.some((pattern) => pattern.selfDrawIncluded) && state.mahjong.selfDrawFan > 0) {
    breakdown.push(`自摸${state.mahjong.selfDrawFan}番`);
  }
  const breakdownLine = breakdown.length ? `${breakdown.join("＋")}｜` : "";
  const limitLine = result.cappedByLimit ? `（原計 ${result.rawFan} 番，封頂 ${result.fan} 番）` : "";
  const multiplierLine = Number.isFinite(result.multiplier) ? `${result.multiplier}倍・` : "";
  elements.mahjongPreview.textContent = `${breakdownLine}合共 ${result.fan} 番${limitLine}｜${multiplierLine}計分 ${Math.round(result.points)} 分｜${winnerLine}${payLine ? `｜${payLine}` : ""}`;
}

function renderMahjongHistory() {
  if (!state.history.length) {
    elements.historyContent.innerHTML = `<div class="history-empty"><p><span>◇</span>記錄第一局麻雀後，賠分會顯示在這裡</p></div>`;
    return;
  }
  const list = document.createElement("div");
  list.className = "mahjong-history-list";
  [...state.history].reverse().forEach((round) => {
    const item = document.createElement("article");
    item.className = "mahjong-history-item";
    const title = document.createElement("div");
    title.className = "mahjong-history-title";
    const titleStrong = document.createElement("strong");
    titleStrong.textContent = `第 ${round.number} 局${round.cycleNumber ? `・第 ${round.cycleNumber} 圈` : ""}`;
    const titleSummary = document.createElement("span");
    const multiplierText = Number.isFinite(round.multiplier) ? `・${round.multiplier}倍` : "";
    titleSummary.textContent = round.winType === "draw" ? "流局・0 分" : `${round.winType === "self" ? "自摸" : "出銃"}・${round.fan} 番${multiplierText}・${Math.round(round.points)} 分`;
    title.append(titleStrong, titleSummary);
    const detail = document.createElement("p");
    const netLine = (round.net || []).map((entry) => `${entry.name} ${formatPoints(entry.amount)}`).join("　");
    const patternLine = round.patternNames?.length ? `｜${round.patternNames.join("＋")}` : "";
    const place = round.wind ? `${MahjongCore.WIND_NAMES[round.wind] || "東圈"}・` : "";
    detail.textContent = `${place}${round.winnerName || "流局"}${patternLine}${round.note ? `｜${round.note}` : ""}　${netLine}`;
    item.append(title, detail);
    list.appendChild(item);
  });
  elements.historyContent.replaceChildren(list);
}

function captureMahjongDraft() {
  if (!state || state.kind !== "mahjong" || state.mahjongSession?.status !== "active") return;
  const formData = new FormData(elements.mahjongEntryForm);
  state.mahjongSession.draft = {
    touched: true,
    values: { ...Object.fromEntries(formData.entries()), patterns: formData.getAll("patterns") },
  };
  saveState();
}

function mahjongSettlementSummary(unfinished = false) {
  const session = state.mahjongSession;
  const scores = state.participants.map((player) => `${player.name}：${formatPoints(player.total)} 分`).join("\n");
  const cycleText = session.lengthMode === "custom-hands"
    ? `${session.completedCycles} 圈・${session.completedHands}／${session.plannedHands} 局`
    : session.plannedCycles > 0
      ? `${session.completedCycles}／${session.plannedCycles} 圈・${session.completedHands} 局`
      : `${session.completedCycles} 圈・${session.completedHands} 局`;
  return `已完成：${cycleText}\n每位玩家目前總分：\n${scores}\n未完成輸入的牌局：${unfinished ? "有" : "無"}`;
}

function nextDealerAfterHand(dealerId, winnerId, winType) {
  if (winType === "draw" || winnerId === dealerId) return dealerId;
  const index = state.participants.findIndex((player) => player.id === dealerId);
  return state.participants[(index + 1) % state.participants.length]?.id || dealerId;
}

function completedCycleLabel(cycles) {
  return `${Math.max(0, Number(cycles) || 0)} 圈`;
}

function mahjongRankText(sortedPlayers, index) {
  const tied = (index > 0 && sortedPlayers[index - 1].total === sortedPlayers[index].total)
    || (index < sortedPlayers.length - 1 && sortedPlayers[index + 1].total === sortedPlayers[index].total);
  if (!tied) return `第 ${index + 1} 名`;
  const firstTiedIndex = sortedPlayers.findIndex((player) => player.total === sortedPlayers[index].total);
  return `並列第 ${firstTiedIndex + 1} 名`;
}

function archiveSettledMahjongGame() {
  const session = state.mahjongSession;
  if (session.archiveRecordId) return session.archiveRecordId;
  const id = uid();
  const record = {
    id,
    title: state.title,
    participants: state.participants.map((player) => ({ id: player.id, name: player.name, total: player.total })),
    history: JSON.parse(JSON.stringify(state.history)),
    plannedCycles: session.plannedCycles,
    plannedHands: session.plannedHands,
    lengthMode: session.lengthMode,
    completedCycles: session.completedCycles,
    completedHands: session.completedHands,
    startedAt: session.startedAt,
    settledAt: session.settledAt,
    durationMs: session.durationMs,
    earlyEnded: session.earlyEnded,
    rules: JSON.parse(JSON.stringify(state.mahjong)),
  };
  mahjongArchive = [record, ...loadMahjongArchive()].slice(0, 50);
  saveMahjongArchive(mahjongArchive);
  session.archiveRecordId = id;
  return id;
}

function settleMahjongGame(earlyEnded = false) {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status === "settled") return;
  const session = state.mahjongSession;
  session.status = "settled";
  session.earlyEnded = earlyEnded === true;
  session.settledAt = new Date().toISOString();
  const started = Date.parse(session.startedAt);
  session.durationMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;
  session.draft = { touched: false, values: {} };
  archiveSettledMahjongGame();
  render();
  showToast(session.earlyEnded ? "已提早結束並儲存結算" : "已結算並儲存對局紀錄");
}

function requestMahjongSettlement() {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status !== "active") return;
  const session = state.mahjongSession;
  const early = isMahjongEarly(session);
  const unfinished = session.draft?.touched === true;
  if (unfinished) {
    openConfirm({
      title: "今局資料未完成",
      message: `${mahjongSettlementSummary(true)}\n\n未完成牌局不會計入結算。`,
      cancelText: "返回完成本局",
      acceptText: "放棄本局並結算",
      icon: "!",
      action: () => {
        session.draft = { touched: false, values: {} };
        settleMahjongGame(early);
      },
    });
    return;
  }
  openConfirm({
    title: early ? "提早結算今次麻雀？" : "結算今次麻雀？",
    message: `${early ? `今次尚未完成預定${session.lengthMode === "custom-hands" ? "局數" : "圈數"}，是否按目前分數結算？` : "是否按目前分數結算？"}\n\n${mahjongSettlementSummary(false)}`,
    cancelText: "返回遊戲",
    acceptText: "結束並結算",
    icon: "✓",
    action: () => settleMahjongGame(early),
  });
}

function renderMahjongSettlement() {
  const session = state.mahjongSession;
  const sorted = [...state.participants].sort((left, right) => right.total - left.total);
  const duration = formatTime(Math.floor((session.durationMs || 0) / 1000));
  const endedAt = session.settledAt ? new Date(session.settledAt).toLocaleString("zh-HK") : "—";
  const heading = document.createElement("div");
  heading.className = "mahjong-settlement-heading";
  const title = document.createElement("h3");
  title.textContent = session.earlyEnded ? "提早結束・結算完成" : "結算完成";
  const meta = document.createElement("p");
  meta.textContent = `已完成 ${completedCycleLabel(session.completedCycles)}・${session.completedHands} 局（${mahjongPlanLabel(session)}）｜用時 ${duration}｜${endedAt}`;
  heading.append(title, meta);
  const ranks = document.createElement("ol");
  ranks.className = "mahjong-final-ranks";
  sorted.forEach((player, index) => {
    const item = document.createElement("li");
    const position = document.createElement("span");
    position.textContent = mahjongRankText(sorted, index);
    const name = document.createElement("strong");
    name.textContent = player.name;
    const points = document.createElement("b");
    points.textContent = `${formatPoints(player.total)} 分`;
    item.append(position, name, points);
    ranks.appendChild(item);
  });
  elements.mahjongSettlement.replaceChildren(heading, ranks);
}

function viewArchivedMahjongRecord(recordId) {
  const record = loadMahjongArchive().find((item) => item.id === recordId);
  if (!record) return;
  const content = elements.mahjongRecordContent;
  content.replaceChildren();
  const meta = document.createElement("p");
  const endedAt = record.settledAt ? new Date(record.settledAt).toLocaleString("zh-HK") : "—";
  const duration = formatTime(Math.floor((record.durationMs || 0) / 1000));
  meta.className = "mahjong-record-meta";
  meta.textContent = `${record.earlyEnded ? "提早結束" : "完成結算"}・已完成 ${record.completedCycles || 0} 圈、${record.completedHands || 0} 局（${mahjongPlanLabel(record)}）・用時 ${duration}・${endedAt}`;
  content.appendChild(meta);
  const ranks = document.createElement("ol");
  ranks.className = "mahjong-final-ranks";
    const sortedPlayers = [...(record.participants || [])].sort((left, right) => right.total - left.total);
    sortedPlayers.forEach((player, index) => {
      const item = document.createElement("li");
      item.textContent = `${mahjongRankText(sortedPlayers, index)}　${player.name}　${formatPoints(player.total)} 分`;
      ranks.appendChild(item);
    });
  content.appendChild(ranks);
  const hands = document.createElement("div");
  hands.className = "mahjong-record-hands";
  [...(record.history || [])].reverse().forEach((hand) => {
    const item = document.createElement("p");
    item.textContent = `第 ${hand.number} 局${hand.cycleNumber ? `・第 ${hand.cycleNumber} 圈` : ""}・${hand.winnerName || "流局"}・${hand.fan || 0} 番${Number.isFinite(hand.multiplier) ? `・${hand.multiplier}倍` : ""}・${Math.round(hand.points || 0)} 分`;
    hands.appendChild(item);
  });
  if (!record.history?.length) {
    const empty = document.createElement("p");
    empty.textContent = "今次沒有已完成牌局。";
    hands.appendChild(empty);
  }
  content.appendChild(hands);
  $("#mahjongRecordTitle").textContent = record.title || "麻雀對局紀錄";
  openModal("mahjongRecordModal");
}

function recordMahjongHand(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    winnerId: formData.get("winner"),
    winType: formData.get("winType"),
    discarderId: formData.get("discarder"),
    dealerId: formData.get("dealer"),
    handFan: formData.get("handFan"),
    patternFan: state.mahjong.patterns.filter((pattern) => formData.getAll("patterns").includes(pattern.id)).reduce((sum, pattern) => sum + pattern.fan, 0),
    patternIncludesSelfDraw: state.mahjong.patterns.some((pattern) => formData.getAll("patterns").includes(pattern.id) && pattern.selfDrawIncluded),
    flowers: formData.get("flowers"),
    fanAdjustment: 0,
  };
  const result = calculateMahjongHand(payload);
  if (!result.valid) return showToast(result.reason || "請檢查番數設定");
  snapshot();
  state.participants.forEach((player) => {
    player.score = Math.round(result.net[player.id] || 0);
    player.total += Math.round(result.net[player.id] || 0);
  });
  const session = state.mahjongSession;
  const currentWind = MahjongCore.windForCycle(session.startingWind, session.completedCycles);
  const cycleNumber = session.completedCycles + 1;
  const handInCycle = session.handsInCycle + 1;
  state.history.push({
    number: state.round,
    cycleNumber,
    handInCycle,
    wind: currentWind,
    scores: state.participants.map((player) => ({ id: player.id, name: player.name, score: player.score })),
    winners: result.winner ? [result.winner.name] : [],
    winnerName: result.winner?.name || "流局",
    winType: payload.winType,
    fan: result.fan,
    multiplier: result.multiplier,
    points: result.points,
    patternNames: state.mahjong.patterns.filter((pattern) => formData.getAll("patterns").includes(pattern.id)).map((pattern) => displayMahjongPatternLabel(pattern, currentWind)),
    note: String(formData.get("note") || "").trim().slice(0, 40),
    net: state.participants.map((player) => ({ id: player.id, name: player.name, amount: Math.round(result.net[player.id] || 0) })),
    mahjong: { ...payload },
    createdAt: new Date().toISOString(),
  });
  const nextDealerId = nextDealerAfterHand(payload.dealerId, payload.winnerId, payload.winType);
  Object.assign(session, MahjongCore.advanceProgress(session, payload.dealerId, state.participants.map((player) => player.id)));
  session.nextDealerId = nextDealerId;
  session.draft = { touched: false, values: {} };
  state.round += 1;
  elements.mahjongEntryForm.reset();
  closeModal("mahjongScoringModal");
  render();
  showToast(payload.winType === "draw" ? `第 ${state.round - 1} 局已記錄：流局` : `第 ${state.round - 1} 局已記錄：${result.fan} 番`);
  const marker = session.lengthMode === "custom-hands" ? session.completedHands : session.completedCycles;
  const lastMarker = session.lengthMode === "custom-hands" ? session.lastPromptedHands : session.lastPromptedCycles;
  const completedAsPlanned = MahjongCore.hasCompletedPlan(session) && lastMarker < marker;
  if (completedAsPlanned) {
    if (session.lengthMode === "custom-hands") session.lastPromptedHands = marker;
    else session.lastPromptedCycles = marker;
    saveState();
    openConfirm({
      title: `已完成預定${session.lengthMode === "custom-hands" ? "局數" : "圈數"}，是否結算？`,
      message: `${mahjongSettlementSummary(false)}\n\n你可以結算，或者繼續記錄之後的牌局。`,
      cancelText: "繼續玩",
      acceptText: "立即結算",
      icon: "✓",
      cancelAction: () => saveState(),
      action: () => settleMahjongGame(false),
    });
  }
}

function renderChooser() {
  if (!state || state.kind !== "chooser") return;
  elements.touchPoints.replaceChildren();
  [...chooserTouches.values()].forEach((touch) => {
    const point = document.createElement("span");
    point.className = `touch-point${state.chooser?.resultFingerNumber === touch.fingerNumber ? " is-selected" : ""}`;
    point.style.left = `${touch.x}%`;
    point.style.top = `${touch.y}%`;
    point.textContent = state.chooser?.resultFingerNumber === touch.fingerNumber ? "首家" : "☝️";
    elements.touchPoints.appendChild(point);
  });

  const result = state.chooser?.resultName;
  const resultFingerStillDown = [...chooserTouches.values()].some((touch) => touch.fingerNumber === state.chooser?.resultFingerNumber);
  if (result && !resultFingerStillDown) {
    const selectedPoint = document.createElement("span");
    selectedPoint.className = "touch-point is-selected";
    selectedPoint.style.left = `${state.chooser.resultX}%`;
    selectedPoint.style.top = `${state.chooser.resultY}%`;
    selectedPoint.textContent = "首家";
    elements.touchPoints.appendChild(selectedPoint);
  }
  elements.chooserResult.hidden = !result;
  if (result) elements.chooserResult.textContent = `✦ 今次首家：手指 ${state.chooser.resultFingerNumber}`;
  if (chooserCountdown > 0) {
    elements.chooserStatus.textContent = `${chooserCountdown}…`;
  } else if (result) {
    elements.chooserStatus.textContent = "抽籤完成";
  } else {
    elements.chooserStatus.textContent = chooserTouches.size ? `已按住 ${chooserTouches.size} 隻手指` : "等大家喺任何位置按住";
  }
}

function cancelChooserCountdown() {
  if (chooserCountdownTimer) window.clearInterval(chooserCountdownTimer);
  chooserCountdownTimer = null;
  chooserCountdown = 0;
}

function randomIndex(max) {
  if (max <= 1) return 0;
  const random = new Uint32Array(1);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return random[0] % max;
}

function startChooserCountdown() {
  if (chooserCountdownTimer || state.chooser?.resultName || chooserTouches.size === 0) return;
  chooserCountdown = 3;
  renderChooser();
  chooserCountdownTimer = window.setInterval(() => {
    if (chooserTouches.size === 0) {
      cancelChooserCountdown();
      renderChooser();
      return;
    }
    chooserCountdown -= 1;
    if (chooserCountdown > 0) {
      renderChooser();
      return;
    }
    cancelChooserCountdown();
    const activeTouches = [...chooserTouches.values()];
    const selected = activeTouches[randomIndex(activeTouches.length)];
    if (!selected) return;
    state.chooser = {
      resultId: "",
      resultName: `手指 ${selected.fingerNumber}`,
      resultFingerNumber: selected.fingerNumber,
      resultX: selected.x,
      resultY: selected.y,
      drawnAt: new Date().toISOString(),
    };
    renderChooser();
    saveState();
    showToast(`手指 ${selected.fingerNumber} 做首家`);
  }, 1000);
}

function resetChooser() {
  cancelChooserCountdown();
  chooserTouches.clear();
  nextFingerNumber = 1;
  state.chooser = { resultId: "", resultName: "", resultFingerNumber: 0, resultX: 0, resultY: 0, drawnAt: null };
  renderChooser();
  saveState();
}

function changeScore(id, amount, isTotal = false) {
  const player = state.participants.find((entry) => entry.id === id);
  if (!player) return;
  const key = isTotal ? "total" : "score";
  const next = state.kind === "mahjong" ? player[key] + amount : Math.max(0, player[key] + amount);
  if (next === player[key]) return;
  snapshot();
  player[key] = next;
  render();

  const card = $(`.score-card[data-id="${CSS.escape(id)}"]`);
  const target = isTotal ? $(".total-score strong", card) : $(".score-number", card);
  target.classList.remove("bump");
  requestAnimationFrame(() => target.classList.add("bump"));
}

function winnerNames() {
  const scores = state.participants.map((player) => player.score);
  const target = state.winnerRule === "lowest" ? Math.min(...scores) : Math.max(...scores);
  return state.participants.filter((player) => player.score === target);
}

function finishRound() {
  if (state.participants.every((player) => player.score === 0)) {
    showToast("這一局仲未有分數");
    return;
  }

  const winners = winnerNames();
  const names = winners.map((player) => player.name);
  const scoreLine = state.participants.map((player) => `${player.name} ${player.score}`).join("・");
  openConfirm({
    title: `完成第 ${state.round} 局？`,
    message: `${scoreLine}\n勝方：${names.join("、")}`,
    acceptText: "完成並開新局",
    icon: "✓",
    action: () => {
      snapshot();
      state.history.push({
        number: state.round,
        scores: state.participants.map((player) => ({ id: player.id, name: player.name, score: player.score })),
        winners: names,
        createdAt: new Date().toISOString(),
      });

      if (state.totalMode === "winner") winners.forEach((player) => { player.total += 1; });
      if (state.totalMode === "cumulative") state.participants.forEach((player) => { player.total += player.score; });
      state.participants.forEach((player) => { player.score = 0; });
      state.round += 1;
      render();
      showToast(`第 ${state.round - 1} 局已記錄`);
    },
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function updateConnectionStatus() {
  const isOffline = !navigator.onLine;
  elements.connectionBadge.classList.toggle("is-offline", isOffline);
  elements.connectionLabel.textContent = isOffline ? "離線模式" : "離線可用";
}

async function registerOfflineSupport() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let knownController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const controller = navigator.serviceWorker.controller;
    if (!knownController) {
      knownController = controller;
      return;
    }
    if (!controller || controller === knownController) return;
    knownController = controller;
    waitingForServiceWorkerUpdate = true;
    if (!isHomeVisible || $(".modal-backdrop.is-open")) {
      showToast("新版已下載；完成目前活動後返回主頁，便會自動更新");
      return;
    }
    reloadForServiceWorkerUpdateIfSafe();
  });

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    if (navigator.onLine) registration.update().catch((error) => console.warn("Offline app update check failed.", error));
  } catch (error) {
    console.warn("Offline support could not be enabled.", error);
  }
}

function lockPageScroll() {
  if (document.body.classList.contains("modal-open")) return;
  lockedScrollPosition = window.scrollY;
  document.body.style.top = `-${lockedScrollPosition}px`;
  document.body.classList.add("modal-open");
}

function unlockPageScroll() {
  if (!document.body.classList.contains("modal-open")) return;
  document.body.classList.remove("modal-open");
  document.body.style.top = "";
  window.scrollTo(0, lockedScrollPosition);
}

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  lockPageScroll();
  modal.scrollTop = 0;
  setTimeout(() => $("input, button:not(.modal-close)", modal)?.focus(), 30);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!$(".modal-backdrop.is-open")) unlockPageScroll();
}

function openConfirm({ title, message, acceptText = "確定", cancelText = "取消", icon = "?", action, cancelAction }) {
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  $("#confirmAccept").textContent = acceptText;
  $("#confirmCancel").textContent = cancelText;
  $("#confirmIcon").textContent = icon;
  pendingConfirmAction = action;
  pendingCancelAction = cancelAction || null;
  openModal("confirmModal");
}

function openSettings() {
  $("#settingsName").value = state.title;
  const totalModeInput = $(`input[name="totalMode"][value="${state.totalMode}"]`, $("#settingsForm"));
  const winnerRuleInput = $(`input[name="winnerRule"][value="${state.winnerRule}"]`, $("#settingsForm"));
  if (totalModeInput) totalModeInput.checked = true;
  if (winnerRuleInput) winnerRuleInput.checked = true;
  settingsParticipantsDraft = state.participants.map((player) => ({ ...player }));
  const rules = state.mahjong || defaultMahjongRules();
  $("#mahjongSettingsFields").open = false;
  $("#settingsMahjongQuickFields").hidden = state.kind !== "mahjong";
  const session = state.mahjongSession || newMahjongSession();
  const lengthSelect = $("#settingsMahjongLengthMode");
  let legacyLengthOption = $("option[value='legacy-cycles']", lengthSelect);
  if (session.lengthMode === "legacy-cycles" && !legacyLengthOption) {
    legacyLengthOption = document.createElement("option");
    legacyLengthOption.value = "legacy-cycles";
    legacyLengthOption.textContent = "沿用舊設定";
    lengthSelect.appendChild(legacyLengthOption);
  } else if (session.lengthMode !== "legacy-cycles") {
    legacyLengthOption?.remove();
  }
  const ruleFields = {
    mahjongPrevailingWind: rules.prevailingWind,
    mahjongMinFan: rules.minimumFan,
    mahjongBasePoints: rules.basePoints,
    mahjongFanStep: rules.fanStep,
    mahjongMaxFan: rules.maxFan,
    mahjongMaxPoints: rules.maxPoints,
    mahjongSelfDrawFan: rules.selfDrawFan,
    mahjongFlowerFan: rules.flowerFan,
    mahjongDealerWinMultiplier: rules.dealerWinMultiplier,
    mahjongDealerLoseMultiplier: rules.dealerLoseMultiplier,
    mahjongSelfDrawMultiplier: rules.selfDrawMultiplier,
    mahjongDiscardMultiplier: rules.discardMultiplier,
    mahjongLengthMode: session.lengthMode,
    mahjongCustomHands: session.plannedHands,
  };
  Object.entries(ruleFields).forEach(([name, value]) => { $(`[name="${name}"]`, $("#settingsForm")).value = value; });
  setMahjongScoringControls($("#settingsForm"), rules.scoringMode);
  $("[name='mahjongRonPaymentMode']", $("#settingsForm")).value = rules.ronPaymentMode;
  renderParticipantEditor();
  renderMahjongPatternEditor();
  updateSettingsModeFields();
  updateMahjongSettingsPreview();
  openModal("settingsModal");
}

function updateSettingsModeFields() {
  const special = state?.kind === "mahjong" || state?.kind === "chooser";
  $("#standardSettingsFields").hidden = special;
  $("#winnerRuleFields").hidden = special;
  $("#settingsMahjongQuickFields").hidden = state?.kind !== "mahjong";
  $("#mahjongSettingsFields").hidden = state?.kind !== "mahjong";
  $("#addParticipantButton").hidden = state?.kind === "mahjong";
}

function isMahjongEarly(session) {
  const hasTarget = session?.lengthMode === "custom-hands"
    ? Number(session.plannedHands) > 0
    : Number(session?.plannedCycles) > 0;
  return hasTarget && !MahjongCore.hasCompletedPlan(session);
}

function applyMahjongLengthSelection(session, formData) {
  const mode = formData.get("mahjongLengthMode") || "east";
  if (mode === "legacy-cycles") {
    session.lengthMode = "legacy-cycles";
    return;
  }
  session.lengthMode = mode;
  if (mode === "east") {
    session.plannedCycles = 1;
    session.plannedHands = 0;
  } else if (mode === "half") {
    session.plannedCycles = 2;
    session.plannedHands = 0;
  } else {
    session.plannedCycles = 0;
    session.plannedHands = Math.min(999, Math.max(1, Math.floor(Number(formData.get("mahjongCustomHands")) || 16)));
  }
}

function mahjongPlanLabel(session) {
  if (session?.lengthMode === "custom-hands") return `原訂 ${session.plannedHands} 局`;
  if (session?.lengthMode === "east") return "原訂東圈";
  if (session?.lengthMode === "half") return "原訂半莊";
  return session?.plannedCycles > 0 ? `原訂 ${session.plannedCycles} 圈` : "不限局數";
}

function renderMahjongPatternEditor(editor = elements.mahjongPatternEditor, patterns = state?.mahjong?.patterns || []) {
  if (!editor) return;
  editor.replaceChildren();
  patterns.forEach((pattern) => {
    const row = document.createElement("div");
    row.className = "mahjong-pattern-setting-row";
    row.dataset.id = pattern.id;
    const enabledLabel = document.createElement("label");
    enabledLabel.className = "checkbox-line pattern-enabled";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.name = `patternEnabled-${pattern.id}`;
    enabled.checked = pattern.enabled;
    enabled.setAttribute("aria-label", `啟用${pattern.label}`);
    enabledLabel.append(enabled);
    const labelInput = document.createElement("input");
    labelInput.className = "text-input pattern-label-input";
    labelInput.type = "text";
    labelInput.name = `patternLabel-${pattern.id}`;
    labelInput.maxLength = 24;
    labelInput.value = pattern.label;
    labelInput.setAttribute("aria-label", `${pattern.label}名稱`);
    const fanInput = document.createElement("input");
    fanInput.className = "text-input pattern-fan-input";
    fanInput.type = "number";
    fanInput.name = `patternFan-${pattern.id}`;
    fanInput.min = "0";
    fanInput.max = "99";
    fanInput.inputMode = "numeric";
    fanInput.value = pattern.fan;
    fanInput.setAttribute("aria-label", `${pattern.label}番數`);
    const fanText = document.createElement("span");
    fanText.textContent = "番";
    row.append(enabledLabel, labelInput, fanInput, fanText);
    editor.appendChild(row);
  });
}

function renderParticipantEditor() {
  const editor = $("#participantEditor");
  editor.replaceChildren();
  settingsParticipantsDraft.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "participant-row";
    row.dataset.id = player.id;

    const dot = document.createElement("span");
    dot.className = "color-dot";
    dot.style.setProperty("--dot-color", player.color);

    const input = document.createElement("input");
    input.className = "text-input participant-name-input";
    input.type = "text";
    input.maxLength = 18;
    input.value = player.name;
    input.setAttribute("aria-label", `參加者 ${index + 1} 名稱`);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-participant";
    remove.textContent = "×";
    const minimumParticipants = state?.kind === "mahjong" ? 4 : 2;
    remove.disabled = settingsParticipantsDraft.length <= minimumParticipants;
    remove.setAttribute("aria-label", `移除 ${player.name}`);

    row.append(dot, input, remove);
    editor.appendChild(row);
  });

  $("#addParticipantButton").disabled = settingsParticipantsDraft.length >= 8;
}

function updateSetupFromPreset() {
  const preset = $("input[name='preset']:checked", $("#setupForm")).value;
  const isMahjong = preset === "mahjong";
  $("#setupTeamNamesRow").hidden = preset !== "sports";
  $("#setupMahjongPlayers").hidden = !isMahjong;
  $("#setupTitle").textContent = isMahjong ? "香港麻雀開局設定" : "今次點樣計？";
  $("#setupDescription").textContent = isMahjong
    ? "揀好起糊番數、打幾多圈同最高番數，就可以即刻開枱。"
    : preset === "chooser"
      ? "唔使輸入玩家名；大家喺畫面任何位置按住，就會抽出首家。"
      : "揀一個玩法開始，之後隨時可以改名或加減人數。";
  $("#setupSubmitText").textContent = isMahjong ? "建立麻雀計分板" : preset === "chooser" ? "開始抽首家" : "建立計分板";
  $("#participantCountRow").hidden = preset !== "custom";
  $("#setupMahjongRules").hidden = !isMahjong;
  const nameInput = $("#setupName");
  if (preset === "sports" && ["今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "今晚開波";
  if (["cards", "mahjong"].includes(preset) && ["今晚開波", "自訂比賽", "首家抽籤"].includes(nameInput.value)) nameInput.value = "今晚開枱";
  if (preset === "chooser" && ["今晚開波", "今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "首家抽籤";
  $("#countOutput").textContent = customCount;
  if (preset === "custom" && ["今晚開波", "今晚開枱"].includes(nameInput.value)) nameInput.value = "自訂比賽";
  updateMahjongSetupPreview();
}

function isInteractiveTarget(target) {
  return Boolean(target.closest?.("button, a, input, select, textarea, [role='button']"));
}

function fingerPositionFromEvent(event) {
  return {
    x: Math.min(96, Math.max(4, (event.clientX / window.innerWidth) * 100)),
    y: Math.min(92, Math.max(8, (event.clientY / window.innerHeight) * 100)),
  };
}

document.addEventListener("pointerdown", (event) => {
  if (state?.kind === "chooser") {
    if (state.chooser?.resultName || isInteractiveTarget(event.target) || chooserTouches.has(event.pointerId)) return;
    event.preventDefault();
    chooserTouches.set(event.pointerId, { fingerNumber: nextFingerNumber++, ...fingerPositionFromEvent(event) });
    try { elements.touchArena.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional outside the arena. */ }
    startChooserCountdown();
    renderChooser();
    return;
  }
  if (!event.target.closest(".score-display")) return;
  suppressScoreClick = false;
  activeScoreGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
});

document.addEventListener("pointermove", (event) => {
  const finger = chooserTouches.get(event.pointerId);
  if (state?.kind === "chooser" && finger) {
    event.preventDefault();
    Object.assign(finger, fingerPositionFromEvent(event));
    renderChooser();
    return;
  }
  if (!activeScoreGesture || activeScoreGesture.pointerId !== event.pointerId) return;
  const horizontalDistance = Math.abs(event.clientX - activeScoreGesture.startX);
  const verticalDistance = Math.abs(event.clientY - activeScoreGesture.startY);
  if (horizontalDistance > 10 || verticalDistance > 10) activeScoreGesture.moved = true;
});

document.addEventListener("pointerup", (event) => {
  if (chooserTouches.has(event.pointerId)) {
    chooserTouches.delete(event.pointerId);
    if (!chooserTouches.size && !state?.chooser?.resultName) cancelChooserCountdown();
    renderChooser();
    return;
  }
  if (!activeScoreGesture || activeScoreGesture.pointerId !== event.pointerId) return;
  suppressScoreClick = activeScoreGesture.moved;
  activeScoreGesture = null;
});

document.addEventListener("pointercancel", (event) => {
  if (chooserTouches.delete(event.pointerId)) {
    if (!chooserTouches.size && !state?.chooser?.resultName) cancelChooserCountdown();
    renderChooser();
    return;
  }
  if (activeScoreGesture) {
    activeScoreGesture = null;
    suppressScoreClick = true;
  }
});

document.addEventListener("click", (event) => {
  const mahjongCard = event.target.closest(".mahjong-player-card");
  if (mahjongCard) {
    openMahjongScoring(mahjongCard.dataset.id);
    return;
  }
  const card = event.target.closest(".score-card");
  if (!card) return;
  const id = card.dataset.id;
  if (event.target.closest(".score-display")) {
    if (suppressScoreClick) {
      event.preventDefault();
      suppressScoreClick = false;
      return;
    }
    changeScore(id, 1);
  }
  if (event.target.closest(".minus-button")) {
    changeScore(id, -1);
  }
  if (event.target.closest(".total-plus")) changeScore(id, 1, true);
  if (event.target.closest(".total-minus")) changeScore(id, -1, true);
  if (event.target.closest(".player-name")) {
    openSettings();
    setTimeout(() => $(`.participant-row[data-id="${CSS.escape(id)}"] input`)?.select(), 80);
  }
});

elements.mahjongEntryForm.addEventListener("submit", recordMahjongHand);
elements.mahjongEntryForm.addEventListener("input", () => { captureMahjongDraft(); updateMahjongPreview(); });
elements.mahjongEntryForm.addEventListener("change", (event) => {
  captureMahjongDraft();
  if (event.target === elements.mahjongWinType) renderMahjongEntry();
  else updateMahjongPreview();
});

elements.mahjongOpenScoringButton.addEventListener("click", () => openMahjongScoring());
$("#mahjongEndButton").addEventListener("click", requestMahjongSettlement);

$$('[data-close="mahjongScoringModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("mahjongScoringModal"));
});

$("#setupForm").addEventListener("input", updateMahjongSetupPreview);
$("#setupForm").addEventListener("change", (event) => {
  syncMahjongScoringControls(event);
  updateMahjongSetupPreview();
});
$("#settingsForm").addEventListener("input", updateMahjongSettingsPreview);
$("#settingsForm").addEventListener("change", (event) => {
  syncMahjongScoringControls(event);
  updateMahjongSettingsPreview();
});

$("#mahjongCommonDefaults").addEventListener("click", () => {
  const form = $("#setupForm");
  $("[name='mahjongMinFan']", form).value = "3";
  $("[name='mahjongMaxFan']", form).value = "13";
  $("[name='mahjongBasePoints']", form).value = "1";
  $("[name='mahjongFanStep']", form).value = "2";
  setMahjongScoringControls(form, "hk-table");
  updateMahjongSetupPreview();
  showToast("已套用香港常用計分");
});

$("#settingsMahjongCommonDefaults").addEventListener("click", () => {
  const form = $("#settingsForm");
  $("[name='mahjongMinFan']", form).value = "3";
  $("[name='mahjongMaxFan']", form).value = "13";
  $("[name='mahjongBasePoints']", form).value = "1";
  $("[name='mahjongFanStep']", form).value = "2";
  setMahjongScoringControls(form, "hk-table");
  updateMahjongSettingsPreview();
  showToast("已套用香港常用計分");
});

$("#chooserResetButton").addEventListener("click", resetChooser);

$("#setupForm").addEventListener("change", (event) => {
  if (event.target.name === "preset") updateSetupFromPreset();
});

$("#countMinus").addEventListener("click", () => {
  customCount = Math.max(2, customCount - 1);
  $("#countOutput").textContent = customCount;
});

$("#countPlus").addEventListener("click", () => {
  customCount = Math.min(8, customCount + 1);
  $("#countOutput").textContent = customCount;
});

$("#setupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state = freshState(form.get("preset"), form.get("title"), customCount, {
    home: form.get("homeTeamName"),
    away: form.get("awayTeamName"),
  });
  if (state.kind === "mahjong") {
    state.participants.forEach((player, index) => {
      player.name = String(form.get(`mahjongPlayer${index + 1}`) || "").trim().slice(0, 18) || `玩家 ${index + 1}`;
    });
    const defaultRules = defaultMahjongRules();
    state.mahjong = sanitizeMahjongRules({
      prevailingWind: form.get("mahjongWind"),
      minimumFan: form.get("mahjongMinFan"),
      basePoints: form.get("mahjongBasePoints"),
      fanStep: form.get("mahjongFanStep"),
      scoringMode: form.get("mahjongScoringPreset") || form.get("mahjongAdvancedScoringMode"),
      maxFan: form.get("mahjongMaxFan"),
      maxPoints: form.get("mahjongMaxPoints"),
      selfDrawFan: form.get("mahjongSelfDrawFan"),
      flowerFan: form.get("mahjongFlowerFan"),
      dealerWinMultiplier: form.get("mahjongDealerWinMultiplier"),
      dealerLoseMultiplier: form.get("mahjongDealerLoseMultiplier"),
      selfDrawMultiplier: form.get("mahjongSelfDrawMultiplier"),
      discardMultiplier: form.get("mahjongDiscardMultiplier"),
      ronPaymentMode: form.get("mahjongRonPaymentMode"),
      patterns: defaultRules.patterns.map((pattern) => ({
        id: pattern.id,
        label: form.get(`patternLabel-${pattern.id}`),
        fan: form.get(`patternFan-${pattern.id}`),
        enabled: form.get(`patternEnabled-${pattern.id}`) === "on",
      })),
    });
    state.mahjongSession = newMahjongSession({
      lengthMode: form.get("mahjongLengthMode"),
      plannedHands: form.get("mahjongCustomHands"),
      startingWind: state.mahjong.prevailingWind,
    });
    applyMahjongLengthSelection(state.mahjongSession, form);
    state.mahjongSession.nextDealerId = state.participants[0]?.id || "";
  }
  undoStack = [];
  closeModal("setupModal");
  elements.setupCloseButton.hidden = false;
  showScoreboard();
  showToast("計分板準備好喇");
});

$("#settingsButton").addEventListener("click", openSettings);
elements.homeButton.addEventListener("click", showHome);
elements.homeNewButton.addEventListener("click", () => beginNewActivity("sports"));
elements.homeContinueButton.addEventListener("click", showScoreboard);
$("#homeModeGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-home-preset]");
  if (card) beginNewActivity(card.dataset.homePreset);
});
$("#brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});
$("#finishRoundButton").addEventListener("click", finishRound);
elements.timerToggleButton.addEventListener("click", toggleTimer);

$("#clearHistoryButton").addEventListener("click", () => {
  if (!state.history.length) return showToast("暫時未有紀錄");
  openConfirm({
    title: "清除比分紀錄？",
    message: "只會清除每局紀錄；目前分數及總分會保留。",
    acceptText: "清除紀錄",
    icon: "×",
    action: () => {
      snapshot();
      state.history = [];
      render();
      showToast("比分紀錄已清除");
    },
  });
});

elements.undoButton.addEventListener("click", () => {
  if (!undoStack.length) return;
  state = sanitizeState(JSON.parse(undoStack.pop()));
  render();
  showToast("已撤銷上一步");
});

$("#participantEditor").addEventListener("click", (event) => {
  const button = event.target.closest(".remove-participant");
  if (!button || button.disabled) return;
  const row = button.closest(".participant-row");
  settingsParticipantsDraft = settingsParticipantsDraft.filter((player) => player.id !== row.dataset.id);
  renderParticipantEditor();
});

$("#addParticipantButton").addEventListener("click", () => {
  if (settingsParticipantsDraft.length >= 8) return;
  const index = settingsParticipantsDraft.length;
  settingsParticipantsDraft.push(participant(`玩家 ${index + 1}`, index));
  renderParticipantEditor();
  $("#participantEditor .participant-row:last-child input")?.focus();
});

$("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  snapshot();
  const form = new FormData(event.currentTarget);
  state.title = String(form.get("title") || "我的計分板").trim().slice(0, 30) || "我的計分板";
  if (state.kind !== "mahjong" && state.kind !== "chooser") {
    state.totalMode = form.get("totalMode");
    state.winnerRule = form.get("winnerRule");
  }
  $$(".participant-row", $("#participantEditor")).forEach((row, index) => {
    const player = settingsParticipantsDraft.find((entry) => entry.id === row.dataset.id);
    if (player) player.name = $("input", row).value.trim().slice(0, 18) || `玩家 ${index + 1}`;
  });
  state.participants = settingsParticipantsDraft.map((player) => ({ ...player }));
  if (state.kind === "mahjong") {
    state.mahjong = sanitizeMahjongRules({
      prevailingWind: form.get("mahjongPrevailingWind"),
      minimumFan: form.get("mahjongMinFan"),
      basePoints: form.get("mahjongBasePoints"),
      fanStep: form.get("mahjongFanStep"),
      scoringMode: form.get("mahjongScoringPreset") || form.get("mahjongAdvancedScoringMode"),
      maxFan: form.get("mahjongMaxFan"),
      maxPoints: form.get("mahjongMaxPoints"),
      selfDrawFan: form.get("mahjongSelfDrawFan"),
      flowerFan: form.get("mahjongFlowerFan"),
      dealerWinMultiplier: form.get("mahjongDealerWinMultiplier"),
      dealerLoseMultiplier: form.get("mahjongDealerLoseMultiplier"),
      selfDrawMultiplier: form.get("mahjongSelfDrawMultiplier"),
      discardMultiplier: form.get("mahjongDiscardMultiplier"),
      ronPaymentMode: form.get("mahjongRonPaymentMode"),
      patterns: state.mahjong.patterns.map((pattern) => ({
        id: pattern.id,
        label: form.get(`patternLabel-${pattern.id}`),
        fan: form.get(`patternFan-${pattern.id}`),
        enabled: form.get(`patternEnabled-${pattern.id}`) === "on",
      })),
    });
    state.mahjongSession.startingWind = state.mahjong.prevailingWind;
    applyMahjongLengthSelection(state.mahjongSession, form);
  } else if (state.kind !== "chooser") {
    state.kind = state.participants.length === 2 ? state.kind : "custom";
  }
  closeModal("settingsModal");
  render();
  showToast("設定已儲存");
});

$("#newScoreboardButton").addEventListener("click", () => {
  closeModal("settingsModal");
  beginNewActivity("sports");
});

$("#confirmCancel").addEventListener("click", () => {
  const action = pendingCancelAction;
  pendingConfirmAction = null;
  pendingCancelAction = null;
  closeModal("confirmModal");
  action?.();
});

$("#confirmAccept").addEventListener("click", () => {
  const action = pendingConfirmAction;
  pendingConfirmAction = null;
  pendingCancelAction = null;
  closeModal("confirmModal");
  action?.();
});

elements.mahjongArchiveList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-record-id]");
  if (button) viewArchivedMahjongRecord(button.dataset.recordId);
});

$$('[data-close="mahjongRecordModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("mahjongRecordModal"));
});

$("#setupCloseButton").addEventListener("click", () => {
  if (state) closeModal("setupModal");
});

$$('[data-close="settingsModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("settingsModal"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (elements.confirmModal.classList.contains("is-open")) {
      const action = pendingCancelAction;
      pendingConfirmAction = null;
      pendingCancelAction = null;
      closeModal("confirmModal");
      action?.();
    } else if (elements.settingsModal.classList.contains("is-open")) closeModal("settingsModal");
    else if (elements.mahjongScoringModal.classList.contains("is-open")) closeModal("mahjongScoringModal");
    else if (elements.setupModal.classList.contains("is-open") && state) closeModal("setupModal");
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !$(".modal-backdrop.is-open")) {
    event.preventDefault();
    elements.undoButton.click();
  }
});

window.addEventListener("online", () => {
  updateConnectionStatus();
  showToast("已重新連線");
});

window.addEventListener("offline", () => {
  updateConnectionStatus();
  showToast("已進入離線模式，計分仍可使用");
});

state = loadState();
if (state) {
  elements.setupModal.classList.remove("is-open");
  elements.setupModal.setAttribute("aria-hidden", "true");
  elements.setupCloseButton.hidden = false;
  setHomeVisible(true);
} else {
  elements.setupCloseButton.hidden = true;
  resetSetupForm("sports");
  setHomeVisible(true);
}

window.matchMedia("(orientation: landscape)").addEventListener?.("change", () => {
  if (state) render();
});
window.matchMedia("(orientation: portrait) and (max-width: 850px)").addEventListener?.("change", () => {
  if (state) render();
});

timerTicker = window.setInterval(() => {
  if (state?.timer?.running) updateTimerDisplay();
}, 250);

updateConnectionStatus();
registerOfflineSupport();
