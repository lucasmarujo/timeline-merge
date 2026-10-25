import {
  CHECKPOINT_TRIGGER,
  DEATH_DURATION,
  FINALE_WALK_TOLERANCE,
  FIXED_DT,
  FRAGMENT_RADIUS,
  FRAGMENTS_REQUIRED,
  HAZARD_INSET,
  INTERACT_RADIUS,
  PLAYER_SIZE,
  SHIFT,
} from './constants';
import {
  DeathCause,
  InteractionBlock,
  InteractionKind,
  SimEventType,
  SimStatus,
  SwitchRejection,
  Timeline,
} from './enums';
import { circleOverlapsRect, clamp, containsPoint, inset, overlaps, overlapsAny } from './geometry';
import {
  bodyCenterX,
  bodyCenterY,
  bodyRect,
  createBody,
  isSupported,
  placeBody,
  stepBody,
  type Body,
} from './physics';
import { existsIn, findSafePlacement, isConditionMet, otherTimeline, type Placement } from './timeline';
import type {
  AreaDef,
  CheckpointDef,
  FragmentDef,
  LevelDef,
  MechanismDef,
  Rect,
  SolidDef,
} from './types';

export interface SimInput {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  shiftPressed: boolean;
  interactPressed: boolean;
}

export const IDLE_INPUT: Readonly<SimInput> = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  shiftPressed: false,
  interactPressed: false,
};

export interface InteractionTarget {
  kind: InteractionKind;
  id: string;
  x: number;
  y: number;
  available: boolean;
  block?: InteractionBlock;
  requiredTimeline?: Timeline;
}

export type SimEvent =
  | { type: SimEventType.Jumped }
  | { type: SimEventType.Landed; impactSpeed: number }
  | { type: SimEventType.TimelineShifted; to: Timeline; nudged: boolean }
  | { type: SimEventType.ShiftRejected; reason: SwitchRejection }
  | { type: SimEventType.FragmentCollected; fragment: FragmentDef; count: number }
  | { type: SimEventType.CheckpointReached; checkpoint: CheckpointDef }
  | { type: SimEventType.MechanismActivated; mechanism: MechanismDef }
  | { type: SimEventType.InteractionRefused; target: InteractionTarget }
  | { type: SimEventType.Died; cause: DeathCause }
  | { type: SimEventType.Respawned; checkpointId: string; timeline: Timeline }
  | { type: SimEventType.PortalUnstable; missing: number }
  | { type: SimEventType.PortalActivated }
  | { type: SimEventType.AreaEntered; area: AreaDef };

export interface RespawnPoint {
  id: string;
  x: number;
  y: number;
  timeline: Timeline;
}

export interface SimStats {
  deaths: number;
  shifts: number;
  time: number;
}

export const SPAWN_CHECKPOINT_ID = 'spawn';

const SETTLE_SEARCH = 64;

export class GameSimulation {
  readonly level: LevelDef;
  readonly body: Body;
  readonly stats: SimStats = { deaths: 0, shifts: 0, time: 0 };
  timeline: Timeline = Timeline.Dawn;
  status: SimStatus = SimStatus.Alive;
  respawnPoint!: RespawnPoint;
  currentArea: AreaDef | null = null;

  private readonly collected = new Set<string>();
  private readonly activated = new Set<string>();
  private shiftCooldown = 0;
  private deathTimer = 0;
  private solids: Record<Timeline, SolidDef[]> = { [Timeline.Dawn]: [], [Timeline.Eclipse]: [] };
  private hazards: Record<Timeline, Rect[]> = { [Timeline.Dawn]: [], [Timeline.Eclipse]: [] };

  constructor(level: LevelDef) {
    this.level = level;
    this.body = createBody(level.spawn.x, level.spawn.y);
    this.reset();
  }

  reset(): void {
    this.collected.clear();
    this.activated.clear();
    this.stats.deaths = 0;
    this.stats.shifts = 0;
    this.stats.time = 0;
    this.timeline = Timeline.Dawn;
    this.status = SimStatus.Alive;
    this.shiftCooldown = 0;
    this.deathTimer = 0;
    this.currentArea = null;
    this.respawnPoint = {
      id: SPAWN_CHECKPOINT_ID,
      x: this.level.spawn.x,
      y: this.level.spawn.y,
      timeline: Timeline.Dawn,
    };
    this.rebuildCaches();
    placeBody(this.body, this.level.spawn.x, this.level.spawn.y);
    this.body.facing = 1;
    this.body.onGround = isSupported(this.body, this.solids[this.timeline]);
  }

  get fragmentCount(): number {
    return this.collected.size;
  }

  hasFragment(id: string): boolean {
    return this.collected.has(id);
  }

  isMechanismActive(id: string): boolean {
    return this.activated.has(id);
  }

  isSolidMaterialized(solid: SolidDef): boolean {
    return isConditionMet(solid.condition, (id) => this.activated.has(id));
  }

  solidsIn(timeline: Timeline): readonly SolidDef[] {
    return this.solids[timeline];
  }

  step(input: Readonly<SimInput>, dt: number = FIXED_DT): SimEvent[] {
    const events: SimEvent[] = [];

    if (this.status === SimStatus.Dead) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.respawnInto(events);
      }
      return events;
    }

    if (this.status === SimStatus.Finale) {
      this.stepFinale(dt);
      return events;
    }

    this.stats.time += dt;
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);

    if (input.shiftPressed && this.shiftCooldown === 0) {
      this.tryShift(events);
    }

    const outcome = stepBody(this.body, input, this.solids[this.timeline], dt);
    if (outcome.jumped) {
      events.push({ type: SimEventType.Jumped });
    }
    if (outcome.landed) {
      events.push({ type: SimEventType.Landed, impactSpeed: outcome.impactSpeed });
    }

    this.clampToBounds();

    if (this.body.y > this.level.killY) {
      this.die(DeathCause.Fall, events);
      return events;
    }
    if (overlapsAny(inset(bodyRect(this.body), HAZARD_INSET), this.hazards[this.timeline])) {
      this.die(DeathCause.Hazard, events);
      return events;
    }

    this.collectFragments(events);
    this.reachCheckpoints(events);
    if (input.interactPressed) {
      this.interact(events);
    }
    this.updateArea(events);

    return events;
  }

  respawn(): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.status === SimStatus.Finale) {
      return events;
    }
    this.respawnInto(events);
    return events;
  }

  previewShift(): Placement {
    const target = otherTimeline(this.timeline);
    return findSafePlacement(
      bodyRect(this.body),
      this.solids[target],
      this.hazards[target],
      SHIFT.maxNudge,
    );
  }

  getInteraction(): InteractionTarget | null {
    const cx = bodyCenterX(this.body);
    const cy = bodyCenterY(this.body);
    let best: InteractionTarget | null = null;
    let bestDistance = INTERACT_RADIUS * INTERACT_RADIUS;

    for (const mechanism of this.level.mechanisms) {
      if (this.activated.has(mechanism.id)) continue;
      const dx = mechanism.x - cx;
      const dy = mechanism.y - PLAYER_SIZE.height / 2 - cy;
      const distance = dx * dx + dy * dy;
      if (distance > bestDistance) continue;
      const available = existsIn(mechanism.presence, this.timeline);
      bestDistance = distance;
      best = {
        kind: InteractionKind.Mechanism,
        id: mechanism.id,
        x: mechanism.x,
        y: mechanism.y,
        available,
        block: available ? undefined : InteractionBlock.WrongTimeline,
        requiredTimeline: available ? undefined : otherTimeline(this.timeline),
      };
    }

    if (best) return best;

    const portal = this.level.portal;
    if (overlaps(bodyRect(this.body), portal.zone)) {
      const available = this.collected.size >= FRAGMENTS_REQUIRED;
      return {
        kind: InteractionKind.Portal,
        id: 'portal',
        x: portal.x,
        y: portal.y,
        available,
        block: available ? undefined : InteractionBlock.MissingFragments,
      };
    }

    return null;
  }

  private rebuildCaches(): void {
    const isActive = (id: string): boolean => this.activated.has(id);
    for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
      this.solids[timeline] = this.level.solids.filter(
        (solid) => existsIn(solid.presence, timeline) && isConditionMet(solid.condition, isActive),
      );
      this.hazards[timeline] = this.level.hazards
        .filter((hazard) => existsIn(hazard.presence, timeline))
        .map((hazard) => ({ x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h }));
    }
  }

  private tryShift(events: SimEvent[]): void {
    const placement = this.previewShift();
    this.shiftCooldown = SHIFT.cooldown;
    if (!placement.ok) {
      events.push({ type: SimEventType.ShiftRejected, reason: placement.reason });
      return;
    }
    this.body.x += placement.dx;
    this.body.y += placement.dy;
    this.timeline = otherTimeline(this.timeline);
    this.stats.shifts += 1;
    this.body.onGround = isSupported(this.body, this.solids[this.timeline]);
    events.push({ type: SimEventType.TimelineShifted, to: this.timeline, nudged: placement.nudged });
  }

  private clampToBounds(): void {
    const bounds = this.level.bounds;
    const clamped = clamp(this.body.x, bounds.x, bounds.x + bounds.w - PLAYER_SIZE.width);
    if (clamped !== this.body.x) {
      this.body.x = clamped;
      this.body.vx = 0;
    }
  }

  private die(cause: DeathCause, events: SimEvent[]): void {
    this.status = SimStatus.Dead;
    this.deathTimer = DEATH_DURATION;
    this.stats.deaths += 1;
    this.body.vx = 0;
    this.body.vy = 0;
    events.push({ type: SimEventType.Died, cause });
  }

  private respawnInto(events: SimEvent[]): void {
    const point = this.respawnPoint;
    placeBody(this.body, point.x, point.y);
    this.timeline = point.timeline;
    this.status = SimStatus.Alive;
    this.deathTimer = 0;
    this.shiftCooldown = 0;
    this.settleBody();
    this.body.onGround = isSupported(this.body, this.solids[this.timeline]);
    events.push({ type: SimEventType.Respawned, checkpointId: point.id, timeline: point.timeline });
  }

  private settleBody(): void {
    const solids = this.solids[this.timeline];
    const lifted = bodyRect(this.body);
    if (!overlapsAny(lifted, solids)) return;
    for (let lift = 1; lift <= SETTLE_SEARCH; lift++) {
      lifted.y = this.body.y - lift;
      if (!overlapsAny(lifted, solids)) {
        this.body.y = lifted.y;
        this.body.vy = 0;
        return;
      }
    }
    const placement = findSafePlacement(bodyRect(this.body), solids, [], SETTLE_SEARCH);
    if (placement.ok) {
      this.body.x += placement.dx;
      this.body.y += placement.dy;
    }
  }

  private collectFragments(events: SimEvent[]): void {
    const rect = bodyRect(this.body);
    for (const fragment of this.level.fragments) {
      if (this.collected.has(fragment.id)) continue;
      if (!existsIn(fragment.presence, this.timeline)) continue;
      if (!circleOverlapsRect(fragment.x, fragment.y, FRAGMENT_RADIUS, rect)) continue;
      this.collected.add(fragment.id);
      events.push({
        type: SimEventType.FragmentCollected,
        fragment,
        count: this.collected.size,
      });
    }
  }

  private reachCheckpoints(events: SimEvent[]): void {
    const rect = bodyRect(this.body);
    for (const checkpoint of this.level.checkpoints) {
      const trigger: Rect = {
        x: checkpoint.x - CHECKPOINT_TRIGGER.halfWidth,
        y: checkpoint.y - CHECKPOINT_TRIGGER.height,
        w: CHECKPOINT_TRIGGER.halfWidth * 2,
        h: CHECKPOINT_TRIGGER.height,
      };
      if (!overlaps(rect, trigger)) continue;
      const isNew = this.respawnPoint.id !== checkpoint.id;
      this.respawnPoint = {
        id: checkpoint.id,
        x: checkpoint.x,
        y: checkpoint.y,
        timeline: this.timeline,
      };
      if (isNew) {
        events.push({ type: SimEventType.CheckpointReached, checkpoint });
      }
    }
  }

  private interact(events: SimEvent[]): void {
    const target = this.getInteraction();
    if (!target) return;

    if (target.kind === InteractionKind.Portal) {
      if (!target.available) {
        events.push({
          type: SimEventType.PortalUnstable,
          missing: FRAGMENTS_REQUIRED - this.collected.size,
        });
        return;
      }
      this.status = SimStatus.Finale;
      this.body.vx = 0;
      events.push({ type: SimEventType.PortalActivated });
      return;
    }

    if (!target.available) {
      events.push({ type: SimEventType.InteractionRefused, target });
      return;
    }

    const mechanism = this.level.mechanisms.find((candidate) => candidate.id === target.id);
    if (!mechanism) return;
    this.activated.add(mechanism.id);
    this.rebuildCaches();
    this.settleBody();
    events.push({ type: SimEventType.MechanismActivated, mechanism });
  }

  private updateArea(events: SimEvent[]): void {
    const cx = bodyCenterX(this.body);
    const cy = bodyCenterY(this.body);
    const area = this.level.areas.find((candidate) => containsPoint(candidate.zone, cx, cy)) ?? null;
    if (area && area.id !== this.currentArea?.id) {
      this.currentArea = area;
      events.push({ type: SimEventType.AreaEntered, area });
    }
  }

  private stepFinale(dt: number): void {
    const difference = this.level.portal.standX - bodyCenterX(this.body);
    const arrived = Math.abs(difference) <= FINALE_WALK_TOLERANCE;
    const moveX = arrived ? 0 : clamp(difference / 24, -1, 1);
    stepBody(this.body, { moveX, jumpPressed: false, jumpHeld: false }, this.solids[this.timeline], dt);
    if (arrived && this.body.onGround) {
      this.body.facing = this.level.portal.x >= bodyCenterX(this.body) ? 1 : -1;
    }
  }
}
