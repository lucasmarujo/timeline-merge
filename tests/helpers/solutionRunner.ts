import { FIXED_DT, PLAYER_SIZE } from '../../src/core/constants';
import { MotionAxis, SimEventType, SimStatus, type Timeline } from '../../src/core/enums';
import { clamp } from '../../src/core/geometry';
import { bodyCenterX, findSupport } from '../../src/core/physics';
import { IDLE_INPUT, motionOffset, type GameSimulation, type SimEvent, type SimInput } from '../../src/core/simulation';
import type { Motion } from '../../src/core/types';
import { AirAct, StepKind, type AirAction, type Condition, type SolutionStep } from '../../src/levels/solution';

export interface RunResult {
  ticks: number;
  events: SimEvent[];
}

const TICKS_PER_SECOND = Math.round(1 / FIXED_DT);

export class SolutionRunner {
  readonly events: SimEvent[] = [];
  ticks = 0;
  private stepIndex = -1;
  private stepKind = '';

  constructor(
    readonly sim: GameSimulation,
    private readonly budgetSeconds = 900,
  ) {}

  get cx(): number {
    return bodyCenterX(this.sim.body);
  }

  get feet(): number {
    return this.sim.body.y + PLAYER_SIZE.height;
  }

  get finished(): boolean {
    return this.sim.status === SimStatus.Exited || this.sim.status === SimStatus.Finale;
  }

  where(): string {
    return `level=${this.sim.level.id} step#${this.stepIndex} ${this.stepKind} x=${this.cx.toFixed(1)} feet=${this.feet.toFixed(1)} vy=${this.sim.body.vy.toFixed(0)} ${this.sim.timeline} t=${this.sim.worldTime.toFixed(2)}`;
  }

  fail(reason: string): never {
    throw new Error(`${reason} at ${this.where()}`);
  }

  tick(input: Partial<SimInput> = {}): SimEvent[] {
    this.ticks += 1;
    if (this.ticks > this.budgetSeconds * TICKS_PER_SECOND) this.fail('exceeded the time budget');
    const events = this.sim.step({ ...IDLE_INPUT, ...input });
    this.events.push(...events);
    const death = events.find((event) => event.type === SimEventType.Died);
    if (death && death.type === SimEventType.Died) this.fail(`died (${death.cause})`);
    return events;
  }

  run(steps: readonly SolutionStep[]): RunResult {
    steps.forEach((step, index) => {
      this.stepIndex = index;
      this.stepKind = step.kind;
      if (!this.finished) this.execute(step);
    });
    return { ticks: this.ticks, events: this.events };
  }

  private execute(step: SolutionStep): void {
    switch (step.kind) {
      case StepKind.Walk:
        this.walk(step.x, step.tolerance ?? 3);
        break;
      case StepKind.Leap:
        this.leap(step.x, step.actions ?? [], step.settle ?? true);
        break;
      case StepKind.Shift:
        this.shift(step.to);
        break;
      case StepKind.Interact:
        this.interact();
        break;
      case StepKind.Wait:
        for (let index = 0; index < Math.round(step.seconds * TICKS_PER_SECOND); index++) this.tick();
        break;
      case StepKind.WaitMover:
        this.waitFor(() => {
          const def = this.sim.level.solids.find((solid) => solid.id === step.id);
          const live = this.sim.liveSolid(step.id);
          if (!def?.motion || !live) this.fail(`unknown mover ${step.id}`);
          const value = def.motion.axis === MotionAxis.X ? live.x : live.y;
          return value >= step.min && value <= step.max;
        }, 30);
        break;
      case StepKind.WaitHazard:
        this.waitFor(() => {
          const live = this.sim.liveHazard(step.id);
          const def = this.sim.level.hazards.find((hazard) => hazard.id === step.id);
          if (!def?.motion || !live) this.fail(`unknown hazard ${step.id}`);
          const value = def.motion.axis === MotionAxis.X ? live.x : live.y;
          return value >= step.min && value <= step.max;
        }, 30);
        break;
      case StepKind.WaitPulse:
        this.waitFor(() => {
          const reading = this.sim.pulseReading();
          if (step.timeline !== undefined && this.sim.timeline !== step.timeline) return false;
          return reading !== null && reading.progress >= step.min && reading.progress <= step.max;
        }, 30);
        break;
      case StepKind.Board:
        this.board(step.id, step.direction);
        break;
      case StepKind.WallClimb:
        this.wallClimb(step.side, step.topY, step.exitX);
        break;
    }
  }

  private waitFor(predicate: () => boolean, maxSeconds: number): void {
    for (let index = 0; index < maxSeconds * TICKS_PER_SECOND; index++) {
      if (predicate()) return;
      this.tick();
      if (this.finished) return;
    }
    this.fail('waited too long');
  }

  settle(): void {
    for (let index = 0; index < 2 * TICKS_PER_SECOND; index++) {
      if (this.sim.body.onGround && Math.abs(this.sim.body.vx) < 1) return;
      this.tick();
    }
    this.fail('could not settle');
  }

  walk(x: number, tolerance: number): void {
    for (let index = 0; index < 20 * TICKS_PER_SECOND; index++) {
      const difference = x - this.cx;
      const body = this.sim.body;
      if (Math.abs(difference) <= tolerance && Math.abs(body.vx) < 1 && body.onGround) return;
      this.tick({ moveX: clamp(difference / 30, -1, 1) });
      if (this.finished) return;
    }
    this.fail(`walk(${x}) stalled`);
  }

  private met(when: Condition, direction: number, elapsed: number): boolean {
    const body = this.sim.body;
    if (when.feetAbove !== undefined && !(this.feet < when.feetAbove)) return false;
    if (when.feetBelow !== undefined && !(this.feet > when.feetBelow)) return false;
    if (when.ascending && !(body.vy < 0)) return false;
    if (when.descending && !(body.vy > 0)) return false;
    if (when.xPast !== undefined && (this.cx - when.xPast) * direction < 0) return false;
    if (when.afterSeconds !== undefined && elapsed < when.afterSeconds) return false;
    return true;
  }

  leap(x: number, actions: readonly AirAction[], settle: boolean): void {
    if (settle) this.settle();
    let target = x;
    const direction = Math.sign(x - this.cx) || 1;
    const pending = [...actions];
    let airborne = false;
    let released = false;
    let first = true;
    for (let index = 0; index < 8 * TICKS_PER_SECOND; index++) {
      const elapsed = index * FIXED_DT;
      const input: Partial<SimInput> = { moveX: clamp((target - this.cx) / 16, -1, 1), jumpHeld: !released, jumpPressed: first };
      first = false;
      const next = pending[0];
      let expectShift = false;
      if (next && airborne && this.met(next.when, direction, elapsed)) {
        pending.shift();
        if (next.act === AirAct.Shift) {
          if (this.sim.timeline === next.to) this.fail(`already in ${next.to}`);
          input.shiftPressed = true;
          expectShift = true;
        } else if (next.act === AirAct.Dash) {
          input.dashPressed = true;
          if (next.direction) input.moveX = next.direction;
        } else if (next.act === AirAct.Jump) {
          input.jumpPressed = true;
        } else if (next.act === AirAct.Retarget) {
          target = next.x ?? target;
        } else {
          released = true;
          input.jumpHeld = false;
        }
      }
      const events = this.tick(input);
      if (expectShift) {
        const rejected = events.find((event) => event.type === SimEventType.ShiftRejected);
        if (rejected && rejected.type === SimEventType.ShiftRejected) this.fail(`mid-air shift rejected (${rejected.reason})`);
      }
      if (this.finished) return;
      if (!this.sim.body.onGround) {
        airborne = true;
      } else if (airborne) {
        if (pending.length > 0) this.fail(`landed with ${pending.length} pending air actions`);
        return;
      }
    }
    this.fail(`leap(${x}) never landed`);
  }

  shift(to: Timeline): void {
    for (let index = 0; index < TICKS_PER_SECOND && this.sim.timeline !== to; index++) {
      const events = this.tick({ shiftPressed: true });
      const rejected = events.find((event) => event.type === SimEventType.ShiftRejected);
      if (rejected && rejected.type === SimEventType.ShiftRejected) this.fail(`shift to ${to} rejected (${rejected.reason})`);
    }
    if (this.sim.timeline !== to) this.fail(`could not shift to ${to}`);
  }

  interact(): void {
    const events = this.tick({ interactPressed: true });
    const answered = events.some((event) =>
      [SimEventType.MechanismActivated, SimEventType.PortalActivated, SimEventType.PortalUnstable].includes(event.type),
    );
    if (!answered) this.fail('nothing answered the interaction');
  }

  board(id: string, direction: 1 | -1): void {
    for (let index = 0; index < 4 * TICKS_PER_SECOND; index++) {
      const mover = this.sim.liveSolid(id);
      if (!mover) this.fail(`unknown mover ${id}`);
      const support = this.sim.body.onGround ? findSupport(this.sim.body, this.sim.solidsIn(this.sim.timeline)) : null;
      const inside = direction > 0 ? this.cx >= mover.x + 34 : this.cx <= mover.x + mover.w - 34;
      if (support === mover && inside) {
        for (let still = 0; still < 30; still++) this.tick();
        return;
      }
      this.tick({ moveX: direction });
      if (this.finished) return;
    }
    this.fail(`could not board ${id}`);
  }

  wallClimb(side: 1 | -1, topY: number, exitX: number): void {
    this.settle();
    let direction: number = side;
    let airborne = false;
    let first = true;
    let climbing = true;
    for (let index = 0; index < 12 * TICKS_PER_SECOND; index++) {
      const body = this.sim.body;
      const input: Partial<SimInput> = { jumpHeld: true, jumpPressed: first, moveX: direction };
      first = false;
      if (climbing && this.feet < topY) climbing = false;
      if (!climbing) {
        input.moveX = clamp((exitX - this.cx) / 16, -1, 1);
      } else if (airborne && body.wall === direction && body.vy > -260) {
        input.jumpPressed = true;
        direction = -direction;
      }
      this.tick(input);
      if (this.finished) return;
      if (!this.sim.body.onGround) {
        airborne = true;
      } else if (airborne && !climbing) {
        return;
      } else if (airborne) {
        airborne = false;
        first = true;
        direction = side;
      }
    }
    this.fail('wall climb never reached the top');
  }
}

export function runSolution(sim: GameSimulation, steps: readonly SolutionStep[], budgetSeconds?: number): RunResult {
  return new SolutionRunner(sim, budgetSeconds).run(steps);
}

export function moverValue(motion: Motion, base: number, time: number): number {
  return base + motionOffset(motion, time);
}
