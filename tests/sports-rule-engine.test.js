const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../sports-rule-engine.js");

function score(config, sequence) {
  let state = Engine.createGameState(config);
  sequence.forEach(([team, count]) => {
    for (let point = 0; point < count; point += 1) state = Engine.applyPoint(config, state, team).state;
  });
  return state;
}

test("排球 Standard 在24比24後要領先兩分", () => {
  const config = Engine.volleyballPreset("standard");
  let state = score(config, [[0, 24], [1, 24]]);
  assert.equal(Engine.evaluate(config, state).status, "deuce");
  state = Engine.applyPoint(config, state, 0).state;
  assert.equal(state.completedGames.length, 0);
  state = Engine.applyPoint(config, state, 0).state;
  assert.deepEqual(state.completedGames[0].scores, [26, 24]);
  assert.deepEqual(state.currentScore, [0, 0]);
});

test("排球決勝局使用15分並於14比14後打到16比14", () => {
  const config = Engine.volleyballPreset("standard");
  let state = Engine.createGameState(config);
  [[0, 25], [1, 25]].forEach(([team, count]) => {
    for (let point = 0; point < count; point += 1) state = Engine.applyPoint(config, state, team).state;
  });
  assert.equal(state.currentGame, 3);
  assert.equal(Engine.targetForGame(config, 3), 15);
  for (let point = 0; point < 14; point += 1) {
    state = Engine.applyPoint(config, state, 0).state;
    state = Engine.applyPoint(config, state, 1).state;
  }
  state = Engine.applyPoint(config, state, 0).state;
  assert.equal(state.status, "playing");
  state = Engine.applyPoint(config, state, 0).state;
  assert.equal(state.status, "finished");
  assert.deepEqual(state.completedGames[2].scores, [16, 14]);
});

test("30分一局制不要求領先兩分時30比29完場", () => {
  const config = Engine.sanitizeConfig({ ...Engine.volleyballPreset("single"), targetScore: 30, winBy: 1 });
  const state = score(config, [[0, 29], [1, 29], [0, 1]]);
  assert.equal(state.status, "finished");
  assert.deepEqual(state.currentScore, [30, 29]);
});

test("30分一局制要求領先兩分時30比29不完場", () => {
  const config = Engine.sanitizeConfig({ ...Engine.volleyballPreset("single"), targetScore: 30, winBy: 2 });
  let state = score(config, [[0, 29], [1, 29], [0, 1]]);
  assert.equal(state.status, "playing");
  state = Engine.applyPoint(config, state, 0).state;
  assert.equal(state.status, "finished");
  assert.deepEqual(state.currentScore, [31, 29]);
});

test("Custom Best of 5會由設定推算三局勝出", () => {
  const config = Engine.sanitizeConfig({ preset: "custom", matchFormat: "best-of-5", targetScore: 21, winBy: 2, decidingGameTargetScore: 15 });
  assert.equal(config.numberOfGames, 5);
  assert.equal(config.gamesToWin, 3);
  assert.equal(Engine.targetForGame(config, 5), 15);
});

test("有最高分上限時到達上限會立即完局", () => {
  const config = Engine.sanitizeConfig({ preset: "custom", matchFormat: "single", targetScore: 21, winBy: 2, maxScore: 30 });
  let state = Engine.createGameState(config);
  for (let point = 0; point < 29; point += 1) {
    state = Engine.applyPoint(config, state, 0).state;
    state = Engine.applyPoint(config, state, 1).state;
  }
  state = Engine.applyPoint(config, state, 0).state;
  assert.equal(state.status, "finished");
  assert.deepEqual(state.currentScore, [30, 29]);
});

test("重設本局會保留之前已完成局數，重設比賽則全部清除", () => {
  const config = Engine.sanitizeConfig({ ...Engine.volleyballPreset("standard"), targetScore: 3, decidingGameTargetScore: 2 });
  let state = score(config, [[0, 3], [1, 2]]);
  assert.deepEqual(state.gamesWon, [1, 0]);
  state = Engine.resetCurrentGame(config, state);
  assert.deepEqual(state.currentScore, [0, 0]);
  assert.deepEqual(state.gamesWon, [1, 0]);
  state = Engine.resetMatch(config);
  assert.deepEqual(state.gamesWon, [0, 0]);
  assert.equal(state.completedGames.length, 0);
});

test("比賽完結後禁止再加分，重新開啟會返回致勝分前", () => {
  const config = Engine.sanitizeConfig({ ...Engine.volleyballPreset("single"), targetScore: 3, winBy: 1 });
  let state = score(config, [[0, 3]]);
  assert.equal(state.status, "finished");
  const blocked = Engine.applyPoint(config, state, 1);
  assert.equal(blocked.event.reason, "match-finished");
  assert.deepEqual(blocked.state.currentScore, [3, 0]);
  state = Engine.reopenMatch(config, state);
  assert.equal(state.status, "playing");
  assert.deepEqual(state.currentScore, [2, 0]);
});
