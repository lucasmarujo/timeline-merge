import { AIR_JUMP, DASH, GLIDE, MOVEMENT, PLAYER_SIZE, UPDRAFT, WALL } from './constants';
import { clamp } from './geometry';
import type { Rect } from './types';

export type Side = -1 | 0 | 1;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpCut: boolean;
  airJumps: number;
  dashTime: number;
  dashDirection: 1 | -1;
  dashReady: boolean;
  wall: Side;
  wallLockTime: number;
  wallLockSide: Side;
  gliding: boolean;
  wallSliding: boolean;
}

export interface MoveIntent {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed?: boolean;
  lift?: number;
}

export interface Capabilities {
  dash: boolean;
  glide: boolean;
  wallGrip: boolean;
}

export const NO_CAPABILITIES: Readonly<Capabilities> = { dash: false, glide: false, wallGrip: false };

export interface BodyStepOutcome {
  jumped: boolean;
  airJumped: boolean;
  wallJumped: boolean;
  dashed: boolean;
  landed: boolean;
  impactSpeed: number;
}

export function createBody(feetX: number, feetY: number): Body {
  return {
    x: feetX - PLAYER_SIZE.width / 2,
    y: feetY - PLAYER_SIZE.height,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpCut: true,
    airJumps: 0,
    dashTime: 0,
    dashDirection: 1,
    dashReady: true,
    wall: 0,
    wallLockTime: 0,
    wallLockSide: 0,
    gliding: false,
    wallSliding: false,
  };
}

export function placeBody(body: Body, feetX: number, feetY: number): void {
  body.x = feetX - PLAYER_SIZE.width / 2;
  body.y = feetY - PLAYER_SIZE.height;
  body.vx = 0;
  body.vy = 0;
  body.onGround = false;
  body.coyoteTimer = 0;
  body.jumpBufferTimer = 0;
  body.jumpCut = true;
  body.airJumps = 0;
  body.dashTime = 0;
  body.dashReady = true;
  body.wall = 0;
  body.wallLockTime = 0;
  body.wallLockSide = 0;
  body.gliding = false;
  body.wallSliding = false;
}

export function bodyRect(body: Body): Rect {
  return { x: body.x, y: body.y, w: PLAYER_SIZE.width, h: PLAYER_SIZE.height };
}

export function bodyCenterX(body: Body): number {
  return body.x + PLAYER_SIZE.width / 2;
}

export function bodyCenterY(body: Body): number {
  return body.y + PLAYER_SIZE.height / 2;
}

export function isDashing(body: Body): boolean {
  return body.dashTime > 0;
}

function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

function overlapsBody(body: Body, solid: Rect): boolean {
  return (
    body.x < solid.x + solid.w &&
    body.x + PLAYER_SIZE.width > solid.x &&
    body.y < solid.y + solid.h &&
    body.y + PLAYER_SIZE.height > solid.y
  );
}

function horizontalAcceleration(body: Body, target: number): number {
  const turning = target !== 0 && body.vx !== 0 && Math.sign(target) !== Math.sign(body.vx);
  if (body.onGround) {
    if (target === 0) return MOVEMENT.groundDecel;
    return turning ? MOVEMENT.turnAccel : MOVEMENT.groundAccel;
  }
  if (target === 0) return MOVEMENT.airDecel;
  return turning ? MOVEMENT.airTurnAccel : MOVEMENT.airAccel;
}

function resolveHorizontal(body: Body, solids: readonly Rect[]): void {
  for (const solid of solids) {
    if (!overlapsBody(body, solid)) continue;
    if (body.vx > 0) {
      body.x = solid.x - PLAYER_SIZE.width;
    } else if (body.vx < 0) {
      body.x = solid.x + solid.w;
    } else {
      const pushLeft = body.x + PLAYER_SIZE.width - solid.x;
      const pushRight = solid.x + solid.w - body.x;
      body.x = pushLeft < pushRight ? solid.x - PLAYER_SIZE.width : solid.x + solid.w;
    }
    body.vx = 0;
  }
}

function resolveVertical(body: Body, solids: readonly Rect[]): boolean {
  let landed = false;
  for (const solid of solids) {
    if (!overlapsBody(body, solid)) continue;
    if (body.vy > 0) {
      body.y = solid.y - PLAYER_SIZE.height;
      landed = true;
    } else if (body.vy < 0) {
      body.y = solid.y + solid.h;
    } else {
      body.y = solid.y - PLAYER_SIZE.height;
      landed = true;
    }
    body.vy = 0;
  }
  return landed;
}

export function findSupport(body: Body, solids: readonly Rect[]): Rect | null {
  const feet = body.y + PLAYER_SIZE.height;
  for (const solid of solids) {
    if (
      body.x < solid.x + solid.w &&
      body.x + PLAYER_SIZE.width > solid.x &&
      solid.y < feet + 1 &&
      solid.y + solid.h > feet
    ) {
      return solid;
    }
  }
  return null;
}

export function isSupported(body: Body, solids: readonly Rect[]): boolean {
  return findSupport(body, solids) !== null;
}

export function probeWall(body: Body, solids: readonly Rect[]): Side {
  const top = body.y + WALL.inset;
  const height = PLAYER_SIZE.height - WALL.inset * 2;
  for (const side of [-1, 1] as const) {
    const probe: Rect = {
      x: side < 0 ? body.x - WALL.probe : body.x + PLAYER_SIZE.width,
      y: top,
      w: WALL.probe,
      h: height,
    };
    for (const solid of solids) {
      if (
        probe.x < solid.x + solid.w &&
        probe.x + probe.w > solid.x &&
        probe.y < solid.y + solid.h &&
        probe.y + probe.h > solid.y
      ) {
        return side;
      }
    }
  }
  return 0;
}

function startJump(body: Body, velocity: number): void {
  body.vy = -velocity;
  body.onGround = false;
  body.coyoteTimer = 0;
  body.jumpBufferTimer = 0;
  body.jumpCut = false;
}

export function stepBody(
  body: Body,
  intent: MoveIntent,
  solids: readonly Rect[],
  dt: number,
  capabilities: Readonly<Capabilities> = NO_CAPABILITIES,
): BodyStepOutcome {
  const outcome: BodyStepOutcome = { jumped: false, airJumped: false, wallJumped: false, dashed: false, landed: false, impactSpeed: 0 };
  let moveX = clamp(intent.moveX, -1, 1);
  if (body.wallLockTime > 0) {
    body.wallLockTime = Math.max(0, body.wallLockTime - dt);
    if (moveX !== 0 && Math.sign(moveX) === body.wallLockSide) moveX = 0;
  }
  const targetSpeed = moveX * MOVEMENT.runSpeed;

  if (capabilities.dash && intent.dashPressed && body.dashReady && body.dashTime <= 0) {
    body.dashDirection = moveX !== 0 ? (moveX > 0 ? 1 : -1) : body.facing;
    body.facing = body.dashDirection;
    body.dashTime = DASH.duration;
    body.dashReady = false;
    body.vy = 0;
    outcome.dashed = true;
  }

  const dashing = body.dashTime > 0;
  if (dashing) {
    body.dashTime = Math.max(0, body.dashTime - dt);
    body.vx = body.dashDirection * DASH.speed;
    body.vy = 0;
    if (body.dashTime === 0) body.vx = body.dashDirection * DASH.exitSpeed;
  } else {
    body.vx = approach(body.vx, targetSpeed, horizontalAcceleration(body, targetSpeed) * dt);
    if (moveX !== 0) {
      body.facing = moveX > 0 ? 1 : -1;
    }
  }

  body.coyoteTimer = body.onGround ? MOVEMENT.coyoteTime : Math.max(0, body.coyoteTimer - dt);
  body.jumpBufferTimer = intent.jumpPressed
    ? MOVEMENT.jumpBufferTime
    : Math.max(0, body.jumpBufferTimer - dt);

  if (!dashing && body.jumpBufferTimer > 0) {
    if (body.coyoteTimer > 0) {
      startJump(body, MOVEMENT.jumpVelocity);
      outcome.jumped = true;
    } else if (capabilities.wallGrip && body.wall !== 0) {
      startJump(body, WALL.kickVelocity);
      body.vx = -body.wall * WALL.kickSpeed;
      body.facing = body.wall > 0 ? -1 : 1;
      body.wallLockTime = WALL.lockTime;
      body.wallLockSide = body.wall;
      body.wall = 0;
      outcome.jumped = true;
      outcome.wallJumped = true;
    } else if (body.airJumps > 0) {
      body.airJumps -= 1;
      startJump(body, AIR_JUMP.velocity);
      outcome.jumped = true;
      outcome.airJumped = true;
    }
  }

  if (!intent.jumpHeld && body.vy < 0 && !body.jumpCut) {
    body.vy *= MOVEMENT.jumpCutMultiplier;
    body.jumpCut = true;
  }

  const lift = intent.lift ?? 0;
  body.gliding = capabilities.glide && !body.onGround && !dashing && intent.jumpHeld && (body.vy >= 0 || lift > 0);
  body.wallSliding = capabilities.wallGrip && !body.onGround && !dashing && body.wall !== 0 && moveX !== 0 && Math.sign(moveX) === body.wall && body.vy > 0;

  if (!dashing) {
    const gravity = body.vy < 0 ? MOVEMENT.riseGravity : MOVEMENT.fallGravity;
    const maxFall = body.gliding ? GLIDE.fallSpeed : body.wallSliding ? WALL.slideSpeed : MOVEMENT.maxFallSpeed;
    body.vy = body.vy > maxFall ? Math.max(maxFall, body.vy - GLIDE.brake * dt) : Math.min(body.vy + gravity * dt, maxFall);
    if (body.gliding && lift > 0 && body.vy > -UPDRAFT.maxRise) {
      body.vy = Math.max(body.vy - lift * dt, -UPDRAFT.maxRise);
    }
  }

  const wasOnGround = body.onGround;

  body.x += body.vx * dt;
  resolveHorizontal(body, solids);

  const verticalSpeed = body.vy;
  body.y += body.vy * dt;
  const hitFloor = resolveVertical(body, solids);

  const support = hitFloor || body.vy < 0 ? null : findSupport(body, solids);
  if (support) {
    body.y = support.y - PLAYER_SIZE.height;
  }
  body.onGround = hitFloor || support !== null;
  if (body.onGround) {
    body.vy = 0;
    body.airJumps = 0;
    body.dashReady = true;
    body.wall = 0;
    body.gliding = false;
    body.wallSliding = false;
  } else {
    body.wall = capabilities.wallGrip ? probeWall(body, solids) : 0;
    if (body.wall !== 0 && capabilities.wallGrip) body.dashReady = true;
  }
  if (body.onGround && !wasOnGround) {
    outcome.landed = true;
    outcome.impactSpeed = Math.max(0, verticalSpeed);
  }

  return outcome;
}
