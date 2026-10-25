import Phaser from 'phaser';
import { GAME_HEIGHT, HALF_WIDTH } from '../config';
import { Timeline } from '../core/enums';
import { toTint } from './art/color';
import type { Palette } from './art/palette';
import { FxTexture } from './art/textureKeys';
import { DEPTH } from './depths';

interface Mote {
  image: Phaser.GameObjects.Image;
  worldX: number;
  worldY: number;
  velocityX: number;
  velocityY: number;
  parallax: number;
  phase: number;
  baseAlpha: number;
}

const MOTE_COUNT = 34;
const MARGIN = 16;
const WRAP_HEIGHT = GAME_HEIGHT + MARGIN * 2;

export class AmbientMotes {
  private readonly motes: Mote[] = [];
  private time = 0;
  private viewWidth = HALF_WIDTH;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, timeline: Timeline, palette: Palette, viewWidth: number = HALF_WIDTH) {
    const isDawn = timeline === Timeline.Dawn;
    const tint = toTint(palette.mote);
    this.viewWidth = viewWidth;
    for (let index = 0; index < MOTE_COUNT; index++) {
      const parallax = Phaser.Math.FloatBetween(0.45, 1.35);
      const image = scene.add
        .image(0, 0, FxTexture.Mote)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setScale(parallax * (isDawn ? 0.9 : 1.1))
        .setScrollFactor(parallax)
        .setDepth(parallax > 1 ? DEPTH.motes : DEPTH.backFog + 1);
      layer.add(image);
      this.motes.push({
        image,
        worldX: Phaser.Math.FloatBetween(0, viewWidth),
        worldY: Phaser.Math.FloatBetween(0, GAME_HEIGHT),
        velocityX: Phaser.Math.FloatBetween(-8, 8) + (isDawn ? -4 : 0),
        velocityY: isDawn ? Phaser.Math.FloatBetween(-10, 4) : Phaser.Math.FloatBetween(-26, -10),
        parallax,
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
        baseAlpha: Phaser.Math.FloatBetween(0.35, 0.9),
      });
    }
  }

  resize(viewWidth: number): void {
    this.viewWidth = viewWidth;
  }

  update(dt: number, scrollX: number, scrollY: number): void {
    this.time += dt;
    const wrapWidth = this.viewWidth + MARGIN * 2;
    for (const mote of this.motes) {
      mote.worldX += (mote.velocityX + Math.sin(this.time * 0.8 + mote.phase) * 6) * dt;
      mote.worldY += mote.velocityY * dt;
      const screenX = mote.worldX - scrollX * mote.parallax;
      const screenY = mote.worldY - scrollY * mote.parallax;
      if (screenX < -MARGIN) mote.worldX += wrapWidth * Math.ceil((-MARGIN - screenX) / wrapWidth);
      if (screenX > this.viewWidth + MARGIN) mote.worldX -= wrapWidth * Math.ceil((screenX - this.viewWidth - MARGIN) / wrapWidth);
      if (screenY < -MARGIN) mote.worldY += WRAP_HEIGHT * Math.ceil((-MARGIN - screenY) / WRAP_HEIGHT);
      if (screenY > GAME_HEIGHT + MARGIN) mote.worldY -= WRAP_HEIGHT * Math.ceil((screenY - GAME_HEIGHT - MARGIN) / WRAP_HEIGHT);
      mote.image.setPosition(mote.worldX, mote.worldY);
      mote.image.setAlpha(mote.baseAlpha * (0.55 + 0.45 * Math.sin(this.time * 1.7 + mote.phase)));
    }
  }
}
