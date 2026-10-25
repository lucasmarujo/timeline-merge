import { describe, expect, it } from 'vitest';
import { CHECKPOINT_TRIGGER, MOVEMENT, FIXED_DT, PLAYER_SIZE } from '../src/core/constants';
import { Presence, Timeline } from '../src/core/enums';
import { overlaps, overlapsAny } from '../src/core/geometry';
import { existsIn, isConditionMet } from '../src/core/timeline';
import type { Rect, SolidDef } from '../src/core/types';
import { LEVEL_1 } from '../src/levels/level1';

const TIMELINES = [Timeline.Dawn, Timeline.Eclipse];
const MECHANISM_IDS = LEVEL_1.mechanisms.map((mechanism) => mechanism.id);

function mechanismStates(): Set<string>[] {
  const states: Set<string>[] = [];
  for (let mask = 0; mask < 1 << MECHANISM_IDS.length; mask++) {
    states.push(new Set(MECHANISM_IDS.filter((_, index) => mask & (1 << index))));
  }
  return states;
}

function solidsFor(timeline: Timeline, active: Set<string>): SolidDef[] {
  return LEVEL_1.solids.filter(
    (solid) => existsIn(solid.presence, timeline) && isConditionMet(solid.condition, (id) => active.has(id)),
  );
}

function playerAt(feetX: number, feetY: number): Rect {
  return { x: feetX - PLAYER_SIZE.width / 2, y: feetY - PLAYER_SIZE.height, w: PLAYER_SIZE.width, h: PLAYER_SIZE.height };
}

function isSupportedBy(rect: Rect, solids: readonly Rect[]): boolean {
  return solids.some(
    (solid) => solid.y === rect.y + rect.h && solid.x < rect.x + rect.w && solid.x + solid.w > rect.x,
  );
}

describe('LEVEL_1 structure', () => {
  it('uses unique identifiers', () => {
    const ids = [
      ...LEVEL_1.solids.map((entry) => entry.id),
      ...LEVEL_1.hazards.map((entry) => entry.id),
      ...LEVEL_1.fragments.map((entry) => entry.id),
      ...LEVEL_1.mechanisms.map((entry) => entry.id),
      ...LEVEL_1.checkpoints.map((entry) => entry.id),
      ...LEVEL_1.hints.map((entry) => entry.id),
      ...LEVEL_1.areas.map((entry) => entry.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly three memory fragments', () => {
    expect(LEVEL_1.fragments).toHaveLength(3);
  });

  it('keeps every solid thicker than the fastest per-step displacement', () => {
    const maxStep = MOVEMENT.maxFallSpeed * FIXED_DT;
    for (const solid of LEVEL_1.solids) {
      expect(Math.min(solid.w, solid.h), solid.id).toBeGreaterThan(maxStep * 2);
    }
  });

  it('only references mechanisms that exist', () => {
    for (const solid of LEVEL_1.solids) {
      const referenced = [solid.condition?.requires, solid.condition?.unless].filter(
        (id): id is string => id !== undefined,
      );
      for (const id of referenced) {
        expect(MECHANISM_IDS, solid.id).toContain(id);
      }
    }
  });

  it('spawns and respawns the player on safe ground in both timelines under every puzzle state', () => {
    const points = [{ id: 'spawn', ...LEVEL_1.spawn }, ...LEVEL_1.checkpoints];
    for (const point of points) {
      const rect = playerAt(point.x, point.y);
      for (const active of mechanismStates()) {
        for (const timeline of TIMELINES) {
          const solids = solidsFor(timeline, active);
          expect(overlapsAny(rect, solids), `${point.id} blocked in ${timeline}`).toBe(false);
          expect(isSupportedBy(rect, solids), `${point.id} unsupported in ${timeline}`).toBe(true);
        }
      }
    }
  });

  it('keeps hazards away from checkpoint triggers', () => {
    for (const checkpoint of LEVEL_1.checkpoints) {
      const trigger: Rect = {
        x: checkpoint.x - CHECKPOINT_TRIGGER.halfWidth,
        y: checkpoint.y - CHECKPOINT_TRIGGER.height,
        w: CHECKPOINT_TRIGGER.halfWidth * 2,
        h: CHECKPOINT_TRIGGER.height,
      };
      expect(overlapsAny(trigger, LEVEL_1.hazards), checkpoint.id).toBe(false);
    }
  });

  it('never buries fragments or mechanisms inside geometry of their own timeline', () => {
    const points = [
      ...LEVEL_1.fragments.map((fragment) => ({ id: fragment.id, presence: fragment.presence, x: fragment.x, y: fragment.y })),
      ...LEVEL_1.mechanisms.map((mechanism) => ({
        id: mechanism.id,
        presence: mechanism.presence,
        x: mechanism.x,
        y: mechanism.y - 1,
      })),
    ];
    for (const point of points) {
      const probe: Rect = { x: point.x - 1, y: point.y - 1, w: 2, h: 2 };
      for (const timeline of TIMELINES.filter((candidate) => existsIn(point.presence, candidate))) {
        for (const active of mechanismStates()) {
          expect(overlapsAny(probe, solidsFor(timeline, active)), `${point.id} in ${timeline}`).toBe(false);
        }
      }
    }
  });

  it('keeps every interactive element inside the playable bounds', () => {
    const inside = (x: number, y: number): boolean =>
      x > LEVEL_1.bounds.x && x < LEVEL_1.bounds.x + LEVEL_1.bounds.w && y > LEVEL_1.bounds.y && y < LEVEL_1.killY;
    for (const fragment of LEVEL_1.fragments) expect(inside(fragment.x, fragment.y), fragment.id).toBe(true);
    for (const mechanism of LEVEL_1.mechanisms) expect(inside(mechanism.x, mechanism.y), mechanism.id).toBe(true);
    expect(inside(LEVEL_1.portal.x, LEVEL_1.portal.y)).toBe(true);
  });

  it('requires a timeline shift for the core puzzles', () => {
    const dawnOnly = (id: string): boolean => LEVEL_1.solids.find((solid) => solid.id === id)?.presence === Presence.Dawn;
    expect(dawnOnly('a-door')).toBe(true);
    expect(dawnOnly('b-ward')).toBe(true);
    expect(dawnOnly('d-gate')).toBe(true);
    const eclipseGate = LEVEL_1.solids.find((solid) => solid.id === 'd-portcullis');
    const dawnGate = LEVEL_1.solids.find((solid) => solid.id === 'd-gate');
    expect(eclipseGate && dawnGate && overlaps(eclipseGate, dawnGate)).toBe(true);
  });
});
