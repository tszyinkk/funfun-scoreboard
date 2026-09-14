const STORAGE_KEY = "funfun-scoreboard-v1";
const MAHJONG_ARCHIVE_KEY = "funfun-scoreboard-mahjong-archive-v1";
const GAME_LIBRARY_KEY = "funfun-scoreboard-games-v1";
const LANGUAGE_KEY = "funfun-scoreboard-language-v1";
const COLORS = ["#ff6a3d", "#c9f558", "#67c8ff", "#c99bff", "#ffcf4a", "#57d6a3", "#ff8fbd", "#8ea0ff"];
const HK_SCORING_MODES = ["hk-table", "hk-half-spicy", "hk-full-spicy"];
const MAHJONG_SCORING_LABELS = {
  "hk-table": "簡易級別（預設）",
  "hk-half-spicy": "半辣上（香港朋友枱常見）",
  "hk-full-spicy": "辣辣上（每番跳一倍）",
  doubling: "舊式逐番倍增",
  linear: "自訂線性計分",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let state = null;
let undoStack = [];
let customCount = 3;
let pendingConfirmAction = null;
let pendingCancelAction = null;
let toastTimer = null;
let settingsParticipantsDraft = [];
let timerTicker = null;
let lockedScrollPosition = 0;
let activeScoreGesture = null;
let suppressScoreClick = false;
let isHomeVisible = false;
let waitingForServiceWorkerUpdate = false;
let chooserTouches = new Map();
let chooserCountdownTimer = null;
let chooserCountdown = 0;
let nextFingerNumber = 1;
let mahjongAnalyzerDraft = { concealed: [], melds: [], result: null };
let gameLibrary = [];
let activeLibraryCategory = "mahjong";
let uiLanguage = "zh";
try {
  uiLanguage = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
} catch {
  // Some private browsing modes can block local storage; Chinese remains the fallback.
}

const elements = {
  scoreGrid: $("#scoreGrid"),
  appMain: $("#appMain"),
  topbar: $(".topbar"),
  topActions: $(".top-actions"),
  languageToggle: $("#languageToggle"),
  matchHeading: $(".match-heading"),
  matchControls: $("#matchControls"),
  roundHistory: $("#roundHistory"),
  sportsLandscapeBoard: $("#sportsLandscapeBoard"),
  sportsLandscapeLeft: $("#sportsLandscapeLeft"),
  sportsLandscapeRight: $("#sportsLandscapeRight"),
  sportsLandscapeActions: $("#sportsLandscapeActions"),
  sportsLandscapeHeading: $("#sportsLandscapeHeading"),
  sportsLandscapeTimer: $("#sportsLandscapeTimer"),
  sportsLandscapeControls: $("#sportsLandscapeControls"),
  rotatePrompt: $("#rotatePrompt"),
  homeView: $("#homeView"),
  homeCurrent: $("#homeCurrent"),
  homeCurrentTitle: $("#homeCurrentTitle"),
  homeCurrentMeta: $("#homeCurrentMeta"),
  homeButton: $("#homeButton"),
  homeNewButton: $("#homeNewButton"),
  homeContinueButton: $("#homeContinueButton"),
  gameLibraryModal: $("#gameLibraryModal"),
  gameLibraryTitle: $("#gameLibraryTitle"),
  gameLibraryDescription: $("#gameLibraryDescription"),
  gameLibraryNewButton: $("#gameLibraryNewButton"),
  gameLibraryList: $("#gameLibraryList"),
  mahjongArchive: $("#mahjongArchive"),
  mahjongArchiveList: $("#mahjongArchiveList"),
  mahjongRecordModal: $("#mahjongRecordModal"),
  mahjongRecordContent: $("#mahjongRecordContent"),
  mahjongScoringModal: $("#mahjongScoringModal"),
  mahjongOpenScoringButton: $("#mahjongOpenScoringButton"),
  mahjongDrawButton: $("#mahjongDrawButton"),
  matchTitle: $("#matchTitle"),
  roundLabel: $("#roundLabel"),
  playerCountLabel: $("#playerCountLabel"),
  modeLabel: $("#modeLabel"),
  sportsMatchStatus: $("#sportsMatchStatus"),
  timerDisplay: $("#timerDisplay"),
  timerBar: $("#timerBar"),
  timerToggleButton: $("#timerToggleButton"),
  timerToggleLabel: $("#timerToggleLabel"),
  connectionBadge: $("#connectionBadge"),
  connectionLabel: $("#connectionLabel"),
  historyContent: $("#historyContent"),
  undoButton: $("#undoButton"),
  setupModal: $("#setupModal"),
  setupCloseButton: $("#setupCloseButton"),
  settingsModal: $("#settingsModal"),
  confirmModal: $("#confirmModal"),
  toast: $("#toast"),
  chooserPanel: $("#chooserPanel"),
  chooserStatus: $("#chooserStatus"),
  chooserResult: $("#chooserResult"),
  chooserHomeButton: $("#chooserHomeButton"),
  touchArena: $("#touchArena"),
  touchPoints: $("#touchPoints"),
  mahjongPanel: $("#mahjongPanel"),
  mahjongEntryForm: $("#mahjongEntryForm"),
  mahjongWinner: $("#mahjongWinner"),
  mahjongDiscarder: $("#mahjongDiscarder"),
  mahjongDealer: $("#mahjongDealer"),
  mahjongWinType: $("#mahjongWinType"),
  mahjongDiscarderField: $("#mahjongDiscarderField"),
  mahjongPatternChoices: $("#mahjongPatternChoices"),
  mahjongPatternEditor: $("#mahjongPatternEditor"),
  setupMahjongPatternEditor: $("#setupMahjongPatternEditor"),
  mahjongPreview: $("#mahjongPreview"),
  mahjongProgress: $("#mahjongProgress"),
  mahjongSessionBar: $("#mahjongSessionBar"),
  mahjongSettlement: $("#mahjongSettlement"),
  mahjongAnalyzerModal: $("#mahjongAnalyzerModal"),
  mahjongAnalyzerMeldType: $("#mahjongAnalyzerMeldType"),
  mahjongAnalyzerMeldTile: $("#mahjongAnalyzerMeldTile"),
  mahjongAnalyzerMelds: $("#mahjongAnalyzerMelds"),
  mahjongAnalyzerSelected: $("#mahjongAnalyzerSelected"),
  mahjongAnalyzerPalette: $("#mahjongAnalyzerPalette"),
  mahjongAnalyzerCount: $("#mahjongAnalyzerCount"),
  mahjongAnalyzerResult: $("#mahjongAnalyzerResult"),
  mahjongAnalyzerApply: $("#mahjongAnalyzerApply"),
  bigTwoPanel: $("#bigTwoPanel"),
  bigTwoProgress: $("#bigTwoProgress"),
  bigTwoOpenRoundButton: $("#bigTwoOpenRoundButton"),
  bigTwoRoundModal: $("#bigTwoRoundModal"),
  bigTwoRoundForm: $("#bigTwoRoundForm"),
  bigTwoWinner: $("#bigTwoWinner"),
  bigTwoRemainingList: $("#bigTwoRemainingList"),
  bigTwoPreview: $("#bigTwoPreview"),
  sportsResetGameButton: $("#sportsResetGameButton"),
  sportsResetMatchButton: $("#sportsResetMatchButton"),
  sportsSummaryButton: $("#sportsSummaryButton"),
  sportsSummaryModal: $("#sportsSummaryModal"),
  sportsSummaryContent: $("#sportsSummaryContent"),
  sportsReopenButton: $("#sportsReopenButton"),
  setupSportsRules: $("#setupSportsRules"),
  sportsSetupPreview: $("#sportsSetupPreview"),
};

function t(zh, en) {
  return uiLanguage === "en" ? en : zh;
}

const STATIC_TRANSLATIONS = {
  "主頁": "Home",
  "今晚玩咩？": "What are we playing?",
  "揀一個玩法，開枱即用。唔使註冊，無網絡都照計。": "Choose a mode and start right away. No sign-up, and it works offline.",
  "選擇玩法": "Choose a mode",
  "所有資料只留喺本機": "All data stays on this device",
  "普通計分": "Two-Team Score",
  "球類、桌遊、任何要加減分嘅活動": "Sports matches with two teams",
  "兩隊比賽計分": "Two-Team Match",
  "排球、籃球、羽毛球等對賽": "Volleyball, basketball, badminton and more",
  "香港麻雀": "Hong Kong Mahjong",
  "揀牌型，自動計番同分配分數": "Pick patterns and calculate scores automatically",
  "首家抽籤": "First Player Chooser",
  "任何位置一齊按住，隨機閃出首家": "Everyone touches the screen to pick one player",
  "鋤大D 四人計分": "Big Two Scoring",
  "自動計起炒、雙炒、三炒": "Automatic penalty multipliers",
  "每個玩法都會分開儲存多個紀錄；按入分類就可以繼續或刪除。安裝到主畫面後，離線都可以用。": "Each mode keeps its own saved games. Open a category to continue or delete one. The installed app also works offline.",
  "請將手機橫放": "Rotate your phone",
  "球類計分板會以全螢幕左右比分顯示。": "The two-team scoreboard uses a full-screen landscape layout.",
  "開始計時": "Start timer",
  "比賽時間": "Match time",
  "一齊放手指，抽出首家": "Touch together to pick the first player",
  "大家喺螢幕任何位置同時按住，倒數後會隨機閃出其中一隻手指做首家。": "Everyone touches anywhere on the screen. After the countdown, one finger is selected.",
  "任何位置都可以按住": "Touch anywhere",
  "按住等倒數，閃起嗰隻就係首家": "Hold through the countdown; the highlighted finger goes first",
  "再抽一次": "Pick again",
  "每鋪揀贏家，再填其餘玩家剩牌數；起炒、雙炒、三炒會自動計算。": "Choose the winner and enter cards left. Penalty multipliers are calculated automatically.",
  "完成一鋪／計分": "Score a hand",
  "香港牌計番": "Hong Kong Mahjong Scoring",
  "每局輸入番數及食糊方式，分數會按你設定的規則自動分配。": "Enter the winning pattern and method; scores are distributed automatically.",
  "有人食糊／計番": "Score a win",
  "流局・過莊": "Draw · Pass dealer",
  "今局計番": "Score this hand",
  "揀食糊者、食糊方式同牌型，確認後先會更新四位玩家分數。": "Choose the winner, win type and patterns. Scores update only after confirmation.",
  "食糊者": "Winner",
  "食糊方式": "Win type",
  "自摸": "Self-draw",
  "出銃": "Discard win",
  "流局（冇人食糊）": "Draw (no winner)",
  "出銃者": "Discarder",
  "額外番數（如牌型未列出）": "Extra fan (unlisted patterns)",
  "只係補充未列出嘅牌型番數，唔會直接加減玩家分數。": "Only for an unlisted pattern; it does not directly change a player's score.",
  "今局莊家": "Dealer",
  "花牌數（如有花牌玩法）": "Flower tiles (if used)",
  "備註（可留空）": "Note (optional)",
  "食咩牌型？（可多選）": "Winning patterns (select all that apply)",
  "唔知幾多番？": "Not sure how many fan?",
  "輸入整副牌，自動檢查牌型同建議番數": "Enter the full hand to validate it and suggest patterns",
  "記錄呢局麻雀": "Save Mahjong hand",
  "輸入番數後會顯示今局計算結果。": "The score preview will appear here.",
  "自摸＝自己摸到；出銃＝食其他玩家打出的牌。": "Self-draw means drawing the winning tile yourself; discard win means winning on another player's discard.",
  "只在有花牌的玩法先填；每隻加幾多番可在進階設定調整。": "Only enter this when playing with flower tiles.",
  "完成本局": "Finish round",
  "比分紀錄": "Score history",
  "清除紀錄": "Clear history",
  "今次點樣計？": "What are you scoring?",
  "快速選擇": "Choose a mode",
  "兩隊對賽": "Two-team match",
  "排球・籃球・羽毛球": "Volleyball · Basketball · Badminton",
  "鋤大D": "Big Two",
  "四人・自動計炒牌倍數": "Four players · automatic penalties",
  "香港常用設定，即揀即開局": "Common Hong Kong rules",
  "多人同時按住螢幕": "Multi-touch selection",
  "自訂人數": "Custom players",
  "活動名稱": "Game name",
  "兩隊名稱": "Team names",
  "主隊": "Home team",
  "客隊": "Away team",
  "四位玩家名稱": "Four player names",
  "按開局座位入名；之後主畫面會用東、南、西、北顯示每位玩家。": "Enter names by starting seat; the scoreboard will show each player's E, S, W or N seat.",
  "東位玩家": "East player",
  "南位玩家": "South player",
  "西位玩家": "West player",
  "北位玩家": "North player",
  "入好四位玩家名，每鋪只需要填剩牌數。": "Enter four names. After each hand, only enter the cards left.",
  "炒牌計分": "Penalty scoring",
  "1–7 張 ×1・8–9 張起炒 ×2・10–12 張雙炒 ×3・13 張三炒 ×4": "1–7 cards ×1 · 8–9 cards ×2 · 10–12 cards ×3 · 13 cards ×4",
  "玩家 1": "Player 1",
  "玩家 2": "Player 2",
  "玩家 3": "Player 3",
  "玩家 4": "Player 4",
  "快速設定": "Quick settings",
  "揀好玩法就可以開枱，毋須理解計分公式": "Choose the table rules and start right away—no scoring formula needed",
  "幾多番先可以食糊？": "Minimum fan to win",
  "1 番": "1 fan",
  "3 番": "3 fan",
  "5 番": "5 fan",
  "牌型最少達到所選番數先可以食糊。": "Your hand must reach this fan total before it can win.",
  "最高計到幾多番？": "Maximum fan",
  "最高計8番": "Maximum 8 fan",
  "最高計10番": "Maximum 10 fan",
  "最高計13番": "Maximum 13 fan",
  "打幾多圈？": "Game length",
  "東圈": "East round",
  "半莊": "Half game",
  "自訂局數": "Custom hands",
  "流局時會點？": "After a drawn hand",
  "留莊（同一位繼續做莊）": "Dealer stays",
  "過莊（下一位做莊）": "Dealer passes to the next player",
  "留莊會令一圈多過四鋪；過莊就照常轉下一位。": "Keeping the dealer can make a round longer than four hands; passing moves to the next player.",
  "香港常用計分": "Common Hong Kong scoring",
  "✓ 已自動套用": "✓ Applied automatically",
  "番數會按以下級別自動轉成分數，玩家毋須選公式。": "Fan is converted to points using the tiers below. No formula selection is needed.",
  "想用邊種計分節奏？": "Scoring style",
  "簡易級別（預設）": "Simple tiers (default)",
  "半辣上（香港朋友枱常見）": "Half-spicy progression",
  "辣辣上（每番跳一倍）": "Full-spicy progression",
  "番數計算級別": "Fan tier",
  "倍數": "Multiplier",
  "只建議熟悉計分規則的玩家使用。": "Recommended only for players familiar with the scoring rules.",
  "套用香港常用計分": "Use common Hong Kong scoring",
  "重新套用香港常用計分": "Reset to common Hong Kong scoring",
  "進階設定": "Advanced settings",
  "底數（每1倍值幾多分）": "Base points (value of ×1)",
  "自訂番數計分方式": "Custom fan scoring method",
  "自訂倍增幅度": "Custom multiplier step",
  "封頂分數（0＝不限）": "Maximum points (0 = no limit)",
  "開始圈風": "Starting prevailing wind",
  "自摸額外加幾番": "Extra fan for self-draw",
  "每隻花牌加幾番": "Fan per flower tile",
  "莊家勝出倍數": "Dealer win multiplier",
  "莊家輸款倍數": "Dealer loss multiplier",
  "自摸每家倍數": "Self-draw payment multiplier",
  "出銃者倍數": "Discarder payment multiplier",
  "出銃時其他人付款": "Payments on a discard win",
  "只由出銃者付款": "Discarder pays only",
  "三家都付款": "All three opponents pay",
  "自訂牌型及番數": "Custom patterns and fan",
  "所有分數只儲存在這部裝置": "All scores stay on this device",
  "建立計分板": "Create scoreboard",
  "計分設定": "Score settings",
  "參加者": "Players",
  "＋ 加一位／一隊": "+ Add player/team",
  "儲存設定": "Save settings",
  "開全新計分板": "Start a new scoreboard",
  "確定嗎？": "Are you sure?",
  "取消": "Cancel",
  "確定": "Confirm",
  "返回遊戲": "Back to game",
  "結束並結算": "Finish and settle",
  "立即結算": "Settle now",
  "繼續玩": "Keep playing",
  "返回完成本局": "Complete this hand",
  "放棄本局並結算": "Discard hand and settle",
  "保留紀錄": "Keep game",
  "刪除": "Delete",
  "關閉": "Close",
  "對局紀錄": "Saved games",
  "揀一個舊紀錄繼續，或者開新一局。": "Continue a saved game or start a new one.",
  "＋ 開新一局": "+ New game",
  "今鋪鋤大D計分": "Score this Big Two hand",
  "揀贏家，再填其他玩家仲有幾多張牌。": "Choose the winner, then enter how many cards each other player has left.",
  "今鋪贏家": "Hand winner",
  "自動炒牌倍數": "Automatic penalty multiplier",
  "填寫剩牌數後會顯示今鋪分數。": "Enter cards left to preview this hand's scores.",
  "記錄今鋪": "Save hand",
  "輸入整副牌，自動計番": "Enter the full hand for automatic fan checking",
  "先加入已上、碰或槓嘅組合，再逐隻按手上牌；食糊嗰隻都要輸入。": "Add exposed chows, pungs and kongs first, then tap every concealed tile including the winning tile.",
  "已上／碰／槓": "Exposed chows, pungs and kongs",
  "冇就直接輸入手上牌": "Skip this if there are none",
  "上牌／順子": "Chow / sequence",
  "碰／刻子": "Pung / triplet",
  "槓": "Kong",
  "暗槓": "Concealed kong",
  "加入": "Add",
  "手上牌＋食糊牌": "Concealed tiles + winning tile",
  "請輸入完整牌張。": "Enter the complete hand.",
  "自動分析只會加入牌面可以確定嘅番型；自摸、搶槓、海底、天糊等要按實際情況自行剔選。": "Automatic analysis only adds patterns proven by the tiles. Self-draw, robbing a kong, last-tile wins and similar conditions must be selected manually.",
  "套用建議牌型": "Apply suggested patterns",
  "總分": "Total",
  "本局": "Current",
  "按一下 ＋1": "Tap +1",
  "按錯？減 1 分": "Undo: -1 point",
  "比賽玩法": "Match format",
  "揀一個預設就可以立即開始": "Choose a preset to start right away",
  "選擇運動": "Choose sport",
  "排球 Volleyball": "Volleyball",
  "籃球 Basketball（下一步加入）": "Basketball (coming next)",
  "羽毛球 Badminton（下一步加入）": "Badminton (coming next)",
  "乒乓球 Table Tennis（下一步加入）": "Table Tennis (coming next)",
  "三局兩勝・25／25／15・領先2分": "Best of 3 · 25/25/15 · win by 2",
  "一局定勝負，適合朋友局或練習": "One game for casual play or practice",
  "自訂局數、目標分及決勝局": "Choose games, target and deciding game",
  "一局打幾多分？": "Points in the game",
  "15分": "15 points",
  "21分": "21 points",
  "25分": "25 points",
  "30分": "30 points",
  "自訂": "Custom",
  "勝出條件": "Winning rule",
  "先到指定分數即完": "First to target wins",
  "必須領先2分": "Win by 2",
  "幾局幾勝？": "Match format",
  "普通局目標分數": "Regular game target",
  "最高分上限": "Maximum score cap",
  "填0代表不設上限；到達上限即勝出。": "Enter 0 for no cap. Reaching the cap wins immediately.",
  "決勝局使用不同分數": "Use a different deciding-game target",
  "決勝局目標分數": "Deciding-game target",
  "勝局": "Games won",
  "按錯？撤銷上一分": "Undo last point",
  "重設本局": "Reset game",
  "重設比賽": "Reset match",
  "比賽結果": "Match result",
  "重新開啟／修改賽果": "Reopen / edit match",
  "完成": "Done",
  "關閉比賽結果": "Close match result",
};

const MAHJONG_PATTERN_LABELS_EN = {
  chicken: "Chicken hand",
  pinghu: "All sequences",
  "no-flower": "No flowers",
  "proper-flower": "Own flower",
  concealed: "Concealed hand",
  "dragon-pung": "Dragon pung",
  "seat-wind": "Seat wind",
  "prevailing-wind": "Prevailing wind",
  "rob-kong": "Robbing a kong",
  "one-flower-set": "Complete flower set",
  "kong-draw": "Win after kong",
  "last-tile": "Last tile win",
  "seven-flowers": "Seven flowers",
  "seven-pairs": "Seven pairs",
  "all-pungs": "All pungs",
  "half-flush": "Half flush",
  "human-hand": "Humanly hand",
  "terminals-honors": "Terminals and honours",
  "small-dragons": "Small three dragons",
  "small-winds": "Small four winds",
  "full-flush": "Full flush",
  "big-dragons": "Big three dragons",
  "big-flower": "All eight flowers",
  "concealed-pungs": "Four concealed pungs",
  "kong-on-kong": "Double-kong self-draw",
  "mixed-terminals": "Mixed terminals",
  "all-honors": "All honours",
  "pure-terminals": "All terminals",
  "nine-gates": "Nine gates",
  "big-winds": "Big four winds",
  "thirteen-orphans": "Thirteen orphans",
  "heavenly-hand": "Heavenly hand",
  "earthly-hand": "Earthly hand",
  "four-kongs": "Four kongs",
};

const MAHJONG_PATTERN_HELP_EN = {
  chicken: "A valid hand with no other scoring pattern.",
  pinghu: "All four melds are sequences, plus one pair.",
  "no-flower": "The winning hand has no flower or season tile.",
  "proper-flower": "A flower matching the player's seat.",
  concealed: "No exposed chow, pung or open kong before winning.",
  "dragon-pung": "A pung or kong of Red, Green or White Dragon.",
  "seat-wind": "A pung or kong matching the player's seat wind.",
  "prevailing-wind": "A pung or kong matching the current round wind.",
  "rob-kong": "Win using a tile another player adds to a kong.",
  "one-flower-set": "All four seasons or all four flowers.",
  "kong-draw": "Win on the replacement tile after a kong.",
  "last-tile": "Win on the final draw or final discard.",
  "seven-flowers": "Declare a win after collecting seven flowers.",
  "seven-pairs": "Seven different pairs with no exposed meld.",
  "all-pungs": "Four pungs or kongs, plus one pair.",
  "half-flush": "Only one numbered suit together with honours.",
  "human-hand": "Win on another player's first-round discard.",
  "terminals-honors": "Every group contains a 1, 9 or honour tile.",
  "small-dragons": "Two dragon pungs or kongs and a pair of the third dragon.",
  "small-winds": "Three wind pungs or kongs and a pair of the fourth wind.",
  "full-flush": "Only one numbered suit and no honour tiles.",
  "big-dragons": "Pungs or kongs of all three dragons.",
  "big-flower": "All eight flower and season tiles.",
  "concealed-pungs": "Four concealed pungs or kongs, plus a pair.",
  "kong-on-kong": "Win after drawing consecutive kong replacements.",
  "mixed-terminals": "Only terminals and honours, arranged as pungs and a pair.",
  "all-honors": "Every tile is a wind or dragon.",
  "pure-terminals": "Every tile is a 1 or 9.",
  "nine-gates": "Concealed 1112345678999 in one suit, plus any tile of that suit.",
  "big-winds": "Pungs or kongs of all four winds.",
  "thirteen-orphans": "All 13 terminals and honours, with one duplicate.",
  "heavenly-hand": "Dealer wins with the original dealt hand.",
  "earthly-hand": "A non-dealer wins on the dealer's first discard.",
  "four-kongs": "The winning hand contains four declared kongs.",
};

const MAHJONG_ANALYZER_PATTERN_IDS = new Set([
  "chicken", "pinghu", "no-flower", "concealed", "dragon-pung", "seat-wind", "prevailing-wind",
  "seven-pairs", "all-pungs", "half-flush", "terminals-honors", "small-dragons", "small-winds",
  "full-flush", "big-dragons", "concealed-pungs", "mixed-terminals", "all-honors", "pure-terminals",
  "nine-gates", "big-winds", "thirteen-orphans", "four-kongs",
]);

let staticTranslationNodes = [];

function prepareStaticTranslations() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parentTag = node.parentElement?.tagName;
    const source = node.nodeValue.trim();
    if (!["SCRIPT", "STYLE"].includes(parentTag) && STATIC_TRANSLATIONS[source]) {
      staticTranslationNodes.push({ node, source, prefix: node.nodeValue.match(/^\s*/)?.[0] || "", suffix: node.nodeValue.match(/\s*$/)?.[0] || "" });
    }
    node = walker.nextNode();
  }
}

function translateKnown(value) {
  return uiLanguage === "en" ? STATIC_TRANSLATIONS[value] || value : value;
}

function applyLanguage() {
  document.documentElement.lang = uiLanguage === "en" ? "en" : "zh-Hant";
  document.title = t("分分計｜靈活計分板", "FunFun Scoreboard");
  staticTranslationNodes.forEach(({ node, source, prefix, suffix }) => {
    node.nodeValue = `${prefix}${uiLanguage === "en" ? STATIC_TRANSLATIONS[source] : source}${suffix}`;
  });
  elements.languageToggle.textContent = uiLanguage === "en" ? "中" : "EN";
  elements.languageToggle.setAttribute("aria-label", uiLanguage === "en" ? "切換至中文" : "Switch to English");
  $("#brandHome").setAttribute("aria-label", t("分分計首頁", "FunFun Scoreboard home"));
  elements.homeButton.setAttribute("aria-label", t("返回主頁", "Back to home"));
  elements.homeButton.title = t("返回主頁", "Back to home");
  elements.undoButton.setAttribute("aria-label", t("撤銷上一步", "Undo last action"));
  elements.undoButton.title = t("撤銷上一步", "Undo last action");
  $("#settingsButton").setAttribute("aria-label", t("計分設定", "Score settings"));
  $("#settingsButton").title = t("計分設定", "Score settings");
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function participant(name, index) {
  return { id: uid(), name, color: COLORS[index % COLORS.length], score: 0, total: 0 };
}

function defaultMahjongRules() {
  return {
    gameId: uid(),
    updatedAt: new Date().toISOString(),
    prevailingWind: "east",
    minimumFan: 3,
    basePoints: 1,
    fanStep: 2,
    scoringMode: "hk-table",
    maxFan: 13,
    maxPoints: 0,
    selfDrawFan: 1,
    flowerFan: 1,
    dealerWinMultiplier: 1,
    dealerLoseMultiplier: 1,
    selfDrawMultiplier: 1,
    discardMultiplier: 1,
    drawDealerAction: "stay",
    ronPaymentMode: "discarder",
    patterns: [
      { id: "chicken", label: "雞糊", fan: 0, enabled: true },
      { id: "pinghu", label: "平糊", fan: 1, enabled: true },
      { id: "no-flower", label: "無花", fan: 1, enabled: true },
      { id: "proper-flower", label: "正花", fan: 1, enabled: true },
      { id: "concealed", label: "門前清", fan: 1, enabled: true },
      { id: "dragon-pung", label: "番牌（三元牌）", fan: 1, enabled: true },
      { id: "seat-wind", label: "門風（自己位）", fan: 1, enabled: true },
      { id: "prevailing-wind", label: "圈風（大圈）", fan: 1, enabled: true },
      { id: "rob-kong", label: "搶槓", fan: 1, enabled: true },
      { id: "one-flower-set", label: "一台花", fan: 2, enabled: true },
      { id: "kong-draw", label: "槓上開花", fan: 2, enabled: true, selfDrawIncluded: true },
      { id: "last-tile", label: "海底撈月", fan: 2, enabled: true, selfDrawIncluded: true },
      { id: "seven-flowers", label: "花糊", fan: 3, enabled: true, selfDrawIncluded: true },
      { id: "seven-pairs", label: "七對子", fan: 3, enabled: true },
      { id: "all-pungs", label: "對對糊", fan: 3, enabled: true },
      { id: "half-flush", label: "混一色", fan: 3, enabled: true },
      { id: "human-hand", label: "人糊", fan: 3, enabled: true },
      { id: "terminals-honors", label: "花么九", fan: 4, enabled: true },
      { id: "small-dragons", label: "小三元", fan: 5, enabled: true },
      { id: "small-winds", label: "小四喜", fan: 6, enabled: true },
      { id: "full-flush", label: "清一色", fan: 7, enabled: true },
      { id: "big-dragons", label: "大三元", fan: 8, enabled: true },
      { id: "big-flower", label: "大花糊／八仙過海", fan: 8, enabled: true, selfDrawIncluded: true },
      { id: "concealed-pungs", label: "坎坎糊（四暗刻）", fan: 8, enabled: true, selfDrawIncluded: true },
      { id: "kong-on-kong", label: "槓上槓自摸", fan: 8, enabled: true, selfDrawIncluded: true },
      { id: "mixed-terminals", label: "混么九", fan: 9, enabled: true },
      { id: "all-honors", label: "字一色", fan: 10, enabled: true },
      { id: "pure-terminals", label: "清么九", fan: 10, enabled: true },
      { id: "nine-gates", label: "九子連環／九蓮寶燈", fan: 10, enabled: true },
      { id: "big-winds", label: "大四喜", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "thirteen-orphans", label: "十三么", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "heavenly-hand", label: "天糊", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "earthly-hand", label: "地糊", fan: 13, enabled: true, selfDrawIncluded: true },
      { id: "four-kongs", label: "十八羅漢／四槓子", fan: 13, enabled: true, selfDrawIncluded: true },
    ],
  };
}

function sanitizeMahjongRules(rules = {}) {
  const defaults = defaultMahjongRules();
  const number = (key, min, max) => {
    const value = Number(rules[key]);
    if (!Number.isFinite(value)) return defaults[key];
    return Math.min(max, Math.max(min, value));
  };
  const suppliedPatterns = Array.isArray(rules.patterns) ? rules.patterns : [];
  const patterns = defaults.patterns.map((defaultPattern) => {
    const supplied = suppliedPatterns.find((pattern) => pattern?.id === defaultPattern.id);
    const suppliedFan = Number(supplied?.fan);
    const migratedLegacyNineGates = defaultPattern.id === "nine-gates"
      && supplied?.label === "九子連環"
      && suppliedFan === 13;
    const fan = migratedLegacyNineGates ? defaultPattern.fan : suppliedFan;
    return {
      ...defaultPattern,
      label: String(migratedLegacyNineGates ? defaultPattern.label : supplied?.label || defaultPattern.label).slice(0, 24),
      fan: Number.isFinite(fan) ? Math.min(99, Math.max(0, Math.round(fan))) : defaultPattern.fan,
      enabled: supplied?.enabled !== false,
    };
  });
  return {
    prevailingWind: ["east", "south", "west", "north"].includes(rules.prevailingWind) ? rules.prevailingWind : defaults.prevailingWind,
    minimumFan: Math.round(number("minimumFan", 0, 99)),
    basePoints: number("basePoints", 0, 999999),
    fanStep: number("fanStep", 1, 10),
    scoringMode: [...HK_SCORING_MODES, "doubling", "linear"].includes(rules.scoringMode) ? rules.scoringMode : defaults.scoringMode,
    maxFan: Math.round(number("maxFan", 0, 99)),
    maxPoints: number("maxPoints", 0, 999999),
    selfDrawFan: Math.round(number("selfDrawFan", 0, 99)),
    flowerFan: Math.round(number("flowerFan", 0, 99)),
    dealerWinMultiplier: number("dealerWinMultiplier", 0, 20),
    dealerLoseMultiplier: number("dealerLoseMultiplier", 0, 20),
    selfDrawMultiplier: number("selfDrawMultiplier", 0, 20),
    discardMultiplier: number("discardMultiplier", 0, 20),
    drawDealerAction: rules.drawDealerAction === "pass" ? "pass" : "stay",
    ronPaymentMode: rules.ronPaymentMode === "all" ? "all" : "discarder",
    patterns,
  };
}

function freshState(preset, title, count = 2, teamNames = {}) {
  const isCards = preset === "cards";
  const isMahjong = preset === "mahjong";
  const isChooser = preset === "chooser";
  const isBigTwo = preset === "bigtwo";
  const size = preset === "sports" ? 2 : isCards || isMahjong || isBigTwo ? 4 : isChooser ? 0 : count;
  const names = preset === "sports"
    ? [teamNames.home, teamNames.away].map((name, index) => String(name || "").trim().slice(0, 18) || (index === 0 ? t("主隊", "Home") : t("客隊", "Away")))
    : Array.from({ length: size }, (_, index) => t(`玩家 ${index + 1}`, `Player ${index + 1}`));

  return {
    gameId: uid(),
    updatedAt: new Date().toISOString(),
    title: title.trim() || (isBigTwo ? "今晚鋤大D" : isCards || isMahjong ? "今晚開枱" : isChooser ? "首家抽籤" : "今晚開波"),
    kind: preset,
    totalMode: isCards || isMahjong || isBigTwo ? "cumulative" : "winner",
    winnerRule: "highest",
    round: 1,
    timer: { elapsed: 0, running: false, startedAt: null },
    participants: names.map((name, index) => ({
      ...participant(name, index),
      ...(isMahjong ? { seatWind: MahjongCore.WINDS[index] } : {}),
    })),
    history: [],
    sportConfig: null,
    sportGame: null,
    mahjong: defaultMahjongRules(),
    mahjongSession: null,
    chooser: { resultId: "", resultName: "", resultFingerNumber: 0, resultX: 0, resultY: 0, drawnAt: null },
  };
}

function sanitizeState(candidate) {
  if (!candidate || !Array.isArray(candidate.participants)) return null;
  const kind = ["sports", "cards", "custom", "mahjong", "chooser", "bigtwo"].includes(candidate.kind) ? candidate.kind : "custom";
  if (kind !== "chooser" && candidate.participants.length < 2) return null;
  const elapsed = Math.max(0, Math.floor(Number(candidate.timer?.elapsed) || 0));
  const startedAt = Number(candidate.timer?.startedAt);
  const timerIsRunning = candidate.timer?.running === true && Number.isFinite(startedAt) && startedAt > 0;
  const resultFingerNumber = Math.max(0, Math.floor(Number(candidate.chooser?.resultFingerNumber) || 0));
  const participants = (kind === "chooser" ? [] : candidate.participants.slice(0, 8)).map((item, index) => ({
    id: String(item.id || uid()),
    name: String(item.name || `玩家 ${index + 1}`).slice(0, 18),
    color: COLORS.includes(item.color) ? item.color : COLORS[index % COLORS.length],
    score: ["mahjong", "bigtwo"].includes(kind) ? Number(item.score) || 0 : Math.max(0, Number(item.score) || 0),
    total: ["mahjong", "bigtwo"].includes(kind) ? Number(item.total) || 0 : Math.max(0, Number(item.total) || 0),
    ...(kind === "mahjong" ? { seatWind: MahjongCore.WINDS.includes(item.seatWind) ? item.seatWind : MahjongCore.WINDS[index % 4] } : {}),
  }));
  while (kind === "mahjong" && participants.length < 4) {
    const index = participants.length;
    participants.push({ ...participant(`玩家 ${index + 1}`, index), seatWind: MahjongCore.WINDS[index] });
  }
  const history = Array.isArray(candidate.history) ? candidate.history.slice(-1000) : [];
  const storedMahjong = candidate.mahjong && typeof candidate.mahjong === "object" ? candidate.mahjong : {};
  // Older saved games did not identify the scoring system. Keep their original
  // per-fan doubling behaviour, while every newly created game uses the HK table.
  const mahjongSource = kind === "mahjong" && !Object.prototype.hasOwnProperty.call(storedMahjong, "scoringMode")
    ? { ...storedMahjong, scoringMode: "doubling" }
    : storedMahjong;
  const mahjong = sanitizeMahjongRules(mahjongSource);
  const mahjongSession = kind === "mahjong"
    ? sanitizeMahjongSession(candidate.mahjongSession, history, participants, mahjong.prevailingWind)
    : null;
  const sportConfig = kind === "sports" && candidate.sportConfig
    ? SportsRuleEngine.sanitizeConfig(candidate.sportConfig)
    : null;
  const sportGame = sportConfig
    ? SportsRuleEngine.sanitizeGameState(sportConfig, candidate.sportGame)
    : null;
  if (sportGame) {
    participants.slice(0, 2).forEach((player, index) => {
      player.score = sportGame.currentScore[index];
      player.total = sportGame.gamesWon[index];
    });
  }
  return {
    gameId: String(candidate.gameId || uid()),
    updatedAt: candidate.updatedAt || candidate.mahjongSession?.settledAt || new Date().toISOString(),
    title: String(candidate.title || "我的計分板").slice(0, 30),
    kind,
    totalMode: ["winner", "cumulative", "manual"].includes(candidate.totalMode) ? candidate.totalMode : "manual",
    winnerRule: candidate.winnerRule === "lowest" ? "lowest" : "highest",
    round: Math.max(1, Number(candidate.round) || 1),
    timer: { elapsed, running: timerIsRunning, startedAt: timerIsRunning ? startedAt : null },
    participants,
    history,
    sportConfig,
    sportGame,
    mahjong,
    mahjongSession,
    chooser: {
      resultId: String(candidate.chooser?.resultId || ""),
      resultName: kind === "chooser"
        ? (resultFingerNumber ? `手指 ${resultFingerNumber}` : "")
        : String(candidate.chooser?.resultName || "").slice(0, 18),
      resultFingerNumber,
      resultX: Math.min(100, Math.max(0, Number(candidate.chooser?.resultX) || 0)),
      resultY: Math.min(100, Math.max(0, Number(candidate.chooser?.resultY) || 0)),
      drawnAt: candidate.chooser?.drawnAt || null,
    },
  };
}

function newMahjongSession({ plannedCycles = 1, lengthMode = "east", plannedHands = 0, startingWind = "east", startedAt = new Date().toISOString() } = {}) {
  const cleanLengthMode = ["east", "half", "custom-hands", "legacy-cycles"].includes(lengthMode) ? lengthMode : "east";
  return {
    lengthMode: cleanLengthMode,
    plannedCycles: [0, 1, 2, 4, 8].includes(Number(plannedCycles)) ? Number(plannedCycles) : 1,
    plannedHands: cleanLengthMode === "custom-hands"
      ? Math.min(999, Math.max(1, Math.floor(Number(plannedHands) || 16)))
      : 0,
    startingWind: MahjongCore.WINDS.includes(startingWind) ? startingWind : "east",
    completedCycles: 0,
    handsInCycle: 0,
    dealerIdsInCycle: [],
    completedHands: 0,
    lastPromptedCycles: 0,
    lastPromptedHands: 0,
    nextDealerId: "",
    startedAt,
    settledAt: null,
    durationMs: 0,
    status: "active",
    earlyEnded: false,
    draft: { touched: false, values: {} },
    archiveRecordId: "",
  };
}

function sanitizeMahjongSession(saved, history, participants, startingWind = "east") {
  const ids = participants.map((player) => player.id);
  const derived = newMahjongSession({ startingWind, startedAt: history[0]?.createdAt || new Date().toISOString() });
  let progress = derived;
  history.forEach((hand) => {
    if (!hand?.mahjong) return;
    progress = MahjongCore.advanceProgress(progress, hand.mahjong.dealerId || hand.dealerId, ids);
  });
  const lastHand = [...history].reverse().find((hand) => hand?.mahjong?.dealerId);
  if (lastHand) {
    const dealerId = lastHand.mahjong.dealerId;
    if (lastHand.mahjong.winType === "draw" || lastHand.mahjong.winnerId === dealerId) progress.nextDealerId = dealerId;
    else {
      const dealerIndex = ids.indexOf(dealerId);
      progress.nextDealerId = dealerIndex >= 0 ? ids[(dealerIndex + 1) % ids.length] : "";
    }
  }
  const session = saved && typeof saved === "object" ? saved : {};
  const draft = session.draft && typeof session.draft === "object" ? session.draft : {};
  const knownHandCount = history.filter((hand) => hand?.mahjong).length;
  const hasSavedProgress = Number.isFinite(Number(session.completedHands))
    || Number.isFinite(Number(session.completedCycles))
    || Array.isArray(session.dealerIdsInCycle);
  const base = hasSavedProgress
    ? session
    : { ...progress, lengthMode: "legacy-cycles", plannedCycles: 4, lastPromptedCycles: progress.completedCycles };
  const lengthMode = ["east", "half", "custom-hands", "legacy-cycles"].includes(base.lengthMode) ? base.lengthMode : "legacy-cycles";
  const savedPlannedCycles = Number(base.plannedCycles);
  return {
    ...derived,
    ...base,
    lengthMode,
    plannedCycles: [0, 1, 2, 4, 8].includes(savedPlannedCycles) ? savedPlannedCycles : 4,
    plannedHands: lengthMode === "custom-hands"
      ? Math.min(999, Math.max(1, Math.floor(Number(base.plannedHands) || 16)))
      : 0,
    startingWind: MahjongCore.WINDS.includes(base.startingWind) ? base.startingWind : startingWind,
    completedCycles: Math.max(0, Math.floor(Number(base.completedCycles) || 0)),
    handsInCycle: Math.max(0, Math.floor(Number(base.handsInCycle) || 0)),
    dealerIdsInCycle: Array.isArray(base.dealerIdsInCycle) ? base.dealerIdsInCycle.filter((id) => ids.includes(id)) : [],
    completedHands: Math.max(knownHandCount, Math.floor(Number(base.completedHands) || 0)),
    lastPromptedCycles: Math.max(0, Math.floor(Number(base.lastPromptedCycles) || 0)),
    lastPromptedHands: Math.max(0, Math.floor(Number(base.lastPromptedHands) || 0)),
    nextDealerId: ids.includes(base.nextDealerId) ? base.nextDealerId : "",
    startedAt: base.startedAt || derived.startedAt,
    settledAt: base.settledAt || null,
    durationMs: Math.max(0, Number(base.durationMs) || 0),
    status: base.status === "settled" ? "settled" : "active",
    earlyEnded: base.earlyEnded === true,
    draft: { touched: draft.touched === true, values: draft.values && typeof draft.values === "object" ? draft.values : {} },
    archiveRecordId: String(base.archiveRecordId || ""),
  };
}

function loadState() {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
}

function loadGameLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_LIBRARY_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.map(sanitizeState).filter(Boolean).slice(0, 100);
  } catch {
    return [];
  }
}

function persistGameLibrary() {
  try {
    localStorage.setItem(GAME_LIBRARY_KEY, JSON.stringify(gameLibrary.slice(0, 100)));
  } catch {
    // The current game still works if private browsing blocks local storage.
  }
}

function upsertCurrentGame() {
  if (!state) return;
  const index = gameLibrary.findIndex((game) => game.gameId === state.gameId);
  const copy = JSON.parse(JSON.stringify(state));
  if (index >= 0) gameLibrary.splice(index, 1);
  gameLibrary.unshift(copy);
  gameLibrary = gameLibrary.slice(0, 100);
  persistGameLibrary();
}

function saveState() {
  if (!state) return;
  state.gameId ||= uid();
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The scoreboard still works if storage is unavailable (for example in private browsing).
  }
  upsertCurrentGame();
}

function clearStoredState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage restrictions; the in-memory scoreboard can still be replaced.
  }
}

function loadMahjongArchive() {
  try {
    const saved = JSON.parse(localStorage.getItem(MAHJONG_ARCHIVE_KEY));
    return Array.isArray(saved) ? saved.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveMahjongArchive(archive = loadMahjongArchive()) {
  try { localStorage.setItem(MAHJONG_ARCHIVE_KEY, JSON.stringify(archive.slice(0, 50))); } catch { /* Records stay available in this session if storage is full. */ }
}

let mahjongArchive = loadMahjongArchive();

function migrateLegacyRecords() {
  gameLibrary = loadGameLibrary();
  if (state && !gameLibrary.some((game) => game.gameId === state.gameId)) {
    gameLibrary.unshift(JSON.parse(JSON.stringify(state)));
  }
  const currentArchiveId = state?.mahjongSession?.archiveRecordId;
  loadMahjongArchive().forEach((record) => {
    if (!record?.id || record.id === currentArchiveId) return;
    const gameId = `legacy-mahjong-${record.id}`;
    if (gameLibrary.some((game) => game.gameId === gameId)) return;
    const participants = (record.participants || []).slice(0, 4).map((player, index) => ({
      id: String(player.id || uid()),
      name: String(player.name || `玩家 ${index + 1}`).slice(0, 18),
      color: COLORS[index % COLORS.length],
      seatWind: MahjongCore.WINDS[index],
      score: 0,
      total: Number(player.total) || 0,
    }));
    while (participants.length < 4) participants.push({ ...participant(`玩家 ${participants.length + 1}`, participants.length), seatWind: MahjongCore.WINDS[participants.length] });
    const migrated = sanitizeState({
      gameId,
      updatedAt: record.settledAt || record.startedAt,
      title: record.title,
      kind: "mahjong",
      totalMode: "cumulative",
      winnerRule: "highest",
      round: (record.completedHands || record.history?.length || 0) + 1,
      timer: { elapsed: 0, running: false, startedAt: null },
      participants,
      history: record.history || [],
      mahjong: record.rules || defaultMahjongRules(),
      mahjongSession: {
        lengthMode: record.lengthMode,
        plannedCycles: record.plannedCycles,
        plannedHands: record.plannedHands,
        completedCycles: record.completedCycles,
        completedHands: record.completedHands,
        startingWind: record.rules?.prevailingWind || "east",
        startedAt: record.startedAt,
        settledAt: record.settledAt,
        durationMs: record.durationMs,
        status: "settled",
        earlyEnded: record.earlyEnded,
        archiveRecordId: record.id,
      },
    });
    if (migrated) gameLibrary.push(migrated);
  });
  gameLibrary.sort((left, right) => Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0));
  gameLibrary = gameLibrary.slice(0, 100);
  persistGameLibrary();
}

function gameCategory(kind) {
  if (kind === "mahjong") return "mahjong";
  if (kind === "chooser") return "chooser";
  if (kind === "bigtwo" || kind === "cards") return "bigtwo";
  return "sports";
}

function libraryCategoryCopy(category) {
  if (category === "mahjong") return { title: t("香港麻雀對局", "Hong Kong Mahjong Games"), description: t("繼續未完嘅牌局、查看已結算成績，或者開一個新牌局。", "Continue a game, view final scores, or start a new table."), newLabel: t("＋ 開新麻雀牌局", "+ New Mahjong Game") };
  if (category === "chooser") return { title: t("首家抽籤紀錄", "First Player Chooser"), description: t("可以重開之前嘅抽籤，或者開始新一次。", "Reopen a previous draw or start a new one."), newLabel: t("＋ 開新抽籤", "+ New Draw") };
  if (category === "bigtwo") return { title: t("鋤大D 四人計分", "Big Two Scoreboards"), description: t("繼續之前嘅鋤大D計分，或者開一張新分紙。", "Continue a Big Two scoreboard or start a new one."), newLabel: t("＋ 開新鋤大D計分", "+ New Big Two Game") };
  return { title: t("兩隊比賽紀錄", "Two-Team Games"), description: t("繼續之前嘅球賽，或者建立新計分板。", "Continue a match or create a new scoreboard."), newLabel: t("＋ 開新比賽", "+ New Match") };
}

function gameRecordMeta(game) {
  const updated = game.updatedAt ? new Date(game.updatedAt).toLocaleString(uiLanguage === "en" ? "en-CA" : "zh-HK", { dateStyle: "short", timeStyle: "short" }) : "";
  if (game.kind === "mahjong") {
    const settled = game.mahjongSession?.status === "settled";
    return `${settled ? t("已結算", "Finished") : t("進行中", "In progress")}・${MahjongCore.progressLabel(game.mahjongSession, game.participants.map((player) => player.id), uiLanguage)}${updated ? `・${updated}` : ""}`;
  }
  if (game.kind === "chooser") return `${t("首家抽籤", "First player draw")}${updated ? `・${updated}` : ""}`;
  if (game.kind === "bigtwo" || game.kind === "cards") return `${t("完成", "Completed")} ${game.history.length} ${t("鋪", "hands")}${updated ? `・${updated}` : ""}`;
  if (game.kind === "sports" && game.sportConfig && game.sportGame) {
    const status = game.sportGame.status === "finished" ? t("已完成", "Finished") : t("進行中", "In progress");
    const sport = game.sportConfig.sportType === "volleyball" ? t("排球", "Volleyball") : t("運動比賽", "Sports match");
    return `${sport}・${status}・${game.sportGame.gamesWon?.[0] || 0}–${game.sportGame.gamesWon?.[1] || 0}${updated ? `・${updated}` : ""}`;
  }
  return uiLanguage === "en"
    ? `${game.participants.length} teams · ${game.history.length} rounds completed${updated ? ` · ${updated}` : ""}`
    : `${game.participants.length} 人／隊・完成 ${game.history.length} 回合${updated ? `・${updated}` : ""}`;
}

function renderGameLibrary() {
  const copy = libraryCategoryCopy(activeLibraryCategory);
  elements.gameLibraryTitle.textContent = copy.title;
  elements.gameLibraryDescription.textContent = copy.description;
  elements.gameLibraryNewButton.textContent = copy.newLabel;
  const records = gameLibrary.filter((game) => gameCategory(game.kind) === activeLibraryCategory);
  elements.gameLibraryList.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "game-library-empty";
    empty.textContent = t("暫時未有紀錄。開新一局後會自動儲存喺呢度。", "No saved games yet. New games will be saved here automatically.");
    elements.gameLibraryList.appendChild(empty);
    return;
  }
  records.forEach((game) => {
    const item = document.createElement("article");
    item.className = "game-library-item";
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "game-library-resume";
    resume.dataset.gameId = game.gameId;
    const title = document.createElement("strong");
    title.textContent = game.title || t("未命名對局", "Untitled game");
    const meta = document.createElement("small");
    meta.textContent = gameRecordMeta(game);
    resume.append(title, meta);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "game-library-delete";
    remove.dataset.deleteGameId = game.gameId;
    remove.setAttribute("aria-label", t(`刪除 ${title.textContent}`, `Delete ${title.textContent}`));
    remove.title = t("刪除紀錄", "Delete game");
    remove.textContent = "×";
    item.append(resume, remove);
    elements.gameLibraryList.appendChild(item);
  });
}

function openGameLibrary(category) {
  activeLibraryCategory = category;
  renderGameLibrary();
  openModal("gameLibraryModal");
}

function updateHome() {
  if (!elements.homeCurrent) return;
  elements.homeCurrent.hidden = true;
  elements.mahjongArchive.hidden = true;
}

function renderMahjongArchiveList() {
  if (!elements.mahjongArchiveList) return;
  mahjongArchive = loadMahjongArchive();
  elements.mahjongArchive.hidden = mahjongArchive.length === 0;
  elements.mahjongArchiveList.replaceChildren();
  mahjongArchive.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mahjong-archive-card";
    button.dataset.recordId = record.id;
    const title = document.createElement("strong");
    title.textContent = record.title || "今晚開枱";
    const meta = document.createElement("small");
    const date = record.settledAt ? new Date(record.settledAt).toLocaleString("zh-HK") : "已結算";
    const plan = record.lengthMode === "custom-hands"
      ? `原訂${record.plannedHands || 0}局`
      : record.lengthMode === "half"
        ? "半莊"
        : record.lengthMode === "east"
          ? "東圈"
          : "舊圈數設定";
    meta.textContent = `${record.earlyEnded ? "提早結束・" : "完成結算・"}${record.completedHands || 0} 局・${plan}・${date}`;
    button.append(title, meta);
    elements.mahjongArchiveList.appendChild(button);
  });
}

function sportsLandscapeMatches() {
  return window.matchMedia?.("(orientation: landscape)").matches === true;
}

function sportsPortraitPromptMatches() {
  return window.matchMedia?.("(orientation: portrait) and (max-width: 850px)").matches === true;
}

function syncSportsLayout() {
  const forcedLandscape = Boolean(state && !isHomeVisible && state.kind === "sports" && !sportsLandscapeMatches() && sportsPortraitPromptMatches());
  const landscape = Boolean(state && !isHomeVisible && state.kind === "sports" && (sportsLandscapeMatches() || forcedLandscape));
  const rotatePrompt = false;
  const chooserActive = Boolean(state && !isHomeVisible && state.kind === "chooser");
  document.body.classList.toggle("sports-landscape-active", landscape);
  document.body.classList.toggle("sports-forced-landscape", forcedLandscape);
  document.body.classList.toggle("sports-portrait-active", rotatePrompt);
  document.body.classList.toggle("chooser-active", chooserActive);
  elements.sportsLandscapeBoard.hidden = !landscape;
  elements.rotatePrompt.hidden = !rotatePrompt;

  if (landscape) {
    elements.topbar.hidden = true;
    elements.appMain.hidden = true;
    elements.sportsLandscapeHeading.append(elements.matchHeading);
    elements.sportsLandscapeTimer.append(elements.timerBar);
    elements.sportsLandscapeControls.append(elements.matchControls);
    elements.sportsLandscapeActions.append(elements.topActions);
    elements.sportsLandscapeBoard.append(elements.toast);
  } else {
    elements.topbar.hidden = false;
    elements.appMain.hidden = isHomeVisible || rotatePrompt;
    elements.topbar.append(elements.topActions);
    elements.appMain.append(
      elements.matchHeading,
      elements.timerBar,
      elements.chooserPanel,
      elements.bigTwoPanel,
      elements.mahjongPanel,
      elements.scoreGrid,
      elements.matchControls,
      elements.roundHistory,
    );
    $(".app-shell").append(elements.toast);
    [...elements.sportsLandscapeLeft.children, ...elements.sportsLandscapeRight.children].forEach((card) => elements.scoreGrid.append(card));
  }
}

function setHomeVisible(visible) {
  isHomeVisible = visible;
  document.body.classList.toggle("mahjong-minimal-active", !visible && state?.kind === "mahjong");
  elements.homeView.hidden = !visible;
  $("main").hidden = visible;
  $("footer").hidden = visible;
  elements.homeButton.hidden = visible || !state;
  elements.undoButton.hidden = visible;
  $("#settingsButton").hidden = visible;
  syncSportsLayout();
  updateHome();
  reloadForServiceWorkerUpdateIfSafe();
}

function reloadForServiceWorkerUpdateIfSafe() {
  if (!waitingForServiceWorkerUpdate || !isHomeVisible || $(".modal-backdrop.is-open")) return;
  window.location.reload();
}

function showHome() {
  if (state) saveState();
  if (elements.setupModal.classList.contains("is-open")) closeModal("setupModal");
  if (elements.settingsModal.classList.contains("is-open")) closeModal("settingsModal");
  if (elements.mahjongScoringModal.classList.contains("is-open")) closeModal("mahjongScoringModal");
  if (elements.mahjongAnalyzerModal.classList.contains("is-open")) closeModal("mahjongAnalyzerModal");
  if (elements.bigTwoRoundModal.classList.contains("is-open")) closeModal("bigTwoRoundModal");
  if (elements.sportsSummaryModal.classList.contains("is-open")) closeModal("sportsSummaryModal");
  try { screen.orientation?.unlock?.(); } catch { /* Orientation lock is not supported on every device. */ }
  exitAppFullscreen();
  setHomeVisible(true);
}

function showScoreboard() {
  setHomeVisible(false);
  if (state?.kind === "sports") requestSportsLandscape();
  else {
    screen.orientation?.unlock?.();
    if (state?.kind === "chooser") requestAppFullscreen();
  }
  render();
}

function requestSportsLandscape() {
  const fullscreenRequest = requestAppFullscreen();
  Promise.resolve(fullscreenRequest).then(() => {
    try {
      const lockRequest = screen.orientation?.lock?.("landscape");
      lockRequest?.catch(() => {});
    } catch {
      // CSS shows a rotate prompt on devices that do not support orientation locking.
    }
  });
}

function requestAppFullscreen() {
  try {
    const request = document.documentElement.requestFullscreen?.()
      || document.documentElement.webkitRequestFullscreen?.();
    return request ? request.catch(() => {}) : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

function exitAppFullscreen() {
  try {
    const request = document.exitFullscreen?.();
    request?.catch(() => {});
  } catch {
    // Installed web apps may use display-mode fullscreen without a Fullscreen API element.
  }
}

function resetSetupForm(preset = "sports") {
  $("#setupForm").reset();
  $("#setupPresetFieldset").hidden = true;
  setMahjongScoringControls($("#setupForm"), "hk-table");
  $("#setupMahjongAdvanced").open = false;
  renderMahjongPatternEditor(elements.setupMahjongPatternEditor, defaultMahjongRules().patterns);
  $("#setupName").value = preset === "chooser" ? t("首家抽籤", "First Player Draw") : preset === "bigtwo" ? t("今晚鋤大D", "Big Two Game") : ["mahjong", "cards"].includes(preset) ? t("今晚開枱", "Mahjong Game") : preset === "custom" ? t("自訂比賽", "Custom Game") : t("今晚開波", "Match");
  $("#setupHomeTeamName").value = t("主隊", "Home");
  $("#setupAwayTeamName").value = t("客隊", "Away");
  ["mahjong", "bigTwo"].forEach((group) => {
    for (let index = 1; index <= 4; index += 1) {
      const input = $(`[name="${group}Player${index}"]`);
      if (input) input.value = t(`玩家 ${index}`, `Player ${index}`);
    }
  });
  customCount = 3;
  $("#countOutput").textContent = customCount;
  const presetInput = $(`input[name="preset"][value="${preset}"]`, $("#setupForm"));
  if (presetInput) presetInput.checked = true;
  updateSetupFromPreset();
}

function beginNewActivity(preset = "sports") {
  if (state) saveState();
  clearStoredState();
  undoStack = [];
  state = null;
  resetSetupForm(preset);
  elements.setupCloseButton.hidden = false;
  setHomeVisible(true);
  openModal("setupModal");
}

function snapshot() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 50) undoStack.shift();
  elements.undoButton.disabled = false;
}

function hasSportRuleEngine(game = state) {
  return game?.kind === "sports" && Boolean(game.sportConfig && game.sportGame);
}

function sportName(config = state?.sportConfig) {
  return config?.sportType === "volleyball" ? t("排球", "Volleyball") : t("運動比賽", "Sports Match");
}

function sportFormatLabel(config = state?.sportConfig) {
  if (!config) return "";
  if (config.matchFormat === "single") return t("一局定勝負", "Single Game");
  return t(`${config.numberOfGames}局${config.gamesToWin}勝`, `Best of ${config.numberOfGames}`);
}

function syncSportStateToScoreboard() {
  if (!hasSportRuleEngine()) return;
  state.participants.slice(0, 2).forEach((player, index) => {
    player.score = state.sportGame.currentScore[index];
    player.total = state.sportGame.gamesWon[index];
  });
  state.round = state.sportGame.currentGame;
  state.history = state.sportGame.completedGames.map((game) => ({
    number: game.number,
    scores: state.participants.slice(0, 2).map((player, index) => ({ id: player.id, name: player.name, score: game.scores[index] })),
    winners: [state.participants[game.winnerIndex]?.name || ""].filter(Boolean),
    createdAt: game.completedAt,
  }));
}

function sportStatusCopy() {
  if (!hasSportRuleEngine()) return "";
  const signal = SportsRuleEngine.evaluate(state.sportConfig, state.sportGame);
  const names = state.participants.map((player) => player.name);
  const sets = state.sportGame.gamesWon;
  if (state.sportGame.status === "finished") {
    return t(`${names[state.sportGame.winnerIndex]} 勝出・${sets[0]}–${sets[1]}`, `${names[state.sportGame.winnerIndex]} wins · ${sets[0]}–${sets[1]}`);
  }
  if (signal.status === "match-point") return t(`${names[signal.matchPointFor[0]]} 賽點`, `Match point · ${names[signal.matchPointFor[0]]}`);
  if (signal.status === "game-point") return t(`${names[signal.gamePointFor[0]]} 局點`, `Game point · ${names[signal.gamePointFor[0]]}`);
  if (signal.status === "deuce") return t("平分 Deuce・要領先2分", "Deuce · win by 2");
  const target = signal.targetScore;
  const final = signal.finalGame && state.sportConfig.numberOfGames > 1 ? t("・決勝局", " · Deciding game") : "";
  return t(`第${state.sportGame.currentGame}局・${target}分${final}`, `Game ${state.sportGame.currentGame} · ${target} points${final}`);
}

function renderSportsSummary() {
  if (!hasSportRuleEngine()) return;
  const summary = SportsRuleEngine.matchSummary(state.sportConfig, state.sportGame);
  const winner = state.participants[summary.winnerIndex];
  const heading = document.createElement("div");
  heading.className = "sports-summary-result";
  const sport = document.createElement("span");
  sport.textContent = sportName();
  const result = document.createElement("strong");
  result.textContent = summary.status === "finished" && winner
    ? t(`${winner.name} 勝出 ${summary.gamesWon[0]}–${summary.gamesWon[1]}`, `${winner.name} wins ${summary.gamesWon[0]}–${summary.gamesWon[1]}`)
    : t("比賽進行中", "Match in progress");
  heading.append(sport, result);
  const games = document.createElement("ol");
  games.className = "sports-summary-games";
  summary.completedGames.forEach((game) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = t(`第 ${game.number} 局`, `Game ${game.number}`);
    const score = document.createElement("b");
    score.textContent = `${game.scores[0]}–${game.scores[1]}`;
    item.append(label, score);
    games.appendChild(item);
  });
  elements.sportsSummaryContent.replaceChildren(heading, games);
  elements.sportsReopenButton.hidden = summary.status !== "finished";
}

function openSportsSummary() {
  if (!hasSportRuleEngine()) return;
  renderSportsSummary();
  openModal("sportsSummaryModal");
}

function applySportPoint(teamIndex) {
  if (!hasSportRuleEngine()) return;
  if (state.sportGame.status === "finished") {
    showToast(t("比賽已完成；可查看賽果或重新開啟", "Match finished; view the result or reopen it"));
    return;
  }
  snapshot();
  const outcome = SportsRuleEngine.applyPoint(state.sportConfig, state.sportGame, teamIndex, 1);
  state.sportGame = outcome.state;
  syncSportStateToScoreboard();
  render();
  if (outcome.event.matchWon) {
    openSportsSummary();
  } else if (outcome.event.gameWon) {
    showToast(t(`第 ${outcome.event.completedGame.number} 局完成`, `Game ${outcome.event.completedGame.number} completed`));
  }
}

function undoLastSportPoint() {
  if (!hasSportRuleEngine() || !state.sportGame.pointHistory.length) return showToast(t("暫時未有分數可以撤銷", "No points to undo"));
  snapshot();
  state.sportGame = SportsRuleEngine.replayPoints(state.sportConfig, state.sportGame.pointHistory.slice(0, -1), state.sportGame.startedAt);
  syncSportStateToScoreboard();
  render();
  showToast(t("已撤銷上一分", "Last point undone"));
}

function render() {
  if (!state) {
    updateHome();
    return;
  }
  syncSportsLayout();
  const sportsLandscape = document.body.classList.contains("sports-landscape-active");
  elements.matchTitle.textContent = state.title;
  if (hasSportRuleEngine()) syncSportStateToScoreboard();
  elements.roundLabel.textContent = hasSportRuleEngine()
    ? `${sportName()}・${t(`第 ${state.sportGame.currentGame} 局`, `Game ${state.sportGame.currentGame}`)}`
    : t(`第 ${state.round} 局`, `Round ${state.round}`);
  elements.playerCountLabel.textContent = state.kind === "chooser"
    ? t("多人手指抽籤", "Multi-touch draw")
    : state.kind === "mahjong" ? `${state.participants.length} ${t("位玩家", "players")}` : `${state.participants.length} ${t("個計分格", "score panels")}`;
  elements.modeLabel.textContent = state.kind === "mahjong" ? t("香港牌計番", "Hong Kong Mahjong") : state.kind === "bigtwo" ? t("鋤大D自動計分", "Automatic Big Two scoring") : state.kind === "chooser" ? t("隨機抽首家", "Random first player") : hasSportRuleEngine() ? `${sportName()}・${sportFormatLabel()}` : ({ winner: t("勝方 +1", "Winner +1"), cumulative: t("累加本局", "Add round scores"), manual: t("手動總分", "Manual totals") })[state.totalMode];
  const specialMode = state.kind === "mahjong" || state.kind === "chooser" || state.kind === "bigtwo";
  const mahjongActive = state.kind === "mahjong";
  document.body.classList.toggle("mahjong-minimal-active", mahjongActive && !isHomeVisible);
  elements.matchHeading.hidden = mahjongActive || state.kind === "bigtwo";
  elements.timerBar.hidden = specialMode;
  elements.matchControls.hidden = specialMode;
  elements.sportsMatchStatus.hidden = !hasSportRuleEngine();
  elements.sportsMatchStatus.textContent = sportStatusCopy();
  $("#finishRoundButton").hidden = hasSportRuleEngine();
  elements.sportsResetGameButton.hidden = !hasSportRuleEngine() || state.sportGame.status === "finished";
  elements.sportsResetMatchButton.hidden = !hasSportRuleEngine();
  elements.sportsSummaryButton.hidden = !hasSportRuleEngine() || state.sportGame.status !== "finished";
  const mahjongSettled = state.kind === "mahjong" && state.mahjongSession?.status === "settled";
  elements.roundHistory.hidden = state.kind === "chooser" || state.kind === "mahjong" || state.kind === "bigtwo" || sportsLandscape;
  elements.scoreGrid.hidden = state.kind === "chooser" || sportsLandscape || mahjongSettled;
  elements.mahjongPanel.hidden = state.kind !== "mahjong";
  elements.chooserPanel.hidden = state.kind !== "chooser";
  elements.bigTwoPanel.hidden = state.kind !== "bigtwo";
  $("#settingsButton").hidden = isHomeVisible || !state || mahjongSettled;
  elements.undoButton.hidden = isHomeVisible || mahjongSettled;
  $("#clearHistoryButton").hidden = state.kind === "mahjong" || hasSportRuleEngine();
  if (state.kind === "mahjong") $("#historyTitle").textContent = "牌局紀錄";
  updateTimerDisplay();
  renderScoreCards();
  renderHistory();
  if (state.kind === "mahjong") renderMahjongEntry();
  if (state.kind === "bigtwo") renderBigTwo();
  if (state.kind === "chooser") renderChooser();
  elements.undoButton.disabled = undoStack.length === 0;
  saveState();
  updateHome();
}

function renderScoreCards() {
  elements.scoreGrid.replaceChildren();
  elements.scoreGrid.dataset.count = String(state.participants.length);
  elements.scoreGrid.classList.toggle("mahjong-score-grid", state.kind === "mahjong" || state.kind === "bigtwo");
  elements.sportsLandscapeLeft.replaceChildren();
  elements.sportsLandscapeRight.replaceChildren();
  const landscapeTarget = document.body.classList.contains("sports-landscape-active");
  const sportRules = hasSportRuleEngine();
  const matchFinished = sportRules && state.sportGame.status === "finished";

  if (state.kind === "mahjong" || state.kind === "bigtwo") {
    state.participants.forEach((player, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "mahjong-player-card";
      card.dataset.id = player.id;
      card.style.setProperty("--player-color", player.color);
      const isMahjong = state.kind === "mahjong";
      const seatWind = MahjongCore.WINDS.includes(player.seatWind) ? player.seatWind : MahjongCore.WINDS[index];
      const seatLabel = isMahjong
        ? (uiLanguage === "en" ? MahjongCore.WIND_SHORT_NAMES_EN[seatWind] || "E" : MahjongCore.WIND_SHORT_NAMES[seatWind] || "東")
        : String(index + 1);
      card.setAttribute("aria-label", isMahjong
        ? uiLanguage === "en" ? `${seatLabel} seat, ${player.name}, total ${formatPoints(player.total)}. Tap to score a win` : `${seatLabel}位 ${player.name}，總分 ${formatPoints(player.total)}，按一下記錄食糊`
        : `${player.name}，總分 ${formatPoints(player.total)}`);
      const icon = document.createElement("span");
      icon.className = "mahjong-player-icon";
      icon.textContent = seatLabel;
      const name = document.createElement("strong");
      name.textContent = player.name;
      const score = document.createElement("b");
      score.textContent = formatPoints(player.total);
      const hint = document.createElement("small");
      hint.textContent = isMahjong ? `${seatLabel}${t("位・", " seat · ")}${t("按玩家開始計番", "Tap to score a win")}` : t("累積分數", "Total score");
      card.append(icon, name, score, hint);
      elements.scoreGrid.appendChild(card);
    });
    return;
  }

  state.participants.forEach((player, index) => {
    const fragment = $("#scoreCardTemplate").content.cloneNode(true);
    const card = $(".score-card", fragment);
    card.style.setProperty("--player-color", player.color);
    card.dataset.id = player.id;
    $(".total-score", card).hidden = false;
    $(".player-index", card).textContent = String(index + 1).padStart(2, "0");
    $(".player-name", card).textContent = player.name;
    $(".score-number", card).textContent = player.score;
    $(".total-score strong", card).textContent = player.total;
    $(".total-score span", card).textContent = sportRules ? t("勝局", "Games won") : t("總分", "Total");
    const scoreDisplay = $(".score-display", card);
    scoreDisplay.setAttribute("aria-label", matchFinished
      ? t(`${player.name} 比賽已完成`, `${player.name}, match finished`)
      : t(`${player.name} 現時 ${player.score} 分，按一下加一分`, `${player.name}, ${player.score} points. Tap to add one`));
    scoreDisplay.classList.toggle("is-disabled", matchFinished);
    scoreDisplay.disabled = matchFinished;
    $(".score-tap-hint", card).textContent = matchFinished ? t("比賽已完成", "Match finished") : t("按一下 ＋1", "Tap +1");
    const minusButton = $(".minus-button", card);
    minusButton.textContent = sportRules ? t("按錯？撤銷上一分", "Undo last point") : t("按錯？減 1 分", "Undo: -1 point");
    minusButton.setAttribute("aria-label", sportRules ? t("撤銷上一分", "Undo last point") : `${player.name} 減一分`);
    minusButton.disabled = matchFinished || (sportRules && state.sportGame.pointHistory.length === 0);
    $(".total-plus", card).hidden = sportRules;
    $(".total-minus", card).hidden = sportRules;
    $(".total-plus", card).setAttribute("aria-label", `${player.name} 總分加一`);
    $(".total-minus", card).setAttribute("aria-label", `${player.name} 總分減一`);
    const target = landscapeTarget ? (index === 0 ? elements.sportsLandscapeLeft : elements.sportsLandscapeRight) : elements.scoreGrid;
    target.appendChild(fragment);
  });
}

function currentElapsedSeconds() {
  if (!state?.timer) return 0;
  if (!state.timer.running || !state.timer.startedAt) return state.timer.elapsed;
  return state.timer.elapsed + Math.max(0, Math.floor((Date.now() - state.timer.startedAt) / 1000));
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const shortTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${shortTime}` : shortTime;
}

function updateTimerDisplay() {
  if (!state?.timer) return;
  elements.timerDisplay.textContent = formatTime(currentElapsedSeconds());
  elements.timerToggleButton.setAttribute("aria-pressed", String(state.timer.running));
  const timerActionLabel = state.timer.running ? t("暫停計時", "Pause timer") : t("開始計時", "Start timer");
  elements.timerToggleButton.setAttribute("aria-label", timerActionLabel);
  elements.timerToggleButton.title = timerActionLabel;
  elements.timerToggleLabel.textContent = timerActionLabel;
  $(".timer-toggle-icon", elements.timerToggleButton).textContent = state.timer.running ? "Ⅱ" : "▶";
}

function toggleTimer() {
  if (state.timer.running) {
    state.timer.elapsed = currentElapsedSeconds();
    state.timer.running = false;
    state.timer.startedAt = null;
  } else {
    state.timer.running = true;
    state.timer.startedAt = Date.now();
  }
  updateTimerDisplay();
  saveState();
}

function renderHistory() {
  if (state.kind === "mahjong") {
    renderMahjongHistory();
    return;
  }
  if (!state.history.length) {
    elements.historyContent.innerHTML = `
      <div class="history-empty">
        <p><span>◇</span>完成第一局後，比分會顯示在這裡</p>
      </div>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["局數", ...state.participants.map((player) => player.name), "勝方"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  [...state.history].reverse().forEach((round) => {
    const row = document.createElement("tr");
    const roundCell = document.createElement("td");
    roundCell.textContent = `第 ${round.number} 局`;
    row.appendChild(roundCell);

    state.participants.forEach((player) => {
      const scoreCell = document.createElement("td");
      const saved = round.scores.find((entry) => entry.id === player.id);
      scoreCell.textContent = saved ? saved.score : "—";
      row.appendChild(scoreCell);
    });

    const winnerCell = document.createElement("td");
    winnerCell.className = "winner-cell";
    winnerCell.textContent = round.winners?.join("・") || "—";
    row.appendChild(winnerCell);
    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  elements.historyContent.replaceChildren(table);
}

function formatPoints(value) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function displayMahjongPatternLabel(pattern, wind) {
  if (pattern.id === "prevailing-wind" && pattern.label.startsWith("圈風")) {
    return `圈風（${MahjongCore.WIND_NAMES[wind] || "東圈"}）`;
  }
  return pattern.label;
}

function mahjongAnalyzerTileName(tile) {
  return `${tile.glyph} ${uiLanguage === "en" ? tile.en : tile.zh}`;
}

function mahjongAnalyzerUsedCounts(draft = mahjongAnalyzerDraft) {
  return [...draft.concealed, ...draft.melds.flatMap((meld) => MahjongHandAnalyzer.meldTileIds(meld))]
    .reduce((counts, id) => ({ ...counts, [id]: (counts[id] || 0) + 1 }), {});
}

function updateMahjongAnalyzerMeldOptions() {
  const selectedType = elements.mahjongAnalyzerMeldType.value;
  const type = selectedType === "concealed-kong" ? "kong" : selectedType;
  const previous = elements.mahjongAnalyzerMeldTile.value;
  const choices = MahjongHandAnalyzer.TILE_DEFS.filter((tile) => type !== "chow" || (tile.suit !== "honor" && tile.rank <= 7));
  elements.mahjongAnalyzerMeldTile.replaceChildren(...choices.map((tile) => {
    const option = document.createElement("option");
    option.value = tile.id;
    option.textContent = type === "chow"
      ? `${tile.glyph}${MahjongHandAnalyzer.TILE_MAP[`${tile.suit}${tile.rank + 1}`].glyph}${MahjongHandAnalyzer.TILE_MAP[`${tile.suit}${tile.rank + 2}`].glyph} ${uiLanguage === "en" ? `${tile.rank}-${tile.rank + 2}` : `${tile.rank}${tile.rank + 1}${tile.rank + 2}${tile.suit === "m" ? "萬" : tile.suit === "s" ? "索" : "筒"}`}`
      : mahjongAnalyzerTileName(tile);
    return option;
  }));
  if (choices.some((tile) => tile.id === previous)) elements.mahjongAnalyzerMeldTile.value = previous;
}

function mahjongAnalyzerReason(result) {
  if (result.reason === "wrong-tile-count") return t(`手上牌要有 ${result.expected} 隻，而家有 ${result.actual} 隻。`, `You need ${result.expected} concealed tiles; ${result.actual} entered.`);
  if (result.reason === "too-many-copies") return t("同一款牌最多只可以有四隻。", "A hand cannot contain more than four copies of one tile.");
  if (result.reason === "too-many-melds") return t("最多只可以有四組上、碰或槓。", "A hand can have at most four declared melds.");
  if (result.reason === "invalid-meld") return t("有一組上、碰或槓輸入唔完整。", "One declared meld is invalid.");
  if (result.reason === "not-winning-hand") return t("牌數正確，但暫時組唔成四組一對、七對子或十三么，請檢查牌張。", "The tile count is correct, but the tiles do not form four melds and a pair, Seven Pairs, or Thirteen Orphans.");
  return t("請檢查輸入嘅牌張。", "Check the entered tiles.");
}

function renderMahjongAnalyzer() {
  if (state?.kind !== "mahjong") return;
  updateMahjongAnalyzerMeldOptions();
  const usedCounts = mahjongAnalyzerUsedCounts();
  const expected = 14 - mahjongAnalyzerDraft.melds.length * 3;
  elements.mahjongAnalyzerCount.textContent = `${mahjongAnalyzerDraft.concealed.length}／${expected} ${t("隻", "tiles")}`;

  elements.mahjongAnalyzerMelds.replaceChildren();
  mahjongAnalyzerDraft.melds.forEach((meld, index) => {
    const item = document.createElement("span");
    item.className = "mahjong-analyzer-meld";
    const ids = MahjongHandAnalyzer.meldTileIds(meld);
    const typeName = meld.type === "kong" && meld.open === false
      ? t("暗槓", "Concealed kong")
      : { chow: t("上", "Chow"), pung: t("碰", "Pung"), kong: t("槓", "Kong") }[meld.type];
    const label = document.createElement("span");
    label.textContent = `${typeName} ${ids.map((id) => MahjongHandAnalyzer.TILE_MAP[id].glyph).join("")}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.removeAnalyzerMeld = String(index);
    remove.setAttribute("aria-label", t(`移除${typeName}`, `Remove ${typeName}`));
    remove.textContent = "×";
    item.append(label, remove);
    elements.mahjongAnalyzerMelds.appendChild(item);
  });

  elements.mahjongAnalyzerSelected.replaceChildren();
  const selectedCounts = mahjongAnalyzerDraft.concealed.reduce((counts, id) => ({ ...counts, [id]: (counts[id] || 0) + 1 }), {});
  const selectedTiles = MahjongHandAnalyzer.TILE_DEFS.filter((tile) => selectedCounts[tile.id]);
  if (!selectedTiles.length) {
    const empty = document.createElement("span");
    empty.className = "mahjong-selected-empty";
    empty.textContent = t("由下面逐隻按入手上牌；按已選牌可以減返。", "Tap tiles below to add them; tap a selected tile to remove one.");
    elements.mahjongAnalyzerSelected.appendChild(empty);
  } else {
    selectedTiles.forEach((tile) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mahjong-selected-tile";
      button.dataset.removeAnalyzerTile = tile.id;
      button.title = mahjongAnalyzerTileName(tile);
      button.textContent = tile.glyph;
      const count = document.createElement("small");
      count.textContent = `×${selectedCounts[tile.id]}`;
      button.appendChild(count);
      elements.mahjongAnalyzerSelected.appendChild(button);
    });
  }

  elements.mahjongAnalyzerPalette.replaceChildren(...MahjongHandAnalyzer.TILE_DEFS.map((tile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mahjong-tile-button";
    button.dataset.addAnalyzerTile = tile.id;
    button.title = mahjongAnalyzerTileName(tile);
    button.setAttribute("aria-label", mahjongAnalyzerTileName(tile));
    button.textContent = tile.glyph;
    button.disabled = (usedCounts[tile.id] || 0) >= 4 || mahjongAnalyzerDraft.concealed.length >= expected;
    return button;
  }));

  const winner = state.participants.find((player) => player.id === elements.mahjongWinner.value) || state.participants[0];
  const prevailingWind = MahjongCore.windForCycle(state.mahjongSession?.startingWind || state.mahjong.prevailingWind, state.mahjongSession?.completedCycles || 0);
  const result = MahjongHandAnalyzer.analyzeHand({
    concealed: mahjongAnalyzerDraft.concealed,
    melds: mahjongAnalyzerDraft.melds,
    seatWind: winner?.seatWind || "east",
    prevailingWind,
    flowers: Number($("#mahjongFlowers").value) || 0,
  });
  mahjongAnalyzerDraft.result = result;
  elements.mahjongAnalyzerResult.classList.toggle("is-valid", result.valid);
  elements.mahjongAnalyzerResult.classList.toggle("is-invalid", !result.valid && result.reason !== "wrong-tile-count");
  if (!result.valid) {
    elements.mahjongAnalyzerResult.textContent = mahjongAnalyzerReason(result);
    elements.mahjongAnalyzerApply.disabled = true;
    return;
  }
  const patterns = result.patterns.map((id) => state.mahjong.patterns.find((pattern) => pattern.id === id)).filter((pattern) => pattern?.enabled);
  const fan = patterns.reduce((sum, pattern) => sum + pattern.fan, 0);
  const names = patterns.map((pattern) => uiLanguage === "en" ? MAHJONG_PATTERN_LABELS_EN[pattern.id] || pattern.label : displayMahjongPatternLabel(pattern, prevailingWind));
  elements.mahjongAnalyzerResult.textContent = names.length
    ? t(`牌型成立。建議：${names.join("、")}；牌面共 ${fan} 番。`, `Valid winning hand. Suggested: ${names.join(", ")}; ${fan} fan visible from the tiles.`)
    : t("牌型成立，但牌面未能確定有番；請再按實際食糊情況選擇番型。", "Valid winning hand, but no fan can be proven from the tiles alone. Select any situational patterns manually.");
  elements.mahjongAnalyzerApply.disabled = patterns.length === 0;
}

function openMahjongAnalyzer() {
  if (state?.kind !== "mahjong") return;
  mahjongAnalyzerDraft = { concealed: [], melds: [], result: null };
  renderMahjongAnalyzer();
  openModal("mahjongAnalyzerModal");
}

function applyMahjongAnalyzerSuggestions() {
  const result = mahjongAnalyzerDraft.result;
  if (!result?.valid) return;
  $$('input[name="patterns"]', elements.mahjongPatternChoices).forEach((input) => {
    if (MAHJONG_ANALYZER_PATTERN_IDS.has(input.value)) input.checked = false;
  });
  result.patterns.forEach((id) => {
    const input = $(`input[name="patterns"][value="${CSS.escape(id)}"]`, elements.mahjongPatternChoices);
    if (input) input.checked = true;
  });
  $("#mahjongHandFan").value = "0";
  captureMahjongDraft();
  updateMahjongPreview();
  closeModal("mahjongAnalyzerModal");
  showToast(t("已套用自動分析牌型，請確認食糊情況", "Suggested patterns applied; confirm any situational bonuses"));
}

function calculateMahjongHand({ winnerId, winType, discarderId, dealerId, handFan, patternFan = 0, patternIncludesSelfDraw = false, flowers, fanAdjustment = 0 }) {
  const rules = state.mahjong;
  if (winType === "draw") {
    return { valid: true, fan: 0, rawFan: 0, cappedByLimit: false, bonusFan: 0, patternFan: 0, points: 0, net: Object.fromEntries(state.participants.map((player) => [player.id, 0])), winner: null, discarder: null };
  }
  const cleanHandFan = Math.max(0, Math.round(Number(handFan) || 0));
  const cleanPatternFan = Math.max(0, Math.round(Number(patternFan) || 0));
  const cleanFlowers = Math.max(0, Math.round(Number(flowers) || 0));
  const cleanFanAdjustment = Math.round(Number(fanAdjustment) || 0);
  const selfDrawBonus = winType === "self" && !patternIncludesSelfDraw ? rules.selfDrawFan : 0;
  const bonusFan = cleanPatternFan + selfDrawBonus + cleanFlowers * rules.flowerFan;
  const rawFan = Math.max(0, cleanHandFan + bonusFan + cleanFanAdjustment);
  const score = MahjongCore.scoreForFan({
    rawFan,
    minimumFan: rules.minimumFan,
    maxFan: rules.maxFan,
    basePoints: rules.basePoints,
    fanStep: rules.fanStep,
    scoringMode: rules.scoringMode,
    maxPoints: rules.maxPoints,
  });
  const fan = score.fan;
  if (!score.valid) return { valid: false, fan, bonusFan, reason: t(`未夠 ${rules.minimumFan} 番起糊`, `At least ${rules.minimumFan} fan is required to win`) };
  const cappedPoints = score.points;
  const winner = state.participants.find((player) => player.id === winnerId);
  const discarder = state.participants.find((player) => player.id === discarderId);
  if (!winner) return { valid: false, reason: t("請選擇食糊者", "Choose the winner") };
  if (winType === "discard" && (!discarder || discarder.id === winner.id)) return { valid: false, reason: t("出銃時要選另一位玩家", "Choose a different player as the discarder") };

  const net = Object.fromEntries(state.participants.map((player) => [player.id, 0]));
  const dealerWinMultiplier = dealerId === winner.id ? rules.dealerWinMultiplier : 1;
  if (winType === "self") {
    state.participants.forEach((player) => {
      if (player.id === winner.id) return;
      const dealerMultiplier = player.id === dealerId ? rules.dealerLoseMultiplier : 1;
      const payment = cappedPoints * rules.selfDrawMultiplier * dealerWinMultiplier * dealerMultiplier;
      net[player.id] -= payment;
      net[winner.id] += payment;
    });
  } else {
    const payers = state.participants.filter((player) => player.id !== winner.id && (rules.ronPaymentMode === "all" || player.id === discarder.id));
    payers.forEach((player) => {
      const dealerMultiplier = player.id === dealerId ? rules.dealerLoseMultiplier : 1;
      const discardMultiplier = player.id === discarder.id ? rules.discardMultiplier : rules.selfDrawMultiplier;
      const payment = cappedPoints * discardMultiplier * dealerWinMultiplier * dealerMultiplier;
      net[player.id] -= payment;
      net[winner.id] += payment;
    });
  }

  return { valid: true, fan, rawFan, cappedByLimit: fan < rawFan, bonusFan, patternFan: cleanPatternFan, multiplier: score.multiplier, points: cappedPoints, net, winner, discarder };
}

function renderMahjongEntry() {
  const session = state.mahjongSession || newMahjongSession({ startingWind: state.mahjong.prevailingWind });
  state.mahjongSession = session;
  const settled = session.status === "settled";
  elements.mahjongEntryForm.hidden = settled;
  elements.mahjongSessionBar.hidden = settled;
  elements.mahjongDrawButton.hidden = settled || state.mahjong.drawDealerAction !== "pass";
  elements.mahjongSettlement.hidden = !settled;
  if (settled) {
    if (elements.mahjongScoringModal.classList.contains("is-open")) closeModal("mahjongScoringModal");
    renderMahjongSettlement();
    return;
  }

  elements.mahjongProgress.textContent = MahjongCore.progressLabel(session, state.participants.map((player) => player.id), uiLanguage);
  const draft = session.draft;
  const draftValues = draft?.touched ? draft.values || {} : {};
  const winnerValue = elements.mahjongWinner.value;
  const discarderValue = elements.mahjongDiscarder.value;
  const dealerValue = draft?.touched
    ? (draftValues.dealer || elements.mahjongDealer.value || session.nextDealerId || state.participants[0]?.id)
    : (session.nextDealerId || elements.mahjongDealer.value || state.participants[0]?.id);
  const selectedPatternIds = new Set(draftValues.patterns || $$("input[name='patterns']:checked", elements.mahjongPatternChoices).map((input) => input.value));
  [elements.mahjongWinner, elements.mahjongDiscarder, elements.mahjongDealer].forEach((select) => {
    select.replaceChildren();
    state.participants.forEach((player, index) => {
      const option = document.createElement("option");
      option.value = player.id;
      const seatWind = MahjongCore.WINDS.includes(player.seatWind) ? player.seatWind : MahjongCore.WINDS[index];
      const seatLabel = uiLanguage === "en" ? MahjongCore.WIND_SHORT_NAMES_EN[seatWind] || "E" : MahjongCore.WIND_SHORT_NAMES[seatWind] || "東";
      option.textContent = `${seatLabel}${t("位・", " seat · ")}${player.name}`;
      select.appendChild(option);
    });
  });
  if (state.participants.some((player) => player.id === winnerValue)) elements.mahjongWinner.value = winnerValue;
  if (state.participants.some((player) => player.id === discarderValue)) elements.mahjongDiscarder.value = discarderValue;
  if (state.participants.some((player) => player.id === dealerValue)) elements.mahjongDealer.value = dealerValue;
  if (!elements.mahjongDealer.value && state.participants[0]) elements.mahjongDealer.value = state.participants[0].id;
  if (elements.mahjongWinner.value === elements.mahjongDiscarder.value && state.participants[1]) elements.mahjongDiscarder.value = state.participants[1].id;
  if (elements.mahjongScoringModal.classList.contains("is-open")) {
    const activeWinner = state.participants.find((player) => player.id === elements.mahjongWinner.value);
    $("#mahjongScoringTitle").textContent = activeWinner ? t(`為 ${activeWinner.name} 計番`, `Score ${activeWinner.name}'s win`) : t("今局計番", "Score this hand");
  }
  ["winner", "discarder", "winType", "dealer", "handFan", "flowers", "note"].forEach((name) => {
    const control = elements.mahjongEntryForm.elements.namedItem(name);
    if (control && draftValues[name] !== undefined) control.value = draftValues[name];
  });
  if (!elements.mahjongDealer.value && state.participants[0]) elements.mahjongDealer.value = state.participants[0].id;
  elements.mahjongDiscarderField.hidden = elements.mahjongWinType.value !== "discard";
  $("#mahjongWinnerField").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongHandFanField").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongFlowersField").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongPatternFieldset").hidden = elements.mahjongWinType.value === "draw";
  $("#mahjongOpenAnalyzerButton").hidden = elements.mahjongWinType.value === "draw";
  elements.mahjongPatternChoices.replaceChildren();
  const currentWind = MahjongCore.windForCycle(session.startingWind || state.mahjong.prevailingWind, session.completedCycles);
  const windLabels = MahjongCore.WIND_NAMES;
  state.mahjong.patterns.filter((pattern) => pattern.enabled).forEach((pattern) => {
    const label = document.createElement("label");
    label.className = "mahjong-pattern-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "patterns";
    input.value = pattern.id;
    input.checked = selectedPatternIds.has(pattern.id);
    const text = document.createElement("span");
    text.className = "mahjong-pattern-copy";
    const patternName = document.createElement("b");
    patternName.textContent = uiLanguage === "en"
      ? (MAHJONG_PATTERN_LABELS_EN[pattern.id] || pattern.label)
      : displayMahjongPatternLabel(pattern, currentWind);
    text.appendChild(patternName);
    if (uiLanguage === "en" && MAHJONG_PATTERN_HELP_EN[pattern.id]) {
      const help = document.createElement("small");
      help.textContent = MAHJONG_PATTERN_HELP_EN[pattern.id];
      text.appendChild(help);
    }
    const fan = document.createElement("strong");
    const isCappedPattern = state.mahjong.maxFan > 0 && pattern.fan > state.mahjong.maxFan;
    fan.textContent = isCappedPattern
      ? t(`${pattern.fan}→${state.mahjong.maxFan} 番`, `${pattern.fan}→${state.mahjong.maxFan} fan`)
      : t(`${pattern.fan} 番`, `${pattern.fan} fan`);
    label.append(input, text, fan);
    elements.mahjongPatternChoices.appendChild(label);
  });
  const limitLabel = state.mahjong.maxFan > 0
    ? t(`${state.mahjong.maxFan} 番封頂`, `${state.mahjong.maxFan} fan cap`)
    : t("不限番", "No fan cap");
  const currentWindLabel = uiLanguage === "en"
    ? `${MahjongCore.WIND_SHORT_NAMES_EN[currentWind] || "E"} Round`
    : windLabels[currentWind] || "東圈";
  $("#mahjongRuleBadge").textContent = `${currentWindLabel}・${t(`${state.mahjong.minimumFan} 番起糊`, `${state.mahjong.minimumFan} fan minimum`)}・${limitLabel}`;
  updateMahjongPreview();
}

function openMahjongScoring(winnerId = "") {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status !== "active") return;
  renderMahjongEntry();
  if (winnerId && state.participants.some((player) => player.id === winnerId)) {
    elements.mahjongWinner.value = winnerId;
    if (elements.mahjongDiscarder.value === winnerId) {
      elements.mahjongDiscarder.value = state.participants.find((player) => player.id !== winnerId)?.id || "";
    }
    captureMahjongDraft();
    updateMahjongPreview();
  }
  const winner = state.participants.find((player) => player.id === elements.mahjongWinner.value);
  $("#mahjongScoringTitle").textContent = winnerId && winner ? t(`為 ${winner.name} 計番`, `Score ${winner.name}'s win`) : t("今局計番", "Score this hand");
  openModal("mahjongScoringModal");
}

function updateMahjongQuickPreview(form, preview, capHelp) {
  if (!form || !preview) return;
  const data = new FormData(form);
  const minimumFan = Number(data.get("mahjongMinFan")) || 1;
  const maxFan = Number(data.get("mahjongMaxFan")) || 0;
  const basePoints = Math.max(1, Number(data.get("mahjongBasePoints")) || 1);
  const fanStep = Math.max(1, Number(data.get("mahjongFanStep")) || 2);
  const scoringMode = data.get("mahjongScoringPreset") || data.get("mahjongAdvancedScoringMode") || "hk-table";
  const drawRule = data.get("mahjongDrawDealerAction") === "pass"
    ? t("流局過莊", "dealer passes after a draw")
    : t("流局留莊", "dealer stays after a draw");
  renderMahjongScoringTable(form, scoringMode);
  const fanList = [...new Set([minimumFan, Math.max(minimumFan, 4), maxFan > 0 ? maxFan : Math.max(minimumFan, 13)])]
    .filter((fan) => fan >= minimumFan && (maxFan === 0 || fan <= maxFan))
    .sort((left, right) => left - right);
  const examples = fanList.map((fan) => {
    const result = MahjongCore.scoreForFan({ rawFan: fan, minimumFan, maxFan, basePoints, fanStep, scoringMode, maxPoints: data.get("mahjongMaxPoints") });
    return HK_SCORING_MODES.includes(scoringMode)
      ? t(`${fan}番計${result.multiplier}倍`, `${fan} fan = ×${result.multiplier}`)
      : t(`${fan}番計${Math.round(result.points)}分`, `${fan} fan = ${Math.round(result.points)} points`);
  });
  const capText = maxFan > 0 ? t(`${maxFan}番封頂`, `${maxFan} fan cap`) : t("不設上限", "no fan cap");
  preview.textContent = t(
    `目前玩法：${minimumFan}番起糊，${capText}，${drawRule}；例如${examples.join("、")}。`,
    `Current rules: ${minimumFan} fan minimum, ${capText}, ${drawRule}; for example ${examples.join(", ")}.`,
  );
  if (capHelp) capHelp.textContent = maxFan > 0
    ? t(`實際超過${maxFan}番，都會按${maxFan}番封頂。`, `Hands above ${maxFan} fan are scored at the ${maxFan}-fan cap.`)
    : t("沿用舊設定：不設番數上限。", "Legacy rule: no fan cap.");
}

function renderMahjongScoringTable(form, scoringMode) {
  const body = $(".mahjong-score-table tbody", form);
  const help = $("[data-scoring-style-help]", form);
  if (!body) return;
  const rows = scoringMode === "hk-half-spicy"
    ? [["3番", "1倍"], ["4番", "2倍"], ["5番", "3倍"], ["6番", "4倍"], ["7番", "6倍"], ["8番", "8倍"], ["9番", "12倍"], ["10番", "16倍"], ["11番", "24倍"], ["12番", "32倍"], ["13番或以上", "48倍／封頂"]]
    : scoringMode === "hk-full-spicy"
      ? [["3番", "1倍"], ["4番", "2倍"], ["5番", "4倍"], ["6番", "8倍"], ["7番", "16倍"], ["8番", "32倍"], ["9番", "64倍"], ["10番", "128倍"], ["11番", "256倍"], ["12番", "512倍"], ["13番或以上", "1024倍／封頂"]]
      : [["3番", "1倍"], ["4番", "2倍"], ["5–6番", "4倍"], ["7–9番", "8倍"], ["10–12番", "16倍"], ["13番或以上", "32倍／封頂"]];
  body.replaceChildren(...rows.map(([fan, multiplier]) => {
    const row = document.createElement("tr");
    const fanCell = document.createElement("td");
    const multiplierCell = document.createElement("td");
    fanCell.textContent = uiLanguage === "en" ? fan.replace("番或以上", " fan or more").replace("番", " fan") : fan;
    multiplierCell.textContent = uiLanguage === "en" ? multiplier.replace("倍／封頂", "× / cap").replace("倍", "×") : multiplier;
    row.append(fanCell, multiplierCell);
    return row;
  }));
  if (help) help.textContent = scoringMode === "hk-half-spicy"
    ? t("四番後交替加半級、再升一倍，銀碼上升較平順。", "After 4 fan, the multiplier alternates between a half step and doubling for a gentler rise.")
    : scoringMode === "hk-full-spicy"
      ? t("四番後每多一番都會再跳一倍，適合想高番差距更大。", "Every fan after 4 doubles again, creating a much wider gap at high fan.")
      : t("將相近番數分成同一級，最容易睇同計。", "Nearby fan totals share a tier, making this the easiest option to follow.");
}

function setMahjongScoringControls(form, scoringMode) {
  if (!form) return;
  const mode = [...HK_SCORING_MODES, "doubling", "linear"].includes(scoringMode) ? scoringMode : "hk-table";
  const preset = $("[name='mahjongScoringPreset']", form);
  const advanced = $("[name='mahjongAdvancedScoringMode']", form);
  if (preset) preset.value = mode;
  if (advanced) advanced.value = mode;
}

function syncMahjongScoringControls(event) {
  const form = event.currentTarget;
  if (event.target.name === "mahjongScoringPreset") {
    setMahjongScoringControls(form, event.target.value);
  } else if (event.target.name === "mahjongAdvancedScoringMode") {
    setMahjongScoringControls(form, event.target.value);
  }
}

function updateMahjongLengthFields(form, prefix) {
  if (!form) return;
  const mode = $(`[name="mahjongLengthMode"]`, form)?.value || "east";
  const customField = $(`#${prefix}MahjongCustomHandsField`);
  const help = $(`#${prefix}MahjongLengthHelp`);
  if (customField) customField.hidden = mode !== "custom-hands";
  if (!help) return;
  help.textContent = mode === "half"
    ? t("半莊代表東圈加南圈；有人連莊，實際局數會增加。", "A half game includes the East and South rounds; dealer repeats can add hands.")
    : mode === "custom-hands"
      ? t("設定牌局總數；達到局數後會詢問是否結算。", "Set a hand limit; the app will ask to settle when it is reached.")
      : mode === "legacy-cycles"
        ? t("為咗保留呢場舊對局原有局數設定，會沿用原定圈數。", "This saved game keeps its original round settings.")
        : t("東圈代表四位玩家最少各做一次莊；連莊時實際局數會增加。", "An East round gives each player at least one turn as dealer; dealer repeats can add hands.");
}

function updateMahjongSetupPreview() {
  const form = $("#setupForm");
  if (!form || $("input[name='preset']:checked", form)?.value !== "mahjong") return;
  updateMahjongLengthFields(form, "setup");
  updateMahjongQuickPreview(form, $("#mahjongSetupPreview"), $("#mahjongCapHelp"));
}

function updateMahjongSettingsPreview() {
  const form = $("#settingsForm");
  if (!form || state?.kind !== "mahjong") return;
  updateMahjongLengthFields(form, "settings");
  updateMahjongQuickPreview(form, $("#settingsMahjongSetupPreview"), $("#settingsMahjongCapHelp"));
}

function updateMahjongPreview() {
  if (!state || state.kind !== "mahjong") return;
  const formData = new FormData(elements.mahjongEntryForm);
  const patternIds = formData.getAll("patterns");
  const selectedPatterns = state.mahjong.patterns.filter((pattern) => patternIds.includes(pattern.id));
  const patternFan = selectedPatterns.reduce((sum, pattern) => sum + pattern.fan, 0);
  const result = calculateMahjongHand({
    winnerId: formData.get("winner"),
    winType: formData.get("winType"),
    discarderId: formData.get("discarder"),
    dealerId: formData.get("dealer"),
    handFan: formData.get("handFan"),
    patternFan,
    patternIncludesSelfDraw: selectedPatterns.some((pattern) => pattern.selfDrawIncluded),
    flowers: formData.get("flowers"),
  });
  if (!result.valid) {
    elements.mahjongPreview.textContent = result.reason || "請填寫資料";
    elements.mahjongPreview.classList.add("is-invalid");
    return;
  }
  elements.mahjongPreview.classList.remove("is-invalid");
  if (formData.get("winType") === "draw") {
    elements.mahjongPreview.textContent = "流局：今局不計分，莊家留莊。";
    return;
  }
  const winnerLine = `${result.winner.name} +${Math.round(result.net[result.winner.id])}`;
  const payLine = state.participants.filter((player) => player.id !== result.winner.id && result.net[player.id] < 0)
    .map((player) => `${player.name} ${formatPoints(result.net[player.id])}`).join("・");
  const activeWind = MahjongCore.windForCycle(state.mahjongSession?.startingWind || state.mahjong.prevailingWind, state.mahjongSession?.completedCycles || 0);
  const breakdown = selectedPatterns.map((pattern) => `${displayMahjongPatternLabel(pattern, activeWind)}${pattern.fan}番`);
  const flowers = Math.max(0, Math.round(Number(formData.get("flowers")) || 0));
  if (flowers > 0 && state.mahjong.flowerFan > 0) breakdown.push(`花牌${flowers}×${state.mahjong.flowerFan}番`);
  if (formData.get("winType") === "self" && !selectedPatterns.some((pattern) => pattern.selfDrawIncluded) && state.mahjong.selfDrawFan > 0) {
    breakdown.push(`自摸${state.mahjong.selfDrawFan}番`);
  }
  const breakdownLine = breakdown.length ? `${breakdown.join("＋")}｜` : "";
  const limitLine = result.cappedByLimit ? `（原計 ${result.rawFan} 番，封頂 ${result.fan} 番）` : "";
  const multiplierLine = Number.isFinite(result.multiplier) ? `${result.multiplier}倍・` : "";
  elements.mahjongPreview.textContent = `${breakdownLine}合共 ${result.fan} 番${limitLine}｜${multiplierLine}計分 ${Math.round(result.points)} 分｜${winnerLine}${payLine ? `｜${payLine}` : ""}`;
}

function renderMahjongHistory() {
  if (!state.history.length) {
    elements.historyContent.innerHTML = `<div class="history-empty"><p><span>◇</span>記錄第一局麻雀後，賠分會顯示在這裡</p></div>`;
    return;
  }
  const list = document.createElement("div");
  list.className = "mahjong-history-list";
  [...state.history].reverse().forEach((round) => {
    const item = document.createElement("article");
    item.className = "mahjong-history-item";
    const title = document.createElement("div");
    title.className = "mahjong-history-title";
    const titleStrong = document.createElement("strong");
    titleStrong.textContent = round.handWindLabel || `${MahjongCore.WIND_SHORT_NAMES[round.wind] || "東"}風${MahjongCore.WIND_SHORT_NAMES[MahjongCore.WINDS[((round.handInCycle || 1) - 1) % 4]] || "東"}`;
    const titleSummary = document.createElement("span");
    const multiplierText = Number.isFinite(round.multiplier) ? `・${round.multiplier}倍` : "";
    titleSummary.textContent = round.winType === "draw" ? "流局・0 分" : `${round.winType === "self" ? "自摸" : "出銃"}・${round.fan} 番${multiplierText}・${Math.round(round.points)} 分`;
    title.append(titleStrong, titleSummary);
    const detail = document.createElement("p");
    const netLine = (round.net || []).map((entry) => `${entry.name} ${formatPoints(entry.amount)}`).join("　");
    const patternLine = round.patternNames?.length ? `｜${round.patternNames.join("＋")}` : "";
    const place = round.wind ? `${MahjongCore.WIND_NAMES[round.wind] || "東圈"}・` : "";
    detail.textContent = `${place}${round.winnerName || "流局"}${patternLine}${round.note ? `｜${round.note}` : ""}　${netLine}`;
    item.append(title, detail);
    list.appendChild(item);
  });
  elements.historyContent.replaceChildren(list);
}

function captureMahjongDraft() {
  if (!state || state.kind !== "mahjong" || state.mahjongSession?.status !== "active") return;
  const formData = new FormData(elements.mahjongEntryForm);
  state.mahjongSession.draft = {
    touched: true,
    values: { ...Object.fromEntries(formData.entries()), patterns: formData.getAll("patterns") },
  };
  saveState();
}

function mahjongSettlementSummary(unfinished = false) {
  const session = state.mahjongSession;
  const scores = state.participants.map((player) => `${player.name}：${formatPoints(player.total)} 分`).join("\n");
  const cycleText = session.lengthMode === "custom-hands"
    ? `${session.completedCycles} 圈・${session.completedHands}／${session.plannedHands} 局`
    : session.plannedCycles > 0
      ? `${session.completedCycles}／${session.plannedCycles} 圈・${session.completedHands} 局`
      : `${session.completedCycles} 圈・${session.completedHands} 局`;
  return `已完成：${cycleText}\n每位玩家目前總分：\n${scores}\n未完成輸入的牌局：${unfinished ? "有" : "無"}`;
}

function nextDealerAfterHand(dealerId, winnerId, winType, drawDealerAction = "stay") {
  if ((winType !== "draw" && winnerId === dealerId) || (winType === "draw" && drawDealerAction !== "pass")) return dealerId;
  const index = state.participants.findIndex((player) => player.id === dealerId);
  return state.participants[(index + 1) % state.participants.length]?.id || dealerId;
}

function completedCycleLabel(cycles) {
  return `${Math.max(0, Number(cycles) || 0)} 圈`;
}

function mahjongRankText(sortedPlayers, index) {
  const tied = (index > 0 && sortedPlayers[index - 1].total === sortedPlayers[index].total)
    || (index < sortedPlayers.length - 1 && sortedPlayers[index + 1].total === sortedPlayers[index].total);
  if (!tied) return `第 ${index + 1} 名`;
  const firstTiedIndex = sortedPlayers.findIndex((player) => player.total === sortedPlayers[index].total);
  return `並列第 ${firstTiedIndex + 1} 名`;
}

function archiveSettledMahjongGame() {
  const session = state.mahjongSession;
  session.archiveRecordId ||= state.gameId;
  saveState();
  return session.archiveRecordId;
}

function settleMahjongGame(earlyEnded = false) {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status === "settled") return;
  const session = state.mahjongSession;
  session.status = "settled";
  session.earlyEnded = earlyEnded === true;
  session.settledAt = new Date().toISOString();
  const started = Date.parse(session.startedAt);
  session.durationMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;
  session.draft = { touched: false, values: {} };
  archiveSettledMahjongGame();
  render();
  showToast(session.earlyEnded ? "已提早結束並儲存結算" : "已結算並儲存對局紀錄");
}

function requestMahjongSettlement() {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status !== "active") return;
  const session = state.mahjongSession;
  const early = isMahjongEarly(session);
  const unfinished = session.draft?.touched === true;
  if (unfinished) {
    openConfirm({
      title: "今局資料未完成",
      message: `${mahjongSettlementSummary(true)}\n\n未完成牌局不會計入結算。`,
      cancelText: "返回完成本局",
      acceptText: "放棄本局並結算",
      icon: "!",
      action: () => {
        session.draft = { touched: false, values: {} };
        settleMahjongGame(early);
      },
    });
    return;
  }
  openConfirm({
    title: early ? "提早結算今次麻雀？" : "結算今次麻雀？",
    message: `${early ? `今次尚未完成預定${session.lengthMode === "custom-hands" ? "局數" : "圈數"}，是否按目前分數結算？` : "是否按目前分數結算？"}\n\n${mahjongSettlementSummary(false)}`,
    cancelText: "返回遊戲",
    acceptText: "結束並結算",
    icon: "✓",
    action: () => settleMahjongGame(early),
  });
}

function renderMahjongSettlement() {
  const session = state.mahjongSession;
  const sorted = [...state.participants].sort((left, right) => right.total - left.total);
  const duration = formatTime(Math.floor((session.durationMs || 0) / 1000));
  const endedAt = session.settledAt ? new Date(session.settledAt).toLocaleString("zh-HK") : "—";
  const heading = document.createElement("div");
  heading.className = "mahjong-settlement-heading";
  const title = document.createElement("h3");
  title.textContent = session.earlyEnded ? "提早結束・結算完成" : "結算完成";
  const meta = document.createElement("p");
  meta.textContent = `已完成 ${completedCycleLabel(session.completedCycles)}・${session.completedHands} 局（${mahjongPlanLabel(session)}）｜用時 ${duration}｜${endedAt}`;
  heading.append(title, meta);
  const ranks = document.createElement("ol");
  ranks.className = "mahjong-final-ranks";
  sorted.forEach((player, index) => {
    const item = document.createElement("li");
    const position = document.createElement("span");
    position.textContent = mahjongRankText(sorted, index);
    const name = document.createElement("strong");
    name.textContent = player.name;
    const points = document.createElement("b");
    points.textContent = `${formatPoints(player.total)} 分`;
    item.append(position, name, points);
    ranks.appendChild(item);
  });
  elements.mahjongSettlement.replaceChildren(heading, ranks);
}

function viewArchivedMahjongRecord(recordId) {
  const record = loadMahjongArchive().find((item) => item.id === recordId);
  if (!record) return;
  const content = elements.mahjongRecordContent;
  content.replaceChildren();
  const meta = document.createElement("p");
  const endedAt = record.settledAt ? new Date(record.settledAt).toLocaleString("zh-HK") : "—";
  const duration = formatTime(Math.floor((record.durationMs || 0) / 1000));
  meta.className = "mahjong-record-meta";
  meta.textContent = `${record.earlyEnded ? "提早結束" : "完成結算"}・已完成 ${record.completedCycles || 0} 圈、${record.completedHands || 0} 局（${mahjongPlanLabel(record)}）・用時 ${duration}・${endedAt}`;
  content.appendChild(meta);
  const ranks = document.createElement("ol");
  ranks.className = "mahjong-final-ranks";
    const sortedPlayers = [...(record.participants || [])].sort((left, right) => right.total - left.total);
    sortedPlayers.forEach((player, index) => {
      const item = document.createElement("li");
      item.textContent = `${mahjongRankText(sortedPlayers, index)}　${player.name}　${formatPoints(player.total)} 分`;
      ranks.appendChild(item);
    });
  content.appendChild(ranks);
  const hands = document.createElement("div");
  hands.className = "mahjong-record-hands";
  [...(record.history || [])].reverse().forEach((hand) => {
    const item = document.createElement("p");
    const windLabel = hand.handWindLabel || `${MahjongCore.WIND_SHORT_NAMES[hand.wind] || "東"}風${MahjongCore.WIND_SHORT_NAMES[MahjongCore.WINDS[((hand.handInCycle || 1) - 1) % 4]] || "東"}`;
    item.textContent = `${windLabel}・${hand.winnerName || "流局"}・${hand.fan || 0} 番${Number.isFinite(hand.multiplier) ? `・${hand.multiplier}倍` : ""}・${Math.round(hand.points || 0)} 分`;
    hands.appendChild(item);
  });
  if (!record.history?.length) {
    const empty = document.createElement("p");
    empty.textContent = "今次沒有已完成牌局。";
    hands.appendChild(empty);
  }
  content.appendChild(hands);
  $("#mahjongRecordTitle").textContent = record.title || "麻雀對局紀錄";
  openModal("mahjongRecordModal");
}

function recordMahjongHand(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    winnerId: formData.get("winner"),
    winType: formData.get("winType"),
    discarderId: formData.get("discarder"),
    dealerId: formData.get("dealer"),
    handFan: formData.get("handFan"),
    patternFan: state.mahjong.patterns.filter((pattern) => formData.getAll("patterns").includes(pattern.id)).reduce((sum, pattern) => sum + pattern.fan, 0),
    patternIncludesSelfDraw: state.mahjong.patterns.some((pattern) => formData.getAll("patterns").includes(pattern.id) && pattern.selfDrawIncluded),
    flowers: formData.get("flowers"),
    fanAdjustment: 0,
  };
  const result = calculateMahjongHand(payload);
  if (!result.valid) return showToast(result.reason || "請檢查番數設定");
  snapshot();
  state.participants.forEach((player) => {
    player.score = Math.round(result.net[player.id] || 0);
    player.total += Math.round(result.net[player.id] || 0);
  });
  const session = state.mahjongSession;
  const currentWind = MahjongCore.windForCycle(session.startingWind, session.completedCycles);
  const handWindLabel = MahjongCore.handWindLabel({ ...session, nextDealerId: payload.dealerId }, state.participants.map((player) => player.id));
  const cycleNumber = session.completedCycles + 1;
  const handInCycle = session.handsInCycle + 1;
  state.history.push({
    number: state.round,
    handWindLabel,
    cycleNumber,
    handInCycle,
    wind: currentWind,
    scores: state.participants.map((player) => ({ id: player.id, name: player.name, score: player.score })),
    winners: result.winner ? [result.winner.name] : [],
    winnerName: result.winner?.name || "流局",
    winType: payload.winType,
    fan: result.fan,
    multiplier: result.multiplier,
    points: result.points,
    patternNames: state.mahjong.patterns.filter((pattern) => formData.getAll("patterns").includes(pattern.id)).map((pattern) => displayMahjongPatternLabel(pattern, currentWind)),
    note: String(formData.get("note") || "").trim().slice(0, 40),
    net: state.participants.map((player) => ({ id: player.id, name: player.name, amount: Math.round(result.net[player.id] || 0) })),
    mahjong: { ...payload },
    createdAt: new Date().toISOString(),
  });
  const nextDealerId = nextDealerAfterHand(payload.dealerId, payload.winnerId, payload.winType, state.mahjong.drawDealerAction);
  Object.assign(session, MahjongCore.advanceProgress(session, payload.dealerId, state.participants.map((player) => player.id), nextDealerId));
  session.nextDealerId = nextDealerId;
  session.draft = { touched: false, values: {} };
  state.round += 1;
  elements.mahjongEntryForm.reset();
  closeModal("mahjongScoringModal");
  render();
  showToast(payload.winType === "draw" ? `${handWindLabel}已記錄：流局` : `${handWindLabel}已記錄：${result.fan} 番`);
  const marker = session.lengthMode === "custom-hands" ? session.completedHands : session.completedCycles;
  const lastMarker = session.lengthMode === "custom-hands" ? session.lastPromptedHands : session.lastPromptedCycles;
  const completedAsPlanned = MahjongCore.hasCompletedPlan(session) && lastMarker < marker;
  if (completedAsPlanned) {
    if (session.lengthMode === "custom-hands") session.lastPromptedHands = marker;
    else session.lastPromptedCycles = marker;
    saveState();
    openConfirm({
      title: `已完成預定${session.lengthMode === "custom-hands" ? "局數" : "圈數"}，是否結算？`,
      message: `${mahjongSettlementSummary(false)}\n\n你可以結算，或者繼續記錄之後的牌局。`,
      cancelText: "繼續玩",
      acceptText: "立即結算",
      icon: "✓",
      cancelAction: () => saveState(),
      action: () => settleMahjongGame(false),
    });
  }
}

function renderChooser() {
  if (!state || state.kind !== "chooser") return;
  elements.touchPoints.replaceChildren();
  [...chooserTouches.values()].forEach((touch) => {
    const point = document.createElement("span");
    point.className = `touch-point${state.chooser?.resultFingerNumber === touch.fingerNumber ? " is-selected" : ""}`;
    point.style.left = `${touch.x}%`;
    point.style.top = `${touch.y}%`;
    point.textContent = state.chooser?.resultFingerNumber === touch.fingerNumber ? t("首家", "FIRST") : "☝️";
    elements.touchPoints.appendChild(point);
  });

  const result = state.chooser?.resultName;
  const resultFingerStillDown = [...chooserTouches.values()].some((touch) => touch.fingerNumber === state.chooser?.resultFingerNumber);
  if (result && !resultFingerStillDown) {
    const selectedPoint = document.createElement("span");
    selectedPoint.className = "touch-point is-selected";
    selectedPoint.style.left = `${state.chooser.resultX}%`;
    selectedPoint.style.top = `${state.chooser.resultY}%`;
    selectedPoint.textContent = t("首家", "FIRST");
    elements.touchPoints.appendChild(selectedPoint);
  }
  elements.chooserResult.hidden = !result;
  elements.chooserHomeButton.hidden = !result;
  if (result) elements.chooserResult.textContent = t(`✦ 今次首家：手指 ${state.chooser.resultFingerNumber}`, `✦ First player: finger ${state.chooser.resultFingerNumber}`);
  if (chooserCountdown > 0) {
    elements.chooserStatus.textContent = `${chooserCountdown}…`;
  } else if (result) {
    elements.chooserStatus.textContent = t("抽籤完成", "Done");
  } else {
    elements.chooserStatus.textContent = chooserTouches.size ? t(`已按住 ${chooserTouches.size} 隻手指`, `${chooserTouches.size} fingers touching`) : t("等大家喺任何位置按住", "Waiting for everyone to touch");
  }
}

function bigTwoMultiplier(cards) {
  return BigTwoCore.multiplierForCards(cards);
}

function bigTwoLevel(cards) {
  const remaining = Math.max(0, Math.min(13, Math.floor(Number(cards) || 0)));
  if (remaining >= 13) return t("三炒", "Triple penalty");
  if (remaining >= 10) return t("雙炒", "Double penalty");
  if (remaining >= 8) return t("起炒", "Penalty");
  return t("正常", "Normal");
}

function readBigTwoRound() {
  const winnerId = elements.bigTwoWinner.value;
  const penalties = {};
  let valid = Boolean(state.participants.some((player) => player.id === winnerId));
  state.participants.forEach((player) => {
    if (player.id === winnerId) {
      penalties[player.id] = { cards: 0, multiplier: 1, points: 0 };
      return;
    }
    const input = $(`[data-bigtwo-player-id="${CSS.escape(player.id)}"]`, elements.bigTwoRemainingList);
    const cards = Number(input?.value);
    if (!Number.isInteger(cards) || cards < 1 || cards > 13) valid = false;
    const cleanCards = Math.max(0, Math.min(13, Math.floor(cards || 0)));
    const multiplier = bigTwoMultiplier(cleanCards);
    penalties[player.id] = { cards: cleanCards, multiplier, points: cleanCards * multiplier };
  });
  return { valid, winnerId, penalties };
}

function updateBigTwoPreview() {
  if (state?.kind !== "bigtwo") return;
  const round = readBigTwoRound();
  if (!round.valid) {
    elements.bigTwoPreview.textContent = t("每位輸家請輸入 1 至 13 張剩牌。", "Enter 1–13 remaining cards for each losing player.");
    elements.bigTwoPreview.classList.add("is-invalid");
    return;
  }
  elements.bigTwoPreview.classList.remove("is-invalid");
  const lines = state.participants.filter((player) => player.id !== round.winnerId).map((player) => {
    const penalty = round.penalties[player.id];
    return `${player.name} ${penalty.cards}${t("張", " cards")}・${bigTwoLevel(penalty.cards)} ×${penalty.multiplier}＝-${penalty.points}`;
  });
  const winner = state.participants.find((player) => player.id === round.winnerId);
  const gain = Object.values(round.penalties).reduce((sum, entry) => sum + entry.points, 0);
  elements.bigTwoPreview.textContent = `${lines.join("｜")}｜${winner?.name || ""} +${gain}`;
}

function renderBigTwoRoundForm(winnerId = "") {
  const previous = Object.fromEntries($$("[data-bigtwo-player-id]", elements.bigTwoRemainingList).map((input) => [input.dataset.bigtwoPlayerId, input.value]));
  const currentWinner = winnerId || elements.bigTwoWinner.value || state.participants[0]?.id;
  elements.bigTwoWinner.replaceChildren();
  state.participants.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.id;
    option.textContent = player.name;
    elements.bigTwoWinner.appendChild(option);
  });
  if (state.participants.some((player) => player.id === currentWinner)) elements.bigTwoWinner.value = currentWinner;
  elements.bigTwoRemainingList.replaceChildren();
  state.participants.forEach((player) => {
    if (player.id === elements.bigTwoWinner.value) return;
    const row = document.createElement("label");
    row.className = "big-two-remaining-row";
    const name = document.createElement("strong");
    name.textContent = player.name;
    const input = document.createElement("input");
    input.className = "text-input";
    input.type = "number";
    input.min = "1";
    input.max = "13";
    input.inputMode = "numeric";
    input.dataset.bigtwoPlayerId = player.id;
    input.placeholder = "—";
    input.value = Number(previous[player.id]) >= 1 ? previous[player.id] : "";
    input.autocomplete = "off";
    const suffix = document.createElement("span");
    suffix.textContent = t("剩牌", "cards left");
    row.append(name, input, suffix);
    elements.bigTwoRemainingList.appendChild(row);
  });
  updateBigTwoPreview();
}

function openBigTwoRound(winnerId = "") {
  if (state?.kind !== "bigtwo") return;
  renderBigTwoRoundForm(winnerId);
  openModal("bigTwoRoundModal");
}

function renderBigTwo() {
  elements.bigTwoProgress.textContent = t(`第 ${state.round} 鋪`, `Hand ${state.round}`);
}

function recordBigTwoRound(event) {
  event.preventDefault();
  const round = readBigTwoRound();
  if (!round.valid) return showToast(t("請檢查每位輸家嘅剩牌數", "Check each losing player's remaining cards"));
  const winner = state.participants.find((player) => player.id === round.winnerId);
  const gain = Object.values(round.penalties).reduce((sum, entry) => sum + entry.points, 0);
  snapshot();
  state.participants.forEach((player) => {
    const amount = player.id === round.winnerId ? gain : -round.penalties[player.id].points;
    player.score = amount;
    player.total += amount;
  });
  state.history.push({
    number: state.round,
    scores: state.participants.map((player) => ({ id: player.id, name: player.name, score: player.score })),
    winners: [winner.name],
    winnerName: winner.name,
    remaining: state.participants.map((player) => ({ id: player.id, name: player.name, ...(round.penalties[player.id] || { cards: 0, multiplier: 1, points: 0 }) })),
    createdAt: new Date().toISOString(),
  });
  state.round += 1;
  closeModal("bigTwoRoundModal");
  render();
  showToast(t("今鋪鋤大D分數已記錄", "Big Two hand saved"));
}

function cancelChooserCountdown() {
  if (chooserCountdownTimer) window.clearInterval(chooserCountdownTimer);
  chooserCountdownTimer = null;
  chooserCountdown = 0;
}

function randomIndex(max) {
  if (max <= 1) return 0;
  const random = new Uint32Array(1);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return random[0] % max;
}

function startChooserCountdown() {
  if (chooserCountdownTimer || state.chooser?.resultName || chooserTouches.size === 0) return;
  chooserCountdown = 3;
  renderChooser();
  chooserCountdownTimer = window.setInterval(() => {
    if (chooserTouches.size === 0) {
      cancelChooserCountdown();
      renderChooser();
      return;
    }
    chooserCountdown -= 1;
    if (chooserCountdown > 0) {
      renderChooser();
      return;
    }
    cancelChooserCountdown();
    const activeTouches = [...chooserTouches.values()];
    const selected = activeTouches[randomIndex(activeTouches.length)];
    if (!selected) return;
    state.chooser = {
      resultId: "",
      resultName: `手指 ${selected.fingerNumber}`,
      resultFingerNumber: selected.fingerNumber,
      resultX: selected.x,
      resultY: selected.y,
      drawnAt: new Date().toISOString(),
    };
    renderChooser();
    saveState();
    showToast(`手指 ${selected.fingerNumber} 做首家`);
  }, 1000);
}

function resetChooser() {
  cancelChooserCountdown();
  chooserTouches.clear();
  nextFingerNumber = 1;
  state.chooser = { resultId: "", resultName: "", resultFingerNumber: 0, resultX: 0, resultY: 0, drawnAt: null };
  renderChooser();
  saveState();
}

function changeScore(id, amount, isTotal = false) {
  if (hasSportRuleEngine()) {
    if (isTotal) return;
    if (amount > 0) applySportPoint(state.participants.findIndex((entry) => entry.id === id));
    else undoLastSportPoint();
    return;
  }
  const player = state.participants.find((entry) => entry.id === id);
  if (!player) return;
  const key = isTotal ? "total" : "score";
  const next = state.kind === "mahjong" ? player[key] + amount : Math.max(0, player[key] + amount);
  if (next === player[key]) return;
  snapshot();
  player[key] = next;
  render();

  const card = $(`.score-card[data-id="${CSS.escape(id)}"]`);
  const target = isTotal ? $(".total-score strong", card) : $(".score-number", card);
  target.classList.remove("bump");
  requestAnimationFrame(() => target.classList.add("bump"));
}

function winnerNames() {
  const scores = state.participants.map((player) => player.score);
  const target = state.winnerRule === "lowest" ? Math.min(...scores) : Math.max(...scores);
  return state.participants.filter((player) => player.score === target);
}

function finishRound() {
  if (state.participants.every((player) => player.score === 0)) {
    showToast("這一局仲未有分數");
    return;
  }

  const winners = winnerNames();
  const names = winners.map((player) => player.name);
  const scoreLine = state.participants.map((player) => `${player.name} ${player.score}`).join("・");
  openConfirm({
    title: `完成第 ${state.round} 局？`,
    message: `${scoreLine}\n勝方：${names.join("、")}`,
    acceptText: "完成並開新局",
    icon: "✓",
    action: () => {
      snapshot();
      state.history.push({
        number: state.round,
        scores: state.participants.map((player) => ({ id: player.id, name: player.name, score: player.score })),
        winners: names,
        createdAt: new Date().toISOString(),
      });

      if (state.totalMode === "winner") winners.forEach((player) => { player.total += 1; });
      if (state.totalMode === "cumulative") state.participants.forEach((player) => { player.total += player.score; });
      state.participants.forEach((player) => { player.score = 0; });
      state.round += 1;
      render();
      showToast(`第 ${state.round - 1} 局已記錄`);
    },
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function updateConnectionStatus() {
  const isOffline = !navigator.onLine;
  elements.connectionBadge.classList.toggle("is-offline", isOffline);
  elements.connectionLabel.textContent = isOffline ? t("離線模式", "Offline") : t("離線可用", "Works offline");
}

async function registerOfflineSupport() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let knownController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const controller = navigator.serviceWorker.controller;
    if (!knownController) {
      knownController = controller;
      return;
    }
    if (!controller || controller === knownController) return;
    knownController = controller;
    waitingForServiceWorkerUpdate = true;
    if (!isHomeVisible || $(".modal-backdrop.is-open")) {
      showToast("新版已下載；完成目前活動後返回主頁，便會自動更新");
      return;
    }
    reloadForServiceWorkerUpdateIfSafe();
  });

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    if (navigator.onLine) registration.update().catch((error) => console.warn("Offline app update check failed.", error));
  } catch (error) {
    console.warn("Offline support could not be enabled.", error);
  }
}

function lockPageScroll() {
  if (document.body.classList.contains("modal-open")) return;
  lockedScrollPosition = window.scrollY;
  document.body.style.top = `-${lockedScrollPosition}px`;
  document.body.classList.add("modal-open");
}

function unlockPageScroll() {
  if (!document.body.classList.contains("modal-open")) return;
  document.body.classList.remove("modal-open");
  document.body.style.top = "";
  window.scrollTo(0, lockedScrollPosition);
}

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  lockPageScroll();
  modal.scrollTop = 0;
  setTimeout(() => $("input, button:not(.modal-close)", modal)?.focus(), 30);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!$(".modal-backdrop.is-open")) unlockPageScroll();
}

function openConfirm({ title, message, acceptText = "確定", cancelText = "取消", icon = "?", action, cancelAction }) {
  $("#confirmTitle").textContent = translateKnown(title);
  $("#confirmMessage").textContent = message;
  $("#confirmAccept").textContent = translateKnown(acceptText);
  $("#confirmCancel").textContent = translateKnown(cancelText);
  $("#confirmIcon").textContent = icon;
  pendingConfirmAction = action;
  pendingCancelAction = cancelAction || null;
  openModal("confirmModal");
}

function openSettings() {
  $("#settingsName").value = state.title;
  const totalModeInput = $(`input[name="totalMode"][value="${state.totalMode}"]`, $("#settingsForm"));
  const winnerRuleInput = $(`input[name="winnerRule"][value="${state.winnerRule}"]`, $("#settingsForm"));
  if (totalModeInput) totalModeInput.checked = true;
  if (winnerRuleInput) winnerRuleInput.checked = true;
  settingsParticipantsDraft = state.participants.map((player) => ({ ...player }));
  const rules = state.mahjong || defaultMahjongRules();
  $("#mahjongSettingsFields").open = false;
  $("#settingsMahjongQuickFields").hidden = state.kind !== "mahjong";
  const session = state.mahjongSession || newMahjongSession();
  const lengthSelect = $("#settingsMahjongLengthMode");
  let legacyLengthOption = $("option[value='legacy-cycles']", lengthSelect);
  if (session.lengthMode === "legacy-cycles" && !legacyLengthOption) {
    legacyLengthOption = document.createElement("option");
    legacyLengthOption.value = "legacy-cycles";
    legacyLengthOption.textContent = "沿用舊設定";
    lengthSelect.appendChild(legacyLengthOption);
  } else if (session.lengthMode !== "legacy-cycles") {
    legacyLengthOption?.remove();
  }
  const ruleFields = {
    mahjongPrevailingWind: rules.prevailingWind,
    mahjongMinFan: rules.minimumFan,
    mahjongBasePoints: rules.basePoints,
    mahjongFanStep: rules.fanStep,
    mahjongMaxFan: rules.maxFan,
    mahjongMaxPoints: rules.maxPoints,
    mahjongSelfDrawFan: rules.selfDrawFan,
    mahjongFlowerFan: rules.flowerFan,
    mahjongDealerWinMultiplier: rules.dealerWinMultiplier,
    mahjongDealerLoseMultiplier: rules.dealerLoseMultiplier,
    mahjongSelfDrawMultiplier: rules.selfDrawMultiplier,
    mahjongDiscardMultiplier: rules.discardMultiplier,
    mahjongDrawDealerAction: rules.drawDealerAction,
    mahjongLengthMode: session.lengthMode,
    mahjongCustomHands: session.plannedHands,
  };
  Object.entries(ruleFields).forEach(([name, value]) => { $(`[name="${name}"]`, $("#settingsForm")).value = value; });
  setMahjongScoringControls($("#settingsForm"), rules.scoringMode);
  $("[name='mahjongRonPaymentMode']", $("#settingsForm")).value = rules.ronPaymentMode;
  renderParticipantEditor();
  renderMahjongPatternEditor();
  updateSettingsModeFields();
  updateMahjongSettingsPreview();
  openModal("settingsModal");
}

function updateSettingsModeFields() {
  const special = state?.kind === "mahjong" || state?.kind === "chooser" || state?.kind === "bigtwo" || hasSportRuleEngine();
  $("#standardSettingsFields").hidden = special;
  $("#winnerRuleFields").hidden = special;
  $("#settingsMahjongQuickFields").hidden = state?.kind !== "mahjong";
  $("#mahjongSettingsFields").hidden = state?.kind !== "mahjong";
  $("#addParticipantButton").hidden = state?.kind === "mahjong" || state?.kind === "bigtwo" || hasSportRuleEngine();
}

function isMahjongEarly(session) {
  const hasTarget = session?.lengthMode === "custom-hands"
    ? Number(session.plannedHands) > 0
    : Number(session?.plannedCycles) > 0;
  return hasTarget && !MahjongCore.hasCompletedPlan(session);
}

function applyMahjongLengthSelection(session, formData) {
  const mode = formData.get("mahjongLengthMode") || "east";
  if (mode === "legacy-cycles") {
    session.lengthMode = "legacy-cycles";
    return;
  }
  session.lengthMode = mode;
  if (mode === "east") {
    session.plannedCycles = 1;
    session.plannedHands = 0;
  } else if (mode === "half") {
    session.plannedCycles = 2;
    session.plannedHands = 0;
  } else {
    session.plannedCycles = 0;
    session.plannedHands = Math.min(999, Math.max(1, Math.floor(Number(formData.get("mahjongCustomHands")) || 16)));
  }
}

function mahjongPlanLabel(session) {
  if (session?.lengthMode === "custom-hands") return `原訂 ${session.plannedHands} 局`;
  if (session?.lengthMode === "east") return "原訂東圈";
  if (session?.lengthMode === "half") return "原訂半莊";
  return session?.plannedCycles > 0 ? `原訂 ${session.plannedCycles} 圈` : "不限局數";
}

function renderMahjongPatternEditor(editor = elements.mahjongPatternEditor, patterns = state?.mahjong?.patterns || []) {
  if (!editor) return;
  editor.replaceChildren();
  patterns.forEach((pattern) => {
    const row = document.createElement("div");
    row.className = "mahjong-pattern-setting-row";
    row.dataset.id = pattern.id;
    const enabledLabel = document.createElement("label");
    enabledLabel.className = "checkbox-line pattern-enabled";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.name = `patternEnabled-${pattern.id}`;
    enabled.checked = pattern.enabled;
    enabled.setAttribute("aria-label", `啟用${pattern.label}`);
    enabledLabel.append(enabled);
    const labelInput = document.createElement("input");
    labelInput.className = "text-input pattern-label-input";
    labelInput.type = "text";
    labelInput.name = `patternLabel-${pattern.id}`;
    labelInput.maxLength = 24;
    labelInput.value = pattern.label;
    labelInput.setAttribute("aria-label", `${pattern.label}名稱`);
    const fanInput = document.createElement("input");
    fanInput.className = "text-input pattern-fan-input";
    fanInput.type = "number";
    fanInput.name = `patternFan-${pattern.id}`;
    fanInput.min = "0";
    fanInput.max = "99";
    fanInput.inputMode = "numeric";
    fanInput.value = pattern.fan;
    fanInput.setAttribute("aria-label", `${pattern.label}番數`);
    const fanText = document.createElement("span");
    fanText.textContent = "番";
    row.append(enabledLabel, labelInput, fanInput, fanText);
    editor.appendChild(row);
  });
}

function renderParticipantEditor() {
  const editor = $("#participantEditor");
  editor.replaceChildren();
  settingsParticipantsDraft.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "participant-row";
    row.dataset.id = player.id;

    const dot = document.createElement("span");
    dot.className = "color-dot";
    dot.style.setProperty("--dot-color", player.color);
    if (state?.kind === "mahjong") {
      const seatWind = MahjongCore.WINDS.includes(player.seatWind) ? player.seatWind : MahjongCore.WINDS[index];
      dot.classList.add("seat-wind-dot");
      dot.textContent = MahjongCore.WIND_SHORT_NAMES[seatWind] || "東";
    }

    const input = document.createElement("input");
    input.className = "text-input participant-name-input";
    input.type = "text";
    input.maxLength = 18;
    input.value = player.name;
    input.setAttribute("aria-label", state?.kind === "mahjong" ? `${dot.textContent}位玩家名稱` : `參加者 ${index + 1} 名稱`);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-participant";
    remove.textContent = "×";
    const minimumParticipants = state?.kind === "mahjong" || state?.kind === "bigtwo" ? 4 : 2;
    remove.disabled = settingsParticipantsDraft.length <= minimumParticipants;
    remove.hidden = hasSportRuleEngine();
    remove.setAttribute("aria-label", `移除 ${player.name}`);

    row.append(dot, input, remove);
    editor.appendChild(row);
  });

  $("#addParticipantButton").hidden = state?.kind === "mahjong" || state?.kind === "bigtwo" || hasSportRuleEngine();
  $("#addParticipantButton").disabled = state?.kind === "mahjong" || state?.kind === "bigtwo" || hasSportRuleEngine() || settingsParticipantsDraft.length >= 8;
}

function setupTarget(selectId, customId) {
  const selected = $(`#${selectId}`).value;
  const raw = selected === "custom" ? $(`#${customId}`).value : selected;
  return Math.min(999, Math.max(1, Math.round(Number(raw) || 1)));
}

function sportsConfigFromForm(formData) {
  const preset = String(formData.get("volleyballPreset") || "standard");
  if (preset === "standard") return SportsRuleEngine.volleyballPreset("standard");
  if (preset === "single") {
    const targetScore = setupTarget("sportsSingleTarget", "sportsSingleCustomTarget");
    return SportsRuleEngine.sanitizeConfig({
      ...SportsRuleEngine.volleyballPreset("single"),
      targetScore,
      decidingGameTargetScore: targetScore,
      winBy: formData.get("sportsSingleWinBy"),
    });
  }
  const targetScore = setupTarget("sportsCustomTarget", "sportsCustomTargetValue");
  const useDifferentDecidingGame = formData.get("sportsUseDecider") === "on" && formData.get("sportsCustomFormat") !== "single";
  return SportsRuleEngine.sanitizeConfig({
    ...SportsRuleEngine.volleyballPreset("custom"),
    matchFormat: formData.get("sportsCustomFormat"),
    targetScore,
    winBy: formData.get("sportsCustomWinBy"),
    maxScore: formData.get("sportsCustomMaxScore"),
    useDifferentDecidingGame,
    decidingGameTargetScore: useDifferentDecidingGame ? formData.get("sportsDeciderTarget") : targetScore,
  });
}

function updateSportsSetupFields() {
  const setupForm = $("#setupForm");
  const preset = $("input[name='volleyballPreset']:checked", setupForm)?.value || "standard";
  $("#sportsSingleFields").hidden = preset !== "single";
  $("#sportsCustomFields").hidden = preset !== "custom";
  $("#sportsSingleCustomTarget").hidden = $("#sportsSingleTarget").value !== "custom";
  $("#sportsCustomTargetValue").hidden = $("#sportsCustomTarget").value !== "custom";
  const customFormat = $("#sportsCustomFormat").value;
  const canUseDecider = customFormat !== "single";
  $("#sportsUseDecider").closest("label").hidden = !canUseDecider;
  $("#sportsDeciderTargetField").hidden = !canUseDecider || !$("#sportsUseDecider").checked;

  const config = sportsConfigFromForm(new FormData(setupForm));
  const format = config.matchFormat === "single" ? t("一局定勝負", "Single Game") : t(`${config.numberOfGames}局${config.gamesToWin}勝`, `Best of ${config.numberOfGames}`);
  const winRule = config.winBy > 1 ? t(`領先${config.winBy}分`, `win by ${config.winBy}`) : t("先到即完", "first to target wins");
  const cap = config.maxScore > 0 ? t(`最高${config.maxScore}分`, `cap ${config.maxScore}`) : t("不設上限", "no score cap");
  const decider = config.useDifferentDecidingGame ? t(`・決勝局${config.decidingGameTargetScore}分`, ` · deciding game ${config.decidingGameTargetScore}`) : "";
  elements.sportsSetupPreview.textContent = t(
    `目前玩法：排球・${format}・普通局${config.targetScore}分${decider}・${winRule}・${cap}`,
    `Current rules: Volleyball · ${format} · ${config.targetScore} points${decider} · ${winRule} · ${cap}`,
  );
}

function updateSetupFromPreset() {
  const preset = $("input[name='preset']:checked", $("#setupForm")).value;
  const isMahjong = preset === "mahjong";
  const isBigTwo = preset === "bigtwo";
  $("#setupTeamNamesRow").hidden = preset !== "sports";
  $("#setupMahjongPlayers").hidden = !isMahjong;
  $("#setupBigTwoPlayers").hidden = !isBigTwo;
  $("#setupTitle").textContent = isMahjong ? t("香港麻雀開局設定", "Hong Kong Mahjong Setup") : isBigTwo ? t("鋤大D 計分設定", "Big Two Setup") : t("今次點樣計？", "What are you scoring?");
  $("#setupDescription").textContent = isMahjong
    ? t("先按東、南、西、北座位入名，再揀起糊番數、圈數同最高番數。", "Enter the East, South, West and North players, then choose the game rules.")
    : isBigTwo
      ? t("輸入四位玩家名；之後每鋪填剩牌數就會自動計炒牌倍數。", "Enter four players. After each hand, enter cards left and penalties are calculated automatically.")
    : preset === "chooser"
      ? t("唔使輸入玩家名；大家喺畫面任何位置按住，就會抽出首家。", "No names needed. Everyone touches the screen and one finger is chosen.")
      : t("輸入兩隊名稱，再揀一個排球玩法就可以開始。", "Enter both team names, then choose a volleyball format.");
  $("#setupSubmitText").textContent = isMahjong ? t("建立麻雀計分板", "Start Mahjong") : isBigTwo ? t("建立鋤大D計分板", "Start Big Two") : preset === "chooser" ? t("開始抽首家", "Start Choosing") : t("建立計分板", "Create Scoreboard");
  $("#participantCountRow").hidden = preset !== "custom";
  $("#setupMahjongRules").hidden = !isMahjong;
  elements.setupSportsRules.hidden = preset !== "sports";
  const nameInput = $("#setupName");
  if (preset === "sports" && ["今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "今晚開波";
  if (["cards", "mahjong"].includes(preset) && ["今晚開波", "自訂比賽", "首家抽籤", "今晚鋤大D"].includes(nameInput.value)) nameInput.value = "今晚開枱";
  if (preset === "bigtwo" && ["今晚開波", "今晚開枱", "自訂比賽", "首家抽籤"].includes(nameInput.value)) nameInput.value = "今晚鋤大D";
  if (preset === "chooser" && ["今晚開波", "今晚開枱", "自訂比賽"].includes(nameInput.value)) nameInput.value = "首家抽籤";
  $("#countOutput").textContent = customCount;
  if (preset === "custom" && ["今晚開波", "今晚開枱"].includes(nameInput.value)) nameInput.value = "自訂比賽";
  updateSportsSetupFields();
  updateMahjongSetupPreview();
}

function isInteractiveTarget(target) {
  return Boolean(target.closest?.("button, a, input, select, textarea, [role='button']"));
}

function fingerPositionFromEvent(event) {
  return {
    x: Math.min(96, Math.max(4, (event.clientX / window.innerWidth) * 100)),
    y: Math.min(92, Math.max(8, (event.clientY / window.innerHeight) * 100)),
  };
}

document.addEventListener("pointerdown", (event) => {
  if (state?.kind === "chooser") {
    if (state.chooser?.resultName || isInteractiveTarget(event.target) || chooserTouches.has(event.pointerId)) return;
    event.preventDefault();
    chooserTouches.set(event.pointerId, { fingerNumber: nextFingerNumber++, ...fingerPositionFromEvent(event) });
    try { elements.touchArena.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional outside the arena. */ }
    startChooserCountdown();
    renderChooser();
    return;
  }
  if (!event.target.closest(".score-display")) return;
  suppressScoreClick = false;
  activeScoreGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
});

document.addEventListener("pointermove", (event) => {
  const finger = chooserTouches.get(event.pointerId);
  if (state?.kind === "chooser" && finger) {
    event.preventDefault();
    Object.assign(finger, fingerPositionFromEvent(event));
    renderChooser();
    return;
  }
  if (!activeScoreGesture || activeScoreGesture.pointerId !== event.pointerId) return;
  const horizontalDistance = Math.abs(event.clientX - activeScoreGesture.startX);
  const verticalDistance = Math.abs(event.clientY - activeScoreGesture.startY);
  if (horizontalDistance > 10 || verticalDistance > 10) activeScoreGesture.moved = true;
});

document.addEventListener("pointerup", (event) => {
  if (chooserTouches.has(event.pointerId)) {
    chooserTouches.delete(event.pointerId);
    if (!chooserTouches.size && !state?.chooser?.resultName) cancelChooserCountdown();
    renderChooser();
    return;
  }
  if (!activeScoreGesture || activeScoreGesture.pointerId !== event.pointerId) return;
  suppressScoreClick = activeScoreGesture.moved;
  activeScoreGesture = null;
});

document.addEventListener("pointercancel", (event) => {
  if (chooserTouches.delete(event.pointerId)) {
    if (!chooserTouches.size && !state?.chooser?.resultName) cancelChooserCountdown();
    renderChooser();
    return;
  }
  if (activeScoreGesture) {
    activeScoreGesture = null;
    suppressScoreClick = true;
  }
});

document.addEventListener("click", (event) => {
  const mahjongCard = event.target.closest(".mahjong-player-card");
  if (mahjongCard) {
    if (state?.kind === "bigtwo") openBigTwoRound(mahjongCard.dataset.id);
    else openMahjongScoring(mahjongCard.dataset.id);
    return;
  }
  const card = event.target.closest(".score-card");
  if (!card) return;
  const id = card.dataset.id;
  if (event.target.closest(".score-display")) {
    if (suppressScoreClick) {
      event.preventDefault();
      suppressScoreClick = false;
      return;
    }
    changeScore(id, 1);
  }
  if (event.target.closest(".minus-button")) {
    changeScore(id, -1);
  }
  if (event.target.closest(".total-plus")) changeScore(id, 1, true);
  if (event.target.closest(".total-minus")) changeScore(id, -1, true);
  if (event.target.closest(".player-name")) {
    openSettings();
    setTimeout(() => $(`.participant-row[data-id="${CSS.escape(id)}"] input`)?.select(), 80);
  }
});

elements.mahjongEntryForm.addEventListener("submit", recordMahjongHand);
elements.mahjongEntryForm.addEventListener("input", () => { captureMahjongDraft(); updateMahjongPreview(); });
elements.mahjongEntryForm.addEventListener("change", (event) => {
  captureMahjongDraft();
  if (event.target === elements.mahjongWinType) renderMahjongEntry();
  else updateMahjongPreview();
});

elements.mahjongOpenScoringButton.addEventListener("click", () => openMahjongScoring());
elements.mahjongDrawButton.addEventListener("click", () => {
  if (state?.kind !== "mahjong" || state.mahjongSession?.status !== "active" || state.mahjong.drawDealerAction !== "pass") return;
  renderMahjongEntry();
  elements.mahjongWinType.value = "draw";
  elements.mahjongEntryForm.requestSubmit();
});
$("#mahjongEndButton").addEventListener("click", requestMahjongSettlement);
$("#mahjongOpenAnalyzerButton").addEventListener("click", openMahjongAnalyzer);
elements.mahjongAnalyzerMeldType.addEventListener("change", updateMahjongAnalyzerMeldOptions);
$("#mahjongAnalyzerAddMeld").addEventListener("click", () => {
  if (mahjongAnalyzerDraft.melds.length >= 4) return showToast(t("最多只可以加入四組牌", "You can add at most four melds"));
  const selectedType = elements.mahjongAnalyzerMeldType.value;
  const meld = { type: selectedType === "concealed-kong" ? "kong" : selectedType, tile: elements.mahjongAnalyzerMeldTile.value, open: selectedType !== "concealed-kong" };
  const nextCounts = mahjongAnalyzerUsedCounts({ ...mahjongAnalyzerDraft, melds: [...mahjongAnalyzerDraft.melds, meld] });
  if (Object.values(nextCounts).some((count) => count > 4)) return showToast(t("同一款牌最多只可以有四隻", "Only four copies of each tile are available"));
  mahjongAnalyzerDraft.melds.push(meld);
  renderMahjongAnalyzer();
});
elements.mahjongAnalyzerMelds.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-analyzer-meld]");
  if (!button) return;
  mahjongAnalyzerDraft.melds.splice(Number(button.dataset.removeAnalyzerMeld), 1);
  renderMahjongAnalyzer();
});
elements.mahjongAnalyzerPalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-analyzer-tile]");
  if (!button || button.disabled) return;
  mahjongAnalyzerDraft.concealed.push(button.dataset.addAnalyzerTile);
  renderMahjongAnalyzer();
});
elements.mahjongAnalyzerSelected.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-analyzer-tile]");
  if (!button) return;
  const index = mahjongAnalyzerDraft.concealed.lastIndexOf(button.dataset.removeAnalyzerTile);
  if (index >= 0) mahjongAnalyzerDraft.concealed.splice(index, 1);
  renderMahjongAnalyzer();
});
elements.mahjongAnalyzerApply.addEventListener("click", applyMahjongAnalyzerSuggestions);

$$('[data-close="mahjongAnalyzerModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("mahjongAnalyzerModal"));
});

elements.bigTwoOpenRoundButton.addEventListener("click", () => openBigTwoRound());
elements.bigTwoWinner.addEventListener("change", () => renderBigTwoRoundForm(elements.bigTwoWinner.value));
elements.bigTwoRemainingList.addEventListener("input", updateBigTwoPreview);
elements.bigTwoRoundForm.addEventListener("submit", recordBigTwoRound);

$$('[data-close="bigTwoRoundModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("bigTwoRoundModal"));
});

$$('[data-close="mahjongScoringModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("mahjongScoringModal"));
});

$("#setupForm").addEventListener("input", () => {
  updateMahjongSetupPreview();
  updateSportsSetupFields();
});
$("#setupForm").addEventListener("change", (event) => {
  syncMahjongScoringControls(event);
  updateMahjongSetupPreview();
  updateSportsSetupFields();
});
$("#settingsForm").addEventListener("input", updateMahjongSettingsPreview);
$("#settingsForm").addEventListener("change", (event) => {
  syncMahjongScoringControls(event);
  updateMahjongSettingsPreview();
});

$("#mahjongCommonDefaults").addEventListener("click", () => {
  const form = $("#setupForm");
  $("[name='mahjongMinFan']", form).value = "3";
  $("[name='mahjongMaxFan']", form).value = "13";
  $("[name='mahjongBasePoints']", form).value = "1";
  $("[name='mahjongFanStep']", form).value = "2";
  setMahjongScoringControls(form, "hk-table");
  updateMahjongSetupPreview();
  showToast(t("已套用香港常用計分", "Common Hong Kong scoring applied"));
});

$("#settingsMahjongCommonDefaults").addEventListener("click", () => {
  const form = $("#settingsForm");
  $("[name='mahjongMinFan']", form).value = "3";
  $("[name='mahjongMaxFan']", form).value = "13";
  $("[name='mahjongBasePoints']", form).value = "1";
  $("[name='mahjongFanStep']", form).value = "2";
  setMahjongScoringControls(form, "hk-table");
  updateMahjongSettingsPreview();
  showToast(t("已套用香港常用計分", "Common Hong Kong scoring applied"));
});

$("#chooserResetButton").addEventListener("click", resetChooser);
elements.chooserHomeButton.addEventListener("click", showHome);

$("#setupForm").addEventListener("change", (event) => {
  if (event.target.name === "preset") updateSetupFromPreset();
});

$("#countMinus").addEventListener("click", () => {
  customCount = Math.max(2, customCount - 1);
  $("#countOutput").textContent = customCount;
});

$("#countPlus").addEventListener("click", () => {
  customCount = Math.min(8, customCount + 1);
  $("#countOutput").textContent = customCount;
});

$("#setupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state = freshState(form.get("preset"), form.get("title"), customCount, {
    home: form.get("homeTeamName"),
    away: form.get("awayTeamName"),
  });
  if (state.kind === "sports") {
    state.sportConfig = sportsConfigFromForm(form);
    state.sportGame = SportsRuleEngine.createGameState(state.sportConfig);
    syncSportStateToScoreboard();
  } else if (state.kind === "mahjong") {
    state.participants.forEach((player, index) => {
      player.name = String(form.get(`mahjongPlayer${index + 1}`) || "").trim().slice(0, 18) || t(`玩家 ${index + 1}`, `Player ${index + 1}`);
      player.seatWind = MahjongCore.WINDS[index];
    });
    const defaultRules = defaultMahjongRules();
    state.mahjong = sanitizeMahjongRules({
      prevailingWind: form.get("mahjongWind"),
      minimumFan: form.get("mahjongMinFan"),
      basePoints: form.get("mahjongBasePoints"),
      fanStep: form.get("mahjongFanStep"),
      scoringMode: form.get("mahjongScoringPreset") || form.get("mahjongAdvancedScoringMode"),
      maxFan: form.get("mahjongMaxFan"),
      maxPoints: form.get("mahjongMaxPoints"),
      selfDrawFan: form.get("mahjongSelfDrawFan"),
      flowerFan: form.get("mahjongFlowerFan"),
      dealerWinMultiplier: form.get("mahjongDealerWinMultiplier"),
      dealerLoseMultiplier: form.get("mahjongDealerLoseMultiplier"),
      selfDrawMultiplier: form.get("mahjongSelfDrawMultiplier"),
      discardMultiplier: form.get("mahjongDiscardMultiplier"),
      drawDealerAction: form.get("mahjongDrawDealerAction"),
      ronPaymentMode: form.get("mahjongRonPaymentMode"),
      patterns: defaultRules.patterns.map((pattern) => ({
        id: pattern.id,
        label: form.get(`patternLabel-${pattern.id}`),
        fan: form.get(`patternFan-${pattern.id}`),
        enabled: form.get(`patternEnabled-${pattern.id}`) === "on",
      })),
    });
    state.mahjongSession = newMahjongSession({
      lengthMode: form.get("mahjongLengthMode"),
      plannedHands: form.get("mahjongCustomHands"),
      startingWind: state.mahjong.prevailingWind,
    });
    applyMahjongLengthSelection(state.mahjongSession, form);
    state.mahjongSession.nextDealerId = state.participants[0]?.id || "";
  } else if (state.kind === "bigtwo") {
    state.participants.forEach((player, index) => {
      player.name = String(form.get(`bigTwoPlayer${index + 1}`) || "").trim().slice(0, 18) || t(`玩家 ${index + 1}`, `Player ${index + 1}`);
    });
  }
  undoStack = [];
  closeModal("setupModal");
  elements.setupCloseButton.hidden = false;
  showScoreboard();
  showToast(t("計分板準備好喇", "Scoreboard ready"));
});

$("#settingsButton").addEventListener("click", openSettings);
elements.homeButton.addEventListener("click", showHome);
elements.homeNewButton.addEventListener("click", () => beginNewActivity("sports"));
elements.homeContinueButton.addEventListener("click", showScoreboard);
elements.languageToggle.addEventListener("click", () => {
  uiLanguage = uiLanguage === "en" ? "zh" : "en";
  try { localStorage.setItem(LANGUAGE_KEY, uiLanguage); } catch { /* Language still changes for this session. */ }
  applyLanguage();
  updateSetupFromPreset();
  if (state) render();
  updateConnectionStatus();
  if (elements.gameLibraryModal.classList.contains("is-open")) renderGameLibrary();
  if (elements.mahjongScoringModal.classList.contains("is-open")) renderMahjongEntry();
  if (elements.mahjongAnalyzerModal.classList.contains("is-open")) renderMahjongAnalyzer();
  if (elements.bigTwoRoundModal.classList.contains("is-open")) renderBigTwoRoundForm(elements.bigTwoWinner.value);
  if (elements.sportsSummaryModal.classList.contains("is-open")) renderSportsSummary();
});
$("#homeModeGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-home-preset]");
  if (card) openGameLibrary(gameCategory(card.dataset.homePreset));
});

elements.gameLibraryNewButton.addEventListener("click", () => {
  const preset = activeLibraryCategory === "sports" ? "sports" : activeLibraryCategory;
  closeModal("gameLibraryModal");
  beginNewActivity(preset);
});

elements.gameLibraryList.addEventListener("click", (event) => {
  const resume = event.target.closest("[data-game-id]");
  if (resume) {
    if (state) saveState();
    const saved = gameLibrary.find((game) => game.gameId === resume.dataset.gameId);
    if (!saved) return;
    state = sanitizeState(JSON.parse(JSON.stringify(saved)));
    undoStack = [];
    closeModal("gameLibraryModal");
    showScoreboard();
    showToast(state.kind === "mahjong" && state.mahjongSession?.status === "settled" ? t("已打開結算紀錄", "Final scores opened") : t("已繼續之前嘅紀錄", "Saved game resumed"));
    return;
  }
  const remove = event.target.closest("[data-delete-game-id]");
  if (!remove) return;
  const game = gameLibrary.find((entry) => entry.gameId === remove.dataset.deleteGameId);
  if (!game) return;
  const category = activeLibraryCategory;
  closeModal("gameLibraryModal");
  openConfirm({
    title: t("刪除呢個紀錄？", "Delete this game?"),
    message: t(`「${game.title}」刪除後無法復原。`, `“${game.title}” cannot be restored after deletion.`),
    cancelText: t("保留紀錄", "Keep game"),
    acceptText: t("刪除", "Delete"),
    icon: "×",
    cancelAction: () => openGameLibrary(category),
    action: () => {
      gameLibrary = gameLibrary.filter((entry) => entry.gameId !== game.gameId);
      persistGameLibrary();
      if (game.gameId.startsWith("legacy-mahjong-")) {
        const legacyId = game.gameId.slice("legacy-mahjong-".length);
        mahjongArchive = loadMahjongArchive().filter((record) => record.id !== legacyId);
        saveMahjongArchive(mahjongArchive);
      }
      if (state?.gameId === game.gameId) {
        state = null;
        clearStoredState();
      }
      updateHome();
      showToast(t("紀錄已刪除", "Game deleted"));
      openGameLibrary(category);
    },
  });
});

$$('[data-close="gameLibraryModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("gameLibraryModal"));
});
$("#brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});
$("#finishRoundButton").addEventListener("click", finishRound);
elements.sportsResetGameButton.addEventListener("click", () => {
  if (!hasSportRuleEngine()) return;
  openConfirm({
    title: t("重設目前一局？", "Reset current game?"),
    message: t(`第 ${state.sportGame.currentGame} 局會回復 0–0；之前已完成嘅局數會保留。`, `Game ${state.sportGame.currentGame} will return to 0–0. Completed games are kept.`),
    cancelText: t("取消", "Cancel"),
    acceptText: t("重設本局", "Reset game"),
    icon: "↻",
    action: () => {
      snapshot();
      state.sportGame = SportsRuleEngine.resetCurrentGame(state.sportConfig, state.sportGame);
      syncSportStateToScoreboard();
      render();
      showToast(t("本局已重設", "Current game reset"));
    },
  });
});
elements.sportsResetMatchButton.addEventListener("click", () => {
  if (!hasSportRuleEngine()) return;
  openConfirm({
    title: t("重設整場比賽？", "Reset entire match?"),
    message: t("所有比分、已完成局數及賽果都會清除。", "All points, completed games and the result will be cleared."),
    cancelText: t("取消", "Cancel"),
    acceptText: t("重設比賽", "Reset match"),
    icon: "×",
    action: () => {
      snapshot();
      state.sportGame = SportsRuleEngine.resetMatch(state.sportConfig);
      syncSportStateToScoreboard();
      render();
      showToast(t("比賽已重設", "Match reset"));
    },
  });
});
elements.sportsSummaryButton.addEventListener("click", openSportsSummary);
elements.sportsReopenButton.addEventListener("click", () => {
  if (!hasSportRuleEngine() || state.sportGame.status !== "finished") return;
  snapshot();
  state.sportGame = SportsRuleEngine.reopenMatch(state.sportConfig, state.sportGame);
  syncSportStateToScoreboard();
  closeModal("sportsSummaryModal");
  render();
  showToast(t("已重新開啟比賽，最後一分已撤銷", "Match reopened and the last point was undone"));
});
$$('[data-close="sportsSummaryModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("sportsSummaryModal"));
});
elements.timerToggleButton.addEventListener("click", toggleTimer);

$("#clearHistoryButton").addEventListener("click", () => {
  if (!state.history.length) return showToast("暫時未有紀錄");
  openConfirm({
    title: "清除比分紀錄？",
    message: "只會清除每局紀錄；目前分數及總分會保留。",
    acceptText: "清除紀錄",
    icon: "×",
    action: () => {
      snapshot();
      state.history = [];
      render();
      showToast("比分紀錄已清除");
    },
  });
});

elements.undoButton.addEventListener("click", () => {
  if (!undoStack.length) return;
  state = sanitizeState(JSON.parse(undoStack.pop()));
  render();
  showToast("已撤銷上一步");
});

$("#participantEditor").addEventListener("click", (event) => {
  const button = event.target.closest(".remove-participant");
  if (!button || button.disabled) return;
  const row = button.closest(".participant-row");
  settingsParticipantsDraft = settingsParticipantsDraft.filter((player) => player.id !== row.dataset.id);
  renderParticipantEditor();
});

$("#addParticipantButton").addEventListener("click", () => {
  if (hasSportRuleEngine() || settingsParticipantsDraft.length >= 8) return;
  const index = settingsParticipantsDraft.length;
  settingsParticipantsDraft.push(participant(`玩家 ${index + 1}`, index));
  renderParticipantEditor();
  $("#participantEditor .participant-row:last-child input")?.focus();
});

$("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  snapshot();
  const form = new FormData(event.currentTarget);
  state.title = String(form.get("title") || "我的計分板").trim().slice(0, 30) || "我的計分板";
  if (state.kind !== "mahjong" && state.kind !== "chooser" && !hasSportRuleEngine()) {
    state.totalMode = form.get("totalMode");
    state.winnerRule = form.get("winnerRule");
  }
  $$(".participant-row", $("#participantEditor")).forEach((row, index) => {
    const player = settingsParticipantsDraft.find((entry) => entry.id === row.dataset.id);
    if (player) player.name = $("input", row).value.trim().slice(0, 18) || `玩家 ${index + 1}`;
  });
  state.participants = settingsParticipantsDraft.map((player) => ({ ...player }));
  if (state.kind === "mahjong") {
    state.mahjong = sanitizeMahjongRules({
      prevailingWind: form.get("mahjongPrevailingWind"),
      minimumFan: form.get("mahjongMinFan"),
      basePoints: form.get("mahjongBasePoints"),
      fanStep: form.get("mahjongFanStep"),
      scoringMode: form.get("mahjongScoringPreset") || form.get("mahjongAdvancedScoringMode"),
      maxFan: form.get("mahjongMaxFan"),
      maxPoints: form.get("mahjongMaxPoints"),
      selfDrawFan: form.get("mahjongSelfDrawFan"),
      flowerFan: form.get("mahjongFlowerFan"),
      dealerWinMultiplier: form.get("mahjongDealerWinMultiplier"),
      dealerLoseMultiplier: form.get("mahjongDealerLoseMultiplier"),
      selfDrawMultiplier: form.get("mahjongSelfDrawMultiplier"),
      discardMultiplier: form.get("mahjongDiscardMultiplier"),
      drawDealerAction: form.get("mahjongDrawDealerAction"),
      ronPaymentMode: form.get("mahjongRonPaymentMode"),
      patterns: state.mahjong.patterns.map((pattern) => ({
        id: pattern.id,
        label: form.get(`patternLabel-${pattern.id}`),
        fan: form.get(`patternFan-${pattern.id}`),
        enabled: form.get(`patternEnabled-${pattern.id}`) === "on",
      })),
    });
    state.mahjongSession.startingWind = state.mahjong.prevailingWind;
    applyMahjongLengthSelection(state.mahjongSession, form);
  } else if (state.kind !== "chooser" && state.kind !== "bigtwo") {
    state.kind = state.participants.length === 2 ? state.kind : "custom";
  }
  closeModal("settingsModal");
  render();
  showToast(t("設定已儲存", "Settings saved"));
});

$("#newScoreboardButton").addEventListener("click", () => {
  closeModal("settingsModal");
  beginNewActivity("sports");
});

$("#confirmCancel").addEventListener("click", () => {
  const action = pendingCancelAction;
  pendingConfirmAction = null;
  pendingCancelAction = null;
  closeModal("confirmModal");
  action?.();
});

$("#confirmAccept").addEventListener("click", () => {
  const action = pendingConfirmAction;
  pendingConfirmAction = null;
  pendingCancelAction = null;
  closeModal("confirmModal");
  action?.();
});

elements.mahjongArchiveList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-record-id]");
  if (button) viewArchivedMahjongRecord(button.dataset.recordId);
});

$$('[data-close="mahjongRecordModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("mahjongRecordModal"));
});

$("#setupCloseButton").addEventListener("click", () => {
  closeModal("setupModal");
});

$$('[data-close="settingsModal"]').forEach((button) => {
  button.addEventListener("click", () => closeModal("settingsModal"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (elements.confirmModal.classList.contains("is-open")) {
      const action = pendingCancelAction;
      pendingConfirmAction = null;
      pendingCancelAction = null;
      closeModal("confirmModal");
      action?.();
    } else if (elements.mahjongAnalyzerModal.classList.contains("is-open")) closeModal("mahjongAnalyzerModal");
    else if (elements.settingsModal.classList.contains("is-open")) closeModal("settingsModal");
    else if (elements.mahjongScoringModal.classList.contains("is-open")) closeModal("mahjongScoringModal");
    else if (elements.bigTwoRoundModal.classList.contains("is-open")) closeModal("bigTwoRoundModal");
    else if (elements.sportsSummaryModal.classList.contains("is-open")) closeModal("sportsSummaryModal");
    else if (elements.gameLibraryModal.classList.contains("is-open")) closeModal("gameLibraryModal");
    else if (elements.setupModal.classList.contains("is-open")) closeModal("setupModal");
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !$(".modal-backdrop.is-open")) {
    event.preventDefault();
    elements.undoButton.click();
  }
});

window.addEventListener("online", () => {
  updateConnectionStatus();
  showToast(t("已重新連線", "Back online"));
});

window.addEventListener("offline", () => {
  updateConnectionStatus();
  showToast(t("已進入離線模式，計分仍可使用", "Offline mode: scoring still works"));
});

prepareStaticTranslations();
applyLanguage();
state = loadState();
migrateLegacyRecords();
if (state) {
  saveState();
  elements.setupModal.classList.remove("is-open");
  elements.setupModal.setAttribute("aria-hidden", "true");
  elements.setupCloseButton.hidden = false;
  setHomeVisible(true);
} else {
  elements.setupCloseButton.hidden = false;
  resetSetupForm("sports");
  setHomeVisible(true);
}

window.matchMedia("(orientation: landscape)").addEventListener?.("change", () => {
  if (state) render();
});
window.matchMedia("(orientation: portrait) and (max-width: 850px)").addEventListener?.("change", () => {
  if (state) render();
});

timerTicker = window.setInterval(() => {
  if (state?.timer?.running) updateTimerDisplay();
}, 250);

updateConnectionStatus();
registerOfflineSupport();
