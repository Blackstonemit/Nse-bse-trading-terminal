export class MemoryCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiry > 0 && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: ttlMs <= 0 ? 0 : Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalCache = new MemoryCache();
