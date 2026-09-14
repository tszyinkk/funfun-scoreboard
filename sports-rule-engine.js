(function attachSportsRuleEngine(root) {
  const MATCH_FORMATS = {
    single: { numberOfGames: 1, gamesToWin: 1 },
    "best-of-3": { numberOfGames: 3, gamesToWin: 2 },
    "best-of-5": { numberOfGames: 5, gamesToWin: 3 },
    "best-of-7": { numberOfGames: 7, gamesToWin: 4 },
  };

  function cleanInteger(value, fallback, min = 0, max = 999) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function volleyballPreset(preset = "standard") {
    if (preset === "single") {
      return {
        version: 1,
        sportType: "volleyball",
        preset: "single",
        matchFormat: "single",
        numberOfGames: 1,
        gamesToWin: 1,
        targetScore: 21,
        winBy: 1,
        maxScore: 0,
        useDifferentDecidingGame: false,
        decidingGameTargetScore: 21,
        scoringMode: "rally-point",
        timedMode: false,
        periodCount: 0,
      };
    }
    return {
      version: 1,
      sportType: "volleyball",
      preset: preset === "custom" ? "custom" : "standard",
      matchFormat: "best-of-3",
      numberOfGames: 3,
      gamesToWin: 2,
      targetScore: 25,
      winBy: 2,
      maxScore: 0,
      useDifferentDecidingGame: true,
      decidingGameTargetScore: 15,
      scoringMode: "rally-point",
      timedMode: false,
      periodCount: 0,
    };
  }

  function sanitizeConfig(input = {}) {
    const preset = ["standard", "single", "custom"].includes(input.preset) ? input.preset : "standard";
    const defaults = volleyballPreset(preset);
    const matchFormat = MATCH_FORMATS[input.matchFormat] ? input.matchFormat : defaults.matchFormat;
    const format = MATCH_FORMATS[matchFormat];
    const targetScore = cleanInteger(input.targetScore, defaults.targetScore, 1, 999);
    const rawCap = cleanInteger(input.maxScore, defaults.maxScore, 0, 999);
    return {
      ...defaults,
      sportType: input.sportType === "volleyball" ? "volleyball" : defaults.sportType,
      preset,
      matchFormat,
      numberOfGames: format.numberOfGames,
      gamesToWin: format.gamesToWin,
      targetScore,
      winBy: cleanInteger(input.winBy, defaults.winBy, 1, 20),
      maxScore: rawCap > 0 ? Math.max(targetScore, rawCap) : 0,
      useDifferentDecidingGame: format.numberOfGames > 1 && input.useDifferentDecidingGame !== false,
      decidingGameTargetScore: cleanInteger(input.decidingGameTargetScore, defaults.decidingGameTargetScore, 1, 999),
      scoringMode: String(input.scoringMode || defaults.scoringMode),
      timedMode: input.timedMode === true,
      periodCount: cleanInteger(input.periodCount, defaults.periodCount, 0, 20),
    };
  }

  function targetForGame(configInput, gameNumber) {
    const config = sanitizeConfig(configInput);
    const deciding = config.useDifferentDecidingGame && Number(gameNumber) === config.numberOfGames;
    return deciding ? config.decidingGameTargetScore : config.targetScore;
  }

  function scoreWinsGame(score, opponentScore, targetScore, winBy, maxScore) {
    if (score <= opponentScore) return false;
    if (maxScore > 0 && score >= maxScore) return true;
    return score >= targetScore && score - opponentScore >= winBy;
  }

  function evaluate(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = gameStateInput || {};
    const score = [0, 1].map((index) => cleanInteger(state.currentScore?.[index], 0, 0, 9999));
    const setsWon = [0, 1].map((index) => cleanInteger(state.gamesWon?.[index], 0, 0, config.gamesToWin));
    const currentGame = cleanInteger(state.currentGame, 1, 1, config.numberOfGames);
    const targetScore = targetForGame(config, currentGame);
    const gameWinnerIndex = [0, 1].find((index) => scoreWinsGame(score[index], score[1 - index], targetScore, config.winBy, config.maxScore));
    const gamePointFor = [0, 1].filter((index) => scoreWinsGame(score[index] + 1, score[1 - index], targetScore, config.winBy, config.maxScore));
    const matchPointFor = gamePointFor.filter((index) => setsWon[index] + 1 >= config.gamesToWin);
    const deuce = config.winBy > 1 && score[0] === score[1] && score[0] >= targetScore - 1;
    let status = "playing";
    if (state.status === "finished") status = "finished";
    else if (matchPointFor.length) status = "match-point";
    else if (gamePointFor.length) status = "game-point";
    else if (deuce) status = "deuce";
    return {
      status,
      score,
      gamesWon: setsWon,
      currentGame,
      targetScore,
      gameWinnerIndex: Number.isInteger(gameWinnerIndex) ? gameWinnerIndex : null,
      gamePointFor,
      matchPointFor,
      deuce,
      finalGame: currentGame === config.numberOfGames,
    };
  }

  function createGameState(configInput) {
    const config = sanitizeConfig(configInput);
    return {
      version: 1,
      status: "playing",
      currentGame: 1,
      currentScore: [0, 0],
      completedGames: [],
      gamesWon: [0, 0],
      winnerIndex: null,
      pointHistory: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastSignal: evaluate(config, { currentGame: 1, currentScore: [0, 0], gamesWon: [0, 0] }).status,
    };
  }

  function cloneState(config, stateInput) {
    const fresh = createGameState(config);
    const state = stateInput && typeof stateInput === "object" ? stateInput : {};
    return {
      ...fresh,
      ...state,
      currentGame: cleanInteger(state.currentGame, 1, 1, config.numberOfGames),
      currentScore: [0, 1].map((index) => cleanInteger(state.currentScore?.[index], 0, 0, 9999)),
      completedGames: Array.isArray(state.completedGames) ? state.completedGames.map((game, index) => ({
        number: cleanInteger(game.number, index + 1, 1, config.numberOfGames),
        scores: [0, 1].map((team) => cleanInteger(game.scores?.[team], 0, 0, 9999)),
        winnerIndex: game.winnerIndex === 1 ? 1 : 0,
        targetScore: cleanInteger(game.targetScore, config.targetScore, 1, 999),
        completedAt: game.completedAt || null,
      })).slice(0, config.numberOfGames) : [],
      gamesWon: [0, 1].map((index) => cleanInteger(state.gamesWon?.[index], 0, 0, config.gamesToWin)),
      winnerIndex: state.winnerIndex === 0 || state.winnerIndex === 1 ? state.winnerIndex : null,
      pointHistory: Array.isArray(state.pointHistory) ? state.pointHistory.map((point) => ({
        teamIndex: point.teamIndex === 1 ? 1 : 0,
        points: cleanInteger(point.points, 1, 1, 20),
        gameNumber: cleanInteger(point.gameNumber, 1, 1, config.numberOfGames),
        createdAt: point.createdAt || null,
      })).slice(-10000) : [],
      status: state.status === "finished" ? "finished" : "playing",
    };
  }

  function applyPoint(configInput, gameStateInput, teamIndex, points = 1, createdAt = new Date().toISOString()) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status === "finished" || ![0, 1].includes(Number(teamIndex))) {
      return { state, event: { type: "blocked", reason: state.status === "finished" ? "match-finished" : "invalid-team" } };
    }
    const cleanPoints = cleanInteger(points, 1, 1, 20);
    const scoringTeam = Number(teamIndex);
    state.currentScore[scoringTeam] += cleanPoints;
    state.pointHistory.push({ teamIndex: scoringTeam, points: cleanPoints, gameNumber: state.currentGame, createdAt });
    const signal = evaluate(config, state);
    const event = { type: "point", teamIndex: scoringTeam, points: cleanPoints, signal };
    if (signal.gameWinnerIndex === null) {
      state.lastSignal = signal.status;
      return { state, event };
    }

    const completedGame = {
      number: state.currentGame,
      scores: [...state.currentScore],
      winnerIndex: signal.gameWinnerIndex,
      targetScore: signal.targetScore,
      completedAt: createdAt,
    };
    state.completedGames.push(completedGame);
    state.gamesWon[signal.gameWinnerIndex] += 1;
    event.gameWon = true;
    event.completedGame = completedGame;
    if (state.gamesWon[signal.gameWinnerIndex] >= config.gamesToWin) {
      state.status = "finished";
      state.winnerIndex = signal.gameWinnerIndex;
      state.finishedAt = createdAt;
      state.lastSignal = "finished";
      event.matchWon = true;
      return { state, event };
    }

    state.currentGame += 1;
    state.currentScore = [0, 0];
    state.lastSignal = "playing";
    return { state, event };
  }

  function replayPoints(configInput, pointHistory = [], startedAt = null) {
    const config = sanitizeConfig(configInput);
    let state = createGameState(config);
    if (startedAt) state.startedAt = startedAt;
    for (const point of pointHistory) {
      if (state.status === "finished") break;
      state = applyPoint(config, state, point.teamIndex, point.points, point.createdAt || null).state;
    }
    return state;
  }

  function sanitizeGameState(configInput, saved) {
    const config = sanitizeConfig(configInput);
    if (Array.isArray(saved?.pointHistory) && saved.pointHistory.length) {
      return replayPoints(config, saved.pointHistory, saved.startedAt);
    }
    return cloneState(config, saved);
  }

  function resetCurrentGame(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status === "finished") return state;
    const retained = state.pointHistory.filter((point) => point.gameNumber < state.currentGame);
    return replayPoints(config, retained, state.startedAt);
  }

  function resetMatch(configInput) {
    return createGameState(sanitizeConfig(configInput));
  }

  function reopenMatch(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status !== "finished" || !state.pointHistory.length) return state;
    return replayPoints(config, state.pointHistory.slice(0, -1), state.startedAt);
  }

  function matchSummary(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    return {
      sportType: config.sportType,
      preset: config.preset,
      status: state.status,
      winnerIndex: state.winnerIndex,
      gamesWon: [...state.gamesWon],
      completedGames: state.completedGames.map((game) => ({ ...game, scores: [...game.scores] })),
    };
  }

  const api = {
    MATCH_FORMATS,
    volleyballPreset,
    sanitizeConfig,
    targetForGame,
    scoreWinsGame,
    evaluate,
    createGameState,
    sanitizeGameState,
    applyPoint,
    replayPoints,
    resetCurrentGame,
    resetMatch,
    reopenMatch,
    matchSummary,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SportsRuleEngine = api;
})(typeof window === "undefined" ? globalThis : window);
