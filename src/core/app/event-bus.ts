/**
 * Typed event bus for cross-cutting side effects.
 *
 * Modules emit events; subscribers react. Never call a side effect
 * directly from a write operation — emit an event instead.
 */

export class EventBus<T extends Record<keyof T, unknown[]>> {
  private listeners = new Map<keyof T, Set<(...args: unknown[]) => void>>();

  on<K extends keyof T>(event: K, handler: (...args: T[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as (...args: unknown[]) => void);
    return () => set?.delete(handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(...args);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
