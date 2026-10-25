import { hexToRgb } from './color';
import type { Rng } from './rng';

export interface Point {
  x: number;
  y: number;
}

export interface GradientStop {
  at: number;
  color: string;
}

export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.ceil(width));
    this.height = Math.max(1, Math.ceil(height));
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Canvas 2D context is not available.');
    }
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    const left = Math.round(x);
    const top = Math.round(y);
    const width = Math.round(x + w) - left;
    const height = Math.round(y + h) - top;
    if (width <= 0 || height <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(left, top, width, height);
  }

  px(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let error = dx + dy;
    this.ctx.fillStyle = color;
    for (let guard = 0; guard < 4096; guard++) {
      this.ctx.fillRect(x, y, 1, 1);
      if (x === tx && y === ty) break;
      const doubled = error * 2;
      if (doubled >= dy) {
        error += dy;
        x += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y += sy;
      }
    }
  }

  thickLine(x0: number, y0: number, x1: number, y1: number, width: number, color: string): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const half = width / 2;
    for (let index = 0; index <= steps; index++) {
      const t = index / steps;
      this.rect(x0 + (x1 - x0) * t - half, y0 + (y1 - y0) * t - half, width, width, color);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    if (rx <= 0 || ry <= 0) return;
    this.ctx.fillStyle = color;
    const top = Math.floor(cy - ry);
    const bottom = Math.ceil(cy + ry);
    for (let y = top; y < bottom; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      const left = Math.round(cx - half);
      const right = Math.round(cx + half);
      if (right > left) this.ctx.fillRect(left, y, right - left, 1);
    }
  }

  poly(points: readonly Point[], color: string): void {
    if (points.length < 3) return;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
    this.ctx.fillStyle = color;
    const crossings: number[] = [];
    for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
      const scan = y + 0.5;
      crossings.length = 0;
      for (let index = 0; index < points.length; index++) {
        const a = points[index] as Point;
        const b = points[(index + 1) % points.length] as Point;
        if ((a.y <= scan && b.y > scan) || (b.y <= scan && a.y > scan)) {
          crossings.push(a.x + ((scan - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
      crossings.sort((left, right) => left - right);
      for (let index = 0; index + 1 < crossings.length; index += 2) {
        const left = Math.round(crossings[index] as number);
        const right = Math.round(crossings[index + 1] as number);
        if (right > left) this.ctx.fillRect(left, y, right - left, 1);
      }
    }
  }

  linearGradient(x: number, y: number, w: number, h: number, stops: readonly GradientStop[], vertical = true): void {
    const gradient = vertical
      ? this.ctx.createLinearGradient(0, y, 0, y + h)
      : this.ctx.createLinearGradient(x, 0, x + w, 0);
    for (const stop of stops) gradient.addColorStop(stop.at, stop.color);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, w, h);
  }

  radial(cx: number, cy: number, radius: number, stops: readonly GradientStop[]): void {
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    for (const stop of stops) gradient.addColorStop(stop.at, stop.color);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  atop(draw: () => void): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-atop';
    draw();
    this.ctx.restore();
  }

  erase(draw: () => void): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    draw();
    this.ctx.restore();
  }

  withAlpha(alpha: number, draw: () => void): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    draw();
    this.ctx.restore();
  }

  speckle(x: number, y: number, w: number, h: number, rng: Rng, density: number, colors: readonly string[]): void {
    const count = Math.round(w * h * density);
    for (let index = 0; index < count; index++) {
      this.px(x + rng.int(0, Math.max(0, w - 1)), y + rng.int(0, Math.max(0, h - 1)), rng.pick(colors));
    }
  }

  outline(color: string, alpha = 1): void {
    const image = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = image.data;
    const source = new Uint8Array(this.width * this.height);
    for (let index = 0; index < source.length; index++) {
      source[index] = (data[index * 4 + 3] as number) > 0 ? 1 : 0;
    }
    const { r, g, b } = hexToRgb(color);
    const a = Math.round(alpha * 255);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        if (source[index]) continue;
        const touches =
          (x > 0 && source[index - 1]) ||
          (x < this.width - 1 && source[index + 1]) ||
          (y > 0 && source[index - this.width]) ||
          (y < this.height - 1 && source[index + this.width]);
        if (!touches) continue;
        data[index * 4] = r;
        data[index * 4 + 1] = g;
        data[index * 4 + 2] = b;
        data[index * 4 + 3] = a;
      }
    }
    this.ctx.putImageData(image, 0, 0);
  }

  rim(color: string, directionX: number, directionY: number, strength: number): void {
    const image = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = image.data;
    const alpha = new Uint8Array(this.width * this.height);
    for (let index = 0; index < alpha.length; index++) {
      alpha[index] = data[index * 4 + 3] as number;
    }
    const { r, g, b } = hexToRgb(color);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        if ((alpha[index] as number) < 200) continue;
        const nx = x + directionX;
        const ny = y + directionY;
        const sideOpen = nx < 0 || nx >= this.width || (alpha[y * this.width + nx] as number) < 128;
        const topOpen = ny < 0 || ny >= this.height || (alpha[ny * this.width + x] as number) < 128;
        if (!sideOpen && !topOpen) continue;
        const amount = sideOpen && topOpen ? strength : strength * 0.65;
        const offset = index * 4;
        data[offset] = (data[offset] as number) + (r - (data[offset] as number)) * amount;
        data[offset + 1] = (data[offset + 1] as number) + (g - (data[offset + 1] as number)) * amount;
        data[offset + 2] = (data[offset + 2] as number) + (b - (data[offset + 2] as number)) * amount;
      }
    }
    this.ctx.putImageData(image, 0, 0);
  }

  drawCanvas(source: PixelCanvas, x: number, y: number, flipX = false): void {
    this.ctx.save();
    if (flipX) {
      this.ctx.translate(x + source.width, y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(source.canvas, 0, 0);
    } else {
      this.ctx.drawImage(source.canvas, Math.round(x), Math.round(y));
    }
    this.ctx.restore();
  }
}
