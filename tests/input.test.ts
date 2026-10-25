import { describe, expect, it } from 'vitest';
import { COARSE_POINTER_QUERY, detectInputMode, InputMode } from '../src/input/inputMode';
import { VirtualButtons } from '../src/input/VirtualButtons';

enum Button {
  Jump = 'jump',
  Shift = 'shift',
}

describe('detectInputMode', () => {
  it('starts in touch mode when the primary pointer is a finger', () => {
    const queries: string[] = [];
    const mode = detectInputMode((query) => {
      queries.push(query);
      return query === COARSE_POINTER_QUERY;
    });
    expect(mode).toBe(InputMode.Touch);
    expect(queries).toEqual([COARSE_POINTER_QUERY]);
  });

  it('keeps desktops with a mouse in keyboard mode', () => {
    expect(detectInputMode(() => false)).toBe(InputMode.Keyboard);
  });
});

describe('VirtualButtons', () => {
  it('registers one press per hold and stays down until released', () => {
    const buttons = new VirtualButtons<Button>();
    buttons.hold(Button.Jump);
    buttons.hold(Button.Jump);
    expect(buttons.isDown(Button.Jump)).toBe(true);
    expect(buttons.consume(Button.Jump)).toBe(true);
    expect(buttons.consume(Button.Jump)).toBe(false);
    buttons.release(Button.Jump);
    expect(buttons.isDown(Button.Jump)).toBe(false);
  });

  it('keeps a press that was released before the frame consumed it', () => {
    const buttons = new VirtualButtons<Button>();
    buttons.hold(Button.Shift);
    buttons.release(Button.Shift);
    expect(buttons.isDown(Button.Shift)).toBe(false);
    expect(buttons.consume(Button.Shift)).toBe(true);
  });

  it('presses again after a release and a new hold', () => {
    const buttons = new VirtualButtons<Button>();
    buttons.hold(Button.Shift);
    buttons.flush();
    buttons.release(Button.Shift);
    buttons.hold(Button.Shift);
    expect(buttons.consume(Button.Shift)).toBe(true);
  });

  it('drops unconsumed presses on flush but keeps held buttons', () => {
    const buttons = new VirtualButtons<Button>();
    buttons.hold(Button.Jump);
    buttons.press(Button.Shift);
    buttons.flush();
    expect(buttons.consume(Button.Jump)).toBe(false);
    expect(buttons.consume(Button.Shift)).toBe(false);
    expect(buttons.isDown(Button.Jump)).toBe(true);
  });

  it('forgets everything on clear', () => {
    const buttons = new VirtualButtons<Button>();
    buttons.hold(Button.Jump);
    buttons.press(Button.Shift);
    buttons.clear();
    expect(buttons.isDown(Button.Jump)).toBe(false);
    expect(buttons.consume(Button.Jump)).toBe(false);
    expect(buttons.consume(Button.Shift)).toBe(false);
  });
});
