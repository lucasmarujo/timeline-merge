import Phaser from 'phaser';
import { PIXEL } from '../config';
import { FRAGMENTS_REQUIRED } from '../core/constants';
import { ExitKind, Timeline } from '../core/enums';
import type { PortalDef } from '../core/types';
import { toTint } from './art/color';
import { paletteFor } from './art/palette';
import { PORTAL_RING_RADIUS, PORTAL_SOCKET_ANGLES } from './art/propArt';
import { FxTexture, TextureKey } from './art/textureKeys';
import { DEPTH } from './depths';

export interface PortalFrame {
  power: number;
  ringSpeed: number;
  assembled: number;
  sockets: readonly number[];
}

const SOCKET_RADIUS = (PORTAL_RING_RADIUS - 5.5) * PIXEL;
const SHARD_DRIFT = 30;
const GATE_SCALE = 0.55;

export const OPEN_GATE_FRAME: PortalFrame = { power: 0.95, ringSpeed: 2.2, assembled: 1, sockets: [0, 0, 0] };

export class PortalView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly runes: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private readonly heart: Phaser.GameObjects.Image;
  private readonly shards: Phaser.GameObjects.Image[] = [];
  private readonly sockets: Phaser.GameObjects.Image[] = [];
  private readonly socketGlows: Phaser.GameObjects.Image[] = [];
  private readonly coreStrength: number;
  private readonly scale: number;
  private time = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, timeline: Timeline, portal: PortalDef) {
    const palette = paletteFor(timeline);
    const isDawn = timeline === Timeline.Dawn;
    this.scale = portal.kind === ExitKind.Gate ? GATE_SCALE : 1;
    this.container = scene.add.container(portal.x, portal.y).setDepth(DEPTH.portal).setScale(this.scale);
    layer.add(this.container);

    this.halo = scene.add
      .image(0, 0, FxTexture.Glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(toTint(isDawn ? '#c69cff' : '#9b5cff'))
      .setScale(4.2);
    this.core = scene.add
      .image(0, 0, FxTexture.PortalCore)
      .setBlendMode(isDawn ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD)
      .setTint(toTint(isDawn ? '#9a74e8' : '#b582ff'))
      .setScale(1.7);
    this.heart = scene.add.image(0, 0, FxTexture.GlowTight).setBlendMode(Phaser.BlendModes.ADD).setTint(isDawn ? 0xd9c4ff : 0xfbf3ff).setScale(1.3);
    this.coreStrength = isDawn ? 0.7 : 1;
    this.runes = scene.add.image(0, 0, TextureKey.portalRunes(timeline)).setScale(PIXEL);
    this.ring = scene.add.image(0, 0, TextureKey.portalRing(timeline)).setScale(PIXEL);
    this.container.add([this.halo, this.core, this.heart, this.runes, this.ring]);

    PORTAL_SOCKET_ANGLES.forEach((angle) => {
      const shard = scene.add.image(0, 0, TextureKey.portalShard(timeline)).setScale(PIXEL).setRotation(angle + Math.PI / 2);
      const glow = scene.add
        .image(Math.cos(angle) * SOCKET_RADIUS, Math.sin(angle) * SOCKET_RADIUS, FxTexture.GlowTight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(toTint(palette.emissive))
        .setScale(0.9)
        .setAlpha(0);
      const socket = scene.add
        .image(Math.cos(angle) * SOCKET_RADIUS, Math.sin(angle) * SOCKET_RADIUS, TextureKey.fragment(timeline))
        .setScale(0);
      this.shards.push(shard);
      this.socketGlows.push(glow);
      this.sockets.push(socket);
      this.container.add([shard, glow, socket]);
    });
  }

  update(dt: number, frame: PortalFrame): void {
    this.time += dt;
    const flicker = frame.assembled >= 1 ? 1 : 0.75 + 0.25 * Math.sin(this.time * 11.3) * Math.sin(this.time * 4.1);
    const power = frame.power * flicker;
    this.ring.rotation += dt * 0.04 * frame.ringSpeed;
    this.runes.rotation -= dt * 0.12 * frame.ringSpeed;
    this.core.rotation += dt * 0.6 * frame.ringSpeed;
    this.core.setAlpha((0.35 + power * 0.65) * this.coreStrength);
    this.core.setScale(1.45 + power * 0.3 + Math.sin(this.time * 2.4) * 0.04);
    this.heart.setAlpha((0.25 + power * 0.75) * this.coreStrength);
    this.heart.setScale(0.6 + power * 0.8);
    this.halo.setAlpha((0.18 + power * 0.42) * this.coreStrength);
    this.runes.setAlpha(0.45 + power * 0.55);

    PORTAL_SOCKET_ANGLES.forEach((angle, index) => {
      const shard = this.shards[index] as Phaser.GameObjects.Image;
      const drift = (1 - frame.assembled) * (SHARD_DRIFT + Math.sin(this.time * 1.3 + index * 2) * 6);
      const jitter = (1 - frame.assembled) * Math.sin(this.time * 17 + index) * 1.2;
      const radius = SOCKET_RADIUS + drift;
      shard.setPosition(Math.cos(angle) * radius + jitter, Math.sin(angle) * radius);
      shard.setRotation(angle + Math.PI / 2 + (1 - frame.assembled) * Math.sin(this.time * 0.9 + index) * 0.25);
      const filled = frame.sockets[index] ?? 0;
      const socket = this.sockets[index] as Phaser.GameObjects.Image;
      socket.setScale(PIXEL * 0.9 * filled);
      (this.socketGlows[index] as Phaser.GameObjects.Image).setAlpha(filled * (0.7 + 0.3 * Math.sin(this.time * 3 + index)));
    });
  }

  static emptyFrame(fragmentCount: number): PortalFrame {
    return {
      power: 0.3 + (fragmentCount / FRAGMENTS_REQUIRED) * 0.25,
      ringSpeed: 1 + fragmentCount * 0.3,
      assembled: 0,
      sockets: [0, 0, 0],
    };
  }

  socketWorldPosition(index: number): { x: number; y: number } {
    const angle = PORTAL_SOCKET_ANGLES[index] ?? 0;
    return { x: this.container.x + Math.cos(angle) * SOCKET_RADIUS * this.scale, y: this.container.y + Math.sin(angle) * SOCKET_RADIUS * this.scale };
  }
}
