import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { FxTexture } from '../render/art/textureKeys';
import { FadingGroup } from './FadingGroup';
import type { Menu } from './Menu';
import { MenuView } from './MenuView';
import { applyRealityGradient, bodyStyle, COLORS, displayStyle } from './textStyles';

export interface CompletionContent {
  title: string;
  name: string;
  stats: string;
  badge: string;
  teaser: string;
}

const CENTER = GAME_WIDTH / 2;

export class CompletionCard {
  readonly menu: MenuView;
  private readonly group: FadingGroup;
  private readonly title: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly teaser: Phaser.GameObjects.Text;
  private readonly help: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onPick: (index: number) => void) {
    const veil = scene.add.image(CENTER, 300, FxTexture.Glow).setDisplaySize(1700, 760).setTint(0x07060d).setAlpha(0.78);
    this.title = scene.add.text(CENTER, 150, '', displayStyle(44)).setOrigin(0.5).setLetterSpacing(7).setPadding(40, 28, 40, 28);
    this.title.setShadow(0, 0, 'rgba(150, 100, 255, 0.8)', 22, true, true);
    this.name = scene.add.text(CENTER, 206, '', bodyStyle(27)).setOrigin(0.5);
    this.stats = scene.add.text(CENTER, 262, '', displayStyle(17, COLORS.mist)).setOrigin(0.5).setLetterSpacing(3);
    this.badge = scene.add.text(CENTER, 306, '', bodyStyle(23, false, COLORS.gold)).setOrigin(0.5);
    this.teaser = scene.add.text(CENTER, 352, '', bodyStyle(24, true, COLORS.violet)).setOrigin(0.5);
    this.help = scene.add.text(CENTER, GAME_HEIGHT - 40, '', bodyStyle(19, false, COLORS.mist)).setOrigin(0.5);
    this.menu = new MenuView(scene, 3, onPick);
    this.group = new FadingGroup([veil, this.title, this.name, this.stats, this.badge, this.teaser, this.help, ...this.menu.items], 2, 6);
  }

  show<T extends string>(content: CompletionContent, menu: Menu<T>, help: string): void {
    this.title.setText(content.title);
    applyRealityGradient(this.title);
    this.name.setText(content.name);
    this.stats.setText(content.stats);
    this.badge.setText(content.badge);
    this.teaser.setText(content.teaser);
    this.help.setText(help);
    this.group.show();
    this.menu.setEnabled(true);
    this.menu.render(menu);
  }

  setHelp(help: string): void {
    this.help.setText(help);
  }

  hide(): void {
    this.group.hide();
    this.menu.setEnabled(false);
  }

  hideImmediately(): void {
    this.group.hideImmediately();
    this.menu.setEnabled(false);
  }

  update(dt: number): void {
    this.group.update(dt);
  }
}
