import type {
  DecorKind,
  DecorLayer,
  ExitKind,
  FragmentKind,
  HazardStyle,
  MechanismKind,
  MotionAxis,
  Presence,
  SolidStyle,
  ZoneKind,
} from './enums';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Condition {
  requires?: string;
  unless?: string;
}

export interface ToneShift {
  hue: number;
  saturation: number;
  light: number;
}

export interface Motion {
  axis: MotionAxis;
  range: number;
  period: number;
  phase: number;
}

export interface SolidDef extends Rect {
  id: string;
  presence: Presence;
  style: SolidStyle;
  condition?: Condition;
  motion?: Motion;
  crumble?: boolean;
}

export interface HazardDef extends Rect {
  id: string;
  presence: Presence;
  style: HazardStyle;
  motion?: Motion;
}

export interface FragmentDef {
  id: string;
  kind: FragmentKind;
  presence: Presence;
  x: number;
  y: number;
  title: string;
  memory?: string;
}

export interface ZoneDef extends Rect {
  id: string;
  kind: ZoneKind;
  presence: Presence;
  period?: number;
}

export interface ChaseDef {
  triggerX: number;
  speed: number;
  lead: number;
}

export interface MechanismDef {
  id: string;
  presence: Presence;
  kind: MechanismKind;
  x: number;
  y: number;
  prompt: string;
  message: string;
}

export interface CheckpointDef {
  id: string;
  x: number;
  y: number;
}

export interface HintDef {
  id: string;
  zone: Rect;
  text: string;
  touchText?: string;
  hideAfterShift?: boolean;
}

export interface AreaDef {
  id: string;
  zone: Rect;
  title: string;
  subtitle: string;
}

export interface DecorDef {
  kind: DecorKind;
  x: number;
  y: number;
  presence: Presence;
  layer: DecorLayer;
  size?: number;
  flip?: boolean;
  seed?: number;
}

export interface PortalDef {
  kind: ExitKind;
  x: number;
  y: number;
  radius: number;
  standX: number;
  zone: Rect;
}

export interface LevelDef {
  id: string;
  name: string;
  bounds: Rect;
  killY: number;
  spawn: Vec2;
  solids: readonly SolidDef[];
  hazards: readonly HazardDef[];
  fragments: readonly FragmentDef[];
  mechanisms: readonly MechanismDef[];
  checkpoints: readonly CheckpointDef[];
  hints: readonly HintDef[];
  areas: readonly AreaDef[];
  decor: readonly DecorDef[];
  zones: readonly ZoneDef[];
  chase?: ChaseDef;
  portal: PortalDef;
}
