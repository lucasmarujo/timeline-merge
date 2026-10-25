import Phaser from 'phaser';
import { PIXEL } from '../config';
import { MOVEMENT } from '../core/constants';
import { Timeline } from '../core/enums';
import { clamp } from '../core/geometry';
import { TRAVELER_FEET_Y, TRAVELER_FRAME, TravelerAnimation } from './art/characterArt';
import { toTint } from './art/color';
import { animationKey, FxTexture, TextureKey } from './art/textureKeys';
import { DEPTH } from './depths';

export interface PlayerRenderState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  activeTimeline: Timeline;
  shiftBlocked: boolean;
  mirrorAxis: number;
  mirror: number;
  bothActive: boolean;
  dashing: boolean;
  gliding: boolean;
  wallSliding: boolean;
  wallSide: -1 | 0 | 1;
}

const TIMELINES = [Timeline.Dawn, Timeline.Eclipse] as const;
const LAND_HOLD = 0.09;
const TRAIL_INTERVAL = 0.035;

export class PlayerView {
  private readonly sprites: Record<Timeline, Phaser.GameObjects.Sprite>;
  private readonly auras: Record<Timeline, Phaser.GameObjects.Image>;
  private readonly playing: Record<Timeline, TravelerAnimation | null> = {
    [Timeline.Dawn]: null,
    [Timeline.Eclipse]: null,
  };
  private landHold = 0;
  private squash = 0;
  private presence = 1;
  private presenceTarget = 1;
  private time = 0;
  private trail = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Record<Timeline, Phaser.GameObjects.Layer>,
  ) {
    const make = (timeline: Timeline): Phaser.GameObjects.Sprite =>
      scene.add
        .sprite(0, 0, TextureKey.traveler(timeline), 0)
        .setOrigin(0.5, TRAVELER_FEET_Y / TRAVELER_FRAME)
        .setScale(PIXEL)
        .setDepth(DEPTH.player);
    const aura = (timeline: Timeline): Phaser.GameObjects.Image =>
      scene.add
        .image(0, 0, FxTexture.Glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(toTint(timeline === Timeline.Dawn ? '#ffe3a6' : '#9a6bff'))
        .setScale(0.75)
        .setDepth(DEPTH.player - 1);
    this.sprites = { [Timeline.Dawn]: make(Timeline.Dawn), [Timeline.Eclipse]: make(Timeline.Eclipse) };
    this.auras = { [Timeline.Dawn]: aura(Timeline.Dawn), [Timeline.Eclipse]: aura(Timeline.Eclipse) };
    for (const timeline of TIMELINES) {
      layers[timeline].add([this.auras[timeline], this.sprites[timeline]]);
    }
  }

  land(impactSpeed: number): void {
    if (impactSpeed < 120) return;
    this.landHold = LAND_HOLD;
    this.squash = clamp(impactSpeed / MOVEMENT.maxFallSpeed, 0.25, 1);
  }

  vanish(): void {
    this.presenceTarget = 0;
  }

  appear(immediate: boolean): void {
    this.presenceTarget = 1;
    if (immediate) this.presence = 1;
    else this.presence = 0;
  }

  afterimage(timeline: Timeline): void {
    const source = this.sprites[timeline];
    const ghost = this.scene.add
      .sprite(source.x, source.y, source.texture.key, source.frame.name)
      .setOrigin(source.originX, source.originY)
      .setScale(source.scaleX, source.scaleY)
      .setFlipX(source.flipX)
      .setTintFill(toTint(timeline === Timeline.Dawn ? '#fff1c9' : '#c9a2ff'))
      .setAlpha(0.7)
      .setDepth(DEPTH.playerFx);
    this.layers[timeline].add(ghost);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: source.scaleX * 1.15,
      scaleY: source.scaleY * 1.05,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
  }

  update(state: PlayerRenderState, dt: number): void {
    this.time += dt;
    this.landHold = Math.max(0, this.landHold - dt);
    this.squash = Math.max(0, this.squash - dt * 7);
    this.presence += (this.presenceTarget - this.presence) * (1 - Math.exp(-dt * 10));

    const animation = this.chooseAnimation(state);
    this.trail = state.dashing ? this.trail - dt : 0;
    if (state.dashing && this.trail <= 0) {
      this.trail = TRAIL_INTERVAL;
      this.afterimage(state.activeTimeline);
    }
    const squashX = 1 + this.squash * 0.16;
    const squashY = 1 - this.squash * 0.18;
    const appearScale = 0.6 + 0.4 * this.presence;

    for (const timeline of TIMELINES) {
      const sprite = this.sprites[timeline];
      const aura = this.auras[timeline];
      const mirrored = timeline === Timeline.Eclipse && state.mirror > 0;
      const x = mirrored ? state.x + (2 * state.mirrorAxis - 2 * state.x) * state.mirror : state.x;
      const facing = state.wallSliding && state.wallSide !== 0 ? state.wallSide : state.facing;
      const facingRight = mirrored && state.mirror > 0.5 ? facing < 0 : facing > 0;

      sprite.setPosition(Math.round(x), Math.round(state.y));
      sprite.setFlipX(!facingRight);
      sprite.setScale(PIXEL * squashX * (0.85 + 0.15 * appearScale), PIXEL * squashY * appearScale);
      this.play(timeline, animation, Math.abs(state.vx));

      const active = state.bothActive || timeline === state.activeTimeline;
      let alpha = active ? 1 : 0.5;
      if (active) {
        sprite.clearTint();
      } else if (state.shiftBlocked) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
        sprite.setTint(Phaser.Display.Color.GetColor(255, Math.round(120 + 60 * pulse), Math.round(120 + 60 * pulse)));
        alpha = 0.6;
      } else {
        sprite.setTint(toTint(timeline === Timeline.Dawn ? '#fff4dc' : '#d6c4ff'));
      }
      sprite.setAlpha(alpha * this.presence);

      aura.setPosition(x, state.y - 22);
      const auraBase = timeline === Timeline.Dawn ? 0.16 : 0.32;
      aura.setAlpha((active ? auraBase : auraBase * 0.4) * this.presence * (0.85 + 0.15 * Math.sin(this.time * 2.2)));
    }
  }

  private chooseAnimation(state: PlayerRenderState): TravelerAnimation {
    if (state.dashing) return TravelerAnimation.Dash;
    if (this.landHold > 0 && state.onGround) return TravelerAnimation.Land;
    if (!state.onGround) {
      if (state.wallSliding) return TravelerAnimation.WallSlide;
      if (state.gliding) return TravelerAnimation.Glide;
      return state.vy < -40 ? TravelerAnimation.Rise : TravelerAnimation.Fall;
    }
    return Math.abs(state.vx) > 25 ? TravelerAnimation.Run : TravelerAnimation.Idle;
  }

  private play(timeline: Timeline, animation: TravelerAnimation, speed: number): void {
    const sprite = this.sprites[timeline];
    if (this.playing[timeline] !== animation) {
      sprite.play(animationKey(timeline, animation));
      this.playing[timeline] = animation;
    }
    sprite.anims.timeScale = animation === TravelerAnimation.Run ? clamp(speed / MOVEMENT.runSpeed, 0.55, 1.15) : 1;
  }
}
