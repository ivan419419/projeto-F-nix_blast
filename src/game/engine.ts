export const COLS = 15;
export const ROWS = 13;
export const TILE = 32;
export const FIXED_DT = 1 / 60;
export const MAX_LEVEL = 25;
export const HI_KEY = "fenix-blast-hi";

export type Phase = "title" | "how" | "playing" | "paused" | "clear" | "over";
export type Dir = "up" | "down" | "left" | "right";
export type Cell = 0 | 1 | 2; // empty, wall, crate
export type PowerKind = "bomb" | "flame" | "speed" | "life";

export type Actor = {
  c: number;
  r: number;
  fromC: number;
  fromR: number;
  toC: number;
  toR: number;
  t: number;
  moving: boolean;
  dir: Dir;
  alive: boolean;
};

export type Bomb = {
  c: number;
  r: number;
  fuse: number;
  range: number;
};

export type Blast = {
  c: number;
  r: number;
  ttl: number;
  max: number;
  kind: "center" | "h" | "v" | "n" | "s" | "e" | "w";
};

export type Pickup = { c: number; r: number; kind: PowerKind; bob: number };
export type Sinkhole = { c: number; r: number; phase: "warning" | "open"; timer: number };
export type FireTrail = { c: number; r: number; ttl: number };
export type FireEvent = {
  phase: "warning" | "active";
  timer: number;
  route: { c: number; r: number }[];
  index: number;
  stepTimer: number;
  trail: FireTrail[];
};

export type GameState = {
  phase: Phase;
  level: number;
  score: number;
  hi: number;
  lives: number;
  grid: Cell[];
  player: Actor;
  bombsMax: number;
  flame: number;
  speed: number;
  iFrames: number;
  enemies: Actor[];
  bombs: Bomb[];
  blasts: Blast[];
  pickups: Pickup[];
  exit: { c: number; r: number; open: boolean } | null;
  exitTarget: { c: number; r: number };
  sinkholes: Sinkhole[];
  sinkholeTimer: number;
  fireTimer: number;
  fire: FireEvent | null;
  hazardSeq: number;
  shake: number;
  flash: number;
  tick: number;
  keys: Set<string>;
  just: Set<string>;
  seed: number;
};

const DIRS: Record<Dir, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

const SPAWN = { c: 1, r: 1 };

const DIR_FROM_KEY: Record<string, Dir> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newRunSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const seed = new Uint32Array(1);
    crypto.getRandomValues(seed);
    return seed[0] || 1;
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
}

function shuffled<T>(items: T[], rng: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function carvePath(grid: Cell[], start: { c: number; r: number }, goal: { c: number; r: number }) {
  const startIndex = idx(start.c, start.r);
  const goalIndex = idx(goal.c, goal.r);
  const previous = new Int32Array(COLS * ROWS).fill(-1);
  const queue = [startIndex];
  previous[startIndex] = startIndex;

  for (let head = 0; head < queue.length && previous[goalIndex] === -1; head++) {
    const current = queue[head]!;
    const c = current % COLS;
    const r = Math.floor(current / COLS);
    for (const [dc, dr] of Object.values(DIRS)) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      const next = idx(nc, nr);
      if (previous[next] !== -1 || grid[next] === 1) continue;
      previous[next] = current;
      queue.push(next);
    }
  }

  if (previous[goalIndex] === -1) return [];
  const path: number[] = [];
  for (let at = goalIndex; at !== startIndex; at = previous[at]!) path.push(at);
  path.push(startIndex);
  return path.reverse();
}

function reachableFloor(grid: Cell[], start: { c: number; r: number }) {
  const reached = new Set<number>();
  const startIndex = idx(start.c, start.r);
  if (grid[startIndex] !== 0) return reached;
  const queue = [startIndex];
  reached.add(startIndex);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    const c = current % COLS;
    const r = Math.floor(current / COLS);
    for (const [dc, dr] of Object.values(DIRS)) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      const next = idx(nc, nr);
      if (grid[next] !== 0 || reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

export function validateLevelConnectivity(s: GameState) {
  const reached = reachableFloor(s.grid, SPAWN);
  return (
    s.grid[idx(s.exitTarget.c, s.exitTarget.r)] === 0 &&
    reached.has(idx(s.exitTarget.c, s.exitTarget.r)) &&
    s.enemies.every((enemy) => reached.has(idx(enemy.c, enemy.r)))
  );
}

export function idx(c: number, r: number) {
  return r * COLS + c;
}

export function inBounds(c: number, r: number) {
  return c >= 0 && r >= 0 && c < COLS && r < ROWS;
}

function loadHi() {
  try {
    const n = Number(localStorage.getItem(HI_KEY) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveHi(n: number) {
  try {
    localStorage.setItem(HI_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function createGame(): GameState {
  const hi = typeof window !== "undefined" ? loadHi() : 0;
  const s: GameState = {
    phase: "title",
    level: 1,
    score: 0,
    hi,
    lives: 3,
    grid: new Array(COLS * ROWS).fill(0) as Cell[],
    player: blankActor(1, 1, "down"),
    bombsMax: 1,
    flame: 1,
    speed: 3.2,
    iFrames: 0,
    enemies: [],
    bombs: [],
    blasts: [],
    pickups: [],
    exit: null,
    exitTarget: { c: COLS - 2, r: ROWS - 2 },
    sinkholes: [],
    sinkholeTimer: 0,
    fireTimer: 0,
    fire: null,
    hazardSeq: 0,
    shake: 0,
    flash: 0,
    tick: 0,
    keys: new Set(),
    just: new Set(),
    seed: 1,
  };
  buildLevel(s, 1);
  s.phase = "title";
  return s;
}

function blankActor(c: number, r: number, dir: Dir): Actor {
  return { c, r, fromC: c, fromR: r, toC: c, toR: r, t: 0, moving: false, dir, alive: true };
}

export function startRun(s: GameState) {
  s.score = 0;
  s.lives = 3;
  s.bombsMax = 1;
  s.flame = 1;
  s.speed = 3.2;
  s.level = 1;
  s.seed = newRunSeed();
  buildLevel(s, 1);
  s.phase = "playing";
}

export function nextLevel(s: GameState) {
  if (s.level >= MAX_LEVEL) {
    s.phase = "over";
    if (s.score > s.hi) {
      s.hi = s.score;
      saveHi(s.hi);
    }
    return;
  }
  s.level += 1;
  buildLevel(s, s.level);
  s.phase = "playing";
}

export function buildLevel(s: GameState, level: number) {
  const levelSeed = (s.seed ^ Math.imul(level, 0x9e3779b1)) >>> 0;
  const terrainRng = mulberry32(levelSeed);
  const placementRng = mulberry32(levelSeed ^ 0xa511e9b3);
  const grid = s.grid;
  grid.fill(0);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const edge = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
      const pillar = c % 2 === 0 && r % 2 === 0;
      if (edge || pillar) grid[idx(c, r)] = 1;
    }
  }

  const density = Math.min(0.54, 0.3 + level * 0.009);
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[idx(c, r)] !== 0) continue;
      if (c + r <= 4) continue; // keep spawn pocket open
      if (terrainRng() < density) grid[idx(c, r)] = 2;
    }
  }

  s.player = blankActor(SPAWN.c, SPAWN.r, "down");
  s.iFrames = 1.6;
  s.bombs = [];
  s.blasts = [];
  s.pickups = [];
  s.exit = null;
  s.sinkholes = [];
  s.fire = null;
  s.hazardSeq = 0;
  s.sinkholeTimer = 4.8 + placementRng() * 2.2;
  s.fireTimer = 13 + placementRng() * 6;
  s.shake = 0;
  s.flash = 0;

  const corners: [number, number][] = [
    [COLS - 2, ROWS - 2],
    [COLS - 2, 1],
    [1, ROWS - 2],
    [COLS - 4, ROWS - 2],
    [COLS - 2, 4],
    [3, ROWS - 2],
    [COLS - 6, 1],
    [1, ROWS - 4],
  ];
  const count = Math.min(corners.length, 2 + level);
  const targets = shuffled(corners, placementRng)
    .slice(0, count)
    .map(([c, r]) => ({ c, r }));
  const enemyIndices = new Set(targets.map(({ c, r }) => idx(c, r)));
  const exitCandidates: { c: number; r: number; distance: number }[] = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[idx(c, r)] === 1 || enemyIndices.has(idx(c, r))) continue;
      exitCandidates.push({ c, r, distance: Math.abs(c - SPAWN.c) + Math.abs(r - SPAWN.r) });
    }
  }
  exitCandidates.sort((a, b) => b.distance - a.distance);
  const farthestChoices = Math.min(8, exitCandidates.length);
  const exitChoice = exitCandidates[Math.floor(placementRng() * farthestChoices)]!;
  s.exitTarget = { c: exitChoice.c, r: exitChoice.r };

  for (const target of [...targets, s.exitTarget]) {
    for (const cell of carvePath(grid, SPAWN, target)) grid[cell] = 0;
  }

  const dirs: Dir[] = ["left", "right", "up", "down"];
  s.enemies = targets.map(({ c, r }, i) => blankActor(c, r, dirs[i % dirs.length]!));
  if (!validateLevelConnectivity(s)) {
    for (const target of [...targets, s.exitTarget]) {
      for (const cell of carvePath(grid, SPAWN, target)) grid[cell] = 0;
    }
  }
}

function occupiedByBomb(s: GameState, c: number, r: number) {
  return s.bombs.some((b) => b.c === c && b.r === r);
}

function walkable(s: GameState, c: number, r: number, ignoreBomb = false) {
  if (!inBounds(c, r)) return false;
  if (s.grid[idx(c, r)] !== 0) return false;
  if (!ignoreBomb && occupiedByBomb(s, c, r)) return false;
  return true;
}

function wantedDir(s: GameState): Dir | null {
  // A/D first so held-strafe wins over forward (controls self-test).
  const order = ["KeyA", "ArrowLeft", "KeyD", "ArrowRight", "KeyW", "ArrowUp", "KeyS", "ArrowDown"];
  for (const k of order) {
    if (s.just.has(k)) return DIR_FROM_KEY[k] ?? null;
  }
  return null;
}

function tryMove(s: GameState, a: Actor, dir: Dir, speed: number, dt: number, ignoreBomb = false) {
  const reverse: Record<Dir, Dir> = { left: "right", right: "left", up: "down", down: "up" };
  if (a.moving && dir === reverse[a.dir] && a.t > 0 && a.t < 1) {
    const nc = a.fromC;
    const nr = a.fromR;
    a.fromC = a.toC;
    a.fromR = a.toR;
    a.toC = nc;
    a.toR = nr;
    a.t = 1 - a.t;
    a.dir = dir;
  }
  if (!a.moving) {
    const [dc, dr] = DIRS[dir];
    const nc = a.c + dc;
    const nr = a.r + dr;
    a.dir = dir;
    if (!walkable(s, nc, nr, ignoreBomb)) return;
    a.moving = true;
    a.fromC = a.c;
    a.fromR = a.r;
    a.toC = nc;
    a.toR = nr;
    a.t = 0;
  }
  if (a.moving) {
    a.t += dt * speed;
    if (a.t >= 1) {
      a.c = a.toC;
      a.r = a.toR;
      a.fromC = a.c;
      a.fromR = a.r;
      a.t = 0;
      a.moving = false;
      // O jogador para no centro do tile e exige novo comando.
      // Inimigos mantêm o encadeamento contínuo original.
      if (a !== s.player) {
        const [dc, dr] = DIRS[dir];
        const nc = a.c + dc;
        const nr = a.r + dr;
        a.dir = dir;
        if (walkable(s, nc, nr, ignoreBomb)) {
          a.moving = true;
          a.toC = nc;
          a.toR = nr;
          a.t = Math.min(a.t, 0.99);
        }
      }
    }
  }
}

function actorPixel(a: Actor) {
  const u = a.moving ? Math.min(1, a.t) : 0;
  return {
    x: (a.fromC + (a.toC - a.fromC) * u) * TILE,
    y: (a.fromR + (a.toR - a.fromR) * u) * TILE,
  };
}

function placeBomb(s: GameState) {
  if (s.phase !== "playing") return;
  if (s.bombs.length >= s.bombsMax) return;
  const c = s.player.c;
  const r = s.player.r;
  if (s.grid[idx(c, r)] !== 0) return;
  if (occupiedByBomb(s, c, r)) return;
  s.bombs.push({ c, r, fuse: 2.35, range: s.flame });
}

function explodeAt(s: GameState, bomb: Bomb) {
  const add = (c: number, r: number, kind: Blast["kind"], ttl = 0.48) => {
    if (!inBounds(c, r)) return false;
    const cell = s.grid[idx(c, r)];
    if (cell === 1) return false;
    s.blasts.push({ c, r, ttl, max: ttl, kind });
    if (cell === 2) {
      s.grid[idx(c, r)] = 0;
      s.score += 10;
      maybeDrop(s, c, r);
      return false;
    }
    const chained = s.bombs.findIndex((b) => b.c === c && b.r === r);
    if (chained >= 0) {
      const next = s.bombs.splice(chained, 1)[0]!;
      explodeAt(s, next);
    }
    return true;
  };

  add(bomb.c, bomb.r, "center");
  const rays: { dir: Dir; kindMid: Blast["kind"]; kindTip: Blast["kind"] }[] = [
    { dir: "left", kindMid: "h", kindTip: "w" },
    { dir: "right", kindMid: "h", kindTip: "e" },
    { dir: "up", kindMid: "v", kindTip: "n" },
    { dir: "down", kindMid: "v", kindTip: "s" },
  ];
  for (const ray of rays) {
    const [dc, dr] = DIRS[ray.dir];
    for (let i = 1; i <= bomb.range; i++) {
      const c = bomb.c + dc * i;
      const r = bomb.r + dr * i;
      const kind = i === bomb.range ? ray.kindTip : ray.kindMid;
      if (!add(c, r, kind)) break;
    }
  }
  s.shake = Math.min(10, s.shake + 5);
  s.flash = 0.12;
}

function maybeDrop(s: GameState, c: number, r: number) {
  const rng = mulberry32((s.tick * 17 + c * 31 + r * 91 + s.level * 13) | 0);
  if (rng() > 0.32) return;
  const roll = rng();
  const kind: PowerKind =
    roll < 0.34 ? "bomb" : roll < 0.64 ? "flame" : roll < 0.9 ? "speed" : "life";
  s.pickups.push({ c, r, kind, bob: 0 });
}

function tileHasBlast(s: GameState, c: number, r: number) {
  return s.blasts.some((b) => b.c === c && b.r === r);
}

function killPlayer(s: GameState) {
  if (s.iFrames > 0) return;
  s.lives -= 1;
  s.shake = 8;
  s.flash = 0.2;
  if (s.lives <= 0) {
    s.phase = "over";
    if (s.score > s.hi) {
      s.hi = s.score;
      saveHi(s.hi);
    }
    return;
  }
  s.player = blankActor(1, 1, "down");
  s.iFrames = 2.2;
}

function enemyStep(s: GameState, e: Actor, dt: number) {
  if (!e.alive) return;
  const speed = 1.55 + s.level * 0.18;
  if (!e.moving) {
    const options: Dir[] = [];
    (Object.keys(DIRS) as Dir[]).forEach((d) => {
      const [dc, dr] = DIRS[d];
      if (walkable(s, e.c + dc, e.r + dr)) options.push(d);
    });
    if (options.length === 0) return;
    const reverse: Record<Dir, Dir> = { left: "right", right: "left", up: "down", down: "up" };
    const forward = options.filter((d) => d !== reverse[e.dir]);
    const pool = forward.length ? forward : options;
    const pick = pool[Math.floor((s.tick * 13 + e.c * 7 + e.r * 3) % pool.length)]!;
    // slight randomness via shake-independent hash
    const hashed = Math.abs(Math.sin(s.tick * 0.37 + e.c * 1.7 + e.r * 2.1));
    e.dir = hashed > 0.78 ? pool[Math.floor(hashed * pool.length) % pool.length]! : pick;
  }
  tryMove(s, e, e.dir, speed, dt, true);
}

function hazardRandom(s: GameState) {
  const seed =
    (s.seed ^ Math.imul(s.level, 0x85ebca6b) ^ Math.imul(++s.hazardSeq, 0x9e3779b9)) >>> 0;
  return mulberry32(seed);
}

function hazardCell(s: GameState, rng: () => number) {
  const candidates: { c: number; r: number }[] = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (s.grid[idx(c, r)] !== 0) continue;
      if (Math.abs(c - SPAWN.c) + Math.abs(r - SPAWN.r) < 4) continue;
      if (s.player.c === c && s.player.r === r) continue;
      if (s.player.moving && s.player.toC === c && s.player.toR === r) continue;
      if (
        s.enemies.some(
          (enemy) =>
            (enemy.c === c && enemy.r === r) ||
            (enemy.moving && enemy.toC === c && enemy.toR === r),
        )
      )
        continue;
      if (s.bombs.some((bomb) => bomb.c === c && bomb.r === r)) continue;
      if (s.pickups.some((pickup) => pickup.c === c && pickup.r === r)) continue;
      if (s.exitTarget.c === c && s.exitTarget.r === r) continue;
      if (s.sinkholes.some((hole) => hole.c === c && hole.r === r)) continue;
      candidates.push({ c, r });
    }
  }
  return candidates.length ? candidates[Math.floor(rng() * candidates.length)]! : null;
}

function spiralRoute() {
  const route: { c: number; r: number }[] = [];
  let left = 1;
  let right = COLS - 2;
  let top = 1;
  let bottom = ROWS - 2;
  while (left <= right && top <= bottom) {
    for (let c = left; c <= right; c++) route.push({ c, r: top });
    for (let r = top + 1; r <= bottom; r++) route.push({ c: right, r });
    if (bottom > top) {
      for (let c = right - 1; c >= left; c--) route.push({ c, r: bottom });
    }
    if (right > left) {
      for (let r = bottom - 1; r > top; r--) route.push({ c: left, r });
    }
    left++;
    right--;
    top++;
    bottom--;
  }
  return route;
}

function startFireWarning(s: GameState) {
  const rng = hazardRandom(s);
  const mirrorX = rng() < 0.5;
  const mirrorY = rng() < 0.5;
  let route = spiralRoute().map(({ c, r }) => ({
    c: mirrorX ? COLS - 1 - c : c,
    r: mirrorY ? ROWS - 1 - r : r,
  }));
  if (rng() < 0.5) route = route.reverse();
  s.fire = { phase: "warning", timer: 2.6, route, index: -1, stepTimer: 0, trail: [] };
}

function enterFireCell(s: GameState, c: number, r: number) {
  const fire = s.fire;
  if (!fire) return;
  fire.trail.push({ c, r, ttl: 0.42 });
  if (s.grid[idx(c, r)] === 2) {
    s.grid[idx(c, r)] = 0;
    s.score += 10;
    maybeDrop(s, c, r);
  }
}

function updateHazards(s: GameState, dt: number) {
  for (let i = s.sinkholes.length - 1; i >= 0; i--) {
    const hole = s.sinkholes[i]!;
    hole.timer -= dt;
    if (hole.timer > 0) continue;
    if (hole.phase === "warning") {
      hole.phase = "open";
      hole.timer = 2.35;
    } else {
      s.sinkholes.splice(i, 1);
    }
  }

  if (s.sinkholes.length < 2) {
    s.sinkholeTimer -= dt;
    if (s.sinkholeTimer <= 0) {
      const rng = hazardRandom(s);
      const cell = hazardCell(s, rng);
      if (cell) s.sinkholes.push({ ...cell, phase: "warning", timer: 1.35 });
      s.sinkholeTimer = 5.8 - Math.min(1.2, s.level * 0.035) + rng() * 2.4;
    }
  }

  if (!s.fire) {
    s.fireTimer -= dt;
    if (s.fireTimer <= 0) startFireWarning(s);
    return;
  }

  const fire = s.fire;
  for (const cell of fire.trail) cell.ttl -= dt;
  fire.trail = fire.trail.filter((cell) => cell.ttl > 0);
  if (fire.phase === "warning") {
    fire.timer -= dt;
    if (fire.timer <= 0) {
      fire.phase = "active";
      fire.stepTimer = 0;
    }
    return;
  }

  fire.stepTimer -= dt;
  const stepDuration = Math.max(0.105, 0.15 - (s.level - 1) * 0.0018);
  while (fire.stepTimer <= 0 && s.fire === fire) {
    fire.index++;
    if (fire.index >= fire.route.length) {
      s.fire = null;
      const rng = hazardRandom(s);
      s.fireTimer = 17 + rng() * 7;
      break;
    }
    const cell = fire.route[fire.index]!;
    enterFireCell(s, cell.c, cell.r);
    fire.stepTimer += stepDuration;
  }
}

function actorTouchesCell(actor: Actor, c: number, r: number) {
  return (actor.c === c && actor.r === r) || (actor.moving && actor.toC === c && actor.toR === r);
}

function actorInSinkhole(s: GameState, actor: Actor) {
  return s.sinkholes.some(
    (hole) => hole.phase === "open" && actorTouchesCell(actor, hole.c, hole.r),
  );
}

function actorInFire(s: GameState, actor: Actor) {
  return (
    s.fire?.phase === "active" &&
    s.fire.trail.some((cell) => actorTouchesCell(actor, cell.c, cell.r))
  );
}

export function step(s: GameState, dt: number) {
  const cap = Math.min(dt, 0.1);
  if (s.phase !== "playing") {
    s.just.clear();
    return;
  }

  s.tick += cap;
  s.shake = Math.max(0, s.shake - cap * 18);
  s.flash = Math.max(0, s.flash - cap);
  s.iFrames = Math.max(0, s.iFrames - cap);

  const dir = wantedDir(s);
  if (dir) tryMove(s, s.player, dir, s.speed, cap);
  else if (s.player.moving) tryMove(s, s.player, s.player.dir, s.speed, cap);

  if (s.just.has("Space") || s.just.has("KeyJ") || s.just.has("Bomb")) placeBomb(s);

  for (const b of s.bombs) b.fuse -= cap;
  const ready = s.bombs.filter((b) => b.fuse <= 0);
  s.bombs = s.bombs.filter((b) => b.fuse > 0);
  for (const b of ready) explodeAt(s, b);

  for (const bl of s.blasts) bl.ttl -= cap;
  s.blasts = s.blasts.filter((b) => b.ttl > 0);

  if (
    tileHasBlast(s, s.player.c, s.player.r) ||
    (s.player.moving && tileHasBlast(s, s.player.toC, s.player.toR))
  ) {
    killPlayer(s);
  }

  updateHazards(s, cap);
  if ((actorInSinkhole(s, s.player) || actorInFire(s, s.player)) && s.iFrames <= 0) {
    killPlayer(s);
  }

  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (tileHasBlast(s, e.c, e.r) || (e.moving && tileHasBlast(s, e.toC, e.toR))) {
      e.alive = false;
      s.score += 100;
      continue;
    }
    enemyStep(s, e, cap);
    if (actorInSinkhole(s, e) || actorInFire(s, e)) {
      e.alive = false;
      s.score += 100;
      continue;
    }
    if (e.c === s.player.c && e.r === s.player.r && s.iFrames <= 0) killPlayer(s);
  }

  s.enemies = s.enemies.filter((e) => e.alive);

  for (const p of s.pickups) p.bob += cap * 4;
  const got: Pickup[] = [];
  s.pickups = s.pickups.filter((p) => {
    if (p.c === s.player.c && p.r === s.player.r) {
      got.push(p);
      return false;
    }
    return true;
  });
  for (const p of got) {
    s.score += 25;
    if (p.kind === "bomb") s.bombsMax = Math.min(8, s.bombsMax + 1);
    if (p.kind === "flame") s.flame = Math.min(8, s.flame + 1);
    if (p.kind === "speed") s.speed = Math.min(6.2, s.speed + 0.45);
    if (p.kind === "life") s.lives = Math.min(6, s.lives + 1);
  }

  if (s.enemies.length === 0 && s.phase === "playing") {
    if (!s.exit) {
      s.exit = { ...s.exitTarget, open: true };
    }
    if (s.exit && s.player.c === s.exit.c && s.player.r === s.exit.r) {
      s.score += 400 + s.level * 150;
      if (s.score > s.hi) {
        s.hi = s.score;
        saveHi(s.hi);
      }
      if (s.level >= MAX_LEVEL) {
        s.phase = "over";
      } else {
        s.phase = "clear";
      }
    }
  }

  s.just.clear();
}

export function pixelOf(a: Actor) {
  return actorPixel(a);
}

export function press(s: GameState, code: string) {
  if (!s.keys.has(code)) s.just.add(code);
  s.keys.add(code);
}

export function release(s: GameState, code: string) {
  s.keys.delete(code);
}

export function setHeld(s: GameState, codes: string[]) {
  s.keys.clear();
  s.just.clear();
  for (const c of codes) {
    s.keys.add(c);
    s.just.add(c);
  }
}

export function yawOf(s: GameState) {
  const map: Record<Dir, number> = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  return map[s.player.dir];
}

export function speedOf(s: GameState) {
  return s.player.moving ? s.speed : s.keys.size ? s.speed * 0.2 : 0;
}

export type Sfx = "place" | "boom" | "pickup" | "hurt" | "win" | "start";

export function makeAudio() {
  let ctx: AudioContext | null = null;
  const ensure = () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };
  const beep = (freq: number, dur: number, type: OscillatorType, gain = 0.05) => {
    const ac = ensure();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  return {
    unlock: () => ensure(),
    play(kind: Sfx) {
      try {
        if (kind === "place") beep(180, 0.08, "square", 0.04);
        if (kind === "boom") {
          beep(90, 0.22, "sawtooth", 0.07);
          beep(220, 0.12, "square", 0.03);
        }
        if (kind === "pickup") {
          beep(520, 0.08, "triangle", 0.04);
          beep(780, 0.1, "triangle", 0.03);
        }
        if (kind === "hurt") beep(140, 0.25, "sawtooth", 0.06);
        if (kind === "win") {
          beep(392, 0.12, "triangle", 0.05);
          beep(523, 0.16, "triangle", 0.05);
          beep(659, 0.22, "triangle", 0.05);
        }
        if (kind === "start") beep(330, 0.1, "square", 0.04);
      } catch {
        /* ignore */
      }
    },
  };
}

export const SPRITE_FILES = [
  "player_idle",
  "player_walk_down",
  "player_walk_up",
  "player_walk_left",
  "player_walk_right",
  "bomb_idle",
  "explosion_center_01",
  "explosion_center_00",
  "explosion_center_02",
  "explosion_center_03",
  "explosion_h",
  "explosion_v",
  "explosion_tip_n",
  "explosion_tip_s",
  "explosion_tip_e",
  "explosion_tip_w",
  "tile_floor",
  "tile_wall",
  "tile_crate",
  "tile_exit",
  "enemy_idle",
  "enemy_walk",
  "power_bomb",
  "power_flame",
  "power_speed",
  "power_life",
] as const;

export type SpriteName = (typeof SPRITE_FILES)[number];

export async function loadSprites() {
  const out = {} as Record<SpriteName, HTMLImageElement>;
  await Promise.all(
    SPRITE_FILES.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            out[name] = img;
            resolve();
          };
          img.onerror = () => reject(new Error(`sprite ${name}`));
          img.src = `/sprites/${name}.png`;
        }),
    ),
  );
  return out;
}

// Presentation only: keep the 32px grid, actor positions and hitboxes unchanged.
const ACTOR_DRAW_SIZE = 44;
const readableActorSheets = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

function drawActor(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frame: number,
  x: number,
  y: number,
) {
  let readable = readableActorSheets.get(sheet);
  if (!readable) {
    readable = document.createElement("canvas");
    readable.width = sheet.width;
    readable.height = sheet.height;
    const paint = readable.getContext("2d");
    if (paint) {
      // Apply once per sheet, not per animation frame (especially on phones).
      paint.filter = "saturate(1.8) brightness(1.5) contrast(1.08)";
      paint.drawImage(sheet, 0, 0);
      readableActorSheets.set(sheet, readable);
    } else {
      readable = undefined;
    }
  }
  ctx.save();
  ctx.shadowColor = "#071422";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(
    readable ?? sheet,
    frame * TILE,
    0,
    TILE,
    TILE,
    x + (TILE - ACTOR_DRAW_SIZE) / 2,
    y + TILE - 4 - (30 / TILE) * ACTOR_DRAW_SIZE,
    ACTOR_DRAW_SIZE,
    ACTOR_DRAW_SIZE,
  );
  ctx.restore();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sprites: Record<SpriteName, HTMLImageElement>,
  now: number,
) {
  const W = COLS * TILE;
  const H = ROWS * TILE;
  ctx.imageSmoothingEnabled = false;
  const sx = s.shake ? (Math.random() - 0.5) * s.shake : 0;
  const sy = s.shake ? (Math.random() - 0.5) * s.shake : 0;
  ctx.setTransform(1, 0, 0, 1, sx, sy);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.drawImage(sprites.tile_floor, c * TILE, r * TILE);
    }
  }
  // Lift only the floor, leaving walls, crates, pickups and blasts distinct.
  ctx.fillStyle = "rgba(125, 181, 204, 0.20)";
  ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = s.grid[idx(c, r)];
      if (cell === 1) ctx.drawImage(sprites.tile_wall, c * TILE, r * TILE);
      if (cell === 2) ctx.drawImage(sprites.tile_crate, c * TILE, r * TILE);
    }
  }

  for (const hole of s.sinkholes) {
    const x = (hole.c + 0.5) * TILE;
    const y = (hole.r + 0.5) * TILE;
    const pulse = 0.88 + Math.sin(now * 13) * 0.08;
    ctx.save();
    if (hole.phase === "warning") {
      ctx.globalAlpha = 0.72 + Math.sin(now * 18) * 0.2;
      ctx.fillStyle = "rgba(255, 215, 0, 0.18)";
      ctx.beginPath();
      ctx.arc(x, y, TILE * 0.38 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(x, y, TILE * 0.4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff0a6";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", x, y);
    } else {
      const pit = ctx.createRadialGradient(x, y, 2, x, y, TILE * 0.42);
      pit.addColorStop(0, "#070b11");
      pit.addColorStop(0.68, "#10141b");
      pit.addColorStop(1, "rgba(255, 122, 0, 0.9)");
      ctx.fillStyle = pit;
      ctx.beginPath();
      ctx.ellipse(x, y, TILE * 0.42 * pulse, TILE * 0.32 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 122, 0, 0.95)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  if (s.fire?.phase === "warning") {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 122, 0, 0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    s.fire.route.forEach((cell, i) => {
      const x = (cell.c + 0.5) * TILE;
      const y = (cell.r + 0.5) * TILE;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  } else if (s.fire?.phase === "active") {
    for (const cell of s.fire.trail) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, cell.ttl / 0.42);
      ctx.shadowColor = "#ff7a00";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ff7a00";
      ctx.beginPath();
      ctx.ellipse((cell.c + 0.5) * TILE, (cell.r + 0.5) * TILE, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc((cell.c + 0.5) * TILE, (cell.r + 0.5) * TILE, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (s.exit?.open) {
    ctx.drawImage(sprites.tile_exit, s.exit.c * TILE, s.exit.r * TILE);
  }

  for (const p of s.pickups) {
    const sheet =
      p.kind === "bomb"
        ? sprites.power_bomb
        : p.kind === "flame"
          ? sprites.power_flame
          : p.kind === "speed"
            ? sprites.power_speed
            : sprites.power_life;
    const bob = Math.round(Math.sin(p.bob) * 2);
    ctx.drawImage(sheet, p.c * TILE, p.r * TILE + bob);
  }

  for (const b of s.bombs) {
    const pulse = 1 + Math.sin(now * 10 + b.fuse * 8) * 0.08;
    const size = TILE * pulse;
    const ox = b.c * TILE + (TILE - size) / 2;
    const oy = b.r * TILE + (TILE - size) / 2 - 2;
    ctx.drawImage(sprites.bomb_idle, ox, oy, size, size);
  }

  const blastImg = (kind: Blast["kind"], life: number) => {
    if (kind === "center") {
      if (life > 0.72) return sprites.explosion_center_00;
      if (life > 0.42) return sprites.explosion_center_02;
      if (life > 0.18) return sprites.explosion_center_01;
      return sprites.explosion_center_03;
    }
    if (kind === "h") return sprites.explosion_h;
    if (kind === "v") return sprites.explosion_v;
    if (kind === "n") return sprites.explosion_tip_n;
    if (kind === "s") return sprites.explosion_tip_s;
    if (kind === "e") return sprites.explosion_tip_e;
    return sprites.explosion_tip_w;
  };
  for (const bl of s.blasts) {
    const img = blastImg(bl.kind, bl.ttl / bl.max);
    ctx.globalAlpha = 0.55 + 0.45 * (bl.ttl / bl.max);
    ctx.drawImage(img, bl.c * TILE, bl.r * TILE);
    ctx.globalAlpha = 1;
  }

  for (const e of s.enemies) {
    const p = actorPixel(e);
    const frame = e.moving ? Math.floor(now * 6) % 2 : 0;
    drawActor(ctx, sprites.enemy_walk, frame, p.x, p.y);
  }

  if (s.phase === "playing" || s.phase === "paused" || s.phase === "clear") {
    const p = actorPixel(s.player);
    const blink = s.iFrames > 0 && Math.floor(now * 12) % 2 === 0;
    if (!blink) {
      const strip =
        s.player.dir === "up"
          ? sprites.player_walk_up
          : s.player.dir === "left"
            ? sprites.player_walk_left
            : s.player.dir === "right"
              ? sprites.player_walk_right
              : sprites.player_walk_down;
      const frame = s.player.moving ? Math.floor(s.player.t * 4) % 4 : 0;
      if (!s.player.moving && s.player.dir === "down") {
        drawActor(ctx, sprites.player_idle, 0, p.x, p.y);
      } else {
        drawActor(ctx, strip, frame, p.x, p.y);
      }
    }
  }

  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255, 170, 60, ${s.flash * 0.45})`;
    ctx.fillRect(-8, -8, W + 16, H + 16);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export type HudSnap = {
  phase: Phase;
  level: number;
  score: number;
  hi: number;
  lives: number;
  bombs: number;
  bombsMax: number;
  flame: number;
  enemies: number;
  exitOpen: boolean;
  seedCode: string;
  hazard: string | null;
};

export function hud(s: GameState): HudSnap {
  const hazard =
    s.fire?.phase === "warning"
      ? "ESPIRAL DE FOGO: SAIA DA ROTA"
      : s.fire?.phase === "active"
        ? "ESPIRAL ATIVA: CONTINUE EM MOVIMENTO"
        : s.sinkholes.some((hole) => hole.phase === "warning")
          ? "SUMIDOURO PISCANDO: SAIA DO CÍRCULO"
          : s.sinkholes.some((hole) => hole.phase === "open")
            ? "SUMIDOURO ABERTO: NÃO PISE NO VÃO"
            : null;
  return {
    phase: s.phase,
    level: s.level,
    score: s.score,
    hi: s.hi,
    lives: s.lives,
    bombs: Math.max(0, s.bombsMax - s.bombs.length),
    bombsMax: s.bombsMax,
    flame: s.flame,
    enemies: s.enemies.length,
    exitOpen: Boolean(s.exit?.open),
    seedCode: (s.seed >>> 0).toString(36).toUpperCase().padStart(7, "0"),
    hazard,
  };
}
