import { describe, expect, it } from 'vitest';
import {
  CompleteOption,
  continueLabel,
  createCompleteMenu,
  createPauseMenu,
  createTitleMenu,
  createVictoryMenu,
  formatDuration,
  Menu,
  PauseOption,
  soundLabel,
  TitleOption,
  VictoryOption,
} from '../src/ui/Menu';

describe('Menu', () => {
  it('wraps the selection in both directions', () => {
    const menu = createVictoryMenu(true);
    expect(menu.selected).toBe(VictoryOption.Atlas);
    menu.move(-1);
    expect(menu.selected).toBe(VictoryOption.Title);
    menu.move(1);
    expect(menu.selected).toBe(VictoryOption.Atlas);
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
    expect(menu.select(4)).toBe(true);
    expect(menu.selected).toBe(PauseOption.Sound);
    expect(menu.select(6)).toBe(false);
    expect(menu.select(-1)).toBe(false);
    expect(menu.select(1.5)).toBe(false);
    expect(menu.selected).toBe(PauseOption.Sound);
  });

  it('offers the atlas from the pause menu', () => {
    expect(createPauseMenu(false).items.map((item) => item.id)).toEqual([
      PauseOption.Resume,
      PauseOption.RestartCheckpoint,
      PauseOption.RestartLevel,
      PauseOption.Atlas,
      PauseOption.Sound,
      PauseOption.Title,
    ]);
  });

  it('leads the title menu with the journey and labels a fresh start', () => {
    expect(createTitleMenu(1, true).items[0]?.label).toBe('Begin the Journey');
    const menu = createTitleMenu(37, false);
    expect(menu.selected).toBe(TitleOption.Continue);
    expect(menu.items[0]?.label).toBe(continueLabel(37, false));
    expect(menu.items[0]?.label).toBe('Continue · Echo 37');
    expect(menu.items.map((item) => item.id)).toEqual([TitleOption.Continue, TitleOption.Atlas]);
  });

  it('only offers the next echo when there is one', () => {
    expect(createCompleteMenu(true).items.map((item) => item.id)).toEqual([CompleteOption.Continue, CompleteOption.Replay, CompleteOption.Atlas]);
    expect(createCompleteMenu(false).items.map((item) => item.id)).toEqual([CompleteOption.Replay, CompleteOption.Atlas]);
  });

  it('leads a chapter victory into the next chapter and the final one back home', () => {
    expect(createVictoryMenu(false).items.map((item) => item.id)).toEqual([VictoryOption.Continue, VictoryOption.Atlas]);
    expect(createVictoryMenu(true).items.map((item) => item.id)).toEqual([VictoryOption.Atlas, VictoryOption.Title]);
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
