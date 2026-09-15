(function attachMahjongCore(root) {
  const WINDS = ["east", "south", "west", "north"];
  const WIND_NAMES = { east: "東圈", south: "南圈", west: "西圈", north: "北圈" };
  const WIND_SHORT_NAMES = { east: "東", south: "南", west: "西", north: "北" };
  const WIND_SHORT_NAMES_EN = { east: "E", south: "S", west: "W", north: "N" };

  function unitMultiplierForFan(fan) {
    const cleanFan = Math.max(0, Math.round(Number(fan) || 0));
    if (cleanFan <= 3) return 1;
    if (cleanFan === 4) return 2;
    if (cleanFan <= 6) return 4;
    if (cleanFan <= 9) return 8;
    if (cleanFan <= 12) return 16;
    return 32;
  }

  function halfSpicyMultiplierForFan(fan) {
    const cleanFan = Math.max(0, Math.round(Number(fan) || 0));
    if (cleanFan <= 4) return Math.pow(2, cleanFan - 3);
    const completedPairs = Math.floor((cleanFan - 4) / 2);
    return 2 * Math.pow(2, completedPairs) * (cleanFan % 2 === 1 ? 1.5 : 1);
  }

  function fullSpicyMultiplierForFan(fan) {
    const cleanFan = Math.max(0, Math.round(Number(fan) || 0));
    return Math.pow(2, cleanFan - 3);
  }

  function multiplierForFan(fan, scoringMode = "hk-table") {
    if (scoringMode === "hk-half-spicy") return halfSpicyMultiplierForFan(fan);
    if (scoringMode === "hk-full-spicy") return fullSpicyMultiplierForFan(fan);
    return unitMultiplierForFan(fan);
  }

  function scoreForFan({ rawFan, minimumFan, maxFan, basePoints, fanStep, scoringMode, maxPoints }) {
    const cleanRawFan = Math.max(0, Math.round(Number(rawFan) || 0));
    const cleanMinimumFan = Math.max(0, Math.round(Number(minimumFan) || 0));
    const cleanMaxFan = Math.max(0, Math.round(Number(maxFan) || 0));
    const fan = cleanMaxFan > 0 ? Math.min(cleanMaxFan, cleanRawFan) : cleanRawFan;
    if (fan < cleanMinimumFan) {
      return { valid: false, fan, rawFan: cleanRawFan, cappedByLimit: fan < cleanRawFan };
    }

    const base = Math.max(0, Number(basePoints) || 0);
    const step = Math.max(1, Number(fanStep) || 1);
    const multiplier = multiplierForFan(fan, scoringMode);
    const points = scoringMode === "linear"
      ? base * fan
      : scoringMode === "doubling"
        ? base * Math.pow(step, Math.max(0, fan - 1))
        : base * multiplier;
    const pointLimit = Math.max(0, Number(maxPoints) || 0);
    return {
      valid: true,
      fan,
      rawFan: cleanRawFan,
      cappedByLimit: fan < cleanRawFan,
      multiplier: scoringMode === "doubling" || scoringMode === "linear" ? null : multiplier,
      points: pointLimit > 0 ? Math.min(pointLimit, points) : points,
    };
  }

  function windForCycle(startingWind, zeroBasedCycle) {
    const startIndex = Math.max(0, WINDS.indexOf(startingWind));
    const cycleIndex = Math.max(0, Math.floor(Number(zeroBasedCycle) || 0));
    return WINDS[(startIndex + cycleIndex) % WINDS.length];
  }

  function handWindLabel(session, participantIds, language = "zh") {
    const players = Array.isArray(participantIds) ? participantIds.map(String) : [];
    const completed = Math.max(0, Math.floor(Number(session?.completedCycles) || 0));
    const prevailingWind = windForCycle(session?.startingWind || "east", completed);
    const fallbackDealer = players[Math.max(0, Math.floor(Number(session?.handsInCycle) || 0)) % Math.max(1, players.length)] || players[0] || "";
    const dealerId = String(session?.nextDealerId || fallbackDealer);
    const dealerIndex = Math.max(0, players.indexOf(dealerId));
    const handWind = WINDS[dealerIndex % WINDS.length];
    if (language === "en") return `${WIND_SHORT_NAMES_EN[prevailingWind] || "E"} Round · ${WIND_SHORT_NAMES_EN[handWind] || "E"} Dealer`;
    return `${WIND_SHORT_NAMES[prevailingWind] || "東"}風${WIND_SHORT_NAMES[handWind] || "東"}`;
  }

  function progressLabel(session, participantIds, language = "zh") {
    const completed = Math.max(0, Math.floor(Number(session?.completedCycles) || 0));
    const cycleNumber = completed + 1;
    const planned = Math.max(0, Math.floor(Number(session?.plannedCycles) || 0));
    const roundNumber = Math.floor(completed / WINDS.length) + 1;
    const secondLap = roundNumber > 1 ? (language === "en" ? ` (lap ${roundNumber})` : `（第${roundNumber}輪）`) : "";
    const handLabel = handWindLabel(session, participantIds, language);
    if (session?.lengthMode === "custom-hands") {
      const completedHands = Math.max(0, Math.floor(Number(session.completedHands) || 0));
      const plannedHands = Math.max(0, Math.floor(Number(session.plannedHands) || 0));
      return language === "en"
        ? `${handLabel}${secondLap} · ${completedHands}${plannedHands ? `/${plannedHands}` : ""} hands completed`
        : `${handLabel}${secondLap}・已完成 ${completedHands}${plannedHands ? `／${plannedHands}` : ""} 手`;
    }
    const cycleLabel = planned > 0 && cycleNumber <= planned
      ? `第 ${cycleNumber}／${planned} 圈`
      : `第 ${cycleNumber} 圈${planned > 0 ? "（已達預定）" : ""}`;
    if (language === "en") {
      const englishCycle = planned > 0 && cycleNumber <= planned
        ? `Round ${cycleNumber}/${planned}`
        : `Round ${cycleNumber}${planned > 0 ? " (planned length reached)" : ""}`;
      return `${englishCycle}${secondLap} · ${handLabel}`;
    }
    return `${cycleLabel}${secondLap}・${handLabel}`;
  }

  function friendlyProgressLabel(session, participants, language = "zh") {
    const players = Array.isArray(participants) ? participants : [];
    const ids = players.map((player) => String(typeof player === "object" ? player.id : player));
    const names = Object.fromEntries(players.map((player, index) => [ids[index], typeof player === "object" ? String(player.name || "") : String(player)]));
    const completed = Math.max(0, Math.floor(Number(session?.completedCycles) || 0));
    const planned = Math.max(0, Math.floor(Number(session?.plannedCycles) || 0));
    const cycle = completed + 1;
    const wind = windForCycle(session?.startingWind || "east", completed);
    const fallbackDealer = ids[Math.max(0, Math.floor(Number(session?.handsInCycle) || 0)) % Math.max(1, ids.length)] || ids[0] || "";
    const dealerId = String(session?.nextDealerId || fallbackDealer);
    const dealerName = names[dealerId] || (language === "en" ? "Player" : "玩家");
    const streak = Math.max(0, Math.floor(Number(session?.dealerStreak) || 0));
    const hands = Math.max(0, Math.floor(Number(session?.completedHands) || 0));
    const cycleText = planned > 0 ? `${cycle}/${planned}` : String(cycle);
    if (language === "en") {
      const windText = { east: "East Round", south: "South Round", west: "West Round", north: "North Round" }[wind] || "East Round";
      return `Round ${cycleText} | ${windText} | ${dealerName} deals${streak ? ` | ${streak} repeat${streak === 1 ? "" : "s"}` : ""} | ${hands} hands played`;
    }
    return `第${cycleText}圈｜${WIND_NAMES[wind] || "東圈"}｜${dealerName}做莊${streak ? `｜連莊${streak}次` : ""}｜已玩${hands}局`;
  }

  function advanceProgress(session, dealerId, participantIds, nextDealerId = "") {
    const players = Array.isArray(participantIds) ? participantIds.map(String) : [];
    const ids = [...new Set([...(session?.dealerIdsInCycle || []).map(String), String(dealerId || "")].filter((id) => players.includes(id)))];
    let completedCycles = Math.max(0, Math.floor(Number(session?.completedCycles) || 0));
    let handsInCycle = Math.max(0, Math.floor(Number(session?.handsInCycle) || 0)) + 1;
    let dealerIdsInCycle = ids;
    const hasNextDealer = players.includes(String(nextDealerId || ""));
    const completedByRotation = hasNextDealer
      ? String(nextDealerId) !== String(dealerId || "") && players.every((id) => ids.includes(id))
      : players.every((id) => ids.includes(id));
    if (players.length > 0 && completedByRotation) {
      completedCycles += 1;
      handsInCycle = 0;
      dealerIdsInCycle = [];
    }
    return {
      ...session,
      completedHands: Math.max(0, Math.floor(Number(session?.completedHands) || 0)) + 1,
      completedCycles,
      handsInCycle,
      dealerIdsInCycle,
      dealerStreak: String(nextDealerId || "") === String(dealerId || "")
        ? Math.max(0, Math.floor(Number(session?.dealerStreak) || 0)) + 1
        : 0,
      lastDealerId: String(dealerId || ""),
    };
  }

  function hasCompletedPlan(session) {
    if (session?.lengthMode === "custom-hands") {
      const targetHands = Math.max(0, Math.floor(Number(session.plannedHands) || 0));
      return targetHands > 0 && Math.max(0, Math.floor(Number(session.completedHands) || 0)) >= targetHands;
    }
    const targetCycles = Math.max(0, Math.floor(Number(session?.plannedCycles) || 0));
    return targetCycles > 0 && Math.max(0, Math.floor(Number(session?.completedCycles) || 0)) >= targetCycles;
  }

  const api = {
    WINDS,
    WIND_NAMES,
    WIND_SHORT_NAMES,
    WIND_SHORT_NAMES_EN,
    unitMultiplierForFan,
    halfSpicyMultiplierForFan,
    fullSpicyMultiplierForFan,
    multiplierForFan,
    scoreForFan,
    windForCycle,
    handWindLabel,
    progressLabel,
    friendlyProgressLabel,
    advanceProgress,
    hasCompletedPlan,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MahjongCore = api;
})(typeof window === "undefined" ? globalThis : window);
