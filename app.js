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

const elements = {
  scoreGrid: $("#scoreGrid"),
  matchTitle: $("#matchTitle"),
  roundLabel: $("#roundLabel"),
  playerCountLabel: $("#playerCountLabel"),
  modeLabel: $("#modeLabel"),
  timerDisplay: $("#timerDisplay"),
  timerToggleButton: $("#timerToggleButton"),
  timerToggleLabel: $("#timerToggleLabel"),
  connectionBadge: $("#connectionBadge"),
  connectionLabel: $("#connectionLabel"),
  historyContent: $("#historyContent"),
  undoButton: $("#undoButton"),
  setupModal: $("#setupModal"),
  settingsModal: $("#settingsModal"),
  confirmModal: $("#confirmModal"),
  toast: $("#toast"),
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function participant(name, index) {
  return { id: uid(), name, color: COLORS[index % COLORS.length], score: 0, total: 0 };
}

function freshState(preset, title, count = 2) {
  const isCards = preset === "cards";
  const size = preset === "sports" ? 2 : isCards ? 4 : count;
  const names = preset === "sports"
    ? ["主隊", "客隊"]
    : Array.from({ length: size }, (_, index) => `玩家 ${index + 1}`);

  return {
    title: title.trim() || (isCards ? "今晚開枱" : "今晚開波"),
    kind: preset,
    totalMode: isCards ? "cumulative" : "winner",
    winnerRule: "highest",
    round: 1,
    timer: { elapsed: 0, running: false, startedAt: null },
    participants: names.map((name, index) => participant(name, index)),
    history: [],
  };
}

function sanitizeState(candidate) {
  if (!candidate || !Array.isArray(candidate.participants) || candidate.participants.length < 2) return null;
  const elapsed = Math.max(0, Math.floor(Number(candidate.timer?.elapsed) || 0));
  const startedAt = Number(candidate.timer?.startedAt);
  const timerIsRunning = candidate.timer?.running === true && Number.isFinite(startedAt) && startedAt > 0;
  return {
    title: String(candidate.title || "我的計分板").slice(0, 30),
    kind: ["sports", "cards", "custom"].includes(candidate.kind) ? candidate.kind : "custom",
    totalMode: ["winner", "cumulative", "manual"].includes(candidate.totalMode) ? candidate.totalMode : "manual",
    winnerRule: candidate.winnerRule === "lowest" ? "lowest" : "highest",
    round: Math.max(1, Number(candidate.round) || 1),
    timer: { elapsed, running: timerIsRunning, startedAt: timerIsRunning ? startedAt : null },
    participants: candidate.participants.slice(0, 8).map((item, index) => ({
      id: String(item.id || uid()),
      name: String(item.name || `玩家 ${index + 1}`).slice(0, 18),
      color: COLORS.includes(item.color) ? item.color : COLORS[index % COLORS.length],
      score: Math.max(0, Number(item.score) || 0),
      total: Math.max(0, Number(item.total) || 0),
    })),
    history: Array.isArray(candidate.history) ? candidate.history.slice(-100) : [],
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

function snapshot() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 50) undoStack.shift();
  elements.undoButton.disabled = false;
}

function render() {
  if (!state) return;
  elements.matchTitle.textContent = state.title;
  elements.roundLabel.textContent = `第 ${state.round} 局`;
  elements.playerCountLabel.textContent = `${state.participants.length} 個計分格`;
  elements.modeLabel.textContent = ({ winner: "勝方 +1", cumulative: "累加本局", manual: "手動總分" })[state.totalMode];
  updateTimerDisplay();
  renderScoreCards();
  renderHistory();
  elements.undoButton.disabled = undoStack.length === 0;
  saveState();
}

function renderScoreCards() {
  elements.scoreGrid.replaceChildren();
  elements.scoreGrid.dataset.count = String(state.participants.length);

  state.participants.forEach((player, index) => {
    const fragment = $("#scoreCardTemplate").content.cloneNode(true);
    const card = $(".score-card", fragment);
    card.style.setProperty("--player-color", player.color);
    card.dataset.id = player.id;
    $(".player-index", card).textContent = String(index + 1).padStart(2, "0");
    $(".player-name", card).textContent = player.name;
    $(".score-number", card).textContent = player.score;
    $(".total-score strong", card).textContent = player.total;
    $(".score-display", card).setAttribute("aria-label", `${player.name} 現時 ${player.score} 分，按一下加一分`);
    $(".minus-button", card).setAttribute("aria-label", `${player.name} 減一分`);
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

function changeScore(id, amount, isTotal = false) {
  const player = state.participants.find((entry) => entry.id === id);
  if (!player) return;
  const key = isTotal ? "total" : "score";
  const next = Math.max(0, player[key] + amount);
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

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("input, button:not(.modal-close)", modal)?.focus(), 30);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!$(".modal-backdrop.is-open")) document.body.style.overflow = "";
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
  $(`input[name="totalMode"][value="${state.totalMode}"]`, $("#settingsForm")).checked = true;
  $(`input[name="winnerRule"][value="${state.winnerRule}"]`, $("#settingsForm")).checked = true;
  settingsParticipantsDraft = state.participants.map((player) => ({ ...player }));
  renderParticipantEditor();
  openModal("settingsModal");
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
    remove.disabled = settingsParticipantsDraft.length <= 2;
    remove.setAttribute("aria-label", `移除 ${player.name}`);

    row.append(dot, input, remove);
    editor.appendChild(row);
  });

  $("#addParticipantButton").disabled = settingsParticipantsDraft.length >= 8;
}

function updateSetupFromPreset() {
  const preset = $("input[name='preset']:checked", $("#setupForm")).value;
  $("#participantCountRow").hidden = preset !== "custom";
  const nameInput = $("#setupName");
  if (preset === "sports" && ["今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "今晚開波";
  if (preset === "cards" && ["今晚開波", "自訂比賽"].includes(nameInput.value)) nameInput.value = "今晚開枱";
  if (preset === "custom" && ["今晚開波", "今晚開枱"].includes(nameInput.value)) nameInput.value = "自訂比賽";
}

elements.scoreGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".score-card");
  if (!card) return;
  const id = card.dataset.id;
  if (event.target.closest(".score-display")) changeScore(id, 1);
  if (event.target.closest(".minus-button")) changeScore(id, -1);
  if (event.target.closest(".total-plus")) changeScore(id, 1, true);
  if (event.target.closest(".total-minus")) changeScore(id, -1, true);
  if (event.target.closest(".player-name")) {
    openSettings();
    setTimeout(() => $(`.participant-row[data-id="${CSS.escape(id)}"] input`)?.select(), 80);
  }
});

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
  undoStack = [];
  closeModal("setupModal");
  $("#setupCloseButton").hidden = false;
  render();
  showToast("計分板準備好喇");
});

$("#settingsButton").addEventListener("click", openSettings);
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
  state.totalMode = form.get("totalMode");
  state.winnerRule = form.get("winnerRule");
  $$(".participant-row", $("#participantEditor")).forEach((row, index) => {
    const player = settingsParticipantsDraft.find((entry) => entry.id === row.dataset.id);
    if (player) player.name = $("input", row).value.trim().slice(0, 18) || `玩家 ${index + 1}`;
  });
  state.participants = settingsParticipantsDraft.map((player) => ({ ...player }));
  state.kind = state.participants.length === 2 ? state.kind : "custom";
  closeModal("settingsModal");
  render();
  showToast("設定已儲存");
});

$("#newScoreboardButton").addEventListener("click", () => {
  closeModal("settingsModal");
  openConfirm({
    title: "開全新計分板？",
    message: "目前所有分數及紀錄會被清除，這個動作無法撤銷。",
    acceptText: "重新開始",
    icon: "＋",
    action: () => {
      clearStoredState();
      undoStack = [];
      state = null;
      $("#setupForm").reset();
      $("#setupName").value = "今晚開波";
      customCount = 3;
      $("#countOutput").textContent = customCount;
      updateSetupFromPreset();
      $("#setupCloseButton").hidden = true;
      openModal("setupModal");
    },
  });
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
  $("#setupCloseButton").hidden = false;
  render();
} else {
  $("#setupCloseButton").hidden = true;
  document.body.style.overflow = "hidden";
  state = freshState("sports", "今晚開波");
  render();
  clearStoredState();
}

timerTicker = window.setInterval(() => {
  if (state?.timer?.running) updateTimerDisplay();
}, 250);

updateConnectionStatus();
registerOfflineSupport();
