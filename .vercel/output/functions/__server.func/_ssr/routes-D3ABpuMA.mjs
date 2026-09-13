import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Flame, c as ChevronLeft, i as Heart, l as ChevronDown, n as Play, o as ChevronUp, r as Pause, s as ChevronRight, u as Bomb } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-D3ABpuMA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var HI_KEY = "fenix-blast-hi";
var DIRS = {
	left: [-1, 0],
	right: [1, 0],
	up: [0, -1],
	down: [0, 1]
};
var DIR_FROM_KEY = {
	KeyA: "left",
	ArrowLeft: "left",
	KeyD: "right",
	ArrowRight: "right",
	KeyW: "up",
	ArrowUp: "up",
	KeyS: "down",
	ArrowDown: "down"
};
function mulberry32(a) {
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function idx(c, r) {
	return r * 15 + c;
}
function inBounds(c, r) {
	return c >= 0 && r >= 0 && c < 15 && r < 13;
}
function loadHi() {
	try {
		const n = Number(localStorage.getItem("fenix-blast-hi") ?? "0");
		return Number.isFinite(n) ? n : 0;
	} catch {
		return 0;
	}
}
function saveHi(n) {
	try {
		localStorage.setItem(HI_KEY, String(n));
	} catch {}
}
function createGame() {
	const s = {
		phase: "title",
		level: 1,
		score: 0,
		hi: typeof window !== "undefined" ? loadHi() : 0,
		lives: 3,
		grid: new Array(195).fill(0),
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
		keys: /* @__PURE__ */ new Set(),
		just: /* @__PURE__ */ new Set(),
		seed: 1
	};
	buildLevel(s, 1);
	s.phase = "title";
	return s;
}
function blankActor(c, r, dir) {
	return {
		c,
		r,
		fromC: c,
		fromR: r,
		toC: c,
		toR: r,
		t: 0,
		moving: false,
		dir,
		alive: true
	};
}
function startRun(s) {
	s.score = 0;
	s.lives = 3;
	s.bombsMax = 1;
	s.flame = 1;
	s.speed = 3.2;
	s.level = 1;
	buildLevel(s, 1);
	s.phase = "playing";
}
function nextLevel(s) {
	if (s.level >= 5) {
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
function buildLevel(s, level) {
	const rng = mulberry32(level * 997 + 13);
	const grid = s.grid;
	grid.fill(0);
	for (let r = 0; r < 13; r++) for (let c = 0; c < 15; c++) {
		const edge = c === 0 || r === 0 || c === 14 || r === 12;
		const pillar = c % 2 === 0 && r % 2 === 0;
		if (edge || pillar) grid[idx(c, r)] = 1;
	}
	const density = Math.min(.72, .34 + level * .07);
	for (let r = 1; r < 12; r++) for (let c = 1; c < 14; c++) {
		if (grid[idx(c, r)] !== 0) continue;
		if (c + r <= 4) continue;
		if (rng() < density) grid[idx(c, r)] = 2;
	}
	s.player = blankActor(1, 1, "down");
	s.iFrames = 1.6;
	s.bombs = [];
	s.blasts = [];
	s.pickups = [];
	s.exit = null;
	s.shake = 0;
	s.flash = 0;
	const corners = [
		[13, 11],
		[13, 1],
		[1, 11],
		[11, 11],
		[13, 4],
		[3, 11],
		[9, 1],
		[1, 9]
	];
	const count = Math.min(corners.length, 2 + level);
	s.enemies = [];
	for (let i = 0; i < count; i++) {
		const [c, r] = corners[i];
		grid[idx(c, r)] = 0;
		if (inBounds(c - 1, r) && grid[idx(c - 1, r)] === 2) grid[idx(c - 1, r)] = 0;
		s.enemies.push(blankActor(c, r, [
			"left",
			"right",
			"up",
			"down"
		][i % 4]));
	}
}
function occupiedByBomb(s, c, r) {
	return s.bombs.some((b) => b.c === c && b.r === r);
}
function walkable(s, c, r, ignoreBomb = false) {
	if (!inBounds(c, r)) return false;
	if (s.grid[idx(c, r)] !== 0) return false;
	if (!ignoreBomb && occupiedByBomb(s, c, r)) return false;
	return true;
}
function wantedDir(s) {
	const order = [
		"KeyA",
		"ArrowLeft",
		"KeyD",
		"ArrowRight",
		"KeyW",
		"ArrowUp",
		"KeyS",
		"ArrowDown"
	];
	for (const k of order) if (s.just.has(k)) return DIR_FROM_KEY[k] ?? null;
	for (const k of order) if (s.keys.has(k)) return DIR_FROM_KEY[k] ?? null;
	return null;
}
function tryMove(s, a, dir, speed, dt, ignoreBomb = false) {
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
		}
	}
}
function actorPixel(a) {
	const u = a.moving ? Math.min(1, a.t) : 0;
	return {
		x: (a.fromC + (a.toC - a.fromC) * u) * 32,
		y: (a.fromR + (a.toR - a.fromR) * u) * 32
	};
}
function placeBomb(s) {
	if (s.phase !== "playing") return;
	if (s.bombs.length >= s.bombsMax) return;
	const c = s.player.c;
	const r = s.player.r;
	if (s.grid[idx(c, r)] !== 0) return;
	if (occupiedByBomb(s, c, r)) return;
	s.bombs.push({
		c,
		r,
		fuse: 2.35,
		range: s.flame
	});
}
function explodeAt(s, bomb) {
	const add = (c, r, kind, ttl = .48) => {
		if (!inBounds(c, r)) return false;
		const cell = s.grid[idx(c, r)];
		if (cell === 1) return false;
		s.blasts.push({
			c,
			r,
			ttl,
			max: ttl,
			kind
		});
		if (cell === 2) {
			s.grid[idx(c, r)] = 0;
			s.score += 10;
			maybeDrop(s, c, r);
			return false;
		}
		const chained = s.bombs.findIndex((b) => b.c === c && b.r === r);
		if (chained >= 0) {
			const next = s.bombs.splice(chained, 1)[0];
			explodeAt(s, next);
		}
		return true;
	};
	add(bomb.c, bomb.r, "center");
	for (const ray of [
		{
			dir: "left",
			kindMid: "h",
			kindTip: "w"
		},
		{
			dir: "right",
			kindMid: "h",
			kindTip: "e"
		},
		{
			dir: "up",
			kindMid: "v",
			kindTip: "n"
		},
		{
			dir: "down",
			kindMid: "v",
			kindTip: "s"
		}
	]) {
		const [dc, dr] = DIRS[ray.dir];
		for (let i = 1; i <= bomb.range; i++) if (!add(bomb.c + dc * i, bomb.r + dr * i, i === bomb.range ? ray.kindTip : ray.kindMid)) break;
	}
	s.shake = Math.min(10, s.shake + 5);
	s.flash = .12;
}
function maybeDrop(s, c, r) {
	const rng = mulberry32(s.tick * 17 + c * 31 + r * 91 + s.level * 13 | 0);
	if (rng() > .32) return;
	const roll = rng();
	const kind = roll < .34 ? "bomb" : roll < .64 ? "flame" : roll < .9 ? "speed" : "life";
	s.pickups.push({
		c,
		r,
		kind,
		bob: 0
	});
}
function tileHasBlast(s, c, r) {
	return s.blasts.some((b) => b.c === c && b.r === r);
}
function killPlayer(s) {
	if (s.iFrames > 0) return;
	s.lives -= 1;
	s.shake = 8;
	s.flash = .2;
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
function enemyStep(s, e, dt) {
	if (!e.alive) return;
	const speed = 1.55 + s.level * .18;
	if (!e.moving) {
		const options = [];
		Object.keys(DIRS).forEach((d) => {
			const [dc, dr] = DIRS[d];
			if (walkable(s, e.c + dc, e.r + dr)) options.push(d);
		});
		if (options.length === 0) return;
		const reverse = {
			left: "right",
			right: "left",
			up: "down",
			down: "up"
		};
		const forward = options.filter((d) => d !== reverse[e.dir]);
		const pool = forward.length ? forward : options;
		const pick = pool[Math.floor((s.tick * 13 + e.c * 7 + e.r * 3) % pool.length)];
		const hashed = Math.abs(Math.sin(s.tick * .37 + e.c * 1.7 + e.r * 2.1));
		e.dir = hashed > .78 ? pool[Math.floor(hashed * pool.length) % pool.length] : pick;
	}
	tryMove(s, e, e.dir, speed, dt, true);
}
function step(s, dt) {
	const cap = Math.min(dt, .1);
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
	if (tileHasBlast(s, s.player.c, s.player.r) || s.player.moving && tileHasBlast(s, s.player.toC, s.player.toR)) killPlayer(s);
	for (const e of s.enemies) {
		if (!e.alive) continue;
		if (tileHasBlast(s, e.c, e.r) || e.moving && tileHasBlast(s, e.toC, e.toR)) {
			e.alive = false;
			s.score += 100;
			continue;
		}
		enemyStep(s, e, cap);
		if (e.c === s.player.c && e.r === s.player.r && s.iFrames <= 0) killPlayer(s);
	}
	s.enemies = s.enemies.filter((e) => e.alive);
	for (const p of s.pickups) p.bob += cap * 4;
	const got = [];
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
		if (p.kind === "speed") s.speed = Math.min(6.2, s.speed + .45);
		if (p.kind === "life") s.lives = Math.min(6, s.lives + 1);
	}
	if (s.enemies.length === 0 && s.phase === "playing") {
		if (!s.exit) {
			let best = {
				c: 13,
				r: 11,
				d: -1
			};
			for (let r = 1; r < 12; r++) for (let c = 1; c < 14; c++) {
				if (s.grid[idx(c, r)] !== 0) continue;
				if (occupiedByBomb(s, c, r)) continue;
				const d = Math.abs(c - 1) + Math.abs(r - 1);
				if (d > best.d) best = {
					c,
					r,
					d
				};
			}
			s.exit = {
				c: best.c,
				r: best.r,
				open: true
			};
		}
		if (s.exit && s.player.c === s.exit.c && s.player.r === s.exit.r) {
			s.score += 400 + s.level * 150;
			if (s.score > s.hi) {
				s.hi = s.score;
				saveHi(s.hi);
			}
			if (s.level >= 5) s.phase = "over";
			else s.phase = "clear";
		}
	}
	s.just.clear();
}
function press(s, code) {
	if (!s.keys.has(code)) s.just.add(code);
	s.keys.add(code);
}
function release(s, code) {
	s.keys.delete(code);
}
function setHeld(s, codes) {
	s.keys.clear();
	s.just.clear();
	for (const c of codes) {
		s.keys.add(c);
		s.just.add(c);
	}
}
function yawOf(s) {
	return {
		up: 0,
		right: Math.PI / 2,
		down: Math.PI,
		left: -Math.PI / 2
	}[s.player.dir];
}
function speedOf(s) {
	return s.player.moving ? s.speed : s.keys.size ? s.speed * .2 : 0;
}
function makeAudio() {
	let ctx = null;
	const ensure = () => {
		if (!ctx) ctx = new AudioContext();
		if (ctx.state === "suspended") ctx.resume();
		return ctx;
	};
	const beep = (freq, dur, type, gain = .05) => {
		const ac = ensure();
		const t = ac.currentTime;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		o.connect(g);
		g.connect(ac.destination);
		o.start(t);
		o.stop(t + dur + .02);
	};
	return {
		unlock: () => ensure(),
		play(kind) {
			try {
				if (kind === "place") beep(180, .08, "square", .04);
				if (kind === "boom") {
					beep(90, .22, "sawtooth", .07);
					beep(220, .12, "square", .03);
				}
				if (kind === "pickup") {
					beep(520, .08, "triangle", .04);
					beep(780, .1, "triangle", .03);
				}
				if (kind === "hurt") beep(140, .25, "sawtooth", .06);
				if (kind === "win") {
					beep(392, .12, "triangle", .05);
					beep(523, .16, "triangle", .05);
					beep(659, .22, "triangle", .05);
				}
				if (kind === "start") beep(330, .1, "square", .04);
			} catch {}
		}
	};
}
var SPRITE_FILES = [
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
	"power_life"
];
async function loadSprites() {
	const out = {};
	await Promise.all(SPRITE_FILES.map((name) => new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			out[name] = img;
			resolve();
		};
		img.onerror = () => reject(/* @__PURE__ */ new Error(`sprite ${name}`));
		img.src = `/sprites/${name}.png`;
	})));
	return out;
}
function drawFrame(ctx, s, sprites, now) {
	ctx.imageSmoothingEnabled = false;
	const sx = s.shake ? (Math.random() - .5) * s.shake : 0;
	const sy = s.shake ? (Math.random() - .5) * s.shake : 0;
	ctx.setTransform(1, 0, 0, 1, sx, sy);
	for (let r = 0; r < 13; r++) for (let c = 0; c < 15; c++) ctx.drawImage(sprites.tile_floor, c * 32, r * 32);
	for (let r = 0; r < 13; r++) for (let c = 0; c < 15; c++) {
		const cell = s.grid[idx(c, r)];
		if (cell === 1) ctx.drawImage(sprites.tile_wall, c * 32, r * 32);
		if (cell === 2) ctx.drawImage(sprites.tile_crate, c * 32, r * 32);
	}
	if (s.exit?.open) ctx.drawImage(sprites.tile_exit, s.exit.c * 32, s.exit.r * 32);
	for (const p of s.pickups) {
		const sheet = p.kind === "bomb" ? sprites.power_bomb : p.kind === "flame" ? sprites.power_flame : p.kind === "speed" ? sprites.power_speed : sprites.power_life;
		const bob = Math.round(Math.sin(p.bob) * 2);
		ctx.drawImage(sheet, p.c * 32, p.r * 32 + bob);
	}
	for (const b of s.bombs) {
		const size = 32 * (1 + Math.sin(now * 10 + b.fuse * 8) * .08);
		const ox = b.c * 32 + (32 - size) / 2;
		const oy = b.r * 32 + (32 - size) / 2 - 2;
		ctx.drawImage(sprites.bomb_idle, ox, oy, size, size);
	}
	const blastImg = (kind, life) => {
		if (kind === "center") {
			if (life > .72) return sprites.explosion_center_00;
			if (life > .42) return sprites.explosion_center_02;
			if (life > .18) return sprites.explosion_center_01;
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
		ctx.globalAlpha = .55 + .45 * (bl.ttl / bl.max);
		ctx.drawImage(img, bl.c * 32, bl.r * 32);
		ctx.globalAlpha = 1;
	}
	for (const e of s.enemies) {
		const p = actorPixel(e);
		const frame = e.moving ? Math.floor(now * 6) % 2 : 0;
		ctx.drawImage(sprites.enemy_walk, frame * 32, 0, 32, 32, p.x, p.y - 2, 32, 32);
	}
	if (s.phase === "playing" || s.phase === "paused" || s.phase === "clear") {
		const p = actorPixel(s.player);
		if (!(s.iFrames > 0 && Math.floor(now * 12) % 2 === 0)) {
			const strip = s.player.dir === "up" ? sprites.player_walk_up : s.player.dir === "left" ? sprites.player_walk_left : s.player.dir === "right" ? sprites.player_walk_right : sprites.player_walk_down;
			const frame = s.player.moving ? Math.floor(s.player.t * 4) % 4 : 0;
			if (!s.player.moving && s.player.dir === "down") ctx.drawImage(sprites.player_idle, p.x, p.y - 2);
			else ctx.drawImage(strip, frame * 32, 0, 32, 32, p.x, p.y - 2, 32, 32);
		}
	}
	if (s.flash > 0) {
		ctx.fillStyle = `rgba(255, 170, 60, ${s.flash * .45})`;
		ctx.fillRect(-8, -8, 496, 432);
	}
	ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function hud(s) {
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
		exitOpen: Boolean(s.exit?.open)
	};
}
var MAP_W = 480;
var MAP_H = 416;
function GameView() {
	const canvasRef = (0, import_react.useRef)(null);
	const stateRef = (0, import_react.useRef)(createGame());
	const spritesRef = (0, import_react.useRef)(null);
	const audioRef = (0, import_react.useRef)(null);
	const accRef = (0, import_react.useRef)(0);
	const lastRef = (0, import_react.useRef)(0);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [snap, setSnap] = (0, import_react.useState)(() => hud(stateRef.current));
	const [loadError, setLoadError] = (0, import_react.useState)(null);
	const touchDir = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		let dead = false;
		loadSprites().then((sprites) => {
			if (dead) return;
			spritesRef.current = sprites;
			setReady(true);
		}).catch((err) => {
			if (!dead) setLoadError(err.message);
		});
		return () => {
			dead = true;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const s = stateRef.current;
		const onDown = (e) => {
			if (e.repeat) return;
			if ([
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"Space"
			].includes(e.code)) e.preventDefault();
			if (e.code === "Escape") {
				if (s.phase === "playing") s.phase = "paused";
				else if (s.phase === "paused") s.phase = "playing";
				setSnap(hud(s));
				return;
			}
			if (e.code === "Enter" && (s.phase === "title" || s.phase === "how" || s.phase === "over")) {
				begin();
				return;
			}
			if (e.code === "Enter" && s.phase === "clear") {
				goNext();
				return;
			}
			press(s, e.code);
		};
		const onUp = (e) => release(s, e.code);
		const onHide = () => {
			s.keys.clear();
			if (document.hidden && s.phase === "playing") {
				s.phase = "paused";
				setSnap(hud(s));
			}
		};
		window.addEventListener("keydown", onDown);
		window.addEventListener("keyup", onUp);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
			document.removeEventListener("visibilitychange", onHide);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const s = stateRef.current;
		const probe = {
			getYaw: () => yawOf(s),
			getSpeed: () => speedOf(s),
			setKeys: (codes) => setHeld(s, codes)
		};
		window.__controlsTest = probe;
		let raf = 0;
		let lastHud = "";
		const loop = (ms) => {
			raf = requestAnimationFrame(loop);
			if (!lastRef.current) lastRef.current = ms;
			let dt = (ms - lastRef.current) / 1e3;
			lastRef.current = ms;
			if (dt > .1) dt = .1;
			accRef.current += dt;
			const beforePhase = s.phase;
			const beforeBombs = s.bombs.length;
			const beforeBlasts = s.blasts.length;
			const beforeLives = s.lives;
			const beforePick = s.pickups.length;
			while (accRef.current >= 1 / 60) {
				step(s, 1 / 60);
				accRef.current -= 1 / 60;
			}
			const audio = audioRef.current;
			if (audio) {
				if (s.bombs.length > beforeBombs) audio.play("place");
				if (s.blasts.length > beforeBlasts) audio.play("boom");
				if (s.pickups.length < beforePick) audio.play("pickup");
				if (s.lives < beforeLives) audio.play("hurt");
				if (beforePhase === "playing" && (s.phase === "clear" || s.phase === "over")) audio.play("win");
			}
			const sprites = spritesRef.current;
			if (sprites) drawFrame(ctx, s, sprites, ms / 1e3);
			const next = hud(s);
			const key = `${next.phase}|${next.score}|${next.lives}|${next.bombs}|${next.flame}|${next.level}|${next.enemies}|${next.exitOpen}`;
			if (key !== lastHud) {
				lastHud = key;
				setSnap(next);
			}
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			if (window.__controlsTest === probe) delete window.__controlsTest;
		};
	}, [ready]);
	const unlock = () => {
		if (!audioRef.current) audioRef.current = makeAudio();
		audioRef.current.unlock();
	};
	const begin = () => {
		unlock();
		audioRef.current?.play("start");
		startRun(stateRef.current);
		setSnap(hud(stateRef.current));
	};
	const goNext = () => {
		unlock();
		nextLevel(stateRef.current);
		setSnap(hud(stateRef.current));
	};
	const hold = (code, on) => {
		const s = stateRef.current;
		if (on) press(s, code);
		else release(s, code);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex h-dvh w-full flex-col overflow-hidden bg-bg font-sans text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 opacity-80",
				style: { background: "radial-gradient(1200px 600px at 50% -10%, color-mix(in oklab, var(--color-cyan) 16%, transparent), transparent 60%)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan",
						children: "Fênix Blast"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-xs text-muted",
						children: "Ivan Moreira de Araújo"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-2",
					children: snap.phase === "playing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
						label: "Pausar",
						onClick: () => {
							stateRef.current.phase = "paused";
							setSnap(hud(stateRef.current));
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" })
					}) : snap.phase === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
						label: "Continuar",
						onClick: () => {
							stateRef.current.phase = "playing";
							setSnap(hud(stateRef.current));
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" })
					}) : null
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HudBar, { snap }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative max-h-full max-w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-[calc(var(--radius-lg)+6px)] border border-border bg-surface p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
							ref: canvasRef,
							width: MAP_W,
							height: MAP_H,
							className: "block h-auto max-h-[min(62dvh,520px)] w-full max-w-[min(100%,720px)] rounded-[var(--radius-md)] bg-ink",
							style: { imageRendering: "pixelated" }
						})
					}), !ready && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 grid place-items-center rounded-[var(--radius-lg)] bg-bg/70 text-sm text-muted",
						children: loadError ? `Falha ao carregar ${loadError}` : "Carregando arena…"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchPad, {
				visible: snap.phase === "playing",
				onDir: (dir, on) => {
					const map = {
						up: "KeyW",
						down: "KeyS",
						left: "KeyA",
						right: "KeyD"
					};
					if (touchDir.current && !on && touchDir.current === dir) {
						hold(map[dir], false);
						touchDir.current = null;
					} else if (on) {
						if (touchDir.current && touchDir.current !== dir) hold(map[touchDir.current], false);
						touchDir.current = dir;
						hold(map[dir], true);
					}
				},
				onBomb: (on) => hold("Space", on)
			}),
			snap.phase === "title" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Overlay, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: "/brand/logo.jpeg",
					alt: "Mascote fênix",
					className: "mx-auto h-36 w-36 rounded-[var(--radius-lg)] object-contain sm:h-44 sm:w-44"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl",
					children: "Fênix Blast"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mx-auto max-w-sm text-sm leading-relaxed text-muted",
					children: "O mascote de Ivan Moreira de Araújo entra na arena. Plante bombas, abra caminho entre as caixas e elimine os drones rivais."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-col items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryBtn, {
						onClick: begin,
						children: "Jogar"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhostBtn, {
						onClick: () => {
							stateRef.current.phase = "how";
							setSnap(hud(stateRef.current));
						},
						children: "Como jogar"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs tabular-nums text-muted",
					children: ["Recorde ", snap.hi]
				})
			] }),
			snap.phase === "how" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Overlay, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-semibold",
					children: "Como jogar"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mx-auto max-w-sm space-y-2 text-left text-sm leading-relaxed text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "Mover"
						}), " — WASD ou setas. No toque, use o pad."] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "Bomba"
						}), " — Espaço, J, ou o botão de fogo. A explosão segue uma cruz e quebra caixas."] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "Poderes"
						}), " — bomba extra, chama maior, velocidade e vida."] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "Objetivo"
						}), " — elimine os drones e entre no portal dourado."] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryBtn, {
					onClick: begin,
					children: "Começar"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhostBtn, {
					onClick: () => {
						stateRef.current.phase = "title";
						setSnap(hud(stateRef.current));
					},
					children: "Voltar"
				})
			] }),
			snap.phase === "paused" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Overlay, {
				dim: true,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl font-semibold",
						children: "Pausa"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryBtn, {
						onClick: () => {
							stateRef.current.phase = "playing";
							setSnap(hud(stateRef.current));
						},
						children: "Continuar"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhostBtn, {
						onClick: () => {
							stateRef.current.phase = "title";
							setSnap(hud(stateRef.current));
						},
						children: "Menu"
					})
				]
			}),
			snap.phase === "clear" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Overlay, {
				dim: true,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs uppercase tracking-[0.28em] text-cyan",
						children: "Arena limpa"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "font-display text-3xl font-semibold",
						children: [
							"Nível ",
							snap.level,
							" concluído"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [snap.score, " pontos"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryBtn, {
						onClick: goNext,
						children: snap.level >= 5 ? "Ver resultado" : "Próxima arena"
					})
				]
			}),
			snap.phase === "over" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Overlay, {
				dim: true,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs uppercase tracking-[0.28em] text-orange",
						children: "Fim de jogo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-3xl font-semibold",
						children: snap.level >= 5 && snap.lives > 0 ? "Fênix absoluta" : "A arena venceu"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							snap.score,
							" pontos · recorde ",
							snap.hi
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryBtn, {
						onClick: begin,
						children: "Jogar de novo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhostBtn, {
						onClick: () => {
							stateRef.current.phase = "title";
							setSnap(hud(stateRef.current));
						},
						children: "Menu"
					})
				]
			})
		]
	});
}
function HudBar({ snap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative z-10 mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 px-4 sm:grid-cols-5 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Pontos",
				value: String(snap.score)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Nível",
				value: `${snap.level}/5`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Vidas",
				value: String(snap.lives),
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-3.5 text-orange" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Bombas",
				value: `${snap.bombs}/${snap.bombsMax}`,
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bomb, { className: "size-3.5 text-cyan" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
				label: "Chama",
				value: String(snap.flame),
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-3.5 text-orange" }),
				className: "col-span-2 sm:col-span-1"
			})
		]
	});
}
function Stat({ label, value, icon, className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 ${className}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted",
			children: [icon, label]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-sm font-semibold tabular-nums text-fg",
			children: value
		})]
	});
}
function Overlay({ children, dim }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0 z-20 flex items-center justify-center px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute inset-0 ${dim ? "bg-bg/70" : "bg-bg/80"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-8",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-4",
				children
			})
		})]
	});
}
function PrimaryBtn({ children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "inline-flex h-12 min-w-44 items-center justify-center rounded-[var(--radius-md)] bg-cyan px-6 font-display text-base font-semibold text-ink transition-transform duration-[var(--motion-quick,150ms)] hover:brightness-110 active:scale-[0.98]",
		children
	});
}
function GhostBtn({ children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "inline-flex h-11 min-w-44 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent px-6 text-sm font-medium text-fg transition-colors hover:bg-surface-2",
		children
	});
}
function IconBtn({ children, onClick, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": label,
		onClick,
		className: "grid size-11 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface text-fg hover:bg-surface-2",
		children
	});
}
function TouchPad({ visible, onDir, onBomb }) {
	if (!visible) return null;
	const bind = (dir) => ({
		onPointerDown: (e) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			onDir(dir, true);
		},
		onPointerUp: () => onDir(dir, false),
		onPointerCancel: () => onDir(dir, false)
	});
	const cell = "grid size-12 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface/90 text-fg active:bg-cyan active:text-ink sm:size-14";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none relative z-10 flex items-end justify-between px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cell,
					"aria-label": "Cima",
					...bind("up"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cell,
					"aria-label": "Esquerda",
					...bind("left"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cell,
					"aria-label": "Direita",
					...bind("right"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: cell,
					"aria-label": "Baixo",
					...bind("down"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Bomba",
			className: "pointer-events-auto grid size-16 place-items-center rounded-full border border-orange bg-orange text-ink shadow-[0_8px_24px_rgba(255,122,0,0.35)] active:scale-95",
			onPointerDown: (e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				onBomb(true);
			},
			onPointerUp: () => onBomb(false),
			onPointerCancel: () => onBomb(false),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bomb, { className: "size-7" })
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameView, {});
}
//#endregion
export { Home as component };
