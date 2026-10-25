import { FragmentKind, HazardStyle, MechanismKind, Presence, SolidStyle, Timeline, ZoneKind } from '../../core/enums';
import type { Rng } from '../../core/rng';
import type {
  CheckpointDef,
  Condition as SolidCondition,
  DecorDef,
  FragmentDef,
  HazardDef,
  HintDef,
  MechanismDef,
  Motion,
  SolidDef,
  ZoneDef,
} from '../../core/types';
import { AirAct, StepKind, type AirAction, type Condition, type SolutionStep } from '../solution';

export interface Cursor {
  x: number;
  y: number;
  timeline: Timeline;
}

export interface SolidOptions {
  h?: number;
  condition?: SolidCondition;
  motion?: Motion;
  crumble?: boolean;
}

export const FLOOR_DEPTH = 72;

export function presenceOf(timeline: Timeline): Presence {
  return timeline === Timeline.Dawn ? Presence.Dawn : Presence.Eclipse;
}

export function other(timeline: Timeline): Timeline {
  return timeline === Timeline.Dawn ? Timeline.Eclipse : Timeline.Dawn;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, t));
}

export class LevelBuilder {
  readonly solids: SolidDef[] = [];
  readonly hazards: HazardDef[] = [];
  readonly fragments: FragmentDef[] = [];
  readonly mechanisms: MechanismDef[] = [];
  readonly checkpoints: CheckpointDef[] = [];
  readonly hints: HintDef[] = [];
  readonly zones: ZoneDef[] = [];
  readonly decor: DecorDef[] = [];
  readonly steps: SolutionStep[] = [];
  readonly busy: Array<{ x0: number; x1: number }> = [];
  cursor: Cursor;
  private counter = 0;

  constructor(
    readonly rng: Rng,
    readonly level: number,
    start: Cursor,
  ) {
    this.cursor = { ...start };
  }

  id(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  solid(presence: Presence, style: SolidStyle, x: number, y: number, w: number, options: SolidOptions = {}): string {
    const id = this.id(style);
    this.solids.push({
      id,
      presence,
      style,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(options.h ?? 24),
      condition: options.condition,
      motion: options.motion,
      crumble: options.crumble,
    });
    return id;
  }

  ground(x0: number, x1: number, y: number, style: SolidStyle = SolidStyle.Terrace, presence: Presence = Presence.Both): string {
    return this.solid(presence, style, x0, y, x1 - x0, { h: style === SolidStyle.Terrace ? FLOOR_DEPTH : style === SolidStyle.Viaduct ? 40 : 28 });
  }

  hazard(presence: Presence, style: HazardStyle, x: number, y: number, w: number, h: number, motion?: Motion): string {
    const id = this.id(style);
    this.hazards.push({ id, presence, style, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), motion });
    return id;
  }

  thorns(presence: Presence, x0: number, x1: number, groundY: number): string {
    this.mark(x0, x1);
    return this.hazard(presence, HazardStyle.Thorns, x0, groundY - 28, x1 - x0, 28);
  }

  mechanism(presence: Presence, kind: MechanismKind, x: number, y: number): string {
    const id = this.id(kind);
    const crank = kind === MechanismKind.Crank;
    this.mechanisms.push({
      id,
      presence,
      kind,
      x: Math.round(x),
      y: Math.round(y),
      prompt: crank ? 'Turn the winch' : 'Strike the bell',
      message: crank ? 'The winch turns. In the other reality, something answers.' : 'The bell tolls across time. Light gathers in the other reality.',
    });
    this.mark(x - 40, x + 40);
    return id;
  }

  zone(kind: ZoneKind, presence: Presence, x: number, y: number, w: number, h: number, period?: number): string {
    const id = this.id(kind);
    this.zones.push({ id, kind, presence, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), period });
    this.mark(x, x + w);
    return id;
  }

  fragment(kind: FragmentKind, presence: Presence, x: number, y: number, title: string, memory?: string): string {
    const id = this.id(kind);
    this.fragments.push({ id, kind, presence, x: Math.round(x), y: Math.round(y), title, memory });
    return id;
  }

  checkpoint(): void {
    this.checkpoints.push({ id: this.id('checkpoint'), x: Math.round(this.cursor.x), y: Math.round(this.cursor.y) });
    this.mark(this.cursor.x - 30, this.cursor.x + 30);
  }

  hint(x0: number, x1: number, y: number, text: string, touchText?: string): void {
    this.hints.push({ id: this.id('hint'), zone: { x: Math.round(x0), y: Math.round(y - 400), w: Math.round(x1 - x0), h: 480 }, text, touchText });
  }

  mark(x0: number, x1: number): void {
    this.busy.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1) });
  }

  move(x: number, y: number, timeline: Timeline = this.cursor.timeline): void {
    this.cursor = { x: Math.round(x), y: Math.round(y), timeline };
  }

  walk(x: number, tolerance?: number): void {
    this.steps.push({ kind: StepKind.Walk, x: Math.round(x), tolerance });
  }

  leap(x: number, actions?: AirAction[], settle?: boolean): void {
    this.steps.push({ kind: StepKind.Leap, x: Math.round(x), actions, settle });
  }

  shift(to: Timeline): void {
    this.steps.push({ kind: StepKind.Shift, to });
    this.cursor.timeline = to;
  }

  ensure(timeline: Timeline): void {
    if (this.cursor.timeline !== timeline) this.shift(timeline);
  }

  interact(): void {
    this.steps.push({ kind: StepKind.Interact });
  }

  wait(seconds: number): void {
    this.steps.push({ kind: StepKind.Wait, seconds });
  }

  waitMover(id: string, min: number, max: number): void {
    this.steps.push({ kind: StepKind.WaitMover, id, min, max });
  }

  waitHazard(id: string, min: number, max: number): void {
    this.steps.push({ kind: StepKind.WaitHazard, id, min, max });
  }

  waitPulse(min: number, max: number, timeline?: Timeline): void {
    this.steps.push({ kind: StepKind.WaitPulse, min, max, timeline });
  }

  board(id: string, direction: 1 | -1): void {
    this.steps.push({ kind: StepKind.Board, id, direction });
  }

  wallClimb(side: 1 | -1, topY: number, exitX: number): void {
    this.steps.push({ kind: StepKind.WallClimb, side, topY: Math.round(topY), exitX: Math.round(exitX) });
  }
}

export function airShift(to: Timeline, when: Condition): AirAction {
  return { act: AirAct.Shift, to, when };
}

export function airDash(direction: 1 | -1, when: Condition): AirAction {
  return { act: AirAct.Dash, direction, when };
}

export function airJump(when: Condition): AirAction {
  return { act: AirAct.Jump, when };
}

export function retarget(x: number, when: Condition): AirAction {
  return { act: AirAct.Retarget, x: Math.round(x), when };
}
