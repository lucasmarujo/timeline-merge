import { PIXEL } from '../../config';
import { DecorKind } from '../../core/enums';
import type { DecorDef } from '../../core/types';
import { mix, shade, withAlpha } from './color';
import type { Palette } from './palette';
import { PixelCanvas, type Point } from './PixelCanvas';
import { paintBellFrame } from './propArt';
import { hashString, Rng } from './rng';
import { isDawn, paintCracks, paintVine, softGlow, type PaintedSprite } from './stonework';

function sprite(width: number, height: number, anchorX: number, anchorY: number): PaintedSprite & { canvas: PixelCanvas; glow: PixelCanvas } {
  return {
    canvas: new PixelCanvas(width, height),
    glow: new PixelCanvas(width, height),
    anchorX,
    anchorY,
  };
}

function finish(result: PaintedSprite, palette: Palette, rimStrength = 0.45): PaintedSprite {
  result.canvas.rim(palette.rim, palette.lightDirection, -1, rimStrength);
  return result;
}

function paintColumn(decor: DecorDef, palette: Palette, shape: Rng, detail: Rng): PaintedSprite {
  const height = Math.round((decor.size ?? 200) / PIXEL);
  const result = sprite(24, height + 4, 12, height + 2);
  const { canvas: pc, glow } = result;
  const bottom = height + 2;
  const brokenAt = isDawn(palette) ? 0 : Math.round(height * shape.range(0.35, 0.6));
  const top = bottom - height + brokenAt;
  pc.rect(3, bottom - 5, 18, 5, palette.stoneMid);
  pc.rect(3, bottom - 5, 18, 1, palette.stoneLight);
  pc.rect(5, top + 6, 14, bottom - top - 11, palette.stoneMid);
  for (let flute = 7; flute < 18; flute += 3) {
    pc.rect(flute, top + 7, 1, bottom - top - 13, shade(palette.stoneMid, -0.12));
  }
  pc.rect(5, top + 6, 1, bottom - top - 11, palette.stoneLight);
  pc.rect(18, top + 6, 1, bottom - top - 11, palette.stoneDark);
  if (isDawn(palette)) {
    pc.rect(2, top, 20, 3, palette.stoneLight);
    pc.rect(4, top + 3, 16, 3, palette.stoneMid);
    pc.rect(4, top + 5, 16, 1, palette.stoneDark);
    for (let vine = 0; vine < 2; vine++) {
      paintVine(pc, detail.int(6, 17), top + 2, detail.int(Math.round(height * 0.2), Math.round(height * 0.6)), palette, detail);
    }
  } else {
    const jag: Point[] = [{ x: 5, y: top + 8 }];
    for (let step = 0; step <= 5; step++) jag.push({ x: 5 + step * 2.8, y: top + detail.int(0, 7) });
    jag.push({ x: 19, y: top + 8 });
    pc.erase(() => pc.rect(0, 0, 24, top + 8, '#000'));
    pc.poly(jag, palette.stoneMid);
    paintCracks(pc, 5, top + 8, 14, bottom - top - 14, palette, detail, 0.012, glow);
    pc.rect(20, bottom - 3, 4, 3, palette.stoneDark);
  }
  return finish(result, palette);
}

function paintStatue(decor: DecorDef, palette: Palette, detail: Rng): PaintedSprite {
  const scale = decor.size ?? 1;
  const w = Math.round(34 * scale);
  const h = Math.round(80 * scale);
  const result = sprite(w + 8, h + 6, (w + 8) / 2, h + 4);
  const { canvas: pc, glow } = result;
  const cx = (w + 8) / 2;
  const base = h + 4;
  pc.rect(cx - w / 2, base - 10 * scale, w, 10 * scale, palette.stoneDark);
  pc.rect(cx - w / 2, base - 10 * scale, w, 2, palette.stoneMid);
  const robeTop = base - h + 18 * scale;
  pc.poly(
    [
      { x: cx - 6 * scale, y: robeTop },
      { x: cx + 6 * scale, y: robeTop },
      { x: cx + 13 * scale, y: base - 10 * scale },
      { x: cx - 13 * scale, y: base - 10 * scale },
    ],
    palette.stoneMid,
  );
  pc.poly(
    [
      { x: cx, y: robeTop },
      { x: cx + 6 * scale, y: robeTop },
      { x: cx + 13 * scale, y: base - 10 * scale },
      { x: cx + 2 * scale, y: base - 10 * scale },
    ],
    shade(palette.stoneMid, palette.lightDirection > 0 ? 0.12 : -0.12),
  );
  for (let fold = -2; fold <= 2; fold++) {
    pc.line(cx + fold * 3 * scale, robeTop + 6, cx + fold * 4.5 * scale, base - 11 * scale, palette.stoneDark);
  }
  const headY = base - h + 11 * scale;
  pc.ellipse(cx, headY, 7 * scale, 8 * scale, palette.stoneMid);
  pc.ellipse(cx + 1, headY + 2, 4 * scale, 5 * scale, palette.stoneDeep);
  const orbY = robeTop + 10 * scale;
  if (isDawn(palette)) {
    pc.rect(cx - 8 * scale, orbY + 3, 16 * scale, 3, palette.stoneLight);
    pc.ellipse(cx, orbY, 4 * scale, 4 * scale, palette.crystalCore);
    pc.ellipse(cx, orbY, 2 * scale, 2 * scale, palette.accentBright);
    softGlow(glow, cx, orbY, 22 * scale, palette.emissive, 0.75);
  } else {
    pc.erase(() => pc.poly([{ x: cx + 2, y: headY - 9 * scale }, { x: cx + 9 * scale, y: headY - 9 * scale }, { x: cx + 9 * scale, y: headY + 4 }], '#000'));
    pc.px(cx - 1, headY + 2, palette.accentBright);
    pc.px(cx + 2, headY + 2, palette.accentBright);
    softGlow(glow, cx, headY + 2, 9 * scale, palette.emissive, 0.8);
    paintCracks(pc, cx - 10 * scale, robeTop, 20 * scale, h * 0.5, palette, detail, 0.02, glow);
    pc.rect(cx + 9 * scale, base - 14 * scale, 5 * scale, 4 * scale, palette.stoneDark);
  }
  return finish(result, palette);
}

function paintTree(palette: Palette, shape: Rng, detail: Rng): PaintedSprite {
  const result = sprite(72, 84, 36, 82);
  const { canvas: pc, glow } = result;
  const trunk = isDawn(palette) ? '#b7a98c' : palette.stoneDeep;
  const trunkDark = isDawn(palette) ? '#7d7058' : palette.ink;
  pc.poly(
    [
      { x: 32, y: 82 },
      { x: 40, y: 82 },
      { x: 38, y: 40 },
      { x: 35, y: 40 },
    ],
    trunk,
  );
  pc.rect(37, 44, 1, 38, trunkDark);
  const branches: Array<[number, number, number, number]> = [];
  for (let branch = 0; branch < 6; branch++) {
    const startY = shape.int(36, 58);
    const side = branch % 2 === 0 ? -1 : 1;
    const length = shape.int(10, 24);
    branches.push([36, startY, 36 + side * length, startY - shape.int(8, 20)]);
  }
  for (const [x0, y0, x1, y1] of branches) {
    pc.thickLine(x0, y0, x1, y1, 2, trunk);
  }
  if (isDawn(palette)) {
    for (let clump = 0; clump < 14; clump++) {
      const cx = shape.range(12, 60);
      const cy = shape.range(10, 42);
      const radius = shape.range(6, 11);
      pc.ellipse(cx, cy, radius, radius * 0.8, palette.foliageDark);
      pc.ellipse(cx + palette.lightDirection, cy - 1, radius * 0.8, radius * 0.6, palette.foliage);
      pc.ellipse(cx + palette.lightDirection * 2, cy - 2, radius * 0.45, radius * 0.35, palette.foliageLight);
    }
    pc.speckle(10, 6, 52, 38, detail, 0.03, [palette.flower, palette.foliageLight]);
  } else {
    for (const [, , x1, y1] of branches) {
      pc.thickLine(x1, y1, x1 + detail.int(-6, 6), y1 - detail.int(4, 10), 1, trunk);
      pc.px(x1, y1, palette.accent);
      softGlow(glow, x1, y1, 5, palette.emissive, 0.7);
    }
  }
  return finish(result, palette, 0.35);
}

function paintArch(decor: DecorDef, palette: Palette, shape: Rng, detail: Rng): PaintedSprite {
  const height = Math.round((decor.size ?? 280) / PIXEL);
  const opening = 26;
  const pillar = 10;
  const w = opening + pillar * 2;
  const result = sprite(w + 8, height + 4, (w + 8) / 2, height + 2);
  const { canvas: pc, glow } = result;
  const left = 4;
  const bottom = height + 2;
  const springY = bottom - height + opening / 2 + 6;
  pc.rect(left, springY, pillar, bottom - springY, palette.stoneMid);
  pc.rect(left + pillar + opening, springY, pillar, bottom - springY, palette.stoneMid);
  pc.ellipse(left + w / 2, springY, w / 2, w / 2 - 2, palette.stoneMid);
  pc.erase(() => {
    pc.rect(left + pillar, springY, opening, bottom - springY, '#000');
    pc.ellipse(left + w / 2, springY, opening / 2, opening / 2 - 1, '#000');
  });
  for (let course = springY + 4; course < bottom; course += 6) {
    pc.rect(left, course, pillar, 1, palette.stoneDark);
    pc.rect(left + pillar + opening, course, pillar, 1, palette.stoneDark);
  }
  pc.rect(left + 1, springY, 1, bottom - springY, palette.stoneLight);
  pc.rect(left + w - 2, springY, 1, bottom - springY, palette.stoneLight);
  const medallionY = springY - w / 2 + 6;
  pc.ellipse(left + w / 2, medallionY, 5, 5, isDawn(palette) ? palette.accent : palette.stoneDeep);
  pc.ellipse(left + w / 2, medallionY, 3, 3, isDawn(palette) ? palette.accentBright : palette.accent);
  softGlow(glow, left + w / 2, medallionY, 12, palette.emissive, isDawn(palette) ? 0.6 : 0.8);
  if (isDawn(palette)) {
    for (let vine = 0; vine < 4; vine++) {
      paintVine(pc, left + detail.int(0, w), springY - detail.int(0, 12), detail.int(10, 40), palette, detail);
    }
  } else {
    pc.erase(() =>
      pc.poly(
        [
          { x: left + w / 2 + 2, y: 0 },
          { x: w + 8, y: 0 },
          { x: w + 8, y: springY + shape.int(16, 30) },
          { x: left + w - 3, y: springY + 8 },
          { x: left + w / 2 + 6, y: springY - 8 },
        ],
        '#000',
      ),
    );
    for (let stone = 0; stone < 5; stone++) {
      pc.rect(left + w - 4 + detail.int(-2, 6), bottom - detail.int(2, 5), detail.int(3, 5), detail.int(2, 4), palette.stoneDark);
    }
  }
  return finish(result, palette);
}

function paintBanner(palette: Palette, detail: Rng): PaintedSprite {
  const result = sprite(20, 60, 3, 58);
  const { canvas: pc, glow } = result;
  pc.rect(2, 2, 2, 56, palette.metal);
  pc.rect(2, 2, 16, 2, palette.metal);
  const cloth = isDawn(palette) ? palette.cape : mix(palette.accentDeep, palette.ink, 0.4);
  const clothShade = isDawn(palette) ? palette.capeShade : palette.ink;
  const bottom: Point[] = [];
  for (let step = 0; step <= 4; step++) {
    bottom.push({ x: 17 - step * 3, y: 34 + (isDawn(palette) ? (step % 2) * 3 : detail.int(-6, 4)) });
  }
  pc.poly([{ x: 5, y: 4 }, { x: 17, y: 4 }, ...bottom], cloth);
  pc.rect(5, 4, 2, 30, clothShade);
  if (isDawn(palette)) {
    pc.ellipse(11, 16, 3, 3, palette.accent);
    pc.rect(5, 6, 12, 1, palette.accent);
  } else {
    pc.ellipse(11, 16, 3, 2, palette.accent);
    softGlow(glow, 11, 16, 8, palette.emissive, 0.6);
    pc.erase(() => pc.poly([{ x: 12, y: 22 }, { x: 18, y: 18 }, { x: 18, y: 30 }], '#000'));
  }
  return finish(result, palette, 0.3);
}

function paintCrystalCluster(palette: Palette, shape: Rng): PaintedSprite {
  const result = sprite(30, 26, 15, 24);
  const { canvas: pc, glow } = result;
  for (let crystal = 0; crystal < 5; crystal++) {
    const x = shape.range(6, 24);
    const height = shape.range(6, 18);
    const width = shape.range(2.5, 4.5);
    const lean = shape.range(-3, 3);
    pc.poly(
      [
        { x: x - width, y: 24 },
        { x: x + width, y: 24 },
        { x: x + lean + width * 0.4, y: 24 - height },
        { x: x + lean, y: 24 - height - 3 },
      ],
      palette.crystalMid,
    );
    pc.poly(
      [
        { x: x, y: 24 },
        { x: x + width, y: 24 },
        { x: x + lean + width * 0.4, y: 24 - height },
        { x: x + lean, y: 24 - height - 3 },
      ],
      palette.crystalCore,
    );
    softGlow(glow, x + lean / 2, 24 - height / 2, height, palette.emissive, 0.55);
  }
  pc.rect(4, 23, 22, 2, palette.stoneDark);
  return result;
}

function paintHanging(decor: DecorDef, palette: Palette, detail: Rng): PaintedSprite {
  const length = Math.round((decor.size ?? 100) / PIXEL);
  const result = sprite(18, length + 8, 9, 0);
  const { canvas: pc, glow } = result;
  if (isDawn(palette)) {
    for (let strand = 0; strand < 4; strand++) {
      paintVine(pc, detail.int(4, 14), 0, detail.int(Math.round(length * 0.4), length), palette, detail);
    }
  } else {
    for (let chain = 0; chain < 2; chain++) {
      const x = 5 + chain * 7;
      const chainLength = detail.int(Math.round(length * 0.5), length);
      for (let link = 0; link < chainLength; link += 3) {
        if ((link / 3) % 2 === 0) {
          pc.rect(x - 1, link, 3, 3, palette.metal);
          pc.px(x, link + 1, palette.ink);
        } else {
          pc.rect(x, link, 1, 3, palette.metalLight);
        }
      }
      if (chain === 0) {
        pc.poly([{ x: x - 2, y: chainLength }, { x: x + 3, y: chainLength }, { x: x + 0.5, y: chainLength + 6 }], palette.crystalMid);
        softGlow(glow, x + 0.5, chainLength + 2, 7, palette.emissive, 0.7);
      }
    }
  }
  return result;
}

function paintSuspension(decor: DecorDef, palette: Palette): PaintedSprite {
  const length = Math.round((decor.size ?? 300) / PIXEL);
  const result = sprite(6, length + 2, 3, length + 1);
  const { canvas: pc } = result;
  for (let link = 0; link < length; link += 3) {
    const y = length - link - 2;
    if ((link / 3) % 2 === 0) {
      pc.rect(1, y, 3, 3, palette.metal);
      pc.px(2, y + 1, palette.ink);
    } else {
      pc.rect(2, y, 1, 3, palette.metalLight);
    }
  }
  pc.erase(() => {
    pc.linearGradient(0, 0, 6, length * 0.6, [
      { at: 0, color: 'rgba(0,0,0,1)' },
      { at: 1, color: 'rgba(0,0,0,0)' },
    ]);
  });
  return result;
}

function paintBrazier(palette: Palette): PaintedSprite {
  const result = sprite(20, 26, 10, 25);
  const { canvas: pc, glow } = result;
  pc.rect(8, 12, 4, 12, palette.metal);
  pc.rect(5, 23, 10, 2, palette.metal);
  pc.poly([{ x: 2, y: 8 }, { x: 18, y: 8 }, { x: 14, y: 13 }, { x: 6, y: 13 }], palette.metal);
  pc.rect(2, 8, 16, 1, palette.metalLight);
  pc.rect(4, 7, 12, 1, palette.emissive);
  softGlow(glow, 10, 6, 14, palette.emissive, 0.8);
  return finish(result, palette, 0.4);
}

function paintRubble(palette: Palette, shape: Rng): PaintedSprite {
  const result = sprite(46, 16, 23, 15);
  const { canvas: pc } = result;
  for (let stone = 0; stone < 14; stone++) {
    pc.ellipse(shape.range(6, 40), shape.range(8, 14), shape.range(2, 5), shape.range(1.5, 3.5), mix(palette.stoneDark, palette.stoneMid, shape.next()));
  }
  return finish(result, palette, 0.35);
}

function paintFlora(decor: DecorDef, palette: Palette, detail: Rng): PaintedSprite {
  const width = Math.round((decor.size ?? 60) / PIXEL);
  const result = sprite(width + 6, 22, (width + 6) / 2, 21);
  const { canvas: pc, glow } = result;
  const base = 21;
  for (let tuft = 0; tuft < width * 1.2; tuft++) {
    const x = 3 + detail.range(0, width);
    const height = detail.int(3, 11);
    const lean = detail.range(-2, 2);
    const color = isDawn(palette) ? detail.pick([palette.foliage, palette.foliageLight, palette.foliageDark]) : detail.pick([palette.foliage, palette.foliageDark, palette.stoneDeep]);
    pc.line(x, base, x + lean, base - height, color);
  }
  const blooms = Math.round(width / 6);
  for (let bloom = 0; bloom < blooms; bloom++) {
    const x = 3 + detail.range(1, width - 1);
    const y = base - detail.int(6, 13);
    if (isDawn(palette)) {
      pc.rect(x - 1, y, 3, 1, palette.flower);
      pc.rect(x, y - 1, 1, 3, palette.flower);
      pc.px(x, y, palette.accent);
    } else {
      pc.px(x, y, palette.accentBright);
      softGlow(glow, x, y, 4, palette.emissive, 0.7);
    }
  }
  return result;
}

function paintLantern(palette: Palette): PaintedSprite {
  const chainLength = 110;
  const result = sprite(26, chainLength + 34, 13, chainLength + 16);
  const { canvas: pc, glow } = result;
  for (let link = 0; link < chainLength; link += 3) {
    pc.rect(12, link, (link / 3) % 2 === 0 ? 2 : 1, 3, (link / 3) % 2 === 0 ? palette.metal : palette.metalLight);
  }
  const cy = chainLength + 16;
  const cage: Point[] = [
    { x: 13, y: cy - 14 },
    { x: 24, y: cy },
    { x: 13, y: cy + 14 },
    { x: 2, y: cy },
  ];
  pc.poly(cage, palette.metal);
  pc.poly(
    [
      { x: 13, y: cy - 10 },
      { x: 20, y: cy },
      { x: 13, y: cy + 10 },
      { x: 6, y: cy },
    ],
    palette.accentDeep,
  );
  pc.poly(
    [
      { x: 13, y: cy - 6 },
      { x: 17, y: cy },
      { x: 13, y: cy + 6 },
      { x: 9, y: cy },
    ],
    palette.crystalMid,
  );
  pc.rect(12, cy - 2, 2, 4, palette.crystalCore);
  pc.line(13, cy - 14, 13, cy + 14, palette.metalLight);
  softGlow(glow, 13, cy, 26, palette.emissive, 0.9);
  return result;
}

function paintShrine(palette: Palette): PaintedSprite {
  const result = sprite(40, 36, 20, 34);
  const { canvas: pc, glow } = result;
  pc.rect(6, 10, 4, 24, palette.stoneLight);
  pc.rect(30, 10, 4, 24, palette.stoneLight);
  pc.ellipse(20, 12, 14, 9, palette.stoneLight);
  pc.erase(() => {
    pc.ellipse(20, 13, 10, 7, '#000');
    pc.rect(10, 13, 20, 22, '#000');
  });
  pc.px(20, 4, palette.accentBright);
  pc.rect(19, 5, 3, 2, palette.accent);
  softGlow(glow, 20, 18, 18, palette.emissive, 0.55);
  return finish(result, palette, 0.4);
}

function paintWinch(palette: Palette): PaintedSprite {
  const result = sprite(28, 22, 14, 21);
  const { canvas: pc, glow } = result;
  pc.rect(6, 12, 16, 9, palette.stoneMid);
  pc.rect(4, 19, 20, 2, palette.stoneDark);
  pc.poly([{ x: 10, y: 12 }, { x: 18, y: 12 }, { x: 16, y: 4 }, { x: 13, y: 8 }], palette.metal);
  pc.px(15, 6, palette.accent);
  softGlow(glow, 15, 8, 6, palette.emissive, 0.5);
  return finish(result, palette, 0.35);
}

function paintPedestal(palette: Palette, detail: Rng): PaintedSprite {
  const width = 130;
  const result = sprite(width + 4, 30, (width + 4) / 2, 28);
  const { canvas: pc, glow } = result;
  const cx = (width + 4) / 2;
  for (let step = 0; step < 3; step++) {
    const stepWidth = width - step * 26;
    const y = 28 - (step + 1) * 6;
    pc.rect(cx - stepWidth / 2, y, stepWidth, 6, step % 2 ? palette.stoneMid : palette.stoneLight);
    pc.rect(cx - stepWidth / 2, y, stepWidth, 1, palette.rim);
    pc.rect(cx - stepWidth / 2, y + 5, stepWidth, 1, palette.stoneDark);
  }
  pc.poly(
    [
      { x: cx - 28, y: 10 },
      { x: cx + 28, y: 10 },
      { x: cx + 18, y: 0 },
      { x: cx - 18, y: 0 },
    ],
    palette.stoneMid,
  );
  for (let rune = cx - 40; rune <= cx + 40; rune += 10) {
    pc.px(rune, 19, isDawn(palette) ? palette.accent : palette.accentBright);
    if (!isDawn(palette)) softGlow(glow, rune, 19, 4, palette.emissive, 0.6);
  }
  paintCracks(pc, cx - 50, 12, 100, 14, palette, detail, 0.004, glow);
  return finish(result, palette, 0.4);
}

export function paintDecor(decor: DecorDef, palette: Palette): PaintedSprite {
  const seed = decor.seed ?? hashString(`${decor.kind}:${decor.x}:${decor.y}`);
  const shape = new Rng(seed);
  const detail = new Rng(seed * 31 + (isDawn(palette) ? 1 : 2));
  switch (decor.kind) {
    case DecorKind.Column:
      return paintColumn(decor, palette, shape, detail);
    case DecorKind.Statue:
      return paintStatue(decor, palette, detail);
    case DecorKind.Tree:
      return paintTree(palette, shape, detail);
    case DecorKind.Arch:
      return paintArch(decor, palette, shape, detail);
    case DecorKind.Banner:
      return paintBanner(palette, detail);
    case DecorKind.Crystals:
      return paintCrystalCluster(palette, shape);
    case DecorKind.Hanging:
      return paintHanging(decor, palette, detail);
    case DecorKind.Suspension:
      return paintSuspension(decor, palette);
    case DecorKind.Brazier:
      return paintBrazier(palette);
    case DecorKind.Rubble:
      return paintRubble(palette, shape);
    case DecorKind.Flora:
      return paintFlora(decor, palette, detail);
    case DecorKind.Lantern:
      return paintLantern(palette);
    case DecorKind.Waterfall:
      return paintWaterfallCap(palette);
    case DecorKind.Shrine:
      return paintShrine(palette);
    case DecorKind.Winch:
      return paintWinch(palette);
    case DecorKind.BellFrame: {
      const frame = paintBellFrame(palette, detail);
      return { canvas: frame, anchorX: frame.width / 2, anchorY: frame.height - 1 };
    }
    case DecorKind.Pedestal:
      return paintPedestal(palette, detail);
  }
}

function paintWaterfallCap(palette: Palette): PaintedSprite {
  const result = sprite(24, 10, 12, 4);
  const { canvas: pc, glow } = result;
  pc.ellipse(12, 5, 10, 3, palette.waterLight);
  softGlow(glow, 12, 5, 12, isDawn(palette) ? palette.waterLight : palette.emissive, 0.5);
  return result;
}

export function paintWaterfallTile(palette: Palette): PixelCanvas {
  const pc = new PixelCanvas(12, 64);
  const rng = new Rng(isDawn(palette) ? 501 : 502);
  for (let column = 0; column < 12; column++) {
    const edge = column < 2 || column > 9;
    for (let row = 0; row < 64; row++) {
      const streak = Math.sin((row / 64) * Math.PI * 2 * (1 + (column % 3)) + column * 1.7);
      const alpha = (edge ? 0.35 : 0.75) + streak * 0.2 + rng.range(-0.05, 0.05);
      const color = streak > 0.55 ? palette.waterLight : palette.water;
      pc.px(column, row, withAlpha(color, isDawn(palette) ? alpha : alpha * 0.55));
    }
  }
  return pc;
}
