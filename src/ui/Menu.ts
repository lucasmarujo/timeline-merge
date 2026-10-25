export interface MenuItem<T extends string> {
  id: T;
  label: string;
}

export class Menu<T extends string> {
  private cursor = 0;

  constructor(private readonly entries: MenuItem<T>[]) {
    if (entries.length === 0) {
      throw new Error('A menu needs at least one item.');
    }
  }

  get items(): readonly MenuItem<T>[] {
    return this.entries;
  }

  get index(): number {
    return this.cursor;
  }

  get selected(): T {
    return (this.entries[this.cursor] as MenuItem<T>).id;
  }

  move(delta: number): void {
    const count = this.entries.length;
    this.cursor = (((this.cursor + delta) % count) + count) % count;
  }

  reset(): void {
    this.cursor = 0;
  }

  select(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.entries.length) return false;
    this.cursor = index;
    return true;
  }

  relabel(id: T, label: string): void {
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (entry) entry.label = label;
  }
}

export enum TitleOption {
  Continue = 'continue',
  Atlas = 'atlas',
}

export enum PauseOption {
  Resume = 'resume',
  RestartCheckpoint = 'restartCheckpoint',
  RestartLevel = 'restartLevel',
  Atlas = 'atlas',
  Sound = 'sound',
  Title = 'title',
}

export enum CompleteOption {
  Continue = 'continue',
  Replay = 'replay',
  Atlas = 'atlas',
}

export enum VictoryOption {
  Continue = 'continue',
  Atlas = 'atlas',
  Title = 'title',
}

export function soundLabel(muted: boolean): string {
  return `Sound: ${muted ? 'Off' : 'On'}`;
}

export function continueLabel(level: number, fresh: boolean): string {
  return fresh ? 'Begin the Journey' : `Continue · Echo ${level}`;
}

export function createTitleMenu(level: number, fresh: boolean): Menu<TitleOption> {
  return new Menu<TitleOption>([
    { id: TitleOption.Continue, label: continueLabel(level, fresh) },
    { id: TitleOption.Atlas, label: 'Atlas of Echoes' },
  ]);
}

export function createPauseMenu(muted: boolean): Menu<PauseOption> {
  return new Menu<PauseOption>([
    { id: PauseOption.Resume, label: 'Resume' },
    { id: PauseOption.RestartCheckpoint, label: 'Return to Checkpoint' },
    { id: PauseOption.RestartLevel, label: 'Restart Echo' },
    { id: PauseOption.Atlas, label: 'Atlas of Echoes' },
    { id: PauseOption.Sound, label: soundLabel(muted) },
    { id: PauseOption.Title, label: 'Quit to Title' },
  ]);
}

export function createCompleteMenu(hasNext: boolean): Menu<CompleteOption> {
  const items = [
    { id: CompleteOption.Continue, label: 'Next Echo' },
    { id: CompleteOption.Replay, label: 'Replay Echo' },
    { id: CompleteOption.Atlas, label: 'Atlas of Echoes' },
  ];
  return new Menu<CompleteOption>(hasNext ? items : items.slice(1));
}

export function createVictoryMenu(final: boolean): Menu<VictoryOption> {
  return new Menu<VictoryOption>(
    final
      ? [
          { id: VictoryOption.Atlas, label: 'Atlas of Echoes' },
          { id: VictoryOption.Title, label: 'Return to Title' },
        ]
      : [
          { id: VictoryOption.Continue, label: 'Next Chapter' },
          { id: VictoryOption.Atlas, label: 'Atlas of Echoes' },
        ],
  );
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
