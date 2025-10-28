const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("game-over");
const restartBtn = document.getElementById("restart-btn");
const shareBtn = document.getElementById("share-btn");
const scoreEl = document.querySelector(".score");
const highScoreEl = document.querySelector(".high-score");
const hearts = document.querySelectorAll(".lives .heart");
const finalHighScoreEl = document.querySelector(".final-high-score");
const finalCurrentScoreEl = document.querySelector(".final-current-score");
const shareCanvas = document.getElementById("share-canvas");
const shareCtx = shareCanvas.getContext("2d");

const STORAGE_KEY = "offline-breakout-high-score";

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const PADDLE = {
  width: 96,
  height: 16,
  speed: 420,
};

const BALL = {
  radius: 8,
  baseSpeed: 320,
  speedIncrement: 36,
};

const BRICKS = {
  rows: 6,
  cols: 12,
  width: 48,
  height: 20,
  gap: 8,
  topOffset: 72,
  leftOffset: 30,
};

const COLORS = ["#f7d64c", "#f79d2a", "#f76d6d", "#66df81", "#4c74ff", "#62f2ff"];

let highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
let score = 0;
let level = 1;
let lives = 3;
let bricks = [];

const paddle = {
  x: WORLD.width / 2 - PADDLE.width / 2,
  y: WORLD.height - 56,
  width: PADDLE.width,
  height: PADDLE.height,
  velocity: 0,
};

const ball = {
  x: WORLD.width / 2,
  y: paddle.y - BALL.radius,
  radius: BALL.radius,
  speed: BALL.baseSpeed,
  dx: 0,
  dy: 0,
  launched: false,
};

const state = {
  running: false,
  over: false,
  started: false,
};

const keys = {
  left: false,
  right: false,
};

const touchControl = {
  active: false,
  pointerId: null,
};

function init() {
  setupLevel(1);
  updateScoreboard();
  requestAnimationFrame(gameLoop);
}

function setupLevel(startLevel = 1) {
  level = startLevel;
  score = 0;
  lives = 3;
  highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  state.running = false;
  state.over = false;
  state.started = false;
  paddle.x = WORLD.width / 2 - paddle.width / 2;
  paddle.velocity = 0;
  resetBall(true);
  generateBricks();
  overlay.classList.add("overlay--hidden");
  updateLivesDisplay();
  updateScoreboard();
}

function resetBall(resetLaunch = false) {
  paddle.x = WORLD.width / 2 - paddle.width / 2;
  paddle.velocity = 0;
  ball.x = WORLD.width / 2;
  ball.y = paddle.y - ball.radius - 2;
  ball.speed = BALL.baseSpeed + BALL.speedIncrement * (level - 1);
  ball.dx = ball.speed * (Math.random() > 0.5 ? 1 : -1) * 0.6;
  ball.dy = -ball.speed;
  if (resetLaunch) {
    ball.launched = false;
  }
}

function generateBricks() {
  bricks = [];
  for (let row = 0; row < BRICKS.rows; row += 1) {
    for (let col = 0; col < BRICKS.cols; col += 1) {
      bricks.push({
        x: BRICKS.leftOffset + col * (BRICKS.width + BRICKS.gap),
        y: BRICKS.topOffset + row * (BRICKS.height + BRICKS.gap),
        width: BRICKS.width,
        height: BRICKS.height,
        color: COLORS[row % COLORS.length],
        destroyed: false,
        points: 50 + row * 10,
      });
    }
  }
}

function update(delta) {
  if (!state.running) return;

  const deltaSeconds = delta / 1000;

  // Paddle movement
  paddle.velocity = 0;
  if (keys.left) paddle.velocity -= PADDLE.speed;
  if (keys.right) paddle.velocity += PADDLE.speed;
  if (touchControl.active && !keys.left && !keys.right) {
    paddle.velocity = touchControl.active;
  }
  paddle.x += paddle.velocity * deltaSeconds;
  paddle.x = Math.max(12, Math.min(WORLD.width - paddle.width - 12, paddle.x));

  if (!ball.launched) {
    ball.x += paddle.velocity * deltaSeconds;
    ball.x = Math.max(
      paddle.x + ball.radius,
      Math.min(paddle.x + paddle.width - ball.radius, ball.x)
    );
    return;
  }

  ball.x += ball.dx * deltaSeconds;
  ball.y += ball.dy * deltaSeconds;

  // Wall collisions
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.dx *= -1;
  } else if (ball.x + ball.radius > WORLD.width) {
    ball.x = WORLD.width - ball.radius;
    ball.dx *= -1;
  }

  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.dy *= -1;
  }

  // Paddle collision
  if (
    ball.y + ball.radius >= paddle.y &&
    ball.y + ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width &&
    ball.dy > 0
  ) {
    const relativeHit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const bounceAngle = relativeHit * (Math.PI / 3); // max 60 degrees
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    ball.dx = speed * Math.sin(bounceAngle);
    ball.dy = -Math.abs(speed * Math.cos(bounceAngle));
    ball.y = paddle.y - ball.radius - 1;
  }

  // Brick collisions
  for (const brick of bricks) {
    if (brick.destroyed) continue;
    if (
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.width &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.height
    ) {
      brick.destroyed = true;
      score += brick.points;
      updateScoreboard();

      const overlapLeft = ball.x + ball.radius - brick.x;
      const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
      const overlapTop = ball.y + ball.radius - brick.y;
      const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        ball.dx *= -1;
      } else {
        ball.dy *= -1;
      }
      checkLevelCleared();
      break;
    }
  }

  // Missed ball
  if (ball.y - ball.radius > WORLD.height) {
    loseLife();
  }
}

function checkLevelCleared() {
  const remaining = bricks.some((brick) => !brick.destroyed);
  if (!remaining) {
    level += 1;
    ball.speed = BALL.baseSpeed + BALL.speedIncrement * (level - 1);
    generateBricks();
    resetBall(true);
    state.running = false;
    ball.launched = false;
  }
}

function loseLife() {
  lives -= 1;
  updateLivesDisplay();
  if (lives <= 0) {
    return gameOver();
  }
  resetBall(true);
  state.running = false;
}

function updateLivesDisplay() {
  hearts.forEach((heart, index) => {
    heart.style.visibility = index < lives ? "visible" : "hidden";
  });
}

function updateScoreboard() {
  scoreEl.textContent = score.toString().padStart(6, "0");
  highScoreEl.textContent = highScore.toString().padStart(6, "0");
}

function drawBricks() {
  for (const brick of bricks) {
    if (brick.destroyed) continue;
    ctx.fillStyle = brick.color;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
  }
}

function draw() {
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawBricks();

  // paddle
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

  // ball
  ctx.beginPath();
  ctx.fillStyle = "#f79d2a";
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#2c241a";
  ctx.stroke();

  if (!state.started) {
    drawStartPrompt();
  }
}

function drawStartPrompt() {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(140, WORLD.height / 2 - 60, WORLD.width - 280, 120);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.strokeRect(140, WORLD.height / 2 - 60, WORLD.width - 280, 120);

  ctx.fillStyle = "#f0f0f0";
  ctx.textAlign = "center";
  ctx.font = "22px 'Press Start 2P', monospace";
  ctx.fillText("BREAKOUT", WORLD.width / 2, WORLD.height / 2 - 14);
  ctx.font = "12px 'Press Start 2P', monospace";
  ctx.fillStyle = "#bcbcbc";
  ctx.fillText(
    "Press ↑ or tap to launch",
    WORLD.width / 2,
    WORLD.height / 2 + 24
  );
}

let lastTime = performance.now();
function gameLoop(now) {
  const delta = Math.min(now - lastTime, 32);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  if (!state.started) {
    state.started = true;
    ball.launched = false;
  }
  if (!state.running) {
    state.running = true;
    if (!ball.launched) {
      ball.launched = true;
      ball.dy = -Math.abs(ball.speed);
    }
  }
}

function gameOver() {
  state.running = false;
  state.over = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORAGE_KEY, highScore);
  }
  finalHighScoreEl.textContent = highScore.toString().padStart(6, "0");
  finalCurrentScoreEl.textContent = score.toString().padStart(6, "0");
  renderShareCard();
  overlay.classList.remove("overlay--hidden");
  updateScoreboard();
}

function handleKeyDown(event) {
  if (event.code === "ArrowLeft") {
    keys.left = true;
    event.preventDefault();
    if (!state.running || !ball.launched) {
      startGame();
    }
  } else if (event.code === "ArrowRight") {
    keys.right = true;
    event.preventDefault();
    if (!state.running || !ball.launched) {
      startGame();
    }
  } else if (event.code === "Space") {
    state.running = !state.running;
    event.preventDefault();
  } else if (event.code === "ArrowUp") {
    startGame();
    event.preventDefault();
  } else if (event.code === "Enter" && state.over) {
    event.preventDefault();
    setupLevel(1);
  }
}

function handleKeyUp(event) {
  if (event.code === "ArrowLeft") {
    keys.left = false;
  } else if (event.code === "ArrowRight") {
    keys.right = false;
  }
}

function handlePointerDown(event) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
  const rect = canvas.getBoundingClientRect();
  const relativeX = (event.clientX - rect.left) / rect.width;
  touchControl.active = relativeX < 0.5 ? -PADDLE.speed : PADDLE.speed;
  touchControl.pointerId = event.pointerId;
  startGame();
  event.preventDefault();
}

function handlePointerUp(event) {
  if (event.pointerId !== touchControl.pointerId) return;
  touchControl.active = false;
  touchControl.pointerId = null;
  event.preventDefault();
}

function renderShareCard() {
  const width = shareCanvas.width;
  const height = shareCanvas.height;
  shareCtx.fillStyle = "#121212";
  shareCtx.fillRect(0, 0, width, height);

  const gradient = shareCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(60,60,60,0.25)");
  gradient.addColorStop(1, "rgba(18,18,18,0.8)");
  shareCtx.fillStyle = gradient;
  shareCtx.fillRect(14, 14, width - 28, height - 28);

  shareCtx.strokeStyle = "#2d2d2d";
  shareCtx.lineWidth = 4;
  shareCtx.strokeRect(14, 14, width - 28, height - 28);

  shareCtx.fillStyle = "#f2f2f2";
  shareCtx.font = "28px 'Press Start 2P', monospace";
  shareCtx.textAlign = "center";
  shareCtx.fillText("BREAKOUT", width / 2, 92);

  shareCtx.font = "18px 'Press Start 2P', monospace";
  shareCtx.fillStyle = "#9d9d9d";
  shareCtx.fillText(`Score ${score.toString().padStart(6, "0")}`, width / 2, 160);
  shareCtx.fillText(`Best  ${highScore.toString().padStart(6, "0")}`, width / 2, 200);

  shareCtx.font = "12px 'Press Start 2P', monospace";
  shareCtx.fillStyle = "#666666";
  shareCtx.fillText("#OfflineBreakout", width / 2, height - 48);
  shareCtx.fillText("chrome vibes • offline ricochet", width / 2, height - 28);
}

function downloadShareImage() {
  const dataUrl = shareCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `offline-breakout-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

document.addEventListener("keydown", handleKeyDown, { passive: false });
document.addEventListener("keyup", handleKeyUp, { passive: false });
canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
canvas.addEventListener("pointerup", handlePointerUp, { passive: false });
restartBtn.addEventListener("click", () => setupLevel(1));
shareBtn.addEventListener("click", downloadShareImage);

init();
