import { describe, expect, it } from 'vitest';
import { AIR_JUMP, CRUMBLE, DASH, FIXED_DT, GLIDE, MOVEMENT, PLAYER_SIZE, WALL } from '../src/core/constants';
import { Ability, DeathCause, ExitKind, MotionAxis, Presence, SimEventType, SimStatus, SolidStyle, SwitchRejection, Timeline, ZoneKind, HazardStyle } from '../src/core/enums';
import { createBody, NO_CAPABILITIES, stepBody, type Body, type Capabilities, type MoveIntent } from '../src/core/physics';
import { ALL_ABILITIES, GameSimulation, motionOffset, type SimEvent } from '../src/core/simulation';
import type { Rect, SolidDef } from '../src/core/types';
import { GROUND, makeLevel, runFor, stepOnce } from './helpers/testLevel';

const FLOOR: Rect = { x: -1000, y: 500, w: 3000, h: 40 };
const EVERYTHING: Capabilities = { dash: true, glide: true, wallGrip: true };

function intent(overrides: Partial<MoveIntent> = {}): MoveIntent {
  return { moveX: 0, jumpPressed: false, jumpHeld: false, ...overrides };
}

function run(body: Body, solids: Rect[], seconds: number, input: Partial<MoveIntent> = {}, capabilities: Capabilities = EVERYTHING): void {
  for (let index = 0; index < Math.round(seconds / FIXED_DT); index++) {
    stepBody(body, intent(input), solids, FIXED_DT, capabilities);
  }
}

function grounded(x = 100): Body {
  const body = createBody(x, 500);
  run(body, [FLOOR], 0.1);
  return body;
}

function abilities(...list: Ability[]): ReadonlySet<Ability> {
  return new Set(list);
}

function types(events: SimEvent[]): SimEventType[] {
  return events.map((event) => event.type);
}

describe('dash', () => {
  it('bursts horizontally without gravity, then keeps some momentum', () => {
    const body = grounded();
    stepBody(body, intent({ jumpPressed: true, jumpHeld: true }), [FLOOR], FIXED_DT, EVERYTHING);
    run(body, [FLOOR], 0.2, { jumpHeld: true });
    const y = body.y;
    const x = body.x;
    const outcome = stepBody(body, intent({ dashPressed: true, moveX: 1 }), [FLOOR], FIXED_DT, EVERYTHING);
    expect(outcome.dashed).toBe(true);
    run(body, [FLOOR], DASH.duration - FIXED_DT * 2);
    expect(body.y).toBeCloseTo(y, 6);
    expect(body.x - x).toBeGreaterThan(DASH.speed * DASH.duration * 0.85);
    run(body, [FLOOR], FIXED_DT * 3);
    expect(Math.abs(body.vx)).toBeLessThanOrEqual(DASH.exitSpeed);
  });

  it('can only dash once per airtime and recharges on landing', () => {
    const body = grounded();
    stepBody(body, intent({ jumpPressed: true, jumpHeld: true }), [FLOOR], FIXED_DT, EVERYTHING);
    expect(stepBody(body, intent({ dashPressed: true }), [FLOOR], FIXED_DT, EVERYTHING).dashed).toBe(true);
    run(body, [FLOOR], DASH.duration);
    expect(stepBody(body, intent({ dashPressed: true }), [FLOOR], FIXED_DT, EVERYTHING).dashed).toBe(false);
    run(body, [FLOOR], 1);
    expect(body.onGround).toBe(true);
    expect(body.dashReady).toBe(true);
  });

  it('does nothing without the ability', () => {
    const body = grounded();
    expect(stepBody(body, intent({ dashPressed: true }), [FLOOR], FIXED_DT, NO_CAPABILITIES).dashed).toBe(false);
  });
});

describe('air jump', () => {
  it('spends a granted air jump for a second leap and loses it on landing', () => {
    const body = grounded();
    stepBody(body, intent({ jumpPressed: true, jumpHeld: true }), [FLOOR], FIXED_DT, EVERYTHING);
    run(body, [FLOOR], 0.3, { jumpHeld: true });
    body.airJumps = 1;
    const outcome = stepBody(body, intent({ jumpPressed: true, jumpHeld: true }), [FLOOR], FIXED_DT, EVERYTHING);
    expect(outcome.airJumped).toBe(true);
    expect(body.vy).toBeLessThan(-AIR_JUMP.velocity + MOVEMENT.riseGravity * FIXED_DT * 2);
    expect(body.airJumps).toBe(0);
    expect(stepBody(body, intent({ jumpPressed: true }), [FLOOR], FIXED_DT, EVERYTHING).airJumped).toBe(false);
  });
});

describe('glide', () => {
  it('caps the fall speed while jump is held and only after the apex', () => {
    const body = createBody(100, 0);
    run(body, [FLOOR], 0.15, { jumpHeld: true });
    expect(body.gliding).toBe(true);
    expect(body.vy).toBeLessThanOrEqual(GLIDE.fallSpeed);
    const free = createBody(100, 0);
    run(free, [FLOOR], 0.15, { jumpHeld: true }, NO_CAPABILITIES);
    expect(free.vy).toBeGreaterThan(GLIDE.fallSpeed * 2);
  });

  it('rides an updraft upward', () => {
    const body = createBody(100, 300);
    for (let index = 0; index < 60; index++) {
      stepBody(body, intent({ jumpHeld: true, lift: 2600 }), [FLOOR], FIXED_DT, EVERYTHING);
    }
    expect(body.vy).toBeLessThan(0);
    expect(body.y + PLAYER_SIZE.height).toBeLessThan(300);
  });
});

describe('wall grip', () => {
  const wall: Rect = { x: 200, y: 0, w: 40, h: 500 };

  it('slides slowly down a wall it presses against and kicks away from it', () => {
    const body = createBody(190, 200);
    run(body, [FLOOR, wall], 0.4, { moveX: 1 });
    expect(body.wall).toBe(1);
    expect(body.wallSliding).toBe(true);
    expect(body.vy).toBeLessThanOrEqual(WALL.slideSpeed);
    const outcome = stepBody(body, intent({ moveX: 1, jumpPressed: true, jumpHeld: true }), [FLOOR, wall], FIXED_DT, EVERYTHING);
    expect(outcome.wallJumped).toBe(true);
    expect(body.vx).toBeLessThan(0);
    expect(body.vy).toBeLessThan(0);
    run(body, [FLOOR, wall], WALL.lockTime / 2, { moveX: 1, jumpHeld: true });
    expect(body.vx).toBeLessThan(0);
  });

  it('falls at full speed against a wall without the ability', () => {
    const body = createBody(190, 100);
    run(body, [FLOOR, wall], 0.3, { moveX: 1 }, NO_CAPABILITIES);
    expect(body.wallSliding).toBe(false);
    expect(body.vy).toBeGreaterThan(WALL.slideSpeed * 2);
  });
});

describe('ability gates in the simulation', () => {
  const eclipsePad: SolidDef = { id: 'pad', presence: Presence.Eclipse, style: SolidStyle.Slab, x: 300, y: 300, w: 200, h: 20 };

  it('refuses to shift before the rift is learned', () => {
    const sim = new GameSimulation(makeLevel(), abilities());
    runFor(sim, 0.1);
    const events = stepOnce(sim, { shiftPressed: true });
    expect(events).toContainEqual({ type: SimEventType.ShiftRejected, reason: SwitchRejection.Locked });
    expect(sim.timeline).toBe(Timeline.Dawn);
  });

  it('only shifts on the ground until the air shift is learned', () => {
    const sim = new GameSimulation(makeLevel(), abilities(Ability.Shift));
    runFor(sim, 0.1);
    stepOnce(sim, { jumpPressed: true, jumpHeld: true });
    runFor(sim, 0.1, { jumpHeld: true });
    expect(stepOnce(sim, { shiftPressed: true })).toContainEqual({ type: SimEventType.ShiftRejected, reason: SwitchRejection.Grounded });
    runFor(sim, 1);
    expect(types(stepOnce(sim, { shiftPressed: true }))).toContain(SimEventType.TimelineShifted);
  });

  it('grants an extra leap after a mid-air shift with the rift leap', () => {
    const sim = new GameSimulation(makeLevel({ solids: [GROUND, eclipsePad] }), abilities(Ability.Shift, Ability.AirShift, Ability.RiftLeap));
    runFor(sim, 0.1);
    stepOnce(sim, { jumpPressed: true, jumpHeld: true });
    runFor(sim, 0.15, { jumpHeld: true });
    stepOnce(sim, { shiftPressed: true, jumpHeld: true });
    expect(sim.timeline).toBe(Timeline.Eclipse);
    expect(sim.body.airJumps).toBe(1);
    expect(types(stepOnce(sim, { jumpPressed: true, jumpHeld: true }))).toContain(SimEventType.AirJumped);
  });

  it('does not grant the leap without the ability', () => {
    const sim = new GameSimulation(makeLevel(), abilities(Ability.Shift, Ability.AirShift));
    runFor(sim, 0.1);
    stepOnce(sim, { jumpPressed: true, jumpHeld: true });
    runFor(sim, 0.15, { jumpHeld: true });
    stepOnce(sim, { shiftPressed: true, jumpHeld: true });
    expect(sim.body.airJumps).toBe(0);
  });

  it('refreshes the dash on a mid-air shift with the rift chain', () => {
    const sim = new GameSimulation(makeLevel(), ALL_ABILITIES);
    runFor(sim, 0.1);
    stepOnce(sim, { jumpPressed: true, jumpHeld: true });
    stepOnce(sim, { dashPressed: true });
    expect(sim.body.dashReady).toBe(false);
    runFor(sim, 0.2);
    stepOnce(sim, { shiftPressed: true });
    expect(sim.body.dashReady).toBe(true);
  });

  it('hides mechanisms from a traveler who cannot use them yet', () => {
    const level = makeLevel({ mechanisms: [{ id: 'lever', presence: Presence.Dawn, kind: 0 as never, x: 120, y: 500, prompt: 'p', message: 'm' }] });
    const sim = new GameSimulation(level, abilities(Ability.Shift));
    runFor(sim, 0.1);
    expect(sim.getInteraction()).toBeNull();
  });
});

describe('world mechanics', () => {
  it('anchors the traveler inside chains of the active timeline', () => {
    const sim = new GameSimulation(makeLevel({ zones: [{ id: 'chain', kind: ZoneKind.Anchor, presence: Presence.Dawn, x: 0, y: 300, w: 300, h: 300 }] }));
    runFor(sim, 0.1);
    expect(stepOnce(sim, { shiftPressed: true })).toContainEqual({ type: SimEventType.ShiftRejected, reason: SwitchRejection.Anchored });
    expect(sim.previewShift()).toEqual({ ok: false, reason: SwitchRejection.Anchored });
  });

  it('carries the traveler on a drifting platform and moves it deterministically', () => {
    const drifter: SolidDef = {
      id: 'drifter',
      presence: Presence.Both,
      style: SolidStyle.Drifter,
      x: 80,
      y: 400,
      w: 120,
      h: 20,
      motion: { axis: MotionAxis.X, range: 300, period: 4, phase: 0 },
    };
    const sim = new GameSimulation(makeLevel({ spawn: { x: 140, y: 400 }, solids: [drifter] }));
    runFor(sim, 0.2);
    const start = sim.body.x;
    runFor(sim, 1);
    const platform = sim.liveSolid('drifter') as Rect;
    expect(platform.x).toBeCloseTo(80 + motionOffset(drifter.motion as never, sim.worldTime), 6);
    expect(sim.body.x - start).toBeGreaterThan(100);
    expect(sim.body.y + PLAYER_SIZE.height).toBeCloseTo(platform.y, 6);
  });

  it('crushes the traveler between a mover and a wall', () => {
    const wall: SolidDef = { id: 'wall', presence: Presence.Both, style: SolidStyle.Wall, x: 300, y: 300, w: 60, h: 200 };
    const ram: SolidDef = { id: 'ram', presence: Presence.Both, style: SolidStyle.Drifter, x: 100, y: 440, w: 100, h: 60, motion: { axis: MotionAxis.X, range: 200, period: 2, phase: 0 } };
    const sim = new GameSimulation(makeLevel({ spawn: { x: 280, y: 500 }, solids: [GROUND, wall, ram] }));
    const events = runFor(sim, 1.2);
    expect(events).toContainEqual({ type: SimEventType.Died, cause: DeathCause.Crush });
  });

  it('crumbles stone after a moment underfoot and reforms it later', () => {
    const stone: SolidDef = { id: 'stone', presence: Presence.Both, style: SolidStyle.Crumble, x: 60, y: 400, w: 120, h: 20, crumble: true };
    const sim = new GameSimulation(makeLevel({ spawn: { x: 120, y: 400 }, solids: [GROUND, stone] }));
    const crumbling = runFor(sim, CRUMBLE.delay + 0.1);
    expect(types(crumbling)).toContain(SimEventType.Crumbled);
    expect(sim.isSolidBroken('stone')).toBe(true);
    runFor(sim, 0.6);
    expect(sim.body.y + PLAYER_SIZE.height).toBe(GROUND.y);
    const reforming = runFor(sim, CRUMBLE.respawn);
    expect(types(reforming)).toContain(SimEventType.Reformed);
    expect(sim.isSolidBroken('stone')).toBe(false);
  });

  it('patrols wraiths along their path and kills on contact', () => {
    const level = makeLevel({
      hazards: [{ id: 'wraith', presence: Presence.Dawn, style: HazardStyle.Wraith, x: 400, y: 440, w: 30, h: 50, motion: { axis: MotionAxis.X, range: -350, period: 3, phase: 0 } }],
    });
    const sim = new GameSimulation(level);
    const events = runFor(sim, 2);
    expect(events).toContainEqual({ type: SimEventType.Died, cause: DeathCause.Hazard });
  });

  it('flips reality on every pulse while inside a pulse zone', () => {
    const sim = new GameSimulation(makeLevel({ zones: [{ id: 'pulse', kind: ZoneKind.Pulse, presence: Presence.Both, x: 0, y: 0, w: 400, h: 600, period: 1 }] }), abilities());
    const events = runFor(sim, 2.05);
    expect(types(events).filter((type) => type === SimEventType.PulseShifted)).toHaveLength(2);
    expect(sim.pulseReading()?.progress).toBeCloseTo(0.05, 1);
  });

  it('lets the unraveling catch a traveler who stands still', () => {
    const sim = new GameSimulation(makeLevel({ chase: { triggerX: 120, speed: 200, lead: 100 } }));
    const awake = runFor(sim, 0.3, { moveX: 1 });
    expect(types(awake)).toContain(SimEventType.UnravelingAwakened);
    const events = runFor(sim, 1.5);
    expect(events).toContainEqual({ type: SimEventType.Died, cause: DeathCause.Unraveled });
    let respawned = false;
    for (let index = 0; index < 240 && !respawned; index++) {
      respawned = types(stepOnce(sim, {})).includes(SimEventType.Respawned);
    }
    expect(sim.status).toBe(SimStatus.Alive);
    expect(sim.unravelingX).toBeLessThan(sim.body.x - 50);
  });

  it('completes a level by walking into an open gate', () => {
    const level = makeLevel();
    const sim = new GameSimulation({ ...level, portal: { ...level.portal, kind: ExitKind.Gate } });
    let exited = false;
    for (let index = 0; index < 1200 && !exited; index++) {
      exited = types(stepOnce(sim, { moveX: 1 })).includes(SimEventType.ExitReached);
    }
    expect(exited).toBe(true);
    expect(sim.status).toBe(SimStatus.Exited);
  });
});
