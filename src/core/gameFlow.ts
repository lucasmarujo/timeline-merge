import { FlowAction, GamePhase } from './enums';

const TRANSITIONS: Readonly<Record<GamePhase, Partial<Record<FlowAction, GamePhase>>>> = {
  [GamePhase.Title]: {
    [FlowAction.Start]: GamePhase.Playing,
    [FlowAction.Brief]: GamePhase.Briefing,
    [FlowAction.OpenAtlas]: GamePhase.Atlas,
  },
  [GamePhase.Atlas]: {
    [FlowAction.Start]: GamePhase.Playing,
    [FlowAction.Brief]: GamePhase.Briefing,
    [FlowAction.ReturnToTitle]: GamePhase.Title,
  },
  [GamePhase.Briefing]: {
    [FlowAction.Start]: GamePhase.Playing,
    [FlowAction.OpenAtlas]: GamePhase.Atlas,
  },
  [GamePhase.Playing]: {
    [FlowAction.Pause]: GamePhase.Paused,
    [FlowAction.Exit]: GamePhase.LevelComplete,
    [FlowAction.BeginFinale]: GamePhase.Finale,
  },
  [GamePhase.Paused]: {
    [FlowAction.Resume]: GamePhase.Playing,
    [FlowAction.Start]: GamePhase.Playing,
    [FlowAction.OpenAtlas]: GamePhase.Atlas,
    [FlowAction.ReturnToTitle]: GamePhase.Title,
  },
  [GamePhase.LevelComplete]: {
    [FlowAction.Start]: GamePhase.Playing,
    [FlowAction.Brief]: GamePhase.Briefing,
    [FlowAction.OpenAtlas]: GamePhase.Atlas,
  },
  [GamePhase.Finale]: {
    [FlowAction.Complete]: GamePhase.Victory,
  },
  [GamePhase.Victory]: {
    [FlowAction.PlayAgain]: GamePhase.Playing,
    [FlowAction.Start]: GamePhase.Playing,
    [FlowAction.Brief]: GamePhase.Briefing,
    [FlowAction.OpenAtlas]: GamePhase.Atlas,
    [FlowAction.ReturnToTitle]: GamePhase.Title,
  },
};

export class GameFlow {
  private current: GamePhase = GamePhase.Title;

  get phase(): GamePhase {
    return this.current;
  }

  can(action: FlowAction): boolean {
    return TRANSITIONS[this.current][action] !== undefined;
  }

  dispatch(action: FlowAction): boolean {
    const next = TRANSITIONS[this.current][action];
    if (next === undefined) {
      return false;
    }
    this.current = next;
    return true;
  }
}
