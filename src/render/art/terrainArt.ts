import { PIXEL } from '../../config';
import { SolidStyle } from '../../core/enums';
import { clamp } from '../../core/geometry';
import type { HazardDef, SolidDef } from '../../core/types';
import { mix, shade, withAlpha } from './color';
import type { Palette } from './palette';
import { PixelCanvas, type Point } from './PixelCanvas';
import { hashString, Rng } from '../../core/rng';
import {
  DEFAULT_MASONRY,
  isDawn,
  lightFace,
  paintCracks,
  paintMasonry,
  paintTopGrowth,
  paintUnderside,
  paintVine,
  rimEdges,
  softGlow,
  type PaintedSprite,
} from './stonework';

interface PaintContext {
  lw: number;
  lh: number;
  palette: Palette;
  shape: Rng;
  detail: Rng;
}

function canvases(width: number, height: number): { pc: PixelCanvas; glow: PixelCanvas } {
  return { pc: new PixelCanvas(width, height), glow: new PixelCanvas(width, height) };
}

function paintTerrace({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const depth = clamp(Math.round(lw * 0.42), 18, 84);
  const ax = 4;
  const ay = 6;
  const { pc, glow } = canvases(lw + 8, ay + lh + depth + 8);
  paintUnderside(pc, ax + 2, ay + lh - 2, lw - 4, depth, palette, shape, glow);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, DEFAULT_MASONRY, glow);
  pc.rect(ax, ay + 3, lw, 1, withAlpha(palette.ink, 0.25));
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintArchedWindow(pc: PixelCanvas, glow: PixelCanvas, x: number, y: number, w: number, h: number, palette: Palette, rng: Rng): void {
  pc.rect(x - 1, y + 3, w + 2, h - 2, palette.stoneLight);
  pc.ellipse(x + w / 2, y + 4, w / 2 + 1, 5, palette.stoneLight);
  pc.rect(x, y + 4, w, h - 4, palette.stoneDeep);
  pc.ellipse(x + w / 2, y + 4, w / 2, 4, palette.stoneDeep);
  if (isDawn(palette)) {
    pc.rect(x + 1, y + h - 3, w - 2, 2, palette.foliageDark);
    if (rng.chance(0.6)) paintVine(pc, x + rng.int(1, w - 2), y + 1, rng.int(4, h - 2), palette, rng);
  } else {
    pc.rect(x + 2, y + 6, w - 4, h - 8, mix(palette.stoneDeep, palette.accentDeep, 0.6));
    pc.rect(x + Math.floor(w / 2) - 1, y + 7, 2, h - 10, palette.accent);
    softGlow(glow, x + w / 2, y + h / 2, Math.max(w, h) * 0.8, palette.emissive, 0.6);
  }
}

function paintMesa({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const depth = 76;
  const ax = 4;
  const ay = 6;
  const { pc, glow } = canvases(lw + 8, ay + lh + depth + 8);
  paintUnderside(pc, ax + 2, ay + lh - 2, lw - 4, depth, palette, shape, glow);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 5, courseMax: 7, brickMin: 8, brickMax: 18, crackDensity: 0.0012 }, glow);
  for (let pilaster = ax + 24; pilaster < ax + lw - 16; pilaster += 72) {
    pc.rect(pilaster, ay + 6, 7, lh - 6, palette.stoneMid);
    pc.rect(pilaster, ay + 6, 1, lh - 6, palette.stoneLight);
    pc.rect(pilaster + 6, ay + 6, 1, lh - 6, palette.stoneDark);
    pc.rect(pilaster - 2, ay + 6, 11, 3, palette.stoneLight);
    pc.rect(pilaster - 2, ay + 9, 11, 1, palette.stoneDark);
    const bayCenter = pilaster + 36;
    if (bayCenter + 10 < ax + lw) {
      paintArchedWindow(pc, glow, bayCenter - 7, ay + 26, 14, 30, palette, detail);
      paintArchedWindow(pc, glow, bayCenter - 5, ay + 120, 10, 22, palette, detail);
    }
  }
  pc.rect(ax, ay + 1, lw, 3, palette.stoneLight);
  pc.rect(ax, ay + 4, lw, 1, palette.stoneDeep);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  if (isDawn(palette)) {
    for (let index = 0; index < lw / 30; index++) {
      paintVine(pc, ax + detail.int(4, lw - 4), ay + 3, detail.int(8, 40), palette, detail);
    }
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintBalustrade(pc: PixelCanvas, x: number, y: number, w: number, height: number, palette: Palette, rng: Rng, broken: boolean): void {
  if (!broken) {
    pc.rect(x, y - height, w, 2, palette.stoneLight);
    pc.rect(x, y - height + 2, w, 1, palette.stoneDark);
  }
  for (let post = x + 2; post < x + w - 2; post += 9) {
    if (broken && rng.chance(0.65)) continue;
    const postHeight = broken ? rng.int(2, height - 2) : height - 2;
    pc.rect(post, y - postHeight, 3, postHeight, palette.stoneMid);
    pc.rect(post, y - postHeight, 1, postHeight, palette.stoneLight);
    pc.rect(post + 2, y - postHeight, 1, postHeight, palette.stoneDark);
  }
}

function paintArchedSupports(
  pc: PixelCanvas,
  glow: PixelCanvas,
  x: number,
  top: number,
  w: number,
  spandrel: number,
  pierDepth: number,
  span: number,
  pierWidth: number,
  palette: Palette,
  rng: Rng,
): void {
  const support = new PixelCanvas(pc.width, pc.height);
  paintMasonry(support, x, top, w, spandrel + pierDepth, palette, rng, { courseMin: 4, courseMax: 6, brickMin: 5, brickMax: 11, crackDensity: 0.003 }, glow);
  support.erase(() => {
    for (let pier = x + pierWidth; pier < x + w; pier += span) {
      const openingLeft = pier;
      const openingRight = Math.min(pier + span - pierWidth, x + w);
      const openingWidth = openingRight - openingLeft;
      if (openingWidth <= 4) continue;
      const archTop = top + spandrel * 0.45;
      support.rect(openingLeft, archTop + openingWidth * 0.25, openingWidth, pierDepth + spandrel, '#000');
      support.ellipse(openingLeft + openingWidth / 2, archTop + openingWidth * 0.25, openingWidth / 2, openingWidth * 0.3, '#000');
    }
    support.linearGradient(x, top + spandrel + pierDepth * 0.35, w, pierDepth * 0.65, [
      { at: 0, color: 'rgba(0,0,0,0)' },
      { at: 1, color: 'rgba(0,0,0,1)' },
    ]);
  });
  support.atop(() => {
    support.linearGradient(x, top, w, spandrel + pierDepth, [
      { at: 0, color: withAlpha(palette.ink, 0.15) },
      { at: 1, color: withAlpha(palette.ink, 0.6) },
    ]);
  });
  pc.drawCanvas(support, 0, 0);
}

function paintDeck(pc: PixelCanvas, glow: PixelCanvas, x: number, y: number, w: number, h: number, palette: Palette, rng: Rng): void {
  paintMasonry(pc, x, y, w, h, palette, rng, { courseMin: 3, courseMax: 5, brickMin: 5, brickMax: 12, crackDensity: 0.004 }, glow);
  pc.rect(x, y, w, 2, palette.stoneLight);
  pc.rect(x, y + 2, w, 1, palette.stoneDark);
  const band = y + Math.floor(h / 2);
  pc.rect(x, band, w, 1, isDawn(palette) ? palette.accent : palette.stoneDeep);
  if (!isDawn(palette)) {
    for (let mark = x + 6; mark < x + w - 2; mark += 18) {
      pc.px(mark, band, palette.accent);
      glow.px(mark, band, palette.emissive);
    }
  }
  lightFace(pc, x, y, w, h, palette);
  rimEdges(pc, x, y, w, h, palette);
}

function paintBridge({ lw, lh, palette, shape, detail }: PaintContext, broken: boolean): PaintedSprite {
  const balustrade = 9;
  const spandrel = 12;
  const pierDepth = broken ? 30 : 48;
  const ax = 2;
  const ay = balustrade + 1;
  const { pc, glow } = canvases(lw + 4, ay + lh + spandrel + pierDepth + 4);
  paintArchedSupports(pc, glow, ax, ay + lh - 1, lw, spandrel, pierDepth, 58, 10, palette, shape);
  paintDeck(pc, glow, ax, ay, lw, lh, palette, shape);
  paintBalustrade(pc, ax, ay, lw, balustrade, palette, detail, broken);
  if (isDawn(palette)) {
    pc.rect(ax, ay, lw, 1, palette.foliage);
    for (let index = 0; index < lw / 16; index++) {
      paintVine(pc, ax + detail.int(2, lw - 2), ay + lh + detail.int(0, 4), detail.int(4, 20), palette, detail);
    }
  }
  if (broken) {
    pc.erase(() => {
      for (const side of [-1, 1]) {
        const edge = side < 0 ? ax : ax + lw;
        const points: Point[] = [{ x: edge, y: ay + 3 }];
        for (let step = 0; step <= 6; step++) {
          const depth = detail.int(2, 9);
          points.push({ x: edge - side * depth, y: ay + 3 + step * ((lh + spandrel + pierDepth) / 6) });
        }
        points.push({ x: edge + side * 4, y: ay + lh + spandrel + pierDepth + 4 });
        points.push({ x: edge + side * 4, y: ay + 3 });
        pc.poly(points, '#000');
      }
    });
    for (let index = 0; index < 3; index++) {
      const sx = ax + (index % 2 === 0 ? detail.int(3, 10) : lw - detail.int(4, 11));
      pc.rect(sx, ay + lh + spandrel + detail.int(2, 12), detail.int(2, 4), detail.int(2, 3), palette.stoneDark);
    }
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintViaduct({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const balustrade = 8;
  const spandrel = 26;
  const pierDepth = 120;
  const ax = 2;
  const ay = balustrade + 1;
  const { pc, glow } = canvases(lw + 4, ay + lh + spandrel + pierDepth + 4);
  paintArchedSupports(pc, glow, ax, ay + lh - 1, lw, spandrel, pierDepth, 118, 18, palette, shape);
  paintDeck(pc, glow, ax, ay, lw, lh, palette, shape);
  paintBalustrade(pc, ax, ay, lw, balustrade, palette, detail, false);
  if (isDawn(palette)) {
    pc.rect(ax, ay, lw, 1, palette.foliage);
    for (let index = 0; index < lw / 12; index++) {
      paintVine(pc, ax + detail.int(2, lw - 2), ay + lh + detail.int(0, 8), detail.int(6, 30), palette, detail);
    }
  } else {
    paintCracks(pc, ax, ay + lh, lw, spandrel, palette, detail, 0.004, glow);
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintSlab({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const depth = clamp(Math.round(lw * 0.4), 8, 26);
  const ax = 3;
  const ay = 6;
  const { pc, glow } = canvases(lw + 6, ay + lh + depth + 6);
  paintUnderside(pc, ax + 1, ay + lh - 1, lw - 2, depth, palette, shape, glow);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 3, courseMax: 5, brickMin: 5, brickMax: 12, crackDensity: 0.006 }, glow);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  if (!isDawn(palette)) {
    pc.rect(ax + 3, ay - 1, 2, 2, palette.metalLight);
    pc.rect(ax + lw - 5, ay - 1, 2, 2, palette.metalLight);
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintCrystalLedge({ lw, lh, palette, shape }: PaintContext): PaintedSprite {
  const ax = 3;
  const ay = 4;
  const { pc, glow } = canvases(lw + 6, ay + lh + 16);
  let cursor = ax;
  while (cursor < ax + lw) {
    const width = Math.min(shape.int(6, 11), ax + lw - cursor);
    if (width < 3) break;
    const drop = lh + shape.int(3, 12);
    const prism: Point[] = [
      { x: cursor, y: ay },
      { x: cursor + width, y: ay },
      { x: cursor + width - 1, y: ay + lh + shape.int(0, 3) },
      { x: cursor + width / 2, y: ay + drop },
      { x: cursor + 1, y: ay + lh + shape.int(0, 4) },
    ];
    pc.poly(prism, palette.crystalMid);
    pc.poly(
      [
        { x: cursor + width / 2, y: ay },
        { x: cursor + width, y: ay },
        { x: cursor + width - 1, y: ay + lh },
        { x: cursor + width / 2, y: ay + drop },
      ],
      palette.crystalCore,
    );
    pc.line(cursor, ay, cursor + 1, ay + lh, palette.crystalEdge);
    cursor += width;
  }
  pc.rect(ax, ay, lw, 1, palette.crystalCore);
  pc.rect(ax, ay + 1, lw, 1, palette.accentBright);
  for (let blob = ax + 6; blob < ax + lw; blob += 14) {
    softGlow(glow, blob, ay + lh / 2, 14, palette.crystalMid, 0.55);
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintLightStep({ lw, lh, palette, shape }: PaintContext): PaintedSprite {
  const ax = 3;
  const ay = 3;
  const { pc, glow } = canvases(lw + 6, ay + lh + 14);
  pc.rect(ax + 1, ay, lw - 2, lh, palette.accentBright);
  pc.rect(ax, ay + 1, lw, lh - 2, palette.accentBright);
  pc.rect(ax + 2, ay + 2, lw - 4, lh - 4, palette.crystalCore);
  for (let rune = ax + 5; rune < ax + lw - 4; rune += 7) {
    pc.rect(rune, ay + 3, 1, lh - 6, palette.accent);
    if (shape.chance(0.5)) pc.px(rune + 1, ay + 4, palette.accent);
  }
  for (let drip = ax + 4; drip < ax + lw - 2; drip += shape.int(5, 9)) {
    const length = shape.int(2, 9);
    for (let step = 0; step < length; step++) {
      if (step % 2 === 0) pc.px(drip, ay + lh + step, palette.accentBright);
    }
  }
  softGlow(glow, ax + lw / 2, ay + lh / 2, lw * 0.7, palette.emissive, 0.75);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintShard({ lw, lh, palette, shape }: PaintContext): PaintedSprite {
  const ax = 3;
  const ay = 3;
  const bulge = 7;
  const { pc, glow } = canvases(lw + 6, ay + lh + bulge + 6);
  const outline: Point[] = [
    { x: ax, y: ay },
    { x: ax + lw, y: ay },
    { x: ax + lw - 2, y: ay + lh },
  ];
  for (let step = 1; step < 8; step++) {
    const t = step / 8;
    outline.push({ x: ax + lw - 2 - (lw - 4) * t, y: ay + lh + Math.sin(Math.PI * t) * bulge });
  }
  outline.push({ x: ax + 2, y: ay + lh });
  pc.poly(outline, palette.stoneMid);
  pc.atop(() => {
    pc.linearGradient(ax, ay, lw, lh + bulge, [
      { at: 0, color: withAlpha(palette.stoneLight, 0.6) },
      { at: 1, color: withAlpha(palette.ink, 0.6) },
    ]);
  });
  pc.rect(ax, ay, lw, 1, palette.rim);
  const grooveY = ay + Math.floor(lh / 2) + 1;
  pc.rect(ax + 3, grooveY, lw - 6, 1, palette.stoneDeep);
  for (let rune = ax + 5; rune < ax + lw - 4; rune += shape.int(5, 8)) {
    pc.px(rune, grooveY, isDawn(palette) ? palette.accent : palette.accentBright);
    pc.px(rune, grooveY - 1, palette.accent);
    softGlow(glow, rune, grooveY, 6, palette.emissive, 0.7);
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintWard({ lw, lh, palette }: PaintContext): PaintedSprite {
  const ax = 8;
  const ay = 12;
  const { pc, glow } = canvases(lw + 16, ay + lh + 4);
  const body: Point[] = [
    { x: ax + 1, y: ay + 8 },
    { x: ax + lw / 2, y: ay - 8 },
    { x: ax + lw - 1, y: ay + 8 },
    { x: ax + lw, y: ay + lh },
    { x: ax, y: ay + lh },
  ];
  pc.poly(body, palette.crystalMid);
  pc.poly(
    [
      { x: ax + lw / 2, y: ay - 8 },
      { x: ax + lw - 1, y: ay + 8 },
      { x: ax + lw, y: ay + lh },
      { x: ax + lw / 2 + 1, y: ay + lh },
    ],
    palette.crystalCore,
  );
  pc.line(ax + 1, ay + 8, ax, ay + lh, palette.crystalEdge);
  for (let rune = ay + 10; rune < ay + lh - 10; rune += 8) {
    pc.rect(ax + lw / 2 - 1, rune, 2, 3, palette.accent);
  }
  pc.rect(ax - 3, ay + lh - 7, lw + 6, 7, palette.stoneLight);
  pc.rect(ax - 3, ay + lh - 7, lw + 6, 1, palette.rim);
  pc.rect(ax - 3, ay + lh - 1, lw + 6, 1, palette.stoneDark);
  softGlow(glow, ax + lw / 2, ay + lh * 0.45, lh * 0.55, palette.crystalMid, 0.6);
  softGlow(glow, ax + lw / 2, ay - 2, 18, palette.crystalCore, 0.8);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintSunSigil(pc: PixelCanvas, cx: number, cy: number, radius: number, color: string, core: string): void {
  for (let ray = 0; ray < 12; ray++) {
    const angle = (ray / 12) * Math.PI * 2;
    pc.line(cx + Math.cos(angle) * (radius + 1), cy + Math.sin(angle) * (radius + 1), cx + Math.cos(angle) * (radius + 3), cy + Math.sin(angle) * (radius + 3), color);
  }
  pc.ellipse(cx, cy, radius, radius, color);
  pc.ellipse(cx, cy, radius - 2, radius - 2, core);
}

function paintDoor({ lw, lh, palette }: PaintContext): PaintedSprite {
  const ax = 3;
  const ay = 3;
  const { pc, glow } = canvases(lw + 6, ay + lh + 3);
  pc.rect(ax, ay, lw, lh, palette.stoneDark);
  pc.rect(ax + 2, ay + 2, lw - 4, lh - 2, palette.stoneLight);
  pc.rect(ax + Math.floor(lw / 2) - 1, ay + 2, 2, lh - 2, palette.stoneMid);
  for (let band = ay + 14; band < ay + lh - 6; band += 22) {
    pc.rect(ax + 2, band, lw - 4, 2, palette.stoneMid);
    pc.px(ax + 4, band - 3, palette.accent);
    pc.px(ax + lw - 5, band - 3, palette.accent);
  }
  const sigilY = ay + Math.round(lh * 0.42);
  paintSunSigil(pc, ax + lw / 2, sigilY, 5, palette.accent, palette.accentBright);
  pc.rect(ax + Math.floor(lw / 2), ay + 2, 1, lh - 2, palette.accentBright);
  lightFace(pc, ax, ay, lw, lh, palette);
  softGlow(glow, ax + lw / 2, sigilY, 16, palette.emissive, 0.7);
  softGlow(glow, ax + lw / 2, ay + lh / 2, lh * 0.45, palette.emissive, 0.18);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintPortcullis({ lw, lh, palette, detail }: PaintContext): PaintedSprite {
  const ax = 2;
  const ay = 2;
  const { pc, glow } = canvases(lw + 4, ay + lh + 2);
  for (let bar = ax + 1; bar < ax + lw - 1; bar += 5) {
    pc.rect(bar, ay, 2, lh - 2, palette.metal);
    pc.px(bar, ay + lh - 2, palette.metal);
    pc.rect(bar + (palette.lightDirection > 0 ? 1 : 0), ay, 1, lh - 3, palette.metalLight);
    if (detail.chance(0.6)) {
      const glint = ay + detail.int(6, lh - 8);
      pc.px(bar, glint, palette.accent);
      glow.px(bar, glint, palette.emissive);
    }
  }
  for (let cross = ay + 6; cross < ay + lh - 4; cross += 14) {
    pc.rect(ax, cross, lw, 2, palette.metal);
    pc.rect(ax, cross, lw, 1, palette.metalLight);
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintPlinth({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const ax = 3;
  const ay = 5;
  const { pc, glow } = canvases(lw + 6, ay + lh + 4);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 5, courseMax: 7, brickMin: 7, brickMax: 14, crackDensity: 0.003 }, glow);
  for (let step = 0; step < 4; step++) {
    pc.rect(ax + 4 + step * 4, ay + 10 + step * 8, lw - 8 - step * 8, 1, palette.stoneDark);
  }
  pc.rect(ax - 1, ay, lw + 2, 3, palette.stoneLight);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintBalcony({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const railing = 9;
  const corbel = 10;
  const ax = 3;
  const ay = railing + 1;
  const { pc, glow } = canvases(lw + 6, ay + lh + corbel + 2);
  for (let bracket = ax + 4; bracket < ax + lw - 6; bracket += 16) {
    for (let level = 0; level < 4; level++) {
      pc.rect(bracket + level, ay + lh + level * 2, 7 - level * 2, 2, level % 2 ? palette.stoneMid : palette.stoneDark);
    }
  }
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 3, courseMax: 4, brickMin: 6, brickMax: 12, crackDensity: 0.004 }, glow);
  pc.rect(ax - 1, ay, lw + 2, 2, palette.stoneLight);
  lightFace(pc, ax, ay, lw, lh, palette);
  paintBalustrade(pc, ax, ay, lw, railing, palette, detail, !isDawn(palette));
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintFacade({ lw, lh, palette, shape }: PaintContext): PaintedSprite {
  const ax = 5;
  const ay = 5;
  const { pc, glow } = canvases(lw + 10, ay + lh + 4);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 5, courseMax: 7, brickMin: 8, brickMax: 16, crackDensity: 0.002 }, glow);
  pc.rect(ax - 4, ay, lw + 8, 4, palette.stoneLight);
  pc.rect(ax - 4, ay + 4, lw + 8, 1, palette.stoneDeep);
  pc.rect(ax - 2, ay + 5, lw + 4, 2, palette.stoneMid);
  const friezeTop = ay + 16;
  const friezeHeight = 30;
  pc.rect(ax + 4, friezeTop, lw - 8, friezeHeight, shade(palette.stoneMid, isDawn(palette) ? 0.05 : -0.1));
  pc.rect(ax + 4, friezeTop, lw - 8, 1, palette.stoneLight);
  pc.rect(ax + 4, friezeTop + friezeHeight - 1, lw - 8, 1, palette.stoneDark);
  const centerX = ax + lw / 2;
  const centerY = friezeTop + friezeHeight / 2;
  if (isDawn(palette)) {
    paintSunSigil(pc, centerX, centerY, 8, palette.accent, palette.accentBright);
    softGlow(glow, centerX, centerY, 26, palette.emissive, 0.55);
  } else {
    pc.ellipse(centerX, centerY, 11, 6, palette.stoneDeep);
    pc.ellipse(centerX, centerY, 9, 4, palette.accentDeep);
    pc.ellipse(centerX, centerY, 3, 3, palette.accentBright);
    pc.line(centerX + 4, friezeTop + 2, centerX - 2, friezeTop + friezeHeight - 2, palette.stoneDeep);
    softGlow(glow, centerX, centerY, 30, palette.emissive, 0.8);
  }
  for (const side of [-1, 1]) {
    const figureX = centerX + side * 30;
    pc.rect(figureX - 3, friezeTop + 8, 6, 18, palette.stoneLight);
    pc.ellipse(figureX, friezeTop + 7, 3, 3, palette.stoneLight);
    pc.rect(figureX - 3 + (side > 0 ? 5 : 0), friezeTop + 8, 1, 18, palette.stoneDark);
  }
  for (let dentil = ax + 2; dentil < ax + lw - 2; dentil += 4) {
    pc.rect(dentil, ay + 52, 2, 3, palette.stoneLight);
  }
  pc.rect(ax, ay + lh - 9, lw, 9, palette.stoneMid);
  pc.rect(ax, ay + lh - 9, lw, 1, palette.stoneLight);
  pc.rect(ax, ay + lh - 1, lw, 1, palette.stoneDeep);
  lightFace(pc, ax, ay, lw, lh, palette);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintFloor({ lw, lh, palette, detail }: PaintContext): PaintedSprite {
  const corbel = 10;
  const ax = 2;
  const ay = 2;
  const { pc, glow } = canvases(lw + 4, ay + lh + corbel + 2);
  for (let bracket = ax + 6; bracket < ax + lw - 6; bracket += 20) {
    for (let level = 0; level < 4; level++) {
      pc.rect(bracket + level, ay + lh + level * 2, 8 - level * 2, 2, level % 2 ? palette.stoneMid : palette.stoneDark);
    }
  }
  for (let tile = 0; tile * 8 < lw; tile++) {
    const color = tile % 2 === 0 ? palette.stoneLight : palette.stoneMid;
    pc.rect(ax + tile * 8, ay, 8, lh, color);
    pc.rect(ax + tile * 8, ay + lh - 4, 8, 4, shade(color, -0.12));
  }
  pc.rect(ax, ay + 2, lw, 1, palette.accent);
  pc.rect(ax, ay + lh - 5, lw, 1, palette.accentDeep);
  pc.speckle(ax, ay, lw, lh, detail, 0.04, [palette.stoneDark, palette.rim]);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintRubble({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const ax = 2;
  const ay = 6;
  const { pc, glow } = canvases(lw + 4, ay + lh + 4);
  pc.rect(ax, ay + 4, lw, lh - 4, palette.stoneDeep);
  for (let stone = 0; stone < lw * 0.6; stone++) {
    const sx = ax + shape.range(0, lw);
    const sy = ay + shape.range(0, lh * 0.7);
    pc.ellipse(sx, sy + 3, shape.range(2, 5), shape.range(1.5, 3.5), mix(palette.stoneDark, palette.stoneMid, shape.next()));
  }
  paintCracks(pc, ax, ay, lw, lh, palette, detail, 0.01, glow);
  lightFace(pc, ax, ay, lw, lh, palette);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintTower({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const depth = 40;
  const ax = 4;
  const ay = 6;
  const { pc, glow } = canvases(lw + 8, ay + lh + depth + 6);
  paintUnderside(pc, ax + 2, ay + lh - 2, lw - 4, depth, palette, shape, glow);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 5, courseMax: 7, brickMin: 8, brickMax: 16, crackDensity: 0.002 }, glow);
  pc.rect(ax, ay, 5, lh, palette.stoneMid);
  pc.rect(ax + lw - 5, ay, 5, lh, palette.stoneMid);
  for (let level = 0; level < 3; level++) {
    paintArchedWindow(pc, glow, ax + lw / 2 - 6, ay + 30 + level * 70, 12, 28, palette, detail);
  }
  pc.rect(ax - 2, ay, lw + 4, 3, palette.stoneLight);
  pc.rect(ax - 2, ay + 3, lw + 4, 1, palette.stoneDeep);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintWall({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const ax = 2;
  const ay = 6;
  const { pc, glow } = canvases(lw + 4, ay + lh);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 6, courseMax: 9, brickMin: 10, brickMax: 22, crackDensity: 0.0012 }, glow);
  for (let pilaster = ax + 12; pilaster < ax + lw - 8; pilaster += 46) {
    pc.rect(pilaster, ay, 9, lh, palette.stoneMid);
    pc.rect(pilaster, ay, 1, lh, palette.stoneLight);
    pc.rect(pilaster + 8, ay, 1, lh, palette.stoneDark);
  }
  for (let level = ay + 40; level < ay + lh - 60; level += 120) {
    paintArchedWindow(pc, glow, ax + lw / 2 - 8, level, 16, 36, palette, detail);
  }
  pc.rect(ax - 1, ay, lw + 2, 3, palette.stoneLight);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  if (isDawn(palette)) {
    for (let index = 0; index < lw / 10; index++) {
      paintVine(pc, ax + detail.int(2, lw - 2), ay + detail.int(0, 20), detail.int(10, 80), palette, detail);
    }
  }
  pc.erase(() => {
    pc.linearGradient(0, ay + lh - 120, pc.width, 120, [
      { at: 0, color: 'rgba(0,0,0,0)' },
      { at: 1, color: 'rgba(0,0,0,1)' },
    ]);
  });
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintDrifter({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const depth = clamp(Math.round(lw * 0.32), 10, 22);
  const ax = 3;
  const ay = 6;
  const { pc, glow } = canvases(lw + 6, ay + lh + depth + 12);
  paintUnderside(pc, ax + 2, ay + lh - 1, lw - 4, depth, palette, shape, glow);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 3, courseMax: 4, brickMin: 6, brickMax: 12, crackDensity: 0.003 }, glow);
  pc.rect(ax, ay, lw, 1, palette.rim);
  pc.rect(ax, ay + lh - 2, lw, 1, palette.accent);
  for (let rune = ax + 4; rune < ax + lw - 3; rune += 6) {
    pc.px(rune, ay + lh - 2, palette.accentBright);
    glow.px(rune, ay + lh - 2, palette.emissive);
  }
  const cx = ax + lw / 2;
  const tip = ay + lh + depth + 6;
  pc.poly(
    [
      { x: cx - 4, y: ay + lh + depth * 0.4 },
      { x: cx + 4, y: ay + lh + depth * 0.4 },
      { x: cx, y: tip },
    ],
    palette.crystalMid,
  );
  pc.px(cx, tip - 2, palette.crystalCore);
  softGlow(glow, cx, tip - 4, 14, palette.emissive, 0.9);
  lightFace(pc, ax, ay, lw, lh, palette);
  rimEdges(pc, ax, ay, lw, lh, palette);
  paintTopGrowth(pc, ax, ay, lw, palette, detail, glow);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

function paintCrumble({ lw, lh, palette, shape, detail }: PaintContext): PaintedSprite {
  const ax = 3;
  const ay = 5;
  const depth = 8;
  const { pc, glow } = canvases(lw + 6, ay + lh + depth + 6);
  paintUnderside(pc, ax + 2, ay + lh - 1, lw - 4, depth, palette, shape, glow);
  paintMasonry(pc, ax, ay, lw, lh, palette, shape, { courseMin: 3, courseMax: 4, brickMin: 4, brickMax: 9, crackDensity: 0.05 }, glow);
  pc.erase(() => {
    for (let notch = 0; notch < Math.max(3, lw / 10); notch++) {
      const nx = ax + shape.int(0, lw - 2);
      const top = shape.chance(0.5);
      pc.rect(nx, top ? ay : ay + lh - 2, shape.int(1, 3), shape.int(1, 2), '#000');
    }
  });
  for (let fissure = 0; fissure < Math.max(2, lw / 18); fissure++) {
    let fx = ax + shape.int(3, lw - 4);
    for (let row = ay; row < ay + lh; row++) {
      pc.px(fx, row, isDawn(palette) ? palette.stoneDeep : palette.accent);
      if (!isDawn(palette)) glow.px(fx, row, palette.emissive);
      fx += shape.int(-1, 1);
    }
  }
  pc.rect(ax, ay, lw, 1, withAlpha(palette.rim, 0.7));
  lightFace(pc, ax, ay, lw, lh, palette);
  for (let pebble = 0; pebble < 4; pebble++) {
    pc.rect(ax + detail.int(2, lw - 3), ay + lh + depth + detail.int(0, 4), 2, 2, palette.stoneDark);
  }
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}

export function paintSolid(solid: SolidDef, palette: Palette): PaintedSprite {
  const context: PaintContext = {
    lw: Math.round(solid.w / PIXEL),
    lh: Math.round(solid.h / PIXEL),
    palette,
    shape: new Rng(hashString(solid.id)),
    detail: new Rng(hashString(`${solid.id}:${palette.timeline}`)),
  };
  switch (solid.style) {
    case SolidStyle.Terrace:
      return paintTerrace(context);
    case SolidStyle.Mesa:
      return paintMesa(context);
    case SolidStyle.Bridge:
      return paintBridge(context, false);
    case SolidStyle.BrokenBridge:
      return paintBridge(context, true);
    case SolidStyle.Viaduct:
      return paintViaduct(context);
    case SolidStyle.Slab:
      return paintSlab(context);
    case SolidStyle.Crystal:
      return paintCrystalLedge(context);
    case SolidStyle.LightStep:
      return paintLightStep(context);
    case SolidStyle.Shard:
      return paintShard(context);
    case SolidStyle.Ward:
      return paintWard(context);
    case SolidStyle.Door:
      return paintDoor(context);
    case SolidStyle.Portcullis:
      return paintPortcullis(context);
    case SolidStyle.Stair:
      return paintPlinth(context);
    case SolidStyle.Balcony:
      return paintBalcony(context);
    case SolidStyle.Facade:
      return paintFacade(context);
    case SolidStyle.Floor:
      return paintFloor(context);
    case SolidStyle.Rubble:
      return paintRubble(context);
    case SolidStyle.Tower:
      return paintTower(context);
    case SolidStyle.Wall:
      return paintWall(context);
    case SolidStyle.Drifter:
      return paintDrifter(context);
    case SolidStyle.Crumble:
      return paintCrumble(context);
  }
}

export function paintHazard(hazard: HazardDef, palette: Palette): PaintedSprite {
  const lw = Math.round(hazard.w / PIXEL);
  const lh = Math.round(hazard.h / PIXEL);
  const rng = new Rng(hashString(hazard.id));
  const ax = 3;
  const ay = 10;
  const { pc, glow } = canvases(lw + 6, ay + lh + 3);
  const stem = mix(palette.ink, palette.accentDeep, 0.45);
  const stemLight = mix(palette.accentDeep, palette.accent, 0.35);
  for (let strand = 0; strand < lw * 0.7; strand++) {
    let x = ax + rng.range(0, lw);
    let y = ay + lh;
    const height = rng.range(lh * 0.5, lh + ay - 2);
    const lean = rng.range(-0.6, 0.6);
    for (let step = 0; step < height; step++) {
      pc.px(x, y, step % 4 === 0 ? stemLight : stem);
      if (step % 3 === 1 && rng.chance(0.6)) pc.px(x + (rng.chance(0.5) ? 1 : -1), y, stem);
      x += lean + Math.sin(step * 0.5 + strand) * 0.4;
      y -= 1;
    }
    pc.px(x, y, palette.accentBright);
    if (rng.chance(0.5)) softGlow(glow, x, y, 5, palette.emissive, 0.8);
  }
  pc.rect(ax, ay + lh - 2, lw, 2, stem);
  softGlow(glow, ax + lw / 2, ay + lh * 0.6, lw * 0.6, palette.accentDeep, 0.35);
  return { canvas: pc, anchorX: ax, anchorY: ay, glow };
}
