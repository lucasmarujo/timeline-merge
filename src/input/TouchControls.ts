import type Phaser from 'phaser';
import type { Timeline } from '../core/enums';
import { Action, type InputController } from './InputController';
import { InputMode } from './inputMode';
import {
  ACTION_BUTTONS,
  computeTouchLayout,
  hitActionButton,
  knobTravel,
  padAxis,
  TOUCH_METRICS,
  TouchButton,
  type ActionButton,
  type Box,
  type Circle,
  type TouchLayout,
} from './touchLayout';

export enum InteractCue {
  None = 'none',
  Ready = 'ready',
  Muted = 'muted',
}

export interface TouchFrame {
  visible: boolean;
  timeline: Timeline;
  shiftBlocked: boolean;
  interact: InteractCue;
  enabled: ReadonlySet<ActionButton>;
}

interface ActionPointer {
  current: ActionButton | null;
  holdsJump: boolean;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => void;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
}

interface LockableOrientation {
  type: string;
  lock?: (orientation: string) => Promise<void>;
}

const BUTTON_ACTIONS: Readonly<Record<ActionButton, Action>> = {
  [TouchButton.Jump]: Action.Jump,
  [TouchButton.Shift]: Action.Shift,
  [TouchButton.Interact]: Action.Interact,
  [TouchButton.Dash]: Action.Dash,
};

const BUTTON_LABELS: Readonly<Record<TouchButton, string>> = {
  [TouchButton.Jump]: 'Jump',
  [TouchButton.Shift]: 'Shift',
  [TouchButton.Interact]: 'Use',
  [TouchButton.Dash]: 'Dash',
  [TouchButton.Pause]: 'Pause',
};

const BUTTON_ICONS: Readonly<Record<TouchButton, string>> = {
  [TouchButton.Jump]: '<path d="M5 13l7-7 7 7"/><path d="M5 19l7-7 7 7" opacity=".45"/>',
  [TouchButton.Shift]: '<path d="M12 2v20"/><path d="M12 7l4.5 5-4.5 5-4.5-5z"/>',
  [TouchButton.Interact]: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/>',
  [TouchButton.Dash]: '<path d="M3 12h10M5 7h6M5 17h6"/><path d="M14 6l6 6-6 6"/>',
  [TouchButton.Pause]: '<path d="M9 6v12M15 6v12"/>',
};

const ARROW_ICON = '<path d="M15 5l-7 7 7 7"/>';

function svg(paths: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

function place(element: HTMLElement, box: Box): void {
  element.style.left = `${box.x}px`;
  element.style.top = `${box.y}px`;
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;
}

function placeCircle(element: HTMLElement, circle: Circle): void {
  place(element, { x: circle.x - circle.radius, y: circle.y - circle.radius, width: circle.radius * 2, height: circle.radius * 2 });
}

function insetOf(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class TouchControls {
  private readonly root: HTMLDivElement;
  private readonly padZone: HTMLDivElement;
  private readonly actionZone: HTMLDivElement;
  private readonly pad: HTMLDivElement;
  private readonly knob: HTMLSpanElement;
  private readonly buttons: Record<TouchButton, HTMLDivElement>;
  private readonly actionPointers = new Map<number, ActionPointer>();
  private active = new Set<Action>();
  private movePointer: number | null = null;
  private moveAxis = 0;
  private layout: TouchLayout | null = null;
  private appliedMode: InputMode | null = null;
  private insetsApplied = false;
  private layoutQueued = false;
  private visible = false;
  private enabled: ReadonlySet<ActionButton> = new Set(ACTION_BUTTONS);
  private enabledApplied = false;

  constructor(
    private readonly controls: InputController,
    private readonly scale: Phaser.Scale.ScaleManager,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    this.root.setAttribute('aria-hidden', 'true');

    this.padZone = this.div('touch-zone touch-zone--move');
    this.actionZone = this.div('touch-zone touch-zone--actions');
    this.pad = this.div('touch-pad');
    this.pad.innerHTML = `<span class="touch-pad__arrow touch-pad__arrow--left">${svg(ARROW_ICON)}</span><span class="touch-pad__arrow touch-pad__arrow--right">${svg(ARROW_ICON)}</span>`;
    this.knob = document.createElement('span');
    this.knob.className = 'touch-pad__knob';
    this.pad.append(this.knob);

    this.buttons = {
      [TouchButton.Jump]: this.button(TouchButton.Jump),
      [TouchButton.Shift]: this.button(TouchButton.Shift),
      [TouchButton.Interact]: this.button(TouchButton.Interact),
      [TouchButton.Dash]: this.button(TouchButton.Dash),
      [TouchButton.Pause]: this.button(TouchButton.Pause),
    };
    this.root.append(this.pad, ...ACTION_BUTTONS.map((button) => this.buttons[button]), this.padZone, this.actionZone, this.buttons[TouchButton.Pause]);
    document.body.append(this.root);

    this.padZone.addEventListener('pointerdown', this.onPadDown);
    this.actionZone.addEventListener('pointerdown', this.onActionDown);
    this.buttons[TouchButton.Pause].addEventListener('pointerdown', this.onPauseDown);
    this.root.addEventListener('touchstart', this.preventDefault, { passive: false });
    this.root.addEventListener('contextmenu', this.preventDefault);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    window.addEventListener('resize', this.queueLayout);
    window.visualViewport?.addEventListener('resize', this.queueLayout);
    document.addEventListener('gesturestart', this.preventDefault);
  }

  sync(frame: TouchFrame): void {
    const mode = this.controls.mode;
    if (mode !== this.appliedMode) {
      this.appliedMode = mode;
      this.applyLayout();
    }
    const visible = frame.visible && mode === InputMode.Touch;
    if (visible !== this.visible) {
      this.visible = visible;
      this.root.toggleAttribute('data-visible', visible);
      if (!visible) this.releaseAll();
    }
    if (!visible) return;
    this.applyEnabled(frame.enabled);
    if (this.root.dataset.timeline !== frame.timeline) this.root.dataset.timeline = frame.timeline;
    this.buttons[TouchButton.Shift].classList.toggle('is-blocked', frame.shiftBlocked);
    const interact = this.buttons[TouchButton.Interact];
    if (interact.dataset.cue !== frame.interact) interact.dataset.cue = frame.interact;
  }

  private applyEnabled(enabled: ReadonlySet<ActionButton>): void {
    let changed = !this.enabledApplied;
    for (const button of ACTION_BUTTONS) {
      const on = enabled.has(button);
      const was = this.enabled.has(button);
      if (this.enabledApplied && on === was) continue;
      changed = true;
      const element = this.buttons[button];
      element.classList.toggle('is-locked', !on);
      if (on && !was && this.enabledApplied) {
        element.classList.add('is-new');
        window.setTimeout(() => element.classList.remove('is-new'), 2600);
      }
    }
    if (!changed) return;
    this.enabled = new Set(enabled);
    this.enabledApplied = true;
  }

  releaseAll(): void {
    this.movePointer = null;
    this.moveAxis = 0;
    this.actionPointers.clear();
    this.knob.style.transform = '';
    this.refresh();
  }

  enterFullscreen(): void {
    if (this.controls.mode !== InputMode.Touch) return;
    const fullscreenDocument = document as FullscreenDocument;
    if (fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement) return;
    const element = document.documentElement as FullscreenElement;
    try {
      if (typeof element.requestFullscreen === 'function') {
        element
          .requestFullscreen({ navigationUI: 'hide' })
          .then(() => this.lockLandscape())
          .catch(() => undefined);
      } else {
        element.webkitRequestFullscreen?.();
      }
    } catch (error) {
      console.warn('[Timeline Merge] Fullscreen is unavailable:', error);
    }
  }

  dispose(): void {
    this.releaseAll();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    window.removeEventListener('resize', this.queueLayout);
    window.visualViewport?.removeEventListener('resize', this.queueLayout);
    document.removeEventListener('gesturestart', this.preventDefault);
    this.resetGameInsets();
    this.root.remove();
  }

  private div(className: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = className;
    return element;
  }

  private button(button: TouchButton): HTMLDivElement {
    const element = this.div(`touch-button touch-button--${button}`);
    const label = button === TouchButton.Pause ? '' : `<span class="touch-button__label">${BUTTON_LABELS[button]}</span>`;
    element.innerHTML = `${svg(BUTTON_ICONS[button])}${label}`;
    return element;
  }

  private readonly preventDefault = (event: Event): void => {
    if (event.cancelable) event.preventDefault();
  };

  private readonly onPadDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.movePointer = event.pointerId;
    this.updateMove(event.clientX);
  };

  private readonly onActionDown = (event: PointerEvent): void => {
    event.preventDefault();
    const pointer: ActionPointer = { current: null, holdsJump: false };
    this.actionPointers.set(event.pointerId, pointer);
    this.track(pointer, event.clientX, event.clientY);
  };

  private readonly onPauseDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.controls.pressVirtual(Action.Pause);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointer) this.updateMove(event.clientX);
    const pointer = this.actionPointers.get(event.pointerId);
    if (pointer) this.track(pointer, event.clientX, event.clientY);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointer) {
      this.movePointer = null;
      this.knob.style.transform = '';
      this.moveAxis = 0;
      this.refresh();
    }
    if (this.actionPointers.delete(event.pointerId)) this.refresh();
  };

  private readonly queueLayout = (): void => {
    if (this.layoutQueued || this.appliedMode !== InputMode.Touch) return;
    this.layoutQueued = true;
    window.requestAnimationFrame(() => {
      this.layoutQueued = false;
      if (this.appliedMode === InputMode.Touch) this.applyLayout();
    });
  };

  private updateMove(x: number): void {
    const layout = this.layout;
    if (!layout) return;
    this.moveAxis = padAxis(layout, x);
    this.knob.style.transform = `translateX(${knobTravel(layout, x).toFixed(1)}px)`;
    this.refresh();
  }

  private track(pointer: ActionPointer, x: number, y: number): void {
    const layout = this.layout;
    if (!layout) return;
    const hit = hitActionButton(layout, x, y, this.enabled);
    if (hit === pointer.current) return;
    pointer.current = hit;
    if (hit === TouchButton.Jump) pointer.holdsJump = true;
    this.refresh();
  }

  private refresh(): void {
    const desired = new Set<Action>();
    if (this.moveAxis < 0) desired.add(Action.Left);
    if (this.moveAxis > 0) desired.add(Action.Right);
    for (const pointer of this.actionPointers.values()) {
      if (pointer.current) desired.add(BUTTON_ACTIONS[pointer.current]);
      if (pointer.holdsJump) desired.add(Action.Jump);
    }
    for (const action of this.active) {
      if (!desired.has(action)) this.controls.releaseVirtual(action);
    }
    for (const action of desired) {
      if (!this.active.has(action)) this.controls.holdVirtual(action);
    }
    this.active = desired;
    for (const button of ACTION_BUTTONS) {
      this.buttons[button].classList.toggle('is-pressed', desired.has(BUTTON_ACTIONS[button]));
    }
    const axis = String(this.moveAxis);
    if (this.pad.dataset.axis !== axis) this.pad.dataset.axis = axis;
  }

  private applyLayout(): void {
    if (this.appliedMode !== InputMode.Touch) {
      this.layout = null;
      this.resetGameInsets();
      return;
    }
    const bounds = this.root.getBoundingClientRect();
    const style = window.getComputedStyle(this.root);
    const layout = computeTouchLayout({
      width: bounds.width,
      height: bounds.height,
      safe: {
        top: insetOf(style.paddingTop),
        right: insetOf(style.paddingRight),
        bottom: insetOf(style.paddingBottom),
        left: insetOf(style.paddingLeft),
      },
    });
    this.layout = layout;
    this.root.style.setProperty('--unit', layout.unit.toFixed(3));
    place(this.padZone, layout.padZone);
    place(this.actionZone, layout.actionZone);
    place(this.pad, layout.pad);
    const knobRadius = layout.pad.height * TOUCH_METRICS.knobRatio;
    place(this.knob, { x: layout.pad.width / 2 - knobRadius, y: layout.pad.height / 2 - knobRadius, width: knobRadius * 2, height: knobRadius * 2 });
    for (const button of Object.values(TouchButton)) {
      placeCircle(this.buttons[button], layout.buttons[button]);
    }
    const host = this.scale.parent as HTMLElement | null;
    if (host) {
      host.style.top = `${layout.gameInsets.top}px`;
      host.style.bottom = `${layout.gameInsets.bottom}px`;
      this.insetsApplied = true;
      this.scale.refresh();
    }
  }

  private resetGameInsets(): void {
    if (!this.insetsApplied) return;
    const host = this.scale.parent as HTMLElement | null;
    if (host) {
      host.style.top = '';
      host.style.bottom = '';
    }
    this.insetsApplied = false;
    this.scale.refresh();
  }

  private lockLandscape(): void {
    const orientation = screen.orientation as unknown as LockableOrientation | undefined;
    if (!orientation?.lock || !orientation.type.startsWith('landscape')) return;
    orientation.lock('landscape').catch(() => undefined);
  }
}
