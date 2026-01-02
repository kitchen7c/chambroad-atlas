import { describe, it, expect, beforeEach } from 'vitest';
import { SourceRegistry } from './registry';
import { RSSSource } from './rss';

describe('SourceRegistry', () => {
  let registry: SourceRegistry;

  beforeEach(() => {
    registry = new SourceRegistry();
  });

  it('should register and retrieve a source', () => {
    const rssSource = new RSSSource();
    registry.register(rssSource);

    const retrieved = registry.get('rss');
    expect(retrieved).toBe(rssSource);
  });

  it('should return undefined for unregistered type', () => {
    const retrieved = registry.get('unknown' as any);
    expect(retrieved).toBeUndefined();
  });

  it('should list all registered sources', () => {
    registry.register(new RSSSource());

    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('rss');
  });
});
