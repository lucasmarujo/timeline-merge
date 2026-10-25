import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../src/config';
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
  type Insets,
  type TouchLayout,
} from '../src/input/touchLayout';

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const MIN_TOUCH_TARGET = 44;

function layoutFor(width: number, height: number, safe: Insets = NO_INSETS): TouchLayout {
  return computeTouchLayout({ width, height, safe });
}

function circleBox(circle: Circle): Box {
  return { x: circle.x - circle.radius, y: circle.y - circle.radius, width: circle.radius * 2, height: circle.radius * 2 };
}

function lowerControls(layout: TouchLayout): Box[] {
  return [layout.pad, circleBox(layout.buttons[TouchButton.Jump]), circleBox(layout.buttons[TouchButton.Shift])];
}

function contains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6 && inner.x + inner.width <= outer.x + outer.width + 1e-6 && inner.y + inner.height <= outer.y + outer.height + 1e-6;
}

const PHONES: ReadonlyArray<[string, number, number]> = [
  ['iPhone SE (1st gen)', 568, 320],
  ['iPhone SE (3rd gen)', 667, 375],
  ['iPhone 15 in Safari', 734, 343],
  ['Pixel 7', 863, 360],
  ['Galaxy S24', 780, 360],
];

const TABLETS: ReadonlyArray<[string, number, number]> = [
  ['iPad Mini', 1024, 768],
  ['iPad Pro 11', 1194, 834],
  ['Galaxy Tab S9', 1024, 640],
];

describe('computeTouchLayout', () => {
  it.each([...PHONES, ...TABLETS])('keeps every control on screen and comfortably sized on %s', (_, width, height) => {
    const layout = layoutFor(width, height);
    const screen: Box = { x: 0, y: 0, width, height };
    for (const button of Object.values(TouchButton)) {
      const circle = layout.buttons[button];
      expect(contains(screen, circleBox(circle))).toBe(true);
      expect(circle.radius * 2).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
    expect(contains(screen, layout.pad)).toBe(true);
    expect(layout.pad.width).toBeGreaterThanOrEqual(150);
  });

  it.each([...PHONES, ...TABLETS])('never lets the controls overlap each other on %s', (_, width, height) => {
    const layout = layoutFor(width, height);
    const circles = Object.values(TouchButton).map((button) => layout.buttons[button]);
    for (let a = 0; a < circles.length; a++) {
      for (let b = a + 1; b < circles.length; b++) {
        const first = circles[a] as Circle;
        const second = circles[b] as Circle;
        expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(first.radius + second.radius);
      }
    }
    const padRight = layout.pad.x + layout.pad.width;
    const shift = layout.buttons[TouchButton.Shift];
    expect(padRight).toBeLessThan(shift.x - shift.radius);
  });

  it.each(PHONES)('keeps the whole canvas on wide phones such as %s', (_, width, height) => {
    const { gameInsets } = layoutFor(width, height);
    expect(gameInsets.top).toBe(0);
    expect(gameInsets.bottom).toBeLessThan(1);
  });

  it.each(TABLETS)('keeps the canvas at full size while making room for the controls on %s', (_, width, height) => {
    const layout = layoutFor(width, height);
    const canvasHeight = GAME_HEIGHT * Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    expect(layout.gameInsets.top + layout.gameInsets.bottom).toBeCloseTo(height - canvasHeight, 6);
    expect(layout.gameInsets.bottom).toBeGreaterThan(layout.gameInsets.top);
  });

  it.each(TABLETS.slice(0, 2))('places the lower controls entirely below the canvas on %s', (_, width, height) => {
    const layout = layoutFor(width, height);
    const canvasBottom = height - layout.gameInsets.bottom;
    for (const control of lowerControls(layout)) {
      expect(control.y).toBeGreaterThanOrEqual(canvasBottom - 1e-6);
    }
  });

  it('gives all the spare height to the controls on a 16:10 tablet', () => {
    const layout = layoutFor(1024, 640);
    expect(layout.gameInsets.top).toBe(0);
    expect(layout.gameInsets.bottom).toBeCloseTo(640 - (1024 / GAME_WIDTH) * GAME_HEIGHT, 6);
  });

  it('reserves only the band the controls need on a portrait tablet', () => {
    const layout = layoutFor(768, 1024);
    const canvasHeight = (768 / GAME_WIDTH) * GAME_HEIGHT;
    const band = layout.gameInsets.bottom - layout.gameInsets.top;
    expect(layout.gameInsets.top).toBeGreaterThan(0);
    expect(band).toBeCloseTo(TOUCH_METRICS.margin * layout.unit * 2 + TOUCH_METRICS.jumpRadius * layout.unit * 2, 6);
    expect(1024 - layout.gameInsets.top - layout.gameInsets.bottom).toBeCloseTo(canvasHeight, 6);
  });

  it('respects the safe areas around notches and home indicators', () => {
    const safe: Insets = { top: 0, right: 59, bottom: 21, left: 59 };
    const plain = layoutFor(734, 343);
    const notched = layoutFor(734, 343, safe);
    expect(notched.pad.x).toBeCloseTo(plain.pad.x + safe.left, 6);
    for (const button of [TouchButton.Jump, TouchButton.Pause]) {
      const circle = notched.buttons[button];
      expect(circle.x + circle.radius).toBeLessThanOrEqual(734 - safe.right);
    }
    const jump = notched.buttons[TouchButton.Jump];
    expect(jump.y + jump.radius).toBeLessThanOrEqual(343 - safe.bottom);
  });

  it('scales the controls with the screen within bounds', () => {
    expect(layoutFor(568, 320).unit).toBe(TOUCH_METRICS.minUnit);
    expect(layoutFor(1366, 1024).unit).toBe(TOUCH_METRICS.maxUnit);
    expect(layoutFor(863, 360).unit).toBeCloseTo(360 / TOUCH_METRICS.referenceSide, 6);
  });

  it('confines the capture zones to their side of the screen', () => {
    const layout = layoutFor(863, 360);
    expect(layout.padZone.x + layout.padZone.width).toBeLessThanOrEqual(863 / 2);
    expect(contains(layout.padZone, layout.pad)).toBe(true);
    for (const button of ACTION_BUTTONS) {
      const circle = layout.buttons[button];
      expect(contains(layout.actionZone, { x: circle.x - circle.radius, y: circle.y - circle.radius, width: circle.radius * 2, height: circle.radius * 2 })).toBe(true);
    }
  });
});

describe('pad input', () => {
  const layout = layoutFor(863, 360);
  const centerX = layout.pad.x + layout.pad.width / 2;
  const deadZone = TOUCH_METRICS.deadZone * layout.unit;

  it('ignores a thumb resting on the center of the pad', () => {
    expect(padAxis(layout, centerX)).toBe(0);
    expect(padAxis(layout, centerX + deadZone)).toBe(0);
    expect(padAxis(layout, centerX - deadZone)).toBe(0);
  });

  it('moves toward the side the thumb leans to, even beyond the pad', () => {
    expect(padAxis(layout, centerX + deadZone + 1)).toBe(1);
    expect(padAxis(layout, centerX - deadZone - 1)).toBe(-1);
    expect(padAxis(layout, centerX + 400)).toBe(1);
    expect(padAxis(layout, -50)).toBe(-1);
  });

  it('keeps the knob inside the pad', () => {
    const limit = knobTravel(layout, centerX + 1000);
    expect(limit).toBeGreaterThan(0);
    expect(knobTravel(layout, centerX - 1000)).toBe(-limit);
    expect(limit + layout.pad.height * TOUCH_METRICS.knobRatio).toBeLessThan(layout.pad.width / 2);
    expect(knobTravel(layout, centerX + 5)).toBeCloseTo(5, 6);
  });
});

describe('hitActionButton', () => {
  const layout = layoutFor(863, 360);

  it('finds the button under the thumb', () => {
    for (const button of ACTION_BUTTONS) {
      const circle = layout.buttons[button];
      expect(hitActionButton(layout, circle.x, circle.y)).toBe(button);
      expect(hitActionButton(layout, circle.x + circle.radius * 1.1, circle.y)).not.toBeNull();
    }
  });

  it('chooses the nearest button when a thumb slides between two of them', () => {
    const jump = layout.buttons[TouchButton.Jump];
    const shift = layout.buttons[TouchButton.Shift];
    expect(hitActionButton(layout, jump.x - jump.radius * 0.9, jump.y)).toBe(TouchButton.Jump);
    expect(hitActionButton(layout, shift.x + shift.radius * 0.9, shift.y)).toBe(TouchButton.Shift);
  });

  it('ignores buttons for abilities that have not awakened yet', () => {
    const dash = layout.buttons[TouchButton.Dash];
    const shift = layout.buttons[TouchButton.Shift];
    const jumpOnly = new Set<ActionButton>([TouchButton.Jump]);
    expect(hitActionButton(layout, dash.x, dash.y, jumpOnly)).toBeNull();
    expect(hitActionButton(layout, shift.x, shift.y, jumpOnly)).toBeNull();
    expect(hitActionButton(layout, layout.buttons[TouchButton.Jump].x, layout.buttons[TouchButton.Jump].y, jumpOnly)).toBe(TouchButton.Jump);
    expect(hitActionButton(layout, dash.x, dash.y)).toBe(TouchButton.Dash);
  });

  it('ignores touches away from every button', () => {
    expect(hitActionButton(layout, 10, 10)).toBeNull();
    expect(hitActionButton(layout, layout.pad.x, layout.pad.y)).toBeNull();
  });
});
