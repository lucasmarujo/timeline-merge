import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../src/config';
import { InputMode } from '../src/input/inputMode';
import { LEVEL_1 } from '../src/levels/level1';
import { INPUT_COPY, MENU_HIT_WIDTH, PROMPT_STYLES, UI_LAYOUT } from '../src/ui/inputPresentation';

const KEYBOARD_WORDS = /\b(Tab|Esc|Enter|Space|A \/ D|W \/ S|Press)\b|\b[ADEMRSW]\b(?! [a-z])/;
const SMALLEST_PHONE_CANVAS_HEIGHT = 320;
const TYPICAL_PHONE_CANVAS_HEIGHT = 360;
const MIN_TOUCH_TARGET = 44;
const PAUSE_ITEMS = 5;
const VICTORY_ITEMS = 2;

function cssPixels(gamePixels: number, canvasHeight: number): number {
  return (gamePixels * canvasHeight) / GAME_HEIGHT;
}

describe('keyboard presentation', () => {
  it('keeps the desktop layout exactly as it was', () => {
    const layout = UI_LAYOUT[InputMode.Keyboard];
    expect(layout.titlePromptSize).toBe(20);
    expect(layout.footerSize).toBe(18);
    expect(layout.hint).toEqual({ y: GAME_HEIGHT - 52, size: 25, wrap: null });
    expect(layout.hintBand).toBe(120);
    expect(layout.message).toEqual({ y: GAME_HEIGHT - 104, size: 24, wrap: null });
    expect(layout.intro).toMatchObject({ band: 300, bandAtTop: false, headingY: GAME_HEIGHT - 212, headingSize: 22, wrap: null, capsY: GAME_HEIGHT - 168, labelY: GAME_HEIGHT - 138 });
    expect(layout.pause).toEqual({ titleY: 214, firstY: 300, spacing: 46, size: 21, helpY: GAME_HEIGHT - 110 });
    expect(layout.victory).toEqual({ statsSize: 16, firstY: 420, spacing: 48, size: 22 });
    expect(layout.sound).toEqual({ x: GAME_WIDTH - 24, y: GAME_HEIGHT - 22, originX: 1, originY: 1 });
    expect(PROMPT_STYLES[InputMode.Keyboard]).toEqual({ keys: { interact: 'E', shift: 'Tab' }, scale: 1 });
  });

  it('keeps the desktop wording', () => {
    const copy = INPUT_COPY[InputMode.Keyboard];
    expect(copy.titlePrompt).toBe('PRESS  ENTER  TO  BEGIN');
    expect(copy.pauseHelp).toBe('W / S to choose   ·   Enter to confirm   ·   Esc to resume');
    expect(copy.soundOff).toBe('SOUND OFF  ·  M');
    expect(copy.introTip).toBeNull();
    expect(copy.introControls.map((control) => control.key)).toEqual(['A  D', 'W', 'Tab', 'E', 'R', 'Esc', 'M']);
  });
});

describe('touch presentation', () => {
  const copy = INPUT_COPY[InputMode.Touch];
  const layout = UI_LAYOUT[InputMode.Touch];

  it('never asks a touch player to press a keyboard key', () => {
    const texts = [copy.titlePrompt, copy.titleFooter, copy.introTip ?? '', copy.pauseHelp, copy.soundOff, ...copy.introControls.map((control) => control.key)];
    for (const text of texts) {
      expect(text).not.toMatch(KEYBOARD_WORDS);
    }
    expect(PROMPT_STYLES[InputMode.Touch].keys).toEqual({ interact: 'USE', shift: 'SHIFT' });
  });

  it('gives every level hint that names a key a touch alternative', () => {
    for (const hint of LEVEL_1.hints) {
      if (KEYBOARD_WORDS.test(hint.text)) {
        expect(hint.touchText, hint.id).toBeDefined();
      }
      if (hint.touchText) {
        expect(hint.touchText, hint.id).not.toMatch(KEYBOARD_WORDS);
      }
    }
  });

  it('makes menu items large enough to tap on phones', () => {
    for (const spacing of [layout.pause.spacing, layout.victory.spacing]) {
      expect(cssPixels(spacing, TYPICAL_PHONE_CANVAS_HEIGHT)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(cssPixels(spacing, SMALLEST_PHONE_CANVAS_HEIGHT)).toBeGreaterThanOrEqual(40);
    }
    expect(cssPixels(MENU_HIT_WIDTH, SMALLEST_PHONE_CANVAS_HEIGHT)).toBeGreaterThanOrEqual(240);
    expect(layout.pause.size).toBeGreaterThan(UI_LAYOUT[InputMode.Keyboard].pause.size);
  });

  it('fits every menu between its title and its help line', () => {
    const lastPause = layout.pause.firstY + (PAUSE_ITEMS - 1) * layout.pause.spacing;
    expect(layout.pause.firstY - layout.pause.spacing / 2).toBeGreaterThan(layout.pause.titleY);
    expect(lastPause + layout.pause.spacing / 2).toBeLessThan(layout.pause.helpY);
    const lastVictory = layout.victory.firstY + (VICTORY_ITEMS - 1) * layout.victory.spacing;
    expect(lastVictory + layout.victory.spacing / 2).toBeLessThan(GAME_HEIGHT);
  });

  it('enlarges the text that phones would otherwise render too small', () => {
    const keyboard = UI_LAYOUT[InputMode.Keyboard];
    expect(layout.hint.size).toBeGreaterThan(keyboard.hint.size);
    expect(layout.message.size).toBeGreaterThan(keyboard.message.size);
    expect(layout.footerSize).toBeGreaterThan(keyboard.footerSize);
    expect(layout.victory.statsSize).toBeGreaterThan(keyboard.victory.statsSize);
    expect(PROMPT_STYLES[InputMode.Touch].scale).toBeGreaterThan(1);
    expect(cssPixels(layout.hint.size, TYPICAL_PHONE_CANVAS_HEIGHT)).toBeGreaterThanOrEqual(14);
  });

  it('wraps bottom text so it stays between the thumbs', () => {
    expect(layout.hint.wrap).not.toBeNull();
    expect(layout.message.wrap).not.toBeNull();
    expect(layout.hint.wrap as number).toBeLessThanOrEqual(GAME_WIDTH / 2);
  });
});
