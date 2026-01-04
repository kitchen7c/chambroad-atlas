export { BaseFormatter, type Formatter, type ExportOptions } from './base';
export { MarkdownFormatter, type MarkdownOptions } from './markdown';
export { JsonFormatter, type JsonOptions } from './json';
export { CsvFormatter, type CsvOptions } from './csv';
export { HtmlFormatter, type HtmlOptions } from './html';
export { PdfFormatter, type PdfOptions } from './pdf';

import type { ExportFormat } from '../types';
import type { Formatter } from './base';
import { MarkdownFormatter } from './markdown';
import { JsonFormatter } from './json';
import { CsvFormatter } from './csv';
import { HtmlFormatter } from './html';
import { PdfFormatter } from './pdf';

const formatters: Record<ExportFormat, () => Formatter> = {
  markdown: () => new MarkdownFormatter(),
  json: () => new JsonFormatter(),
  csv: () => new CsvFormatter(),
  html: () => new HtmlFormatter(),
  pdf: () => new PdfFormatter(),
};

export function getFormatter(format: ExportFormat): Formatter {
  const factory = formatters[format];
  if (!factory) {
    throw new Error(`Unknown export format: ${format}`);
  }
  return factory();
}
