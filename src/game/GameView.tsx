import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Bomb, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Heart, Pause, Play } from "lucide-react";
import {
  COLS,
  createGame,
  drawFrame,
  hud,
  loadSprites,
  makeAudio,
  MAX_LEVEL,
  nextLevel,
  pixelOf,
  press,
  release,
  ROWS,
  setHeld,
  speedOf,
  startRun,
  step,
  TILE,
  yawOf,
  type GameState,
  type HudSnap,
  type SpriteName,
} from "./engine";

const MAP_W = COLS * TILE;
const MAP_H = ROWS * TILE;

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createGame());
  const spritesRef = useRef<Record<SpriteName, HTMLImageElement> | null>(null);
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState<HudSnap>(() => hud(stateRef.current));
  const [loadError, setLoadError] = useState<string | null>(null);
  const touchDir = useRef<string | null>(null);

  useEffect(() => {
    let dead = false;
    loadSprites()
      .then((sprites) => {
        if (dead) return;
        spritesRef.current = sprites;
        setReady(true);
      })
      .catch((err: Error) => {
        if (!dead) setLoadError(err.message);
      });
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
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
    const onUp = (e: KeyboardEvent) => release(s, e.code);
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

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    type Probe = {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getX: () => number;
      getY: () => number;
    };
    const probe: Probe = {
      getYaw: () => yawOf(s),
      getSpeed: () => speedOf(s),
      setKeys: (codes: string[]) => setHeld(s, codes),
      getX: () => pixelOf(s.player).x,
      getY: () => pixelOf(s.player).y,
    };
    window.__controlsTest = probe;

    let raf = 0;
    let lastHud = "";
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      if (!lastRef.current) lastRef.current = ms;
      let dt = (ms - lastRef.current) / 1000;
      lastRef.current = ms;
      if (dt > 0.1) dt = 0.1;
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
      if (sprites) drawFrame(ctx, s, sprites, ms / 1000);
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

  const hold = (code: string, on: boolean) => {
    const s = stateRef.current;
    if (on) press(s, code);
    else release(s, code);
  };

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg font-sans text-fg">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, color-mix(in oklab, var(--color-cyan) 16%, transparent), transparent 60%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div className="min-w-0">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan">
            Fênix Blast
          </p>
          <p className="truncate text-xs text-muted">Ivan Moreira de Araújo</p>
        </div>
        <div className="flex items-center gap-2">
          {snap.phase === "playing" ? (
            <IconBtn
              label="Pausar"
              onClick={() => {
                stateRef.current.phase = "paused";
                setSnap(hud(stateRef.current));
              }}
            >
              <Pause className="size-4" />
            </IconBtn>
          ) : snap.phase === "paused" ? (
            <IconBtn
              label="Continuar"
              onClick={() => {
                stateRef.current.phase = "playing";
                setSnap(hud(stateRef.current));
              }}
            >
              <Play className="size-4" />
            </IconBtn>
          ) : null}
        </div>
      </header>

      {snap.phase === "playing" || snap.phase === "paused" || snap.phase === "clear" || snap.phase === "over" ? (
        <HudBar snap={snap} />
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="relative max-h-full max-w-full">
          <div className="rounded-[calc(var(--radius-lg)+6px)] border border-border bg-surface p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <canvas
              ref={canvasRef}
              width={MAP_W}
              height={MAP_H}
              className="block h-auto max-h-[min(62dvh,520px)] w-full max-w-[min(100%,720px)] rounded-[var(--radius-md)] bg-ink"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          {!ready && (
            <div className="absolute inset-0 grid place-items-center rounded-[var(--radius-lg)] bg-bg/70 text-sm text-muted">
              {loadError ? `Falha ao carregar ${loadError}` : "Carregando arena…"}
            </div>
          )}
        </div>
      </div>

      <TouchPad
        visible={snap.phase === "playing"}
        onDir={(dir, on) => {
          const map: Record<string, string> = {
            up: "KeyW",
            down: "KeyS",
            left: "KeyA",
            right: "KeyD",
          };
          if (touchDir.current && !on && touchDir.current === dir) {
            hold(map[dir]!, false);
            touchDir.current = null;
          } else if (on) {
            if (touchDir.current && touchDir.current !== dir) hold(map[touchDir.current]!, false);
            touchDir.current = dir;
            hold(map[dir]!, true);
          }
        }}
        onBomb={(on) => hold("Space", on)}
      />

      {snap.phase === "title" && (
        <Overlay>
          <img
            src="/brand/logo.jpeg"
            alt="Mascote fênix"
            className="mx-auto h-36 w-36 rounded-[var(--radius-lg)] object-contain sm:h-44 sm:w-44"
          />
          <h1 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            Fênix Blast
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
            O mascote de Ivan Moreira de Araújo entra na arena. Plante bombas, abra caminho entre as
            caixas e elimine os drones rivais.
          </p>
          <div className="mt-2 flex flex-col items-center gap-2">
            <PrimaryBtn onClick={begin}>Jogar</PrimaryBtn>
            <GhostBtn
              onClick={() => {
                stateRef.current.phase = "how";
                setSnap(hud(stateRef.current));
              }}
            >
              Como jogar
            </GhostBtn>
          </div>
          <p className="text-xs tabular-nums text-muted">Recorde {snap.hi}</p>
        </Overlay>
      )}

      {snap.phase === "how" && (
        <Overlay>
          <h2 className="font-display text-2xl font-semibold">Como jogar</h2>
          <ul className="mx-auto max-w-sm space-y-2 text-left text-sm leading-relaxed text-muted">
            <li>
              <span className="text-fg">Mover</span> — WASD ou setas. No toque, use o pad.
            </li>
            <li>
              <span className="text-fg">Bomba</span> — Espaço, J, ou o botão de fogo. A explosão
              segue uma cruz e quebra caixas.
            </li>
            <li>
              <span className="text-fg">Poderes</span> — bomba extra, chama maior, velocidade e
              vida.
            </li>
            <li>
              <span className="text-fg">Objetivo</span> — elimine os drones e entre no portal
              dourado.
            </li>
          </ul>
          <PrimaryBtn onClick={begin}>Começar</PrimaryBtn>
          <GhostBtn
            onClick={() => {
              stateRef.current.phase = "title";
              setSnap(hud(stateRef.current));
            }}
          >
            Voltar
          </GhostBtn>
        </Overlay>
      )}

      {snap.phase === "paused" && (
        <Overlay dim>
          <h2 className="font-display text-2xl font-semibold">Pausa</h2>
          <PrimaryBtn
            onClick={() => {
              stateRef.current.phase = "playing";
              setSnap(hud(stateRef.current));
            }}
          >
            Continuar
          </PrimaryBtn>
          <GhostBtn
            onClick={() => {
              stateRef.current.phase = "title";
              setSnap(hud(stateRef.current));
            }}
          >
            Menu
          </GhostBtn>
        </Overlay>
      )}

      {snap.phase === "clear" && (
        <Overlay dim>
          <p className="font-display text-xs uppercase tracking-[0.28em] text-cyan">Arena limpa</p>
          <h2 className="font-display text-3xl font-semibold">Nível {snap.level} concluído</h2>
          <p className="text-sm text-muted">{snap.score} pontos</p>
          <PrimaryBtn onClick={goNext}>
            {snap.level >= MAX_LEVEL ? "Ver resultado" : "Próxima arena"}
          </PrimaryBtn>
        </Overlay>
      )}

      {snap.phase === "over" && (
        <Overlay dim>
          <p className="font-display text-xs uppercase tracking-[0.28em] text-orange">Fim de jogo</p>
          <h2 className="font-display text-3xl font-semibold">
            {snap.level >= MAX_LEVEL && snap.lives > 0 ? "Fênix absoluta" : "A arena venceu"}
          </h2>
          <p className="text-sm text-muted">
            {snap.score} pontos · recorde {snap.hi}
          </p>
          <PrimaryBtn onClick={begin}>Jogar de novo</PrimaryBtn>
          <GhostBtn
            onClick={() => {
              stateRef.current.phase = "title";
              setSnap(hud(stateRef.current));
            }}
          >
            Menu
          </GhostBtn>
        </Overlay>
      )}
    </div>
  );
}

function HudBar({ snap }: { snap: HudSnap }) {
  return (
    <div className="relative z-10 mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 px-4 sm:grid-cols-5 sm:px-6">
      <Stat label="Pontos" value={String(snap.score)} />
      <Stat label="Nível" value={`${snap.level}/${MAX_LEVEL}`} />
      <Stat
        label="Vidas"
        value={String(snap.lives)}
        icon={<Heart className="size-3.5 text-orange" />}
      />
      <Stat
        label="Bombas"
        value={`${snap.bombs}/${snap.bombsMax}`}
        icon={<Bomb className="size-3.5 text-cyan" />}
      />
      <Stat
        label="Chama"
        value={String(snap.flame)}
        icon={<Flame className="size-3.5 text-orange" />}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 ${className}`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
        {icon}
        {label}
      </span>
      <span className="font-display text-sm font-semibold tabular-nums text-fg">{value}</span>
    </div>
  );
}

function Overlay({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center px-4">
      <div className={`absolute inset-0 ${dim ? "bg-bg/80" : "bg-bg/92"}`} />
      <div className="relative w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-8">
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 min-w-44 items-center justify-center rounded-[var(--radius-md)] bg-cyan px-6 font-display text-base font-semibold text-ink transition-transform duration-[var(--motion-quick,150ms)] hover:brightness-110 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 min-w-44 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent px-6 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface text-fg hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function TouchPad({
  visible,
  onDir,
  onBomb,
}: {
  visible: boolean;
  onDir: (dir: "up" | "down" | "left" | "right", on: boolean) => void;
  onBomb: (on: boolean) => void;
}) {
  if (!visible) return null;
  const bind = (dir: "up" | "down" | "left" | "right") => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onDir(dir, true);
    },
    onPointerUp: () => onDir(dir, false),
    onPointerCancel: () => onDir(dir, false),
  });
  const cell =
    "grid size-12 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface/90 text-fg active:bg-cyan active:text-ink sm:size-14";
  return (
    <div className="pointer-events-none relative z-10 hidden max-sm:flex items-end justify-between px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1.5">
        <span />
        <button type="button" className={cell} aria-label="Cima" {...bind("up")}>
          <ChevronUp className="size-5" />
        </button>
        <span />
        <button type="button" className={cell} aria-label="Esquerda" {...bind("left")}>
          <ChevronLeft className="size-5" />
        </button>
        <span />
        <button type="button" className={cell} aria-label="Direita" {...bind("right")}>
          <ChevronRight className="size-5" />
        </button>
        <span />
        <button type="button" className={cell} aria-label="Baixo" {...bind("down")}>
          <ChevronDown className="size-5" />
        </button>
        <span />
      </div>
      <button
        type="button"
        aria-label="Bomba"
        className="pointer-events-auto grid size-16 place-items-center rounded-full border border-orange bg-orange text-ink shadow-[0_8px_24px_rgba(255,122,0,0.35)] active:scale-95"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onBomb(true);
        }}
        onPointerUp={() => onBomb(false)}
        onPointerCancel={() => onBomb(false)}
      >
        <Bomb className="size-7" />
      </button>
    </div>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getX?: () => number;
      getY?: () => number;
    };
  }
}
