const test = require("node:test");
const assert = require("node:assert/strict");
const BigTwoCore = require("../big-two-core.js");

test("鋤大D按8、10、13張計起炒、雙炒、三炒", () => {
  assert.deepEqual([1, 7, 8, 9, 10, 12, 13].map(BigTwoCore.multiplierForCards), [1, 1, 2, 2, 3, 3, 4]);
});

test("每位輸家按剩牌及炒牌倍數扣分，贏家收取總數", () => {
  const result = BigTwoCore.scoreRound(["a", "b", "c", "d"], "a", { b: 7, c: 9, d: 13 });
  assert.equal(result.valid, true);
  assert.deepEqual(result.net, { a: 77, b: -7, c: -18, d: -52 });
  assert.equal(Object.values(result.net).reduce((sum, score) => sum + score, 0), 0);
});

test("輸家剩牌必須為1至13張", () => {
  assert.equal(BigTwoCore.scoreRound(["a", "b", "c", "d"], "a", { b: 0, c: 2, d: 3 }).valid, false);
  assert.equal(BigTwoCore.scoreRound(["a", "b", "c", "d"], "x", { b: 1, c: 2, d: 3 }).valid, false);
});

test("娛樂排名模式贏家記0分，輸家照剩牌扣分", () => {
  const result = BigTwoCore.scoreRound(["a", "b", "c", "d"], "a", { b: 5, c: 8, d: 13 }, "ranking");
  assert.deepEqual(result.net, { a: 0, b: -5, c: -16, d: -52 });
});

test("5、8、10、12、13張對應正確倍數", () => {
  assert.deepEqual([5, 8, 10, 12, 13].map((cards) => BigTwoCore.penaltyForCards(cards)), [
    { cards: 5, multiplier: 1, points: 5 }, { cards: 8, multiplier: 2, points: 16 },
    { cards: 10, multiplier: 3, points: 30 }, { cards: 12, multiplier: 3, points: 36 },
    { cards: 13, multiplier: 4, points: 52 },
  ]);
});
