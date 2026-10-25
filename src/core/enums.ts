export enum Timeline {
  Dawn = 'dawn',
  Eclipse = 'eclipse',
}

export enum Presence {
  Both = 'both',
  Dawn = 'dawn',
  Eclipse = 'eclipse',
}

export enum SolidStyle {
  Wall = 'wall',
  Terrace = 'terrace',
  Mesa = 'mesa',
  Bridge = 'bridge',
  BrokenBridge = 'brokenBridge',
  Viaduct = 'viaduct',
  Slab = 'slab',
  Crystal = 'crystal',
  LightStep = 'lightStep',
  Shard = 'shard',
  Ward = 'ward',
  Door = 'door',
  Portcullis = 'portcullis',
  Stair = 'stair',
  Balcony = 'balcony',
  Facade = 'facade',
  Floor = 'floor',
  Rubble = 'rubble',
  Tower = 'tower',
  Drifter = 'drifter',
  Crumble = 'crumble',
}

export enum HazardStyle {
  Thorns = 'thorns',
  Wraith = 'wraith',
}

export enum MotionAxis {
  X = 'x',
  Y = 'y',
}

export enum ZoneKind {
  Anchor = 'anchor',
  Updraft = 'updraft',
  Pulse = 'pulse',
}

export enum ExitKind {
  Gate = 'gate',
  Shattered = 'shattered',
}

export enum FragmentKind {
  Memory = 'memory',
  Shard = 'shard',
}

export enum Ability {
  Shift = 'shift',
  Interact = 'interact',
  AirShift = 'airShift',
  RiftLeap = 'riftLeap',
  Dash = 'dash',
  Glide = 'glide',
  WallGrip = 'wallGrip',
  RiftChain = 'riftChain',
}

export enum Discovery {
  Shift = 'shift',
  Interact = 'interact',
  Thorns = 'thorns',
  AirShift = 'airShift',
  Bells = 'bells',
  RiftLeap = 'riftLeap',
  Chains = 'chains',
  Dash = 'dash',
  Drifters = 'drifters',
  Glide = 'glide',
  Wraiths = 'wraiths',
  WallGrip = 'wallGrip',
  Crumble = 'crumble',
  Pulse = 'pulse',
  RiftChain = 'riftChain',
  Unraveling = 'unraveling',
}

export enum MechanismKind {
  Crank = 'crank',
  Bell = 'bell',
}

export enum DecorKind {
  Column = 'column',
  Statue = 'statue',
  Tree = 'tree',
  Arch = 'arch',
  Banner = 'banner',
  Crystals = 'crystals',
  Hanging = 'hanging',
  Suspension = 'suspension',
  Brazier = 'brazier',
  Rubble = 'rubble',
  Flora = 'flora',
  Lantern = 'lantern',
  Waterfall = 'waterfall',
  Shrine = 'shrine',
  Winch = 'winch',
  BellFrame = 'bellFrame',
  Pedestal = 'pedestal',
}

export enum DecorLayer {
  Back = 'back',
  Front = 'front',
}

export enum SimStatus {
  Alive = 'alive',
  Dead = 'dead',
  Finale = 'finale',
  Exited = 'exited',
}

export enum DeathCause {
  Fall = 'fall',
  Hazard = 'hazard',
  Crush = 'crush',
  Unraveled = 'unraveled',
}

export enum SwitchRejection {
  Blocked = 'blocked',
  Hazard = 'hazard',
  Anchored = 'anchored',
  Grounded = 'grounded',
  Locked = 'locked',
}

export enum InteractionKind {
  Mechanism = 'mechanism',
  Portal = 'portal',
}

export enum InteractionBlock {
  WrongTimeline = 'wrongTimeline',
  MissingFragments = 'missingFragments',
}

export enum SimEventType {
  Jumped = 'jumped',
  Landed = 'landed',
  TimelineShifted = 'timelineShifted',
  ShiftRejected = 'shiftRejected',
  FragmentCollected = 'fragmentCollected',
  CheckpointReached = 'checkpointReached',
  MechanismActivated = 'mechanismActivated',
  InteractionRefused = 'interactionRefused',
  Died = 'died',
  Respawned = 'respawned',
  PortalUnstable = 'portalUnstable',
  PortalActivated = 'portalActivated',
  AreaEntered = 'areaEntered',
  Dashed = 'dashed',
  AirJumped = 'airJumped',
  WallJumped = 'wallJumped',
  Crumbled = 'crumbled',
  Reformed = 'reformed',
  PulseShifted = 'pulseShifted',
  ExitReached = 'exitReached',
  UnravelingAwakened = 'unravelingAwakened',
}

export enum GamePhase {
  Title = 'title',
  Atlas = 'atlas',
  Briefing = 'briefing',
  Playing = 'playing',
  Paused = 'paused',
  LevelComplete = 'levelComplete',
  Finale = 'finale',
  Victory = 'victory',
}

export enum FlowAction {
  Start = 'start',
  Brief = 'brief',
  OpenAtlas = 'openAtlas',
  Pause = 'pause',
  Resume = 'resume',
  Exit = 'exit',
  BeginFinale = 'beginFinale',
  Complete = 'complete',
  PlayAgain = 'playAgain',
  ReturnToTitle = 'returnToTitle',
}
