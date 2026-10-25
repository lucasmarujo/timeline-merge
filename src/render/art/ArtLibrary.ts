import Phaser from 'phaser';
import { HazardStyle, Timeline } from '../../core/enums';
import { hashString, Rng } from '../../core/rng';
import { existsIn } from '../../core/timeline';
import type { LevelDef } from '../../core/types';
import { MAX_HALF_WIDTH } from '../viewport';
import { BACKDROP_LAYERS, backdropWorldSize, paintCloudBand, paintFarLayer, paintFogBand, paintIslandLayer, paintRuinsLayer, paintSky, BackdropLayerId } from './backdropArt';
import { paintTravelerSheet, TRAVELER_FRAME, TRAVELER_FRAME_COUNT, TRAVELER_SEQUENCES, TravelerAnimation } from './characterArt';
import { paintDecor, paintWaterfallTile } from './decorArt';
import { paintLightShaft, paintMote, paintPixel, paintRing, paintSeamProfile, paintSoftGlow, paintSpark, paintVerticalFade, paintVignette, paintVoidEdge } from './fxArt';
import { paletteFor, type Palette } from './palette';
import type { PixelCanvas } from './PixelCanvas';
import {
  paintBell,
  paintBellFrame,
  paintChainLink,
  paintCheckpoint,
  paintCrankBase,
  paintCrankWheel,
  paintFragment,
  paintPortalCore,
  paintPortalRing,
  paintPortalRunes,
  paintPortalShard,
  paintWraithSheet,
  WRAITH_FRAME,
  WRAITH_FRAME_COUNT,
} from './propArt';
import type { PaintedSprite } from './stonework';
import { paintHazard, paintSolid } from './terrainArt';
import { animationKey, FxTexture, TextureKey, wraithAnimationKey } from './textureKeys';

export interface SpriteInfo {
  key: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  glowKey: string | null;
}

export type LevelPalettes = Readonly<Record<Timeline, Palette>>;

const TIMELINES = [Timeline.Dawn, Timeline.Eclipse] as const;

function hasVisiblePixels(canvas: PixelCanvas): boolean {
  const data = canvas.ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 16) {
    if ((data[index] as number) > 0) return true;
  }
  return false;
}

export class ArtLibrary {
  private readonly sprites = new Map<string, SpriteInfo>();
  private readonly levelKeys = new Set<string>();
  private collecting = false;
  private currentLevel: string | null = null;

  constructor(private readonly textures: Phaser.Textures.TextureManager) {}

  get levelId(): string | null {
    return this.currentLevel;
  }

  get levelTextureCount(): number {
    return this.levelKeys.size;
  }

  addCanvas(key: string, canvas: PixelCanvas, linear = false): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const texture = this.textures.addCanvas(key, canvas.canvas);
    if (!texture) {
      throw new Error(`Could not register texture "${key}".`);
    }
    texture.setFilter(linear ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
    if (this.collecting) this.levelKeys.add(key);
  }

  addSprite(key: string, painted: PaintedSprite): SpriteInfo {
    this.addCanvas(key, painted.canvas);
    let glowKey: string | null = null;
    if (painted.glow && hasVisiblePixels(painted.glow)) {
      glowKey = TextureKey.glowOf(key);
      this.addCanvas(glowKey, painted.glow, true);
    }
    const info: SpriteInfo = {
      key,
      anchorX: painted.anchorX,
      anchorY: painted.anchorY,
      width: painted.canvas.width,
      height: painted.canvas.height,
      glowKey,
    };
    this.sprites.set(key, info);
    return info;
  }

  sprite(key: string): SpriteInfo {
    const info = this.sprites.get(key);
    if (!info) {
      throw new Error(`Missing generated sprite "${key}".`);
    }
    return info;
  }

  beginLevel(id: string): void {
    this.disposeLevel();
    this.currentLevel = id;
    this.collecting = true;
  }

  endLevel(): void {
    this.collecting = false;
  }

  disposeLevel(): void {
    for (const key of this.levelKeys) {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.sprites.delete(key);
    }
    this.levelKeys.clear();
    this.currentLevel = null;
  }
}

function registerTraveler(library: ArtLibrary, textures: Phaser.Textures.TextureManager, anims: Phaser.Animations.AnimationManager, timeline: Timeline): void {
  const key = TextureKey.traveler(timeline);
  library.addCanvas(key, paintTravelerSheet(paletteFor(timeline)));
  const texture = textures.get(key);
  for (let frame = 0; frame < TRAVELER_FRAME_COUNT; frame++) {
    texture.add(frame, 0, frame * TRAVELER_FRAME, 0, TRAVELER_FRAME, TRAVELER_FRAME);
  }
  for (const animation of Object.values(TravelerAnimation)) {
    const sequence = TRAVELER_SEQUENCES[animation];
    const animKey = animationKey(timeline, animation);
    if (anims.exists(animKey)) anims.remove(animKey);
    anims.create({
      key: animKey,
      frames: Array.from({ length: sequence.count }, (_, index) => ({ key, frame: sequence.start + index })),
      frameRate: sequence.frameRate,
      repeat: sequence.repeat,
    });
  }
}

function registerWraith(library: ArtLibrary, textures: Phaser.Textures.TextureManager, anims: Phaser.Animations.AnimationManager, timeline: Timeline): void {
  const key = TextureKey.wraith(timeline);
  const { sheet, glow } = paintWraithSheet(paletteFor(timeline));
  library.addCanvas(key, sheet);
  library.addCanvas(TextureKey.glowOf(key), glow, true);
  for (const textureKey of [key, TextureKey.glowOf(key)]) {
    const texture = textures.get(textureKey);
    for (let frame = 0; frame < WRAITH_FRAME_COUNT; frame++) {
      texture.add(frame, 0, frame * WRAITH_FRAME.width, 0, WRAITH_FRAME.width, WRAITH_FRAME.height);
    }
  }
  const animKey = wraithAnimationKey(timeline);
  if (anims.exists(animKey)) anims.remove(animKey);
  anims.create({ key: animKey, frames: Array.from({ length: WRAITH_FRAME_COUNT }, (_, frame) => ({ key, frame })), frameRate: 6, repeat: -1 });
}

function registerProps(library: ArtLibrary, timeline: Timeline): void {
  const palette = paletteFor(timeline);
  library.addCanvas(TextureKey.fragment(timeline), paintFragment(palette));
  library.addCanvas(TextureKey.checkpoint(timeline, false), paintCheckpoint(palette, false));
  library.addCanvas(TextureKey.checkpoint(timeline, true), paintCheckpoint(palette, true));
  library.addCanvas(TextureKey.crankBase(timeline), paintCrankBase(palette));
  library.addCanvas(TextureKey.crankWheel(timeline), paintCrankWheel(palette));
  library.addCanvas(TextureKey.bell(timeline), paintBell(palette));
  library.addCanvas(TextureKey.bellFrame(timeline), paintBellFrame(palette, new Rng(7)));
  library.addCanvas(TextureKey.portalRing(timeline), paintPortalRing(palette));
  library.addCanvas(TextureKey.portalRunes(timeline), paintPortalRunes(palette));
  library.addCanvas(TextureKey.portalShard(timeline), paintPortalShard(palette));
  library.addCanvas(TextureKey.chainLink(timeline), paintChainLink(palette));
}

function registerFx(library: ArtLibrary): void {
  library.addCanvas(FxTexture.Glow, paintSoftGlow(128), true);
  library.addCanvas(FxTexture.GlowTight, paintSoftGlow(64, 0.6), true);
  library.addCanvas(FxTexture.Ring, paintRing(128), true);
  library.addCanvas(FxTexture.Spark, paintSpark());
  library.addCanvas(FxTexture.Mote, paintMote(), true);
  library.addCanvas(FxTexture.Pixel, paintPixel());
  library.addCanvas(FxTexture.Shaft, paintLightShaft(), true);
  library.addCanvas(FxTexture.Seam, paintSeamProfile(), true);
  library.addCanvas(FxTexture.Vignette, paintVignette(), true);
  library.addCanvas(FxTexture.Fade, paintVerticalFade(), true);
  library.addCanvas(FxTexture.Fog, paintFogBand(), true);
  library.addCanvas(FxTexture.PortalCore, paintPortalCore(), true);
  library.addCanvas(FxTexture.VoidEdge, paintVoidEdge(), true);
}

export function generateSharedArt(scene: Phaser.Scene): ArtLibrary {
  const library = new ArtLibrary(scene.textures);
  registerFx(library);
  for (const timeline of TIMELINES) {
    registerTraveler(library, scene.textures, scene.anims, timeline);
    registerWraith(library, scene.textures, scene.anims, timeline);
    registerProps(library, timeline);
  }
  return library;
}

function registerBackdrops(library: ArtLibrary, level: LevelDef, palette: Palette, timeline: Timeline): void {
  const variation = hashString(level.id) % 997;
  library.addCanvas(TextureKey.sky(timeline), paintSky(palette), true);
  library.addCanvas(TextureKey.cloudBand(timeline), paintCloudBand(palette), true);
  library.addCanvas(TextureKey.waterfall(timeline), paintWaterfallTile(palette));
  for (const spec of BACKDROP_LAYERS) {
    const size = backdropWorldSize(spec, level.bounds.w, level.bounds.h, MAX_HALF_WIDTH);
    const width = Math.ceil(size.width / spec.factor);
    const height = Math.ceil(size.height / spec.factor);
    const key = TextureKey.backdrop(spec.id, timeline);
    const seed = spec.seed + variation;
    if (spec.id === BackdropLayerId.Far) {
      library.addCanvas(key, paintFarLayer(palette, width, height, seed), spec.linear);
    } else if (spec.id === BackdropLayerId.Islands) {
      library.addCanvas(key, paintIslandLayer(palette, width, height, seed), spec.linear);
    } else {
      const ruins = paintRuinsLayer(palette, width, height, seed);
      library.addCanvas(key, ruins.canvas, spec.linear);
      library.addCanvas(TextureKey.glowOf(key), ruins.glow, true);
    }
  }
}

export function generateLevelArt(library: ArtLibrary, level: LevelDef, palettes: LevelPalettes): void {
  library.beginLevel(level.id);
  try {
    for (const timeline of TIMELINES) {
      const palette = palettes[timeline];
      for (const solid of level.solids) {
        if (existsIn(solid.presence, timeline)) {
          library.addSprite(TextureKey.solid(solid.id, timeline), paintSolid(solid, palette));
        }
      }
      for (const hazard of level.hazards) {
        if (hazard.style === HazardStyle.Thorns && existsIn(hazard.presence, timeline)) {
          library.addSprite(TextureKey.hazard(hazard.id, timeline), paintHazard(hazard, palette));
        }
      }
      level.decor.forEach((decor, index) => {
        if (existsIn(decor.presence, timeline)) {
          library.addSprite(TextureKey.decor(index, timeline), paintDecor(decor, palette));
        }
      });
      registerBackdrops(library, level, palette, timeline);
    }
  } finally {
    library.endLevel();
  }
}
