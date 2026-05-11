const TILE = {
  EMPTY: 0,
  WALL: 1,
  FLOOR: 2,
  LEFT: 3,
  RIGHT: 4,
  STAR: 5,
  EXIT: 6,
  START: 7,
  STOP: 8
};

const LEVELS = [
  {
    id: 1,
    grid: [
      [1, 1, 1, 1, 1],
      [1, 7, 2, 5, 1],
      [1, 2, 2, 2, 1],
      [1, 2, 2, 6, 1],
      [1, 1, 1, 1, 1]
    ]
  },
  {
    id: 2,
    grid: [
      [1, 1, 1, 1, 1, 1],
      [1, 7, 2, 4, 5, 1],
      [1, 2, 1, 2, 2, 1],
      [1, 2, 2, 2, 6, 1],
      [1, 2, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1]
    ]
  },
  {
    id: 3,
    grid: [
      [1, 1, 1, 1, 1, 1],
      [1, 7, 2, 3, 2, 1],
      [1, 2, 1, 1, 5, 1],
      [1, 2, 8, 2, 2, 1],
      [1, 5, 2, 2, 6, 1],
      [1, 1, 1, 1, 1, 1]
    ]
  }
];

const boardEl = document.getElementById("board");
const messageEl = document.getElementById("message");
const levelLabelEl = document.getElementById("levelLabel");
const starLabelEl = document.getElementById("starLabel");
const moveLabelEl = document.getElementById("moveLabel");
const restartBtn = document.getElementById("restartBtn");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayTextEl = document.getElementById("overlayText");
const overlayBtnEl = document.getElementById("overlayBtn");

const MAX_STAGE_COLS = 6;
const MAX_STAGE_ROWS = 6;

let currentLevelIndex = 0;
let state = null;
let isTransitioning = false;

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function findStart(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] === TILE.START) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

function countStars(grid) {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === TILE.STAR) count += 1;
    }
  }
  return count;
}

function updateBoardScale() {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const boardGap = parseFloat(style.getPropertyValue("--board-gap")) || 6;

  const sidePadding = 26;
  const topUiReserve = 280;

  const availableWidth = Math.max(320, window.innerWidth - sidePadding);
  const availableHeight = Math.max(340, window.innerHeight - topUiReserve);

  const sizeByWidth = (availableWidth - boardGap * (MAX_STAGE_COLS - 1)) / MAX_STAGE_COLS;
  const sizeByHeight = (availableHeight - boardGap * (MAX_STAGE_ROWS - 1)) / MAX_STAGE_ROWS;

  const cellSize = Math.floor(Math.min(sizeByWidth, sizeByHeight, 92));
  const finalCellSize = Math.max(cellSize, 54);
  const stageSize = finalCellSize * MAX_STAGE_COLS + boardGap * (MAX_STAGE_COLS - 1);

  root.style.setProperty("--cell-size", `${finalCellSize}px`);
  root.style.setProperty("--stage-size", `${stageSize}px`);
}

function loadLevel(index) {
  const level = LEVELS[index];
  const grid = cloneGrid(level.grid);
  const start = findStart(grid);

  if (grid[start.y][start.x] === TILE.START) {
    grid[start.y][start.x] = TILE.FLOOR;
  }

  state = {
    levelId: level.id,
    grid,
    width: grid[0].length,
    height: grid.length,
    player: { ...start },
    playerDir: "right",
    starsCollected: 0,
    starsTotal: countStars(grid),
    moves: 0,
    cleared: false,
    lastTrail: [],
    startGlow: { ...start }
  };

  updateBoardScale();
  hideOverlay();
  render();
  setMessage("請在棋盤上滑動開始。");
}

function setMessage(text) {
  messageEl.textContent = text;
}

function createPlayerOrb(dir) {
  const orb = document.createElement("div");
  orb.className = `orb`;

  const trail = document.createElement("div");
  trail.className = "orb-trail";

  const core = document.createElement("div");
  core.className = "orb-core";

  orb.appendChild(trail);
  orb.appendChild(core);

  const wrap = document.createElement("div");
  wrap.className = `player dir-${dir}`;
  wrap.appendChild(orb);

  return wrap;
}

function render() {
  const {
    grid,
    width,
    player,
    playerDir,
    starsCollected,
    starsTotal,
    moves,
    levelId,
    lastTrail,
    startGlow
  } = state;

  boardEl.style.gridTemplateColumns = `repeat(${width}, var(--cell-size))`;
  boardEl.innerHTML = "";

  const lastTrailMap = new Map(lastTrail.map((p, i) => [`${p.x},${p.y}`, i]));

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const tile = grid[y][x];
      const cell = document.createElement("div");
      cell.className = "cell";

      if (tile === TILE.WALL) cell.classList.add("wall");
      if (tile === TILE.FLOOR) cell.classList.add("floor");
      if (tile === TILE.LEFT) cell.classList.add("left");
      if (tile === TILE.RIGHT) cell.classList.add("right");
      if (tile === TILE.STAR) cell.classList.add("floor", "star");
      if (tile === TILE.EXIT) cell.classList.add("exit");
      if (tile === TILE.STOP) cell.classList.add("stop");

      const trailKey = `${x},${y}`;
      if (lastTrailMap.has(trailKey)) {
        cell.classList.add("trail");
        if (lastTrailMap.get(trailKey) === lastTrail.length - 1) {
          cell.classList.add("trail-strong");
        }
      }

      if (startGlow.x === x && startGlow.y === y) {
        cell.classList.add("start-glow");
      }

      if (player.x === x && player.y === y) {
        if (![TILE.WALL, TILE.LEFT, TILE.RIGHT, TILE.EXIT, TILE.STOP].includes(tile)) {
          cell.classList.add("floor");
        }
        cell.appendChild(createPlayerOrb(playerDir));
      }

      boardEl.appendChild(cell);
    }
  }

  levelLabelEl.textContent = levelId;
  starLabelEl.textContent = `${starsCollected} / ${starsTotal}`;
  moveLabelEl.textContent = moves;
}

function turnLeft(dir) {
  return {
    up: "left",
    left: "down",
    down: "right",
    right: "up"
  }[dir];
}

function turnRight(dir) {
  return {
    up: "right",
    right: "down",
    down: "left",
    left: "up"
  }[dir];
}

function dirVector(dir) {
  if (dir === "up") return { dx: 0, dy: -1 };
  if (dir === "down") return { dx: 0, dy: 1 };
  if (dir === "left") return { dx: -1, dy: 0 };
  return { dx: 1, dy: 0 };
}

function inside(x, y) {
  return y >= 0 && y < state.height && x >= 0 && x < state.width;
}

function isBlocked(x, y) {
  if (!inside(x, y)) return true;
  return state.grid[y][x] === TILE.WALL;
}

function move(dir) {
  if (!state || state.cleared || isTransitioning) return;

  let { x, y } = state.player;
  let currentDir = dir;
  let moved = false;
  const traveled = [];

  while (true) {
    const { dx, dy } = dirVector(currentDir);
    const nx = x + dx;
    const ny = y + dy;

    if (isBlocked(nx, ny)) break;

    x = nx;
    y = ny;
    moved = true;
    traveled.push({ x, y });

    const tile = state.grid[y][x];

    if (tile === TILE.STAR) {
      state.starsCollected += 1;
      state.grid[y][x] = TILE.FLOOR;
    } else if (tile === TILE.LEFT) {
      currentDir = turnLeft(currentDir);
    } else if (tile === TILE.RIGHT) {
      currentDir = turnRight(currentDir);
    } else if (tile === TILE.STOP) {
      break;
    } else if (tile === TILE.EXIT) {
      if (state.starsCollected === state.starsTotal) {
        state.player = { x, y };
        state.playerDir = currentDir;
        state.startGlow = { x, y };
        state.lastTrail = traveled;
        state.moves += 1;
        state.cleared = true;
        render();
        onLevelClear();
        return;
      }
      break;
    }
  }

  if (!moved) {
    setMessage("這個方向無法前進。");
    boardEl.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 140, easing: "ease-out" }
    );
    return;
  }

  state.player = { x, y };
  state.playerDir = currentDir;
  state.startGlow = { x, y };
  state.lastTrail = traveled;
  state.moves += 1;
  render();

  if (state.starsCollected < state.starsTotal) {
    setMessage("先收集全部能量星。");
  } else {
    setMessage("能量已滿，前往出口。");
  }
}

function onLevelClear() {
  isTransitioning = true;
  const isLastLevel = currentLevelIndex >= LEVELS.length - 1;

  if (isLastLevel) {
    showOverlay(
      "全部完成",
      `你已完成目前的 ${LEVELS.length} 個測試關卡。`,
      "重新開始",
      () => {
        currentLevelIndex = 0;
        isTransitioning = false;
        loadLevel(currentLevelIndex);
      }
    );
    setMessage("全部關卡完成。");
    return;
  }

  showOverlay(
    "過關成功",
    `第 ${state.levelId} 關完成，共用了 ${state.moves} 步。`,
    "前往下一關",
    () => {
      currentLevelIndex += 1;
      isTransitioning = false;
      loadLevel(currentLevelIndex);
    }
  );

  setMessage("過關成功。");
}

function showOverlay(title, text, buttonText, onClick) {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayBtnEl.textContent = buttonText;
  overlayBtnEl.onclick = onClick;
  overlayEl.classList.remove("hidden");
  overlayEl.setAttribute("aria-hidden", "false");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
  overlayEl.setAttribute("aria-hidden", "true");
}

restartBtn.addEventListener("click", () => {
  loadLevel(currentLevelIndex);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") move("up");
  if (e.key === "ArrowDown") move("down");
  if (e.key === "ArrowLeft") move("left");
  if (e.key === "ArrowRight") move("right");
});

let pointerStartX = 0;
let pointerStartY = 0;
let pointerStartTime = 0;
let isPointerDown = false;

boardEl.addEventListener("pointerdown", (e) => {
  isPointerDown = true;
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;
  pointerStartTime = Date.now();
  boardEl.classList.add("dragging");
});

boardEl.addEventListener("pointerup", (e) => {
  if (!isPointerDown) return;

  isPointerDown = false;
  boardEl.classList.remove("dragging");

  const dx = e.clientX - pointerStartX;
  const dy = e.clientY - pointerStartY;
  const dt = Date.now() - pointerStartTime;

  if (dt > 600) return;
  if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
});

boardEl.addEventListener("pointercancel", () => {
  isPointerDown = false;
  boardEl.classList.remove("dragging");
});

window.addEventListener("resize", () => {
  updateBoardScale();
  if (state) render();
});

loadLevel(currentLevelIndex);