import { PLAYER_SIZE } from '../../src/core/constants';
import { SimEventType, Timeline } from '../../src/core/enums';
import { clamp } from '../../src/core/geometry';
import { bodyCenterX } from '../../src/core/physics';
import { IDLE_INPUT, type GameSimulation, type SimEvent, type SimInput } from '../../src/core/simulation';

export interface ShiftPlan {
  to: Timeline;
  when: (pilot: Pilot) => boolean;
}

export class Pilot {
  readonly events: SimEvent[] = [];
  steps = 0;

  constructor(
    readonly sim: GameSimulation,
    private readonly allowDeath = false,
    private readonly budget = 120 * 900,
  ) {}

  get cx(): number {
    return bodyCenterX(this.sim.body);
  }

  get feet(): number {
    return this.sim.body.y + PLAYER_SIZE.height;
  }

  private where(): string {
    return `x=${this.cx.toFixed(1)} feet=${this.feet.toFixed(1)} ${this.sim.timeline}`;
  }

  tick(input: Partial<SimInput> = {}): SimEvent[] {
    this.steps += 1;
    if (this.steps > this.budget) {
      throw new Error(`Pilot exceeded its step budget at ${this.where()}`);
    }
    const events = this.sim.step({ ...IDLE_INPUT, ...input });
    this.events.push(...events);
    if (!this.allowDeath && events.some((event) => event.type === SimEventType.Died)) {
      throw new Error(`Pilot died at ${this.where()}`);
    }
    return events;
  }

  wait(seconds: number): void {
    for (let index = 0; index < Math.round(seconds * 120); index++) {
      this.tick();
    }
  }

  shift(to: Timeline): void {
    for (let index = 0; index < 60 && this.sim.timeline !== to; index++) {
      const events = this.tick({ shiftPressed: true });
      if (events.some((event) => event.type === SimEventType.ShiftRejected)) {
        throw new Error(`Shift to ${to} rejected at ${this.where()}`);
      }
    }
    if (this.sim.timeline !== to) {
      throw new Error(`Could not shift to ${to} at ${this.where()}`);
    }
  }

  walkTo(x: number, tolerance = 3): void {
    for (let index = 0; index < 1800; index++) {
      const difference = x - this.cx;
      const body = this.sim.body;
      if (Math.abs(difference) <= tolerance && Math.abs(body.vx) < 1 && body.onGround) {
        return;
      }
      this.tick({ moveX: clamp(difference / 30, -1, 1) });
    }
    throw new Error(`walkTo(${x}) stalled at ${this.where()}`);
  }

  settle(): void {
    for (let index = 0; index < 240; index++) {
      if (this.sim.body.onGround && Math.abs(this.sim.body.vx) < 1) return;
      this.tick();
    }
    throw new Error(`Could not settle at ${this.where()}`);
  }

  leapTo(targetX: number, shifts: ShiftPlan[] = []): void {
    this.settle();
    const pending = [...shifts];
    let airborne = false;
    for (let index = 0; index < 900; index++) {
      const next = pending[0];
      const input: Partial<SimInput> = {
        moveX: clamp((targetX - this.cx) / 16, -1, 1),
        jumpPressed: index === 0,
        jumpHeld: true,
        shiftPressed: Boolean(next && airborne && next.when(this)),
      };
      const events = this.tick(input);
      if (events.some((event) => event.type === SimEventType.ShiftRejected)) {
        throw new Error(`Mid-air shift rejected at ${this.where()}`);
      }
      if (next && this.sim.timeline === next.to && events.some((event) => event.type === SimEventType.TimelineShifted)) {
        pending.shift();
      }
      if (!this.sim.body.onGround) {
        airborne = true;
      } else if (airborne) {
        if (pending.length > 0) {
          throw new Error(`Landed before completing planned shifts at ${this.where()}`);
        }
        return;
      }
    }
    throw new Error(`leapTo(${targetX}) never landed, at ${this.where()}`);
  }

  interact(): SimEvent[] {
    return this.tick({ interactPressed: true });
  }
}

export function feetAbove(y: number): (pilot: Pilot) => boolean {
  return (pilot) => pilot.feet < y;
}

export function descending(pilot: Pilot): boolean {
  return pilot.sim.body.vy > 0;
}
