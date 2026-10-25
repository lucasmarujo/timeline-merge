import Phaser from 'phaser';
import { CAMERA, GAME_HEIGHT, HALF_WIDTH } from '../config';
import { Timeline } from '../core/enums';
import { clamp } from '../core/geometry';
import type { Rect } from '../core/types';

const INACTIVE_GRADING: Readonly<Record<Timeline, { saturation: number; brightness: number }>> = {
  [Timeline.Dawn]: { saturation: -0.5, brightness: 0.8 },
  [Timeline.Eclipse]: { saturation: -0.25, brightness: 0.93 },
};
const DIM_RATE = 9;

function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export class CameraRig {
  readonly cameras: Record<Timeline, Phaser.Cameras.Scene2D.Camera>;
  focusX = 0;
  focusY = 0;
  merge = 0;
  private lookAhead = 0;
  private readonly dim: Record<Timeline, number> = { [Timeline.Dawn]: 0, [Timeline.Eclipse]: 1 };
  private readonly dimTarget: Record<Timeline, number> = { [Timeline.Dawn]: 0, [Timeline.Eclipse]: 1 };
  private readonly grading: Partial<Record<Timeline, Phaser.FX.ColorMatrix>> = {};
  private readonly barrel: Partial<Record<Timeline, Phaser.FX.Barrel>> = {};
  private pulseTime = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly bounds: Rect,
  ) {
    const dawn = scene.cameras.main;
    dawn.setViewport(0, 0, HALF_WIDTH, GAME_HEIGHT);
    const eclipse = scene.cameras.add(HALF_WIDTH, 0, HALF_WIDTH, GAME_HEIGHT);
    dawn.setBackgroundColor('#cfd6d3');
    eclipse.setBackgroundColor('#0b0918');
    this.cameras = { [Timeline.Dawn]: dawn, [Timeline.Eclipse]: eclipse };

    if (scene.renderer.type === Phaser.WEBGL) {
      for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
        const camera = this.cameras[timeline];
        this.barrel[timeline] = camera.postFX.addBarrel(1);
        this.grading[timeline] = camera.postFX.addColorMatrix();
      }
    }
    this.applyGrading();
  }

  get hasPostFx(): boolean {
    return this.grading[Timeline.Dawn] !== undefined;
  }

  dimAmount(timeline: Timeline): number {
    return this.dim[timeline];
  }

  setActiveTimeline(active: Timeline, immediate: boolean): void {
    this.dimTarget[Timeline.Dawn] = active === Timeline.Dawn ? 0 : 1;
    this.dimTarget[Timeline.Eclipse] = active === Timeline.Eclipse ? 0 : 1;
    if (immediate) {
      this.dim[Timeline.Dawn] = this.dimTarget[Timeline.Dawn];
      this.dim[Timeline.Eclipse] = this.dimTarget[Timeline.Eclipse];
      this.applyGrading();
    }
  }

  setBothActive(): void {
    this.dimTarget[Timeline.Dawn] = 0;
    this.dimTarget[Timeline.Eclipse] = 0;
  }

  pulse(): void {
    this.pulseTime = 0;
  }

  shake(duration: number, intensity: number, timeline?: Timeline): void {
    const targets = timeline ? [this.cameras[timeline]] : [this.cameras[Timeline.Dawn], this.cameras[Timeline.Eclipse]];
    for (const camera of targets) {
      camera.shake(duration, intensity);
    }
  }

  snapTo(x: number, y: number, facing: number): void {
    this.lookAhead = facing * CAMERA.lookAhead;
    this.focusX = x + this.lookAhead;
    this.focusY = y;
    this.applyScroll();
  }

  follow(x: number, y: number, facing: number, dt: number): void {
    this.lookAhead = damp(this.lookAhead, facing * CAMERA.lookAhead, CAMERA.lookAheadRate, dt);
    this.focusX = damp(this.focusX, x + this.lookAhead, CAMERA.followX, dt);
    this.focusY = damp(this.focusY, y, CAMERA.followY, dt);
  }

  glide(x: number, y: number, rate: number, dt: number): void {
    this.focusX = damp(this.focusX, x, rate, dt);
    this.focusY = damp(this.focusY, y, rate, dt);
  }

  update(dt: number): void {
    this.applyScroll();
    let changed = false;
    for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
      const next = damp(this.dim[timeline], this.dimTarget[timeline], DIM_RATE, dt);
      if (Math.abs(next - this.dim[timeline]) > 0.0005) changed = true;
      this.dim[timeline] = Math.abs(next - this.dimTarget[timeline]) < 0.001 ? this.dimTarget[timeline] : next;
    }
    if (changed) this.applyGrading();
    if (this.pulseTime < 1) {
      this.pulseTime = Math.min(1, this.pulseTime + dt / 0.45);
      const amount = 1 + Math.sin(this.pulseTime * Math.PI) * 0.07;
      for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
        const barrel = this.barrel[timeline];
        if (barrel) barrel.amount = amount;
      }
    }
  }

  scrollOf(timeline: Timeline): { x: number; y: number } {
    const camera = this.cameras[timeline];
    return { x: camera.scrollX, y: camera.scrollY };
  }

  private applyScroll(): void {
    const maxX = this.bounds.x + this.bounds.w - HALF_WIDTH;
    const maxY = this.bounds.y + this.bounds.h - GAME_HEIGHT;
    const offset = (this.merge * HALF_WIDTH) / 2;
    const scrollY = clamp(Math.round(this.focusY - GAME_HEIGHT * CAMERA.focusRatioY), this.bounds.y, maxY);
    const dawnX = clamp(Math.round(this.focusX - offset - HALF_WIDTH / 2), this.bounds.x, maxX);
    const eclipseX = clamp(Math.round(this.focusX + offset - HALF_WIDTH / 2), this.bounds.x, maxX);
    this.cameras[Timeline.Dawn].setScroll(dawnX, scrollY);
    this.cameras[Timeline.Eclipse].setScroll(eclipseX, scrollY);
  }

  private applyGrading(): void {
    for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
      const grading = this.grading[timeline];
      if (!grading) continue;
      const amount = this.dim[timeline];
      const target = INACTIVE_GRADING[timeline];
      grading.reset();
      grading.saturate(target.saturation * amount, true);
      grading.brightness(1 - (1 - target.brightness) * amount, true);
    }
  }
}
