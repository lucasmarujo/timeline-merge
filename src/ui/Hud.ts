import Phaser from 'phaser';
import { GAME_WIDTH, SEAM_X } from '../config';
import { FRAGMENTS_REQUIRED } from '../core/constants';
import { Timeline } from '../core/enums';
import { toTint } from '../render/art/color';
import { FxTexture } from '../render/art/textureKeys';
import { FadingGroup, type Fadeable } from './FadingGroup';
import { COLORS, displayStyle } from './textStyles';

const SLOT_Y = 38;
const SLOT_SPACING = 40;
const LABEL_OFFSET = 78;
const LEVEL_LABEL_Y = 68;

interface Slot {
  graphics: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Image;
  filled: boolean;
  pop: number;
}

export class Hud {
  private readonly slots: Slot[] = [];
  private readonly dawnLabel: Phaser.GameObjects.Text;
  private readonly eclipseLabel: Phaser.GameObjects.Text;
  private readonly glyphs: Phaser.GameObjects.Graphics;
  private readonly levelLabel: Phaser.GameObjects.Text;
  private readonly group: FadingGroup;
  private band: Phaser.GameObjects.Image;
  private visibleSlots = FRAGMENTS_REQUIRED;
  private dawnEmphasis = 1;
  private eclipseEmphasis = 0;

  constructor(scene: Phaser.Scene) {
    const band = scene.add.image(GAME_WIDTH / 2, 0, FxTexture.Fade).setOrigin(0.5, 0).setFlipY(true).setDisplaySize(GAME_WIDTH, 90).setTint(0x000000).setAlpha(0.3);
    this.band = band;
    this.glyphs = scene.add.graphics();
    this.levelLabel = scene.add.text(SEAM_X, LEVEL_LABEL_Y, '', displayStyle(11, COLORS.mist)).setOrigin(0.5).setLetterSpacing(5);
    this.dawnLabel = scene.add.text(SEAM_X - LABEL_OFFSET, SLOT_Y, 'DAWN', displayStyle(15, COLORS.gold)).setOrigin(1, 0.5).setLetterSpacing(4);
    this.eclipseLabel = scene.add.text(SEAM_X + LABEL_OFFSET, SLOT_Y, 'ECLIPSE', displayStyle(15, COLORS.violet)).setOrigin(0, 0.5).setLetterSpacing(4);
    const items: Fadeable[] = [band, this.glyphs, this.dawnLabel, this.eclipseLabel, this.levelLabel];
    for (let index = 0; index < FRAGMENTS_REQUIRED; index++) {
      const x = SEAM_X + (index - 1) * SLOT_SPACING;
      const glow = scene.add.image(x, SLOT_Y, FxTexture.GlowTight).setBlendMode(Phaser.BlendModes.ADD).setTint(toTint('#c69bff')).setScale(0.9);
      const graphics = scene.add.graphics({ x, y: SLOT_Y });
      this.slots.push({ graphics, glow, filled: false, pop: 0 });
      items.push(glow, graphics);
    }
    this.group = new FadingGroup(items, 3, 3);
    this.drawSlots();
  }

  show(): void {
    this.group.show();
  }

  configure(label: string, slots: number): void {
    this.levelLabel.setText(label);
    this.visibleSlots = Math.max(1, Math.min(FRAGMENTS_REQUIRED, slots));
    this.slots.forEach((slot, index) => {
      const x = SEAM_X + (index - (this.visibleSlots - 1) / 2) * SLOT_SPACING;
      slot.graphics.setX(x);
      slot.glow.setX(x);
    });
    this.setFragments(0);
  }

  setWidth(width: number): void {
    this.band.setDisplaySize(width, 90);
  }

  hide(): void {
    this.group.hide();
  }

  setFragments(count: number): void {
    this.slots.forEach((slot, index) => {
      const filled = index < count;
      if (filled && !slot.filled) slot.pop = 1;
      slot.filled = filled;
    });
    this.drawSlots();
  }

  update(dt: number, timeline: Timeline, bothActive: boolean, time: number): void {
    this.group.update(dt);
    const dawnTarget = bothActive || timeline === Timeline.Dawn ? 1 : 0;
    const eclipseTarget = bothActive || timeline === Timeline.Eclipse ? 1 : 0;
    this.dawnEmphasis += (dawnTarget - this.dawnEmphasis) * Math.min(1, dt * 10);
    this.eclipseEmphasis += (eclipseTarget - this.eclipseEmphasis) * Math.min(1, dt * 10);
    const base = this.group.opacity;
    this.dawnLabel.setAlpha(base * (0.32 + 0.68 * this.dawnEmphasis));
    this.eclipseLabel.setAlpha(base * (0.32 + 0.68 * this.eclipseEmphasis));
    this.drawGlyphs();
    let needsRedraw = false;
    this.slots.forEach((slot, index) => {
      if (slot.pop > 0) {
        slot.pop = Math.max(0, slot.pop - dt * 1.6);
        needsRedraw = true;
      }
      const shown = index < this.visibleSlots;
      slot.graphics.setVisible(shown && base > 0.001);
      slot.glow.setAlpha(shown ? base * (slot.filled ? 0.55 + 0.25 * Math.sin(time * 2.4 + index) + slot.pop * 0.6 : 0) : 0);
      slot.graphics.setScale(1 + slot.pop * 0.6);
    });
    if (needsRedraw) this.drawSlots();
  }

  private drawSlots(): void {
    for (const slot of this.slots) {
      const g = slot.graphics;
      g.clear();
      const points = [new Phaser.Math.Vector2(0, -11), new Phaser.Math.Vector2(7, 0), new Phaser.Math.Vector2(0, 11), new Phaser.Math.Vector2(-7, 0)];
      if (slot.filled) {
        g.fillStyle(0xf6eeff, 1);
        g.fillPoints(points, true);
        g.fillStyle(0xc49bff, 1);
        g.fillTriangle(-7, 0, 0, 11, 0, 0);
        g.fillStyle(0xffe6a8, 1);
        g.fillTriangle(0, -11, 7, 0, 0, 0);
      }
      g.lineStyle(1.5, 0xf1e6ff, slot.filled ? 1 : 0.55);
      g.strokePoints(points, true);
    }
  }

  private drawGlyphs(): void {
    const g = this.glyphs;
    g.clear();
    const sunX = SEAM_X - LABEL_OFFSET - 66;
    g.lineStyle(1.5, 0xf3cf7a, 0.3 + 0.7 * this.dawnEmphasis);
    g.strokeCircle(sunX, SLOT_Y, 5);
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray / 8) * Math.PI * 2;
      g.lineBetween(sunX + Math.cos(angle) * 7.5, SLOT_Y + Math.sin(angle) * 7.5, sunX + Math.cos(angle) * 10, SLOT_Y + Math.sin(angle) * 10);
    }
    const moonX = SEAM_X + LABEL_OFFSET + 98;
    g.fillStyle(0xc9a4ff, 0.3 + 0.7 * this.eclipseEmphasis);
    g.fillCircle(moonX, SLOT_Y, 8);
    g.fillStyle(0x0b0918, 1);
    g.fillCircle(moonX + 3.5, SLOT_Y - 2, 7);
    g.lineStyle(1, 0xf1e6ff, 0.25 * this.dawnEmphasis);
    g.lineBetween(SEAM_X - LABEL_OFFSET - 48, SLOT_Y + 14, SEAM_X - LABEL_OFFSET, SLOT_Y + 14);
    g.lineStyle(1, 0xf1e6ff, 0.25 * this.eclipseEmphasis);
    g.lineBetween(SEAM_X + LABEL_OFFSET, SLOT_Y + 14, SEAM_X + LABEL_OFFSET + 76, SLOT_Y + 14);
  }
}
