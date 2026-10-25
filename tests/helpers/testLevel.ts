import { FIXED_DT } from '../../src/core/constants';
import { ExitKind, Presence, SolidStyle } from '../../src/core/enums';
import { IDLE_INPUT, type GameSimulation, type SimEvent, type SimInput } from '../../src/core/simulation';
import type { LevelDef, SolidDef } from '../../src/core/types';

export const GROUND: SolidDef = {
  id: 'ground',
  presence: Presence.Both,
  style: SolidStyle.Terrace,
  x: 0,
  y: 500,
  w: 2000,
  h: 40,
};

export function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test-level',
    name: 'Test Level',
    bounds: { x: 0, y: 0, w: 2000, h: 1000 },
    killY: 900,
    spawn: { x: 100, y: 500 },
    solids: [GROUND],
    hazards: [],
    fragments: [],
    mechanisms: [],
    checkpoints: [],
    hints: [],
    areas: [],
    decor: [],
    zones: [],
    portal: {
      kind: ExitKind.Shattered,
      x: 1800,
      y: 400,
      radius: 100,
      standX: 1700,
      zone: { x: 1740, y: 420, w: 120, h: 80 },
    },
    ...overrides,
  };
}

export function runFor(
  sim: GameSimulation,
  seconds: number,
  input: Partial<SimInput> = {},
): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / FIXED_DT);
  for (let index = 0; index < steps; index++) {
    events.push(...sim.step({ ...IDLE_INPUT, ...input }));
  }
  return events;
}

export function stepOnce(sim: GameSimulation, input: Partial<SimInput>): SimEvent[] {
  return sim.step({ ...IDLE_INPUT, ...input });
}
