export const FIXED_DT = 1 / 120;

export const MAX_FRAME_DELTA = 0.1;

export const PLAYER_SIZE = {
  width: 14,
  height: 36,
} as const;

export const MOVEMENT = {
  runSpeed: 230,
  groundAccel: 2200,
  groundDecel: 2800,
  turnAccel: 3600,
  airAccel: 1600,
  airDecel: 800,
  airTurnAccel: 2400,
  riseGravity: 1600,
  fallGravity: 2500,
  jumpVelocity: 632,
  jumpCutMultiplier: 0.45,
  maxFallSpeed: 900,
  coyoteTime: 0.09,
  jumpBufferTime: 0.12,
} as const;

export const SHIFT = {
  cooldown: 0.18,
  maxNudge: 10,
} as const;

export const DASH = {
  speed: 560,
  duration: 0.16,
  exitSpeed: 300,
} as const;

export const AIR_JUMP = {
  velocity: 560,
} as const;

export const GLIDE = {
  fallSpeed: 105,
  brake: 3200,
} as const;

export const WALL = {
  slideSpeed: 140,
  kickSpeed: 300,
  kickVelocity: 590,
  lockTime: 0.16,
  probe: 2,
  inset: 6,
} as const;

export const UPDRAFT = {
  lift: 2600,
  maxRise: 300,
} as const;

export const CRUMBLE = {
  delay: 0.5,
  respawn: 2.6,
} as const;

export const INTERACT_RADIUS = 56;

export const FRAGMENT_RADIUS = 14;

export const HAZARD_INSET = 3;

export const DEATH_DURATION = 0.9;

export const CHECKPOINT_TRIGGER = {
  halfWidth: 24,
  height: 72,
} as const;

export const FINALE_WALK_TOLERANCE = 2;

export const FRAGMENTS_REQUIRED = 3;
