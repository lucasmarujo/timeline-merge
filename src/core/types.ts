import type {
  DecorKind,
  DecorLayer,
  HazardStyle,
  MechanismKind,
  Presence,
  SolidStyle,
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

export interface SolidDef extends Rect {
  id: string;
  presence: Presence;
  style: SolidStyle;
  condition?: Condition;
}

export interface HazardDef extends Rect {
  id: string;
  presence: Presence;
  style: HazardStyle;
}

export interface FragmentDef {
  id: string;
  presence: Presence;
  x: number;
  y: number;
  title: string;
  memory: string;
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
  portal: PortalDef;
}
