import { GAME_HEIGHT, HALF_WIDTH } from '../../config';
import { PixelCanvas } from './PixelCanvas';

export function paintSoftGlow(size: number, falloff = 1): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  const half = size / 2;
  pc.radial(half, half, half, [
    { at: 0, color: 'rgba(255,255,255,1)' },
    { at: 0.25 * falloff, color: 'rgba(255,255,255,0.55)' },
    { at: 0.6, color: 'rgba(255,255,255,0.15)' },
    { at: 1, color: 'rgba(255,255,255,0)' },
  ]);
  return pc;
}

export function paintRing(size: number): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  const half = size / 2;
  pc.radial(half, half, half, [
    { at: 0, color: 'rgba(255,255,255,0)' },
    { at: 0.72, color: 'rgba(255,255,255,0)' },
    { at: 0.86, color: 'rgba(255,255,255,0.9)' },
    { at: 0.93, color: 'rgba(255,255,255,0.35)' },
    { at: 1, color: 'rgba(255,255,255,0)' },
  ]);
  return pc;
}

export function paintSpark(): PixelCanvas {
  const pc = new PixelCanvas(7, 7);
  pc.rect(3, 0, 1, 7, 'rgba(255,255,255,0.75)');
  pc.rect(0, 3, 7, 1, 'rgba(255,255,255,0.75)');
  pc.rect(2, 2, 3, 3, 'rgba(255,255,255,0.9)');
  pc.px(3, 3, '#ffffff');
  return pc;
}

export function paintMote(): PixelCanvas {
  const pc = new PixelCanvas(6, 6);
  pc.radial(3, 3, 3, [
    { at: 0, color: 'rgba(255,255,255,1)' },
    { at: 0.5, color: 'rgba(255,255,255,0.6)' },
    { at: 1, color: 'rgba(255,255,255,0)' },
  ]);
  return pc;
}

export function paintPixel(): PixelCanvas {
  const pc = new PixelCanvas(2, 2);
  pc.rect(0, 0, 2, 2, '#ffffff');
  return pc;
}

export function paintLightShaft(): PixelCanvas {
  const width = 63;
  const height = 256;
  const pc = new PixelCanvas(width, height);
  const ctx = pc.ctx;
  const horizontal = ctx.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(0.5, 'rgba(255,255,255,1)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, width, height);
  pc.erase(() => {
    pc.linearGradient(0, 0, width, height, [
      { at: 0, color: 'rgba(0,0,0,0.2)' },
      { at: 0.6, color: 'rgba(0,0,0,0.6)' },
      { at: 1, color: 'rgba(0,0,0,1)' },
    ]);
  });
  return pc;
}

export function paintSeamProfile(): PixelCanvas {
  const width = 96;
  const pc = new PixelCanvas(width, 4);
  const ctx = pc.ctx;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.38, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(0.47, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.53, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, 4);
  return pc;
}

export function paintVignette(): PixelCanvas {
  const width = HALF_WIDTH / 4;
  const height = GAME_HEIGHT / 4;
  const pc = new PixelCanvas(width, height);
  const ctx = pc.ctx;
  const gradient = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.25, width / 2, height * 0.5, height * 0.78);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return pc;
}

export function paintVerticalFade(): PixelCanvas {
  const pc = new PixelCanvas(3, 64);
  pc.linearGradient(0, 0, 3, 64, [
    { at: 0, color: 'rgba(255,255,255,0)' },
    { at: 1, color: 'rgba(255,255,255,1)' },
  ]);
  return pc;
}
