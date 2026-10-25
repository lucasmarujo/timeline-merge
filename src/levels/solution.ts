import type { Timeline } from '../core/enums';

export enum StepKind {
  Walk = 'walk',
  Leap = 'leap',
  Shift = 'shift',
  Interact = 'interact',
  Wait = 'wait',
  WaitMover = 'waitMover',
  WaitHazard = 'waitHazard',
  WaitPulse = 'waitPulse',
  WallClimb = 'wallClimb',
  Board = 'board',
}

export enum AirAct {
  Shift = 'shift',
  Dash = 'dash',
  Jump = 'jump',
  Retarget = 'retarget',
  Release = 'release',
}

export interface Condition {
  feetAbove?: number;
  feetBelow?: number;
  ascending?: boolean;
  descending?: boolean;
  xPast?: number;
  afterSeconds?: number;
  afterAction?: boolean;
}

export interface AirAction {
  act: AirAct;
  when: Condition;
  to?: Timeline;
  direction?: 1 | -1;
  x?: number;
}

export type SolutionStep =
  | { kind: StepKind.Walk; x: number; tolerance?: number }
  | { kind: StepKind.Leap; x: number; actions?: readonly AirAction[]; settle?: boolean; landY?: number }
  | { kind: StepKind.Shift; to: Timeline }
  | { kind: StepKind.Interact }
  | { kind: StepKind.Wait; seconds: number }
  | { kind: StepKind.WaitMover; id: string; min: number; max: number; rising?: boolean }
  | { kind: StepKind.WaitHazard; id: string; min: number; max: number }
  | { kind: StepKind.WaitPulse; min: number; max: number; timeline?: Timeline }
  | { kind: StepKind.Board; id: string; direction: 1 | -1 }
  | { kind: StepKind.WallClimb; side: 1 | -1; topY: number; exitX: number };
