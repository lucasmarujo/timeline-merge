import { mix, withAlpha } from './color';
import type { Palette } from './palette';
import { PixelCanvas, type Point } from './PixelCanvas';
import { Rng } from './rng';
import { isDawn } from './stonework';

export const PORTAL_RING_RADIUS = 64;
export const PORTAL_SOCKET_ANGLES = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6] as const;

export function paintFragment(palette: Palette): PixelCanvas {
  const pc = new PixelCanvas(16, 22);
  const body: Point[] = [
    { x: 8, y: 1 },
    { x: 14, y: 9 },
    { x: 8, y: 21 },
    { x: 2, y: 9 },
  ];
  pc.poly(body, palette.crystalMid);
  pc.poly(
    [
      { x: 8, y: 1 },
      { x: 14, y: 9 },
      { x: 8, y: 11 },
    ],
    palette.crystalCore,
  );
  pc.poly(
    [
      { x: 2, y: 9 },
      { x: 8, y: 11 },
      { x: 8, y: 21 },
    ],
    palette.crystalEdge,
  );
  pc.rect(7, 8, 2, 3, palette.emissiveBright);
  pc.px(6, 9, palette.accentBright);
  pc.px(9, 9, palette.accentBright);
  pc.outline(isDawn(palette) ? palette.accentDeep : palette.ink, 0.85);
  return pc;
}

export function paintCheckpoint(palette: Palette, lit: boolean): PixelCanvas {
  const pc = new PixelCanvas(16, 28);
  pc.rect(3, 9, 10, 18, palette.stoneMid);
  pc.ellipse(8, 9, 5, 5, palette.stoneMid);
  pc.rect(3, 9, 1, 18, palette.stoneLight);
  pc.rect(12, 9, 1, 18, palette.stoneDark);
  pc.rect(2, 24, 12, 3, palette.stoneDark);
  pc.rect(2, 24, 12, 1, palette.stoneLight);
  const rune = lit ? palette.emissiveBright : palette.stoneDeep;
  pc.rect(7, 9, 2, 10, rune);
  pc.rect(5, 12, 6, 1, rune);
  pc.px(5, 16, rune);
  pc.px(10, 16, rune);
  if (lit) {
    pc.px(7, 7, palette.accentBright);
    pc.px(8, 7, palette.accentBright);
  }
  pc.rim(palette.rim, palette.lightDirection, -1, 0.4);
  pc.outline(palette.ink, 0.6);
  return pc;
}

export function paintCrankBase(palette: Palette): PixelCanvas {
  const pc = new PixelCanvas(26, 22);
  pc.rect(5, 10, 16, 11, palette.stoneMid);
  pc.rect(5, 10, 16, 2, palette.stoneLight);
  pc.rect(3, 19, 20, 3, palette.stoneDark);
  pc.rect(11, 2, 4, 9, palette.metal);
  pc.rect(11, 2, 1, 9, palette.metalLight);
  pc.px(9, 15, palette.accent);
  pc.px(16, 15, palette.accent);
  pc.outline(palette.ink, 0.6);
  return pc;
}

export function paintCrankWheel(palette: Palette): PixelCanvas {
  const pc = new PixelCanvas(24, 24);
  pc.ellipse(12, 12, 11, 11, palette.metal);
  pc.erase(() => pc.ellipse(12, 12, 9, 9, '#000'));
  for (let spoke = 0; spoke < 6; spoke++) {
    const angle = (spoke / 6) * Math.PI * 2;
    pc.thickLine(12, 12, 12 + Math.cos(angle) * 9.5, 12 + Math.sin(angle) * 9.5, 2, palette.metalLight);
  }
  pc.ellipse(12, 12, 3, 3, palette.accent);
  pc.px(12, 12, palette.accentBright);
  pc.rect(21, 11, 3, 2, palette.accentDeep);
  pc.outline(palette.ink, 0.7);
  return pc;
}

export function paintBellFrame(palette: Palette, rng: Rng): PixelCanvas {
  const pc = new PixelCanvas(40, 44);
  const broken = !isDawn(palette);
  pc.rect(4, 6, 4, 38, palette.stoneMid);
  pc.rect(32, 6, 4, 38, palette.stoneMid);
  pc.rect(4, 6, 1, 38, palette.stoneLight);
  pc.rect(35, 6, 1, 38, palette.stoneDark);
  pc.rect(1, 3, 38, 4, palette.stoneLight);
  pc.rect(1, 7, 38, 1, palette.stoneDark);
  pc.rect(19, 7, 2, 4, palette.metal);
  if (broken) {
    pc.erase(() => pc.poly([{ x: 30, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 10 }], '#000'));
    for (let crack = 0; crack < 3; crack++) {
      const cx = rng.pick([6, 34]);
      pc.px(cx, 14 + crack * 8, palette.accent);
    }
  } else {
    pc.line(20, 11, 20, 26, palette.foliage);
    pc.px(20, 27, palette.flower);
  }
  pc.rect(0, 41, 40, 3, palette.stoneDark);
  pc.rim(palette.rim, palette.lightDirection, -1, 0.35);
  pc.outline(palette.ink, 0.55);
  return pc;
}

export function paintBell(palette: Palette): PixelCanvas {
  const pc = new PixelCanvas(22, 22);
  const shape: Point[] = [
    { x: 8, y: 2 },
    { x: 14, y: 2 },
    { x: 16, y: 8 },
    { x: 17, y: 15 },
    { x: 20, y: 18 },
    { x: 2, y: 18 },
    { x: 5, y: 15 },
    { x: 6, y: 8 },
  ];
  pc.poly(shape, palette.metal);
  pc.poly(
    [
      { x: 11, y: 2 },
      { x: 14, y: 2 },
      { x: 16, y: 8 },
      { x: 17, y: 15 },
      { x: 20, y: 18 },
      { x: 11, y: 18 },
    ],
    mix(palette.metal, palette.metalLight, 0.4),
  );
  pc.rect(4, 16, 14, 1, palette.accent);
  pc.rect(10, 9, 2, 3, palette.accentBright);
  pc.rect(10, 18, 2, 2, palette.metalLight);
  pc.rect(10, 0, 2, 3, palette.metal);
  pc.outline(palette.ink, 0.75);
  return pc;
}

export function paintPortalRing(palette: Palette): PixelCanvas {
  const size = PORTAL_RING_RADIUS * 2 + 8;
  const center = size / 2;
  const pc = new PixelCanvas(size, size);
  const outer = PORTAL_RING_RADIUS;
  const inner = PORTAL_RING_RADIUS - 11;
  pc.ellipse(center, center, outer, outer, palette.stoneMid);
  pc.erase(() => pc.ellipse(center, center, inner, inner, '#000'));
  pc.atop(() => {
    pc.radial(center, center, outer, [
      { at: 0.7, color: withAlpha(palette.stoneDark, 0.9) },
      { at: 0.86, color: withAlpha(palette.stoneLight, 0.55) },
      { at: 1, color: withAlpha(palette.stoneDark, 0.9) },
    ]);
  });
  for (let notch = 0; notch < 36; notch++) {
    const angle = (notch / 36) * Math.PI * 2;
    const radius = outer - 5.5;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    pc.rect(x - 1, y - 1, 2, 2, notch % 3 === 0 ? palette.accent : palette.stoneDeep);
  }
  for (let ring = 0; ring < 2; ring++) {
    const radius = ring === 0 ? outer - 1 : inner + 1;
    for (let step = 0; step < 360; step++) {
      const angle = (step / 360) * Math.PI * 2;
      pc.px(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius, ring === 0 ? palette.stoneLight : palette.stoneDeep);
    }
  }
  pc.erase(() => {
    for (const angle of PORTAL_SOCKET_ANGLES) {
      const spread = 0.17;
      pc.poly(
        [
          { x: center, y: center },
          { x: center + Math.cos(angle - spread) * (outer + 4), y: center + Math.sin(angle - spread) * (outer + 4) },
          { x: center + Math.cos(angle + spread) * (outer + 4), y: center + Math.sin(angle + spread) * (outer + 4) },
        ],
        '#000',
      );
    }
  });
  pc.rim(palette.rim, palette.lightDirection, -1, 0.45);
  return pc;
}

export function paintPortalRunes(palette: Palette): PixelCanvas {
  const size = PORTAL_RING_RADIUS * 2;
  const center = size / 2;
  const pc = new PixelCanvas(size, size);
  const radius = PORTAL_RING_RADIUS - 17;
  for (let step = 0; step < 480; step++) {
    const angle = (step / 480) * Math.PI * 2;
    pc.px(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius, palette.accent);
  }
  for (let glyph = 0; glyph < 24; glyph++) {
    const angle = (glyph / 24) * Math.PI * 2;
    const x = center + Math.cos(angle) * (radius - 4);
    const y = center + Math.sin(angle) * (radius - 4);
    const kind = glyph % 3;
    if (kind === 0) pc.rect(x - 1, y - 1, 2, 3, palette.accentBright);
    if (kind === 1) pc.rect(x - 1, y, 3, 1, palette.accentBright);
    if (kind === 2) pc.px(x, y, palette.accentBright);
  }
  return pc;
}

export function paintPortalShard(palette: Palette): PixelCanvas {
  const pc = new PixelCanvas(26, 16);
  pc.poly(
    [
      { x: 1, y: 3 },
      { x: 24, y: 1 },
      { x: 22, y: 13 },
      { x: 4, y: 14 },
    ],
    palette.stoneMid,
  );
  pc.rect(3, 4, 19, 1, palette.stoneLight);
  pc.rect(6, 8, 2, 2, palette.accent);
  pc.rect(14, 8, 2, 2, palette.accent);
  pc.rim(palette.rim, palette.lightDirection, -1, 0.4);
  pc.outline(palette.ink, 0.6);
  return pc;
}

export function paintPortalCore(): PixelCanvas {
  const size = 128;
  const center = size / 2;
  const pc = new PixelCanvas(size, size);
  pc.radial(center, center, center, [
    { at: 0, color: 'rgba(255,255,255,1)' },
    { at: 0.18, color: 'rgba(255,255,255,0.9)' },
    { at: 0.5, color: 'rgba(255,255,255,0.35)' },
    { at: 1, color: 'rgba(255,255,255,0)' },
  ]);
  const rng = new Rng(77);
  pc.ctx.save();
  pc.ctx.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < 5; arm++) {
    const offset = (arm / 5) * Math.PI * 2;
    pc.ctx.beginPath();
    for (let step = 0; step < 90; step++) {
      const t = step / 90;
      const angle = offset + t * Math.PI * 2.4;
      const radius = 6 + t * (center - 12);
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      if (step === 0) pc.ctx.moveTo(x, y);
      else pc.ctx.lineTo(x, y);
    }
    pc.ctx.strokeStyle = `rgba(255,255,255,${0.25 + rng.next() * 0.2})`;
    pc.ctx.lineWidth = 3;
    pc.ctx.stroke();
  }
  pc.ctx.restore();
  return pc;
}
