import type { CacheAdapter } from './interface.js';

export class VoidCacheAdapter implements CacheAdapter {
  async mget(keys: readonly string[]): Promise<(string | undefined)[]> {
    return Array.from<undefined>({ length: keys.length }).fill(undefined);
  }

  async mset(): Promise<void> {
    // No-op
  }

  async mdel(): Promise<void> {
    // No-op
  }

  async pdel(): Promise<void> {
    // No-op
  }

  async mhas(keys: readonly string[]): Promise<boolean[]> {
    return Array.from<boolean>({ length: keys.length }).fill(false);
  }

  async getRemainingTtl(): Promise<number | undefined> {
    return undefined;
  }
}
