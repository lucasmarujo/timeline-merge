import Phaser from 'phaser';
import { GAME_HEIGHT, SCENE_KEYS } from '../config';
import { AudioEngine, Sfx } from '../audio/AudioEngine';
import { FIXED_DT, FRAGMENTS_REQUIRED, MAX_FRAME_DELTA, PLAYER_SIZE } from '../core/constants';
import { FlowAction, GamePhase, MechanismKind, SimEventType, SimStatus, Timeline } from '../core/enums';
import { finaleFrame, type FinaleFrame } from '../core/finale';
import { GameFlow } from '../core/gameFlow';
import { clamp, containsPoint } from '../core/geometry';
import { GameSimulation, IDLE_INPUT, type SimEvent } from '../core/simulation';
import { otherTimeline } from '../core/timeline';
import type { MechanismDef } from '../core/types';
import { Action, InputController } from '../input/InputController';
import { detectInputMode, InputMode } from '../input/inputMode';
import { InteractCue, TouchControls } from '../input/TouchControls';
import { LEVEL_1 } from '../levels/level1';
import type { ArtLibrary } from '../render/art/ArtLibrary';
import { paletteFor } from '../render/art/palette';
import { CameraRig } from '../render/CameraRig';
import type { PlayerRenderState } from '../render/PlayerView';
import { PortalView, type PortalFrame } from '../render/PortalView';
import { WorldView } from '../render/WorldView';
import { showFatalError } from '../ui/fatalError';
import { PROMPT_STYLES } from '../ui/inputPresentation';
import { createPauseMenu, createVictoryMenu, PauseOption, soundLabel, VictoryOption, type Menu } from '../ui/Menu';
import { ART_REGISTRY_KEY } from './BootScene';
import type { UiHost, UIScene } from './UIScene';

enum TransitionAction {
  StartGame = 'startGame',
  RestartLevel = 'restartLevel',
  ReturnToTitle = 'returnToTitle',
}

interface Transition {
  action: TransitionAction;
  elapsed: number;
  executed: boolean;
}

interface Glance {
  x: number;
  y: number;
  remaining: number;
}

const FADE_OUT = 0.45;
const FADE_IN = 0.7;
const GLANCE_DURATION = 2.2;
const GLANCE_WEIGHT = 0.65;
const PORTAL_HEARING_DISTANCE = 760;
const FOCUS_HEAD_OFFSET = 44;
const STAND_Y = LEVEL_1.portal.zone.y + LEVEL_1.portal.zone.h;
const TITLE_FOCUS = { x: LEVEL_1.portal.x, y: LEVEL_1.portal.y + 72 };

export class GameScene extends Phaser.Scene implements UiHost {
  private sim!: GameSimulation;
  private flow!: GameFlow;
  private rig!: CameraRig;
  private world!: WorldView;
  private controls!: InputController;
  private touch!: TouchControls;
  private inputMode = InputMode.Keyboard;
  private pickedIndex: number | null = null;
  private audio!: AudioEngine;
  private pauseMenu!: Menu<PauseOption>;
  private victoryMenu!: Menu<VictoryOption>;
  private ui: UIScene | null = null;
  private accumulator = 0;
  private previousFeet = { x: 0, y: 0 };
  private pending = { jump: false, shift: false, interact: false };
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
    this.sim = new GameSimulation(LEVEL_1);
    this.flow = new GameFlow();
    this.controls = new InputController(keyboard, detectInputMode((query) => window.matchMedia?.(query).matches === true));
    this.inputMode = this.controls.mode;
    this.world = new WorldView(this, LEVEL_1, art, PROMPT_STYLES[this.inputMode]);
    this.rig = new CameraRig(this, LEVEL_1.bounds);
    this.world.bindCameras(this.rig);
    this.touch = new TouchControls(this.controls, this.scale);
    this.audio = new AudioEngine();
    this.audio.armUnlock();
    this.pauseMenu = createPauseMenu(this.audio.isMuted);
    this.victoryMenu = createVictoryMenu();
    this.prepareTitle();

    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleBlur, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handleTap, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleBlur, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.handleTap, this);
      this.touch.dispose();
      this.audio.dispose();
    });
    this.scene.launch(SCENE_KEYS.ui);
  }

  attachUi(ui: UIScene): void {
    this.ui = ui;
    ui.setInputMode(this.inputMode);
    ui.showTitle();
    if (this.audio.isMuted) ui.showMute(true);
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ui || !this.sim) return;
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
        case GamePhase.Playing:
          this.updatePlaying(dt);
          break;
        case GamePhase.Paused:
          this.updatePaused();
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
    this.renderFrame(dt);
  }

  pickMenuItem(index: number): void {
    this.controls.useTouch();
    this.touch.enterFullscreen();
    this.audio.unlock();
    this.pickedIndex = index;
  }

  private handleTap(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.controls.useTouch();
    if (this.flow.phase !== GamePhase.Title || this.transition) return;
    this.touch.enterFullscreen();
    this.audio.unlock();
    this.controls.pressVirtual(Action.Confirm);
  }

  private applyInputMode(mode: InputMode): void {
    this.inputMode = mode;
    this.world.setPromptStyle(PROMPT_STYLES[mode]);
    this.ui$.setInputMode(mode);
    if (this.flow.phase === GamePhase.Paused) this.ui$.updatePause(this.pauseMenu);
    if (this.flow.phase === GamePhase.Victory) this.ui$.updateVictory(this.victoryMenu);
  }

  private choose<T extends string>(menu: Menu<T>): boolean {
    if (this.pickedIndex === null) return this.controls.consume(Action.Confirm);
    const picked = menu.select(this.pickedIndex);
    this.pickedIndex = null;
    return picked;
  }

  private get ui$(): UIScene {
    return this.ui as UIScene;
  }

  private feet(): { x: number; y: number } {
    return { x: this.sim.body.x + PLAYER_SIZE.width / 2, y: this.sim.body.y + PLAYER_SIZE.height };
  }

  private prepareTitle(): void {
    this.sim.reset();
    this.world.reset();
    this.world.sync(this.sim, true);
    this.finaleTime = 0;
    this.finale = finaleFrame(0);
    this.glance = null;
    this.rig.merge = 1;
    this.rig.setBothActive();
    this.rig.snapTo(TITLE_FOCUS.x, TITLE_FOCUS.y, 0);
    this.world.player.appear(true);
    this.audio.setPortalProximity(0.5);
  }

  private startRun(): void {
    this.sim.reset();
    this.world.reset();
    this.world.sync(this.sim, true);
    this.world.player.appear(true);
    this.finaleTime = 0;
    this.finale = finaleFrame(0);
    this.flashPlayed = false;
    this.glance = null;
    this.accumulator = 0;
    this.pending = { jump: false, shift: false, interact: false };
    this.previousFeet = this.feet();
    const feet = this.feet();
    this.rig.merge = 0;
    this.rig.setActiveTimeline(Timeline.Dawn, true);
    this.rig.snapTo(feet.x, feet.y - FOCUS_HEAD_OFFSET, 1);
    this.audio.setTimeline(Timeline.Dawn);
    this.ui$.setFragments(0);
    this.ui$.showGameplay();
    this.ui$.showIntro();
  }

  private beginTransition(action: TransitionAction): void {
    if (this.transition) return;
    this.transition = { action, elapsed: 0, executed: false };
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
        this.executeTransition(transition.action);
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

  private executeTransition(action: TransitionAction): void {
    switch (action) {
      case TransitionAction.StartGame:
        this.flow.dispatch(this.flow.phase === GamePhase.Victory ? FlowAction.PlayAgain : FlowAction.Start);
        this.startRun();
        break;
      case TransitionAction.RestartLevel:
        this.flow.dispatch(FlowAction.Resume);
        this.startRun();
        break;
      case TransitionAction.ReturnToTitle:
        this.flow.dispatch(FlowAction.ReturnToTitle);
        this.prepareTitle();
        this.ui$.showTitle();
        break;
    }
  }

  private updateTitle(): void {
    if (this.controls.consume(Action.Confirm)) {
      this.audio.unlock();
      this.audio.play(Sfx.MenuSelect);
      this.beginTransition(TransitionAction.StartGame);
    }
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

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT && this.flow.phase === GamePhase.Playing) {
      this.previousFeet = this.feet();
      const events = this.sim.step({
        moveX: this.controls.axisX(),
        jumpPressed: this.pending.jump,
        jumpHeld: this.controls.isDown(Action.Jump),
        shiftPressed: this.pending.shift,
        interactPressed: this.pending.interact,
      });
      this.pending = { jump: false, shift: false, interact: false };
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
    if (this.controls.consume(Action.MenuUp)) this.moveMenu(this.pauseMenu, -1);
    if (this.controls.consume(Action.MenuDown)) this.moveMenu(this.pauseMenu, 1);
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
        this.beginTransition(TransitionAction.RestartLevel);
        break;
      case PauseOption.Sound:
        this.toggleMute();
        break;
      case PauseOption.Title:
        this.ui$.hidePause();
        this.beginTransition(TransitionAction.ReturnToTitle);
        break;
    }
  }

  private moveMenu<T extends string>(menu: Menu<T>, delta: number): void {
    menu.move(delta);
    this.audio.play(Sfx.MenuMove);
    if (this.flow.phase === GamePhase.Paused) this.ui$.updatePause(menu);
    else this.ui$.updateVictory(menu);
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
      this.victoryMenu.reset();
      this.ui$.showVictory(this.victoryMenu, { time: this.sim.stats.time, shifts: this.sim.stats.shifts, deaths: this.sim.stats.deaths });
    }
  }

  private updateVictory(): void {
    if (this.controls.consume(Action.MenuUp)) this.moveMenu(this.victoryMenu, -1);
    if (this.controls.consume(Action.MenuDown)) this.moveMenu(this.victoryMenu, 1);
    if (this.controls.consume(Action.Pause)) {
      this.beginTransition(TransitionAction.ReturnToTitle);
      return;
    }
    if (!this.choose(this.victoryMenu)) return;
    this.audio.play(Sfx.MenuSelect);
    this.beginTransition(this.victoryMenu.selected === VictoryOption.PlayAgain ? TransitionAction.StartGame : TransitionAction.ReturnToTitle);
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
    const affected = LEVEL_1.solids.filter((solid) => solid.condition?.requires === mechanism.id || solid.condition?.unless === mechanism.id);
    if (affected.length === 0) return;
    const left = Math.min(...affected.map((solid) => solid.x));
    const right = Math.max(...affected.map((solid) => solid.x + solid.w));
    const top = Math.min(...affected.map((solid) => solid.y));
    const bottom = Math.max(...affected.map((solid) => solid.y + solid.h));
    this.glance = { x: (left + right) / 2, y: (top + bottom) / 2, remaining: GLANCE_DURATION };
  }

  private handleEvents(events: SimEvent[]): void {
    const feet = this.feet();
    for (const event of events) {
      switch (event.type) {
        case SimEventType.Jumped:
          this.audio.play(Sfx.Jump);
          break;
        case SimEventType.Landed:
          this.world.landEffect(this.sim.timeline, feet.x, feet.y, event.impactSpeed);
          if (event.impactSpeed > 220) this.audio.play(Sfx.Land, clamp(event.impactSpeed / 900, 0.3, 1));
          break;
        case SimEventType.TimelineShifted: {
          const from = otherTimeline(event.to);
          this.world.shiftEffect(from, event.to, feet.x, feet.y);
          this.rig.setActiveTimeline(event.to, false);
          this.rig.pulse();
          this.ui$.shiftPulse(event.to, feet.y - FOCUS_HEAD_OFFSET + 20 - this.rig.scrollOf(event.to).y);
          this.audio.setTimeline(event.to);
          this.audio.play(Sfx.Shift);
          break;
        }
        case SimEventType.ShiftRejected:
          this.world.rejectEffect(otherTimeline(this.sim.timeline), feet.x, feet.y);
          this.rig.shake(140, 0.003, otherTimeline(this.sim.timeline));
          this.ui$.rejectFlash();
          this.ui$.showMessage('Something solid fills that space in the other reality.', 1.6);
          this.audio.play(Sfx.Reject);
          break;
        case SimEventType.FragmentCollected:
          this.world.collectFragment(event.fragment);
          this.ui$.showMemory(event.fragment, event.count, FRAGMENTS_REQUIRED);
          this.rig.shake(160, 0.002);
          this.audio.play(Sfx.Collect);
          break;
        case SimEventType.CheckpointReached:
          this.world.markCheckpoint(event.checkpoint, this.sim.timeline);
          this.audio.play(Sfx.Checkpoint);
          break;
        case SimEventType.MechanismActivated:
          this.world.sync(this.sim, false);
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
        case SimEventType.Died:
          this.world.deathEffect(this.sim.timeline, feet.x, feet.y);
          this.rig.shake(220, 0.004);
          this.audio.play(Sfx.Death);
          break;
        case SimEventType.Respawned: {
          const respawnFeet = this.feet();
          this.previousFeet = respawnFeet;
          this.world.player.appear(false);
          this.world.ringAt(event.timeline, respawnFeet.x, respawnFeet.y - 18, 1.4, paletteFor(event.timeline).emissive);
          this.rig.setActiveTimeline(event.timeline, false);
          this.audio.setTimeline(event.timeline);
          this.audio.play(Sfx.Respawn);
          break;
        }
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
          this.flow.dispatch(FlowAction.BeginFinale);
          this.finaleTime = 0;
          this.flashPlayed = false;
          this.ui$.hideIntro();
          this.audio.play(Sfx.PortalActivate);
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
    const hint = LEVEL_1.hints.find((candidate) => containsPoint(candidate.zone, cx, cy) && !(candidate.hideAfterShift && this.sim.stats.shifts > 0));
    if (!hint) return null;
    return this.inputMode === InputMode.Touch && hint.touchText ? hint.touchText : hint.text;
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
    const title = phase === GamePhase.Title;
    const bothActive = title || (cinematic && this.finale.merge > 0.5);

    const playerState: PlayerRenderState = title
      ? {
          x: LEVEL_1.portal.standX,
          y: STAND_Y,
          vx: 0,
          vy: 0,
          onGround: true,
          facing: 1,
          activeTimeline: Timeline.Dawn,
          shiftBlocked: false,
          mirrorAxis: LEVEL_1.portal.x,
          mirror: 1,
          bothActive: true,
        }
      : {
          x: feet.x,
          y: feet.y,
          vx: body.vx,
          vy: body.vy,
          onGround: body.onGround,
          facing: body.facing,
          activeTimeline: this.sim.timeline,
          shiftBlocked: phase === GamePhase.Playing && this.sim.status === SimStatus.Alive && !this.sim.previewShift().ok,
          mirrorAxis: LEVEL_1.portal.x,
          mirror: cinematic ? this.finale.merge : 0,
          bothActive,
        };
    this.world.player.update(playerState, dt);

    if (title) {
      this.rig.merge = 1;
      this.rig.glide(TITLE_FOCUS.x, TITLE_FOCUS.y + Math.sin(this.elapsed * 0.4) * 6, 2, dt);
    } else if (cinematic) {
      this.rig.merge = this.finale.merge;
      const blend = this.finale.merge;
      const targetX = feet.x + (TITLE_FOCUS.x - feet.x) * blend;
      const targetY = feet.y - FOCUS_HEAD_OFFSET + (TITLE_FOCUS.y - (feet.y - FOCUS_HEAD_OFFSET)) * blend;
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
    });
    let portalFrame: PortalFrame;
    if (cinematic) {
      portalFrame = {
        power: this.finale.portalPower,
        ringSpeed: this.finale.ringSpeed,
        assembled: this.finale.merge,
        sockets: this.finale.fragmentFlight.map((progress) => (progress >= 1 ? 1 : 0)),
      };
      this.world.showFlight(this.finale.fragmentFlight, feet.x, feet.y - 24);
    } else {
      portalFrame = PortalView.emptyFrame(title ? 1 : this.sim.fragmentCount);
      this.world.showFlight([0, 0, 0], feet.x, feet.y);
    }
    this.world.update(dt, this.sim, this.rig, interaction, portalFrame, phase === GamePhase.Playing);

    const portalDistance = Math.hypot(feet.x - LEVEL_1.portal.x, feet.y - LEVEL_1.portal.y);
    const proximity = title ? 0.5 : cinematic ? 1 : clamp(1 - portalDistance / PORTAL_HEARING_DISTANCE, 0, 1);
    this.audio.setPortalProximity(proximity);

    const focusTimeline = this.sim.timeline;
    const focusY = title ? STAND_Y - 40 - this.rig.scrollOf(Timeline.Dawn).y : feet.y - 24 - this.rig.scrollOf(focusTimeline).y;
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
