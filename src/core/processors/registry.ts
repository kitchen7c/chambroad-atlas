import type { Processor, ProcessorType } from './types';

export class ProcessorRegistry {
  private processors = new Map<ProcessorType, Processor>();

  register(processor: Processor): void {
    this.processors.set(processor.type, processor);
  }

  get(type: ProcessorType): Processor | undefined {
    return this.processors.get(type);
  }

  getAll(): Processor[] {
    return Array.from(this.processors.values());
  }

  has(type: ProcessorType): boolean {
    return this.processors.has(type);
  }
}

// 默认注册表实例
import { Summarizer } from './summarizer';
import { Classifier } from './classifier';
import { Scorer } from './scorer';
import { Filter } from './filter';

export const processorRegistry = new ProcessorRegistry();
processorRegistry.register(new Summarizer());
processorRegistry.register(new Classifier());
processorRegistry.register(new Scorer());
processorRegistry.register(new Filter());
