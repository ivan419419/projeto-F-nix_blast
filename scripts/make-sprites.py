#!/usr/bin/env python3
"""Downscale generated player frames to 32px and paint matching game props."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path("/workspace/public/sprites")
SRC_DOWN = Path("/workspace/assets/sprites/player_walk_down")
SRC_UP = Path("/workspace/assets/sprites/player_walk_up")
OUT.mkdir(parents=True, exist_ok=True)

# Brand palette
NAVY = (26, 26, 46, 255)
NAVY_HI = (42, 42, 74, 255)
NAVY_LO = (12, 12, 24, 255)
GRAPHITE = (22, 22, 32, 255)
CYAN = (0, 204, 255, 255)
CYAN_DIM = (0, 119, 170, 255)
CYAN_GLOW = (136, 238, 255, 255)
ORANGE = (255, 122, 0, 255)
ORANGE_HI = (255, 170, 51, 255)
RED = (220, 40, 28, 255)
RED_DK = (140, 16, 16, 255)
GOLD = (255, 215, 0, 255)
GOLD_HI = (255, 244, 160, 255)
WHITE = (255, 255, 255, 255)
YELLOW = (255, 220, 40, 255)
BLACK = (8, 8, 14, 255)
CRIMSON = (200, 24, 48, 255)


def despill(img: Image.Image) -> Image.Image:
    arr = np.array(img.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3]
    dist = np.sqrt((r - 255) ** 2 + g.astype(np.float32) ** 2 + (b - 255) ** 2)
    magenta = (dist < 90) | ((r > 170) & (b > 170) & (g < 140) & (r + b - 2 * g > 80))
    arr[magenta, 3] = 0
    # kill near-transparent jpeg dirt
    arr[a < 40, 3] = 0
    return Image.fromarray(arr)


def pixelize_frame(src: Path, size: int = 32) -> Image.Image:
    img = despill(Image.open(src))
    # Whole 256 canvas is already feet-aligned — scale as a unit.
    small = img.resize((size, size), Image.Resampling.BOX)
    arr = np.array(small)
    # Hard alpha
    arr[:, :, 3] = np.where(arr[:, :, 3] >= 96, 255, 0)
    # Despill again at low res
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    magenta = (r > 160) & (b > 160) & (g < 130)
    arr[magenta, 3] = 0
    return Image.fromarray(arr)


def save(img: Image.Image, name: str) -> None:
    dest = OUT / name
    img.save(dest)
    print(f"wrote {dest} {img.size} mode={img.mode}")


def assemble_strip(frames: list[Image.Image]) -> Image.Image:
    w, h = frames[0].size
    strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * w, 0), f)
    return strip


def new32() -> Image.Image:
    return Image.new("RGBA", (32, 32), (0, 0, 0, 0))


def px(draw: ImageDraw.ImageDraw, x: int, y: int, color, size: int = 1) -> None:
    draw.point((x, y), fill=color) if size == 1 else draw.rectangle(
        [x, y, x + size - 1, y + size - 1], fill=color
    )


def disk(img: Image.Image, cx: float, cy: float, radius: float, color) -> None:
    arr = np.array(img)
    yy, xx = np.ogrid[:32, :32]
    mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius**2
    arr[mask] = color
    img.paste(Image.fromarray(arr))


def ring(img: Image.Image, cx: float, cy: float, r0: float, r1: float, color) -> None:
    arr = np.array(img)
    yy, xx = np.ogrid[:32, :32]
    d = (xx - cx) ** 2 + (yy - cy) ** 2
    mask = (d >= r0**2) & (d <= r1**2)
    # don't overwrite fully transparent? we want to paint
    arr[mask] = color
    img.paste(Image.fromarray(arr))


def make_bomb() -> Image.Image:
    img = new32()
    # body
    disk(img, 15.5, 18.5, 10.4, NAVY_LO)
    disk(img, 15.5, 18.5, 9.2, GRAPHITE)
    disk(img, 15.5, 17.8, 8.2, NAVY)
    # highlight
    arr = np.array(img)
    arr[12, 12] = CYAN_GLOW
    arr[13, 11] = CYAN_DIM
    arr[12, 13] = WHITE
    img = Image.fromarray(arr)
    # cyan band
    for x in range(7, 25):
        for y in (17, 18, 19):
            dx = x - 15.5
            dy = y - 18.5
            if dx * dx + (dy * 1.6) ** 2 <= 9.5**2:
                img.putpixel((x, y), CYAN if y == 18 else CYAN_DIM)
    # gold gem
    for x, y, c in [
        (15, 18, GOLD_HI),
        (16, 18, GOLD),
        (15, 17, GOLD),
        (16, 19, GOLD),
        (14, 18, GOLD),
        (17, 18, GOLD),
    ]:
        img.putpixel((x, y), c)
    # fuse
    img.putpixel((15, 8), ORANGE_HI)
    img.putpixel((16, 8), ORANGE)
    img.putpixel((15, 9), (80, 70, 50, 255))
    img.putpixel((16, 9), (90, 80, 55, 255))
    img.putpixel((15, 10), (70, 60, 40, 255))
    img.putpixel((16, 10), (70, 60, 40, 255))
    img.putpixel((15, 11), NAVY_LO)
    img.putpixel((16, 11), NAVY)
    # spark
    img.putpixel((14, 6), WHITE)
    img.putpixel((15, 6), YELLOW)
    img.putpixel((16, 6), WHITE)
    img.putpixel((15, 5), ORANGE_HI)
    img.putpixel((15, 7), ORANGE)
    img.putpixel((13, 7), CYAN)
    img.putpixel((17, 7), CYAN)
    return img


def make_explosion_peak() -> Image.Image:
    """White core → yellow → orange → red, cyan ray tips. 32x32."""
    img = new32()
    cx, cy = 15.5, 15.5
    layers = [
        (15.2, RED_DK),
        (13.4, RED),
        (11.2, ORANGE),
        (8.6, ORANGE_HI),
        (6.2, YELLOW),
        (3.8, GOLD_HI),
        (2.0, WHITE),
    ]
    for rad, col in layers:
        disk(img, cx, cy, rad, col)
    # cyan lightning tips at 8 directions
    rays = [
        (15, 1),
        (16, 1),
        (15, 30),
        (16, 30),
        (1, 15),
        (1, 16),
        (30, 15),
        (30, 16),
        (4, 4),
        (27, 4),
        (4, 27),
        (27, 27),
        (7, 3),
        (24, 3),
        (3, 7),
        (3, 24),
        (28, 7),
        (28, 24),
        (7, 28),
        (24, 28),
    ]
    for x, y in rays:
        img.putpixel((x, y), CYAN)
    for x, y in [(15, 2), (16, 2), (2, 15), (2, 16), (29, 15), (29, 16), (15, 29), (16, 29)]:
        img.putpixel((x, y), CYAN_GLOW)
    # extra core sparkle
    img.putpixel((15, 15), WHITE)
    img.putpixel((16, 16), WHITE)
    img.putpixel((15, 16), GOLD_HI)
    img.putpixel((16, 15), GOLD_HI)
    return img


def make_explosion_frame(scale: float, fade: float = 1.0) -> Image.Image:
    peak = make_explosion_peak()
    arr = np.array(peak)
    # scale from center
    canvas = new32()
    w = max(4, int(32 * scale))
    h = w
    resized = peak.resize((w, h), Image.Resampling.NEAREST)
    x = (32 - w) // 2
    y = (32 - h) // 2
    if fade < 1:
        rarr = np.array(resized)
        rarr[:, :, 3] = (rarr[:, :, 3].astype(np.float32) * fade).astype(np.uint8)
        resized = Image.fromarray(rarr)
    canvas.paste(resized, (x, y), resized)
    return canvas


def make_explosion_arm(vertical: bool, tip: bool) -> Image.Image:
    img = new32()
    # bar through the tile
    if vertical:
        xs = range(11, 21)
        ys = range(0, 32 if not tip else 24)
        for y in ys:
            t = abs(y - 15.5) / 16
            for x in xs:
                d = abs(x - 15.5)
                if d < 1.2:
                    c = WHITE if t < 0.3 else YELLOW
                elif d < 2.4:
                    c = YELLOW if t < 0.5 else ORANGE
                elif d < 3.6:
                    c = ORANGE
                else:
                    c = RED
                img.putpixel((x, y), c)
        if tip:
            for y in range(0, 8):
                span = 4 + (7 - y)
                for x in range(16 - span // 2, 16 + span // 2 + 1):
                    if 0 <= x < 32:
                        img.putpixel((x, y), CYAN if y < 3 else ORANGE_HI)
            img.putpixel((15, 0), CYAN_GLOW)
            img.putpixel((16, 0), WHITE)
    else:
        ys = range(11, 21)
        xs = range(0, 32 if not tip else 24)
        for x in xs:
            t = abs(x - 15.5) / 16
            for y in ys:
                d = abs(y - 15.5)
                if d < 1.2:
                    c = WHITE if t < 0.3 else YELLOW
                elif d < 2.4:
                    c = YELLOW if t < 0.5 else ORANGE
                elif d < 3.6:
                    c = ORANGE
                else:
                    c = RED
                img.putpixel((x, y), c)
        if tip:
            for x in range(24, 32):
                span = 4 + (x - 24)
                for y in range(16 - span // 2, 16 + span // 2 + 1):
                    if 0 <= y < 32:
                        img.putpixel((x, y), CYAN if x > 28 else ORANGE_HI)
            img.putpixel((31, 15), CYAN_GLOW)
            img.putpixel((31, 16), WHITE)
    return img


def make_floor() -> Image.Image:
    img = Image.new("RGBA", (32, 32), NAVY_LO)
    arr = np.array(img)
    rng = np.random.default_rng(42)
    # subtle grain
    for _ in range(90):
        x = int(rng.integers(0, 32))
        y = int(rng.integers(0, 32))
        arr[y, x] = NAVY if rng.random() > 0.5 else (18, 18, 34, 255)
    img = Image.fromarray(arr)
    # exact 1px grid at 8 and 24 (user spec)
    cyan_line = (0, 170, 214, 255)
    cyan_bright = CYAN
    for i in range(32):
        img.putpixel((8, i), cyan_line)
        img.putpixel((24, i), cyan_line)
        img.putpixel((i, 8), cyan_line)
        img.putpixel((i, 24), cyan_line)
    # intersections pop
    for x, y in [(8, 8), (8, 24), (24, 8), (24, 24)]:
        img.putpixel((x, y), cyan_bright)
    return img


def make_wall() -> Image.Image:
    img = new32()
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, 30, 30], fill=NAVY_LO)
    d.rectangle([2, 2, 29, 29], fill=NAVY)
    d.rectangle([3, 3, 28, 12], fill=NAVY_HI)
    # gold trim
    d.rectangle([1, 1, 30, 1], fill=GOLD)
    d.rectangle([1, 30, 30, 30], fill=(180, 140, 20, 255))
    d.rectangle([1, 1, 1, 30], fill=GOLD)
    d.rectangle([30, 1, 30, 30], fill=(180, 140, 20, 255))
    # cyan corner bolts
    for x, y in [(3, 3), (28, 3), (3, 28), (28, 28)]:
        img.putpixel((x, y), CYAN)
        img.putpixel((x + 1 if x == 3 else x - 1, y), CYAN_DIM)
    # inner panel line
    d.rectangle([6, 16, 25, 16], fill=CYAN_DIM)
    d.rectangle([15, 8, 16, 24], fill=(20, 20, 40, 255))
    return img


def make_crate() -> Image.Image:
    img = new32()
    d = ImageDraw.Draw(img)
    d.rectangle([2, 2, 29, 29], fill=NAVY_LO)
    d.rectangle([3, 3, 28, 28], fill=(36, 28, 22, 255))
    d.rectangle([4, 4, 27, 14], fill=(52, 38, 26, 255))
    # orange chevrons
    for i, y in enumerate(range(8, 24, 3)):
        color = ORANGE if i % 2 == 0 else ORANGE_HI
        d.line([(6, y), (16, y + 4), (26, y)], fill=color)
    d.rectangle([2, 2, 29, 2], fill=ORANGE)
    d.rectangle([2, 29, 29, 29], fill=(160, 70, 0, 255))
    d.rectangle([2, 2, 2, 29], fill=ORANGE)
    d.rectangle([29, 2, 29, 29], fill=(160, 70, 0, 255))
    # gold phoenix speck
    img.putpixel((15, 16), GOLD)
    img.putpixel((16, 16), GOLD_HI)
    img.putpixel((15, 15), GOLD)
    return img


def make_enemy() -> Image.Image:
    img = new32()
    # hovering drone body
    disk(img, 15.5, 16.5, 8.4, BLACK)
    disk(img, 15.5, 16.0, 7.2, (28, 28, 36, 255))
    disk(img, 15.5, 15.2, 5.5, NAVY_HI)
    # crimson visor band
    for x in range(10, 22):
        img.putpixel((x, 15), CRIMSON)
        img.putpixel((x, 16), (255, 60, 70, 255) if 13 <= x <= 18 else CRIMSON)
        img.putpixel((x, 14), RED_DK)
    img.putpixel((15, 16), WHITE)
    img.putpixel((16, 16), (255, 180, 180, 255))
    # side fins
    for y in range(13, 20):
        img.putpixel((7, y), CYAN_DIM)
        img.putpixel((24, y), CYAN_DIM)
    img.putpixel((6, 16), CYAN)
    img.putpixel((25, 16), CYAN)
    # thruster
    img.putpixel((14, 24), ORANGE)
    img.putpixel((15, 24), ORANGE_HI)
    img.putpixel((16, 24), ORANGE_HI)
    img.putpixel((17, 24), ORANGE)
    img.putpixel((15, 25), YELLOW)
    img.putpixel((16, 25), WHITE)
    img.putpixel((15, 26), ORANGE)
    img.putpixel((16, 26), ORANGE)
    return img


def make_enemy_alt(base: Image.Image) -> Image.Image:
    img = base.copy()
    # bob thruster
    img.putpixel((15, 27), ORANGE_HI)
    img.putpixel((16, 27), YELLOW)
    img.putpixel((14, 23), ORANGE)
    img.putpixel((17, 23), ORANGE)
    return img


def make_powerup(kind: str) -> Image.Image:
    img = new32()
    d = ImageDraw.Draw(img)
    # pedestal
    d.ellipse([8, 22, 23, 29], fill=NAVY_LO)
    if kind == "bomb":
        disk(img, 15.5, 14.5, 7.0, GRAPHITE)
        for x in range(10, 22):
            img.putpixel((x, 14), CYAN)
            img.putpixel((x, 15), CYAN)
        img.putpixel((15, 14), GOLD)
        img.putpixel((16, 14), GOLD_HI)
        img.putpixel((15, 8), ORANGE_HI)
        img.putpixel((16, 7), WHITE)
    elif kind == "flame":
        disk(img, 15.5, 16.5, 6.5, RED)
        disk(img, 15.5, 15.5, 5.0, ORANGE)
        disk(img, 15.5, 14.5, 3.2, YELLOW)
        img.putpixel((15, 10), WHITE)
        img.putpixel((16, 11), GOLD_HI)
        img.putpixel((14, 12), ORANGE_HI)
        img.putpixel((17, 12), ORANGE)
    elif kind == "speed":
        # chevron
        for i in range(6):
            y = 10 + i
            span = 2 + i
            for x in range(16 - span, 16 + span):
                img.putpixel((x, y), CYAN if i < 4 else CYAN_GLOW)
        for i in range(5):
            y = 16 + i
            span = 5 - i
            for x in range(16 - span, 16 + span):
                img.putpixel((x, y), CYAN_DIM)
        img.putpixel((15, 12), WHITE)
        img.putpixel((16, 12), WHITE)
    else:  # life
        # mini crest
        for x, y in [
            (15, 8),
            (16, 8),
            (14, 9),
            (17, 9),
            (13, 10),
            (18, 10),
            (15, 10),
            (16, 10),
        ]:
            img.putpixel((x, y), ORANGE_HI)
        for x in range(12, 21):
            img.putpixel((x, 12), CYAN)
        disk(img, 15.5, 16.5, 5.0, NAVY)
        img.putpixel((14, 16), CYAN_GLOW)
        img.putpixel((17, 16), CYAN_GLOW)
        img.putpixel((15, 18), GOLD)
        img.putpixel((16, 18), GOLD)
    return img


def make_exit() -> Image.Image:
    img = new32()
    d = ImageDraw.Draw(img)
    d.rectangle([4, 4, 27, 27], fill=NAVY_LO)
    d.rectangle([6, 6, 25, 25], fill=(18, 12, 40, 255))
    d.rectangle([8, 8, 23, 23], outline=GOLD)
    d.rectangle([10, 10, 21, 21], outline=CYAN)
    img.putpixel((15, 15), GOLD_HI)
    img.putpixel((16, 16), GOLD)
    img.putpixel((15, 16), WHITE)
    img.putpixel((16, 15), CYAN)
    return img


def main() -> None:
    down = [pixelize_frame(SRC_DOWN / f"walk-{i}.png") for i in range(1, 5)]
    up = [pixelize_frame(SRC_UP / f"walk-{i}.png") for i in range(1, 5)]
    save(down[0], "player_idle.png")
    save(assemble_strip(down), "player_walk_down.png")
    save(assemble_strip(up), "player_walk_up.png")
    # side: use down frames flipped — still reads at 32px for a front-facing bomber
    right = [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in down]
    save(assemble_strip(right), "player_walk_right.png")
    left = [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in right]
    # left = original down (unflip of unflip). Better: keep down as left-facing substitute
    save(assemble_strip(down), "player_walk_left.png")

    bomb = make_bomb()
    save(bomb, "bomb_idle.png")

    peak = make_explosion_peak()
    save(peak, "explosion_center_01.png")
    save(make_explosion_frame(0.45), "explosion_center_00.png")
    save(make_explosion_frame(0.72), "explosion_center_02.png")
    save(make_explosion_frame(1.0, 0.55), "explosion_center_03.png")
    save(make_explosion_arm(False, False), "explosion_h.png")
    save(make_explosion_arm(True, False), "explosion_v.png")
    save(make_explosion_arm(False, True), "explosion_tip_e.png")
    save(make_explosion_arm(True, True), "explosion_tip_n.png")
    save(make_explosion_arm(True, True).transpose(Image.Transpose.FLIP_TOP_BOTTOM), "explosion_tip_s.png")
    save(make_explosion_arm(False, True).transpose(Image.Transpose.FLIP_LEFT_RIGHT), "explosion_tip_w.png")

    floor = make_floor()
    save(floor, "tile_floor.png")
    # 2x2 seam check
    check = Image.new("RGBA", (64, 64))
    for y in range(2):
        for x in range(2):
            check.paste(floor, (x * 32, y * 32))
    check.save("/workspace/assets/sprites/tiles/floor-2x2.png")

    save(make_wall(), "tile_wall.png")
    save(make_crate(), "tile_crate.png")
    enemy = make_enemy()
    save(enemy, "enemy_idle.png")
    save(assemble_strip([enemy, make_enemy_alt(enemy)]), "enemy_walk.png")
    save(make_powerup("bomb"), "power_bomb.png")
    save(make_powerup("flame"), "power_flame.png")
    save(make_powerup("speed"), "power_speed.png")
    save(make_powerup("life"), "power_life.png")
    save(make_exit(), "tile_exit.png")

    # 2x2 seam visual for floor
    print("floor 2x2 written")


if __name__ == "__main__":
    main()
