import Phaser from 'phaser';
import { GAME_HEIGHT, SEAM_X } from '../config';
import { Timeline } from '../core/enums';
import { toTint } from '../render/art/color';
import { FxTexture } from '../render/art/textureKeys';

interface SeamSpark {
  image: Phaser.GameObjects.Image;
  speed: number;
  phase: number;
}

const SEAM_TINT = toTint('#b07bff');
const REJECT_TINT = toTint('#ff6f9a');
const SPARK_COUNT = 18;

export class Seam {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Rectangle;
  private readonly focal: Phaser.GameObjects.Image;
  private readonly sparks: SeamSpark[] = [];
  private flare = 0;
  private reject = 0;
  private intensity = 1;
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.glow = scene.add
      .image(SEAM_X, GAME_HEIGHT / 2, FxTexture.Seam)
      .setDisplaySize(150, GAME_HEIGHT)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(SEAM_TINT);
    this.focal = scene.add.image(SEAM_X, GAME_HEIGHT / 2, FxTexture.Glow).setBlendMode(Phaser.BlendModes.ADD).setTint(SEAM_TINT).setScale(1.6, 2.6);
    this.core = scene.add.rectangle(SEAM_X, GAME_HEIGHT / 2, 2, GAME_HEIGHT, 0xf6eeff, 0.95);
    for (let index = 0; index < SPARK_COUNT; index++) {
      const image = scene.add
        .image(SEAM_X, Phaser.Math.Between(0, GAME_HEIGHT), FxTexture.Spark)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(index % 3 === 0 ? 0xffffff : SEAM_TINT)
        .setScale(Phaser.Math.FloatBetween(0.8, 1.8));
      this.sparks.push({ image, speed: Phaser.Math.FloatBetween(-60, 60), phase: Phaser.Math.FloatBetween(0, Math.PI * 2) });
    }
  }

  setIntensity(value: number): void {
    this.intensity = value;
  }

  pulse(timeline: Timeline, y: number): void {
    this.flare = 1;
    const ring = this.scene.add
      .image(SEAM_X, y, FxTexture.Ring)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(toTint(timeline === Timeline.Dawn ? '#ffe2a2' : '#b98bff'))
      .setScale(0.3)
      .setAlpha(0.85);
    this.scene.tweens.add({ targets: ring, scale: 4.5, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  rejectFlash(): void {
    this.reject = 1;
  }

  update(dt: number, focusY: number): void {
    this.time += dt;
    this.flare = Math.max(0, this.flare - dt * 2.2);
    this.reject = Math.max(0, this.reject - dt * 3);
    const breathing = 0.75 + 0.25 * Math.sin(this.time * 1.6) * Math.sin(this.time * 0.7 + 1);
    const strength = this.intensity * (breathing + this.flare * 0.8);
    this.glow.setAlpha(Math.min(1, 0.55 * strength));
    this.glow.setDisplaySize(150 + this.flare * 140 + (this.intensity - 1) * 220, GAME_HEIGHT);
    this.glow.setTint(this.reject > 0 ? REJECT_TINT : SEAM_TINT);
    this.core.setAlpha(Math.min(1, 0.75 + 0.25 * strength));
    this.core.setFillStyle(this.reject > 0.5 ? 0xffd3e2 : 0xf6eeff, Math.min(1, 0.85 + 0.15 * strength));
    this.focal.setY(focusY);
    this.focal.setAlpha(Math.min(1, (0.28 + this.flare * 0.5) * this.intensity));
    for (const spark of this.sparks) {
      let y = spark.image.y + spark.speed * dt;
      if (y < -10) y += GAME_HEIGHT + 20;
      if (y > GAME_HEIGHT + 10) y -= GAME_HEIGHT + 20;
      spark.image.setPosition(SEAM_X + Math.sin(this.time * 2.3 + spark.phase) * 5, y);
      spark.image.setAlpha(Math.min(1, (0.25 + 0.75 * Math.abs(Math.sin(this.time * 3.1 + spark.phase))) * this.intensity));
    }
  }
}
