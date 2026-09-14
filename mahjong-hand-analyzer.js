(function initMahjongHandAnalyzer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MahjongHandAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const winds = ["east", "south", "west", "north"];
  const tileDefs = [
    ...Array.from({ length: 9 }, (_, index) => ({ id: `m${index + 1}`, suit: "m", rank: index + 1, glyph: String.fromCodePoint(0x1f007 + index), zh: `${index + 1}萬`, en: `${index + 1} Characters` })),
    ...Array.from({ length: 9 }, (_, index) => ({ id: `s${index + 1}`, suit: "s", rank: index + 1, glyph: String.fromCodePoint(0x1f010 + index), zh: `${index + 1}索`, en: `${index + 1} Bamboo` })),
    ...Array.from({ length: 9 }, (_, index) => ({ id: `p${index + 1}`, suit: "p", rank: index + 1, glyph: String.fromCodePoint(0x1f019 + index), zh: `${index + 1}筒`, en: `${index + 1} Dots` })),
    { id: "we", suit: "honor", honor: "wind", wind: "east", glyph: "🀀", zh: "東", en: "East" },
    { id: "ws", suit: "honor", honor: "wind", wind: "south", glyph: "🀁", zh: "南", en: "South" },
    { id: "ww", suit: "honor", honor: "wind", wind: "west", glyph: "🀂", zh: "西", en: "West" },
    { id: "wn", suit: "honor", honor: "wind", wind: "north", glyph: "🀃", zh: "北", en: "North" },
    { id: "dr", suit: "honor", honor: "dragon", glyph: "🀄", zh: "紅中", en: "Red Dragon" },
    { id: "dg", suit: "honor", honor: "dragon", glyph: "🀅", zh: "發財", en: "Green Dragon" },
    { id: "dw", suit: "honor", honor: "dragon", glyph: "🀆", zh: "白板", en: "White Dragon" },
  ];
  const tileMap = Object.fromEntries(tileDefs.map((tile) => [tile.id, tile]));
  const orphanIds = ["m1", "m9", "s1", "s9", "p1", "p9", "we", "ws", "ww", "wn", "dr", "dg", "dw"];

  function countTiles(ids = []) {
    return ids.reduce((counts, id) => {
      if (tileMap[id]) counts[id] = (counts[id] || 0) + 1;
      return counts;
    }, {});
  }

  function meldTileIds(meld) {
    const tile = tileMap[meld?.tile];
    if (!tile) return [];
    if (meld.type === "chow") {
      if (tile.suit === "honor" || tile.rank > 7) return [];
      return [`${tile.suit}${tile.rank}`, `${tile.suit}${tile.rank + 1}`, `${tile.suit}${tile.rank + 2}`];
    }
    if (meld.type === "pung") return [tile.id, tile.id, tile.id];
    if (meld.type === "kong") return [tile.id, tile.id, tile.id, tile.id];
    return [];
  }

  function firstCountedTile(counts) {
    return tileDefs.find((tile) => (counts[tile.id] || 0) > 0)?.id || "";
  }

  function decomposeMelds(counts, needed, groups = [], solutions = []) {
    if (solutions.length >= 40) return solutions;
    const first = firstCountedTile(counts);
    if (!first) {
      if (needed === 0) solutions.push(groups);
      return solutions;
    }
    if (needed <= 0) return solutions;
    const tile = tileMap[first];
    if (counts[first] >= 3) {
      const next = { ...counts, [first]: counts[first] - 3 };
      decomposeMelds(next, needed - 1, [...groups, { type: "pung", tile: first, open: false }], solutions);
    }
    if (tile.suit !== "honor" && tile.rank <= 7) {
      const ids = [`${tile.suit}${tile.rank}`, `${tile.suit}${tile.rank + 1}`, `${tile.suit}${tile.rank + 2}`];
      if (ids.every((id) => (counts[id] || 0) > 0)) {
        const next = { ...counts };
        ids.forEach((id) => { next[id] -= 1; });
        decomposeMelds(next, needed - 1, [...groups, { type: "chow", tile: first, open: false }], solutions);
      }
    }
    return solutions;
  }

  function standardSolutions(concealedCounts, exposedCount) {
    const needed = 4 - exposedCount;
    const solutions = [];
    tileDefs.forEach((tile) => {
      if ((concealedCounts[tile.id] || 0) < 2) return;
      const rest = { ...concealedCounts, [tile.id]: concealedCounts[tile.id] - 2 };
      decomposeMelds(rest, needed, [], []).forEach((groups) => solutions.push({ pair: tile.id, groups }));
    });
    return solutions;
  }

  function isSevenPairs(counts, exposedCount) {
    return exposedCount === 0 && Object.values(counts).filter(Boolean).length === 7 && Object.values(counts).filter(Boolean).every((count) => count === 2);
  }

  function isThirteenOrphans(counts, exposedCount) {
    if (exposedCount !== 0) return false;
    if (Object.entries(counts).some(([id, count]) => count > 0 && !orphanIds.includes(id))) return false;
    return orphanIds.every((id) => (counts[id] || 0) >= 1)
      && orphanIds.filter((id) => counts[id] === 2).length === 1
      && Object.values(counts).reduce((sum, count) => sum + count, 0) === 14;
  }

  function isNineGates(counts, exposedCount) {
    if (exposedCount !== 0) return false;
    const used = tileDefs.filter((tile) => (counts[tile.id] || 0) > 0);
    const suits = [...new Set(used.map((tile) => tile.suit))];
    if (suits.length !== 1 || suits[0] === "honor") return false;
    const suit = suits[0];
    const baseline = [3, 1, 1, 1, 1, 1, 1, 1, 3];
    const extras = baseline.reduce((sum, minimum, index) => sum + Math.max(0, (counts[`${suit}${index + 1}`] || 0) - minimum), 0);
    return baseline.every((minimum, index) => (counts[`${suit}${index + 1}`] || 0) >= minimum) && extras === 1;
  }

  function sevenPairPatterns(counts, flowers) {
    const used = tileDefs.filter((tile) => (counts[tile.id] || 0) > 0);
    const numberedSuits = [...new Set(used.filter((tile) => tile.suit !== "honor").map((tile) => tile.suit))];
    const hasHonors = used.some((tile) => tile.suit === "honor");
    if (used.every((tile) => tile.suit === "honor")) return ["all-honors"];
    const patterns = ["seven-pairs"];
    if (numberedSuits.length === 1) patterns.push(hasHonors ? "half-flush" : "full-flush");
    if (Number(flowers) === 0) patterns.push("no-flower");
    return patterns;
  }

  function patternIdsForSolution({ counts, pair, groups, exposedMelds, seatWind, prevailingWind, flowers }) {
    if (isNineGates(counts, exposedMelds.length)) return ["nine-gates"];
    const allGroups = [...exposedMelds.map((meld) => ({ ...meld, open: meld.open !== false })), ...groups];
    const hasOpenMeld = exposedMelds.some((meld) => meld.open !== false);
    const pungs = allGroups.filter((group) => group.type === "pung" || group.type === "kong");
    const pungIds = pungs.map((group) => group.tile);
    const windPungs = pungIds.filter((id) => tileMap[id]?.honor === "wind");
    const dragonPungs = pungIds.filter((id) => tileMap[id]?.honor === "dragon");
    const used = tileDefs.filter((tile) => (counts[tile.id] || 0) > 0);
    const numberedSuits = [...new Set(used.filter((tile) => tile.suit !== "honor").map((tile) => tile.suit))];
    const hasHonors = used.some((tile) => tile.suit === "honor");
    const hasNumbered = used.some((tile) => tile.suit !== "honor");
    const allTerminalsOrHonors = used.every((tile) => tile.suit === "honor" || tile.rank === 1 || tile.rank === 9);
    const allTerminals = used.every((tile) => tile.suit !== "honor" && (tile.rank === 1 || tile.rank === 9));
    const allPungs = allGroups.every((group) => group.type === "pung" || group.type === "kong");
    const ids = [];

    if (allGroups.filter((group) => group.type === "kong").length === 4) return ["four-kongs"];
    if (windPungs.length === 4) return ["big-winds"];
    if (dragonPungs.length === 3) return ["big-dragons"];
    if (used.length && !hasNumbered) return ["all-honors"];
    if (used.length && allTerminals) return ["pure-terminals"];
    if (allTerminalsOrHonors && hasHonors && hasNumbered && allPungs) return ["mixed-terminals"];
    if (allPungs && !hasOpenMeld) return ["concealed-pungs"];

    if (windPungs.length === 3 && tileMap[pair]?.honor === "wind") ids.push("small-winds");
    if (dragonPungs.length === 2 && tileMap[pair]?.honor === "dragon") ids.push("small-dragons");
    if (!ids.includes("small-dragons") && dragonPungs.length) ids.push("dragon-pung");
    if (!ids.includes("small-winds")) {
      const seatTile = { east: "we", south: "ws", west: "ww", north: "wn" }[seatWind];
      const roundTile = { east: "we", south: "ws", west: "ww", north: "wn" }[prevailingWind];
      if (seatTile && pungIds.includes(seatTile)) ids.push("seat-wind");
      if (roundTile && pungIds.includes(roundTile)) ids.push("prevailing-wind");
    }
    if (allGroups.every((group) => group.type === "chow") && tileMap[pair]?.suit !== "honor") ids.push("pinghu");
    if (allPungs) {
      ids.push("all-pungs");
    } else if (!hasOpenMeld) ids.push("concealed");
    if (numberedSuits.length === 1) ids.push(hasHonors ? "half-flush" : "full-flush");
    const everyGroupUsesEdge = allGroups.every((group) => {
      const tile = tileMap[group.tile];
      return tile.suit === "honor" || group.type === "chow" ? tile.suit === "honor" || tile.rank === 1 || tile.rank === 7 : tile.rank === 1 || tile.rank === 9;
    });
    if (everyGroupUsesEdge && (tileMap[pair]?.suit === "honor" || [1, 9].includes(tileMap[pair]?.rank))) ids.push("terminals-honors");
    if (Number(flowers) === 0) ids.push("no-flower");
    return [...new Set(ids)];
  }

  function analyzeHand({ concealed = [], melds = [], seatWind = "east", prevailingWind = "east", flowers = 0 } = {}) {
    const cleanMelds = melds.map((meld) => ({ type: meld?.type, tile: meld?.tile, open: meld?.open !== false }));
    if (cleanMelds.length > 4) return { valid: false, reason: "too-many-melds" };
    if (!winds.includes(seatWind) || !winds.includes(prevailingWind)) return { valid: false, reason: "invalid-wind" };
    if (cleanMelds.some((meld) => meldTileIds(meld).length === 0)) return { valid: false, reason: "invalid-meld" };
    const concealedCounts = countTiles(concealed);
    const exposedIds = cleanMelds.flatMap(meldTileIds);
    const allCounts = countTiles([...concealed, ...exposedIds]);
    if (Object.values(allCounts).some((count) => count > 4)) return { valid: false, reason: "too-many-copies" };
    const expected = 14 - cleanMelds.length * 3;
    if (concealed.length !== expected) return { valid: false, reason: "wrong-tile-count", expected, actual: concealed.length };
    if (isThirteenOrphans(concealedCounts, cleanMelds.length)) return { valid: true, special: true, patterns: ["thirteen-orphans"], expected, actual: concealed.length };
    if (isSevenPairs(concealedCounts, cleanMelds.length)) return { valid: true, special: true, patterns: sevenPairPatterns(concealedCounts, flowers), expected, actual: concealed.length };
    const solutions = standardSolutions(concealedCounts, cleanMelds.length);
    if (!solutions.length) return { valid: false, reason: "not-winning-hand", expected, actual: concealed.length };
    const candidates = solutions.map((solution) => ({
      ...solution,
      patterns: patternIdsForSolution({ counts: allCounts, pair: solution.pair, groups: solution.groups, exposedMelds: cleanMelds, seatWind, prevailingWind, flowers }),
    }));
    candidates.sort((left, right) => right.patterns.length - left.patterns.length);
    return { valid: true, special: false, ...candidates[0], expected, actual: concealed.length };
  }

  return { TILE_DEFS: tileDefs, TILE_MAP: tileMap, meldTileIds, analyzeHand };
});
