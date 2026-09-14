import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9223";
const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("index.html"));
assert.ok(target, "Scoreboard page was not found in headless Chrome");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject, raw } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else if (message.result?.result?.exceptionDetails) reject(new Error(message.result.result.exceptionDetails.text));
  else resolve(raw ? message.result : message.result?.result?.value);
});

function evaluate(expression) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, raw: false }));
}

function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, raw: true }));
}

await evaluate(`(() => {
  localStorage.clear();
  beginNewActivity("sports");
  return {
    setupOpen: document.querySelector("#setupModal").classList.contains("is-open"),
    presets: [...document.querySelectorAll("input[name='volleyballPreset']")].map((input) => input.value),
    rulesVisible: !document.querySelector("#setupSportsRules").hidden,
  };
})()`)
  .then((value) => assert.deepEqual(value, { setupOpen: true, presets: ["standard", "single", "custom"], rulesVisible: true }));

await evaluate(`(() => {
  document.querySelector("#setupHomeTeamName").value = "Alpha";
  document.querySelector("#setupAwayTeamName").value = "Beta";
  document.querySelector("#setupForm").requestSubmit();
  const point = (side, count) => { for (let i = 0; i < count; i += 1) document.querySelector(side + " .score-display").click(); };
  point("#sportsLandscapeLeft", 24);
  point("#sportsLandscapeRight", 24);
  document.querySelector("#sportsLandscapeLeft .score-display").click();
  const at2524 = [state.sportGame.currentScore, state.sportGame.completedGames.length, state.sportGame.status];
  document.querySelector("#sportsLandscapeLeft .score-display").click();
  const firstGame = [state.sportGame.currentScore, state.sportGame.gamesWon, state.sportGame.completedGames[0].scores];
  point("#sportsLandscapeLeft", 25);
  return {
    config: state.sportConfig,
    at2524,
    firstGame,
    finished: state.sportGame.status,
    winner: state.participants[state.sportGame.winnerIndex].name,
    summaryOpen: document.querySelector("#sportsSummaryModal").classList.contains("is-open"),
    summary: document.querySelector("#sportsSummaryContent").textContent,
  };
})()`).then((value) => {
  assert.equal(value.config.matchFormat, "best-of-3");
  assert.equal(value.config.decidingGameTargetScore, 15);
  assert.deepEqual(value.at2524, [[25, 24], 0, "playing"]);
  assert.deepEqual(value.firstGame, [[0, 0], [1, 0], [26, 24]]);
  assert.equal(value.finished, "finished");
  assert.equal(value.winner, "Alpha");
  assert.equal(value.summaryOpen, true);
  assert.match(value.summary, /Alpha/);
  assert.match(value.summary, /26–24/);
  assert.match(value.summary, /25–0/);
});

await evaluate(`(() => {
  document.querySelector("#sportsReopenButton").click();
  return { status: state.sportGame.status, score: state.sportGame.currentScore, games: state.sportGame.gamesWon };
})()`).then((value) => assert.deepEqual(value, { status: "playing", score: [24, 0], games: [1, 0] }));

await evaluate(`(() => {
  beginNewActivity("sports");
  document.querySelector("input[name='volleyballPreset'][value='single']").click();
  document.querySelector("#sportsSingleTarget").value = "30";
  document.querySelector("#sportsSingleTarget").dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#setupForm").requestSubmit();
  const point = (side, count) => { for (let i = 0; i < count; i += 1) document.querySelector(side + " .score-display").click(); };
  point("#sportsLandscapeRight", 29);
  point("#sportsLandscapeLeft", 30);
  return { config: state.sportConfig, status: state.sportGame.status, score: state.sportGame.currentScore };
})()`).then((value) => {
  assert.equal(value.config.matchFormat, "single");
  assert.equal(value.config.targetScore, 30);
  assert.equal(value.config.winBy, 1);
  assert.equal(value.status, "finished");
  assert.deepEqual(value.score, [30, 29]);
});

await evaluate(`(() => {
  closeModal("sportsSummaryModal");
  beginNewActivity("mahjong");
  document.querySelector("#setupForm").requestSubmit();
  const mahjong = { panel: !document.querySelector("#mahjongPanel").hidden, cards: document.querySelectorAll(".mahjong-player-card").length, sportsControls: !document.querySelector("#sportsResetMatchButton").hidden };
  beginNewActivity("bigtwo");
  document.querySelector("#setupForm").requestSubmit();
  const bigtwo = { panel: !document.querySelector("#bigTwoPanel").hidden, cards: document.querySelectorAll(".mahjong-player-card").length, sportsControls: !document.querySelector("#sportsResetMatchButton").hidden };
  return { mahjong, bigtwo };
})()`).then((value) => {
  assert.deepEqual(value.mahjong, { panel: true, cards: 4, sportsControls: false });
  assert.deepEqual(value.bigtwo, { panel: true, cards: 4, sportsControls: false });
});

await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenOrientation: { type: "portraitPrimary", angle: 0 } });
await evaluate(`(() => {
  beginNewActivity("sports");
  const setupRect = document.querySelector("#setupModal .modal").getBoundingClientRect();
  document.querySelector("#setupForm").requestSubmit();
  const board = document.querySelector("#sportsLandscapeBoard").getBoundingClientRect();
  const left = document.querySelector("#sportsLandscapeLeft");
  const center = document.querySelector("#sportsLandscapeCenter");
  const right = document.querySelector("#sportsLandscapeRight");
  return {
    setupFits: setupRect.left >= 0 && setupRect.right <= innerWidth,
    forced: document.body.classList.contains("sports-forced-landscape"),
    boardFits: Math.round(board.width) === innerWidth && Math.round(board.height) === innerHeight,
    columnsDoNotOverlap: left.offsetLeft + left.offsetWidth <= center.offsetLeft && center.offsetLeft + center.offsetWidth <= right.offsetLeft,
  };
})()`).then((value) => assert.deepEqual(value, { setupFits: true, forced: true, boardFits: true, columnsDoNotOverlap: true }));

socket.close();
console.log("Sports UI smoke test passed");
