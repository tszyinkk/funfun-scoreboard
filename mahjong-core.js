(function attachMahjongCore(root) {
  const WINDS = ["east", "south", "west", "north"];
  const WIND_NAMES = { east: "東圈", south: "南圈", west: "西圈", north: "北圈" };

  function unitMultiplierForFan(fan) {
    const cleanFan = Math.max(0, Math.round(Number(fan) || 0));
    if (cleanFan <= 3) return 1;
    if (cleanFan === 4) return 2;
    if (cleanFan <= 6) return 4;
    if (cleanFan <= 9) return 8;
    if (cleanFan <= 12) return 16;
    return 32;
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
    const multiplier = unitMultiplierForFan(fan);
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

  function progressLabel(session, participantIds) {
    const completed = Math.max(0, Math.floor(Number(session?.completedCycles) || 0));
    const cycleNumber = completed + 1;
    const planned = Math.max(0, Math.floor(Number(session?.plannedCycles) || 0));
    const wind = windForCycle(session?.startingWind || "east", completed);
    const roundNumber = Math.floor(completed / WINDS.length) + 1;
    const secondLap = roundNumber > 1 ? `（第${roundNumber}輪）` : "";
    const handNumber = Math.max(0, Math.floor(Number(session?.handsInCycle) || 0)) + 1;
    const windLabel = WIND_NAMES[wind] || WIND_NAMES.east;
    if (session?.lengthMode === "custom-hands") {
      const completedHands = Math.max(0, Math.floor(Number(session.completedHands) || 0));
      const plannedHands = Math.max(0, Math.floor(Number(session.plannedHands) || 0));
      return `自訂局數・第 ${completedHands + 1}${plannedHands ? `／${plannedHands}` : ""} 局・${windLabel}${secondLap}（該圈第 ${handNumber} 局）`;
    }
    const cycleLabel = planned > 0 && cycleNumber <= planned
      ? `第 ${cycleNumber}／${planned} 圈`
      : `第 ${cycleNumber} 圈${planned > 0 ? "（已達預定）" : ""}`;
    return `${cycleLabel}・${windLabel}${secondLap}・第 ${handNumber} 局`;
  }

  function advanceProgress(session, dealerId, participantIds) {
    const players = Array.isArray(participantIds) ? participantIds.map(String) : [];
    const ids = [...new Set([...(session?.dealerIdsInCycle || []).map(String), String(dealerId || "")].filter((id) => players.includes(id)))];
    let completedCycles = Math.max(0, Math.floor(Number(session?.completedCycles) || 0));
    let handsInCycle = Math.max(0, Math.floor(Number(session?.handsInCycle) || 0)) + 1;
    let dealerIdsInCycle = ids;
    if (players.length > 0 && players.every((id) => ids.includes(id))) {
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

  const api = { WINDS, WIND_NAMES, unitMultiplierForFan, scoreForFan, windForCycle, progressLabel, advanceProgress, hasCompletedPlan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MahjongCore = api;
})(typeof window === "undefined" ? globalThis : window);
