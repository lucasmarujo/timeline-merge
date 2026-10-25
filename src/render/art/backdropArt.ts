import { GAME_HEIGHT, HALF_WIDTH } from '../../config';
import { mix, shade, withAlpha } from './color';
import type { Palette } from './palette';
import { PixelCanvas, type Point } from './PixelCanvas';
import { Rng } from '../../core/rng';
import { isDawn, softGlow, undersideProfile } from './stonework';

export enum BackdropLayerId {
  Far = 'far',
  Islands = 'islands',
  Ruins = 'ruins',
}

export interface BackdropLayerSpec {
  id: BackdropLayerId;
  scroll: number;
  factor: number;
  linear: boolean;
  seed: number;
}

export const BACKDROP_LAYERS: readonly BackdropLayerSpec[] = [
  { id: BackdropLayerId.Far, scroll: 0.08, factor: 4, linear: true, seed: 1201 },
  { id: BackdropLayerId.Islands, scroll: 0.2, factor: 2, linear: false, seed: 2203 },
  { id: BackdropLayerId.Ruins, scroll: 0.4, factor: 2, linear: false, seed: 3307 },
];

export const SKY_FACTOR = 4;

export function backdropWorldSize(spec: BackdropLayerSpec, worldWidth: number, worldHeight: number, viewWidth: number = HALF_WIDTH): { width: number; height: number } {
  return {
    width: spec.scroll * Math.max(0, worldWidth - viewWidth) + viewWidth + 96,
    height: spec.scroll * Math.max(0, worldHeight - GAME_HEIGHT) + GAME_HEIGHT + 64,
  };
}

function valueNoise(rng: Rng, length: number, spacing: number): (x: number) => number {
  const points = Array.from({ length: Math.ceil(length / spacing) + 3 }, () => rng.next());
  return (x: number) => {
    const position = x / spacing;
    const index = Math.floor(position);
    const t = position - index;
    const eased = t * t * (3 - 2 * t);
    const a = points[Math.max(0, Math.min(points.length - 1, index))] as number;
    const b = points[Math.max(0, Math.min(points.length - 1, index + 1))] as number;
    return a + (b - a) * eased;
  };
}

function cloudPuff(pc: PixelCanvas, x: number, y: number, radius: number, light: string, shadow: string, litFromRight: boolean, alpha: number): void {
  const ctx = pc.ctx;
  const gradient = ctx.createRadialGradient(x + (litFromRight ? radius * 0.35 : -radius * 0.35), y - radius * 0.45, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, withAlpha(light, alpha));
  gradient.addColorStop(0.65, withAlpha(mix(light, shadow, 0.55), alpha * 0.85));
  gradient.addColorStop(1, withAlpha(shadow, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function cloudBank(pc: PixelCanvas, x: number, y: number, width: number, scale: number, palette: Palette, rng: Rng, alpha: number): void {
  const puffs = Math.max(4, Math.round(width / (6 * scale)));
  for (let puff = 0; puff < puffs; puff++) {
    const t = puff / (puffs - 1);
    const radius = (5 + Math.sin(t * Math.PI) * 9 + rng.range(-2, 3)) * scale;
    cloudPuff(
      pc,
      x + t * width + rng.range(-3, 3) * scale,
      y - Math.sin(t * Math.PI) * 6 * scale + rng.range(-2, 2) * scale,
      radius,
      palette.cloudLight,
      palette.cloudShade,
      palette.lightDirection > 0,
      alpha,
    );
  }
}

export function paintSky(palette: Palette): PixelCanvas {
  const width = HALF_WIDTH / SKY_FACTOR;
  const height = GAME_HEIGHT / SKY_FACTOR;
  const pc = new PixelCanvas(width, height);
  pc.linearGradient(0, 0, width, height, [
    { at: 0, color: palette.skyTop },
    { at: 0.45, color: palette.skyMid },
    { at: 0.82, color: palette.skyLow },
    { at: 1, color: palette.skyLow },
  ]);
  const rng = new Rng(isDawn(palette) ? 11 : 12);
  const glowX = palette.lightDirection > 0 ? width : 0;
  if (!isDawn(palette)) {
    for (let star = 0; star < 140; star++) {
      pc.px(rng.range(0, width), rng.range(0, height * 0.65), withAlpha(rng.chance(0.3) ? '#e7d7ff' : '#9d8fd0', rng.range(0.25, 0.9)));
    }
    const moonX = 46;
    const moonY = 34;
    pc.radial(moonX, moonY, 26, [
      { at: 0, color: withAlpha(palette.skyGlow, 0) },
      { at: 0.5, color: withAlpha(palette.skyGlow, 0) },
      { at: 0.56, color: withAlpha(palette.accentBright, 0.7) },
      { at: 0.66, color: withAlpha(palette.skyGlow, 0.35) },
      { at: 1, color: withAlpha(palette.skyGlow, 0) },
    ]);
    pc.ellipse(moonX, moonY, 13.5, 13.5, palette.skyTop);
  }
  pc.radial(glowX, 30, width * 1.05, [
    { at: 0, color: withAlpha(palette.skyGlow, isDawn(palette) ? 0.95 : 0.6) },
    { at: 0.3, color: withAlpha(palette.skyGlow, isDawn(palette) ? 0.45 : 0.25) },
    { at: 1, color: withAlpha(palette.skyGlow, 0) },
  ]);
  for (let bank = 0; bank < 9; bank++) {
    const y = bank < 3 ? rng.range(20, 60) : rng.range(110, 172);
    const bankWidth = rng.range(30, 80);
    cloudBank(pc, rng.range(-20, width - 10), y, bankWidth, bank < 3 ? 0.55 : 1, palette, rng, bank < 3 ? 0.55 : 0.9);
  }
  pc.linearGradient(0, height * 0.72, width, height * 0.28, [
    { at: 0, color: withAlpha(palette.fog, 0) },
    { at: 1, color: withAlpha(palette.fog, isDawn(palette) ? 0.75 : 0.55) },
  ]);
  return pc;
}

export function paintCloudBand(palette: Palette): PixelCanvas {
  const width = 256;
  const height = 60;
  const pc = new PixelCanvas(width, height);
  const rng = new Rng(isDawn(palette) ? 41 : 42);
  for (let bank = 0; bank < 7; bank++) {
    const x = rng.range(0, width);
    const y = rng.range(26, 44);
    const bankWidth = rng.range(30, 60);
    for (const offset of [-width, 0, width]) {
      const local = new Rng(bank * 977 + 13);
      cloudBank(pc, x + offset, y, bankWidth, 0.9, palette, local, isDawn(palette) ? 0.7 : 0.6);
    }
  }
  return pc;
}

export function paintFogBand(): PixelCanvas {
  const width = 160;
  const height = 40;
  const pc = new PixelCanvas(width, height);
  const rng = new Rng(97);
  for (let blob = 0; blob < 40; blob++) {
    const x = rng.range(0, width);
    const y = rng.range(height * 0.35, height);
    const radius = rng.range(6, 16);
    for (const offset of [-width, 0, width]) {
      pc.radial(x + offset, y, radius, [
        { at: 0, color: 'rgba(255,255,255,0.35)' },
        { at: 1, color: 'rgba(255,255,255,0)' },
      ]);
    }
  }
  pc.linearGradient(0, height * 0.55, width, height * 0.45, [
    { at: 0, color: 'rgba(255,255,255,0)' },
    { at: 1, color: 'rgba(255,255,255,0.55)' },
  ]);
  return pc;
}

export function paintFarLayer(palette: Palette, width: number, height: number, seed: number): PixelCanvas {
  const pc = new PixelCanvas(width, height);
  const rng = new Rng(seed);
  const ranges = [
    { base: 0.66, amplitude: 0.16, color: mix(palette.silhouetteFar, palette.hazeFar, 0.55) },
    { base: 0.76, amplitude: 0.12, color: mix(palette.silhouetteFar, palette.hazeFar, 0.25) },
  ];
  for (let island = 0; island < Math.round(width / 26); island++) {
    const cx = rng.range(0, width);
    const top = rng.range(height * 0.2, height * 0.55);
    const islandWidth = rng.range(6, 18);
    const color = mix(palette.silhouetteFar, palette.hazeFar, 0.62);
    pc.rect(cx - islandWidth / 2, top, islandWidth, 2, color);
    pc.poly(undersideProfile(cx - islandWidth / 2, top + 1, islandWidth, islandWidth * 0.7, rng), color);
    if (rng.chance(0.5)) pc.rect(cx - 1, top - rng.int(3, 7), 2, 7, color);
  }
  for (const range of ranges) {
    const noise = valueNoise(rng, width, 22);
    const detail = valueNoise(rng, width, 6);
    const ridge: Point[] = [{ x: 0, y: height }];
    for (let x = 0; x <= width; x += 2) {
      const y = height * (range.base - range.amplitude * (noise(x) * 0.8 + detail(x) * 0.2));
      ridge.push({ x, y });
    }
    ridge.push({ x: width, y: height });
    pc.poly(ridge, range.color);
  }
  pc.atop(() => {
    pc.linearGradient(0, 0, width, height, [
      { at: 0, color: withAlpha(palette.hazeFar, 0) },
      { at: 0.7, color: withAlpha(palette.fog, isDawn(palette) ? 0.25 : 0.15) },
      { at: 1, color: withAlpha(palette.fog, isDawn(palette) ? 0.7 : 0.5) },
    ]);
  });
  if (!isDawn(palette)) {
    for (let light = 0; light < width / 8; light++) {
      pc.px(rng.range(0, width), rng.range(height * 0.6, height * 0.9), withAlpha(palette.accent, rng.range(0.3, 0.8)));
    }
  }
  return pc;
}

function paintWaterfallStrip(pc: PixelCanvas, x: number, top: number, length: number, palette: Palette, rng: Rng): void {
  for (let row = 0; row < length; row++) {
    const fade = 1 - row / length;
    const wobble = Math.round(Math.sin(row * 0.15 + x) * 0.6);
    pc.rect(x + wobble, top + row, 2, 1, withAlpha(palette.waterLight, 0.75 * fade));
    if (rng.chance(0.3)) pc.px(x + wobble + 2, top + row, withAlpha(palette.water, 0.5 * fade));
  }
  pc.radial(x + 1, top + length * 0.92, 8, [
    { at: 0, color: withAlpha(palette.waterLight, 0.35) },
    { at: 1, color: withAlpha(palette.waterLight, 0) },
  ]);
}

function paintChain(pc: PixelCanvas, x: number, top: number, bottom: number, color: string, light: string): void {
  for (let y = top; y < bottom; y += 3) {
    if (Math.round((y - top) / 3) % 2 === 0) pc.rect(x - 1, y, 2, 3, color);
    else pc.rect(x, y, 1, 3, light);
  }
}

function paintBackgroundIsland(pc: PixelCanvas, cx: number, top: number, islandWidth: number, palette: Palette, rng: Rng, haze: number, height: number): void {
  const base = mix(palette.silhouetteMid, palette.hazeFar, haze);
  const dark = shade(base, isDawn(palette) ? -0.18 : -0.3);
  const left = cx - islandWidth / 2;
  const ruins = rng.int(0, 3);
  for (let ruin = 0; ruin < ruins; ruin++) {
    const rx = left + rng.range(3, islandWidth - 5);
    const ruinHeight = rng.range(6, 22);
    if (isDawn(palette)) {
      pc.rect(rx, top - ruinHeight, 3, ruinHeight, shade(base, 0.12));
      pc.rect(rx - 1, top - ruinHeight, 5, 1, shade(base, 0.2));
    } else {
      pc.rect(rx, top - ruinHeight, 3, ruinHeight, dark);
      pc.poly([{ x: rx - 1, y: top - ruinHeight }, { x: rx + 4, y: top - ruinHeight }, { x: rx + 1.5, y: top - ruinHeight - 8 }], dark);
      pc.px(rx + 1, top - ruinHeight * 0.6, palette.accent);
    }
  }
  if (rng.chance(0.4) && islandWidth > 30) {
    const archX = left + islandWidth * rng.range(0.25, 0.6);
    const archHeight = rng.range(14, 26);
    pc.rect(archX, top - archHeight, 3, archHeight, shade(base, 0.08));
    pc.rect(archX + 12, top - archHeight, 3, archHeight, shade(base, 0.08));
    pc.ellipse(archX + 7.5, top - archHeight, 7.5, 5, shade(base, 0.08));
    pc.erase(() => pc.ellipse(archX + 7.5, top - archHeight + 1, 4.5, 3.5, '#000'));
    if (!isDawn(palette)) pc.erase(() => pc.rect(archX + 8, top - archHeight - 6, 8, 5, '#000'));
  }
  pc.rect(left, top, islandWidth, 3, base);
  pc.poly(undersideProfile(left, top + 2, islandWidth, islandWidth * rng.range(0.55, 0.9), rng), dark);
  pc.rect(left, top, islandWidth, 1, isDawn(palette) ? mix(palette.foliageLight, palette.hazeFar, haze) : palette.foliage);
  const rimX = palette.lightDirection > 0 ? left + islandWidth - 1 : left;
  pc.rect(rimX, top, 1, 3, withAlpha(palette.rim, 0.6));
  if (isDawn(palette) && rng.chance(0.4)) {
    paintWaterfallStrip(pc, left + rng.range(4, islandWidth - 6), top + 3, Math.min(height - top - 4, rng.range(40, 160)), palette, rng);
  }
  if (!isDawn(palette)) {
    if (rng.chance(0.5)) paintChain(pc, cx + rng.range(-islandWidth / 3, islandWidth / 3), 0, top - 2, dark, shade(dark, 0.25));
    for (let crystal = 0; crystal < 2; crystal++) {
      const sx = left + rng.range(4, islandWidth - 4);
      pc.px(sx, top + rng.range(4, islandWidth * 0.4), palette.accent);
    }
  }
}

export function paintIslandLayer(palette: Palette, width: number, height: number, seed: number): PixelCanvas {
  const pc = new PixelCanvas(width, height);
  const rng = new Rng(seed);
  const count = Math.round(width / 70);
  for (let island = 0; island < count; island++) {
    const local = new Rng(seed + island * 7919);
    const cx = (island + 0.5) * (width / count) + local.range(-20, 20);
    const top = local.range(height * 0.12, height * 0.62);
    const islandWidth = local.range(22, 78);
    const haze = 0.25 + (top / height) * 0.25;
    paintBackgroundIsland(pc, cx, top, islandWidth, palette, local, haze, height);
  }
  if (!isDawn(palette)) {
    for (let chain = 0; chain < width / 60; chain++) {
      const x = rng.range(0, width);
      paintChain(pc, x, 0, rng.range(height * 0.1, height * 0.45), palette.silhouetteMid, shade(palette.silhouetteMid, 0.2));
    }
  }
  return pc;
}

enum RuinKind {
  Gate = 'gate',
  Tower = 'tower',
  Colonnade = 'colonnade',
  Colossus = 'colossus',
  Aqueduct = 'aqueduct',
}

function ruinColors(palette: Palette): { body: string; light: string; dark: string } {
  const body = isDawn(palette) ? mix(palette.silhouetteNear, palette.hazeFar, 0.42) : palette.silhouetteNear;
  return {
    body,
    light: isDawn(palette) ? shade(body, 0.16) : mix(body, palette.stoneLight, 0.25),
    dark: shade(body, isDawn(palette) ? -0.12 : -0.25),
  };
}

function paintWindow(pc: PixelCanvas, glow: PixelCanvas, x: number, y: number, w: number, h: number, palette: Palette, dark: string): void {
  if (isDawn(palette)) {
    pc.rect(x, y, w, h, dark);
  } else {
    pc.rect(x, y, w, h, palette.accentDeep);
    pc.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, palette.accent);
    softGlow(glow, x + w / 2, y + h / 2, Math.max(w, h) * 1.6, palette.emissive, 0.45);
  }
}

function paintRuin(pc: PixelCanvas, glow: PixelCanvas, kind: RuinKind, x: number, top: number, bottom: number, palette: Palette, rng: Rng): void {
  const { body, light, dark } = ruinColors(palette);
  const height = bottom - top;
  const broken = !isDawn(palette);
  switch (kind) {
    case RuinKind.Gate: {
      const span = rng.range(34, 54);
      const pillar = rng.range(8, 12);
      pc.rect(x, top, pillar, height, body);
      pc.rect(x + span + pillar, top, pillar, height, body);
      pc.ellipse(x + pillar + span / 2, top, span / 2 + pillar, span * 0.45 + 4, body);
      pc.erase(() => {
        pc.rect(x + pillar, top, span, height, '#000');
        pc.ellipse(x + pillar + span / 2, top, span / 2, span * 0.45, '#000');
      });
      pc.rect(x, top, 1, height, light);
      pc.rect(x + span + pillar * 2 - 1, top, 1, height, light);
      const medallionY = top - span * 0.45 + 2;
      pc.ellipse(x + pillar + span / 2, medallionY, 4, 4, isDawn(palette) ? palette.accent : palette.accentDeep);
      if (broken) {
        softGlow(glow, x + pillar + span / 2, medallionY, 14, palette.emissive, 0.7);
        pc.erase(() => pc.poly([{ x: x + pillar + span * 0.55, y: top - span }, { x: x + span + pillar * 2 + 2, y: top - span }, { x: x + span + pillar * 2 + 2, y: top + 10 }], '#000'));
        paintChain(pc, x + pillar + span * 0.3, top - span * 0.3, top + height * 0.4, dark, light);
      }
      break;
    }
    case RuinKind.Tower: {
      const towerWidth = rng.range(16, 26);
      pc.rect(x, top, towerWidth, height, body);
      pc.rect(x, top, 1, height, light);
      if (broken) {
        pc.poly([{ x: x - 2, y: top + 1 }, { x: x + towerWidth + 2, y: top + 1 }, { x: x + towerWidth / 2, y: top - towerWidth * 2.2 }], body);
        pc.poly([{ x: x - 5, y: top + 18 }, { x: x + 1, y: top + 18 }, { x: x - 2, y: top + 2 }], body);
        pc.poly([{ x: x + towerWidth - 1, y: top + 22 }, { x: x + towerWidth + 5, y: top + 22 }, { x: x + towerWidth + 2, y: top + 6 }], body);
      } else {
        pc.ellipse(x + towerWidth / 2, top, towerWidth / 2 + 1, towerWidth / 2.4, body);
        pc.rect(x + towerWidth / 2 - 1, top - towerWidth / 2.4 - 6, 2, 6, light);
      }
      for (let level = top + 8; level < bottom - 20; level += rng.range(18, 28)) {
        paintWindow(pc, glow, x + towerWidth / 2 - 2, level, 4, 8, palette, dark);
      }
      break;
    }
    case RuinKind.Colonnade: {
      const columns = rng.int(4, 6);
      const spacing = rng.range(12, 16);
      for (let column = 0; column < columns; column++) {
        const brokenHeight = broken && column % 2 === 1 ? rng.range(0.3, 0.7) : 1;
        const columnTop = bottom - height * brokenHeight;
        pc.rect(x + column * spacing, columnTop, 5, bottom - columnTop, body);
        pc.rect(x + column * spacing, columnTop, 1, bottom - columnTop, light);
      }
      if (!broken) {
        pc.rect(x - 3, top - 5, (columns - 1) * spacing + 11, 5, body);
        pc.rect(x - 3, top - 5, (columns - 1) * spacing + 11, 1, light);
      } else {
        pc.rect(x - 3, top - 5, spacing * 1.5, 5, body);
      }
      break;
    }
    case RuinKind.Colossus: {
      const scale = rng.range(0.9, 1.3);
      const cx = x + 20 * scale;
      const headY = top + 10 * scale;
      pc.poly(
        [
          { x: cx - 8 * scale, y: headY + 10 * scale },
          { x: cx + 8 * scale, y: headY + 10 * scale },
          { x: cx + 22 * scale, y: bottom },
          { x: cx - 22 * scale, y: bottom },
        ],
        body,
      );
      pc.ellipse(cx, headY, 10 * scale, 12 * scale, body);
      pc.ellipse(cx + 1, headY + 3, 6 * scale, 7 * scale, dark);
      pc.line(cx, headY + 12 * scale, cx - 10 * scale, bottom, dark);
      pc.line(cx + 4, headY + 12 * scale, cx + 12 * scale, bottom, light);
      if (broken) {
        pc.erase(() => pc.poly([{ x: cx + 1, y: headY - 14 * scale }, { x: cx + 14 * scale, y: headY - 14 * scale }, { x: cx + 14 * scale, y: headY + 4 }], '#000'));
        pc.px(cx - 2, headY + 3, palette.accentBright);
        pc.px(cx + 3, headY + 3, palette.accentBright);
        softGlow(glow, cx, headY + 3, 14, palette.emissive, 0.9);
      } else {
        pc.ellipse(cx, headY + 22 * scale, 5 * scale, 5 * scale, palette.crystalCore);
        softGlow(glow, cx, headY + 22 * scale, 26 * scale, palette.emissive, 0.6);
      }
      break;
    }
    case RuinKind.Aqueduct: {
      const arches = rng.int(3, 5);
      const span = rng.range(22, 30);
      const deck = 7;
      for (let arch = 0; arch <= arches; arch++) {
        pc.rect(x + arch * span, top, 6, height, body);
      }
      pc.rect(x - 2, top - deck, arches * span + 10, deck + 6, body);
      pc.rect(x - 2, top - deck, arches * span + 10, 1, light);
      pc.erase(() => {
        for (let arch = 0; arch < arches; arch++) {
          const left = x + arch * span + 6;
          pc.ellipse(left + (span - 6) / 2, top + 6, (span - 6) / 2, 6, '#000');
          pc.rect(left, top + 6, span - 6, height, '#000');
        }
        if (broken) pc.rect(x + span * 1.6, top - deck - 1, span * 0.9, height + deck + 2, '#000');
      });
      if (isDawn(palette)) {
        paintWaterfallStrip(pc, x + span * 2.2, top + 4, Math.min(140, height - 10), palette, rng);
      } else {
        paintChain(pc, x + span * 1.55, top + 4, top + height * 0.5, dark, light);
      }
      break;
    }
  }
}

export function paintRuinsLayer(palette: Palette, width: number, height: number, seed: number): { canvas: PixelCanvas; glow: PixelCanvas } {
  const pc = new PixelCanvas(width, height);
  const glow = new PixelCanvas(width, height);
  const rng = new Rng(seed);
  const kinds = [RuinKind.Gate, RuinKind.Tower, RuinKind.Colonnade, RuinKind.Colossus, RuinKind.Aqueduct, RuinKind.Tower];
  let cursor = rng.range(10, 60);
  let index = 0;
  while (cursor < width - 20) {
    const local = new Rng(seed + index * 104729);
    const kind = kinds[(index + local.int(0, 2)) % kinds.length] as RuinKind;
    const top = local.range(height * 0.3, height * 0.58);
    paintRuin(pc, glow, kind, cursor, top, height, palette, local);
    cursor += local.range(110, 190);
    index += 1;
  }
  pc.atop(() => {
    pc.linearGradient(0, 0, width, height, [
      { at: 0, color: withAlpha(palette.rim, isDawn(palette) ? 0.1 : 0.04) },
      { at: 0.55, color: withAlpha(palette.fog, 0) },
      { at: 0.82, color: withAlpha(palette.fog, isDawn(palette) ? 0.55 : 0.4) },
      { at: 1, color: withAlpha(palette.fog, isDawn(palette) ? 0.9 : 0.75) },
    ]);
  });
  return { canvas: pc, glow };
}
