(function attachSportsRuleEngine(root) {
  const MATCH_FORMATS = {
    single: { numberOfGames: 1, gamesToWin: 1 },
    "best-of-3": { numberOfGames: 3, gamesToWin: 2 },
    "best-of-5": { numberOfGames: 5, gamesToWin: 3 },
    "best-of-7": { numberOfGames: 7, gamesToWin: 4 },
    timed: { numberOfGames: 1, gamesToWin: 1 },
  };
  const SPORT_TYPES = ["volleyball", "basketball", "badminton", "table-tennis"];

  function cleanInteger(value, fallback, min = 0, max = 9999) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function baseConfig(sportType, preset, values) {
    return { version: 2, sportType, preset, matchFormat: "single", numberOfGames: 1, gamesToWin: 1, targetScore: 21, winBy: 1, maxScore: 0, useDifferentDecidingGame: false, decidingGameTargetScore: 21, scoringMode: "rally-point", timedMode: false, periodCount: 0, periodDurationSeconds: 0, ...values };
  }

  function volleyballPreset(preset = "standard") {
    if (preset === "alternate") return baseConfig("volleyball", preset, { matchFormat: "best-of-5", numberOfGames: 5, gamesToWin: 3, targetScore: 25, winBy: 2, useDifferentDecidingGame: true, decidingGameTargetScore: 15 });
    if (preset === "single") return baseConfig("volleyball", preset, { targetScore: 21, decidingGameTargetScore: 21 });
    return baseConfig("volleyball", preset === "custom" ? "custom" : "standard", { matchFormat: "best-of-3", numberOfGames: 3, gamesToWin: 2, targetScore: 25, winBy: 2, useDifferentDecidingGame: true, decidingGameTargetScore: 15 });
  }

  function badmintonPreset(preset = "standard") {
    if (preset === "alternate") return baseConfig("badminton", preset, { targetScore: 21, winBy: 2, maxScore: 30 });
    if (preset === "single") return baseConfig("badminton", preset, { targetScore: 21, winBy: 2, maxScore: 30 });
    return baseConfig("badminton", preset === "custom" ? "custom" : "standard", { matchFormat: "best-of-3", numberOfGames: 3, gamesToWin: 2, targetScore: 21, winBy: 2, maxScore: 30, decidingGameTargetScore: 21 });
  }

  function tableTennisPreset(preset = "standard") {
    if (preset === "alternate") return baseConfig("table-tennis", preset, { matchFormat: "best-of-3", numberOfGames: 3, gamesToWin: 2, targetScore: 11, winBy: 2, decidingGameTargetScore: 11 });
    if (preset === "single") return baseConfig("table-tennis", preset, { targetScore: 11, winBy: 2, decidingGameTargetScore: 11 });
    return baseConfig("table-tennis", preset === "custom" ? "custom" : "standard", { matchFormat: "best-of-5", numberOfGames: 5, gamesToWin: 3, targetScore: 11, winBy: 2, decidingGameTargetScore: 11 });
  }

  function basketballPreset(preset = "standard") {
    if (preset === "alternate") return baseConfig("basketball", preset, { targetScore: 20, scoringMode: "basketball-123" });
    if (preset === "single") return baseConfig("basketball", preset, { matchFormat: "timed", targetScore: 0, scoringMode: "basketball-123", timedMode: true, periodCount: 4, periodDurationSeconds: 600 });
    return baseConfig("basketball", preset === "custom" ? "custom" : "standard", { targetScore: 11, scoringMode: "basketball-123" });
  }

  function presetForSport(sportType, preset) {
    if (sportType === "basketball") return basketballPreset(preset);
    if (sportType === "badminton") return badmintonPreset(preset);
    if (sportType === "table-tennis") return tableTennisPreset(preset);
    return volleyballPreset(preset);
  }

  function sanitizeConfig(input = {}) {
    const sportType = SPORT_TYPES.includes(input.sportType) ? input.sportType : "volleyball";
    const preset = ["standard", "alternate", "single", "custom"].includes(input.preset) ? input.preset : "standard";
    const defaults = presetForSport(sportType, preset);
    const matchFormat = MATCH_FORMATS[input.matchFormat] ? input.matchFormat : defaults.matchFormat;
    const format = MATCH_FORMATS[matchFormat];
    const timedMode = sportType === "basketball" && (input.timedMode === true || matchFormat === "timed");
    const targetScore = timedMode ? 0 : cleanInteger(input.targetScore, defaults.targetScore, 1, 999);
    const rawCap = timedMode ? 0 : cleanInteger(input.maxScore, defaults.maxScore, 0, 999);
    return {
      ...defaults,
      version: 2,
      sportType,
      preset,
      matchFormat: timedMode ? "timed" : matchFormat,
      numberOfGames: timedMode ? 1 : format.numberOfGames,
      gamesToWin: timedMode ? 1 : format.gamesToWin,
      targetScore,
      winBy: timedMode ? 1 : cleanInteger(input.winBy, defaults.winBy, 1, 20),
      maxScore: rawCap > 0 ? Math.max(targetScore, rawCap) : 0,
      useDifferentDecidingGame: !timedMode && format.numberOfGames > 1 && input.useDifferentDecidingGame !== false,
      decidingGameTargetScore: cleanInteger(input.decidingGameTargetScore, defaults.decidingGameTargetScore, 1, 999),
      scoringMode: sportType === "basketball" ? "basketball-123" : "rally-point",
      timedMode,
      periodCount: timedMode ? (Number(input.periodCount) === 2 ? 2 : 4) : 0,
      periodDurationSeconds: timedMode ? cleanInteger(input.periodDurationSeconds, defaults.periodDurationSeconds || 600, 60, 5940) : 0,
    };
  }

  function targetForGame(configInput, gameNumber) {
    const config = sanitizeConfig(configInput);
    return config.useDifferentDecidingGame && Number(gameNumber) === config.numberOfGames ? config.decidingGameTargetScore : config.targetScore;
  }

  function scoreWinsGame(score, opponentScore, targetScore, winBy, maxScore) {
    if (score <= opponentScore) return false;
    if (maxScore > 0 && score >= maxScore) return true;
    return score >= targetScore && score - opponentScore >= winBy;
  }

  function createGameState(configInput) {
    const config = sanitizeConfig(configInput);
    return { version: 2, status: "playing", currentGame: 1, currentScore: [0, 0], completedGames: [], gamesWon: [0, 0], winnerIndex: null, pointHistory: [], currentPeriod: 1, periodScores: [], periodStartScore: [0, 0], overtimeCount: 0, earlyEnded: false, noWinner: false, startedAt: new Date().toISOString(), finishedAt: null, lastSignal: config.timedMode ? "period-1" : "playing" };
  }

  function cloneState(config, stateInput) {
    const fresh = createGameState(config);
    const state = stateInput && typeof stateInput === "object" ? stateInput : {};
    return {
      ...fresh, ...state, version: 2,
      currentGame: cleanInteger(state.currentGame, 1, 1, Math.max(1, config.numberOfGames)),
      currentScore: [0, 1].map((index) => cleanInteger(state.currentScore?.[index], 0, 0, 99999)),
      completedGames: Array.isArray(state.completedGames) ? state.completedGames.map((game, index) => ({ number: cleanInteger(game.number, index + 1, 1, 99), scores: [0, 1].map((team) => cleanInteger(game.scores?.[team], 0, 0, 99999)), winnerIndex: game.winnerIndex === 1 ? 1 : 0, targetScore: cleanInteger(game.targetScore, Math.max(1, config.targetScore), 1, 999), completedAt: game.completedAt || null })).slice(0, 99) : [],
      gamesWon: [0, 1].map((index) => cleanInteger(state.gamesWon?.[index], 0, 0, 99)),
      winnerIndex: state.winnerIndex === 0 || state.winnerIndex === 1 ? state.winnerIndex : null,
      pointHistory: Array.isArray(state.pointHistory) ? state.pointHistory.map((point) => ({ teamIndex: point.teamIndex === 1 ? 1 : 0, points: cleanInteger(point.points, 1, 1, 20), gameNumber: cleanInteger(point.gameNumber, 1, 1, 99), period: cleanInteger(point.period, 1, 1, 99), createdAt: point.createdAt || null })).slice(-20000) : [],
      currentPeriod: cleanInteger(state.currentPeriod, 1, 1, 99),
      periodScores: Array.isArray(state.periodScores) ? state.periodScores.map((period, index) => ({ number: cleanInteger(period.number, index + 1, 1, 99), scores: [0, 1].map((team) => cleanInteger(period.scores?.[team], 0, 0, 99999)), overtime: period.overtime === true, completedAt: period.completedAt || null })) : [],
      periodStartScore: [0, 1].map((index) => cleanInteger(state.periodStartScore?.[index], 0, 0, 99999)),
      overtimeCount: cleanInteger(state.overtimeCount, 0, 0, 99),
      status: ["playing", "game-complete", "regulation-complete", "finished"].includes(state.status) ? state.status : "playing",
      earlyEnded: state.earlyEnded === true,
      noWinner: state.noWinner === true,
    };
  }

  function evaluate(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (config.timedMode) return { status: state.status, score: state.currentScore, gamesWon: state.gamesWon, currentGame: 1, targetScore: 0, gameWinnerIndex: null, gamePointFor: [], matchPointFor: [], deuce: false, finalGame: true };
    const score = state.currentScore;
    const targetScore = targetForGame(config, state.currentGame);
    const gameWinnerIndex = [0, 1].find((index) => scoreWinsGame(score[index], score[1 - index], targetScore, config.winBy, config.maxScore));
    const gamePointFor = [0, 1].filter((index) => scoreWinsGame(score[index] + 1, score[1 - index], targetScore, config.winBy, config.maxScore));
    const matchPointFor = gamePointFor.filter((index) => state.gamesWon[index] + 1 >= config.gamesToWin);
    const deuce = config.winBy > 1 && score[0] === score[1] && score[0] >= targetScore - 1;
    let status = state.status;
    if (status === "playing") {
      if (matchPointFor.length) status = "match-point";
      else if (gamePointFor.length) status = "game-point";
      else if (deuce) status = "deuce";
    }
    return { status, score, gamesWon: state.gamesWon, currentGame: state.currentGame, targetScore, gameWinnerIndex: Number.isInteger(gameWinnerIndex) ? gameWinnerIndex : null, gamePointFor, matchPointFor, deuce, finalGame: state.currentGame === config.numberOfGames };
  }

  function applyPoint(configInput, gameStateInput, teamIndex, points = 1, createdAt = new Date().toISOString()) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status !== "playing" || ![0, 1].includes(Number(teamIndex))) return { state, event: { type: "blocked", reason: state.status === "finished" ? "match-finished" : "action-required" } };
    const cleanPoints = config.sportType === "basketball" ? cleanInteger(points, 1, 1, 3) : 1;
    const scoringTeam = Number(teamIndex);
    state.currentScore[scoringTeam] += cleanPoints;
    state.pointHistory.push({ teamIndex: scoringTeam, points: cleanPoints, gameNumber: state.currentGame, period: state.currentPeriod, createdAt });
    if (config.timedMode) return { state, event: { type: "point", teamIndex: scoringTeam, points: cleanPoints } };
    const signal = evaluate(config, state);
    const event = { type: "point", teamIndex: scoringTeam, points: cleanPoints, signal };
    if (signal.gameWinnerIndex === null) { state.lastSignal = signal.status; return { state, event }; }
    const completedGame = { number: state.currentGame, scores: [...state.currentScore], winnerIndex: signal.gameWinnerIndex, targetScore: signal.targetScore, completedAt: createdAt };
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
    } else {
      state.status = "game-complete";
      state.lastSignal = "game-complete";
    }
    return { state, event };
  }

  function advanceGame(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status !== "game-complete") return state;
    state.currentGame += 1;
    state.currentScore = [0, 0];
    state.status = "playing";
    state.lastSignal = "playing";
    return state;
  }

  function replayPoints(configInput, pointHistory = [], startedAt = null) {
    const config = sanitizeConfig(configInput);
    let state = createGameState(config);
    if (startedAt) state.startedAt = startedAt;
    for (const point of pointHistory) {
      if (state.status === "finished") break;
      if (state.status === "game-complete" && Number(point.gameNumber) > state.currentGame) state = advanceGame(config, state);
      if (config.timedMode) state.currentPeriod = cleanInteger(point.period, state.currentPeriod, 1, 99);
      state = applyPoint(config, state, point.teamIndex, point.points, point.createdAt || null).state;
    }
    return state;
  }

  function sanitizeGameState(configInput, saved) {
    const config = sanitizeConfig(configInput);
    if (saved?.version >= 2) return cloneState(config, saved);
    if (Array.isArray(saved?.pointHistory) && saved.pointHistory.length) return replayPoints(config, saved.pointHistory, saved.startedAt);
    return cloneState(config, saved);
  }

  function resetCurrentGame(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    const retained = config.timedMode ? state.pointHistory.filter((point) => point.period < state.currentPeriod) : state.pointHistory.filter((point) => point.gameNumber < state.currentGame);
    let replayed = replayPoints(config, retained, state.startedAt);
    if (!config.timedMode && replayed.status === "game-complete") replayed = advanceGame(config, replayed);
    if (config.timedMode) {
      replayed.currentPeriod = state.currentPeriod;
      replayed.periodScores = state.periodScores.filter((period) => period.number < state.currentPeriod);
      replayed.periodStartScore = [...replayed.currentScore];
    }
    return replayed;
  }

  function resetMatch(configInput) { return createGameState(configInput); }

  function reopenMatch(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status !== "finished") return state;
    if (state.earlyEnded) { state.status = "playing"; state.winnerIndex = null; state.finishedAt = null; state.earlyEnded = false; state.noWinner = false; return state; }
    if (!state.pointHistory.length) return state;
    return replayPoints(config, state.pointHistory.slice(0, -1), state.startedAt);
  }

  function endPeriod(configInput, gameStateInput, createdAt = new Date().toISOString()) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (!config.timedMode || state.status !== "playing") return state;
    state.periodScores.push({ number: state.currentPeriod, scores: [state.currentScore[0] - state.periodStartScore[0], state.currentScore[1] - state.periodStartScore[1]], overtime: state.currentPeriod > config.periodCount, completedAt: createdAt });
    state.periodStartScore = [...state.currentScore];
    if (state.currentPeriod >= config.periodCount && state.currentScore[0] !== state.currentScore[1]) state.status = "regulation-complete";
    else state.currentPeriod += 1;
    return state;
  }

  function addOvertime(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (!config.timedMode || state.currentScore[0] !== state.currentScore[1]) return state;
    state.overtimeCount += 1;
    state.currentPeriod = config.periodCount + state.overtimeCount;
    state.status = "playing";
    state.periodStartScore = [...state.currentScore];
    return state;
  }

  function finishMatch(configInput, gameStateInput, winnerMode = "score", createdAt = new Date().toISOString()) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (state.status === "finished") return state;
    state.status = "finished";
    state.earlyEnded = true;
    state.noWinner = winnerMode === "none";
    if (!state.noWinner) {
      const first = config.timedMode ? state.currentScore[0] : state.gamesWon[0];
      const second = config.timedMode ? state.currentScore[1] : state.gamesWon[1];
      state.winnerIndex = first === second ? (state.currentScore[0] === state.currentScore[1] ? null : state.currentScore[0] > state.currentScore[1] ? 0 : 1) : first > second ? 0 : 1;
      if (state.winnerIndex === null) state.noWinner = true;
    } else state.winnerIndex = null;
    state.finishedAt = createdAt;
    return state;
  }

  function pointsForCompletedGame(game) {
    const result = [];
    const loser = game.winnerIndex === 0 ? 1 : 0;
    const winner = game.winnerIndex;
    for (let count = 0; count < game.scores[loser]; count += 1) {
      result.push({ teamIndex: loser, points: 1, gameNumber: game.number });
      if (count < game.scores[winner]) result.push({ teamIndex: winner, points: 1, gameNumber: game.number });
    }
    for (let count = game.scores[loser]; count < game.scores[winner]; count += 1) result.push({ teamIndex: winner, points: 1, gameNumber: game.number });
    return result;
  }

  function editCompletedGame(configInput, gameStateInput, gameIndex, scoresInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    if (config.timedMode) return state;
    const index = cleanInteger(gameIndex, -1, -1, state.completedGames.length - 1);
    if (index < 0 || !state.completedGames[index]) return state;
    const scores = [0, 1].map((team) => cleanInteger(scoresInput?.[team], 0, 0, 9999));
    const winnerIndex = scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1;
    const target = targetForGame(config, index + 1);
    if (winnerIndex < 0 || !scoreWinsGame(scores[winnerIndex], scores[1 - winnerIndex], target, config.winBy, config.maxScore)) return state;
    const games = state.completedGames.map((game, position) => position === index ? { ...game, scores, winnerIndex, targetScore: target } : game);
    const currentPoints = state.status === "playing" ? state.pointHistory.filter((point) => point.gameNumber > state.completedGames.length) : [];
    return replayPoints(config, [...games.flatMap(pointsForCompletedGame), ...currentPoints], state.startedAt);
  }

  function matchSummary(configInput, gameStateInput) {
    const config = sanitizeConfig(configInput);
    const state = cloneState(config, gameStateInput);
    return { sportType: config.sportType, preset: config.preset, timedMode: config.timedMode, status: state.status, earlyEnded: state.earlyEnded, noWinner: state.noWinner, winnerIndex: state.winnerIndex, gamesWon: [...state.gamesWon], currentScore: [...state.currentScore], completedGames: state.completedGames.map((game) => ({ ...game, scores: [...game.scores] })), periodScores: state.periodScores.map((period) => ({ ...period, scores: [...period.scores] })) };
  }

  const api = { MATCH_FORMATS, SPORT_TYPES, volleyballPreset, badmintonPreset, tableTennisPreset, basketballPreset, presetForSport, sanitizeConfig, targetForGame, scoreWinsGame, evaluate, createGameState, sanitizeGameState, applyPoint, advanceGame, replayPoints, resetCurrentGame, resetMatch, reopenMatch, endPeriod, addOvertime, finishMatch, editCompletedGame, matchSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SportsRuleEngine = api;
})(typeof window === "undefined" ? globalThis : window);
