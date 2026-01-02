import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessorRegistry } from './registry';
import { Summarizer } from './summarizer';
import { Classifier } from './classifier';

describe('ProcessorRegistry', () => {
  let registry: ProcessorRegistry;

  beforeEach(() => {
    registry = new ProcessorRegistry();
  });

  it('should register and retrieve a processor', () => {
    const summarizer = new Summarizer();
    registry.register(summarizer);

    const retrieved = registry.get('summarizer');
    expect(retrieved).toBe(summarizer);
  });

  it('should return undefined for unregistered type', () => {
    const retrieved = registry.get('unknown' as any);
    expect(retrieved).toBeUndefined();
  });

  it('should list all registered processors', () => {
    registry.register(new Summarizer());
    registry.register(new Classifier());

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });
});
