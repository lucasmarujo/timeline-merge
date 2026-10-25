export class VirtualButtons<T extends string> {
  private readonly held = new Set<T>();
  private readonly pressed = new Set<T>();

  press(button: T): void {
    this.pressed.add(button);
  }

  hold(button: T): void {
    if (this.held.has(button)) return;
    this.held.add(button);
    this.pressed.add(button);
  }

  release(button: T): void {
    this.held.delete(button);
  }

  isDown(button: T): boolean {
    return this.held.has(button);
  }

  consume(button: T): boolean {
    return this.pressed.delete(button);
  }

  flush(): void {
    this.pressed.clear();
  }

  clear(): void {
    this.held.clear();
    this.pressed.clear();
  }
}
