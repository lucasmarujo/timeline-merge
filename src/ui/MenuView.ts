import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import type { Fadeable } from './FadingGroup';
import type { Menu } from './Menu';
import { MENU_HIT_WIDTH } from './inputPresentation';
import { displayStyle } from './textStyles';

export class MenuView {
  readonly texts: Phaser.GameObjects.Text[];
  readonly markers: Phaser.GameObjects.Graphics;
  private readonly zones: Phaser.GameObjects.Zone[];

  constructor(scene: Phaser.Scene, count: number, onPick: (index: number) => void) {
    this.texts = Array.from({ length: count }, () => scene.add.text(GAME_WIDTH / 2, 0, '', displayStyle(21)).setOrigin(0.5).setLetterSpacing(3));
    this.markers = scene.add.graphics();
    this.zones = Array.from({ length: count }, (_, index) => {
      const zone = scene.add.zone(GAME_WIDTH / 2, 0, MENU_HIT_WIDTH, 1).setInteractive();
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) onPick(index);
      });
      return zone;
    });
    this.setEnabled(false);
  }

  get items(): Fadeable[] {
    return [this.markers, ...this.texts];
  }

  place(firstY: number, spacing: number, size: number): void {
    this.texts.forEach((text, index) => text.setY(firstY + index * spacing).setStyle(displayStyle(size)));
    this.zones.forEach((zone, index) => zone.setPosition(GAME_WIDTH / 2, firstY + index * spacing).setSize(MENU_HIT_WIDTH, spacing));
  }

  setEnabled(enabled: boolean): void {
    for (const zone of this.zones) {
      if (zone.input) zone.input.enabled = enabled;
    }
  }

  render<T extends string>(menu: Menu<T>): void {
    this.markers.clear();
    this.texts.forEach((text, index) => {
      const item = menu.items[index];
      text.setVisible(item !== undefined);
      if (!item) return;
      const selected = index === menu.index;
      text.setText(item.label);
      text.setColor(selected ? '#fff3d6' : '#a99fbf');
      if (selected) {
        this.markers.fillStyle(0xf3cf7a, 1);
        diamond(this.markers, text.x - text.width / 2 - 22, text.y);
        this.markers.fillStyle(0xc9a4ff, 1);
        diamond(this.markers, text.x + text.width / 2 + 22, text.y);
      }
    });
  }
}

export function diamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size = 6): void {
  graphics.fillPoints(
    [new Phaser.Math.Vector2(x, y - size), new Phaser.Math.Vector2(x + size * 0.84, y), new Phaser.Math.Vector2(x, y + size), new Phaser.Math.Vector2(x - size * 0.84, y)],
    true,
  );
}
