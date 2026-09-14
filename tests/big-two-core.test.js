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
