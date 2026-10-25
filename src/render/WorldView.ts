import Phaser from 'phaser';
import { PIXEL } from '../config';
import { PLAYER_SIZE } from '../core/constants';
import { DecorKind, DecorLayer, InteractionBlock, InteractionKind, MechanismKind, Presence, Timeline } from '../core/enums';
import type { GameSimulation, InteractionTarget } from '../core/simulation';
import { existsIn } from '../core/timeline';
import type { CheckpointDef, DecorDef, FragmentDef, LevelDef, MechanismDef, SolidDef } from '../core/types';
import type { ArtLibrary, SpriteInfo } from './art/ArtLibrary';
import { toTint } from './art/color';
import { paletteFor } from './art/palette';
import { FxTexture, TextureKey } from './art/textureKeys';
import { AmbientMotes } from './AmbientMotes';
import { Backdrop } from './Backdrop';
import type { CameraRig } from './CameraRig';
import { DEPTH } from './depths';
import { InteractionPrompt, type PromptStyle } from './InteractionPrompt';
import { PlayerView } from './PlayerView';
import { PortalView, type PortalFrame } from './PortalView';

const TIMELINES = [Timeline.Dawn, Timeline.Eclipse] as const;
const PORTCULLIS_REST = 28;

interface SolidVisual {
  def: SolidDef;
  image: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  baseY: number;
  materialized: boolean;
}

interface FragmentVisual {
  def: FragmentDef;
  container: Phaser.GameObjects.Container;
  crystal: Phaser.GameObjects.Image;
  phase: number;
}

interface CheckpointVisual {
  def: CheckpointDef;
  timeline: Timeline;
  image: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

interface MechanismVisual {
  def: MechanismDef;
  moving: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  activated: boolean;
}

interface Pulsing {
  image: Phaser.GameObjects.Image;
  base: number;
  speed: number;
  phase: number;
}

interface Flyer {
  crystal: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

export class WorldView {
  readonly layers: Record<Timeline, Phaser.GameObjects.Layer>;
  readonly player: PlayerView;
  readonly portals: Record<Timeline, PortalView>;
  private readonly backdrops: Record<Timeline, Backdrop>;
  private readonly motes: Record<Timeline, AmbientMotes>;
  private readonly prompts: Record<Timeline, InteractionPrompt>;
  private readonly sparks: Record<Timeline, Phaser.GameObjects.Particles.ParticleEmitter>;
  private readonly dust: Record<Timeline, Phaser.GameObjects.Particles.ParticleEmitter>;
  private readonly flyers: Record<Timeline, Flyer[]>;
  private readonly solids: SolidVisual[] = [];
  private readonly fragments: Record<Timeline, FragmentVisual[]> = { [Timeline.Dawn]: [], [Timeline.Eclipse]: [] };
  private readonly checkpoints: CheckpointVisual[] = [];
  private readonly mechanisms: MechanismVisual[] = [];
  private readonly waterfalls: Phaser.GameObjects.TileSprite[] = [];
  private readonly pulsing: Pulsing[] = [];
  private readonly reached = new Set<string>();
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDef,
    private readonly art: ArtLibrary,
    private promptStyle: PromptStyle,
  ) {
    this.layers = { [Timeline.Dawn]: scene.add.layer(), [Timeline.Eclipse]: scene.add.layer() };
    this.backdrops = {
      [Timeline.Dawn]: new Backdrop(scene, this.layers[Timeline.Dawn], Timeline.Dawn),
      [Timeline.Eclipse]: new Backdrop(scene, this.layers[Timeline.Eclipse], Timeline.Eclipse),
    };

    level.decor.forEach((decor, index) => this.buildDecor(decor, index));
    for (const solid of level.solids) this.buildSolid(solid);
    for (const timeline of TIMELINES) {
      for (const hazard of level.hazards) {
        if (!existsIn(hazard.presence, timeline)) continue;
        const info = art.sprite(TextureKey.hazard(hazard.id, timeline));
        this.placeSprite(info, hazard.x, hazard.y, timeline, DEPTH.hazards, DEPTH.hazards + 1, 1.2);
      }
    }

    this.portals = {
      [Timeline.Dawn]: new PortalView(scene, this.layers[Timeline.Dawn], Timeline.Dawn, level.portal),
      [Timeline.Eclipse]: new PortalView(scene, this.layers[Timeline.Eclipse], Timeline.Eclipse, level.portal),
    };

    for (const checkpoint of level.checkpoints) this.buildCheckpoint(checkpoint);
    for (const mechanism of level.mechanisms) this.buildMechanism(mechanism);
    for (const fragment of level.fragments) this.buildFragment(fragment);

    this.player = new PlayerView(scene, this.layers);
    this.motes = {
      [Timeline.Dawn]: new AmbientMotes(scene, this.layers[Timeline.Dawn], Timeline.Dawn),
      [Timeline.Eclipse]: new AmbientMotes(scene, this.layers[Timeline.Eclipse], Timeline.Eclipse),
    };
    this.prompts = {
      [Timeline.Dawn]: new InteractionPrompt(scene, this.layers[Timeline.Dawn], 0xf2c46b),
      [Timeline.Eclipse]: new InteractionPrompt(scene, this.layers[Timeline.Eclipse], 0xb98bff),
    };
    this.setPromptStyle(promptStyle);
    this.sparks = { [Timeline.Dawn]: this.createSparks(Timeline.Dawn), [Timeline.Eclipse]: this.createSparks(Timeline.Eclipse) };
    this.dust = { [Timeline.Dawn]: this.createDust(Timeline.Dawn), [Timeline.Eclipse]: this.createDust(Timeline.Eclipse) };
    this.flyers = { [Timeline.Dawn]: this.createFlyers(Timeline.Dawn), [Timeline.Eclipse]: this.createFlyers(Timeline.Eclipse) };
  }

  setPromptStyle(style: PromptStyle): void {
    this.promptStyle = style;
    for (const timeline of TIMELINES) {
      this.prompts[timeline].setScale(style.scale);
    }
  }

  bindCameras(rig: CameraRig): void {
    rig.cameras[Timeline.Dawn].ignore(this.layers[Timeline.Eclipse]);
    rig.cameras[Timeline.Eclipse].ignore(this.layers[Timeline.Dawn]);
  }

  reset(): void {
    this.reached.clear();
  }

  sync(sim: GameSimulation, immediate: boolean): void {
    let delay = 0;
    for (const visual of this.solids) {
      const materialized = sim.isSolidMaterialized(visual.def);
      if (materialized === visual.materialized) continue;
      visual.materialized = materialized;
      if (visual.def.condition?.unless !== undefined) {
        this.animatePortcullis(visual, immediate);
      } else {
        this.animateMaterialize(visual, immediate, delay);
        delay += 220;
      }
    }
    for (const timeline of TIMELINES) {
      for (const fragment of this.fragments[timeline]) {
        fragment.container.setVisible(!sim.hasFragment(fragment.def.id));
      }
    }
    for (const checkpoint of this.checkpoints) {
      const lit = this.reached.has(checkpoint.def.id);
      checkpoint.image.setTexture(TextureKey.checkpoint(checkpoint.timeline, lit));
      if (immediate || !lit) checkpoint.glow.setAlpha(lit ? 0.5 : 0);
    }
    for (const visual of this.mechanisms) {
      const active = sim.isMechanismActive(visual.def.id);
      if (active !== visual.activated) {
        visual.activated = active;
        if (active && !immediate) this.animateMechanism(visual);
      }
    }
  }

  markCheckpoint(checkpoint: CheckpointDef, timeline: Timeline): void {
    this.reached.add(checkpoint.id);
    for (const visual of this.checkpoints) {
      if (visual.def.id !== checkpoint.id) continue;
      visual.image.setTexture(TextureKey.checkpoint(visual.timeline, true));
      this.scene.tweens.add({ targets: visual.glow, alpha: { from: 1, to: 0.5 }, duration: 900, ease: 'Sine.easeOut' });
    }
    this.burst(timeline, checkpoint.x, checkpoint.y - 30, 14);
  }

  collectFragment(fragment: FragmentDef): void {
    for (const timeline of TIMELINES) {
      for (const visual of this.fragments[timeline]) {
        if (visual.def.id !== fragment.id) continue;
        visual.container.setVisible(false);
        this.burst(timeline, fragment.x, fragment.y, 36);
        const pillar = this.scene.add
          .image(fragment.x, fragment.y + 30, FxTexture.Shaft)
          .setOrigin(0.5, 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(toTint(paletteFor(timeline).emissiveBright))
          .setScale(0.8, 0.1)
          .setAlpha(0.9)
          .setFlipY(true)
          .setDepth(DEPTH.fx);
        this.layers[timeline].add(pillar);
        this.scene.tweens.add({
          targets: pillar,
          scaleY: 2.4,
          alpha: 0,
          duration: 1100,
          ease: 'Cubic.easeOut',
          onComplete: () => pillar.destroy(),
        });
      }
    }
  }

  shiftEffect(from: Timeline, to: Timeline, x: number, y: number): void {
    this.player.afterimage(from);
    const ring = this.scene.add
      .image(x, y - PLAYER_SIZE.height / 2, FxTexture.Ring)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(toTint(to === Timeline.Dawn ? '#ffe7ad' : '#b98bff'))
      .setScale(0.15)
      .setAlpha(0.95)
      .setDepth(DEPTH.fx);
    this.layers[to].add(ring);
    this.scene.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.burst(to, x, y - PLAYER_SIZE.height / 2, 10);
  }

  rejectEffect(timeline: Timeline, x: number, y: number): void {
    this.dust[timeline].explode(10, x, y - PLAYER_SIZE.height / 2);
  }

  deathEffect(timeline: Timeline, x: number, y: number): void {
    this.burst(timeline, x, y - PLAYER_SIZE.height / 2, 40);
    this.player.vanish();
  }

  landEffect(timeline: Timeline, x: number, y: number, impact: number): void {
    this.player.land(impact);
    if (impact > 320) this.dust[timeline].explode(Math.round(impact / 80), x, y);
  }

  burst(timeline: Timeline, x: number, y: number, count: number): void {
    this.sparks[timeline].explode(count, x, y);
  }

  ringAt(timeline: Timeline, x: number, y: number, scale: number, tint: string): void {
    const ring = this.scene.add
      .image(x, y, FxTexture.Ring)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(toTint(tint))
      .setScale(0.2)
      .setAlpha(0.9)
      .setDepth(DEPTH.fx);
    this.layers[timeline].add(ring);
    this.scene.tweens.add({ targets: ring, scale, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  showFlight(progress: readonly number[], fromX: number, fromY: number): void {
    for (const timeline of TIMELINES) {
      const portal = this.portals[timeline];
      this.flyers[timeline].forEach((flyer, index) => {
        const t = progress[index] ?? 0;
        const flying = t > 0 && t < 1;
        flyer.crystal.setVisible(flying);
        flyer.glow.setVisible(flying);
        if (!flying) return;
        const target = portal.socketWorldPosition(index);
        const controlX = (fromX + target.x) / 2;
        const controlY = Math.min(fromY, target.y) - 120;
        const inverse = 1 - t;
        const x = inverse * inverse * fromX + 2 * inverse * t * controlX + t * t * target.x;
        const y = inverse * inverse * fromY + 2 * inverse * t * controlY + t * t * target.y;
        flyer.crystal.setPosition(x, y).setScale(PIXEL * (1.2 - 0.3 * t));
        flyer.glow.setPosition(x, y);
      });
    }
  }

  update(dt: number, sim: GameSimulation, rig: CameraRig, interaction: InteractionTarget | null, portalFrame: PortalFrame, showPrompts: boolean): void {
    this.time += dt;
    for (const timeline of TIMELINES) {
      const scroll = rig.scrollOf(timeline);
      this.backdrops[timeline].update(dt, scroll.x, scroll.y);
      this.motes[timeline].update(dt, scroll.x, scroll.y);
      this.portals[timeline].update(dt, portalFrame);
      for (const [index, fragment] of this.fragments[timeline].entries()) {
        fragment.container.y = fragment.def.y + Math.sin(this.time * 2 + fragment.phase) * 4;
        fragment.crystal.scaleX = PIXEL * (0.45 + 0.55 * Math.abs(Math.cos(this.time * 1.4 + index)));
      }
    }
    for (const waterfall of this.waterfalls) {
      waterfall.tilePositionY -= dt * 70;
    }
    for (const item of this.pulsing) {
      item.image.setAlpha(item.base * (0.75 + 0.25 * Math.sin(this.time * item.speed + item.phase)));
    }
    for (const visual of this.mechanisms) {
      if (visual.activated) continue;
      visual.glow.setAlpha(0.35 + 0.3 * Math.sin(this.time * 3));
      if (visual.def.kind === MechanismKind.Bell) visual.moving.setRotation(Math.sin(this.time * 1.2) * 0.05);
    }
    this.updatePrompts(dt, sim, interaction, showPrompts);
  }

  private updatePrompts(dt: number, sim: GameSimulation, interaction: InteractionTarget | null, showPrompts: boolean): void {
    for (const timeline of TIMELINES) {
      const prompt = this.prompts[timeline];
      prompt.update(dt, this.time);
      if (!showPrompts || !interaction || timeline !== sim.timeline) {
        prompt.hide();
        continue;
      }
      if (interaction.kind === InteractionKind.Portal) {
        const missing = interaction.block === InteractionBlock.MissingFragments;
        const playerX = sim.body.x + PLAYER_SIZE.width / 2;
        prompt.show(playerX, sim.body.y - 40, {
          key: this.promptStyle.keys.interact,
          caption: missing ? 'The portal is unstable' : 'Restore the portal',
          muted: missing,
        });
        continue;
      }
      const mechanism = this.level.mechanisms.find((candidate) => candidate.id === interaction.id);
      if (!mechanism) continue;
      if (interaction.available) {
        prompt.show(mechanism.x, mechanism.y - 92, { key: this.promptStyle.keys.interact, caption: mechanism.prompt, muted: false });
      } else {
        const required = interaction.requiredTimeline === Timeline.Dawn ? 'Dawn' : 'Eclipse';
        prompt.show(mechanism.x, mechanism.y - 92, { key: this.promptStyle.keys.shift, caption: `Only answers in the ${required}`, muted: true });
      }
    }
  }

  private placeSprite(
    info: SpriteInfo,
    x: number,
    y: number,
    timeline: Timeline,
    depth: number,
    glowDepth: number,
    glowAlpha: number,
    flip = false,
  ): { image: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image | null } {
    const left = flip ? x - (info.width - info.anchorX) * PIXEL : x - info.anchorX * PIXEL;
    const top = y - info.anchorY * PIXEL;
    const image = this.scene.add.image(left, top, info.key).setOrigin(0).setScale(PIXEL).setFlipX(flip).setDepth(depth);
    this.layers[timeline].add(image);
    let glow: Phaser.GameObjects.Image | null = null;
    if (info.glowKey) {
      glow = this.scene.add
        .image(left, top, info.glowKey)
        .setOrigin(0)
        .setScale(PIXEL)
        .setFlipX(flip)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(Math.min(1, glowAlpha))
        .setDepth(glowDepth);
      this.layers[timeline].add(glow);
      this.pulsing.push({ image: glow, base: Math.min(1, glowAlpha), speed: 1.4 + (x % 7) * 0.2, phase: x * 0.01 });
    }
    return { image, glow };
  }

  private buildSolid(solid: SolidDef): void {
    for (const timeline of TIMELINES) {
      if (!existsIn(solid.presence, timeline)) continue;
      const info = this.art.sprite(TextureKey.solid(solid.id, timeline));
      const sliding = solid.condition?.unless !== undefined;
      const { image, glow } = this.placeSprite(
        info,
        solid.x,
        solid.y,
        timeline,
        sliding ? DEPTH.slidingSolids : DEPTH.solids,
        DEPTH.solidsGlow,
        timeline === Timeline.Dawn ? 0.75 : 1,
      );
      const visual: SolidVisual = { def: solid, image, glow, baseY: image.y, materialized: true };
      if (solid.condition) {
        visual.materialized = solid.condition.unless !== undefined;
        if (solid.condition.requires !== undefined) {
          image.setAlpha(0);
          glow?.setAlpha(0);
        }
        this.solids.push(visual);
      }
    }
  }

  private animatePortcullis(visual: SolidVisual, immediate: boolean): void {
    const raisedY = visual.baseY - (visual.def.h - PORTCULLIS_REST);
    const targetY = visual.materialized ? visual.baseY : raisedY;
    this.scene.tweens.killTweensOf(visual.image);
    if (immediate) {
      visual.image.y = targetY;
      return;
    }
    this.scene.tweens.add({ targets: visual.image, y: targetY, duration: 1900, ease: 'Sine.easeInOut', delay: 350 });
    this.dust[Timeline.Eclipse].explode(18, visual.def.x + visual.def.w / 2, visual.def.y + visual.def.h);
  }

  private animateMaterialize(visual: SolidVisual, immediate: boolean, delay: number): void {
    const targets = [visual.image, visual.glow].filter((item): item is Phaser.GameObjects.Image => item !== null);
    this.scene.tweens.killTweensOf(targets);
    if (immediate || !visual.materialized) {
      for (const target of targets) target.setAlpha(visual.materialized ? 1 : 0).setScale(PIXEL);
      return;
    }
    const timeline = visual.def.presence === Presence.Eclipse ? Timeline.Eclipse : Timeline.Dawn;
    for (const target of targets) {
      target.setScale(PIXEL, PIXEL * 0.2).setAlpha(0);
      this.scene.tweens.add({ targets: target, alpha: 1, scaleY: PIXEL, duration: 650, delay, ease: 'Back.easeOut' });
    }
    this.scene.time.delayedCall(delay, () => this.burst(timeline, visual.def.x + visual.def.w / 2, visual.def.y + visual.def.h / 2, 16));
  }

  private buildDecor(decor: DecorDef, index: number): void {
    for (const timeline of TIMELINES) {
      if (!existsIn(decor.presence, timeline)) continue;
      const info = this.art.sprite(TextureKey.decor(index, timeline));
      const front = decor.layer === DecorLayer.Front;
      const { glow } = this.placeSprite(
        info,
        decor.x,
        decor.y,
        timeline,
        front ? DEPTH.decorFront : DEPTH.decorBack,
        front ? DEPTH.decorFront + 1 : DEPTH.decorBackGlow,
        timeline === Timeline.Dawn ? 0.7 : 1,
        decor.flip ?? false,
      );
      if (decor.kind === DecorKind.Waterfall) {
        const height = decor.size ?? 400;
        const waterfall = this.scene.add
          .tileSprite(decor.x, decor.y, 24, height, TextureKey.waterfall(timeline))
          .setOrigin(0.5, 0)
          .setTileScale(PIXEL)
          .setAlpha(timeline === Timeline.Dawn ? 0.85 : 0.55)
          .setDepth(DEPTH.waterfalls);
        this.layers[timeline].add(waterfall);
        this.waterfalls.push(waterfall);
      }
      if (decor.kind === DecorKind.Brazier) {
        this.addFlame(timeline, decor.x, decor.y - 32);
      }
      if (glow && (decor.kind === DecorKind.Lantern || decor.kind === DecorKind.Brazier)) {
        const pulse = this.pulsing.find((item) => item.image === glow);
        if (pulse) pulse.speed = 5.5;
      }
    }
  }

  private addFlame(timeline: Timeline, x: number, y: number): void {
    const palette = paletteFor(timeline);
    const flame = this.scene.add.particles(x, y, FxTexture.Spark, {
      lifespan: { min: 450, max: 800 },
      speedY: { min: -55, max: -25 },
      speedX: { min: -8, max: 8 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.95, end: 0 },
      frequency: 70,
      blendMode: Phaser.BlendModes.ADD,
      tint: [toTint(palette.emissiveBright), toTint(palette.emissive)],
    });
    flame.setDepth(DEPTH.decorBackGlow);
    this.layers[timeline].add(flame);
  }

  private buildCheckpoint(checkpoint: CheckpointDef): void {
    for (const timeline of TIMELINES) {
      const image = this.scene.add
        .image(checkpoint.x, checkpoint.y + 2, TextureKey.checkpoint(timeline, false))
        .setOrigin(0.5, 1)
        .setScale(PIXEL)
        .setDepth(DEPTH.props);
      const glow = this.scene.add
        .image(checkpoint.x, checkpoint.y - 30, FxTexture.Glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(toTint(paletteFor(timeline).emissive))
        .setScale(0.9)
        .setAlpha(0)
        .setDepth(DEPTH.propsGlow);
      this.layers[timeline].add([glow, image]);
      this.checkpoints.push({ def: checkpoint, timeline, image, glow });
    }
  }

  private buildMechanism(mechanism: MechanismDef): void {
    const timeline = mechanism.presence === Presence.Eclipse ? Timeline.Eclipse : Timeline.Dawn;
    const palette = paletteFor(timeline);
    const layer = this.layers[timeline];
    let moving: Phaser.GameObjects.Image;
    if (mechanism.kind === MechanismKind.Crank) {
      const base = this.scene.add.image(mechanism.x, mechanism.y, TextureKey.crankBase(timeline)).setOrigin(0.5, 1).setScale(PIXEL).setDepth(DEPTH.props);
      moving = this.scene.add.image(mechanism.x, mechanism.y - 38, TextureKey.crankWheel(timeline)).setScale(PIXEL).setDepth(DEPTH.props + 1);
      layer.add([base, moving]);
    } else {
      const frame = this.scene.add.image(mechanism.x, mechanism.y, TextureKey.bellFrame(timeline)).setOrigin(0.5, 1).setScale(PIXEL).setDepth(DEPTH.props);
      moving = this.scene.add.image(mechanism.x, mechanism.y - 72, TextureKey.bell(timeline)).setOrigin(0.5, 0).setScale(PIXEL).setDepth(DEPTH.props + 1);
      layer.add([frame, moving]);
    }
    const glow = this.scene.add
      .image(moving.x, moving.y + (mechanism.kind === MechanismKind.Bell ? 22 : 0), FxTexture.Glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(toTint(palette.emissive))
      .setScale(0.8)
      .setDepth(DEPTH.propsGlow);
    layer.add(glow);
    this.mechanisms.push({ def: mechanism, moving, glow, activated: false });
  }

  private animateMechanism(visual: MechanismVisual): void {
    const timeline = visual.def.presence === Presence.Eclipse ? Timeline.Eclipse : Timeline.Dawn;
    this.scene.tweens.add({ targets: visual.glow, alpha: 0, duration: 1200 });
    if (visual.def.kind === MechanismKind.Crank) {
      this.scene.tweens.add({ targets: visual.moving, angle: visual.moving.angle + 540, duration: 1700, ease: 'Cubic.easeOut' });
    } else {
      this.scene.tweens.add({
        targets: visual.moving,
        rotation: { from: 0.55, to: 0 },
        duration: 2600,
        ease: (t: number) => Math.cos(t * Math.PI * 7) * (1 - t),
      });
      this.ringAt(timeline, visual.def.x, visual.def.y - 50, 3.5, paletteFor(timeline).emissive);
    }
    this.burst(timeline, visual.moving.x, visual.moving.y, 24);
  }

  private buildFragment(fragment: FragmentDef): void {
    for (const timeline of TIMELINES) {
      if (!existsIn(fragment.presence, timeline)) continue;
      const palette = paletteFor(timeline);
      const beam = this.scene.add
        .image(0, 12, FxTexture.Shaft)
        .setOrigin(0.5, 1)
        .setFlipY(true)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(toTint(palette.emissiveBright))
        .setScale(0.35, 0.7)
        .setAlpha(0.18);
      const glow = this.scene.add.image(0, 0, FxTexture.Glow).setBlendMode(Phaser.BlendModes.ADD).setTint(toTint(palette.emissive)).setScale(0.7).setAlpha(0.85);
      const crystal = this.scene.add.image(0, 0, TextureKey.fragment(timeline)).setScale(PIXEL);
      const container = this.scene.add.container(fragment.x, fragment.y, [beam, glow, crystal]).setDepth(DEPTH.fragments);
      this.layers[timeline].add(container);
      this.fragments[timeline].push({ def: fragment, container, crystal, phase: fragment.x * 0.01 });
    }
  }

  private createSparks(timeline: Timeline): Phaser.GameObjects.Particles.ParticleEmitter {
    const palette = paletteFor(timeline);
    const emitter = this.scene.add.particles(0, 0, FxTexture.Spark, {
      lifespan: { min: 450, max: 1100 },
      speed: { min: 40, max: 190 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: -40,
      blendMode: Phaser.BlendModes.ADD,
      tint: [toTint(palette.emissiveBright), toTint(palette.emissive), toTint(palette.accent)],
      emitting: false,
    });
    emitter.setDepth(DEPTH.fx);
    this.layers[timeline].add(emitter);
    return emitter;
  }

  private createDust(timeline: Timeline): Phaser.GameObjects.Particles.ParticleEmitter {
    const palette = paletteFor(timeline);
    const emitter = this.scene.add.particles(0, 0, FxTexture.Pixel, {
      lifespan: { min: 300, max: 700 },
      speedX: { min: -70, max: 70 },
      speedY: { min: -90, max: -20 },
      scale: { start: 1.2, end: 0.4 },
      alpha: { start: 0.8, end: 0 },
      gravityY: 320,
      tint: [toTint(palette.stoneLight), toTint(palette.stoneMid)],
      emitting: false,
    });
    emitter.setDepth(DEPTH.fx);
    this.layers[timeline].add(emitter);
    return emitter;
  }

  private createFlyers(timeline: Timeline): Flyer[] {
    const palette = paletteFor(timeline);
    return [0, 1, 2].map(() => {
      const glow = this.scene.add.image(0, 0, FxTexture.Glow).setBlendMode(Phaser.BlendModes.ADD).setTint(toTint(palette.emissive)).setScale(0.8).setVisible(false).setDepth(DEPTH.fx);
      const crystal = this.scene.add.image(0, 0, TextureKey.fragment(timeline)).setScale(PIXEL).setVisible(false).setDepth(DEPTH.fx + 1);
      this.layers[timeline].add([glow, crystal]);
      return { crystal, glow };
    });
  }
}
