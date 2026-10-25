import Phaser from 'phaser';
import { FONTS } from '../config';
import { DEPTH } from './depths';

export interface PromptContent {
  key: string;
  caption: string;
  muted: boolean;
}

export interface PromptKeys {
  interact: string;
  shift: string;
}

export interface PromptStyle {
  keys: PromptKeys;
  scale: number;
}

export class InteractionPrompt {
  private readonly container: Phaser.GameObjects.Container;
  private readonly cap: Phaser.GameObjects.Graphics;
  private readonly keyLabel: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private visible = 0;
  private target = 0;
  private renderedKey = '';
  private renderedMuted = false;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, private readonly accent: number) {
    this.cap = scene.add.graphics();
    this.keyLabel = scene.add
      .text(0, 0, '', { fontFamily: FONTS.display, fontSize: '13px', color: '#fff8ea' })
      .setOrigin(0.5);
    this.caption = scene.add
      .text(0, 22, '', {
        fontFamily: FONTS.body,
        fontSize: '17px',
        fontStyle: 'italic',
        color: '#fff8ea',
        stroke: '#120d1c',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.container = scene.add.container(0, 0, [this.cap, this.keyLabel, this.caption]).setDepth(DEPTH.prompts).setAlpha(0);
    layer.add(this.container);
  }

  show(x: number, y: number, content: PromptContent): void {
    this.target = 1;
    this.container.setPosition(Math.round(x), Math.round(y));
    if (content.key !== this.renderedKey || content.muted !== this.renderedMuted) {
      this.drawCap(content.key, content.muted);
    }
    this.keyLabel.setText(content.key);
    this.caption.setText(content.caption);
    this.caption.setAlpha(content.muted ? 0.75 : 1);
  }

  hide(): void {
    this.target = 0;
  }

  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  update(dt: number, time: number): void {
    this.visible += (this.target - this.visible) * (1 - Math.exp(-dt * 12));
    this.container.setAlpha(this.visible);
    this.container.y += Math.sin(time * 3) * 0.08;
  }

  private drawCap(key: string, muted: boolean): void {
    const width = Math.max(26, key.length * 10 + 14);
    this.cap.clear();
    this.cap.fillStyle(0x0d0a16, 0.62);
    this.cap.fillRoundedRect(-width / 2, -13, width, 26, 6);
    this.cap.lineStyle(1.5, muted ? 0x9a90b0 : this.accent, 0.95);
    this.cap.strokeRoundedRect(-width / 2, -13, width, 26, 6);
    this.renderedKey = key;
    this.renderedMuted = muted;
  }
}
