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
}

export enum HazardStyle {
  Thorns = 'thorns',
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
}

export enum DeathCause {
  Fall = 'fall',
  Hazard = 'hazard',
}

export enum SwitchRejection {
  Blocked = 'blocked',
  Hazard = 'hazard',
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
}

export enum GamePhase {
  Title = 'title',
  Playing = 'playing',
  Paused = 'paused',
  Finale = 'finale',
  Victory = 'victory',
}

export enum FlowAction {
  Start = 'start',
  Pause = 'pause',
  Resume = 'resume',
  BeginFinale = 'beginFinale',
  Complete = 'complete',
  PlayAgain = 'playAgain',
  ReturnToTitle = 'returnToTitle',
}
