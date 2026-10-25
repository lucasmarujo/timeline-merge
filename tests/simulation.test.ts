import { describe, expect, it } from 'vitest';
import { DEATH_DURATION, PLAYER_SIZE, SHIFT } from '../src/core/constants';
import {
  DeathCause,
  FragmentKind,
  HazardStyle,
  InteractionBlock,
  InteractionKind,
  MechanismKind,
  Presence,
  SimEventType,
  SimStatus,
  SolidStyle,
  SwitchRejection,
  Timeline,
} from '../src/core/enums';
import { bodyCenterX } from '../src/core/physics';
import { GameSimulation, SPAWN_CHECKPOINT_ID, type SimEvent } from '../src/core/simulation';
import type { LevelDef, SolidDef } from '../src/core/types';
import { GROUND, makeLevel, runFor, stepOnce } from './helpers/testLevel';

function eventsOf<T extends SimEventType>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] {
  return events.filter((event): event is Extract<SimEvent, { type: T }> => event.type === type);
}

function settled(level: LevelDef): GameSimulation {
  const sim = new GameSimulation(level);
  runFor(sim, 0.1);
  return sim;
}

const DAWN_LEDGE: SolidDef = {
  id: 'dawn-ledge',
  presence: Presence.Dawn,
  style: SolidStyle.Crystal,
  x: 0,
  y: 300,
  w: 300,
  h: 20,
};

describe('timeline shifting', () => {
  it('switches the active timeline and counts the shift', () => {
    const sim = settled(makeLevel());
    const events = stepOnce(sim, { shiftPressed: true });
    expect(sim.timeline).toBe(Timeline.Eclipse);
    expect(sim.stats.shifts).toBe(1);
    expect(eventsOf(events, SimEventType.TimelineShifted)).toEqual([
      { type: SimEventType.TimelineShifted, to: Timeline.Eclipse, nudged: false },
    ]);
  });

  it('rejects a shift into solid geometry and keeps the player where they were', () => {
    const eclipseWall: SolidDef = {
      id: 'eclipse-wall',
      presence: Presence.Eclipse,
      style: SolidStyle.Wall,
      x: 60,
      y: 300,
      w: 100,
      h: 200,
    };
    const sim = settled(makeLevel({ solids: [GROUND, eclipseWall] }));
    const before = { x: sim.body.x, y: sim.body.y };
    const events = stepOnce(sim, { shiftPressed: true });
    expect(sim.timeline).toBe(Timeline.Dawn);
    expect(sim.stats.shifts).toBe(0);
    expect(eventsOf(events, SimEventType.ShiftRejected)).toEqual([
      { type: SimEventType.ShiftRejected, reason: SwitchRejection.Blocked },
    ]);
    expect(sim.body.x).toBeCloseTo(before.x, 5);
    expect(sim.body.y).toBeCloseTo(before.y, 5);
  });

  it('rejects a shift that would land the player inside a hazard', () => {
    const sim = settled(
      makeLevel({
        hazards: [{ id: 'thorns', presence: Presence.Eclipse, style: HazardStyle.Thorns, x: 80, y: 470, w: 40, h: 30 }],
      }),
    );
    const events = stepOnce(sim, { shiftPressed: true });
    expect(sim.timeline).toBe(Timeline.Dawn);
    expect(eventsOf(events, SimEventType.ShiftRejected)[0]?.reason).toBe(SwitchRejection.Hazard);
  });

  it('applies a cooldown so a held or repeated key cannot flicker realities', () => {
    const sim = settled(makeLevel());
    stepOnce(sim, { shiftPressed: true });
    stepOnce(sim, { shiftPressed: true });
    expect(sim.timeline).toBe(Timeline.Eclipse);
    runFor(sim, SHIFT.cooldown);
    stepOnce(sim, { shiftPressed: true });
    expect(sim.timeline).toBe(Timeline.Dawn);
    expect(sim.stats.shifts).toBe(2);
  });

  it('only collides with geometry that exists in the active timeline', () => {
    const level = makeLevel({ spawn: { x: 100, y: 300 }, solids: [GROUND, DAWN_LEDGE] });
    const sim = settled(level);
    expect(sim.body.y + PLAYER_SIZE.height).toBe(DAWN_LEDGE.y);
    stepOnce(sim, { shiftPressed: true });
    runFor(sim, 1);
    expect(sim.body.y + PLAYER_SIZE.height).toBe(GROUND.y);
  });

  it('previews whether a shift is possible without changing state', () => {
    const sim = settled(makeLevel());
    expect(sim.previewShift().ok).toBe(true);
    expect(sim.timeline).toBe(Timeline.Dawn);
  });
});

describe('fragments and checkpoints', () => {
  const fragmentLevel = makeLevel({
    fragments: [{ id: 'eclipse-memory', kind: FragmentKind.Memory, presence: Presence.Eclipse, x: 100, y: 480, title: 'T', memory: 'M' }],
    checkpoints: [{ id: 'cp-a', x: 300, y: 500 }],
  });

  it('collects a fragment only in the timeline where it exists', () => {
    const sim = settled(fragmentLevel);
    expect(sim.fragmentCount).toBe(0);
    const events = stepOnce(sim, { shiftPressed: true });
    expect(eventsOf(events, SimEventType.FragmentCollected).map((event) => event.count)).toEqual([1]);
    expect(sim.hasFragment('eclipse-memory')).toBe(true);
    expect(eventsOf(runFor(sim, 0.5), SimEventType.FragmentCollected)).toHaveLength(0);
  });

  it('records the checkpoint and the timeline the player reached it in', () => {
    const sim = settled(fragmentLevel);
    stepOnce(sim, { shiftPressed: true });
    let reached: SimEvent[] = [];
    for (let index = 0; index < 240 && sim.respawnPoint.id === SPAWN_CHECKPOINT_ID; index++) {
      reached = reached.concat(stepOnce(sim, { moveX: 1 }));
    }
    expect(eventsOf(reached, SimEventType.CheckpointReached).map((event) => event.checkpoint.id)).toEqual(['cp-a']);
    expect(sim.respawnPoint).toEqual({ id: 'cp-a', x: 300, y: 500, timeline: Timeline.Eclipse });
  });
});

describe('death and respawn', () => {
  const pitLevel = makeLevel({
    solids: [{ ...GROUND, w: 400 }],
    checkpoints: [{ id: 'cp-a', x: 200, y: 500 }],
    fragments: [{ id: 'memory', kind: FragmentKind.Memory, presence: Presence.Both, x: 210, y: 480, title: 'T', memory: 'M' }],
    hazards: [{ id: 'thorns', presence: Presence.Eclipse, style: HazardStyle.Thorns, x: 330, y: 470, w: 40, h: 30 }],
  });

  it('kills the player below the abyss line and respawns them at the checkpoint', () => {
    const sim = settled(pitLevel);
    runFor(sim, 0.6, { moveX: 1 });
    expect(sim.hasFragment('memory')).toBe(true);
    const fallEvents = [...runFor(sim, 1.5, { moveX: 1 }), ...runFor(sim, 1.5)];
    const deaths = eventsOf(fallEvents, SimEventType.Died);
    expect(deaths[0]?.cause).toBe(DeathCause.Fall);
    expect(eventsOf(fallEvents, SimEventType.Respawned)[0]).toMatchObject({ checkpointId: 'cp-a' });
    expect(sim.status).toBe(SimStatus.Alive);
    expect(bodyCenterX(sim.body)).toBe(200);
    expect(sim.hasFragment('memory')).toBe(true);
    expect(sim.stats.deaths).toBe(1);
  });

  it('stays dead for the death duration before respawning', () => {
    const sim = settled(pitLevel);
    let events: SimEvent[] = [];
    for (let index = 0; index < 600 && sim.status !== SimStatus.Dead; index++) {
      events = stepOnce(sim, { moveX: 1 });
    }
    expect(eventsOf(events, SimEventType.Died)).toHaveLength(1);
    runFor(sim, DEATH_DURATION * 0.9);
    expect(sim.status).toBe(SimStatus.Dead);
    runFor(sim, DEATH_DURATION * 0.2);
    expect(sim.status).toBe(SimStatus.Alive);
  });

  it('kills the player on hazards of the active timeline only', () => {
    const sim = settled(pitLevel);
    runFor(sim, 0.3, { moveX: 1 });
    stepOnce(sim, { shiftPressed: true });
    const events: SimEvent[] = [];
    for (let index = 0; index < 240 && sim.status === SimStatus.Alive; index++) {
      events.push(...stepOnce(sim, { moveX: 1 }));
    }
    expect(eventsOf(events, SimEventType.Died)[0]?.cause).toBe(DeathCause.Hazard);
    expect(sim.respawnPoint).toMatchObject({ id: 'cp-a', timeline: Timeline.Eclipse });
    runFor(sim, DEATH_DURATION + 0.1);
    expect(sim.status).toBe(SimStatus.Alive);
    expect(sim.timeline).toBe(Timeline.Eclipse);
  });

  it('walks safely over the same hazard while in the other timeline', () => {
    const sim = settled(pitLevel);
    const events = runFor(sim, 1.2, { moveX: 1 });
    expect(eventsOf(events, SimEventType.Died).every((event) => event.cause === DeathCause.Fall)).toBe(true);
  });

  it('restarts from the checkpoint on demand without counting a death', () => {
    const sim = settled(pitLevel);
    runFor(sim, 0.6, { moveX: 1 });
    const events = sim.respawn();
    expect(eventsOf(events, SimEventType.Respawned)).toHaveLength(1);
    expect(sim.stats.deaths).toBe(0);
    expect(bodyCenterX(sim.body)).toBe(200);
  });
});

describe('mechanisms', () => {
  const gate: SolidDef = {
    id: 'gate',
    presence: Presence.Eclipse,
    style: SolidStyle.Portcullis,
    x: 400,
    y: 300,
    w: 40,
    h: 200,
    condition: { unless: 'lever' },
  };
  const lightStep: SolidDef = {
    id: 'light-step',
    presence: Presence.Both,
    style: SolidStyle.LightStep,
    x: 80,
    y: 470,
    w: 60,
    h: 18,
    condition: { requires: 'lever' },
  };
  const mechanismLevel = makeLevel({
    solids: [GROUND, gate, lightStep],
    mechanisms: [{ id: 'lever', presence: Presence.Dawn, kind: MechanismKind.Crank, x: 130, y: 500, prompt: 'p', message: 'm' }],
  });

  it('refuses to operate a mechanism from the wrong timeline', () => {
    const sim = settled(mechanismLevel);
    stepOnce(sim, { shiftPressed: true });
    const target = sim.getInteraction();
    expect(target).toMatchObject({ kind: InteractionKind.Mechanism, available: false, block: InteractionBlock.WrongTimeline });
    const events = stepOnce(sim, { interactPressed: true });
    expect(eventsOf(events, SimEventType.InteractionRefused)).toHaveLength(1);
    expect(sim.isMechanismActive('lever')).toBe(false);
  });

  it('activates a mechanism and changes the other timeline', () => {
    const sim = settled(mechanismLevel);
    expect(sim.solidsIn(Timeline.Eclipse).map((solid) => solid.id)).toContain('gate');
    const events = stepOnce(sim, { interactPressed: true });
    expect(eventsOf(events, SimEventType.MechanismActivated)[0]?.mechanism.id).toBe('lever');
    expect(sim.solidsIn(Timeline.Eclipse).map((solid) => solid.id)).not.toContain('gate');
    expect(sim.getInteraction()).toBeNull();
  });

  it('lifts the player clear of geometry that materializes around them', () => {
    const sim = settled(mechanismLevel);
    stepOnce(sim, { interactPressed: true });
    expect(sim.body.y + PLAYER_SIZE.height).toBe(lightStep.y);
    runFor(sim, 0.2);
    expect(sim.body.onGround).toBe(true);
  });
});

describe('portal', () => {
  const memories = ['a', 'b', 'c'].map((id, index) => ({
    id,
    kind: FragmentKind.Memory,
    presence: Presence.Both,
    x: 1300 + index * 120,
    y: 480,
    title: id,
    memory: id,
  }));

  it('reports how many memories are still missing', () => {
    const sim = settled(makeLevel({ spawn: { x: 1780, y: 500 }, fragments: memories }));
    const events = stepOnce(sim, { interactPressed: true });
    expect(eventsOf(events, SimEventType.PortalUnstable)).toEqual([{ type: SimEventType.PortalUnstable, missing: 3 }]);
    expect(sim.status).toBe(SimStatus.Alive);
  });

  it('starts the finale once every memory is restored and walks to the portal', () => {
    const sim = settled(makeLevel({ spawn: { x: 1250, y: 500 }, fragments: memories }));
    for (let index = 0; index < 600 && bodyCenterX(sim.body) < 1780; index++) {
      stepOnce(sim, { moveX: 1 });
    }
    expect(sim.fragmentCount).toBe(3);
    const events = stepOnce(sim, { interactPressed: true });
    expect(eventsOf(events, SimEventType.PortalActivated)).toHaveLength(1);
    expect(sim.status).toBe(SimStatus.Finale);
    expect(sim.respawn()).toEqual([]);
    runFor(sim, 3, { moveX: 1, jumpPressed: true, shiftPressed: true });
    expect(Math.abs(bodyCenterX(sim.body) - 1700)).toBeLessThanOrEqual(2);
    expect(sim.body.facing).toBe(1);
    expect(sim.timeline).toBe(Timeline.Dawn);
  });
});

describe('areas and reset', () => {
  it('announces the starting area on the first step', () => {
    const area = { id: 'start', zone: { x: 0, y: 0, w: 1000, h: 1000 }, title: 'Start', subtitle: 'I' };
    const sim = new GameSimulation(makeLevel({ areas: [area] }));
    expect(eventsOf(stepOnce(sim, {}), SimEventType.AreaEntered)[0]?.area.id).toBe('start');
    expect(eventsOf(stepOnce(sim, {}), SimEventType.AreaEntered)).toHaveLength(0);
  });

  it('resets progress, stats and position for a fresh run', () => {
    const level = makeLevel({
      fragments: [{ id: 'memory', kind: FragmentKind.Memory, presence: Presence.Both, x: 160, y: 480, title: 'T', memory: 'M' }],
      checkpoints: [{ id: 'cp-a', x: 220, y: 500 }],
    });
    const sim = settled(level);
    stepOnce(sim, { shiftPressed: true });
    runFor(sim, 0.6, { moveX: 1 });
    expect(sim.fragmentCount).toBe(1);
    sim.reset();
    expect(sim.fragmentCount).toBe(0);
    expect(sim.timeline).toBe(Timeline.Dawn);
    expect(sim.stats).toEqual({ deaths: 0, shifts: 0, time: 0 });
    expect(sim.respawnPoint.id).toBe(SPAWN_CHECKPOINT_ID);
    expect(bodyCenterX(sim.body)).toBe(level.spawn.x);
  });
});
