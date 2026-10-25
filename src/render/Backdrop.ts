import Phaser from 'phaser';
import { GAME_HEIGHT, HALF_WIDTH } from '../config';
import { Timeline } from '../core/enums';
import { BACKDROP_LAYERS, BackdropLayerId, SKY_FACTOR } from './art/backdropArt';
import { toTint } from './art/color';
import type { Palette } from './art/palette';
import { FxTexture, TextureKey } from './art/textureKeys';
import { DEPTH } from './depths';

interface Shaft {
  image: Phaser.GameObjects.Image;
  baseAlpha: number;
  phase: number;
  index: number;
}

interface FogBand {
  sprite: Phaser.GameObjects.TileSprite;
  parallax: number;
  drift: number;
  screenY: number;
}

const CLOUD_PARALLAX = 0.03;
const CLOUD_SCALE = 4;
const FOG_SCALE = 4;
const FOG_REFERENCE_SCROLL_Y = 560;

export class Backdrop {
  private readonly sky: Phaser.GameObjects.Image;
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly shafts: Shaft[] = [];
  private readonly fogBands: FogBand[] = [];
  private readonly floorFade: Phaser.GameObjects.Image;
  private readonly lightDirection: number;
  private time = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, timeline: Timeline, palette: Palette, viewWidth: number = HALF_WIDTH) {
    const isDawn = timeline === Timeline.Dawn;
    this.lightDirection = palette.lightDirection;

    this.sky = scene.add.image(0, 0, TextureKey.sky(timeline)).setOrigin(0).setScrollFactor(0).setScale(SKY_FACTOR).setDepth(DEPTH.sky);
    layer.add(this.sky);

    this.clouds = scene.add
      .tileSprite(0, GAME_HEIGHT * 0.36, HALF_WIDTH, 60 * CLOUD_SCALE, TextureKey.cloudBand(timeline))
      .setOrigin(0)
      .setScrollFactor(0)
      .setTileScale(CLOUD_SCALE)
      .setAlpha(isDawn ? 0.75 : 0.65)
      .setDepth(DEPTH.clouds);
    layer.add(this.clouds);

    for (const spec of BACKDROP_LAYERS) {
      const key = TextureKey.backdrop(spec.id, timeline);
      const depth = spec.id === BackdropLayerId.Far ? DEPTH.far : spec.id === BackdropLayerId.Islands ? DEPTH.islands : DEPTH.ruins;
      layer.add(scene.add.image(0, 0, key).setOrigin(0).setScale(spec.factor).setScrollFactor(spec.scroll).setDepth(depth));
      if (spec.id === BackdropLayerId.Ruins) {
        layer.add(
          scene.add
            .image(0, 0, TextureKey.glowOf(key))
            .setOrigin(0)
            .setScale(spec.factor)
            .setScrollFactor(spec.scroll)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(isDawn ? 0.5 : 0.9)
            .setDepth(DEPTH.ruinsGlow),
        );
      }
    }

    const shaftCount = isDawn ? 5 : 3;
    for (let index = 0; index < shaftCount; index++) {
      const spread = (index / Math.max(1, shaftCount - 1)) * 0.9;
      const image = scene.add
        .image(0, -60, FxTexture.Shaft)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(toTint(isDawn ? '#fff0c4' : '#9c6cff'))
        .setScale(1.4 + index * 0.35, 3.6)
        .setRotation(palette.lightDirection * (0.42 + spread * 0.35))
        .setDepth(DEPTH.shafts);
      const baseAlpha = isDawn ? 0.16 - index * 0.015 : 0.07;
      image.setAlpha(baseAlpha);
      layer.add(image);
      this.shafts.push({ image, baseAlpha, phase: index * 1.7, index });
    }

    const fogTint = toTint(palette.fog);
    const bands: Array<{ screenY: number; parallax: number; drift: number; depth: number; alpha: number }> = [
      { screenY: 520, parallax: 0.55, drift: 6, depth: DEPTH.backFog, alpha: isDawn ? 0.75 : 0.6 },
      { screenY: 610, parallax: 1.15, drift: 14, depth: DEPTH.frontFog, alpha: isDawn ? 0.55 : 0.45 },
    ];
    for (const band of bands) {
      const sprite = scene.add
        .tileSprite(0, 0, HALF_WIDTH, 40 * FOG_SCALE, FxTexture.Fog)
        .setOrigin(0)
        .setScrollFactor(0)
        .setTileScale(FOG_SCALE)
        .setTint(fogTint)
        .setAlpha(band.alpha)
        .setDepth(band.depth);
      layer.add(sprite);
      this.fogBands.push({ sprite, parallax: band.parallax, drift: band.drift, screenY: band.screenY });
    }

    this.floorFade = scene.add
      .image(0, GAME_HEIGHT, FxTexture.Fade)
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDisplaySize(HALF_WIDTH, GAME_HEIGHT * 0.3)
      .setTint(fogTint)
      .setAlpha(isDawn ? 0.55 : 0.5)
      .setDepth(DEPTH.frontFog);
    layer.add(this.floorFade);
    this.resize(viewWidth);
  }

  resize(viewWidth: number): void {
    this.sky.setDisplaySize(Math.max(viewWidth, HALF_WIDTH), GAME_HEIGHT);
    this.clouds.setSize(viewWidth, this.clouds.height);
    for (const band of this.fogBands) band.sprite.setSize(viewWidth, band.sprite.height);
    this.floorFade.setDisplaySize(viewWidth, GAME_HEIGHT * 0.3);
    const sourceX = this.lightDirection > 0 ? viewWidth + 40 : -40;
    for (const shaft of this.shafts) {
      shaft.image.setX(sourceX - this.lightDirection * (60 + shaft.index * 70));
    }
  }

  update(dt: number, scrollX: number, scrollY: number): void {
    this.time += dt;
    this.clouds.tilePositionX = (scrollX * CLOUD_PARALLAX + this.time * 3) / CLOUD_SCALE;
    for (const shaft of this.shafts) {
      shaft.image.setAlpha(shaft.baseAlpha * (0.75 + 0.25 * Math.sin(this.time * 0.35 + shaft.phase)));
    }
    for (const band of this.fogBands) {
      band.sprite.tilePositionX = (scrollX * band.parallax + this.time * band.drift) / FOG_SCALE;
      band.sprite.y = band.screenY - (scrollY - FOG_REFERENCE_SCROLL_Y) * band.parallax;
    }
  }
}
