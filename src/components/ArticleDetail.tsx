import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db, type StoredArticle, type StoredSource } from '../core/storage/db';
import { ProcessorJob } from '../core/jobs/processor-job';
import type { LLMConfig, Settings } from '../../types';
import type { ExportFormat } from '../core/export/types';

interface ArticleDetailProps {
  articleId: string;
  onBack: () => void;
}

export function ArticleDetail({ articleId, onBack }: ArticleDetailProps) {
  const { t } = useTranslation();
  const [article, setArticle] = useState<StoredArticle | null>(null);
  const [source, setSource] = useState<StoredSource | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const loadArticle = async () => {
      const a = await db.articles.get(articleId);
      if (a) {
        setArticle(a);
        // Mark as read
        if (!a.isRead) {
          await db.articles.update(articleId, { isRead: true });
          setArticle({ ...a, isRead: true });
        }
        // Load source
        const s = await db.sources.get(a.sourceId);
        setSource(s || null);
      }
    };
    loadArticle();

    // Load LLM config from storage
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings as Settings | undefined;
      if (settings?.llm) {
        setLlmConfig(settings.llm);
      }
    });
  }, [articleId]);

  const toggleFavorite = async () => {
    if (!article) return;
    const newValue = !article.isFavorite;
    await db.articles.update(articleId, { isFavorite: newValue });
    setArticle({ ...article, isFavorite: newValue });
  };

  const openLink = () => {
    if (article?.url) {
      chrome.tabs.create({ url: article.url });
    }
  };

  const processArticle = async () => {
    if (!article || isProcessing) return;
    if (!llmConfig || !llmConfig.apiKey) {
      console.warn('No LLM config available. Please configure in settings.');
      return;
    }
    setIsProcessing(true);
    try {
      const job = new ProcessorJob({
        batchSize: 1,
        intervalMs: 0,
        defaultPipeline: {
          processors: [
            { type: 'summarizer', config: { enabled: true, options: { llmConfig } } },
            { type: 'classifier', config: { enabled: true, options: { llmConfig } } },
            { type: 'scorer', config: { enabled: true, options: { llmConfig } } },
          ],
        },
      });
      const result = await job.processOne(articleId);
      if (result) {
        // Reload article to get updated data
        const updated = await db.articles.get(articleId);
        if (updated) setArticle(updated);
      }
    } catch (error) {
      console.error('Failed to process article:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleExport = async (format: ExportFormat) => {
    if (!article) return;

    const tags = parseTags();
    const exportData = {
      id: article.id,
      title: article.title,
      content: article.content,
      source: source?.name,
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
      tags,
      score: article.score,
      summary: article.summary,
      isRead: article.isRead,
      isFavorite: article.isFavorite,
    };

    // Dynamic import to avoid bundling issues
    const { ExportService } = await import('../core/export');
    const service = new ExportService();
    const content = service.preview(exportData, format);

    const mimeTypes: Record<ExportFormat, string> = {
      markdown: 'text/markdown',
      pdf: 'application/pdf',
      html: 'text/html',
      json: 'application/json',
      csv: 'text/csv',
    };

    const extensions: Record<ExportFormat, string> = {
      markdown: 'md',
      pdf: 'pdf',
      html: 'html',
      json: 'json',
      csv: 'csv',
    };

    // Handle both string and Buffer content
    const blobContent: BlobPart = typeof content === 'string'
      ? content
      : new Uint8Array(content);

    const blob = new Blob([blobContent], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.${extensions[format]}`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportMenu(false);
  };

  const parseTags = (): string[] => {
    if (!article?.tags) return [];
    try {
      return JSON.parse(article.tags);
    } catch {
      return [];
    }
  };

  if (!article) {
    return (
      <div className="article-detail">
        <div className="article-detail-header">
          <button className="view-header-back" onClick={onBack}>←</button>
        </div>
        <div className="article-detail-loading">{t('common.loading')}</div>
      </div>
    );
  }

  const tags = parseTags();
  const isProcessed = article.processedAt > 0;
  const isFiltered = article.filtered === 1;

  return (
    <div className="article-detail">
      <div className="article-detail-header">
        <button className="view-header-back" onClick={onBack}>←</button>
        <div className="article-detail-actions">
          <button
            className="action-btn process-btn"
            onClick={processArticle}
            disabled={isProcessing || !llmConfig?.apiKey}
            title={
              !llmConfig?.apiKey
                ? t('errors.apiKeyRequired')
                : isProcessed
                  ? t('articles.ai.processed')
                  : t('articles.ai.process')
            }
          >
            {isProcessing ? '⏳' : isProcessed ? '✓' : '⚡'}
          </button>
          <button
            className={`action-btn ${article.isFavorite ? 'active' : ''}`}
            onClick={toggleFavorite}
            title={article.isFavorite ? t('articles.unfavorite') : t('articles.favorite')}
          >
            {article.isFavorite ? '★' : '☆'}
          </button>
          <button
            className="action-btn"
            onClick={openLink}
            title={t('articles.openLink')}
          >
            ↗
          </button>
          <div className="export-dropdown">
            <button
              className="action-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title={t('articles.export') || 'Export'}
            >
              ↓
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExport('markdown')}>Markdown</button>
                <button onClick={() => handleExport('pdf')}>PDF</button>
                <button onClick={() => handleExport('html')}>HTML</button>
                <button onClick={() => handleExport('json')}>JSON</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="article-detail-content">
        <h1 className="article-title">{article.title}</h1>
        <div className="article-meta">
          <span>{source?.name || 'Unknown'}</span>
          {article.author && (
            <>
              <span>·</span>
              <span>{article.author}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDate(article.publishedAt)}</span>
          {isProcessed && article.score !== undefined && (
            <>
              <span>·</span>
              <span className={`article-score-badge score-${Math.floor(article.score / 3)}`}>
                {t('articles.ai.score')}: {article.score}
              </span>
            </>
          )}
        </div>

        {tags.length > 0 && (
          <div className="article-tags">
            {tags.map((tag, i) => (
              <span key={i} className="article-tag">{tag}</span>
            ))}
          </div>
        )}

        {isFiltered && article.filterReason && (
          <div className="article-filtered-notice">
            <span className="filtered-icon">⚠</span>
            <span>{t('articles.ai.filtered')}: {article.filterReason}</span>
          </div>
        )}

        {article.summary && (
          <div className="article-summary-section">
            <div
              className="article-summary-header"
              onClick={() => setShowSummary(!showSummary)}
            >
              <span className="summary-icon">🤖</span>
              <span className="summary-title">{t('articles.ai.summary')}</span>
              <span className="summary-toggle">{showSummary ? '▼' : '▶'}</span>
            </div>
            {showSummary && (
              <div className="article-summary-content">
                {article.summary}
              </div>
            )}
          </div>
        )}

        <div className="article-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
