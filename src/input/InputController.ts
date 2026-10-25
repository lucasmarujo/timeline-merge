import Phaser from 'phaser';
import { InputMode } from './inputMode';
import { VirtualButtons } from './VirtualButtons';

export enum Action {
  Left = 'left',
  Right = 'right',
  Jump = 'jump',
  Shift = 'shift',
  Interact = 'interact',
  Restart = 'restart',
  Pause = 'pause',
  Mute = 'mute',
  Confirm = 'confirm',
  MenuUp = 'menuUp',
  MenuDown = 'menuDown',
}

const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

const BINDINGS: Readonly<Record<Action, readonly number[]>> = {
  [Action.Left]: [KeyCodes.A, KeyCodes.LEFT],
  [Action.Right]: [KeyCodes.D, KeyCodes.RIGHT],
  [Action.Jump]: [KeyCodes.W, KeyCodes.UP, KeyCodes.SPACE],
  [Action.Shift]: [KeyCodes.TAB],
  [Action.Interact]: [KeyCodes.E],
  [Action.Restart]: [KeyCodes.R],
  [Action.Pause]: [KeyCodes.ESC],
  [Action.Mute]: [KeyCodes.M],
  [Action.Confirm]: [KeyCodes.ENTER, KeyCodes.SPACE],
  [Action.MenuUp]: [KeyCodes.W, KeyCodes.UP],
  [Action.MenuDown]: [KeyCodes.S, KeyCodes.DOWN],
};

export class InputController {
  private readonly keys = new Map<number, Phaser.Input.Keyboard.Key>();
  private readonly pressed = new Set<number>();
  private readonly virtual = new VirtualButtons<Action>();

  constructor(
    private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    private currentMode: InputMode,
  ) {
    for (const codes of Object.values(BINDINGS)) {
      for (const code of codes) {
        if (!this.keys.has(code)) {
          const key = keyboard.addKey(code, true, false);
          key.on(Phaser.Input.Keyboard.Events.DOWN, () => {
            this.pressed.add(code);
            this.currentMode = InputMode.Keyboard;
          });
          this.keys.set(code, key);
        }
      }
    }
  }

  get mode(): InputMode {
    return this.currentMode;
  }

  isDown(action: Action): boolean {
    return this.virtual.isDown(action) || BINDINGS[action].some((code) => this.keys.get(code)?.isDown === true);
  }

  axisX(): number {
    return (this.isDown(Action.Right) ? 1 : 0) - (this.isDown(Action.Left) ? 1 : 0);
  }

  consume(action: Action): boolean {
    let pressed = this.virtual.consume(action);
    for (const code of BINDINGS[action]) {
      if (this.pressed.delete(code)) {
        pressed = true;
      }
    }
    return pressed;
  }

  useTouch(): void {
    this.currentMode = InputMode.Touch;
  }

  pressVirtual(action: Action): void {
    this.virtual.press(action);
    this.useTouch();
  }

  holdVirtual(action: Action): void {
    this.virtual.hold(action);
    this.useTouch();
  }

  releaseVirtual(action: Action): void {
    this.virtual.release(action);
  }

  flush(): void {
    this.pressed.clear();
    this.virtual.flush();
  }

  releaseAll(): void {
    this.keyboard.resetKeys();
    this.pressed.clear();
    this.virtual.clear();
  }
}
