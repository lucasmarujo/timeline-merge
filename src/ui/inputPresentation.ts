import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { InputMode } from '../input/inputMode';
import type { PromptStyle } from '../render/InteractionPrompt';

export interface ControlLegend {
  key: string;
  label: string;
}

export interface InputCopy {
  titlePrompt: string;
  titleFooter: string;
  introControls: readonly ControlLegend[];
  introTip: string | null;
  pauseHelp: string;
  soundOff: string;
}

export interface TextSlot {
  y: number;
  size: number;
  wrap: number | null;
}

export interface IntroLayout {
  band: number;
  bandAtTop: boolean;
  headingY: number;
  headingSize: number;
  wrap: number | null;
  capsY: number;
  labelY: number;
  tipY: number;
  tipSize: number;
}

export interface MenuLayout {
  titleY: number;
  firstY: number;
  spacing: number;
  size: number;
  helpY: number;
}

export interface VictoryLayout {
  statsSize: number;
  firstY: number;
  spacing: number;
  size: number;
}

export interface CornerLayout {
  x: number;
  y: number;
  originX: number;
  originY: number;
}

export interface UiLayout {
  titlePromptSize: number;
  footerSize: number;
  hint: TextSlot;
  hintBand: number;
  message: TextSlot;
  intro: IntroLayout;
  pause: MenuLayout;
  victory: VictoryLayout;
  sound: CornerLayout;
}

export const MENU_HIT_WIDTH = 640;

export const INTRO_HEADING = 'You exist as an echo in two worlds. Only one of them can hold you at a time.';

export const INPUT_COPY: Readonly<Record<InputMode, InputCopy>> = {
  [InputMode.Keyboard]: {
    titlePrompt: 'PRESS  ENTER  TO  BEGIN',
    titleFooter: 'A / D move   ·   W jump   ·   Tab shift reality   ·   E interact   ·   Esc pause   ·   M sound',
    introControls: [
      { key: 'A  D', label: 'Move' },
      { key: 'W', label: 'Jump' },
      { key: 'Tab', label: 'Shift reality' },
      { key: 'E', label: 'Interact' },
      { key: 'R', label: 'Checkpoint' },
      { key: 'Esc', label: 'Pause' },
      { key: 'M', label: 'Sound' },
    ],
    introTip: null,
    pauseHelp: 'W / S to choose   ·   Enter to confirm   ·   Esc to resume',
    soundOff: 'SOUND OFF  ·  M',
  },
  [InputMode.Touch]: {
    titlePrompt: 'TAP  TO  BEGIN',
    titleFooter: 'Move with the left pad   ·   Jump, Shift and Use with your right thumb',
    introControls: [],
    introTip: 'Hold JUMP to leap higher. SHIFT works even in mid-air.',
    pauseHelp: 'Tap an option',
    soundOff: 'SOUND OFF',
  },
};

export const UI_LAYOUT: Readonly<Record<InputMode, UiLayout>> = {
  [InputMode.Keyboard]: {
    titlePromptSize: 20,
    footerSize: 18,
    hint: { y: GAME_HEIGHT - 52, size: 25, wrap: null },
    hintBand: 120,
    message: { y: GAME_HEIGHT - 104, size: 24, wrap: null },
    intro: { band: 300, bandAtTop: false, headingY: GAME_HEIGHT - 212, headingSize: 22, wrap: null, capsY: GAME_HEIGHT - 168, labelY: GAME_HEIGHT - 138, tipY: GAME_HEIGHT - 138, tipSize: 19 },
    pause: { titleY: 214, firstY: 300, spacing: 46, size: 21, helpY: GAME_HEIGHT - 110 },
    victory: { statsSize: 16, firstY: 420, spacing: 48, size: 22 },
    sound: { x: GAME_WIDTH - 24, y: GAME_HEIGHT - 22, originX: 1, originY: 1 },
  },
  [InputMode.Touch]: {
    titlePromptSize: 26,
    footerSize: 23,
    hint: { y: GAME_HEIGHT - 66, size: 30, wrap: 540 },
    hintBand: 180,
    message: { y: GAME_HEIGHT - 178, size: 28, wrap: 540 },
    intro: { band: 330, bandAtTop: true, headingY: 200, headingSize: 28, wrap: 620, capsY: 252, labelY: 276, tipY: 276, tipSize: 24 },
    pause: { titleY: 116, firstY: 212, spacing: 96, size: 32, helpY: GAME_HEIGHT - 48 },
    victory: { statsSize: 22, firstY: 412, spacing: 96, size: 32 },
    sound: { x: 24, y: 20, originX: 0, originY: 0 },
  },
};

export const PROMPT_STYLES: Readonly<Record<InputMode, PromptStyle>> = {
  [InputMode.Keyboard]: { keys: { interact: 'E', shift: 'Tab' }, scale: 1 },
  [InputMode.Touch]: { keys: { interact: 'USE', shift: 'SHIFT' }, scale: 1.45 },
};
