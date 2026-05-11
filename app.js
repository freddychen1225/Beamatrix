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
    starsRequired: 1,
    grid: [
      [1,1,1,1,1,1],
      [1,7,2,5,2,1],
      [1,2,1,1,2,1],
      [1,2,2,2,6,1],
      [1,1,1,1,1,1]
    ]
  },
  {
    id: 2,
    starsRequired: 1,
    grid: [
      [1,1,1,1,1,1],
      [1,7,2,4,5,1],
      [1,2,1,2,2,1],
      [1,2,2,2,6,1],
      [1,1,1,1,1,1]
    ]
  },
  {
    id: 3,
    starsRequired: 2,
    grid: [
      [1,1,1,1,1,1,1],
      [1,7,2,3,2,5,1],
      [1,2,1,1,2,2,1],
      [1,5,2,8,2,6,1],
      [1,1,1,1,1,1,1]
    ]
  }
];

const boardEl = document.getElementById("board");
const messageEl = document.getElementById("message");
const levelLabelEl = document.getElementById("levelLabel");
const starLabelEl = document.getElementById("starLabel");
const moveLabelEl = document.getElementById("moveLabel");
const restartBtn = document.getElementById("restartBtn");
const moveButtons = document.querySelectorAll(".btn.move");

let currentLevelIndex = 0;
let state = null;

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function findStart(grid) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === TILE.START) {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
}

function countStars(grid) {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === TILE.STAR) count++;
    }
  }
  return count;
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
    starsCollected: 0,
    starsTotal: countStars(grid),
    moves: 0,
    cleared: false
  };

  render();
  setMessage("滑動或按方向鍵開始。");
}

function setMessage(text) {
  messageEl.textContent = text;
}

function render() {
  const { grid, width, player, starsCollected, starsTotal, moves, levelId } = state;

  boardEl.style.gridTemplateColumns = `repeat(${width}, var(--cell-size))`;
  boardEl.innerHTML = "";

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
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

      if (player.x === x && player.y === y) {
        cell.classList.add("player");
        if (![TILE.WALL, TILE.LEFT, TILE.RIGHT, TILE.EXIT, TILE.STOP].includes(tile)) {
          cell.classList.add("floor");
        }
      }

      boardEl.appendChild(cell);
    }
  }

  levelLabelEl.textContent = levelId;
  starLabelEl.textContent = `${starsCollected} / ${starsTotal}`;
  moveLabelEl.textContent = moves;
}

function turnLeft(dir) {
  return { up: "left", left: "down", down: "right", right: "up" }[dir];
}

function turnRight(dir) {
  return { up: "right", right: "down", down: "left", left: "up" }[dir];
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
  if (!state || state.cleared) return;

  let { x, y } = state.player;
  let currentDir = dir;
  let moved = false;

  while (true) {
    const { dx, dy } = dirVector(currentDir);
    const nx = x + dx;
    const ny = y + dy;

    if (isBlocked(nx, ny)) break;

    x = nx;
    y = ny;
    moved = true;

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
        state.moves += 1;
        state.cleared = true;
        render();
        setMessage("過關成功！先做到這裡，下一步再加下一關流程。");
        return;
      } else {
        break;
      }
    }
  }

  if (!moved) {
    setMessage("這個方向無法前進。");
    return;
  }

  state.player = { x, y };
  state.moves += 1;
  render();

  if (state.starsCollected < state.starsTotal) {
    setMessage("先收集全部能量星。");
  } else {
    setMessage("能量已滿，前往出口。");
  }
}

moveButtons.forEach(btn => {
  btn.addEventListener("click", () => move(btn.dataset.dir));
});

restartBtn.addEventListener("click", () => {
  loadLevel(currentLevelIndex);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") move("up");
  if (e.key === "ArrowDown") move("down");
  if (e.key === "ArrowLeft") move("left");
  if (e.key === "ArrowRight") move("right");
});

let touchStartX = 0;
let touchStartY = 0;

boardEl.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

boardEl.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
}, { passive: true });

loadLevel(currentLevelIndex);