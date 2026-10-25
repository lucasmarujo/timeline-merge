import { Timeline } from '../../core/enums';
import { mix, shade, withAlpha } from './color';
import type { Palette } from './palette';
import type { PixelCanvas, Point } from './PixelCanvas';
import type { Rng } from '../../core/rng';

export interface PaintedSprite {
  canvas: PixelCanvas;
  anchorX: number;
  anchorY: number;
  glow?: PixelCanvas;
}

export interface MasonryOptions {
  courseMin: number;
  courseMax: number;
  brickMin: number;
  brickMax: number;
  crackDensity: number;
}

export const DEFAULT_MASONRY: MasonryOptions = {
  courseMin: 4,
  courseMax: 6,
  brickMin: 6,
  brickMax: 14,
  crackDensity: 0.004,
};

export function isDawn(palette: Palette): boolean {
  return palette.timeline === Timeline.Dawn;
}

function brickTone(palette: Palette, rng: Rng): string {
  const tone = rng.range(-1, 1);
  return tone > 0
    ? mix(palette.stoneMid, palette.stoneLight, tone * 0.55)
    : mix(palette.stoneMid, palette.stoneDark, -tone * 0.5);
}

export function paintMasonry(
  pc: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette,
  rng: Rng,
  options: MasonryOptions = DEFAULT_MASONRY,
  glow?: PixelCanvas,
): void {
  pc.rect(x, y, w, h, palette.mortar);
  let row = y;
  while (row < y + h) {
    const courseHeight = rng.int(options.courseMin, options.courseMax);
    let brickX = x - rng.int(0, options.brickMax);
    while (brickX < x + w) {
      const brickWidth = rng.int(options.brickMin, options.brickMax);
      const left = Math.max(brickX + 1, x);
      const right = Math.min(brickX + brickWidth, x + w);
      const top = row + 1;
      const bottom = Math.min(row + courseHeight, y + h);
      if (right > left && bottom > top) {
        const base = brickTone(palette, rng);
        pc.rect(left, top, right - left, bottom - top, base);
        pc.rect(left, top, right - left, 1, shade(base, 0.1));
        if (bottom - top > 2) pc.rect(left, bottom - 1, right - left, 1, shade(base, -0.12));
        if (rng.chance(0.3)) pc.px(left, top, palette.mortar);
        if (rng.chance(0.2)) pc.px(right - 1, bottom - 1, palette.mortar);
        pc.speckle(left, top, right - left, bottom - top, rng, 0.05, [shade(base, -0.1), shade(base, 0.08)]);
      }
      brickX += brickWidth;
    }
    row += courseHeight;
  }
  paintCracks(pc, x, y, w, h, palette, rng, options.crackDensity, glow);
}

export function paintCracks(
  pc: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette,
  rng: Rng,
  density: number,
  glow?: PixelCanvas,
): void {
  const count = Math.max(1, Math.round(w * h * density));
  for (let index = 0; index < count; index++) {
    let cx = x + rng.int(2, Math.max(2, w - 3));
    let cy = y + rng.int(1, Math.max(1, h - 2));
    const emissive = !isDawn(palette) && rng.chance(0.45);
    const color = emissive ? palette.accent : palette.stoneDeep;
    const length = rng.int(3, 9);
    for (let step = 0; step < length; step++) {
      if (cx < x || cx >= x + w || cy < y || cy >= y + h) break;
      pc.px(cx, cy, color);
      if (emissive && glow) glow.px(cx, cy, palette.emissive);
      cx += rng.int(-1, 1);
      cy += 1;
    }
  }
}

export function lightFace(pc: PixelCanvas, x: number, y: number, w: number, h: number, palette: Palette): void {
  pc.atop(() => {
    pc.linearGradient(x, y, w, h, [
      { at: 0, color: withAlpha(palette.rim, isDawn(palette) ? 0.16 : 0.1) },
      { at: 0.35, color: withAlpha(palette.rim, 0) },
      { at: 1, color: withAlpha(palette.ink, isDawn(palette) ? 0.32 : 0.45) },
    ]);
    const litFromRight = palette.lightDirection > 0;
    pc.linearGradient(
      x,
      y,
      w,
      h,
      [
        { at: 0, color: withAlpha(litFromRight ? palette.ink : palette.rim, litFromRight ? 0.12 : 0.1) },
        { at: 0.5, color: withAlpha(palette.ink, 0) },
        { at: 1, color: withAlpha(litFromRight ? palette.rim : palette.ink, litFromRight ? 0.14 : 0.12) },
      ],
      false,
    );
  });
}

export function rimEdges(pc: PixelCanvas, x: number, y: number, w: number, h: number, palette: Palette): void {
  pc.rect(x, y, w, 1, withAlpha(palette.rim, isDawn(palette) ? 0.85 : 0.6));
  const side = palette.lightDirection > 0 ? x + w - 1 : x;
  pc.rect(side, y, 1, h, withAlpha(palette.rim, isDawn(palette) ? 0.5 : 0.4));
}

export function undersideProfile(x: number, y: number, w: number, depth: number, rng: Rng): Point[] {
  const points: Point[] = [{ x, y }];
  const steps = Math.max(5, Math.round(w / 5));
  const seed = rng.range(0, 10);
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.75);
    const ripple = 0.72 + 0.28 * Math.sin(t * 11 + seed);
    const drip = rng.chance(0.12) ? 1.3 : rng.range(0.78, 1.04);
    points.push({ x: x + w * t, y: y + 2 + depth * envelope * ripple * drip });
  }
  points.push({ x: x + w, y });
  return points;
}

export function paintUnderside(
  pc: PixelCanvas,
  x: number,
  y: number,
  w: number,
  depth: number,
  palette: Palette,
  rng: Rng,
  glow?: PixelCanvas,
): void {
  if (depth < 3 || w < 3) return;
  const profile = undersideProfile(x, y, w, depth, rng);
  pc.poly(profile, palette.earthDark);
  pc.atop(() => {
    let band = y;
    while (band < y + depth + 4) {
      const height = rng.int(2, 5);
      const tone = rng.range(0, 1);
      pc.rect(x, band, w, height, mix(palette.earthDark, palette.earthLight, tone * 0.6));
      band += height;
    }
    for (let index = 0; index < w * 0.25; index++) {
      const rx = x + rng.range(0, w);
      const ry = y + rng.range(0, depth * 0.8);
      pc.ellipse(rx, ry, rng.range(1.5, 3.5), rng.range(1, 2.5), mix(palette.earthLight, palette.stoneDark, rng.next()));
    }
    pc.speckle(x, y, w, depth, rng, 0.04, [palette.stoneDeep, palette.earthLight]);
    pc.linearGradient(x, y, w, depth + 6, [
      { at: 0, color: withAlpha(palette.ink, 0.05) },
      { at: 1, color: withAlpha(palette.ink, isDawn(palette) ? 0.55 : 0.7) },
    ]);
    const litFromRight = palette.lightDirection > 0;
    pc.linearGradient(
      x,
      y,
      w,
      depth,
      [
        { at: 0, color: withAlpha(palette.rim, litFromRight ? 0 : 0.12) },
        { at: 1, color: withAlpha(palette.rim, litFromRight ? 0.12 : 0) },
      ],
      false,
    );
  });

  if (isDawn(palette)) {
    const roots = Math.round(w / 9);
    for (let index = 0; index < roots; index++) {
      const rx = x + rng.range(2, w - 2);
      const length = rng.int(4, Math.max(5, Math.round(depth * 0.9)));
      paintVine(pc, rx, y + rng.int(0, 3), length, palette, rng);
    }
  } else {
    const spikes = Math.round(w / 14);
    for (let index = 0; index < spikes; index++) {
      const sx = x + rng.range(4, w - 4);
      const t = (sx - x) / w;
      const bottom = y + 2 + depth * Math.pow(Math.sin(Math.PI * t), 0.75) * 0.7;
      const length = rng.int(3, 7);
      pc.poly(
        [
          { x: sx - 1.5, y: bottom - 2 },
          { x: sx + 1.5, y: bottom - 2 },
          { x: sx, y: bottom + length },
        ],
        palette.crystalMid,
      );
      pc.px(sx, bottom + length - 1, palette.crystalCore);
      glow?.radial(sx, bottom + length - 2, 6, [
        { at: 0, color: withAlpha(palette.emissive, 0.7) },
        { at: 1, color: withAlpha(palette.emissive, 0) },
      ]);
    }
  }
}

export function paintVine(pc: PixelCanvas, x: number, y: number, length: number, palette: Palette, rng: Rng): void {
  let vx = x;
  for (let step = 0; step < length; step++) {
    const color = step % 3 === 0 ? palette.foliageDark : palette.foliage;
    pc.px(vx, y + step, color);
    if (rng.chance(0.35)) {
      const side = rng.chance(0.5) ? -1 : 1;
      pc.px(vx + side, y + step, rng.chance(0.5) ? palette.foliageLight : palette.foliage);
    }
    if (rng.chance(0.18)) vx += rng.chance(0.5) ? -1 : 1;
  }
  if (rng.chance(0.4)) pc.px(vx, y + length, palette.flower);
}

export function paintTopGrowth(pc: PixelCanvas, x: number, y: number, w: number, palette: Palette, rng: Rng, glow?: PixelCanvas): void {
  if (isDawn(palette)) {
    pc.rect(x, y, w, 2, palette.foliage);
    pc.rect(x, y, w, 1, palette.foliageLight);
    for (let index = 0; index < w * 0.35; index++) {
      const bx = x + rng.int(0, w - 1);
      const height = rng.int(1, 3);
      pc.rect(bx, y - height, 1, height, rng.chance(0.5) ? palette.foliage : palette.foliageLight);
      if (height >= 2 && rng.chance(0.18)) pc.px(bx, y - height - 1, palette.flower);
    }
    for (let index = 0; index < w * 0.12; index++) {
      pc.px(x + rng.int(0, w - 1), y + 2, palette.foliageDark);
    }
  } else {
    pc.rect(x, y, w, 1, palette.foliage);
    pc.rect(x, y + 1, w, 1, palette.foliageDark);
    for (let index = 0; index < w * 0.12; index++) {
      const bx = x + rng.int(0, w - 1);
      pc.rect(bx, y - rng.int(1, 2), 1, 2, palette.foliageLight);
    }
    const shards = Math.max(1, Math.round(w / 22));
    for (let index = 0; index < shards; index++) {
      const sx = x + rng.int(2, Math.max(2, w - 3));
      const height = rng.int(2, 5);
      pc.poly(
        [
          { x: sx - 1, y: y + 1 },
          { x: sx + 2, y: y + 1 },
          { x: sx + 0.5, y: y - height },
        ],
        palette.crystalMid,
      );
      pc.px(sx, y - height + 1, palette.crystalCore);
      glow?.radial(sx + 0.5, y - height / 2, 7, [
        { at: 0, color: withAlpha(palette.emissive, 0.75) },
        { at: 1, color: withAlpha(palette.emissive, 0) },
      ]);
    }
  }
}

export function softGlow(pc: PixelCanvas | undefined, cx: number, cy: number, radius: number, color: string, alpha: number): void {
  pc?.radial(cx, cy, radius, [
    { at: 0, color: withAlpha(color, alpha) },
    { at: 0.45, color: withAlpha(color, alpha * 0.35) },
    { at: 1, color: withAlpha(color, 0) },
  ]);
}
