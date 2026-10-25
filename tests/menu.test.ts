import { describe, expect, it } from 'vitest';
import { createPauseMenu, createVictoryMenu, formatDuration, Menu, PauseOption, soundLabel, VictoryOption } from '../src/ui/Menu';

describe('Menu', () => {
  it('wraps the selection in both directions', () => {
    const menu = createVictoryMenu();
    expect(menu.selected).toBe(VictoryOption.PlayAgain);
    menu.move(-1);
    expect(menu.selected).toBe(VictoryOption.Title);
    menu.move(1);
    expect(menu.selected).toBe(VictoryOption.PlayAgain);
    menu.move(5);
    expect(menu.selected).toBe(VictoryOption.Title);
  });

  it('relabels the sound toggle and resets the cursor', () => {
    const menu = createPauseMenu(false);
    expect(menu.items.find((item) => item.id === PauseOption.Sound)?.label).toBe('Sound: On');
    menu.relabel(PauseOption.Sound, soundLabel(true));
    expect(menu.items.find((item) => item.id === PauseOption.Sound)?.label).toBe('Sound: Off');
    menu.move(3);
    menu.reset();
    expect(menu.selected).toBe(PauseOption.Resume);
  });

  it('selects a tapped item and ignores taps outside the list', () => {
    const menu = createPauseMenu(false);
    expect(menu.select(3)).toBe(true);
    expect(menu.selected).toBe(PauseOption.Sound);
    expect(menu.select(5)).toBe(false);
    expect(menu.select(-1)).toBe(false);
    expect(menu.select(1.5)).toBe(false);
    expect(menu.selected).toBe(PauseOption.Sound);
  });

  it('refuses to exist without items', () => {
    expect(() => new Menu([])).toThrow();
  });
});

describe('formatDuration', () => {
  it('formats elapsed seconds as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65.9)).toBe('01:05');
    expect(formatDuration(-3)).toBe('00:00');
  });
});
