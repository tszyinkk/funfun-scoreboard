const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../sports-rule-engine.js");

function points(config, state, team, count, amount = 1) {
  let next = state;
  for (let index = 0; index < count; index += 1) next = Engine.applyPoint(config, next, team, amount).state;
  return next;
}

function winGame(config, state, team, score, opponent = 0) {
  let next = points(config, state, 1 - team, opponent);
  next = points(config, next, team, score);
  return next.status === "game-complete" ? Engine.advanceGame(config, next) : next;
}

test("排球25:24不完局，26:24保留比分等候確認", () => {
  const config = Engine.volleyballPreset("standard");
  let state = Engine.createGameState(config);
  state = points(config, state, 0, 24); state = points(config, state, 1, 24);
  assert.equal(Engine.evaluate(config, state).status, "deuce");
  state = points(config, state, 0, 1); assert.equal(state.status, "playing");
  state = points(config, state, 0, 1); assert.equal(state.status, "game-complete");
  assert.deepEqual(state.currentScore, [26, 24]);
  state = Engine.advanceGame(config, state); assert.deepEqual(state.currentScore, [0, 0]);
});

test("排球三局兩勝決勝局15分並於14:14打到16:14", () => {
  const config = Engine.volleyballPreset("standard");
  let state = Engine.createGameState(config);
  state = winGame(config, state, 0, 25); state = winGame(config, state, 1, 25);
  assert.equal(state.currentGame, 3); assert.equal(Engine.targetForGame(config, 3), 15);
  state = points(config, state, 0, 14); state = points(config, state, 1, 14);
  state = points(config, state, 0, 1); assert.equal(state.status, "playing");
  state = points(config, state, 0, 1); assert.equal(state.status, "finished");
  assert.deepEqual(state.completedGames[2].scores, [16, 14]);
});

test("排球正式五局三勝", () => {
  const config = Engine.volleyballPreset("alternate");
  let state = Engine.createGameState(config);
  state = winGame(config, state, 0, 25); state = winGame(config, state, 1, 25);
  state = winGame(config, state, 0, 25); state = winGame(config, state, 0, 25);
  assert.equal(state.status, "finished"); assert.deepEqual(state.gamesWon, [3, 1]);
});

test("單局30分先到即完；領先2分時30:29未完", () => {
  const firstTo = Engine.sanitizeConfig({ ...Engine.volleyballPreset("single"), targetScore: 30, winBy: 1 });
  let state = Engine.createGameState(firstTo);
  state = points(firstTo, state, 1, 29); state = points(firstTo, state, 0, 30); assert.equal(state.status, "finished");
  const winByTwo = Engine.sanitizeConfig({ ...firstTo, winBy: 2 });
  state = Engine.createGameState(winByTwo); state = points(winByTwo, state, 1, 29); state = points(winByTwo, state, 0, 30);
  assert.equal(state.status, "playing"); state = points(winByTwo, state, 0, 1); assert.equal(state.status, "finished");
});

test("羽毛球20:20後領先2分，29:29後30分封頂", () => {
  const config = Engine.badmintonPreset("standard");
  let state = Engine.createGameState(config);
  state = points(config, state, 0, 20); state = points(config, state, 1, 20); state = points(config, state, 0, 1);
  assert.equal(state.status, "playing"); state = points(config, state, 0, 1); assert.equal(state.status, "game-complete");
  state = Engine.createGameState(config);
  for (let index = 0; index < 29; index += 1) { state = points(config, state, 0, 1); state = points(config, state, 1, 1); }
  state = points(config, state, 0, 1);
  assert.equal(state.status, "game-complete"); assert.deepEqual(state.currentScore, [30, 29]);
});

test("乒乓球10:10後領先2分，支援三及五局", () => {
  const bo5 = Engine.tableTennisPreset("standard"); const bo3 = Engine.tableTennisPreset("alternate");
  assert.deepEqual([bo5.numberOfGames, bo5.gamesToWin], [5, 3]); assert.deepEqual([bo3.numberOfGames, bo3.gamesToWin], [3, 2]);
  let state = Engine.createGameState(bo3); state = points(bo3, state, 0, 10); state = points(bo3, state, 1, 10); state = points(bo3, state, 0, 1);
  assert.equal(state.status, "playing"); state = points(bo3, state, 0, 1); assert.equal(state.status, "game-complete");
});

test("街場籃球11及20分支援+1/+2/+3及無計時", () => {
  const eleven = Engine.basketballPreset("standard"); let state = Engine.createGameState(eleven);
  state = Engine.applyPoint(eleven, state, 0, 3).state; state = Engine.applyPoint(eleven, state, 0, 2).state; state = Engine.applyPoint(eleven, state, 0, 1).state;
  assert.deepEqual(state.currentScore, [6, 0]); state = points(eleven, state, 0, 5); assert.equal(state.status, "finished");
  const twenty = Engine.basketballPreset("alternate"); state = Engine.createGameState(twenty); state = points(twenty, state, 0, 20);
  assert.equal(state.status, "finished"); assert.equal(twenty.timedMode, false);
});

test("籃球計時模式分節、平手加時及完場", () => {
  const config = Engine.basketballPreset("single"); let state = Engine.createGameState(config);
  assert.equal(config.periodDurationSeconds, 600); assert.equal(config.overtimeDurationSeconds, 300);
  state = Engine.applyPoint(config, state, 0, 2).state; state = Engine.applyPoint(config, state, 1, 2).state;
  for (let period = 0; period < 4; period += 1) state = Engine.endPeriod(config, state);
  state = Engine.addOvertime(config, state); assert.equal(state.overtimeCount, 1);
  state = Engine.applyPoint(config, state, 0, 3).state; state = Engine.endPeriod(config, state); state = Engine.finishMatch(config, state, "score");
  assert.equal(state.winnerIndex, 0);
});

test("籃球加時時間可自訂，並可連續進入下一次加時", () => {
  const config = Engine.sanitizeConfig({ ...Engine.basketballPreset("single"), periodDurationSeconds: 600, overtimeDurationSeconds: 420 });
  assert.equal(config.overtimeDurationSeconds, 420);
  let state = Engine.createGameState(config);
  for (let period = 0; period < 4; period += 1) state = Engine.endPeriod(config, state);
  state = Engine.addOvertime(config, state); assert.deepEqual([state.currentPeriod, state.overtimeCount], [5, 1]);
  state = Engine.endPeriod(config, state); state = Engine.addOvertime(config, state);
  assert.deepEqual([state.currentPeriod, state.overtimeCount], [6, 2]);
});

test("儲存籃球紀錄使用累積總分；其他球類仍使用勝局", () => {
  const basketball = Engine.basketballPreset("single");
  let basketballState = Engine.createGameState(basketball);
  basketballState = Engine.applyPoint(basketball, basketballState, 0, 3).state;
  basketballState = Engine.applyPoint(basketball, basketballState, 1, 3).state;
  assert.deepEqual(Engine.recordScore(basketball, basketballState), [3, 3]);
  assert.deepEqual(Engine.recordScore(basketball, { pointHistory: [{ teamIndex: 0, points: 2 }, { teamIndex: 1, points: 3 }] }, [{ score: 0 }, { score: 0 }]), [2, 3]);
  assert.deepEqual(Engine.recordScore(basketball, {}, [{ score: 3 }, { score: 3 }]), [3, 3]);
  const volleyball = Engine.volleyballPreset("standard");
  assert.deepEqual(Engine.recordScore(volleyball, { gamesWon: [2, 1], currentScore: [26, 24] }), [2, 1]);
});

test("提早結算預測與最終結算使用同一勝方判定", () => {
  const volleyball = Engine.volleyballPreset("standard");
  let state = Engine.createGameState(volleyball);
  state = winGame(volleyball, state, 0, 25);
  assert.deepEqual(Engine.settlementOutcome(volleyball, state, "score"), { winnerIndex: 0, noWinner: false });
  const finished = Engine.finishMatch(volleyball, state, "score"); assert.equal(finished.winnerIndex, 0);
  state = Engine.createGameState(volleyball);
  assert.deepEqual(Engine.settlementOutcome(volleyball, state, "score"), { winnerIndex: null, noWinner: true });
  const basketball = Engine.basketballPreset("single");
  state = Engine.createGameState(basketball); state = Engine.applyPoint(basketball, state, 1, 2).state;
  assert.deepEqual(Engine.settlementOutcome(basketball, state, "score"), { winnerIndex: 1, noWinner: false });
});

test("重設本局保留已完成局；修改舊局會重算", () => {
  const config = Engine.sanitizeConfig({ ...Engine.volleyballPreset("standard"), targetScore: 3, decidingGameTargetScore: 2, winBy: 1 });
  let state = Engine.createGameState(config); state = winGame(config, state, 0, 3); state = points(config, state, 1, 2);
  state = Engine.resetCurrentGame(config, state); assert.deepEqual(state.currentScore, [0, 0]); assert.deepEqual(state.gamesWon, [1, 0]);
  state = Engine.editCompletedGame(config, state, 0, [1, 3]); assert.deepEqual(state.gamesWon, [0, 1]);
});

test("提早結束、禁止再加分及重開", () => {
  const config = Engine.sanitizeConfig({ ...Engine.volleyballPreset("single"), targetScore: 3, winBy: 1 });
  let state = Engine.createGameState(config); state = points(config, state, 0, 2);
  const saved = Engine.finishMatch(config, state, "none"); assert.equal(saved.noWinner, true);
  assert.equal(Engine.applyPoint(config, saved, 1).event.reason, "match-finished");
  state = points(config, state, 0, 1); state = Engine.reopenMatch(config, state);
  assert.equal(state.status, "playing"); assert.deepEqual(state.currentScore, [2, 0]);
});
