import { jsPDF } from 'jspdf';
import { BaseFormatter } from './base';
import type { ArticleExportData } from '../types';

export interface PdfOptions {
  pageSize?: 'a4' | 'letter';
  includeHeader?: boolean;
  includeFooter?: boolean;
  fontSize?: number;
}

export class PdfFormatter extends BaseFormatter {
  readonly format = 'pdf';
  readonly extension = 'pdf';

  private options: PdfOptions;

  constructor(options: PdfOptions = {}) {
    super();
    this.options = {
      pageSize: 'a4',
      includeHeader: true,
      includeFooter: true,
      fontSize: 12,
      ...options,
    };
  }

  render(article: ArticleExportData): Buffer {
    const doc = this.createDocument();

    this.renderArticle(doc, article);

    return Buffer.from(doc.output('arraybuffer'));
  }

  renderMany(articles: ArticleExportData[]): Buffer {
    const doc = this.createDocument();

    // Title page
    doc.setFontSize(24);
    doc.text('Article Export', 20, 40);
    doc.setFontSize(14);
    doc.text(`${articles.length} articles`, 20, 55);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 65);

    // Table of contents
    doc.addPage();
    doc.setFontSize(18);
    doc.text('Table of Contents', 20, 30);
    doc.setFontSize(12);

    let y = 50;
    articles.forEach((article, index) => {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(`${index + 1}. ${article.title.slice(0, 60)}`, 20, y);
      y += 10;
    });

    // Articles
    for (const article of articles) {
      doc.addPage();
      this.renderArticle(doc, article);
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  private createDocument(): jsPDF {
    return new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: this.options.pageSize,
    });
  }

  private renderArticle(doc: jsPDF, article: ArticleExportData): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let y = 30;

    // Header
    if (this.options.includeHeader) {
      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text(`Atlas Export - ${new Date().toLocaleDateString()}`, margin, 15);
      doc.setTextColor(0);
    }

    // Title
    doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(article.title, maxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 5;

    // Meta
    doc.setFontSize(10);
    doc.setTextColor(100);
    const meta: string[] = [];
    if (article.source) meta.push(`Source: ${article.source}`);
    if (article.author) meta.push(`Author: ${article.author}`);
    if (article.publishedAt) {
      meta.push(`Date: ${new Date(article.publishedAt).toLocaleDateString()}`);
    }
    if (meta.length > 0) {
      doc.text(meta.join(' | '), margin, y);
      y += 10;
    }
    doc.setTextColor(0);

    // Summary
    if (article.summary) {
      doc.setFontSize(11);
      doc.setFillColor(245, 245, 245);
      const summaryLines = doc.splitTextToSize(`Summary: ${article.summary}`, maxWidth - 10);
      const summaryHeight = summaryLines.length * 6 + 10;
      doc.rect(margin, y, maxWidth, summaryHeight, 'F');
      doc.text(summaryLines, margin + 5, y + 8);
      y += summaryHeight + 10;
    }

    // Content
    doc.setFontSize(this.options.fontSize!);
    const contentLines = doc.splitTextToSize(article.content, maxWidth);

    for (const line of contentLines) {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(line, margin, y);
      y += 6;
    }

    // Tags
    if (article.tags.length > 0) {
      y += 10;
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Tags: ${article.tags.map(t => `#${t}`).join(' ')}`, margin, y);
      doc.setTextColor(0);
    }

    // Footer
    if (this.options.includeFooter) {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`${article.url || ''}`, margin, pageHeight - 10);
      doc.setTextColor(0);
    }
  }

  protected async writeFile(filepath: string, content: Buffer): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filepath, content);
  }
}
