import Phaser from 'phaser';
import { GAME_HEIGHT, SCENE_KEYS } from '../config';
import { AudioEngine, Sfx } from '../audio/AudioEngine';
import { FIXED_DT, MAX_FRAME_DELTA, PLAYER_SIZE } from '../core/constants';
import { Ability, ExitKind, FlowAction, GamePhase, MechanismKind, SimEventType, SimStatus, SwitchRejection, Timeline } from '../core/enums';
import { finaleFrame, type FinaleFrame } from '../core/finale';
import { GameFlow } from '../core/gameFlow';
import { clamp, containsPoint } from '../core/geometry';
import { isDashing } from '../core/physics';
import { GameSimulation, IDLE_INPUT, type SimEvent } from '../core/simulation';
import { otherTimeline } from '../core/timeline';
import type { LevelDef, MechanismDef } from '../core/types';
import { Action, InputController } from '../input/InputController';
import { detectInputMode, InputMode } from '../input/inputMode';
import { InteractCue, TouchControls } from '../input/TouchControls';
import { TouchButton, type ActionButton } from '../input/touchLayout';
import { buildAtlas, jumpChapter, stepAtlas } from '../levels/atlas';
import { completedTotal, continueLevel, isUnlocked, markSeen, recordCompletion, rememberLevel, type Progress } from '../levels/progress';
import { abilitiesAt, CHAPTERS, chapterOf, DiscoveryKind, discoveryIntroducedAt, isChapterFinale, LEVEL_COUNT, type DiscoveryDef } from '../levels/progression';
import { getLevel, HANDCRAFTED_LEVEL, levelName } from '../levels/registry';
import { generateLevelArt, type ArtLibrary, type LevelPalettes } from '../render/art/ArtLibrary';
import { paletteFor, themedPalette } from '../render/art/palette';
import { CameraRig } from '../render/CameraRig';
import type { PlayerRenderState } from '../render/PlayerView';
import { OPEN_GATE_FRAME, PortalView, type PortalFrame } from '../render/PortalView';
import { WorldView } from '../render/WorldView';
import { showFatalError } from '../ui/fatalError';
import { PROMPT_STYLES } from '../ui/inputPresentation';
import {
  CompleteOption,
  createCompleteMenu,
  createPauseMenu,
  createTitleMenu,
  createVictoryMenu,
  formatDuration,
  PauseOption,
  soundLabel,
  TitleOption,
  VictoryOption,
  type Menu,
} from '../ui/Menu';
import { loadProgress, saveProgress } from '../ui/progressStore';
import { ART_REGISTRY_KEY } from './BootScene';
import type { UiHost, UIScene } from './UIScene';

enum TransitionAction {
  Play = 'play',
  Restart = 'restart',
  ReturnToTitle = 'returnToTitle',
}

interface Transition {
  action: TransitionAction;
  level: number;
  elapsed: number;
  executed: boolean;
}

interface Glance {
  x: number;
  y: number;
  remaining: number;
}

interface LevelResult {
  time: number;
  shifts: number;
  deaths: number;
  shard: boolean;
  newBest: boolean;
}

const TITLE_LEVEL = HANDCRAFTED_LEVEL;
const FADE_OUT = 0.45;
const FADE_IN = 0.7;
const GLANCE_DURATION = 2.2;
const GLANCE_WEIGHT = 0.65;
const PORTAL_HEARING_DISTANCE = 760;
const FOCUS_HEAD_OFFSET = 44;
const EXIT_CARD_DELAY = 1.2;

function statsLine(result: { time: number; shifts: number; deaths: number }): string {
  return `TIME ${formatDuration(result.time)}     ·     SHIFTS ${result.shifts}     ·     FALLS ${result.deaths}`;
}

export class GameScene extends Phaser.Scene implements UiHost {
  private art!: ArtLibrary;
  private sim!: GameSimulation;
  private world: WorldView | null = null;
  private flow!: GameFlow;
  private rig!: CameraRig;
  private controls!: InputController;
  private touch!: TouchControls;
  private audio!: AudioEngine;
  private progress!: Progress;
  private titleMenu!: Menu<TitleOption>;
  private pauseMenu!: Menu<PauseOption>;
  private completeMenu: Menu<CompleteOption> = createCompleteMenu(true);
  private victoryMenu: Menu<VictoryOption> = createVictoryMenu(false);
  private ui: UIScene | null = null;
  private inputMode = InputMode.Keyboard;
  private pickedIndex: number | null = null;
  private briefingConfirmed = false;
  private loadedLevel = 0;
  private levelIndex = TITLE_LEVEL;
  private titleView = true;
  private atlasLevel = 1;
  private exitTimer: number | null = null;
  private lastResult: LevelResult | null = null;
  private accumulator = 0;
  private previousFeet = { x: 0, y: 0 };
  private pending = { jump: false, shift: false, interact: false, dash: false };
  private finaleTime = 0;
  private finale: FinaleFrame = finaleFrame(0);
  private flashPlayed = false;
  private transition: Transition | null = null;
  private fade = 1;
  private glance: Glance | null = null;
  private elapsed = 0;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    const art = this.registry.get(ART_REGISTRY_KEY) as ArtLibrary | undefined;
    const keyboard = this.input.keyboard;
    if (!art || !keyboard) {
      showFatalError('The worlds could not be woven', 'Required game resources are missing. Please reload the page.');
      return;
    }
    this.art = art;
    this.flow = new GameFlow();
    this.controls = new InputController(keyboard, detectInputMode((query) => window.matchMedia?.(query).matches === true));
    this.inputMode = this.controls.mode;
    this.progress = loadProgress();
    this.atlasLevel = continueLevel(this.progress);
    this.rig = new CameraRig(this, getLevel(TITLE_LEVEL).bounds, this.scale.width);
    this.touch = new TouchControls(this.controls, this.scale);
    this.audio = new AudioEngine();
    this.audio.armUnlock();
    this.pauseMenu = createPauseMenu(this.audio.isMuted);
    this.titleMenu = this.buildTitleMenu();
    try {
      this.loadWorld(TITLE_LEVEL);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showFatalError('The worlds could not be woven', `${detail}. Please reload the page.`);
      return;
    }
    this.prepareTitle();

    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleBlur, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handleTap, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleBlur, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.handleTap, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.touch.dispose();
      this.audio.dispose();
    });
    this.scene.launch(SCENE_KEYS.ui);
  }

  attachUi(ui: UIScene): void {
    this.ui = ui;
    ui.setInputMode(this.inputMode);
    ui.showTitle(this.titleMenu);
    if (this.audio.isMuted) ui.showMute(true);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ui || !this.sim || !this.world) return;
    const dt = Math.min(deltaMs / 1000, MAX_FRAME_DELTA);
    this.elapsed += dt;

    if (this.controls.consume(Action.Mute)) {
      this.toggleMute();
    }
    if (this.controls.mode !== this.inputMode) {
      this.applyInputMode(this.controls.mode);
    }

    this.updateTransition(dt);
    if (!this.transition) {
      switch (this.flow.phase) {
        case GamePhase.Title:
          this.updateTitle();
          break;
        case GamePhase.Atlas:
          this.updateAtlas();
          break;
        case GamePhase.Briefing:
          this.updateBriefing();
          break;
        case GamePhase.Playing:
          this.updatePlaying(dt);
          break;
        case GamePhase.Paused:
          this.updatePaused();
          break;
        case GamePhase.LevelComplete:
          this.updateLevelComplete(dt);
          break;
        case GamePhase.Finale:
          this.updateFinale(dt);
          break;
        case GamePhase.Victory:
          this.updateVictory();
          break;
      }
    }
    this.controls.flush();
    this.pickedIndex = null;
    this.briefingConfirmed = false;
    this.renderFrame(dt);
  }

  pickMenuItem(index: number): void {
    this.controls.useTouch();
    this.touch.enterFullscreen();
    this.audio.unlock();
    this.pickedIndex = index;
  }

  pickAtlasLevel(level: number): void {
    this.controls.useTouch();
    this.touch.enterFullscreen();
    this.audio.unlock();
    if (this.flow.phase !== GamePhase.Atlas || this.transition) return;
    if (level === this.atlasLevel && isUnlocked(this.progress, level)) {
      this.playFromMenu(level);
      return;
    }
    this.selectAtlas(level);
  }

  shiftAtlasChapter(delta: number): void {
    this.controls.useTouch();
    if (this.flow.phase !== GamePhase.Atlas || this.transition) return;
    this.selectAtlas(jumpChapter(this.atlasLevel, delta));
  }

  leaveAtlas(): void {
    this.controls.useTouch();
    if (this.flow.phase !== GamePhase.Atlas || this.transition) return;
    this.audio.play(Sfx.MenuMove);
    this.beginTransition(TransitionAction.ReturnToTitle, TITLE_LEVEL);
  }

  confirmBriefing(): void {
    this.controls.useTouch();
    this.touch.enterFullscreen();
    this.audio.unlock();
    this.briefingConfirmed = true;
  }

  private get ui$(): UIScene {
    return this.ui as UIScene;
  }

  private get world$(): WorldView {
    return this.world as WorldView;
  }

  private get level(): LevelDef {
    return this.sim.level;
  }

  private handleTap(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) this.controls.useTouch();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.rig.resize(gameSize.width);
    this.world?.resize(gameSize.width / 2);
  }

  private applyInputMode(mode: InputMode): void {
    this.inputMode = mode;
    this.world$.setPromptStyle(PROMPT_STYLES[mode]);
    this.ui$.setInputMode(mode);
    if (this.flow.phase === GamePhase.Paused) this.ui$.updatePause(this.pauseMenu);
    if (this.flow.phase === GamePhase.Victory) this.ui$.updateVictory(this.victoryMenu);
    if (this.flow.phase === GamePhase.LevelComplete) this.ui$.updateComplete(this.completeMenu);
    if (this.flow.phase === GamePhase.Title) this.ui$.updateTitleMenu(this.titleMenu);
    if (this.flow.phase === GamePhase.Briefing) {
      const discovery = discoveryIntroducedAt(this.levelIndex);
      if (discovery) this.ui$.showDiscovery(this.discoveryContent(discovery));
    }
  }

  private choose<T extends string>(menu: Menu<T>): boolean {
    if (this.pickedIndex === null) return this.controls.consume(Action.Confirm);
    const picked = menu.select(this.pickedIndex);
    this.pickedIndex = null;
    return picked;
  }

  private palettesFor(index: number): LevelPalettes {
    const chapter = chapterOf(index);
    return { [Timeline.Dawn]: themedPalette(Timeline.Dawn, chapter.dawn), [Timeline.Eclipse]: themedPalette(Timeline.Eclipse, chapter.eclipse) };
  }

  private loadWorld(index: number): void {
    if (this.loadedLevel === index && this.world) return;
    this.world?.destroy();
    this.world = null;
    this.tweens.killAll();
    this.time.removeAllEvents();
    const level = getLevel(index);
    const palettes = this.palettesFor(index);
    const started = performance.now();
    generateLevelArt(this.art, level, palettes);
    this.sim = new GameSimulation(level, abilitiesAt(index));
    this.world = new WorldView(this, level, this.art, PROMPT_STYLES[this.inputMode], palettes, this.rig.viewWidth);
    this.world.bindCameras(this.rig);
    this.rig.setBounds(level.bounds);
    this.loadedLevel = index;
    this.levelIndex = index;
    if (import.meta.env.DEV) console.info(`[Timeline Merge] Wove echo ${index} in ${Math.round(performance.now() - started)} ms.`);
  }

  private feet(): { x: number; y: number } {
    return { x: this.sim.body.x + PLAYER_SIZE.width / 2, y: this.sim.body.y + PLAYER_SIZE.height };
  }

  private titleFocus(): { x: number; y: number } {
    return { x: this.level.portal.x, y: this.level.portal.y + 72 };
  }

  private standY(): number {
    return this.level.portal.zone.y + this.level.portal.zone.h;
  }

  private buildTitleMenu(): Menu<TitleOption> {
    const fresh = completedTotal(this.progress) === 0 && this.progress.unlocked === 1;
    return createTitleMenu(continueLevel(this.progress), fresh);
  }

  private prepareTitle(): void {
    this.titleView = true;
    this.sim.reset();
    this.world$.reset();
    this.world$.sync(this.sim, true);
    this.finaleTime = 0;
    this.finale = finaleFrame(0);
    this.glance = null;
    this.exitTimer = null;
    this.rig.merge = 1;
    this.rig.setBothActive();
    const focus = this.titleFocus();
    this.rig.snapTo(focus.x, focus.y, 0);
    this.world$.player.appear(true);
    this.audio.setPortalProximity(0.5);
  }

  private startRun(): void {
    this.titleView = false;
    this.sim.reset();
    this.world$.reset();
    this.world$.sync(this.sim, true);
    this.world$.player.appear(true);
    this.finaleTime = 0;
    this.finale = finaleFrame(0);
    this.flashPlayed = false;
    this.glance = null;
    this.exitTimer = null;
    this.accumulator = 0;
    this.pending = { jump: false, shift: false, interact: false, dash: false };
    this.previousFeet = this.feet();
    const feet = this.feet();
    this.rig.merge = 0;
    this.rig.setActiveTimeline(Timeline.Dawn, true);
    this.rig.snapTo(feet.x, feet.y - FOCUS_HEAD_OFFSET, 1);
    this.audio.setTimeline(Timeline.Dawn);
    const slots = this.level.portal.kind === ExitKind.Shattered ? this.sim.fragmentsRequired : 1;
    this.ui$.configureHud(`ECHO ${this.levelIndex}`, slots);
    this.ui$.setFragments(0);
  }

  private enterGameplay(): void {
    this.ui$.showGameplay();
    if (this.levelIndex === 1) this.ui$.showIntro();
  }

  private discoveryContent(discovery: DiscoveryDef): { kind: string; title: string; summary: string; control: string | null; ability: boolean } {
    const ability = discovery.kind === DiscoveryKind.Ability;
    const control = discovery.control ? (this.inputMode === InputMode.Touch ? `TOUCH  ·  ${discovery.control.touch.toUpperCase()}` : `KEYS  ·  ${discovery.control.keyboard.toUpperCase()}`) : null;
    return { kind: ability ? 'New ability' : 'New phenomenon', title: discovery.title, summary: discovery.summary, control, ability };
  }

  private beginTransition(action: TransitionAction, level: number): void {
    if (this.transition) return;
    this.transition = { action, level, elapsed: 0, executed: false };
  }

  private playFromMenu(level: number): void {
    if (!isUnlocked(this.progress, level)) {
      this.audio.play(Sfx.Reject);
      return;
    }
    this.audio.unlock();
    this.audio.play(Sfx.MenuSelect);
    this.beginTransition(TransitionAction.Play, level);
  }

  private updateTransition(dt: number): void {
    const transition = this.transition;
    if (!transition) {
      this.fade = Math.max(0, this.fade - dt / FADE_IN);
      return;
    }
    transition.elapsed += dt;
    if (!transition.executed) {
      this.fade = Math.max(this.fade, Math.min(1, transition.elapsed / FADE_OUT));
      if (transition.elapsed >= FADE_OUT) {
        this.executeTransition(transition);
        transition.executed = true;
        transition.elapsed = 0;
      }
      return;
    }
    this.fade = Math.max(0, 1 - transition.elapsed / FADE_IN);
    if (transition.elapsed >= FADE_IN * 0.4) {
      this.transition = null;
      this.controls.flush();
    }
  }

  private executeTransition(transition: Transition): void {
    switch (transition.action) {
      case TransitionAction.Play: {
        this.loadWorld(transition.level);
        this.startRun();
        this.progress = rememberLevel(this.progress, transition.level);
        saveProgress(this.progress);
        const discovery = discoveryIntroducedAt(transition.level);
        if (discovery && !this.progress.seen.includes(discovery.id) && this.flow.dispatch(FlowAction.Brief)) {
          this.ui$.showDiscovery(this.discoveryContent(discovery));
          this.audio.play(Sfx.Unlock);
        } else {
          this.flow.dispatch(this.flow.can(FlowAction.Start) ? FlowAction.Start : FlowAction.PlayAgain);
          this.enterGameplay();
        }
        break;
      }
      case TransitionAction.Restart:
        this.flow.dispatch(FlowAction.Start);
        this.startRun();
        this.enterGameplay();
        break;
      case TransitionAction.ReturnToTitle:
        this.flow.dispatch(FlowAction.ReturnToTitle);
        this.loadWorld(TITLE_LEVEL);
        this.prepareTitle();
        this.titleMenu = this.buildTitleMenu();
        this.ui$.showTitle(this.titleMenu);
        break;
    }
  }

  private moveMenu<T extends string>(menu: Menu<T>, delta: number, render: (menu: Menu<T>) => void): void {
    menu.move(delta);
    this.audio.play(Sfx.MenuMove);
    render(menu);
  }

  private updateTitle(): void {
    if (this.controls.consume(Action.MenuUp)) this.moveMenu(this.titleMenu, -1, (menu) => this.ui$.updateTitleMenu(menu));
    if (this.controls.consume(Action.MenuDown)) this.moveMenu(this.titleMenu, 1, (menu) => this.ui$.updateTitleMenu(menu));
    if (!this.choose(this.titleMenu)) return;
    this.audio.unlock();
    this.touch.enterFullscreen();
    if (this.titleMenu.selected === TitleOption.Continue) {
      this.playFromMenu(continueLevel(this.progress));
    } else {
      this.audio.play(Sfx.MenuSelect);
      this.openAtlas(continueLevel(this.progress));
    }
  }

  private openAtlas(level: number): void {
    if (!this.flow.dispatch(FlowAction.OpenAtlas)) return;
    this.atlasLevel = level;
    this.ui$.showAtlas(buildAtlas(this.progress, this.atlasLevel));
  }

  private selectAtlas(level: number): void {
    if (level === this.atlasLevel) return;
    this.atlasLevel = level;
    this.audio.play(Sfx.MenuMove);
    this.ui$.updateAtlas(buildAtlas(this.progress, this.atlasLevel));
  }

  private updateAtlas(): void {
    if (this.controls.consume(Action.Pause)) {
      this.leaveAtlas();
      return;
    }
    if (this.controls.consume(Action.MenuLeft)) this.selectAtlas(stepAtlas(this.atlasLevel, -1));
    if (this.controls.consume(Action.MenuRight)) this.selectAtlas(stepAtlas(this.atlasLevel, 1));
    if (this.controls.consume(Action.MenuUp)) this.selectAtlas(jumpChapter(this.atlasLevel, -1));
    if (this.controls.consume(Action.MenuDown)) this.selectAtlas(jumpChapter(this.atlasLevel, 1));
    if (this.controls.consume(Action.Confirm)) this.playFromMenu(this.atlasLevel);
  }

  private updateBriefing(): void {
    if (this.controls.consume(Action.Pause)) {
      this.ui$.hideDiscovery();
      this.openAtlas(this.levelIndex);
      return;
    }
    if (!this.briefingConfirmed && !this.controls.consume(Action.Confirm)) return;
    const discovery = discoveryIntroducedAt(this.levelIndex);
    if (discovery) {
      this.progress = markSeen(this.progress, discovery.id);
      saveProgress(this.progress);
    }
    this.audio.play(Sfx.MenuSelect);
    this.ui$.hideDiscovery();
    this.flow.dispatch(FlowAction.Start);
    this.enterGameplay();
  }

  private updatePlaying(dt: number): void {
    if (this.controls.consume(Action.Pause)) {
      this.openPause();
      return;
    }
    if (this.controls.consume(Action.Restart)) {
      this.handleEvents(this.sim.respawn());
    }
    this.pending.jump ||= this.controls.consume(Action.Jump);
    this.pending.shift ||= this.controls.consume(Action.Shift);
    this.pending.interact ||= this.controls.consume(Action.Interact);
    this.pending.dash ||= this.controls.consume(Action.Dash);

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT && this.flow.phase === GamePhase.Playing) {
      this.previousFeet = this.feet();
      const events = this.sim.step({
        moveX: this.controls.axisX(),
        jumpPressed: this.pending.jump,
        jumpHeld: this.controls.isDown(Action.Jump),
        shiftPressed: this.pending.shift,
        interactPressed: this.pending.interact,
        dashPressed: this.pending.dash,
      });
      this.pending = { jump: false, shift: false, interact: false, dash: false };
      this.accumulator -= FIXED_DT;
      this.handleEvents(events);
    }
  }

  private openPause(): void {
    if (!this.flow.dispatch(FlowAction.Pause)) return;
    this.pauseMenu.reset();
    this.pauseMenu.relabel(PauseOption.Sound, soundLabel(this.audio.isMuted));
    this.ui$.showPause(this.pauseMenu);
    this.audio.play(Sfx.MenuMove);
  }

  private resume(): void {
    if (!this.flow.dispatch(FlowAction.Resume)) return;
    this.ui$.hidePause();
    this.controls.flush();
    this.accumulator = 0;
  }

  private updatePaused(): void {
    if (this.controls.consume(Action.Pause)) {
      this.resume();
      return;
    }
    if (this.controls.consume(Action.MenuUp)) this.moveMenu(this.pauseMenu, -1, (menu) => this.ui$.updatePause(menu));
    if (this.controls.consume(Action.MenuDown)) this.moveMenu(this.pauseMenu, 1, (menu) => this.ui$.updatePause(menu));
    if (!this.choose(this.pauseMenu)) return;
    this.audio.play(Sfx.MenuSelect);
    switch (this.pauseMenu.selected) {
      case PauseOption.Resume:
        this.resume();
        break;
      case PauseOption.RestartCheckpoint:
        this.resume();
        this.handleEvents(this.sim.respawn());
        break;
      case PauseOption.RestartLevel:
        this.ui$.hidePause();
        this.beginTransition(TransitionAction.Restart, this.levelIndex);
        break;
      case PauseOption.Atlas:
        this.ui$.hidePause();
        this.openAtlas(this.levelIndex);
        break;
      case PauseOption.Sound:
        this.toggleMute();
        break;
      case PauseOption.Title:
        this.ui$.hidePause();
        this.beginTransition(TransitionAction.ReturnToTitle, TITLE_LEVEL);
        break;
    }
  }

  private completeLevel(): void {
    const record = this.progress.records[this.levelIndex];
    const time = this.sim.stats.time;
    this.lastResult = {
      time,
      shifts: this.sim.stats.shifts,
      deaths: this.sim.stats.deaths,
      shard: this.sim.shardCollected,
      newBest: record !== undefined && time < record.bestTime,
    };
    this.progress = recordCompletion(this.progress, { level: this.levelIndex, time, shard: this.sim.shardCollected });
    saveProgress(this.progress);
  }

  private reachExit(): void {
    this.completeLevel();
    this.flow.dispatch(FlowAction.Exit);
    this.ui$.hideIntro();
    const feet = this.feet();
    const palette = paletteFor(this.sim.timeline);
    this.world$.player.vanish();
    this.world$.ringAt(this.sim.timeline, this.level.portal.x, this.level.portal.y, 3.2, palette.emissive);
    this.world$.burst(this.sim.timeline, feet.x, feet.y - 20, 40);
    this.rig.shake(260, 0.003);
    this.audio.play(Sfx.LevelComplete);
    this.exitTimer = EXIT_CARD_DELAY;
  }

  private showCompletionCard(): void {
    const result = this.lastResult;
    if (!result) return;
    const next = this.levelIndex + 1;
    const discovery = discoveryIntroducedAt(next);
    const teaser = discovery
      ? `Something new awakens in Echo ${next}…`
      : isChapterFinale(next)
        ? `The trial of ${chapterOf(next).title} awaits.`
        : '';
    const badges = [result.shard ? 'Echo shard recovered' : 'An echo shard still hides somewhere here'];
    if (result.newBest) badges.push('New best time');
    this.completeMenu = createCompleteMenu(next <= LEVEL_COUNT);
    this.ui$.showComplete(
      {
        title: `ECHO ${this.levelIndex} RESTORED`,
        name: levelName(this.levelIndex),
        stats: statsLine(result),
        badge: badges.join('   ·   '),
        teaser,
      },
      this.completeMenu,
    );
  }

  private updateLevelComplete(dt: number): void {
    if (this.exitTimer !== null) {
      this.exitTimer -= dt;
      if (this.exitTimer > 0) return;
      this.exitTimer = null;
      this.showCompletionCard();
      return;
    }
    if (this.controls.consume(Action.MenuUp)) this.moveMenu(this.completeMenu, -1, (menu) => this.ui$.updateComplete(menu));
    if (this.controls.consume(Action.MenuDown)) this.moveMenu(this.completeMenu, 1, (menu) => this.ui$.updateComplete(menu));
    if (!this.choose(this.completeMenu)) return;
    this.audio.play(Sfx.MenuSelect);
    switch (this.completeMenu.selected) {
      case CompleteOption.Continue:
        this.beginTransition(TransitionAction.Play, Math.min(LEVEL_COUNT, this.levelIndex + 1));
        break;
      case CompleteOption.Replay:
        this.beginTransition(TransitionAction.Play, this.levelIndex);
        break;
      case CompleteOption.Atlas:
        this.openAtlas(Math.min(LEVEL_COUNT, this.levelIndex + 1));
        break;
    }
  }

  private updateFinale(dt: number): void {
    this.finaleTime += dt;
    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.previousFeet = this.feet();
      this.sim.step(IDLE_INPUT);
      this.accumulator -= FIXED_DT;
    }
    this.finale = finaleFrame(this.finaleTime);
    if (this.finale.flash > 0.9 && !this.flashPlayed) {
      this.flashPlayed = true;
      this.audio.play(Sfx.Flash);
      this.audio.setBothRealities();
      this.rig.setBothActive();
      this.rig.shake(500, 0.004);
    }
    if (this.finale.done && this.flow.dispatch(FlowAction.Complete)) {
      const final = this.levelIndex >= LEVEL_COUNT;
      const chapter = chapterOf(this.levelIndex);
      const nextChapter = CHAPTERS[chapter.index] ?? null;
      this.victoryMenu = createVictoryMenu(final);
      this.ui$.showVictory(this.victoryMenu, {
        title: final ? 'THE TIMELINES ARE ONE' : `CHAPTER ${chapter.numeral} RESTORED`,
        line: final
          ? 'A hundred echoes, one traveler. The bridge between worlds holds once more.'
          : `${chapter.title} remembers itself.${nextChapter ? ` ${nextChapter.title} awaits.` : ''}`,
        stats: statsLine(this.sim.stats),
      });
    }
  }

  private updateVictory(): void {
    if (this.controls.consume(Action.MenuUp)) this.moveMenu(this.victoryMenu, -1, (menu) => this.ui$.updateVictory(menu));
    if (this.controls.consume(Action.MenuDown)) this.moveMenu(this.victoryMenu, 1, (menu) => this.ui$.updateVictory(menu));
    if (this.controls.consume(Action.Pause)) {
      this.beginTransition(TransitionAction.ReturnToTitle, TITLE_LEVEL);
      return;
    }
    if (!this.choose(this.victoryMenu)) return;
    this.audio.play(Sfx.MenuSelect);
    switch (this.victoryMenu.selected) {
      case VictoryOption.Continue:
        this.beginTransition(TransitionAction.Play, Math.min(LEVEL_COUNT, this.levelIndex + 1));
        break;
      case VictoryOption.Atlas:
        this.openAtlas(this.levelIndex);
        break;
      case VictoryOption.Title:
        this.beginTransition(TransitionAction.ReturnToTitle, TITLE_LEVEL);
        break;
    }
  }

  private toggleMute(): void {
    const muted = this.audio.toggleMute();
    this.pauseMenu.relabel(PauseOption.Sound, soundLabel(muted));
    this.ui$.showMute(muted);
    if (this.flow.phase === GamePhase.Paused) this.ui$.updatePause(this.pauseMenu);
  }

  private handleBlur(): void {
    this.controls.releaseAll();
    this.touch.releaseAll();
    if (this.flow?.phase === GamePhase.Playing && !this.transition) {
      this.openPause();
    }
  }

  private lookAt(mechanism: MechanismDef): void {
    const affected = this.level.solids.filter((solid) => solid.condition?.requires === mechanism.id || solid.condition?.unless === mechanism.id);
    if (affected.length === 0) return;
    const left = Math.min(...affected.map((solid) => solid.x));
    const right = Math.max(...affected.map((solid) => solid.x + solid.w));
    const top = Math.min(...affected.map((solid) => solid.y));
    const bottom = Math.max(...affected.map((solid) => solid.y + solid.h));
    this.glance = { x: (left + right) / 2, y: (top + bottom) / 2, remaining: GLANCE_DURATION };
  }

  private rejectionMessage(reason: SwitchRejection): string {
    switch (reason) {
      case SwitchRejection.Locked:
        return 'The rift is still closed to you.';
      case SwitchRejection.Grounded:
        return 'For now, the rift only opens beneath steady feet.';
      case SwitchRejection.Anchored:
        return this.sim.pulseReading() ? 'Inside the pulse, the rift moves on its own.' : 'The chains hold this reality in place.';
      case SwitchRejection.Hazard:
        return 'Thorns crowd that space in the other reality.';
      case SwitchRejection.Blocked:
        return 'Something solid fills that space in the other reality.';
    }
  }

  private handleEvents(events: SimEvent[]): void {
    const feet = this.feet();
    for (const event of events) {
      switch (event.type) {
        case SimEventType.Jumped:
          this.audio.play(Sfx.Jump);
          break;
        case SimEventType.AirJumped:
        case SimEventType.WallJumped:
          this.audio.play(Sfx.AirJump);
          this.world$.burst(this.sim.timeline, feet.x, feet.y, 8);
          break;
        case SimEventType.Dashed:
          this.audio.play(Sfx.Dash);
          this.rig.shake(90, 0.002);
          break;
        case SimEventType.Landed:
          this.world$.landEffect(this.sim.timeline, feet.x, feet.y, event.impactSpeed);
          if (event.impactSpeed > 220) this.audio.play(Sfx.Land, clamp(event.impactSpeed / 900, 0.3, 1));
          break;
        case SimEventType.TimelineShifted:
        case SimEventType.PulseShifted: {
          const from = otherTimeline(event.to);
          this.world$.shiftEffect(from, event.to, feet.x, feet.y);
          this.rig.setActiveTimeline(event.to, false);
          this.rig.pulse();
          this.ui$.shiftPulse(event.to, feet.y - FOCUS_HEAD_OFFSET + 20 - this.rig.scrollOf(event.to).y);
          this.audio.setTimeline(event.to);
          this.audio.play(event.type === SimEventType.PulseShifted ? Sfx.Pulse : Sfx.Shift);
          break;
        }
        case SimEventType.ShiftRejected:
          this.world$.rejectEffect(otherTimeline(this.sim.timeline), feet.x, feet.y);
          this.rig.shake(140, 0.003, otherTimeline(this.sim.timeline));
          this.ui$.rejectFlash();
          this.ui$.showMessage(this.rejectionMessage(event.reason), 1.8);
          this.audio.play(Sfx.Reject);
          break;
        case SimEventType.FragmentCollected:
          this.world$.collectFragment(event.fragment);
          this.ui$.showMemory(event.fragment, event.count, event.required);
          this.ui$.setFragments(event.required > 1 ? event.count : 1);
          this.rig.shake(160, 0.002);
          this.audio.play(Sfx.Collect);
          break;
        case SimEventType.CheckpointReached:
          this.world$.markCheckpoint(event.checkpoint, this.sim.timeline);
          this.audio.play(Sfx.Checkpoint);
          break;
        case SimEventType.MechanismActivated:
          this.world$.sync(this.sim, false);
          this.lookAt(event.mechanism);
          this.ui$.showMessage(event.mechanism.message, 4.4);
          this.rig.shake(900, 0.0035);
          this.audio.play(event.mechanism.kind === MechanismKind.Bell ? Sfx.Bell : Sfx.Winch);
          break;
        case SimEventType.InteractionRefused: {
          const required = event.target.requiredTimeline === Timeline.Dawn ? 'Dawn' : 'Eclipse';
          this.ui$.showMessage(`It does not answer here. Its echo still works in the ${required}.`, 2.6);
          this.audio.play(Sfx.Reject);
          break;
        }
        case SimEventType.Crumbled:
          this.world$.crumbleEffect(event.solid);
          this.audio.play(Sfx.Crumble);
          break;
        case SimEventType.Reformed:
          this.world$.reformEffect(event.solid);
          break;
        case SimEventType.Died:
          this.world$.deathEffect(this.sim.timeline, feet.x, feet.y);
          this.rig.shake(220, 0.004);
          this.audio.play(Sfx.Death);
          break;
        case SimEventType.Respawned: {
          const respawnFeet = this.feet();
          this.previousFeet = respawnFeet;
          this.world$.sync(this.sim, true);
          this.world$.player.appear(false);
          this.world$.ringAt(event.timeline, respawnFeet.x, respawnFeet.y - 18, 1.4, paletteFor(event.timeline).emissive);
          this.rig.setActiveTimeline(event.timeline, false);
          this.audio.setTimeline(event.timeline);
          this.audio.play(Sfx.Respawn);
          break;
        }
        case SimEventType.UnravelingAwakened:
          this.ui$.showMessage('The world is unraveling behind you. Run.', 3);
          this.rig.shake(700, 0.004);
          this.audio.play(Sfx.Unravel);
          break;
        case SimEventType.PortalUnstable:
          this.ui$.showMessage(
            event.missing === 1
              ? 'The portal trembles and recoils. One memory is still lost.'
              : `The portal trembles and recoils. ${event.missing} memories are still lost.`,
            3.6,
          );
          this.rig.shake(300, 0.003);
          this.audio.play(Sfx.PortalUnstable);
          break;
        case SimEventType.PortalActivated:
          this.completeLevel();
          this.flow.dispatch(FlowAction.BeginFinale);
          this.finaleTime = 0;
          this.flashPlayed = false;
          this.ui$.hideIntro();
          this.audio.play(Sfx.PortalActivate);
          break;
        case SimEventType.ExitReached:
          this.reachExit();
          break;
        case SimEventType.AreaEntered:
          this.ui$.showArea(event.area);
          break;
      }
    }
  }

  private currentHint(): string | null {
    if (this.flow.phase !== GamePhase.Playing || this.sim.status !== SimStatus.Alive) return null;
    const cx = this.sim.body.x + PLAYER_SIZE.width / 2;
    const cy = this.sim.body.y + PLAYER_SIZE.height / 2;
    const hint = this.level.hints.find((candidate) => containsPoint(candidate.zone, cx, cy) && !(candidate.hideAfterShift && this.sim.stats.shifts > 0));
    if (!hint) return null;
    return this.inputMode === InputMode.Touch && hint.touchText ? hint.touchText : hint.text;
  }

  private enabledButtons(): ReadonlySet<ActionButton> {
    const enabled = new Set<ActionButton>([TouchButton.Jump]);
    if (this.sim.hasAbility(Ability.Shift)) enabled.add(TouchButton.Shift);
    if (this.sim.hasAbility(Ability.Interact)) enabled.add(TouchButton.Interact);
    if (this.sim.hasAbility(Ability.Dash)) enabled.add(TouchButton.Dash);
    return enabled;
  }

  private renderFrame(dt: number): void {
    const phase = this.flow.phase;
    const cinematic = phase === GamePhase.Finale || phase === GamePhase.Victory;
    const simulating = phase === GamePhase.Playing || phase === GamePhase.Finale;
    const alpha = simulating ? this.accumulator / FIXED_DT : 1;
    const current = this.feet();
    const feet = {
      x: this.previousFeet.x + (current.x - this.previousFeet.x) * alpha,
      y: this.previousFeet.y + (current.y - this.previousFeet.y) * alpha,
    };
    const body = this.sim.body;
    const title = this.titleView;
    const bothActive = title || (cinematic && this.finale.merge > 0.5);
    const portal = this.level.portal;
    const focus = this.titleFocus();

    const playerState: PlayerRenderState = title
      ? {
          x: portal.standX,
          y: this.standY(),
          vx: 0,
          vy: 0,
          onGround: true,
          facing: 1,
          activeTimeline: Timeline.Dawn,
          shiftBlocked: false,
          mirrorAxis: portal.x,
          mirror: 1,
          bothActive: true,
          dashing: false,
          gliding: false,
          wallSliding: false,
          wallSide: 0,
        }
      : {
          x: feet.x,
          y: feet.y,
          vx: body.vx,
          vy: body.vy,
          onGround: body.onGround,
          facing: body.facing,
          activeTimeline: this.sim.timeline,
          shiftBlocked: phase === GamePhase.Playing && this.sim.status === SimStatus.Alive && !this.sim.previewShift().ok && this.sim.hasAbility(Ability.Shift),
          mirrorAxis: portal.x,
          mirror: cinematic ? this.finale.merge : 0,
          bothActive,
          dashing: isDashing(body),
          gliding: body.gliding,
          wallSliding: body.wallSliding,
          wallSide: body.wall,
        };
    this.world$.player.update(playerState, dt);

    if (title) {
      this.rig.merge = 1;
      this.rig.glide(focus.x, focus.y + Math.sin(this.elapsed * 0.4) * 6, 2, dt);
    } else if (cinematic) {
      this.rig.merge = this.finale.merge;
      const blend = this.finale.merge;
      const targetX = feet.x + (focus.x - feet.x) * blend;
      const targetY = feet.y - FOCUS_HEAD_OFFSET + (focus.y - (feet.y - FOCUS_HEAD_OFFSET)) * blend;
      this.rig.glide(targetX, targetY, 2.5, dt);
    } else {
      let targetX = feet.x;
      let targetY = feet.y - FOCUS_HEAD_OFFSET;
      if (this.glance) {
        this.glance.remaining -= dt;
        const weight = GLANCE_WEIGHT * Math.min(1, this.glance.remaining / 0.6, (GLANCE_DURATION - this.glance.remaining) / 0.4);
        targetX += (this.glance.x - targetX) * weight;
        targetY += (this.glance.y - targetY) * weight;
        if (this.glance.remaining <= 0) this.glance = null;
      }
      this.rig.follow(targetX, targetY, body.facing, dt);
    }
    this.rig.update(dt);

    const interaction = phase === GamePhase.Playing && this.sim.status === SimStatus.Alive ? this.sim.getInteraction() : null;
    this.touch.sync({
      visible: phase === GamePhase.Playing && !this.transition,
      timeline: this.sim.timeline,
      shiftBlocked: playerState.shiftBlocked,
      interact: interaction === null ? InteractCue.None : interaction.available ? InteractCue.Ready : InteractCue.Muted,
      enabled: this.enabledButtons(),
    });
    let portalFrame: PortalFrame;
    if (cinematic) {
      portalFrame = {
        power: this.finale.portalPower,
        ringSpeed: this.finale.ringSpeed,
        assembled: this.finale.merge,
        sockets: this.finale.fragmentFlight.map((progress) => (progress >= 1 ? 1 : 0)),
      };
      this.world$.showFlight(this.finale.fragmentFlight, feet.x, feet.y - 24);
    } else {
      portalFrame = portal.kind === ExitKind.Gate ? OPEN_GATE_FRAME : PortalView.emptyFrame(title ? 1 : this.sim.fragmentCount);
      this.world$.showFlight([0, 0, 0], feet.x, feet.y);
    }
    this.world$.update(dt, this.sim, this.rig, interaction, portalFrame, phase === GamePhase.Playing);

    const portalDistance = Math.hypot(feet.x - portal.x, feet.y - portal.y);
    const proximity = title ? 0.5 : cinematic ? 1 : clamp(1 - portalDistance / PORTAL_HEARING_DISTANCE, 0, 1);
    this.audio.setPortalProximity(proximity);

    const focusTimeline = this.sim.timeline;
    const focusY = title ? this.standY() - 40 - this.rig.scrollOf(Timeline.Dawn).y : feet.y - 24 - this.rig.scrollOf(focusTimeline).y;
    this.ui$.updateFrame(dt, {
      timeline: this.sim.timeline,
      bothActive,
      focusY: clamp(focusY, 0, GAME_HEIGHT),
      dim: { [Timeline.Dawn]: this.rig.dimAmount(Timeline.Dawn), [Timeline.Eclipse]: this.rig.dimAmount(Timeline.Eclipse) },
      postFx: this.rig.hasPostFx,
      hint: this.currentHint(),
      fade: this.fade,
      flash: cinematic ? this.finale.flash : 0,
      seamIntensity: title ? 1.25 : cinematic ? 1 + this.finale.merge * 1.6 : 1,
    });
    this.ui$.setFinaleText(cinematic ? this.finale.textAlpha : 0);
  }
}
