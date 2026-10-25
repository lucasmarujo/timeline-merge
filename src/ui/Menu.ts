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

export enum PauseOption {
  Resume = 'resume',
  RestartCheckpoint = 'restartCheckpoint',
  RestartLevel = 'restartLevel',
  Sound = 'sound',
  Title = 'title',
}

export enum VictoryOption {
  PlayAgain = 'playAgain',
  Title = 'title',
}

export function soundLabel(muted: boolean): string {
  return `Sound: ${muted ? 'Off' : 'On'}`;
}

export function createPauseMenu(muted: boolean): Menu<PauseOption> {
  return new Menu<PauseOption>([
    { id: PauseOption.Resume, label: 'Resume' },
    { id: PauseOption.RestartCheckpoint, label: 'Return to Checkpoint' },
    { id: PauseOption.RestartLevel, label: 'Restart Level' },
    { id: PauseOption.Sound, label: soundLabel(muted) },
    { id: PauseOption.Title, label: 'Quit to Title' },
  ]);
}

export function createVictoryMenu(): Menu<VictoryOption> {
  return new Menu<VictoryOption>([
    { id: VictoryOption.PlayAgain, label: 'Play Again' },
    { id: VictoryOption.Title, label: 'Return to Title' },
  ]);
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
