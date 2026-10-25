import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HALF_WIDTH, SCENE_KEYS, SEAM_X } from '../config';
import { Timeline } from '../core/enums';
import type { AreaDef, FragmentDef } from '../core/types';
import { InputMode } from '../input/inputMode';
import { toTint } from '../render/art/color';
import { FxTexture } from '../render/art/textureKeys';
import { FadingGroup, type Fadeable } from '../ui/FadingGroup';
import { Hud } from '../ui/Hud';
import { INPUT_COPY, INTRO_HEADING, MENU_HIT_WIDTH, UI_LAYOUT, type TextSlot } from '../ui/inputPresentation';
import { formatDuration, type Menu } from '../ui/Menu';
import { Seam } from '../ui/Seam';
import { applyRealityGradient, bodyStyle, COLORS, displayStyle } from '../ui/textStyles';

export interface UiHost {
  attachUi(ui: UIScene): void;
  pickMenuItem(index: number): void;
}

export interface UiFrame {
  timeline: Timeline;
  bothActive: boolean;
  focusY: number;
  dim: Record<Timeline, number>;
  postFx: boolean;
  hint: string | null;
  fade: number;
  flash: number;
  seamIntensity: number;
}

export interface VictoryStats {
  time: number;
  shifts: number;
  deaths: number;
}

export class UIScene extends Phaser.Scene {
  private host!: UiHost;
  private seam!: Seam;
  private hud!: Hud;
  private dims!: Record<Timeline, Phaser.GameObjects.Rectangle>;
  private fade!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private areaTitle!: Phaser.GameObjects.Text;
  private areaSubtitle!: Phaser.GameObjects.Text;
  private areaGroup!: FadingGroup;
  private hintBand!: Phaser.GameObjects.Image;
  private hintText!: Phaser.GameObjects.Text;
  private hintGroup!: FadingGroup;
  private messageText!: Phaser.GameObjects.Text;
  private messageGroup!: FadingGroup;
  private memoryTitle!: Phaser.GameObjects.Text;
  private memoryText!: Phaser.GameObjects.Text;
  private memoryGroup!: FadingGroup;
  private titleGroup!: FadingGroup;
  private titlePrompt!: Phaser.GameObjects.Text;
  private titleFooter!: Phaser.GameObjects.Text;
  private intros!: Record<InputMode, FadingGroup>;
  private finaleText!: Phaser.GameObjects.Text;
  private pauseGroup!: FadingGroup;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHelp!: Phaser.GameObjects.Text;
  private pauseItems: Phaser.GameObjects.Text[] = [];
  private pauseZones: Phaser.GameObjects.Zone[] = [];
  private pauseMarkers!: Phaser.GameObjects.Graphics;
  private victoryGroup!: FadingGroup;
  private victoryStats!: Phaser.GameObjects.Text;
  private victoryItems: Phaser.GameObjects.Text[] = [];
  private victoryZones: Phaser.GameObjects.Zone[] = [];
  private victoryMarkers!: Phaser.GameObjects.Graphics;
  private muteText!: Phaser.GameObjects.Text;
  private muteGroup!: FadingGroup;
  private muted = false;
  private inputMode = InputMode.Keyboard;
  private currentHint: string | null = null;
  private elapsed = 0;

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(): void {
    this.host = this.scene.get(SCENE_KEYS.game) as unknown as UiHost;
    this.dims = {
      [Timeline.Dawn]: this.add.rectangle(HALF_WIDTH / 2, GAME_HEIGHT / 2, HALF_WIDTH, GAME_HEIGHT, 0x120c06, 0),
      [Timeline.Eclipse]: this.add.rectangle(HALF_WIDTH * 1.5, GAME_HEIGHT / 2, HALF_WIDTH, GAME_HEIGHT, 0x020108, 0),
    };
    this.add.image(0, 0, FxTexture.Vignette).setOrigin(0).setScale(4).setTint(toTint('#4a3518')).setAlpha(0.32);
    this.add.image(HALF_WIDTH, 0, FxTexture.Vignette).setOrigin(0).setScale(4).setTint(0x000000).setAlpha(0.42);
    this.seam = new Seam(this);
    this.hud = new Hud(this);

    this.areaSubtitle = this.add.text(GAME_WIDTH / 2, 92, '', displayStyle(13, COLORS.mist)).setOrigin(0.5).setLetterSpacing(8);
    this.areaTitle = this.add.text(GAME_WIDTH / 2, 124, '', displayStyle(32)).setOrigin(0.5).setLetterSpacing(3);
    this.areaGroup = new FadingGroup([this.areaSubtitle, this.areaTitle], 1.4, 0.9);

    this.hintBand = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, FxTexture.Fade).setOrigin(0.5, 1).setDisplaySize(GAME_WIDTH, 120).setTint(0x000000).setAlpha(0.45);
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 52, '', bodyStyle(25)).setOrigin(0.5);
    this.hintGroup = new FadingGroup([this.hintBand, this.hintText], 3, 2.5);

    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 104, '', bodyStyle(24, true, '#fff1d0')).setOrigin(0.5);
    this.messageGroup = new FadingGroup([this.messageText], 4, 1.6);

    this.memoryTitle = this.add.text(GAME_WIDTH / 2, 186, '', displayStyle(20)).setOrigin(0.5).setLetterSpacing(4);
    this.memoryText = this.add.text(GAME_WIDTH / 2, 222, '', bodyStyle(28)).setOrigin(0.5);
    this.memoryGroup = new FadingGroup([this.memoryTitle, this.memoryText], 1.6, 0.8);

    this.buildTitle();
    this.intros = { [InputMode.Keyboard]: this.buildIntro(InputMode.Keyboard), [InputMode.Touch]: this.buildIntro(InputMode.Touch) };
    this.finaleText = this.add.text(GAME_WIDTH / 2, 150, 'The two worlds remember each other.', bodyStyle(32)).setOrigin(0.5).setAlpha(0);
    this.buildPause();
    this.buildVictory();

    this.muteText = this.add.text(GAME_WIDTH - 24, GAME_HEIGHT - 22, '', displayStyle(13, COLORS.mist)).setOrigin(1, 1).setLetterSpacing(2);
    this.muteGroup = new FadingGroup([this.muteText], 5, 2);

    this.flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xf4ecff, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.fade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 1);

    this.host.attachUi(this);
  }

  private buildTitle(): void {
    const title = this.add.text(GAME_WIDTH / 2, 132, 'TIMELINE MERGE', displayStyle(70)).setOrigin(0.5).setLetterSpacing(12).setPadding(48, 36, 48, 36);
    title.setShadow(0, 0, 'rgba(150, 100, 255, 0.85)', 26, true, true);
    applyRealityGradient(title);
    const band = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, FxTexture.Fade).setOrigin(0.5, 1).setDisplaySize(GAME_WIDTH, 210).setTint(0x000000).setAlpha(0.6);
    const rule = this.add.graphics();
    rule.lineStyle(1, 0xf3e7ff, 0.6);
    rule.lineBetween(GAME_WIDTH / 2 - 250, 182, GAME_WIDTH / 2 - 14, 182);
    rule.lineBetween(GAME_WIDTH / 2 + 14, 182, GAME_WIDTH / 2 + 250, 182);
    rule.fillStyle(0xf6eeff, 1);
    rule.fillPoints([new Phaser.Math.Vector2(SEAM_X, 175), new Phaser.Math.Vector2(SEAM_X + 6, 182), new Phaser.Math.Vector2(SEAM_X, 189), new Phaser.Math.Vector2(SEAM_X - 6, 182)], true);
    const subtitle = this.add.text(GAME_WIDTH / 2, 214, 'Two realities. One traveler. A bridge between light and shadow.', bodyStyle(25, true, COLORS.ivory)).setOrigin(0.5);
    this.titlePrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 92, 'PRESS  ENTER  TO  BEGIN', displayStyle(20)).setOrigin(0.5).setLetterSpacing(5);
    this.titleFooter = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 48, 'A / D move   ·   W jump   ·   Tab shift reality   ·   E interact   ·   Esc pause   ·   M sound', bodyStyle(18, false, COLORS.mist))
      .setOrigin(0.5)
      .setAlpha(0.85);
    this.titleGroup = new FadingGroup([band, title, rule, subtitle, this.titlePrompt, this.titleFooter], 1.2, 2.4);
  }

  private buildIntro(mode: InputMode): FadingGroup {
    const layout = UI_LAYOUT[mode].intro;
    const copy = INPUT_COPY[mode];
    const band = layout.bandAtTop
      ? this.add.image(GAME_WIDTH / 2, 0, FxTexture.Fade).setOrigin(0.5, 0).setFlipY(true)
      : this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, FxTexture.Fade).setOrigin(0.5, 1);
    band.setDisplaySize(GAME_WIDTH, layout.band).setTint(0x000000).setAlpha(0.55);
    const items: Fadeable[] = [band];
    const caps = this.add.graphics();
    items.push(caps);
    const heading = this.add.text(GAME_WIDTH / 2, layout.headingY, INTRO_HEADING, bodyStyle(layout.headingSize)).setOrigin(0.5).setAlign('center').setWordWrapWidth(layout.wrap);
    items.push(heading);
    const spacing = GAME_WIDTH / (copy.introControls.length + 1);
    copy.introControls.forEach(({ key, label }, index) => {
      const x = spacing * (index + 1);
      const keyText = this.add.text(x, layout.capsY, key, displayStyle(14)).setOrigin(0.5);
      const width = Math.max(30, keyText.width + 16);
      caps.fillStyle(0x0d0a16, 0.62);
      caps.fillRoundedRect(x - width / 2, layout.capsY - 14, width, 28, 6);
      caps.lineStyle(1.5, index % 2 === 0 ? 0xf2c46b : 0xb98bff, 0.9);
      caps.strokeRoundedRect(x - width / 2, layout.capsY - 14, width, 28, 6);
      const labelText = this.add.text(x, layout.labelY, label, bodyStyle(19, false)).setOrigin(0.5);
      items.push(keyText, labelText);
    });
    if (copy.introTip) {
      items.push(this.add.text(GAME_WIDTH / 2, layout.tipY, copy.introTip, bodyStyle(layout.tipSize, false, COLORS.mist)).setOrigin(0.5).setAlign('center').setWordWrapWidth(layout.wrap));
    }
    return new FadingGroup(items, 2, 1);
  }

  private buildPause(): void {
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x07060d, 0.66);
    this.pauseTitle = this.add.text(GAME_WIDTH / 2, 214, 'PAUSED', displayStyle(40)).setOrigin(0.5).setLetterSpacing(10);
    applyRealityGradient(this.pauseTitle);
    this.pauseHelp = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 110, 'W / S to choose   ·   Enter to confirm   ·   Esc to resume', bodyStyle(19, false, COLORS.mist)).setOrigin(0.5);
    this.pauseItems = Array.from({ length: 5 }, (_, index) => this.add.text(GAME_WIDTH / 2, 300 + index * 46, '', displayStyle(21)).setOrigin(0.5).setLetterSpacing(3));
    this.pauseMarkers = this.add.graphics();
    this.pauseGroup = new FadingGroup([veil, this.pauseTitle, this.pauseHelp, this.pauseMarkers, ...this.pauseItems], 8, 8);
    this.pauseZones = this.buildMenuZones(this.pauseItems.length);
  }

  private buildMenuZones(count: number): Phaser.GameObjects.Zone[] {
    return Array.from({ length: count }, (_, index) => {
      const zone = this.add.zone(GAME_WIDTH / 2, 0, MENU_HIT_WIDTH, 1).setInteractive();
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) this.host.pickMenuItem(index);
      });
      this.setZonesEnabled([zone], false);
      return zone;
    });
  }

  private setZonesEnabled(zones: Phaser.GameObjects.Zone[], enabled: boolean): void {
    for (const zone of zones) {
      if (zone.input) zone.input.enabled = enabled;
    }
  }

  private placeMenu(texts: Phaser.GameObjects.Text[], zones: Phaser.GameObjects.Zone[], firstY: number, spacing: number, size: number): void {
    texts.forEach((text, index) => text.setY(firstY + index * spacing).setStyle(displayStyle(size)));
    zones.forEach((zone, index) => zone.setPosition(GAME_WIDTH / 2, firstY + index * spacing).setSize(MENU_HIT_WIDTH, spacing));
  }

  private placeSlot(text: Phaser.GameObjects.Text, slot: TextSlot, color: string): void {
    text.setY(slot.y).setStyle(bodyStyle(slot.size, true, color)).setAlign('center').setWordWrapWidth(slot.wrap);
  }

  private buildVictory(): void {
    const veil = this.add.image(GAME_WIDTH / 2, 320, FxTexture.Glow).setDisplaySize(1500, 640).setTint(0x07060d).setAlpha(0.72);
    const title = this.add.text(GAME_WIDTH / 2, 218, 'THE TIMELINES ARE ONE', displayStyle(48)).setOrigin(0.5).setLetterSpacing(8).setPadding(40, 30, 40, 30);
    title.setShadow(0, 0, 'rgba(150, 100, 255, 0.85)', 24, true, true);
    applyRealityGradient(title);
    const line = this.add.text(GAME_WIDTH / 2, 272, 'Every memory restored. The bridge between worlds holds once more.', bodyStyle(25)).setOrigin(0.5);
    this.victoryStats = this.add.text(GAME_WIDTH / 2, 322, '', displayStyle(16, COLORS.mist)).setOrigin(0.5).setLetterSpacing(3);
    this.victoryItems = Array.from({ length: 2 }, (_, index) => this.add.text(GAME_WIDTH / 2, 420 + index * 48, '', displayStyle(22)).setOrigin(0.5).setLetterSpacing(3));
    this.victoryMarkers = this.add.graphics();
    this.victoryGroup = new FadingGroup([veil, title, line, this.victoryStats, this.victoryMarkers, ...this.victoryItems], 1.2, 3);
    this.victoryZones = this.buildMenuZones(this.victoryItems.length);
  }

  setInputMode(mode: InputMode): void {
    const previous = this.inputMode;
    this.inputMode = mode;
    const copy = INPUT_COPY[mode];
    const layout = UI_LAYOUT[mode];
    this.titlePrompt.setText(copy.titlePrompt).setStyle(displayStyle(layout.titlePromptSize));
    this.titleFooter.setText(copy.titleFooter).setStyle(bodyStyle(layout.footerSize, false, COLORS.mist));
    this.placeSlot(this.hintText, layout.hint, COLORS.ivory);
    this.hintBand.setDisplaySize(GAME_WIDTH, layout.hintBand);
    this.placeSlot(this.messageText, layout.message, '#fff1d0');
    this.pauseTitle.setY(layout.pause.titleY);
    this.pauseHelp.setText(copy.pauseHelp).setY(layout.pause.helpY);
    this.placeMenu(this.pauseItems, this.pauseZones, layout.pause.firstY, layout.pause.spacing, layout.pause.size);
    this.victoryStats.setStyle(displayStyle(layout.victory.statsSize, COLORS.mist));
    this.placeMenu(this.victoryItems, this.victoryZones, layout.victory.firstY, layout.victory.spacing, layout.victory.size);
    this.muteText.setPosition(layout.sound.x, layout.sound.y).setOrigin(layout.sound.originX, layout.sound.originY);
    this.renderMute();
    if (previous !== mode && this.intros[previous].opacity > 0) {
      this.intros[previous].hideImmediately();
      this.intros[mode].show(6);
    }
  }

  showTitle(): void {
    this.titleGroup.show();
    this.hud.hide();
    this.hideIntro();
    this.victoryGroup.hide();
    this.pauseGroup.hide();
    this.setZonesEnabled(this.pauseZones, false);
    this.setZonesEnabled(this.victoryZones, false);
    this.areaGroup.hideImmediately();
    this.memoryGroup.hideImmediately();
    this.messageGroup.hideImmediately();
  }

  showGameplay(): void {
    this.titleGroup.hideImmediately();
    this.victoryGroup.hideImmediately();
    this.pauseGroup.hideImmediately();
    this.setZonesEnabled(this.pauseZones, false);
    this.setZonesEnabled(this.victoryZones, false);
    this.hud.show();
    this.finaleText.setAlpha(0);
  }

  showIntro(): void {
    this.intros[this.inputMode].show(9);
  }

  hideIntro(): void {
    this.intros[InputMode.Keyboard].hide();
    this.intros[InputMode.Touch].hide();
  }

  showArea(area: AreaDef): void {
    this.areaSubtitle.setText(area.subtitle.toUpperCase());
    this.areaTitle.setText(area.title);
    applyRealityGradient(this.areaTitle);
    this.areaGroup.show(3.8);
  }

  showMessage(text: string, seconds = 3.8): void {
    this.messageText.setText(text);
    this.messageGroup.show(seconds);
  }

  showMemory(fragment: FragmentDef, count: number, required: number): void {
    this.memoryTitle.setText(`${fragment.title}   ${count} / ${required}`);
    applyRealityGradient(this.memoryTitle);
    this.memoryText.setText(`“${fragment.memory}”`);
    this.memoryGroup.show(4.6);
    this.hud.setFragments(count);
  }

  setFragments(count: number): void {
    this.hud.setFragments(count);
  }

  shiftPulse(timeline: Timeline, y: number): void {
    this.seam.pulse(timeline, y);
  }

  rejectFlash(): void {
    this.seam.rejectFlash();
  }

  showMute(muted: boolean): void {
    this.muted = muted;
    this.renderMute();
    this.muteGroup.show(muted ? Number.POSITIVE_INFINITY : 1.4);
  }

  private renderMute(): void {
    this.muteText.setText(this.muted ? INPUT_COPY[this.inputMode].soundOff : 'SOUND ON');
  }

  showPause<T extends string>(menu: Menu<T>): void {
    if (this.inputMode === InputMode.Touch) this.intros[InputMode.Touch].hideImmediately();
    this.pauseGroup.show();
    this.setZonesEnabled(this.pauseZones, true);
    this.renderMenu(menu, this.pauseItems, this.pauseMarkers);
  }

  updatePause<T extends string>(menu: Menu<T>): void {
    this.renderMenu(menu, this.pauseItems, this.pauseMarkers);
  }

  hidePause(): void {
    this.pauseGroup.hide();
    this.setZonesEnabled(this.pauseZones, false);
  }

  showVictory<T extends string>(menu: Menu<T>, stats: VictoryStats): void {
    this.victoryStats.setText(`TIME ${formatDuration(stats.time)}     ·     SHIFTS ${stats.shifts}     ·     FALLS ${stats.deaths}`);
    this.victoryGroup.show();
    this.setZonesEnabled(this.victoryZones, true);
    this.hud.hide();
    this.renderMenu(menu, this.victoryItems, this.victoryMarkers);
  }

  updateVictory<T extends string>(menu: Menu<T>): void {
    this.renderMenu(menu, this.victoryItems, this.victoryMarkers);
  }

  setFinaleText(alpha: number): void {
    this.finaleText.setAlpha(alpha * (1 - this.victoryGroup.opacity));
  }

  updateFrame(dt: number, frame: UiFrame): void {
    this.elapsed += dt;
    this.seam.setIntensity(frame.seamIntensity);
    this.seam.update(dt, frame.focusY);
    this.hud.update(dt, frame.timeline, frame.bothActive, this.elapsed);
    const dawnDim = frame.postFx ? 0.14 : 0.36;
    const eclipseDim = frame.postFx ? 0.04 : 0.22;
    this.dims[Timeline.Dawn].setFillStyle(0x120c06, frame.dim[Timeline.Dawn] * dawnDim);
    this.dims[Timeline.Eclipse].setFillStyle(0x020108, frame.dim[Timeline.Eclipse] * eclipseDim);
    if (frame.hint !== this.currentHint) {
      if (frame.hint) {
        this.hintText.setText(frame.hint);
        this.hintGroup.show();
      } else {
        this.hintGroup.hide();
      }
      this.currentHint = frame.hint;
    }
    for (const group of [this.areaGroup, this.hintGroup, this.messageGroup, this.memoryGroup, this.titleGroup, this.intros[InputMode.Keyboard], this.intros[InputMode.Touch], this.pauseGroup, this.victoryGroup, this.muteGroup]) {
      group.update(dt);
    }
    this.titlePrompt.setAlpha(this.titleGroup.opacity * (0.72 + 0.28 * Math.sin(this.elapsed * 2.6)));
    this.fade.setAlpha(frame.fade);
    this.flash.setAlpha(frame.flash);
  }

  private renderMenu<T extends string>(menu: Menu<T>, texts: Phaser.GameObjects.Text[], markers: Phaser.GameObjects.Graphics): void {
    markers.clear();
    texts.forEach((text, index) => {
      const item = menu.items[index];
      text.setVisible(item !== undefined);
      if (!item) return;
      const selected = index === menu.index;
      text.setText(item.label);
      text.setColor(selected ? '#fff3d6' : '#a99fbf');
      if (selected) {
        markers.fillStyle(0xf3cf7a, 1);
        this.diamond(markers, text.x - text.width / 2 - 22, text.y);
        markers.fillStyle(0xc9a4ff, 1);
        this.diamond(markers, text.x + text.width / 2 + 22, text.y);
      }
    });
  }

  private diamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillPoints([new Phaser.Math.Vector2(x, y - 6), new Phaser.Math.Vector2(x + 5, y), new Phaser.Math.Vector2(x, y + 6), new Phaser.Math.Vector2(x - 5, y)], true);
  }
}
