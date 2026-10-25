import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HALF_WIDTH, SCENE_KEYS, SEAM_X } from '../config';
import { Timeline } from '../core/enums';
import type { AreaDef, FragmentDef } from '../core/types';
import { InputMode } from '../input/inputMode';
import type { AtlasModel } from '../levels/atlas';
import { toTint } from '../render/art/color';
import { FxTexture } from '../render/art/textureKeys';
import { uiOffset } from '../render/viewport';
import { AtlasView } from '../ui/AtlasView';
import { CompletionCard, type CompletionContent } from '../ui/CompletionCard';
import { DiscoveryCard, type DiscoveryContent } from '../ui/DiscoveryCard';
import { FadingGroup, type Fadeable } from '../ui/FadingGroup';
import { Hud } from '../ui/Hud';
import { INPUT_COPY, INTRO_HEADING, UI_LAYOUT, type TextSlot } from '../ui/inputPresentation';
import type { Menu } from '../ui/Menu';
import { MenuView } from '../ui/MenuView';
import { Seam } from '../ui/Seam';
import { applyRealityGradient, bodyStyle, COLORS, displayStyle } from '../ui/textStyles';

export interface UiHost {
  attachUi(ui: UIScene): void;
  pickMenuItem(index: number): void;
  pickAtlasLevel(level: number): void;
  shiftAtlasChapter(delta: number): void;
  leaveAtlas(): void;
  confirmBriefing(): void;
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

export interface VictoryContent {
  title: string;
  line: string;
  stats: string;
}

export class UIScene extends Phaser.Scene {
  private host!: UiHost;
  private seam!: Seam;
  private hud!: Hud;
  private dims!: Record<Timeline, Phaser.GameObjects.Rectangle>;
  private vignettes!: Record<Timeline, Phaser.GameObjects.Image>;
  private fade!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private bands: Phaser.GameObjects.Image[] = [];
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
  private titleMenu!: MenuView;
  private titleFooter!: Phaser.GameObjects.Text;
  private intros!: Record<InputMode, FadingGroup>;
  private finaleText!: Phaser.GameObjects.Text;
  private pauseGroup!: FadingGroup;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHelp!: Phaser.GameObjects.Text;
  private pauseMenu!: MenuView;
  private victoryGroup!: FadingGroup;
  private victoryTitle!: Phaser.GameObjects.Text;
  private victoryLine!: Phaser.GameObjects.Text;
  private victoryStats!: Phaser.GameObjects.Text;
  private victoryHelp!: Phaser.GameObjects.Text;
  private victoryMenu!: MenuView;
  private atlas!: AtlasView;
  private discovery!: DiscoveryCard;
  private completion!: CompletionCard;
  private muteText!: Phaser.GameObjects.Text;
  private muteGroup!: FadingGroup;
  private muted = false;
  private inputMode = InputMode.Keyboard;
  private currentHint: string | null = null;
  private atlasModel: AtlasModel | null = null;
  private gameWidth = GAME_WIDTH;
  private elapsed = 0;

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(): void {
    this.host = this.scene.get(SCENE_KEYS.game) as unknown as UiHost;
    this.dims = {
      [Timeline.Dawn]: this.add.rectangle(0, 0, HALF_WIDTH, GAME_HEIGHT, 0x120c06, 0).setOrigin(0),
      [Timeline.Eclipse]: this.add.rectangle(HALF_WIDTH, 0, HALF_WIDTH, GAME_HEIGHT, 0x020108, 0).setOrigin(0),
    };
    this.vignettes = {
      [Timeline.Dawn]: this.add.image(0, 0, FxTexture.Vignette).setOrigin(0).setScale(4).setTint(toTint('#4a3518')).setAlpha(0.32),
      [Timeline.Eclipse]: this.add.image(HALF_WIDTH, 0, FxTexture.Vignette).setOrigin(0).setScale(4).setTint(0x000000).setAlpha(0.42),
    };
    this.seam = new Seam(this);
    this.hud = new Hud(this);

    this.areaSubtitle = this.add.text(GAME_WIDTH / 2, 98, '', displayStyle(13, COLORS.mist)).setOrigin(0.5).setLetterSpacing(8);
    this.areaTitle = this.add.text(GAME_WIDTH / 2, 130, '', displayStyle(32)).setOrigin(0.5).setLetterSpacing(3);
    this.areaGroup = new FadingGroup([this.areaSubtitle, this.areaTitle], 1.4, 0.9);

    this.hintBand = this.band(GAME_HEIGHT, 120, 0.45);
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
    this.completion = new CompletionCard(this, (index) => this.host.pickMenuItem(index));
    this.atlas = new AtlasView(this, {
      pickLevel: (level) => this.host.pickAtlasLevel(level),
      changeChapter: (delta) => this.host.shiftAtlasChapter(delta),
      back: () => this.host.leaveAtlas(),
    });
    this.discovery = new DiscoveryCard(this, () => this.host.confirmBriefing());

    this.muteText = this.add.text(GAME_WIDTH - 24, GAME_HEIGHT - 22, '', displayStyle(13, COLORS.mist)).setOrigin(1, 1).setLetterSpacing(2);
    this.muteGroup = new FadingGroup([this.muteText], 5, 2);

    this.flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf4ecff, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.fade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 1).setOrigin(0);

    this.applyWidth(this.scale.width);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this));
    this.host.attachUi(this);
  }

  private band(bottom: number, height: number, alpha: number): Phaser.GameObjects.Image {
    const image = this.add.image(GAME_WIDTH / 2, bottom, FxTexture.Fade).setOrigin(0.5, 1).setDisplaySize(GAME_WIDTH, height).setTint(0x000000).setAlpha(alpha);
    this.bands.push(image);
    return image;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.applyWidth(gameSize.width);
  }

  private applyWidth(width: number): void {
    this.gameWidth = width;
    const offset = uiOffset(width);
    const half = width / 2;
    this.cameras.main.setSize(width, GAME_HEIGHT).setScroll(-offset, 0);
    this.dims[Timeline.Dawn].setPosition(-offset, 0).setSize(half, GAME_HEIGHT);
    this.dims[Timeline.Eclipse].setPosition(SEAM_X, 0).setSize(half, GAME_HEIGHT);
    this.vignettes[Timeline.Dawn].setPosition(-offset, 0).setDisplaySize(half, GAME_HEIGHT);
    this.vignettes[Timeline.Eclipse].setPosition(SEAM_X, 0).setDisplaySize(half, GAME_HEIGHT);
    for (const band of this.bands) band.setDisplaySize(width, band.displayHeight);
    this.hud.setWidth(width);
    this.flash.setPosition(-offset, 0).setSize(width, GAME_HEIGHT);
    this.fade.setPosition(-offset, 0).setSize(width, GAME_HEIGHT);
    this.placeMute();
  }

  private placeMute(): void {
    const sound = UI_LAYOUT[this.inputMode].sound;
    const offset = uiOffset(this.gameWidth);
    const x = sound.originX === 1 ? sound.x + offset : sound.x - offset;
    this.muteText.setPosition(x, sound.y).setOrigin(sound.originX, sound.originY);
  }

  private buildTitle(): void {
    const title = this.add.text(GAME_WIDTH / 2, 132, 'TIMELINE MERGE', displayStyle(70)).setOrigin(0.5).setLetterSpacing(12).setPadding(48, 36, 48, 36);
    title.setShadow(0, 0, 'rgba(150, 100, 255, 0.85)', 26, true, true);
    applyRealityGradient(title);
    const band = this.band(GAME_HEIGHT, 250, 0.62);
    const rule = this.add.graphics();
    rule.lineStyle(1, 0xf3e7ff, 0.6);
    rule.lineBetween(GAME_WIDTH / 2 - 250, 182, GAME_WIDTH / 2 - 14, 182);
    rule.lineBetween(GAME_WIDTH / 2 + 14, 182, GAME_WIDTH / 2 + 250, 182);
    rule.fillStyle(0xf6eeff, 1);
    rule.fillPoints([new Phaser.Math.Vector2(SEAM_X, 175), new Phaser.Math.Vector2(SEAM_X + 6, 182), new Phaser.Math.Vector2(SEAM_X, 189), new Phaser.Math.Vector2(SEAM_X - 6, 182)], true);
    const subtitle = this.add.text(GAME_WIDTH / 2, 214, 'Two realities. One traveler. A hundred echoes between light and shadow.', bodyStyle(25, true, COLORS.ivory)).setOrigin(0.5);
    this.titleMenu = new MenuView(this, 2, (index) => this.host.pickMenuItem(index));
    this.titleFooter = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 48, '', bodyStyle(18, false, COLORS.mist)).setOrigin(0.5).setAlpha(0.85);
    this.titleGroup = new FadingGroup([band, title, rule, subtitle, this.titleFooter, ...this.titleMenu.items], 1.2, 2.4);
  }

  private buildIntro(mode: InputMode): FadingGroup {
    const layout = UI_LAYOUT[mode].intro;
    const copy = INPUT_COPY[mode];
    const band = layout.bandAtTop
      ? this.add.image(GAME_WIDTH / 2, 0, FxTexture.Fade).setOrigin(0.5, 0).setFlipY(true)
      : this.add.image(GAME_WIDTH / 2, GAME_HEIGHT, FxTexture.Fade).setOrigin(0.5, 1);
    band.setDisplaySize(GAME_WIDTH, layout.band).setTint(0x000000).setAlpha(0.55);
    this.bands.push(band);
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
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 4200, GAME_HEIGHT, 0x07060d, 0.7);
    this.pauseTitle = this.add.text(GAME_WIDTH / 2, 184, 'PAUSED', displayStyle(40)).setOrigin(0.5).setLetterSpacing(10);
    applyRealityGradient(this.pauseTitle);
    this.pauseHelp = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 84, '', bodyStyle(19, false, COLORS.mist)).setOrigin(0.5);
    this.pauseMenu = new MenuView(this, 6, (index) => this.host.pickMenuItem(index));
    this.pauseGroup = new FadingGroup([veil, this.pauseTitle, this.pauseHelp, ...this.pauseMenu.items], 8, 8);
  }

  private buildVictory(): void {
    const veil = this.add.image(GAME_WIDTH / 2, 320, FxTexture.Glow).setDisplaySize(1700, 700).setTint(0x07060d).setAlpha(0.76);
    this.victoryTitle = this.add.text(GAME_WIDTH / 2, 218, '', displayStyle(48)).setOrigin(0.5).setLetterSpacing(8).setPadding(40, 30, 40, 30);
    this.victoryTitle.setShadow(0, 0, 'rgba(150, 100, 255, 0.85)', 24, true, true);
    this.victoryLine = this.add.text(GAME_WIDTH / 2, 272, '', bodyStyle(25)).setOrigin(0.5).setAlign('center').setWordWrapWidth(1000);
    this.victoryStats = this.add.text(GAME_WIDTH / 2, 330, '', displayStyle(16, COLORS.mist)).setOrigin(0.5).setLetterSpacing(3);
    this.victoryHelp = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, '', bodyStyle(19, false, COLORS.mist)).setOrigin(0.5);
    this.victoryMenu = new MenuView(this, 2, (index) => this.host.pickMenuItem(index));
    this.victoryGroup = new FadingGroup([veil, this.victoryTitle, this.victoryLine, this.victoryStats, this.victoryHelp, ...this.victoryMenu.items], 1.2, 3);
  }

  setInputMode(mode: InputMode): void {
    const previous = this.inputMode;
    this.inputMode = mode;
    const copy = INPUT_COPY[mode];
    const layout = UI_LAYOUT[mode];
    this.titleFooter.setText(copy.titleFooter).setStyle(bodyStyle(layout.footerSize, false, COLORS.mist));
    this.titleMenu.place(layout.title.firstY, layout.title.spacing, layout.title.size);
    this.placeSlot(this.hintText, layout.hint, COLORS.ivory);
    this.hintBand.setDisplaySize(this.gameWidth, layout.hintBand);
    this.placeSlot(this.messageText, layout.message, '#fff1d0');
    this.pauseTitle.setY(layout.pause.titleY);
    this.pauseHelp.setText(copy.pauseHelp).setY(layout.pause.helpY);
    this.pauseMenu.place(layout.pause.firstY, layout.pause.spacing, layout.pause.size);
    this.victoryStats.setStyle(displayStyle(layout.victory.statsSize, COLORS.mist));
    this.victoryHelp.setText(copy.menuHelp);
    this.victoryMenu.place(layout.victory.firstY, layout.victory.spacing, layout.victory.size);
    this.completion.menu.place(layout.complete.firstY, layout.complete.spacing, layout.complete.size);
    this.completion.setHelp(copy.menuHelp);
    this.discovery.setPrompt(copy.cardPrompt, null);
    if (this.atlasModel) this.atlas.render(this.atlasModel, copy.atlasHelp);
    this.placeMute();
    this.renderMute();
    if (previous !== mode && this.intros[previous].opacity > 0) {
      this.intros[previous].hideImmediately();
      this.intros[mode].show(6);
    }
  }

  private placeSlot(text: Phaser.GameObjects.Text, slot: TextSlot, color: string): void {
    text.setY(slot.y).setStyle(bodyStyle(slot.size, true, color)).setAlign('center').setWordWrapWidth(slot.wrap);
  }

  showTitle<T extends string>(menu: Menu<T>): void {
    this.titleGroup.show();
    this.titleMenu.setEnabled(true);
    this.titleMenu.render(menu);
    this.hud.hide();
    this.hideIntro();
    this.victoryGroup.hide();
    this.victoryMenu.setEnabled(false);
    this.pauseGroup.hide();
    this.pauseMenu.setEnabled(false);
    this.completion.hide();
    this.discovery.hide();
    this.atlas.hide();
    this.areaGroup.hideImmediately();
    this.memoryGroup.hideImmediately();
    this.messageGroup.hideImmediately();
  }

  updateTitleMenu<T extends string>(menu: Menu<T>): void {
    this.titleMenu.render(menu);
  }

  hideTitle(): void {
    this.titleGroup.hide();
    this.titleMenu.setEnabled(false);
  }

  showGameplay(): void {
    this.titleGroup.hideImmediately();
    this.titleMenu.setEnabled(false);
    this.victoryGroup.hideImmediately();
    this.victoryMenu.setEnabled(false);
    this.pauseGroup.hideImmediately();
    this.pauseMenu.setEnabled(false);
    this.completion.hideImmediately();
    this.atlas.hideImmediately();
    this.discovery.hide();
    this.areaGroup.hideImmediately();
    this.memoryGroup.hideImmediately();
    this.messageGroup.hideImmediately();
    this.hud.show();
    this.finaleText.setAlpha(0);
  }

  configureHud(label: string, slots: number): void {
    this.hud.configure(label, slots);
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
    this.memoryTitle.setText(required > 1 ? `${fragment.title}   ${count} / ${required}` : fragment.title);
    applyRealityGradient(this.memoryTitle);
    this.memoryText.setText(fragment.memory ? `“${fragment.memory}”` : 'A sliver of a lost moment, humming with both lights.');
    this.memoryGroup.show(fragment.memory ? 4.6 : 2.6);
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
    this.pauseMenu.setEnabled(true);
    this.pauseMenu.render(menu);
  }

  updatePause<T extends string>(menu: Menu<T>): void {
    this.pauseMenu.render(menu);
  }

  hidePause(): void {
    this.pauseGroup.hide();
    this.pauseMenu.setEnabled(false);
  }

  showVictory<T extends string>(menu: Menu<T>, content: VictoryContent): void {
    this.victoryTitle.setText(content.title);
    applyRealityGradient(this.victoryTitle);
    this.victoryLine.setText(content.line);
    this.victoryStats.setText(content.stats);
    this.victoryGroup.show();
    this.victoryMenu.setEnabled(true);
    this.hud.hide();
    this.victoryMenu.render(menu);
  }

  updateVictory<T extends string>(menu: Menu<T>): void {
    this.victoryMenu.render(menu);
  }

  showComplete<T extends string>(content: CompletionContent, menu: Menu<T>): void {
    this.hud.hide();
    this.hideIntro();
    this.completion.show(content, menu, INPUT_COPY[this.inputMode].menuHelp);
  }

  updateComplete<T extends string>(menu: Menu<T>): void {
    this.completion.menu.render(menu);
  }

  showAtlas(model: AtlasModel): void {
    this.atlasModel = model;
    this.hideTitle();
    this.pauseGroup.hide();
    this.pauseMenu.setEnabled(false);
    this.completion.hide();
    this.victoryGroup.hide();
    this.victoryMenu.setEnabled(false);
    this.hud.hide();
    this.hideIntro();
    this.atlas.show(model, INPUT_COPY[this.inputMode].atlasHelp);
  }

  updateAtlas(model: AtlasModel): void {
    this.atlasModel = model;
    this.atlas.render(model, INPUT_COPY[this.inputMode].atlasHelp);
  }

  hideAtlas(): void {
    this.atlas.hide();
  }

  showDiscovery(content: DiscoveryContent): void {
    this.atlas.hide();
    this.completion.hide();
    this.victoryGroup.hide();
    this.victoryMenu.setEnabled(false);
    this.titleGroup.hide();
    this.titleMenu.setEnabled(false);
    this.hud.hide();
    this.discovery.show(content, INPUT_COPY[this.inputMode].cardPrompt);
  }

  hideDiscovery(): void {
    this.discovery.hide();
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
    this.atlas.update(dt);
    this.discovery.update(dt);
    this.completion.update(dt);
    this.fade.setAlpha(frame.fade);
    this.flash.setAlpha(frame.flash);
  }
}
