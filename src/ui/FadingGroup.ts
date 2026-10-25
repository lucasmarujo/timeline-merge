export interface Fadeable {
  setAlpha(alpha: number): unknown;
  setVisible(visible: boolean): unknown;
}

export class FadingGroup {
  private alpha = 0;
  private remaining = 0;

  constructor(
    private readonly items: Fadeable[],
    private readonly fadeInRate = 4,
    private readonly fadeOutRate = 2.5,
  ) {
    this.apply();
  }

  get opacity(): number {
    return this.alpha;
  }

  show(holdSeconds = Number.POSITIVE_INFINITY): void {
    this.remaining = holdSeconds;
  }

  hide(): void {
    this.remaining = 0;
  }

  hideImmediately(): void {
    this.remaining = 0;
    this.alpha = 0;
    this.apply();
  }

  update(dt: number): void {
    const target = this.remaining > 0 ? 1 : 0;
    if (this.remaining > 0 && this.remaining !== Number.POSITIVE_INFINITY) {
      this.remaining = Math.max(0, this.remaining - dt);
    }
    const rate = target > this.alpha ? this.fadeInRate : this.fadeOutRate;
    this.alpha = target > this.alpha ? Math.min(target, this.alpha + dt * rate) : Math.max(target, this.alpha - dt * rate);
    this.apply();
  }

  private apply(): void {
    for (const item of this.items) {
      item.setAlpha(this.alpha);
      item.setVisible(this.alpha > 0.001);
    }
  }
}
