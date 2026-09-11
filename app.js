const STORAGE_KEY = "funfun-scoreboard-v1";
const COLORS = ["#ff6a3d", "#c9f558", "#67c8ff", "#c99bff", "#ffcf4a", "#57d6a3", "#ff8fbd", "#8ea0ff"];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let state = null;
let undoStack = [];
let customCount = 3;
let pendingConfirmAction = null;
let toastTimer = null;
let settingsParticipantsDraft = [];
let timerTicker = null;
let lockedScrollPosition = 0;
let activeScoreGesture = null;
let suppressScoreClick = false;
let isHomeVisible = false;
let chooserTouches = new Map();
let chooserCountdownTimer = null;
let chooserCountdown = 0;

const elements = {
  scoreGrid: $("#scoreGrid"),
  homeView: $("#homeView"),
  homeCurrent: $("#homeCurrent"),
  homeCurrentTitle: $("#homeCurrentTitle"),
  homeCurrentMeta: $("#homeCurrentMeta"),
  homeButton: $("#homeButton"),
  homeNewButton: $("#homeNewButton"),
  homeContinueButton: $("#homeContinueButton"),
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
  chooserPlayers: $("#chooserPlayers"),
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
  mahjongPreview: $("#mahjongPreview"),
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
    maxFan: 13,
    maxPoints: 0,
    selfDrawFan: 1,
    flowerFan: 1,
    dealerWinMultiplier: 2,
    dealerLoseMultiplier: 2,
    selfDrawMultiplier: 1,
    discardMultiplier: 2,
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
      { id: "one-flower-set", label: "一台花", fan: 2, enabled: true },
      { id: "kong-draw", label: "槓上開花", fan: 2, enabled: true },
      { id: "last-tile", label: "海底撈月", fan: 2, enabled: true },
      { id: "seven-flowers", label: "花糊", fan: 3, enabled: true },
      { id: "all-pungs", label: "對對糊", fan: 3, enabled: true },
      { id: "half-flush", label: "混一色", fan: 3, enabled: true },
      { id: "terminals-honors", label: "花幺", fan: 4, enabled: true },
      { id: "small-dragons", label: "小三元", fan: 5, enabled: true },
      { id: "small-winds", label: "小四喜", fan: 6, enabled: true },
      { id: "full-flush", label: "清一色", fan: 7, enabled: true },
      { id: "all-honors", label: "字一色", fan: 10, enabled: true },
      { id: "big-dragons", label: "大三元", fan: 8, enabled: true },
      { id: "big-winds", label: "大四喜", fan: 13, enabled: true },
      { id: "thirteen-orphans", label: "十三么", fan: 13, enabled: true },
      { id: "nine-gates", label: "九子連環", fan: 13, enabled: true },
      { id: "four-kongs", label: "十八羅漢／四槓子", fan: 13, enabled: true },
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
    const fan = Number(supplied?.fan);
    return {
      ...defaultPattern,
      label: String(supplied?.label || defaultPattern.label).slice(0, 24),
      fan: Number.isFinite(fan) ? Math.min(99, Math.max(0, Math.round(fan))) : defaultPattern.fan,
      enabled: supplied?.enabled !== false,
    };
  });
  return {
    prevailingWind: ["east", "south", "west", "north"].includes(rules.prevailingWind) ? rules.prevailingWind : defaults.prevailingWind,
    minimumFan: Math.round(number("minimumFan", 0, 99)),
    basePoints: number("basePoints", 0, 999999),
    fanStep: number("fanStep", 1, 10),
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

function freshState(preset, title, count = 2) {
  const isCards = preset === "cards";
  const isMahjong = preset === "mahjong";
  const isChooser = preset === "chooser";
  const size = preset === "sports" ? 2 : isCards || isMahjong ? 4 : count;
  const names = preset === "sports"
    ? ["主隊", "客隊"]
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
    chooser: { resultId: null, resultName: "", drawnAt: null },
  };
}

function sanitizeState(candidate) {
  if (!candidate || !Array.isArray(candidate.participants) || candidate.participants.length < 2) return null;
  const elapsed = Math.max(0, Math.floor(Number(candidate.timer?.elapsed) || 0));
  const startedAt = Number(candidate.timer?.startedAt);
  const timerIsRunning = candidate.timer?.running === true && Number.isFinite(startedAt) && startedAt > 0;
  const kind = ["sports", "cards", "custom", "mahjong", "chooser"].includes(candidate.kind) ? candidate.kind : "custom";
  const participants = candidate.participants.slice(0, 8).map((item, index) => ({
    id: String(item.id || uid()),
    name: String(item.name || `玩家 ${index + 1}`).slice(0, 18),
    color: COLORS.includes(item.color) ? item.color : COLORS[index % COLORS.length],
    score: kind === "mahjong" ? Number(item.score) || 0 : Math.max(0, Number(item.score) || 0),
    total: kind === "mahjong" ? Number(item.total) || 0 : Math.max(0, Number(item.total) || 0),
  }));
  while (kind === "mahjong" && participants.length < 4) participants.push(participant(`玩家 ${participants.length + 1}`, participants.length));
  return {
    title: String(candidate.title || "我的計分板").slice(0, 30),
    kind,
    totalMode: ["winner", "cumulative", "manual"].includes(candidate.totalMode) ? candidate.totalMode : "manual",
    winnerRule: candidate.winnerRule === "lowest" ? "lowest" : "highest",
    round: Math.max(1, Number(candidate.round) || 1),
    timer: { elapsed, running: timerIsRunning, startedAt: timerIsRunning ? startedAt : null },
    participants,
    history: Array.isArray(candidate.history) ? candidate.history.slice(-100) : [],
    mahjong: sanitizeMahjongRules(candidate.mahjong),
    chooser: {
      resultId: String(candidate.chooser?.resultId || ""),
      resultName: String(candidate.chooser?.resultName || "").slice(0, 18),
      drawnAt: candidate.chooser?.drawnAt || null,
    },
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

function updateHome() {
  if (!elements.homeCurrent) return;
  elements.homeCurrent.hidden = !state;
  if (!state) return;
  elements.homeCurrentTitle.textContent = state.title;
  const modeText = state.kind === "mahjong" ? "香港麻雀" : state.kind === "chooser" ? "首家抽籤" : "普通計分";
  elements.homeCurrentMeta.textContent = `${modeText}・${state.participants.length} 人／隊・第 ${state.round} 局`;
}

function setHomeVisible(visible) {
  isHomeVisible = visible;
  elements.homeView.hidden = !visible;
  $("main").hidden = visible;
  $("footer").hidden = visible;
  elements.homeButton.hidden = visible || !state;
  elements.undoButton.hidden = visible;
  $("#settingsButton").hidden = visible;
  updateHome();
}

function showHome() {
  if (elements.setupModal.classList.contains("is-open")) closeModal("setupModal");
  if (elements.settingsModal.classList.contains("is-open")) closeModal("settingsModal");
  setHomeVisible(true);
}

function showScoreboard() {
  setHomeVisible(false);
  render();
}

function resetSetupForm(preset = "sports") {
  $("#setupForm").reset();
  $("#setupName").value = preset === "chooser" ? "首家抽籤" : ["mahjong", "cards"].includes(preset) ? "今晚開枱" : preset === "custom" ? "自訂比賽" : "今晚開波";
  customCount = preset === "chooser" ? 4 : 3;
  $("#countOutput").textContent = customCount;
  const presetInput = $(`input[name="preset"][value="${preset}"]`, $("#setupForm"));
  if (presetInput) presetInput.checked = true;
  updateSetupFromPreset();
}

function beginNewActivity(preset = "sports") {
  const openSetup = () => {
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
      message: "目前活動的分數及紀錄會清除，確定要開始另一個玩法嗎？",
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
  elements.matchTitle.textContent = state.title;
  elements.roundLabel.textContent = `第 ${state.round} 局`;
  elements.playerCountLabel.textContent = state.kind === "chooser" ? `${state.participants.length} 位玩家` : `${state.participants.length} 個計分格`;
  elements.modeLabel.textContent = state.kind === "mahjong" ? "香港牌計番" : state.kind === "chooser" ? "多人觸控抽籤" : ({ winner: "勝方 +1", cumulative: "累加本局", manual: "手動總分" })[state.totalMode];
  const specialMode = state.kind === "mahjong" || state.kind === "chooser";
  elements.timerBar.hidden = specialMode;
  $("#matchControls").hidden = specialMode;
  $("#roundHistory").hidden = state.kind === "chooser";
  elements.scoreGrid.hidden = state.kind === "chooser";
  elements.mahjongPanel.hidden = state.kind !== "mahjong";
  elements.chooserPanel.hidden = state.kind !== "chooser";
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

  state.participants.forEach((player, index) => {
    const fragment = $("#scoreCardTemplate").content.cloneNode(true);
    const card = $(".score-card", fragment);
    card.style.setProperty("--player-color", player.color);
    card.dataset.id = player.id;
    $(".total-score", card).hidden = state.kind === "mahjong";
    $(".player-index", card).textContent = String(index + 1).padStart(2, "0");
    $(".player-name", card).textContent = player.name;
    $(".score-number", card).textContent = player.score;
    $(".total-score strong", card).textContent = player.total;
    $(".score-display", card).setAttribute("aria-label", `${player.name} ${state.kind === "mahjong" ? "本局淨分" : "現時"} ${player.score} 分，按一下加一分`);
    $(".score-tap-hint", card).textContent = state.kind === "mahjong" ? "可手動微調" : "按一下 ＋1";
    const minusButton = $(".minus-button", card);
    minusButton.textContent = state.kind === "mahjong" ? "按錯？減 1 番" : "按錯？減 1 分";
    minusButton.setAttribute("aria-label", state.kind === "mahjong" ? `${player.name} 減一番` : `${player.name} 減一分`);
    $(".total-plus", card).setAttribute("aria-label", `${player.name} 總分加一`);
    $(".total-minus", card).setAttribute("aria-label", `${player.name} 總分減一`);
    elements.scoreGrid.appendChild(fragment);
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
  elements.timerToggleLabel.textContent = state.timer.running ? "暫停計時" : "開始計時";
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

function resetTimer() {
  state.timer.elapsed = 0;
  state.timer.startedAt = state.timer.running ? Date.now() : null;
  updateTimerDisplay();
  saveState();
  showToast("計時已重設");
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

function calculateMahjongHand({ winnerId, winType, discarderId, dealerId, handFan, patternFan = 0, flowers }) {
  const rules = state.mahjong;
  const cleanHandFan = Math.max(0, Math.round(Number(handFan) || 0));
  const cleanPatternFan = Math.max(0, Math.round(Number(patternFan) || 0));
  const cleanFlowers = Math.max(0, Math.round(Number(flowers) || 0));
  const bonusFan = cleanPatternFan + (winType === "self" ? rules.selfDrawFan : 0) + cleanFlowers * rules.flowerFan;
  let fan = cleanHandFan + bonusFan;
  if (rules.maxFan > 0) fan = Math.min(rules.maxFan, fan);
  if (fan < rules.minimumFan) return { valid: false, fan, bonusFan, reason: `未夠 ${rules.minimumFan} 番起糊` };

  let points = rules.basePoints * Math.pow(rules.fanStep, Math.max(0, fan - 1));
  if (rules.maxPoints > 0) points = Math.min(rules.maxPoints, points);
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
      const payment = points * rules.selfDrawMultiplier * dealerWinMultiplier * dealerMultiplier;
      net[player.id] -= payment;
      net[winner.id] += payment;
    });
  } else {
    const payers = state.participants.filter((player) => player.id !== winner.id && (rules.ronPaymentMode === "all" || player.id === discarder.id));
    payers.forEach((player) => {
      const dealerMultiplier = player.id === dealerId ? rules.dealerLoseMultiplier : 1;
      const discardMultiplier = player.id === discarder.id ? rules.discardMultiplier : rules.selfDrawMultiplier;
      const payment = points * discardMultiplier * dealerWinMultiplier * dealerMultiplier;
      net[player.id] -= payment;
      net[winner.id] += payment;
    });
  }

  return { valid: true, fan, bonusFan, patternFan: cleanPatternFan, points, net, winner, discarder };
}

function renderMahjongEntry() {
  const winnerValue = elements.mahjongWinner.value;
  const discarderValue = elements.mahjongDiscarder.value;
  const dealerValue = elements.mahjongDealer.value;
  const selectedPatternIds = new Set($$("input[name='patterns']:checked", elements.mahjongPatternChoices).map((input) => input.value));
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
  elements.mahjongDiscarderField.hidden = elements.mahjongWinType.value !== "discard";
  elements.mahjongPatternChoices.replaceChildren();
  state.mahjong.patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
    const label = document.createElement("label");
    label.className = "mahjong-pattern-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "patterns";
    input.value = pattern.id;
    input.checked = selectedPatternIds.has(pattern.id);
    const text = document.createElement("span");
    text.textContent = pattern.label;
    const fan = document.createElement("strong");
    fan.textContent = `${pattern.fan} 番`;
    label.append(input, text, fan);
    elements.mahjongPatternChoices.appendChild(label);
  });
  const windLabels = { east: "東圈", south: "南圈", west: "西圈", north: "北圈" };
  const limitLabel = state.mahjong.maxFan > 0 ? `${state.mahjong.maxFan} 番封頂` : "不限番";
  $("#mahjongRuleBadge").textContent = `${windLabels[state.mahjong.prevailingWind] || "東圈"}・${state.mahjong.minimumFan} 番起糊・${limitLabel}・${state.mahjong.fanStep} 倍番`;
  updateMahjongPreview();
}

function updateMahjongPreview() {
  if (!state || state.kind !== "mahjong") return;
  const formData = new FormData(elements.mahjongEntryForm);
  const patternIds = formData.getAll("patterns");
  const patternFan = state.mahjong.patterns.filter((pattern) => patternIds.includes(pattern.id)).reduce((sum, pattern) => sum + pattern.fan, 0);
  const result = calculateMahjongHand({
    winnerId: formData.get("winner"),
    winType: formData.get("winType"),
    discarderId: formData.get("discarder"),
    dealerId: formData.get("dealer"),
    handFan: formData.get("handFan"),
    patternFan,
    flowers: formData.get("flowers"),
  });
  if (!result.valid) {
    elements.mahjongPreview.textContent = result.reason || "請填寫資料";
    elements.mahjongPreview.classList.add("is-invalid");
    return;
  }
  elements.mahjongPreview.classList.remove("is-invalid");
  const winnerLine = `${result.winner.name} +${Math.round(result.net[result.winner.id])}`;
  const payLine = state.participants.filter((player) => player.id !== result.winner.id && result.net[player.id] < 0)
    .map((player) => `${player.name} ${formatPoints(result.net[player.id])}`).join("・");
  const patternNames = state.mahjong.patterns.filter((pattern) => patternIds.includes(pattern.id)).map((pattern) => pattern.label);
  const patternLine = patternNames.length ? `${patternNames.join("＋")}｜` : "";
  elements.mahjongPreview.textContent = `${patternLine}${result.fan} 番｜底分 ${Math.round(result.points)}｜${winnerLine}${payLine ? `｜${payLine}` : ""}`;
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
    title.innerHTML = `<strong>第 ${round.number} 局</strong><span>${round.winType === "self" ? "自摸" : "出銃"}・${round.fan} 番・${Math.round(round.points)} 分</span>`;
    const detail = document.createElement("p");
    const netLine = (round.net || []).map((entry) => `${entry.name} ${formatPoints(entry.amount)}`).join("　");
    const patternLine = round.patternNames?.length ? `｜${round.patternNames.join("＋")}` : "";
    detail.textContent = `${round.winnerName}${patternLine}${round.note ? `｜${round.note}` : ""}　${netLine}`;
    item.append(title, detail);
    list.appendChild(item);
  });
  elements.historyContent.replaceChildren(list);
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
    flowers: formData.get("flowers"),
  };
  const result = calculateMahjongHand(payload);
  if (!result.valid) return showToast(result.reason || "請檢查番數設定");
  snapshot();
  state.participants.forEach((player) => {
    player.score = Math.round(result.net[player.id] || 0);
    player.total += Math.round(result.net[player.id] || 0);
  });
  state.history.push({
    number: state.round,
    scores: state.participants.map((player) => ({ id: player.id, name: player.name, score: player.score })),
    winners: [result.winner.name],
    winnerName: result.winner.name,
    winType: payload.winType,
    fan: result.fan,
    points: result.points,
    patternNames: state.mahjong.patterns.filter((pattern) => formData.getAll("patterns").includes(pattern.id)).map((pattern) => pattern.label),
    note: String(formData.get("note") || "").trim().slice(0, 40),
    net: state.participants.map((player) => ({ id: player.id, name: player.name, amount: Math.round(result.net[player.id] || 0) })),
    createdAt: new Date().toISOString(),
  });
  state.round += 1;
  render();
  showToast(`第 ${state.round - 1} 局已記錄：${result.fan} 番`);
}

function chooserAssignedIds() {
  return new Set([...chooserTouches.values()].map((touch) => touch.playerId));
}

function renderChooser() {
  if (!state || state.kind !== "chooser") return;
  const assigned = chooserAssignedIds();
  elements.chooserPlayers.replaceChildren();
  state.participants.forEach((player) => {
    const chip = document.createElement("div");
    chip.className = `chooser-player${assigned.has(player.id) ? " is-ready" : ""}`;
    chip.style.setProperty("--player-color", player.color);
    chip.innerHTML = `<span class="chooser-player-dot"></span><strong></strong><small>${assigned.has(player.id) ? "已按住" : "等待中"}</small>`;
    $("strong", chip).textContent = player.name;
    elements.chooserPlayers.appendChild(chip);
  });

  elements.touchPoints.replaceChildren();
  [...chooserTouches.values()].forEach((touch) => {
    const player = state.participants.find((entry) => entry.id === touch.playerId);
    if (!player) return;
    const point = document.createElement("span");
    point.className = "touch-point";
    point.style.setProperty("--player-color", player.color);
    point.style.left = `${touch.x}%`;
    point.style.top = `${touch.y}%`;
    point.textContent = player.name;
    elements.touchPoints.appendChild(point);
  });

  const result = state.chooser?.resultName;
  elements.chooserResult.hidden = !result;
  if (result) elements.chooserResult.textContent = `✦ 今次首家：${result}`;
  if (chooserCountdown > 0) {
    elements.chooserStatus.textContent = `${chooserCountdown}…`;
  } else if (result) {
    elements.chooserStatus.textContent = "抽籤完成";
  } else {
    elements.chooserStatus.textContent = assigned.size === state.participants.length ? "全部人已按住" : `已按 ${assigned.size}/${state.participants.length} 人`;
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
  if (chooserCountdownTimer || state.chooser?.resultName) return;
  chooserCountdown = 3;
  renderChooser();
  chooserCountdownTimer = window.setInterval(() => {
    if (chooserTouches.size !== state.participants.length) {
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
    const assignedPlayers = [...chooserTouches.values()].map((touch) => state.participants.find((player) => player.id === touch.playerId)).filter(Boolean);
    const selected = assignedPlayers[randomIndex(assignedPlayers.length)];
    if (!selected) return;
    state.chooser = { resultId: selected.id, resultName: selected.name, drawnAt: new Date().toISOString() };
    chooserTouches.clear();
    renderChooser();
    saveState();
    showToast(`今次由 ${selected.name} 做首家`);
  }, 750);
}

function resetChooser() {
  cancelChooserCountdown();
  chooserTouches.clear();
  state.chooser = { resultId: null, resultName: "", drawnAt: null };
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
  try {
    await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    await navigator.serviceWorker.ready;
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

function openConfirm({ title, message, acceptText = "確定", icon = "?", action }) {
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  $("#confirmAccept").textContent = acceptText;
  $("#confirmIcon").textContent = icon;
  pendingConfirmAction = action;
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
  };
  Object.entries(ruleFields).forEach(([name, value]) => { $(`[name="${name}"]`, $("#settingsForm")).value = value; });
  $("[name='mahjongRonPaymentMode']", $("#settingsForm")).value = rules.ronPaymentMode;
  renderParticipantEditor();
  renderMahjongPatternEditor();
  updateSettingsModeFields();
  openModal("settingsModal");
}

function updateSettingsModeFields() {
  const special = state?.kind === "mahjong" || state?.kind === "chooser";
  $("#standardSettingsFields").hidden = special;
  $("#winnerRuleFields").hidden = special;
  $("#mahjongSettingsFields").hidden = state?.kind !== "mahjong";
  $("#addParticipantButton").hidden = state?.kind === "mahjong";
}

function renderMahjongPatternEditor() {
  const editor = elements.mahjongPatternEditor;
  if (!editor) return;
  editor.replaceChildren();
  (state?.mahjong?.patterns || []).forEach((pattern) => {
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
  $("#participantCountRow").hidden = !["custom", "chooser"].includes(preset);
  $("#setupMahjongWindRow").hidden = preset !== "mahjong";
  $("#setupMahjongLimitRow").hidden = preset !== "mahjong";
  const nameInput = $("#setupName");
  if (preset === "sports" && ["今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "今晚開波";
  if (["cards", "mahjong"].includes(preset) && ["今晚開波", "自訂比賽", "首家抽籤"].includes(nameInput.value)) nameInput.value = "今晚開枱";
  if (preset === "chooser" && ["今晚開波", "今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "首家抽籤";
  if (preset === "chooser" && customCount < 4) customCount = 4;
  $("#countOutput").textContent = customCount;
  if (preset === "custom" && ["今晚開波", "今晚開枱"].includes(nameInput.value)) nameInput.value = "自訂比賽";
}

elements.scoreGrid.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".score-display")) return;
  suppressScoreClick = false;
  activeScoreGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
});

elements.scoreGrid.addEventListener("pointermove", (event) => {
  if (!activeScoreGesture || activeScoreGesture.pointerId !== event.pointerId) return;
  const horizontalDistance = Math.abs(event.clientX - activeScoreGesture.startX);
  const verticalDistance = Math.abs(event.clientY - activeScoreGesture.startY);
  if (horizontalDistance > 10 || verticalDistance > 10) activeScoreGesture.moved = true;
});

elements.scoreGrid.addEventListener("pointerup", (event) => {
  if (!activeScoreGesture || activeScoreGesture.pointerId !== event.pointerId) return;
  suppressScoreClick = activeScoreGesture.moved;
  activeScoreGesture = null;
});

elements.scoreGrid.addEventListener("pointercancel", () => {
  activeScoreGesture = null;
  suppressScoreClick = true;
});

elements.scoreGrid.addEventListener("click", (event) => {
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
  if (event.target.closest(".minus-button")) changeScore(id, -1);
  if (event.target.closest(".total-plus")) changeScore(id, 1, true);
  if (event.target.closest(".total-minus")) changeScore(id, -1, true);
  if (event.target.closest(".player-name")) {
    openSettings();
    setTimeout(() => $(`.participant-row[data-id="${CSS.escape(id)}"] input`)?.select(), 80);
  }
});

elements.mahjongEntryForm.addEventListener("submit", recordMahjongHand);
elements.mahjongEntryForm.addEventListener("input", updateMahjongPreview);
elements.mahjongEntryForm.addEventListener("change", (event) => {
  if (event.target === elements.mahjongWinType) renderMahjongEntry();
  else updateMahjongPreview();
});

elements.touchArena.addEventListener("pointerdown", (event) => {
  if (state?.kind !== "chooser") return;
  event.preventDefault();
  if (state.chooser?.resultName) resetChooser();
  if (chooserTouches.has(event.pointerId) || chooserTouches.size >= state.participants.length) return;
  const assigned = chooserAssignedIds();
  const player = state.participants.find((entry) => !assigned.has(entry.id));
  if (!player) return;
  const rect = elements.touchArena.getBoundingClientRect();
  chooserTouches.set(event.pointerId, {
    playerId: player.id,
    x: Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.min(88, Math.max(12, ((event.clientY - rect.top) / rect.height) * 100)),
  });
  elements.touchArena.setPointerCapture?.(event.pointerId);
  renderChooser();
  if (chooserTouches.size === state.participants.length) startChooserCountdown();
});

elements.touchArena.addEventListener("pointermove", (event) => {
  const touch = chooserTouches.get(event.pointerId);
  if (!touch || state?.kind !== "chooser") return;
  event.preventDefault();
  const rect = elements.touchArena.getBoundingClientRect();
  touch.x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
  touch.y = Math.min(88, Math.max(12, ((event.clientY - rect.top) / rect.height) * 100));
  renderChooser();
});

function releaseChooserPointer(event) {
  if (!chooserTouches.has(event.pointerId)) return;
  chooserTouches.delete(event.pointerId);
  if (chooserCountdownTimer) cancelChooserCountdown();
  renderChooser();
}

elements.touchArena.addEventListener("pointerup", releaseChooserPointer);
elements.touchArena.addEventListener("pointercancel", releaseChooserPointer);
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
  state = freshState(form.get("preset"), form.get("title"), customCount);
  if (state.kind === "mahjong") {
    state.mahjong.prevailingWind = ["east", "south", "west", "north"].includes(form.get("mahjongWind")) ? form.get("mahjongWind") : "east";
    const maxFan = Number(form.get("mahjongMaxFan"));
    state.mahjong.maxFan = [0, 8, 10, 13].includes(maxFan) ? maxFan : 13;
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
$("#timerResetButton").addEventListener("click", resetTimer);

$("#resetRoundButton").addEventListener("click", () => {
  if (state.participants.every((player) => player.score === 0)) return showToast("本局已經係 0 分");
  openConfirm({
    title: "重設本局分數？",
    message: "所有人的本局分數會變回 0，總分及過往紀錄不受影響。",
    acceptText: "重設本局",
    icon: "↺",
    action: () => {
      snapshot();
      state.participants.forEach((player) => { player.score = 0; });
      render();
      showToast("本局分數已重設");
    },
  });
});

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
  pendingConfirmAction = null;
  closeModal("confirmModal");
});

$("#confirmAccept").addEventListener("click", () => {
  const action = pendingConfirmAction;
  pendingConfirmAction = null;
  closeModal("confirmModal");
  action?.();
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
      pendingConfirmAction = null;
      closeModal("confirmModal");
    } else if (elements.settingsModal.classList.contains("is-open")) closeModal("settingsModal");
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
  showScoreboard();
} else {
  elements.setupCloseButton.hidden = true;
  resetSetupForm("sports");
  setHomeVisible(true);
}

timerTicker = window.setInterval(() => {
  if (state?.timer?.running) updateTimerDisplay();
}, 250);

updateConnectionStatus();
registerOfflineSupport();
