const test = require("node:test");
const assert = require("node:assert/strict");
const Analyzer = require("../mahjong-hand-analyzer.js");

test("一般四組一對會先驗證結構並認出平糊", () => {
  const result = Analyzer.analyzeHand({
    concealed: ["m1", "m2", "m3", "m4", "m5", "m6", "p1", "p2", "p3", "s7", "s8", "s9", "p5", "p5"],
    flowers: 0,
  });
  assert.equal(result.valid, true);
  assert.ok(result.patterns.includes("pinghu"));
  assert.ok(result.patterns.includes("concealed"));
  assert.ok(result.patterns.includes("no-flower"));
});

test("已碰及已上牌會連同手牌一齊驗證", () => {
  const result = Analyzer.analyzeHand({
    concealed: ["m1", "m2", "m3", "s4", "s5", "s6", "p7", "p8", "p9", "we", "we"],
    melds: [{ type: "pung", tile: "dr" }],
    flowers: 1,
  });
  assert.equal(result.valid, true);
  assert.ok(result.patterns.includes("dragon-pung"));
  assert.ok(!result.patterns.includes("concealed"));
});

test("十三么只會建議十三么，不會重複疊加細番", () => {
  const result = Analyzer.analyzeHand({ concealed: ["m1", "m9", "s1", "s9", "p1", "p9", "we", "ws", "ww", "wn", "dr", "dg", "dw", "dr"] });
  assert.deepEqual(result.patterns, ["thirteen-orphans"]);
});

test("同一花色七對子會同時建議清一色，但不會錯加門前清", () => {
  const result = Analyzer.analyzeHand({ concealed: ["m1", "m1", "m2", "m2", "m3", "m3", "m4", "m4", "m5", "m5", "m6", "m6", "m7", "m7"] });
  assert.equal(result.valid, true);
  assert.ok(result.patterns.includes("seven-pairs"));
  assert.ok(result.patterns.includes("full-flush"));
  assert.ok(!result.patterns.includes("concealed"));
});

test("錯誤牌數及第五隻同牌會被拒絕", () => {
  assert.equal(Analyzer.analyzeHand({ concealed: ["m1"] }).reason, "wrong-tile-count");
  const tooMany = Analyzer.analyzeHand({
    concealed: ["m1", "m1", "m1", "m1", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m9"],
  });
  assert.equal(tooMany.reason, "too-many-copies");
});

test("槓會按四隻實體牌計，但只佔一組牌型", () => {
  const result = Analyzer.analyzeHand({
    concealed: ["m1", "m2", "m3", "s1", "s2", "s3", "p1", "p2", "p3", "we", "we"],
    melds: [{ type: "kong", tile: "dr" }],
  });
  assert.equal(result.valid, true);
  assert.equal(result.expected, 11);
  assert.ok(result.patterns.includes("dragon-pung"));
});

test("大三元不會再重複加入三元牌細番", () => {
  const result = Analyzer.analyzeHand({ concealed: ["dr", "dr", "dr", "dg", "dg", "dg", "dw", "dw", "dw", "m1", "m2", "m3", "p5", "p5"] });
  assert.deepEqual(result.patterns, ["big-dragons"]);
});

test("小三元不會重複加入三元牌刻子", () => {
  const result = Analyzer.analyzeHand({ concealed: ["dr", "dr", "dr", "dg", "dg", "dg", "dw", "dw", "m1", "m2", "m3", "p1", "p2", "p3"] });
  assert.equal(result.valid, true);
  assert.ok(result.patterns.includes("small-dragons"));
  assert.ok(!result.patterns.includes("dragon-pung"));
});

test("九蓮寶燈及十八羅漢會按獨立牌型處理", () => {
  const nineGates = Analyzer.analyzeHand({ concealed: ["m1", "m1", "m1", "m2", "m3", "m4", "m5", "m5", "m6", "m7", "m8", "m9", "m9", "m9"] });
  assert.deepEqual(nineGates.patterns, ["nine-gates"]);
  const fourKongs = Analyzer.analyzeHand({
    concealed: ["we", "we"],
    melds: [
      { type: "kong", tile: "m1" },
      { type: "kong", tile: "m9" },
      { type: "kong", tile: "s1" },
      { type: "kong", tile: "s9" },
    ],
  });
  assert.deepEqual(fourKongs.patterns, ["four-kongs"]);
});

test("混么九不會再重複加入對對糊及花么九", () => {
  const result = Analyzer.analyzeHand({ concealed: ["m1", "m1", "m1", "m9", "m9", "m9", "s1", "s1", "s1", "dr", "dr", "dr", "we", "we"] });
  assert.deepEqual(result.patterns, ["mixed-terminals"]);
});
