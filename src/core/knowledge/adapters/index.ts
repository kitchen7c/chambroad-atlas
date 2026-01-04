import type { NoteTool } from '../types';
import type { NoteToolAdapter } from './base';
import { ObsidianAdapter } from './obsidian';
import { LogseqAdapter } from './logseq';

export type { NoteToolAdapter } from './base';
export { BaseAdapter } from './base';
export { ObsidianAdapter } from './obsidian';
export { LogseqAdapter } from './logseq';

const adapters: Record<NoteTool, () => NoteToolAdapter> = {
  obsidian: () => new ObsidianAdapter(),
  logseq: () => new LogseqAdapter(),
  typora: () => new ObsidianAdapter(), // Typora uses standard markdown
  custom: () => new ObsidianAdapter(),
};

export function getAdapter(tool: NoteTool): NoteToolAdapter {
  return adapters[tool]();
}
