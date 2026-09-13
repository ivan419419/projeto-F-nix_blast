export const COLS = 15;
export const ROWS = 13;
export const TILE = 32;
export const FIXED_DT = 1 / 60;
export const MAX_LEVEL = 5;
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
  const rng = mulberry32(level * 997 + 13);
  const grid = s.grid;
  grid.fill(0);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const edge = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
      const pillar = c % 2 === 0 && r % 2 === 0;
      if (edge || pillar) grid[idx(c, r)] = 1;
    }
  }

  const density = Math.min(0.72, 0.34 + level * 0.07);
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[idx(c, r)] !== 0) continue;
      if (c + r <= 4) continue; // keep spawn pocket open
      if (rng() < density) grid[idx(c, r)] = 2;
    }
  }

  s.player = blankActor(1, 1, "down");
  s.iFrames = 1.6;
  s.bombs = [];
  s.blasts = [];
  s.pickups = [];
  s.exit = null;
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
  s.enemies = [];
  for (let i = 0; i < count; i++) {
    const [c, r] = corners[i]!;
    grid[idx(c, r)] = 0;
    // open a path cell next to them
    if (inBounds(c - 1, r) && grid[idx(c - 1, r)] === 2) grid[idx(c - 1, r)] = 0;
    const dirs: Dir[] = ["left", "right", "up", "down"];
    s.enemies.push(blankActor(c, r, dirs[i % 4]!));
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
  for (const k of order) {
    if (s.keys.has(k)) return DIR_FROM_KEY[k] ?? null;
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
      // chain into the held direction on the same tick
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

export function step(s: GameState, dt: number) {
  const cap = Math.min(dt, 0.1);
  s.tick += cap;
  s.shake = Math.max(0, s.shake - cap * 18);
  s.flash = Math.max(0, s.flash - cap);
  s.iFrames = Math.max(0, s.iFrames - cap);

  if (s.phase !== "playing") {
    s.just.clear();
    return;
  }

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

  if (tileHasBlast(s, s.player.c, s.player.r) || (s.player.moving && tileHasBlast(s, s.player.toC, s.player.toR))) {
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
      // farthest empty from spawn
      let best = { c: COLS - 2, r: ROWS - 2, d: -1 };
      for (let r = 1; r < ROWS - 1; r++) {
        for (let c = 1; c < COLS - 1; c++) {
          if (s.grid[idx(c, r)] !== 0) continue;
          if (occupiedByBomb(s, c, r)) continue;
          const d = Math.abs(c - 1) + Math.abs(r - 1);
          if (d > best.d) best = { c, r, d };
        }
      }
      s.exit = { c: best.c, r: best.r, open: true };
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
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = s.grid[idx(c, r)];
      if (cell === 1) ctx.drawImage(sprites.tile_wall, c * TILE, r * TILE);
      if (cell === 2) ctx.drawImage(sprites.tile_crate, c * TILE, r * TILE);
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
    ctx.drawImage(sprites.enemy_walk, frame * 32, 0, 32, 32, p.x, p.y - 2, 32, 32);
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
        ctx.drawImage(sprites.player_idle, p.x, p.y - 2);
      } else {
        ctx.drawImage(strip, frame * 32, 0, 32, 32, p.x, p.y - 2, 32, 32);
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
};

export function hud(s: GameState): HudSnap {
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
  };
}
