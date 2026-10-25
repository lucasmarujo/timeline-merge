import { describe, expect, it } from 'vitest';
import { FIXED_DT, MOVEMENT, PLAYER_SIZE } from '../src/core/constants';
import { createBody, isSupported, stepBody, type Body, type MoveIntent } from '../src/core/physics';
import type { Rect } from '../src/core/types';

const FLOOR: Rect = { x: -1000, y: 500, w: 3000, h: 40 };

function intent(overrides: Partial<MoveIntent> = {}): MoveIntent {
  return { moveX: 0, jumpPressed: false, jumpHeld: false, ...overrides };
}

function simulate(body: Body, solids: Rect[], seconds: number, input: Partial<MoveIntent> = {}): void {
  const steps = Math.round(seconds / FIXED_DT);
  for (let index = 0; index < steps; index++) {
    stepBody(body, intent(input), solids, FIXED_DT);
  }
}

function groundedBody(x = 100): Body {
  const body = createBody(x, 500);
  simulate(body, [FLOOR], 0.1);
  return body;
}

function measureApex(holdSeconds: number): number {
  const body = groundedBody();
  const startFeet = body.y + PLAYER_SIZE.height;
  let highest = startFeet;
  const steps = Math.round(1.2 / FIXED_DT);
  for (let index = 0; index < steps; index++) {
    const elapsed = index * FIXED_DT;
    stepBody(body, intent({ jumpPressed: index === 0, jumpHeld: elapsed < holdSeconds }), [FLOOR], FIXED_DT);
    highest = Math.min(highest, body.y + PLAYER_SIZE.height);
  }
  return startFeet - highest;
}

describe('stepBody', () => {
  it('falls under gravity and lands exactly on top of a floor', () => {
    const body = createBody(100, 300);
    let landings = 0;
    for (let index = 0; index < 240; index++) {
      if (stepBody(body, intent(), [FLOOR], FIXED_DT).landed) landings += 1;
    }
    expect(body.onGround).toBe(true);
    expect(body.y + PLAYER_SIZE.height).toBe(FLOOR.y);
    expect(body.vy).toBe(0);
    expect(landings).toBe(1);
  });

  it('accelerates to the run speed and never exceeds it', () => {
    const body = groundedBody();
    simulate(body, [FLOOR], 1, { moveX: 1 });
    expect(body.vx).toBe(MOVEMENT.runSpeed);
    expect(body.facing).toBe(1);
  });

  it('decelerates to a stop when input is released', () => {
    const body = groundedBody();
    simulate(body, [FLOOR], 0.5, { moveX: -1 });
    simulate(body, [FLOOR], 0.3);
    expect(body.vx).toBe(0);
    expect(body.facing).toBe(-1);
  });

  it('is stopped by walls without passing through them', () => {
    const wall: Rect = { x: 200, y: 300, w: 30, h: 200 };
    const body = groundedBody(150);
    simulate(body, [FLOOR, wall], 2, { moveX: 1 });
    expect(body.x + PLAYER_SIZE.width).toBe(wall.x);
    expect(body.vx).toBe(0);
  });

  it('reaches the designed jump height when the button is held', () => {
    const apex = measureApex(Number.POSITIVE_INFINITY);
    expect(apex).toBeGreaterThan(115);
    expect(apex).toBeLessThan(130);
  });

  it('cuts the jump short when the button is released early', () => {
    const fullApex = measureApex(Number.POSITIVE_INFINITY);
    const shortApex = measureApex(0.05);
    expect(shortApex).toBeLessThan(fullApex * 0.6);
  });

  it('allows a jump shortly after walking off a ledge (coyote time)', () => {
    const ledge: Rect = { x: 0, y: 500, w: 200, h: 40 };
    const body = createBody(150, 500);
    simulate(body, [ledge], 0.05);
    let jumped = false;
    for (let index = 0; index < 120 && !jumped; index++) {
      const offLedge = body.x > ledge.x + ledge.w;
      const outcome = stepBody(body, intent({ moveX: 1, jumpPressed: offLedge, jumpHeld: true }), [ledge], FIXED_DT);
      jumped = outcome.jumped;
    }
    expect(jumped).toBe(true);
    expect(body.vy).toBeLessThan(0);
  });

  it('refuses a jump once the coyote window has passed', () => {
    const ledge: Rect = { x: 0, y: 500, w: 200, h: 40 };
    const body = createBody(195, 500);
    simulate(body, [ledge], 0.05);
    simulate(body, [ledge], 0.3, { moveX: 1 });
    expect(body.onGround).toBe(false);
    const outcome = stepBody(body, intent({ jumpPressed: true, jumpHeld: true }), [ledge], FIXED_DT);
    expect(outcome.jumped).toBe(false);
  });

  it('buffers a jump pressed just before landing', () => {
    const body = createBody(100, 470);
    let pressedAt = -1;
    let jumped = false;
    for (let index = 0; index < 240 && !jumped; index++) {
      const nearFloor = body.vy > 0 && FLOOR.y - (body.y + PLAYER_SIZE.height) < 12;
      const press = nearFloor && pressedAt < 0;
      if (press) pressedAt = index;
      jumped = stepBody(body, intent({ jumpPressed: press, jumpHeld: true }), [FLOOR], FIXED_DT).jumped;
    }
    expect(pressedAt).toBeGreaterThanOrEqual(0);
    expect(jumped).toBe(true);
  });

  it('stops upward motion when bumping a ceiling', () => {
    const ceiling: Rect = { x: 0, y: 420, w: 300, h: 20 };
    const body = groundedBody();
    stepBody(body, intent({ jumpPressed: true, jumpHeld: true }), [FLOOR, ceiling], FIXED_DT);
    simulate(body, [FLOOR, ceiling], 0.2, { jumpHeld: true });
    expect(body.y).toBeGreaterThanOrEqual(ceiling.y + ceiling.h);
  });

  it('never tunnels through a thin platform at terminal velocity', () => {
    const thin: Rect = { x: 0, y: 900, w: 300, h: 16 };
    const body = createBody(100, -400);
    simulate(body, [thin], 3);
    expect(body.y + PLAYER_SIZE.height).toBe(thin.y);
    expect(isSupported(body, [thin])).toBe(true);
  });
});
