import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { FxTexture } from '../render/art/textureKeys';
import { FadingGroup } from './FadingGroup';
import { applyRealityGradient, bodyStyle, COLORS, displayStyle } from './textStyles';

export interface DiscoveryContent {
  kind: string;
  title: string;
  summary: string;
  control: string | null;
  ability: boolean;
}

const CENTER = GAME_WIDTH / 2;

export class DiscoveryCard {
  private readonly group: FadingGroup;
  private readonly kind: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly control: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly emblem: Phaser.GameObjects.Graphics;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly zone: Phaser.GameObjects.Zone;
  private time = 0;

  constructor(scene: Phaser.Scene, onConfirm: () => void) {
    const veil = scene.add.rectangle(CENTER, GAME_HEIGHT / 2, 4200, GAME_HEIGHT, 0x06050c, 0.82);
    this.halo = scene.add.image(CENTER, 196, FxTexture.Glow).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setTint(0xb98bff);
    this.emblem = scene.add.graphics();
    this.kind = scene.add.text(CENTER, 296, '', displayStyle(16, COLORS.gold)).setOrigin(0.5).setLetterSpacing(10);
    this.title = scene.add.text(CENTER, 352, '', displayStyle(54)).setOrigin(0.5).setLetterSpacing(5).setPadding(40, 26, 40, 26);
    this.title.setShadow(0, 0, 'rgba(150, 100, 255, 0.85)', 22, true, true);
    this.summary = scene.add.text(CENTER, 438, '', bodyStyle(28)).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(840);
    this.control = scene.add.text(CENTER, 560, '', displayStyle(18, COLORS.mist)).setOrigin(0.5).setLetterSpacing(4);
    this.prompt = scene.add.text(CENTER, GAME_HEIGHT - 70, '', displayStyle(20)).setOrigin(0.5).setLetterSpacing(5);
    this.group = new FadingGroup([veil, this.halo, this.emblem, this.kind, this.title, this.summary, this.control, this.prompt], 3, 5);
    this.zone = scene.add.zone(CENTER, GAME_HEIGHT / 2, 4200, GAME_HEIGHT).setInteractive();
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) onConfirm();
    });
    this.setInteractive(false);
  }

  show(content: DiscoveryContent, prompt: string): void {
    this.kind.setText(content.kind.toUpperCase());
    this.kind.setColor(content.ability ? COLORS.gold : COLORS.violet);
    this.title.setText(content.title.toUpperCase());
    applyRealityGradient(this.title);
    this.summary.setText(content.summary);
    this.control.setText(content.control ?? '');
    this.prompt.setText(prompt);
    this.halo.setTint(content.ability ? 0xf3cf7a : 0xb98bff);
    this.group.show();
    this.setInteractive(true);
  }

  setPrompt(prompt: string, control: string | null): void {
    this.prompt.setText(prompt);
    if (control !== null) this.control.setText(control);
  }

  hide(): void {
    this.group.hide();
    this.setInteractive(false);
  }

  hideImmediately(): void {
    this.group.hideImmediately();
    this.setInteractive(false);
  }

  update(dt: number): void {
    this.time += dt;
    this.group.update(dt);
    const opacity = this.group.opacity;
    if (opacity <= 0) return;
    const g = this.emblem;
    g.clear();
    const spin = this.time * 0.6;
    g.lineStyle(2, 0xf6eeff, 0.85);
    g.strokeCircle(CENTER, 196, 46);
    g.lineStyle(1, 0xf3cf7a, 0.6);
    for (let ray = 0; ray < 12; ray++) {
      const angle = spin + (ray / 12) * Math.PI * 2;
      g.lineBetween(CENTER + Math.cos(angle) * 54, 196 + Math.sin(angle) * 54, CENTER + Math.cos(angle) * (66 + (ray % 2) * 10), 196 + Math.sin(angle) * (66 + (ray % 2) * 10));
    }
    g.fillStyle(0xfff3d6, 1);
    g.fillPoints([new Phaser.Math.Vector2(CENTER, 166), new Phaser.Math.Vector2(CENTER + 18, 196), new Phaser.Math.Vector2(CENTER, 226), new Phaser.Math.Vector2(CENTER - 18, 196)], true);
    g.fillStyle(0xb98bff, 1);
    g.fillTriangle(CENTER, 196, CENTER, 226, CENTER - 18, 196);
    this.halo.setAlpha(opacity * (0.45 + 0.15 * Math.sin(this.time * 2.2)));
    this.prompt.setAlpha(opacity * (0.7 + 0.3 * Math.sin(this.time * 2.6)));
  }

  private setInteractive(enabled: boolean): void {
    if (this.zone.input) this.zone.input.enabled = enabled;
  }
}
