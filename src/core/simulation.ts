import {
  CHECKPOINT_TRIGGER,
  CRUMBLE,
  DEATH_DURATION,
  FINALE_WALK_TOLERANCE,
  FIXED_DT,
  FRAGMENT_RADIUS,
  HAZARD_INSET,
  INTERACT_RADIUS,
  PLAYER_SIZE,
  SHIFT,
  UPDRAFT,
} from './constants';
import {
  Ability,
  DeathCause,
  ExitKind,
  FragmentKind,
  InteractionBlock,
  InteractionKind,
  MotionAxis,
  SimEventType,
  SimStatus,
  SwitchRejection,
  Timeline,
  ZoneKind,
} from './enums';
import { circleOverlapsRect, clamp, containsPoint, inset, overlaps, overlapsAny } from './geometry';
import {
  bodyCenterX,
  bodyCenterY,
  bodyRect,
  createBody,
  findSupport,
  isSupported,
  placeBody,
  stepBody,
  type Body,
  type Capabilities,
} from './physics';
import { existsIn, findSafePlacement, isConditionMet, otherTimeline, type Placement } from './timeline';
import type {
  AreaDef,
  CheckpointDef,
  FragmentDef,
  HazardDef,
  LevelDef,
  MechanismDef,
  Motion,
  Rect,
  SolidDef,
  ZoneDef,
} from './types';

export interface SimInput {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  shiftPressed: boolean;
  interactPressed: boolean;
  dashPressed: boolean;
}

export const IDLE_INPUT: Readonly<SimInput> = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  shiftPressed: false,
  interactPressed: false,
  dashPressed: false,
};

export const ALL_ABILITIES: ReadonlySet<Ability> = new Set(Object.values(Ability));

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
  | { type: SimEventType.AirJumped }
  | { type: SimEventType.WallJumped }
  | { type: SimEventType.Dashed }
  | { type: SimEventType.Landed; impactSpeed: number }
  | { type: SimEventType.TimelineShifted; to: Timeline; nudged: boolean }
  | { type: SimEventType.PulseShifted; to: Timeline }
  | { type: SimEventType.ShiftRejected; reason: SwitchRejection }
  | { type: SimEventType.FragmentCollected; fragment: FragmentDef; count: number; required: number }
  | { type: SimEventType.CheckpointReached; checkpoint: CheckpointDef }
  | { type: SimEventType.MechanismActivated; mechanism: MechanismDef }
  | { type: SimEventType.InteractionRefused; target: InteractionTarget }
  | { type: SimEventType.Crumbled; solid: SolidDef }
  | { type: SimEventType.Reformed; solid: SolidDef }
  | { type: SimEventType.Died; cause: DeathCause }
  | { type: SimEventType.Respawned; checkpointId: string; timeline: Timeline }
  | { type: SimEventType.PortalUnstable; missing: number }
  | { type: SimEventType.PortalActivated }
  | { type: SimEventType.ExitReached }
  | { type: SimEventType.UnravelingAwakened }
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

export interface CrumbleState {
  timer: number;
  broken: number;
}

export interface PulseReading {
  zone: ZoneDef;
  progress: number;
}

export const SPAWN_CHECKPOINT_ID = 'spawn';

const SETTLE_SEARCH = 64;

export function motionOffset(motion: Motion, time: number): number {
  return motion.range * (0.5 - 0.5 * Math.cos(Math.PI * 2 * (time / motion.period + motion.phase)));
}

function applyMotion(target: Rect, base: Rect, motion: Motion | undefined, time: number): void {
  if (!motion) return;
  const offset = motionOffset(motion, time);
  target.x = motion.axis === MotionAxis.X ? base.x + offset : base.x;
  target.y = motion.axis === MotionAxis.Y ? base.y + offset : base.y;
}

export class GameSimulation {
  readonly level: LevelDef;
  readonly abilities: ReadonlySet<Ability>;
  readonly body: Body;
  readonly stats: SimStats = { deaths: 0, shifts: 0, time: 0 };
  timeline: Timeline = Timeline.Dawn;
  status: SimStatus = SimStatus.Alive;
  respawnPoint!: RespawnPoint;
  currentArea: AreaDef | null = null;
  worldTime = 0;
  unravelingX: number | null = null;

  private readonly collected = new Set<string>();
  private readonly activated = new Set<string>();
  private readonly liveSolids: SolidDef[];
  private readonly liveHazards: HazardDef[];
  private readonly baseSolids = new Map<string, SolidDef>();
  private readonly movingSolids: SolidDef[];
  private readonly movingHazards: Array<{ live: HazardDef; base: HazardDef }>;
  private readonly crumbles = new Map<string, CrumbleState>();
  private readonly pulseMarks = new Map<string, number>();
  private readonly capabilities: Capabilities;
  private readonly memoriesRequired: number;
  private shiftCooldown = 0;
  private deathTimer = 0;
  private solids: Record<Timeline, SolidDef[]> = { [Timeline.Dawn]: [], [Timeline.Eclipse]: [] };
  private hazards: Record<Timeline, Rect[]> = { [Timeline.Dawn]: [], [Timeline.Eclipse]: [] };

  constructor(level: LevelDef, abilities: ReadonlySet<Ability> = ALL_ABILITIES) {
    this.level = level;
    this.abilities = abilities;
    this.capabilities = {
      dash: abilities.has(Ability.Dash),
      glide: abilities.has(Ability.Glide),
      wallGrip: abilities.has(Ability.WallGrip),
    };
    this.memoriesRequired = level.portal.kind === ExitKind.Shattered ? level.fragments.filter((fragment) => fragment.kind === FragmentKind.Memory).length : 0;
    this.liveSolids = level.solids.map((solid) => ({ ...solid }));
    this.liveHazards = level.hazards.map((hazard) => ({ ...hazard }));
    for (const solid of level.solids) this.baseSolids.set(solid.id, solid);
    this.movingSolids = this.liveSolids.filter((solid) => solid.motion !== undefined);
    this.movingHazards = this.liveHazards
      .map((live, index) => ({ live, base: level.hazards[index] as HazardDef }))
      .filter((entry) => entry.live.motion !== undefined);
    this.body = createBody(level.spawn.x, level.spawn.y);
    this.reset();
  }

  reset(): void {
    this.collected.clear();
    this.activated.clear();
    this.crumbles.clear();
    this.pulseMarks.clear();
    this.stats.deaths = 0;
    this.stats.shifts = 0;
    this.stats.time = 0;
    this.worldTime = 0;
    this.unravelingX = null;
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
    this.moveWorld();
    this.rebuildCaches();
    placeBody(this.body, this.level.spawn.x, this.level.spawn.y);
    this.body.facing = 1;
    this.body.onGround = isSupported(this.body, this.solids[this.timeline]);
  }

  get fragmentCount(): number {
    return this.level.fragments.filter((fragment) => fragment.kind === FragmentKind.Memory && this.collected.has(fragment.id)).length;
  }

  get fragmentsRequired(): number {
    return this.memoriesRequired;
  }

  get shardCollected(): boolean {
    return this.level.fragments.some((fragment) => fragment.kind === FragmentKind.Shard && this.collected.has(fragment.id));
  }

  hasAbility(ability: Ability): boolean {
    return this.abilities.has(ability);
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

  isSolidBroken(id: string): boolean {
    return (this.crumbles.get(id)?.broken ?? 0) > 0;
  }

  crumbleState(id: string): CrumbleState | null {
    return this.crumbles.get(id) ?? null;
  }

  liveSolid(id: string): Rect | null {
    return this.liveSolids.find((solid) => solid.id === id) ?? null;
  }

  liveHazard(id: string): Rect | null {
    return this.liveHazards.find((hazard) => hazard.id === id) ?? null;
  }

  solidsIn(timeline: Timeline): readonly SolidDef[] {
    return this.solids[timeline];
  }

  pulseReading(): PulseReading | null {
    const zone = this.zoneAt(ZoneKind.Pulse, this.timeline, true);
    if (!zone || !zone.period) return null;
    return { zone, progress: (this.worldTime % zone.period) / zone.period };
  }

  isAnchored(): boolean {
    return this.zoneAt(ZoneKind.Anchor, this.timeline, false) !== null;
  }

  step(input: Readonly<SimInput>, dt: number = FIXED_DT): SimEvent[] {
    const events: SimEvent[] = [];

    if (this.status === SimStatus.Dead) {
      this.worldTime += dt;
      this.moveWorld();
      this.tickCrumbles(dt, null, events);
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

    if (this.status === SimStatus.Exited) {
      stepBody(this.body, { moveX: 0, jumpPressed: false, jumpHeld: false }, this.solids[this.timeline], dt);
      return events;
    }

    this.stats.time += dt;
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);

    const carrier = this.body.onGround ? findSupport(this.body, this.solids[this.timeline]) : null;
    const before = carrier && (carrier as SolidDef).motion ? { x: carrier.x, y: carrier.y } : null;
    this.worldTime += dt;
    this.moveWorld();
    if (carrier && before) {
      this.body.x += carrier.x - before.x;
      this.body.y += carrier.y - before.y;
    }
    if (this.resolveMovers(events)) return events;

    this.stepPulse(events);

    if (input.shiftPressed && this.shiftCooldown === 0) {
      this.tryShift(events, false);
    }

    const lift = this.zoneAt(ZoneKind.Updraft, this.timeline, false) ? UPDRAFT.lift : 0;
    const outcome = stepBody(
      this.body,
      { moveX: input.moveX, jumpPressed: input.jumpPressed, jumpHeld: input.jumpHeld, dashPressed: input.dashPressed, lift },
      this.solids[this.timeline],
      dt,
      this.capabilities,
    );
    if (outcome.dashed) events.push({ type: SimEventType.Dashed });
    if (outcome.wallJumped) events.push({ type: SimEventType.WallJumped });
    else if (outcome.airJumped) events.push({ type: SimEventType.AirJumped });
    else if (outcome.jumped) events.push({ type: SimEventType.Jumped });
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
    if (this.stepUnraveling(dt, events)) return events;

    this.tickCrumbles(dt, this.body.onGround ? findSupport(this.body, this.solids[this.timeline]) : null, events);
    this.collectFragments(events);
    this.reachCheckpoints(events);
    if (input.interactPressed) {
      this.interact(events);
    }
    this.reachExit(events);
    this.updateArea(events);

    return events;
  }

  respawn(): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.status === SimStatus.Finale || this.status === SimStatus.Exited) {
      return events;
    }
    this.respawnInto(events);
    return events;
  }

  previewShift(): Placement {
    const gate = this.shiftGate();
    if (gate) return { ok: false, reason: gate };
    return this.placementInOtherTimeline();
  }

  getInteraction(): InteractionTarget | null {
    const cx = bodyCenterX(this.body);
    const cy = bodyCenterY(this.body);
    let best: InteractionTarget | null = null;
    let bestDistance = INTERACT_RADIUS * INTERACT_RADIUS;

    if (this.abilities.has(Ability.Interact)) {
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
    }

    if (best) return best;

    const portal = this.level.portal;
    if (portal.kind === ExitKind.Shattered && overlaps(bodyRect(this.body), portal.zone)) {
      const available = this.fragmentCount >= this.memoriesRequired;
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

  private moveWorld(): void {
    for (const solid of this.movingSolids) {
      applyMotion(solid, this.baseSolids.get(solid.id) as SolidDef, solid.motion, this.worldTime);
    }
    for (const { live, base } of this.movingHazards) {
      applyMotion(live, base, live.motion, this.worldTime);
    }
  }

  private resolveMovers(events: SimEvent[]): boolean {
    const solids = this.solids[this.timeline];
    for (const mover of this.movingSolids) {
      if (!existsIn(mover.presence, this.timeline) || !solids.includes(mover)) continue;
      if (!overlaps(bodyRect(this.body), mover)) continue;
      const motion = mover.motion as Motion;
      const ahead = motionOffset(motion, this.worldTime + FIXED_DT) - motionOffset(motion, this.worldTime);
      const centerX = mover.x + mover.w / 2;
      if (motion.axis === MotionAxis.Y) {
        if (ahead < 0 || bodyCenterY(this.body) < mover.y + mover.h / 2) {
          this.body.y = mover.y - PLAYER_SIZE.height;
          this.body.vy = Math.min(this.body.vy, 0);
        } else {
          this.body.y = mover.y + mover.h;
        }
      } else if (bodyCenterX(this.body) < centerX) {
        this.body.x = mover.x - PLAYER_SIZE.width;
      } else {
        this.body.x = mover.x + mover.w;
      }
      if (overlapsAny(bodyRect(this.body), solids.filter((solid) => solid !== mover))) {
        this.die(DeathCause.Crush, events);
        return true;
      }
    }
    return false;
  }

  private zoneAt(kind: ZoneKind, timeline: Timeline, byCenter: boolean): ZoneDef | null {
    const cx = bodyCenterX(this.body);
    const cy = bodyCenterY(this.body);
    const rect = bodyRect(this.body);
    for (const zone of this.level.zones) {
      if (zone.kind !== kind || !existsIn(zone.presence, timeline)) continue;
      if (byCenter ? containsPoint(zone, cx, cy) : overlaps(rect, zone)) return zone;
    }
    return null;
  }

  private rebuildCaches(): void {
    const isActive = (id: string): boolean => this.activated.has(id);
    for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
      this.solids[timeline] = this.liveSolids.filter(
        (solid) => existsIn(solid.presence, timeline) && isConditionMet(solid.condition, isActive) && !this.isSolidBroken(solid.id),
      );
      this.hazards[timeline] = this.liveHazards.filter((hazard) => existsIn(hazard.presence, timeline));
    }
  }

  private shiftGate(): SwitchRejection | null {
    if (!this.abilities.has(Ability.Shift)) return SwitchRejection.Locked;
    if (!this.body.onGround && !this.abilities.has(Ability.AirShift)) return SwitchRejection.Grounded;
    if (this.isAnchored() || this.zoneAt(ZoneKind.Pulse, this.timeline, true)) return SwitchRejection.Anchored;
    return null;
  }

  private placementInOtherTimeline(): Placement {
    const target = otherTimeline(this.timeline);
    return findSafePlacement(bodyRect(this.body), this.solids[target], this.hazards[target], SHIFT.maxNudge);
  }

  private tryShift(events: SimEvent[], forced: boolean): boolean {
    this.shiftCooldown = SHIFT.cooldown;
    const gate = forced ? null : this.shiftGate();
    const placement: Placement = gate ? { ok: false, reason: gate } : this.placementInOtherTimeline();
    if (!placement.ok) {
      events.push({ type: SimEventType.ShiftRejected, reason: placement.reason });
      return false;
    }
    const airborne = !this.body.onGround;
    this.body.x += placement.dx;
    this.body.y += placement.dy;
    this.timeline = otherTimeline(this.timeline);
    this.stats.shifts += 1;
    this.body.onGround = isSupported(this.body, this.solids[this.timeline]);
    if (airborne && !this.body.onGround) {
      if (this.abilities.has(Ability.RiftLeap)) this.body.airJumps = Math.max(this.body.airJumps, 1);
      if (this.abilities.has(Ability.RiftChain)) this.body.dashReady = true;
    }
    if (forced) {
      events.push({ type: SimEventType.PulseShifted, to: this.timeline });
    } else {
      events.push({ type: SimEventType.TimelineShifted, to: this.timeline, nudged: placement.nudged });
    }
    return true;
  }

  private stepPulse(events: SimEvent[]): void {
    const zone = this.zoneAt(ZoneKind.Pulse, this.timeline, true);
    for (const id of [...this.pulseMarks.keys()]) {
      if (id !== zone?.id) this.pulseMarks.delete(id);
    }
    if (!zone || !zone.period) return;
    const mark = Math.floor(this.worldTime / zone.period);
    const previous = this.pulseMarks.get(zone.id);
    this.pulseMarks.set(zone.id, mark);
    if (previous !== undefined && previous !== mark) {
      this.tryShift(events, true);
    }
  }

  private stepUnraveling(dt: number, events: SimEvent[]): boolean {
    const chase = this.level.chase;
    if (!chase) return false;
    if (this.unravelingX === null) {
      if (bodyCenterX(this.body) < chase.triggerX) return false;
      this.unravelingX = bodyCenterX(this.body) - chase.lead;
      events.push({ type: SimEventType.UnravelingAwakened });
    }
    this.unravelingX += chase.speed * dt;
    if (this.body.x < this.unravelingX) {
      this.die(DeathCause.Unraveled, events);
      return true;
    }
    return false;
  }

  private tickCrumbles(dt: number, support: Rect | null, events: SimEvent[]): void {
    let changed = false;
    for (const solid of this.liveSolids) {
      if (!solid.crumble) continue;
      const state = this.crumbles.get(solid.id) ?? { timer: 0, broken: 0 };
      if (state.broken > 0) {
        state.broken = Math.max(0, state.broken - dt);
        if (state.broken === 0) {
          const blocked = existsIn(solid.presence, this.timeline) && this.status === SimStatus.Alive && overlaps(bodyRect(this.body), solid);
          if (blocked) {
            state.broken = dt;
          } else {
            changed = true;
            events.push({ type: SimEventType.Reformed, solid: this.baseSolids.get(solid.id) as SolidDef });
          }
        }
      } else if (state.timer > 0 || support === solid) {
        state.timer += dt;
        if (state.timer >= CRUMBLE.delay) {
          state.timer = 0;
          state.broken = CRUMBLE.respawn;
          changed = true;
          events.push({ type: SimEventType.Crumbled, solid: this.baseSolids.get(solid.id) as SolidDef });
        }
      }
      this.crumbles.set(solid.id, state);
    }
    if (changed) {
      this.rebuildCaches();
      if (this.status === SimStatus.Alive) this.body.onGround = isSupported(this.body, this.solids[this.timeline]);
    }
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
    this.body.dashTime = 0;
    events.push({ type: SimEventType.Died, cause });
  }

  private respawnInto(events: SimEvent[]): void {
    const point = this.respawnPoint;
    placeBody(this.body, point.x, point.y);
    this.timeline = point.timeline;
    this.status = SimStatus.Alive;
    this.deathTimer = 0;
    this.shiftCooldown = 0;
    this.pulseMarks.clear();
    if (this.unravelingX !== null && this.level.chase) {
      this.unravelingX = point.x - this.level.chase.lead;
    }
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
        count: fragment.kind === FragmentKind.Memory ? this.fragmentCount : 1,
        required: fragment.kind === FragmentKind.Memory ? this.memoriesRequired : 1,
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

  private reachExit(events: SimEvent[]): void {
    const portal = this.level.portal;
    if (portal.kind !== ExitKind.Gate || this.status !== SimStatus.Alive) return;
    if (!overlaps(bodyRect(this.body), portal.zone)) return;
    this.status = SimStatus.Exited;
    this.body.vx = 0;
    this.body.dashTime = 0;
    events.push({ type: SimEventType.ExitReached });
  }

  private interact(events: SimEvent[]): void {
    const target = this.getInteraction();
    if (!target) return;

    if (target.kind === InteractionKind.Portal) {
      if (!target.available) {
        events.push({
          type: SimEventType.PortalUnstable,
          missing: this.memoriesRequired - this.fragmentCount,
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
