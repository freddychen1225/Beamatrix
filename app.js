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
const STEP_DURATION = 105;

let currentLevelIndex = 0;
let state = null;
let isTransitioning = false;
let isAnimating = false;
let animationFrameId = null;

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
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  isAnimating = false;

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
    playerRender: { x: start.x, y: start.y },
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

function createPlayerOrb(dir, offsetX = 0, offsetY = 0) {
  const wrap = document.createElement("div");
  wrap.className = `player dir-${dir}`;
  wrap.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

  const orb = document.createElement("div");
  orb.className = "orb";

  const trail = document.createElement("div");
  trail.className = "orb-trail";

  const core = document.createElement("div");
  core.className = "orb-core";

  orb.appendChild(trail);
  orb.appendChild(core);
  wrap.appendChild(orb);

  return wrap;
}

function getRenderPlacement() {
  const renderPos = state.playerRender || state.player;
  const anchorX = Math.round(renderPos.x);
  const anchorY = Math.round(renderPos.y);

  const cellSize = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--cell-size")
  ) || 68;
  const boardGap = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--board-gap")
  ) || 6;

  const step = cellSize + boardGap;
  const offsetX = (renderPos.x - anchorX) * step;
  const offsetY = (renderPos.y - anchorY) * step;

  return { anchorX, anchorY, offsetX, offsetY };
}

function render() {
  const {
    grid,
    width,
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

  const { anchorX, anchorY, offsetX, offsetY } = getRenderPlacement();
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

      if (anchorX === x && anchorY === y) {
        if (![TILE.WALL, TILE.LEFT, TILE.RIGHT, TILE.EXIT, TILE.STOP].includes(tile)) {
          cell.classList.add("floor");
        }
        cell.appendChild(createPlayerOrb(playerDir, offsetX, offsetY));
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

function buildMovePath(initialDir) {
  let { x, y } = state.player;
  let currentDir = initialDir;
  const steps = [];

  while (true) {
    const { dx, dy } = dirVector(currentDir);
    const nx = x + dx;
    const ny = y + dy;

    if (isBlocked(nx, ny)) break;

    x = nx;
    y = ny;

    const tile = state.grid[y][x];
    let nextDir = currentDir;
    let collectStar = false;
    let stopAfterStep = false;
    let levelClear = false;

    if (tile === TILE.STAR) {
      collectStar = true;
    } else if (tile === TILE.LEFT) {
      nextDir = turnLeft(currentDir);
    } else if (tile === TILE.RIGHT) {
      nextDir = turnRight(currentDir);
    } else if (tile === TILE.STOP) {
      stopAfterStep = true;
    } else if (tile === TILE.EXIT) {
      if (state.starsCollected + steps.filter((s) => s.collectStar).length + (collectStar ? 1 : 0) === state.starsTotal) {
        levelClear = true;
        stopAfterStep = true;
      } else {
        stopAfterStep = true;
      }
    }

    steps.push({
      x,
      y,
      dir: currentDir,
      tile,
      collectStar,
      nextDir,
      stopAfterStep,
      levelClear
    });

    currentDir = nextDir;

    if (stopAfterStep) break;
  }

  return steps;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateMove(steps, fallbackDir) {
  if (!steps.length) {
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

  isAnimating = true;
  state.moves += 1;
  moveLabelEl.textContent = state.moves;

  let stepIndex = 0;
  let segmentStart = null;
  let from = { ...state.player };
  let to = { x: steps[0].x, y: steps[0].y };

  function finishStep(step) {
    state.player = { x: step.x, y: step.y };
    state.playerRender = { x: step.x, y: step.y };
    state.playerDir = step.nextDir || step.dir;

    if (step.collectStar && state.grid[step.y][step.x] === TILE.STAR) {
      state.starsCollected += 1;
      state.grid[step.y][step.x] = TILE.FLOOR;
      starLabelEl.textContent = `${state.starsCollected} / ${state.starsTotal}`;
    }

    state.lastTrail = steps.slice(0, stepIndex + 1).map((s) => ({ x: s.x, y: s.y }));
    state.startGlow = { x: step.x, y: step.y };
  }

  function finishAnimation(finalStep) {
    isAnimating = false;
    animationFrameId = null;

    if (finalStep.levelClear) {
      state.cleared = true;
      render();
      onLevelClear();
      return;
    }

    render();

    if (state.starsCollected < state.starsTotal) {
      setMessage("先收集全部能量星。");
    } else {
      setMessage("能量已滿，前往出口。");
    }
  }

  function tick(timestamp) {
    if (!segmentStart) segmentStart = timestamp;

    const elapsed = timestamp - segmentStart;
    const progress = Math.min(elapsed / STEP_DURATION, 1);
    const eased = easeOutCubic(progress);

    const currentStep = steps[stepIndex];
    state.playerDir = currentStep.dir;
    state.playerRender = {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased
    };

    render();

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(tick);
      return;
    }

    finishStep(currentStep);

    if (currentStep.stopAfterStep || stepIndex >= steps.length - 1) {
      finishAnimation(currentStep);
      return;
    }

    stepIndex += 1;
    segmentStart = timestamp;
    from = { x: steps[stepIndex - 1].x, y: steps[stepIndex - 1].y };
    to = { x: steps[stepIndex].x, y: steps[stepIndex].y };
    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);
}

function move(dir) {
  if (!state || state.cleared || isTransitioning || isAnimating) return;

  const path = buildMovePath(dir);
  animateMove(path, dir);
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
  if (isAnimating) return;
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