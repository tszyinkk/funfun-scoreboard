const test = require("node:test");
const assert = require("node:assert/strict");
const MahjongCore = require("../mahjong-core.js");

const standard = { minimumFan: 3, maxFan: 13, basePoints: 1, fanStep: 2, scoringMode: "hk-table", maxPoints: 0 };

test("新牌局使用香港常用番數級別表", () => {
  const scores = [3, 4, 5, 6, 7, 9, 10, 12, 13, 20]
    .map((fan) => MahjongCore.scoreForFan({ ...standard, rawFan: fan }).points);
  assert.deepEqual(scores, [1, 2, 4, 4, 8, 8, 16, 16, 32, 32]);
});

test("8、10、13番封頂會先截番數，再按香港常用級別計分", () => {
  const expected = [[8, 8], [10, 16], [13, 32]];
  expected.forEach(([maxFan, points]) => {
    const result = MahjongCore.scoreForFan({ ...standard, rawFan: 20, maxFan });
    assert.equal(result.valid, true);
    assert.equal(result.fan, maxFan);
    assert.equal(result.points, points);
  });
});

test("舊牌局仍可沿用舊逐番倍增及線性計分", () => {
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 3, maxFan: 0, scoringMode: "doubling" }).points, 4);
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 4, maxFan: 0, scoringMode: "doubling" }).points, 8);
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 4, maxFan: 0, scoringMode: "linear" }).points, 4);
});

test("半辣上由四番後每兩番升一倍，中間一級為一倍半", () => {
  const scores = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    .map((fan) => MahjongCore.scoreForFan({ ...standard, rawFan: fan, scoringMode: "hk-half-spicy" }).points);
  assert.deepEqual(scores, [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48]);
});

test("辣辣上由三番開始每多一番跳一倍", () => {
  const scores = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    .map((fan) => MahjongCore.scoreForFan({ ...standard, rawFan: fan, scoringMode: "hk-full-spicy" }).points);
  assert.deepEqual(scores, [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]);
});

test("半辣上及辣辣上仍會跟隨8、10、13番封頂", () => {
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 13, maxFan: 8, scoringMode: "hk-half-spicy" }).points, 8);
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 13, maxFan: 10, scoringMode: "hk-half-spicy" }).points, 16);
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 20, maxFan: 13, scoringMode: "hk-half-spicy" }).points, 48);
  assert.equal(MahjongCore.scoreForFan({ ...standard, rawFan: 20, maxFan: 13, scoringMode: "hk-full-spicy" }).points, 1024);
});

test("未達3番起糊的牌型不可食糊", () => {
  const result = MahjongCore.scoreForFan({ ...standard, rawFan: 2 });
  assert.equal(result.valid, false);
  assert.equal(result.fan, 2);
});

test("每位玩家最少做一次莊才完成一圈，連莊會令局數增加", () => {
  const players = ["a", "b", "c", "d"];
  let session = { completedCycles: 0, handsInCycle: 0, completedHands: 0, dealerIdsInCycle: [] };
  ["a", "a", "b", "c"].forEach((dealer) => { session = MahjongCore.advanceProgress(session, dealer, players); });
  assert.equal(session.completedCycles, 0);
  assert.equal(session.handsInCycle, 4);
  session = MahjongCore.advanceProgress(session, "d", players);
  assert.equal(session.completedCycles, 1);
  assert.equal(session.completedHands, 5);
  assert.equal(session.handsInCycle, 0);
  assert.deepEqual(session.dealerIdsInCycle, []);
});

test("四圈中途可結算已完成圈數，而且下一圈繼續按牌局累進", () => {
  const players = ["a", "b", "c", "d"];
  let session = { plannedCycles: 4, completedCycles: 0, handsInCycle: 0, completedHands: 0, dealerIdsInCycle: [] };
  for (let cycle = 0; cycle < 2; cycle += 1) {
    players.forEach((dealer) => { session = MahjongCore.advanceProgress(session, dealer, players); });
  }
  assert.equal(session.completedCycles, 2);
  assert.equal(session.completedHands, 8);
  assert.match(MahjongCore.progressLabel(session, players), /第 3／4 圈/);
  assert.equal(session.completedCycles < session.plannedCycles, true);
});

test("完成預定圈數後仍可繼續並沿用下一圈圈風", () => {
  const session = { lengthMode: "east", plannedCycles: 1, completedCycles: 1, handsInCycle: 0, completedHands: 4, dealerIdsInCycle: [] };
  assert.equal(MahjongCore.hasCompletedPlan(session), true);
  assert.match(MahjongCore.progressLabel(session, ["a", "b", "c", "d"]), /已達預定/);
  assert.equal(MahjongCore.windForCycle("east", 1), "south");
});

test("東圈、半莊及自訂局數各自按正確條件完成", () => {
  assert.equal(MahjongCore.hasCompletedPlan({ lengthMode: "east", plannedCycles: 1, completedCycles: 1 }), true);
  assert.equal(MahjongCore.hasCompletedPlan({ lengthMode: "half", plannedCycles: 2, completedCycles: 1 }), false);
  assert.equal(MahjongCore.hasCompletedPlan({ lengthMode: "half", plannedCycles: 2, completedCycles: 2 }), true);
  assert.equal(MahjongCore.hasCompletedPlan({ lengthMode: "custom-hands", plannedHands: 12, completedHands: 11 }), false);
  assert.equal(MahjongCore.hasCompletedPlan({ lengthMode: "custom-hands", plannedHands: 12, completedHands: 12 }), true);
  assert.match(MahjongCore.progressLabel({ lengthMode: "custom-hands", plannedHands: 12, completedHands: 3, completedCycles: 0, handsInCycle: 3 }, []), /第 4／12 局/);
});

test("八圈遊戲第五圈回到東圈並標示第二輪", () => {
  const session = { plannedCycles: 8, completedCycles: 4, handsInCycle: 2, completedHands: 18, dealerIdsInCycle: [] };
  assert.equal(MahjongCore.windForCycle("east", 4), "east");
  assert.match(MahjongCore.progressLabel(session, ["a", "b", "c", "d"]), /第 5／8 圈・東圈（第2輪）・第 3 局/);
});

test("不同開始圈風會按進度循環", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((circle) => MahjongCore.windForCycle("south", circle)), ["south", "west", "north", "east", "south"]);
});
