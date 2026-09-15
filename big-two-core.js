(function attachBigTwoCore(root) {
  function multiplierForCards(cards) {
    const remaining = Math.max(0, Math.min(13, Math.floor(Number(cards) || 0)));
    if (remaining >= 13) return 4;
    if (remaining >= 10) return 3;
    if (remaining >= 8) return 2;
    return 1;
  }

  function penaltyForCards(cards) {
    const remaining = Math.max(0, Math.min(13, Math.floor(Number(cards) || 0)));
    const multiplier = multiplierForCards(remaining);
    return { cards: remaining, multiplier, points: remaining * multiplier };
  }

  function scoreRound(participantIds, winnerId, remainingById = {}, mode = "money") {
    const players = Array.isArray(participantIds) ? participantIds.map(String) : [];
    const winner = String(winnerId || "");
    if (!players.includes(winner)) return { valid: false, reason: "winner" };
    const penalties = {};
    let gain = 0;
    let valid = true;
    players.forEach((id) => {
      if (id === winner) {
        penalties[id] = { cards: 0, multiplier: 1, points: 0 };
        return;
      }
      const rawCards = Number(remainingById[id]);
      if (!Number.isInteger(rawCards) || rawCards < 1 || rawCards > 13) valid = false;
      penalties[id] = penaltyForCards(rawCards);
      gain += penalties[id].points;
    });
    if (!valid) return { valid: false, reason: "remaining", penalties };
    const scoringMode = mode === "ranking" ? "ranking" : "money";
    const net = Object.fromEntries(players.map((id) => [id, id === winner ? (scoringMode === "money" ? gain : 0) : -penalties[id].points]));
    return { valid: true, winnerId: winner, penalties, gain, net, mode: scoringMode };
  }

  const api = { multiplierForCards, penaltyForCards, scoreRound };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BigTwoCore = api;
})(typeof window === "undefined" ? globalThis : window);
