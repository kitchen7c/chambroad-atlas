# P5 AI Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an intelligent AI assistant that enables natural language interaction for configuration, search, recommendations, and action suggestions.

**Architecture:** Intent-based routing system that parses user messages to detect and execute commands. AssistantService orchestrates all AI features using LLMClient for understanding and generation. Integrates with existing KnowledgeBase, SourceRegistry, and ProcessorRegistry for data access.

**Tech Stack:** TypeScript, LLMClient (multi-provider), Zod validation, React hooks for UI integration

---

## Phase 1: Assistant Foundation

### Task 1: Define Assistant Types

**Files:**
- Create: `src/core/assistant/types.ts`

**Step 1: Create the types file**

```typescript
import { z } from 'zod';

// Intent types for routing
export type IntentType =
  | 'configure_source'
  | 'configure_filter'
  | 'search'
  | 'subscribe'
  | 'summarize'
  | 'recommend'
  | 'action'
  | 'general';

// Intent detection result
export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  entities: Record<string, string | number | boolean>;
  originalQuery: string;
}

// Configuration intent entities
export const ConfigureSourceSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'enable', 'disable']),
  name: z.string().optional(),
  url: z.string().url().optional(),
  type: z.enum(['rss', 'web']).optional(),
  schedule: z.string().optional(),
});

export type ConfigureSourceIntent = z.infer<typeof ConfigureSourceSchema>;

// Filter configuration
export const ConfigureFilterSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'enable', 'disable']),
  type: z.enum(['keyword', 'tag', 'score', 'source']).optional(),
  value: z.string().optional(),
  threshold: z.number().optional(),
});

export type ConfigureFilterIntent = z.infer<typeof ConfigureFilterSchema>;

// Search query
export interface SearchQuery {
  query: string;
  filters?: {
    tags?: string[];
    sources?: string[];
    dateRange?: { start?: string; end?: string };
    minScore?: number;
  };
  limit?: number;
}

// Recommendation request
export interface RecommendationRequest {
  count?: number;
  basedOn?: 'reading_history' | 'favorites' | 'recent' | 'similar';
  articleId?: string;
}

// Action suggestion
export interface ActionSuggestion {
  type: 'read_more' | 'save' | 'share' | 'subscribe' | 'search_related' | 'export';
  title: string;
  description: string;
  action: () => Promise<void>;
  priority: number;
}

// Assistant response
export interface AssistantResponse {
  message: string;
  intent: DetectedIntent;
  data?: unknown;
  actions?: ActionSuggestion[];
  followUp?: string[];
}

// Reading history entry
export interface ReadingHistoryEntry {
  articleId: string;
  title: string;
  source: string;
  tags: string[];
  readAt: string;
  duration?: number;
  completed: boolean;
}

// User preferences for recommendations
export interface UserPreferences {
  favoriteTopics: string[];
  favoriteSourceTypes: string[];
  readingTimes: { hour: number; count: number }[];
  avgReadingDuration: number;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/assistant/types.ts
git commit -m "feat(assistant): add AI assistant types and schemas"
```

---

### Task 2: Create Intent Parser

**Files:**
- Create: `src/core/assistant/intent-parser.ts`
- Create: `src/core/assistant/intent-parser.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentParser } from './intent-parser';
import type { LLMClient } from '../llm';

describe('IntentParser', () => {
  const mockLLMClient = {
    chat: vi.fn(),
  } as unknown as LLMClient;

  let parser: IntentParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new IntentParser(mockLLMClient);
  });

  describe('parse', () => {
    it('should detect search intent', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'search',
          confidence: 0.95,
          entities: { query: 'AI news' },
        }),
      });

      const result = await parser.parse('Find articles about AI');

      expect(result.type).toBe('search');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect configure_source intent', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'configure_source',
          confidence: 0.9,
          entities: { action: 'add', url: 'https://example.com/feed' },
        }),
      });

      const result = await parser.parse('Add RSS feed https://example.com/feed');

      expect(result.type).toBe('configure_source');
      expect(result.entities.action).toBe('add');
    });

    it('should detect subscribe intent', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'subscribe',
          confidence: 0.88,
          entities: { source: 'TechCrunch' },
        }),
      });

      const result = await parser.parse('Subscribe to TechCrunch');

      expect(result.type).toBe('subscribe');
    });

    it('should fallback to general for unclear intents', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'general',
          confidence: 0.6,
          entities: {},
        }),
      });

      const result = await parser.parse('Hello');

      expect(result.type).toBe('general');
    });
  });

  describe('parseLocal', () => {
    it('should detect search keywords locally', () => {
      const result = parser.parseLocal('search for AI news');

      expect(result.type).toBe('search');
      expect(result.entities.query).toBe('AI news');
    });

    it('should detect add source keywords', () => {
      const result = parser.parseLocal('add feed https://example.com/rss');

      expect(result.type).toBe('configure_source');
      expect(result.entities.action).toBe('add');
    });

    it('should detect recommend keywords', () => {
      const result = parser.parseLocal('recommend some articles');

      expect(result.type).toBe('recommend');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/assistant/intent-parser.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import type { LLMClient, LLMMessage } from '../llm';
import type { DetectedIntent, IntentType } from './types';

const INTENT_PROMPT = `You are an intent detection system for an article reading assistant.

Analyze the user's message and detect their intent. Return a JSON object with:
- type: one of "configure_source", "configure_filter", "search", "subscribe", "summarize", "recommend", "action", "general"
- confidence: number between 0 and 1
- entities: relevant extracted entities

Intent types:
- configure_source: Adding, updating, or managing RSS feeds and sources
- configure_filter: Setting up keyword filters, score thresholds, tag filters
- search: Looking for specific articles or topics
- subscribe: Quick subscribe to a source mentioned in context
- summarize: Requesting a summary of an article or topic
- recommend: Asking for article recommendations
- action: Requesting to perform an action (export, save, share)
- general: General conversation or unclear intent

Examples:
- "Add TechCrunch feed" → configure_source, entities: {action: "add", name: "TechCrunch"}
- "Find AI articles" → search, entities: {query: "AI"}
- "What should I read?" → recommend, entities: {}
- "Summarize this article" → summarize, entities: {}

User message: {{MESSAGE}}

Return ONLY valid JSON, no other text.`;

export class IntentParser {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Parse intent using LLM
   */
  async parse(message: string): Promise<DetectedIntent> {
    try {
      const prompt = INTENT_PROMPT.replace('{{MESSAGE}}', message);

      const messages: LLMMessage[] = [
        { role: 'user', content: prompt },
      ];

      const response = await this.llmClient.chat(messages);

      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackIntent(message);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        type: parsed.type || 'general',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        originalQuery: message,
      };
    } catch (error) {
      console.error('Intent parsing failed:', error);
      return this.parseLocal(message);
    }
  }

  /**
   * Fast local intent parsing without LLM
   */
  parseLocal(message: string): DetectedIntent {
    const lower = message.toLowerCase().trim();

    // Search patterns
    const searchPatterns = [
      /^(search|find|look for|show me|get)\s+(.+)/i,
      /^(.+)\s+(articles?|news|posts?)/i,
    ];

    for (const pattern of searchPatterns) {
      const match = lower.match(pattern);
      if (match) {
        return {
          type: 'search',
          confidence: 0.8,
          entities: { query: match[2] || match[1] },
          originalQuery: message,
        };
      }
    }

    // Configure source patterns
    const addPatterns = [
      /^(add|subscribe|follow)\s+(feed|source|rss)?\s*(.+)/i,
      /^(add|subscribe)\s+to\s+(.+)/i,
    ];

    for (const pattern of addPatterns) {
      const match = message.match(pattern);
      if (match) {
        const urlMatch = message.match(/https?:\/\/[^\s]+/);
        return {
          type: 'configure_source',
          confidence: 0.85,
          entities: {
            action: 'add',
            url: urlMatch?.[0],
            name: match[3] || match[2],
          },
          originalQuery: message,
        };
      }
    }

    // Recommend patterns
    if (/^(recommend|suggest|what should i read)/i.test(lower)) {
      return {
        type: 'recommend',
        confidence: 0.85,
        entities: {},
        originalQuery: message,
      };
    }

    // Summarize patterns
    if (/^(summarize|summary|tldr|brief)/i.test(lower)) {
      return {
        type: 'summarize',
        confidence: 0.85,
        entities: {},
        originalQuery: message,
      };
    }

    // Filter patterns
    if (/^(filter|block|hide|exclude|include only)/i.test(lower)) {
      return {
        type: 'configure_filter',
        confidence: 0.8,
        entities: {},
        originalQuery: message,
      };
    }

    // Subscribe patterns (quick)
    if (/^subscribe/i.test(lower)) {
      const sourceMatch = message.match(/subscribe\s+(?:to\s+)?(.+)/i);
      return {
        type: 'subscribe',
        confidence: 0.85,
        entities: { source: sourceMatch?.[1] },
        originalQuery: message,
      };
    }

    // Default to general
    return this.fallbackIntent(message);
  }

  private fallbackIntent(message: string): DetectedIntent {
    return {
      type: 'general',
      confidence: 0.5,
      entities: {},
      originalQuery: message,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/assistant/intent-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/assistant/intent-parser.ts src/core/assistant/intent-parser.test.ts
git commit -m "feat(assistant): add intent parser for natural language understanding"
```

---

### Task 3: Create Recommendation Engine

**Files:**
- Create: `src/core/assistant/recommendation-engine.ts`
- Create: `src/core/assistant/recommendation-engine.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationEngine } from './recommendation-engine';

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;

  const mockArticles = [
    { id: '1', title: 'AI News', tags: ['AI', 'Tech'], score: 8, source: 'TechCrunch' },
    { id: '2', title: 'Web Dev', tags: ['Web', 'Tech'], score: 7, source: 'Dev.to' },
    { id: '3', title: 'ML Guide', tags: ['AI', 'ML'], score: 9, source: 'Medium' },
    { id: '4', title: 'Old Article', tags: ['News'], score: 5, source: 'RSS' },
  ];

  const mockHistory = [
    { articleId: '1', title: 'AI News', source: 'TechCrunch', tags: ['AI', 'Tech'], readAt: new Date().toISOString(), completed: true },
    { articleId: '3', title: 'ML Guide', source: 'Medium', tags: ['AI', 'ML'], readAt: new Date().toISOString(), completed: true },
  ];

  beforeEach(() => {
    engine = new RecommendationEngine();
  });

  describe('analyzePreferences', () => {
    it('should extract favorite topics from history', () => {
      const prefs = engine.analyzePreferences(mockHistory);

      expect(prefs.favoriteTopics).toContain('AI');
      expect(prefs.favoriteTopics.indexOf('AI')).toBeLessThan(prefs.favoriteTopics.indexOf('Tech'));
    });
  });

  describe('recommend', () => {
    it('should recommend articles based on preferences', () => {
      const prefs = engine.analyzePreferences(mockHistory);
      const recommendations = engine.recommend(mockArticles as any, prefs, 2);

      expect(recommendations.length).toBeLessThanOrEqual(2);
      // Should prefer AI articles based on history
      expect(recommendations.some(r => r.tags.includes('AI'))).toBe(true);
    });

    it('should filter out already read articles', () => {
      const prefs = engine.analyzePreferences(mockHistory);
      const readIds = new Set(['1', '3']);
      const recommendations = engine.recommend(mockArticles as any, prefs, 10, readIds);

      expect(recommendations.every(r => !readIds.has(r.id))).toBe(true);
    });
  });

  describe('scoreArticle', () => {
    it('should score higher for matching topics', () => {
      const prefs = { favoriteTopics: ['AI'], favoriteSourceTypes: [], readingTimes: [], avgReadingDuration: 0 };

      const aiScore = engine.scoreArticle(mockArticles[0] as any, prefs);
      const webScore = engine.scoreArticle(mockArticles[1] as any, prefs);

      expect(aiScore).toBeGreaterThan(webScore);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/assistant/recommendation-engine.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import type { StoredArticle } from '../storage/db';
import type { ReadingHistoryEntry, UserPreferences } from './types';

export class RecommendationEngine {
  /**
   * Analyze reading history to extract user preferences
   */
  analyzePreferences(history: ReadingHistoryEntry[]): UserPreferences {
    const topicCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const timeCounts: Record<number, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const entry of history) {
      // Count topics
      for (const tag of entry.tags) {
        topicCounts[tag] = (topicCounts[tag] || 0) + 1;
      }

      // Count sources
      sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;

      // Track reading times
      const hour = new Date(entry.readAt).getHours();
      timeCounts[hour] = (timeCounts[hour] || 0) + 1;

      // Track duration
      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }
    }

    // Sort topics by frequency
    const favoriteTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    // Sort sources by frequency
    const favoriteSourceTypes = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source]) => source);

    // Format reading times
    const readingTimes = Object.entries(timeCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    return {
      favoriteTopics,
      favoriteSourceTypes,
      readingTimes,
      avgReadingDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  /**
   * Recommend articles based on user preferences
   */
  recommend(
    articles: StoredArticle[],
    preferences: UserPreferences,
    count: number = 5,
    excludeIds?: Set<string>
  ): StoredArticle[] {
    // Filter out already read articles
    let candidates = articles;
    if (excludeIds) {
      candidates = articles.filter(a => !excludeIds.has(a.id));
    }

    // Score each article
    const scored = candidates.map(article => ({
      article,
      score: this.scoreArticle(article, preferences),
    }));

    // Sort by score and return top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.article);
  }

  /**
   * Score an article based on user preferences
   */
  scoreArticle(article: StoredArticle, preferences: UserPreferences): number {
    let score = 0;

    // Base score from article score
    score += (article.score || 5) * 10;

    // Topic match bonus
    const articleTags = article.tags || [];
    for (let i = 0; i < preferences.favoriteTopics.length; i++) {
      const topic = preferences.favoriteTopics[i];
      if (articleTags.includes(topic)) {
        // Earlier in the list = higher weight
        score += (preferences.favoriteTopics.length - i) * 15;
      }
    }

    // Source match bonus
    const sourceIndex = preferences.favoriteSourceTypes.indexOf(article.sourceName || '');
    if (sourceIndex >= 0) {
      score += (preferences.favoriteSourceTypes.length - sourceIndex) * 10;
    }

    // Recency bonus (newer articles score higher)
    if (article.publishedAt) {
      const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        score += 20;
      } else if (ageHours < 72) {
        score += 10;
      }
    }

    // Unread bonus
    if (!article.isRead) {
      score += 5;
    }

    return score;
  }

  /**
   * Find similar articles to a given article
   */
  findSimilar(
    targetArticle: StoredArticle,
    allArticles: StoredArticle[],
    count: number = 5
  ): StoredArticle[] {
    const targetTags = new Set(targetArticle.tags || []);
    const targetSource = targetArticle.sourceName;

    const scored = allArticles
      .filter(a => a.id !== targetArticle.id)
      .map(article => {
        let similarity = 0;

        // Tag overlap
        const articleTags = article.tags || [];
        const overlap = articleTags.filter(t => targetTags.has(t)).length;
        similarity += overlap * 20;

        // Same source bonus
        if (article.sourceName === targetSource) {
          similarity += 10;
        }

        // Similar score
        const scoreDiff = Math.abs((article.score || 5) - (targetArticle.score || 5));
        similarity += (10 - scoreDiff) * 2;

        return { article, similarity };
      });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, count)
      .map(s => s.article);
  }

  /**
   * Get trending topics from recent articles
   */
  getTrendingTopics(articles: StoredArticle[], limit: number = 5): string[] {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Filter to recent articles
    const recentArticles = articles.filter(a => {
      const date = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      return date > oneDayAgo;
    });

    // Count tags
    const tagCounts: Record<string, number> = {};
    for (const article of recentArticles) {
      for (const tag of article.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // Sort by frequency
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/assistant/recommendation-engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/assistant/recommendation-engine.ts src/core/assistant/recommendation-engine.test.ts
git commit -m "feat(assistant): add recommendation engine for smart suggestions"
```

---

## Phase 2: Core Assistant Service

### Task 4: Create Action Suggester

**Files:**
- Create: `src/core/assistant/action-suggester.ts`
- Create: `src/core/assistant/action-suggester.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { ActionSuggester } from './action-suggester';

describe('ActionSuggester', () => {
  let suggester: ActionSuggester;

  beforeEach(() => {
    suggester = new ActionSuggester();
  });

  const mockArticle = {
    id: '1',
    title: 'AI Revolution',
    content: 'AI is transforming the world...',
    tags: ['AI', 'Tech'],
    score: 8,
    isRead: false,
    isFavorite: false,
    url: 'https://example.com/article',
    sourceName: 'TechCrunch',
  };

  describe('suggest', () => {
    it('should suggest save action for high-score unread article', () => {
      const actions = suggester.suggest(mockArticle as any);

      expect(actions.some(a => a.type === 'save')).toBe(true);
    });

    it('should suggest read_more for article with related topics', () => {
      const actions = suggester.suggest(mockArticle as any);

      expect(actions.some(a => a.type === 'read_more' || a.type === 'search_related')).toBe(true);
    });

    it('should suggest export for favorited articles', () => {
      const favArticle = { ...mockArticle, isFavorite: true };
      const actions = suggester.suggest(favArticle as any);

      expect(actions.some(a => a.type === 'export')).toBe(true);
    });

    it('should sort actions by priority', () => {
      const actions = suggester.suggest(mockArticle as any);

      for (let i = 1; i < actions.length; i++) {
        expect(actions[i - 1].priority).toBeGreaterThanOrEqual(actions[i].priority);
      }
    });
  });

  describe('suggestFromContext', () => {
    it('should suggest subscribe when viewing source', () => {
      const context = { currentSource: 'TechCrunch', isSubscribed: false };
      const actions = suggester.suggestFromContext(context);

      expect(actions.some(a => a.type === 'subscribe')).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/assistant/action-suggester.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import type { StoredArticle } from '../storage/db';
import type { ActionSuggestion } from './types';

interface ArticleContext {
  currentSource?: string;
  isSubscribed?: boolean;
  hasRelatedArticles?: boolean;
  recentSearchQuery?: string;
}

export class ActionSuggester {
  /**
   * Suggest actions for an article
   */
  suggest(article: StoredArticle): ActionSuggestion[] {
    const actions: ActionSuggestion[] = [];

    // High-score article → suggest saving
    if ((article.score || 0) >= 7 && !article.isFavorite) {
      actions.push({
        type: 'save',
        title: 'Save to favorites',
        description: 'This is a high-quality article worth saving',
        priority: 90,
        action: async () => {
          // Action will be bound by the service
        },
      });
    }

    // Has tags → suggest searching related
    if (article.tags && article.tags.length > 0) {
      actions.push({
        type: 'search_related',
        title: 'Find related articles',
        description: `Search for more articles about ${article.tags.slice(0, 2).join(', ')}`,
        priority: 70,
        action: async () => {},
      });
    }

    // Has URL → suggest reading original
    if (article.url) {
      actions.push({
        type: 'read_more',
        title: 'Read original',
        description: 'Open the full article in a new tab',
        priority: 60,
        action: async () => {},
      });
    }

    // Is favorite → suggest export
    if (article.isFavorite) {
      actions.push({
        type: 'export',
        title: 'Export article',
        description: 'Save to Markdown, PDF, or other formats',
        priority: 50,
        action: async () => {},
      });
    }

    // Has source → suggest subscribing
    if (article.sourceName) {
      actions.push({
        type: 'subscribe',
        title: `Subscribe to ${article.sourceName}`,
        description: 'Get more articles from this source',
        priority: 40,
        action: async () => {},
      });
    }

    // Share action
    if (article.url) {
      actions.push({
        type: 'share',
        title: 'Share article',
        description: 'Copy link or share to social media',
        priority: 30,
        action: async () => {},
      });
    }

    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Suggest actions based on current context
   */
  suggestFromContext(context: ArticleContext): ActionSuggestion[] {
    const actions: ActionSuggestion[] = [];

    // Viewing unsubscribed source → suggest subscribe
    if (context.currentSource && !context.isSubscribed) {
      actions.push({
        type: 'subscribe',
        title: `Subscribe to ${context.currentSource}`,
        description: 'Follow this source for updates',
        priority: 80,
        action: async () => {},
      });
    }

    // Has recent search → suggest refining
    if (context.recentSearchQuery) {
      actions.push({
        type: 'search_related',
        title: 'Refine search',
        description: `Expand your search for "${context.recentSearchQuery}"`,
        priority: 60,
        action: async () => {},
      });
    }

    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate action description using AI (can be called with LLM)
   */
  generateActionDescription(article: StoredArticle): string {
    const parts: string[] = [];

    if ((article.score || 0) >= 8) {
      parts.push('This is a highly-rated article.');
    }

    if (article.tags && article.tags.length > 0) {
      parts.push(`Topics: ${article.tags.join(', ')}.`);
    }

    if (!article.isRead) {
      parts.push('You haven\'t read this yet.');
    }

    return parts.join(' ') || 'No specific actions suggested.';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/assistant/action-suggester.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/assistant/action-suggester.ts src/core/assistant/action-suggester.test.ts
git commit -m "feat(assistant): add action suggester for smart recommendations"
```

---

### Task 5: Create Summary Generator

**Files:**
- Create: `src/core/assistant/summary-generator.ts`
- Create: `src/core/assistant/summary-generator.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SummaryGenerator } from './summary-generator';
import type { LLMClient } from '../llm';

describe('SummaryGenerator', () => {
  const mockLLMClient = {
    chat: vi.fn(),
  } as unknown as LLMClient;

  let generator: SummaryGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new SummaryGenerator(mockLLMClient);
  });

  describe('summarize', () => {
    it('should generate article summary', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: 'This article discusses the latest advances in AI technology.',
      });

      const summary = await generator.summarize('Long article content here...');

      expect(summary).toContain('AI');
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });

    it('should handle empty content', async () => {
      const summary = await generator.summarize('');

      expect(summary).toBe('No content to summarize.');
    });
  });

  describe('generateKeyPoints', () => {
    it('should extract key points', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: '1. First point\n2. Second point\n3. Third point',
      });

      const points = await generator.generateKeyPoints('Article content...');

      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe('generateDigest', () => {
    it('should generate daily digest', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: 'Today\'s top stories cover AI and technology trends.',
      });

      const articles = [
        { title: 'AI News', summary: 'AI is advancing', tags: ['AI'] },
        { title: 'Tech Update', summary: 'New tech release', tags: ['Tech'] },
      ];

      const digest = await generator.generateDigest(articles as any);

      expect(digest).toBeTruthy();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/assistant/summary-generator.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import type { LLMClient, LLMMessage } from '../llm';
import type { StoredArticle } from '../storage/db';

const SUMMARY_PROMPT = `Summarize the following article content in 2-3 concise sentences. Focus on the main points and key takeaways.

Article:
{{CONTENT}}

Summary:`;

const KEY_POINTS_PROMPT = `Extract 3-5 key points from the following article. Format as a numbered list.

Article:
{{CONTENT}}

Key points:`;

const DIGEST_PROMPT = `Create a brief daily digest summarizing the following articles. Highlight common themes and the most important stories.

Articles:
{{ARTICLES}}

Digest:`;

export class SummaryGenerator {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Generate a summary for article content
   */
  async summarize(content: string, maxLength: number = 200): Promise<string> {
    if (!content || content.trim().length === 0) {
      return 'No content to summarize.';
    }

    try {
      // Truncate very long content
      const truncated = content.slice(0, 5000);
      const prompt = SUMMARY_PROMPT.replace('{{CONTENT}}', truncated);

      const messages: LLMMessage[] = [
        { role: 'user', content: prompt },
      ];

      const response = await this.llmClient.chat(messages);
      let summary = response.content.trim();

      // Truncate if too long
      if (summary.length > maxLength) {
        summary = summary.slice(0, maxLength - 3) + '...';
      }

      return summary;
    } catch (error) {
      console.error('Summary generation failed:', error);
      return this.fallbackSummary(content);
    }
  }

  /**
   * Generate key points from article
   */
  async generateKeyPoints(content: string): Promise<string[]> {
    if (!content || content.trim().length === 0) {
      return [];
    }

    try {
      const truncated = content.slice(0, 5000);
      const prompt = KEY_POINTS_PROMPT.replace('{{CONTENT}}', truncated);

      const messages: LLMMessage[] = [
        { role: 'user', content: prompt },
      ];

      const response = await this.llmClient.chat(messages);

      // Parse numbered list
      const lines = response.content.split('\n');
      const points: string[] = [];

      for (const line of lines) {
        const match = line.match(/^\d+[\.\)]\s*(.+)/);
        if (match) {
          points.push(match[1].trim());
        }
      }

      return points;
    } catch (error) {
      console.error('Key points generation failed:', error);
      return [];
    }
  }

  /**
   * Generate daily digest from multiple articles
   */
  async generateDigest(articles: StoredArticle[]): Promise<string> {
    if (articles.length === 0) {
      return 'No articles to digest.';
    }

    try {
      // Format articles for prompt
      const articleSummaries = articles.map((a, i) =>
        `${i + 1}. "${a.title}" (${a.sourceName || 'Unknown'}): ${a.summary || 'No summary'}`
      ).join('\n');

      const prompt = DIGEST_PROMPT.replace('{{ARTICLES}}', articleSummaries);

      const messages: LLMMessage[] = [
        { role: 'user', content: prompt },
      ];

      const response = await this.llmClient.chat(messages);
      return response.content.trim();
    } catch (error) {
      console.error('Digest generation failed:', error);
      return this.fallbackDigest(articles);
    }
  }

  /**
   * Quick summary without LLM
   */
  private fallbackSummary(content: string): string {
    // Take first 200 characters
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 200) {
      return cleaned;
    }

    // Find a good break point
    const truncated = cleaned.slice(0, 200);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > 100) {
      return truncated.slice(0, lastPeriod + 1);
    }

    return truncated + '...';
  }

  /**
   * Quick digest without LLM
   */
  private fallbackDigest(articles: StoredArticle[]): string {
    const topArticles = articles.slice(0, 5);
    const titles = topArticles.map(a => a.title).join(', ');
    return `Today's top articles: ${titles}.`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/assistant/summary-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/assistant/summary-generator.ts src/core/assistant/summary-generator.test.ts
git commit -m "feat(assistant): add summary generator for smart summarization"
```

---

### Task 6: Create Assistant Service

**Files:**
- Create: `src/core/assistant/assistant-service.ts`
- Create: `src/core/assistant/assistant-service.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantService } from './assistant-service';
import type { LLMClient } from '../llm';
import type { AtlasDB } from '../storage/db';
import type { SourceRegistry } from '../sources/registry';

describe('AssistantService', () => {
  const mockLLMClient = {
    chat: vi.fn(),
  } as unknown as LLMClient;

  const mockDB = {
    articles: { toArray: vi.fn().mockResolvedValue([]) },
    sources: { toArray: vi.fn().mockResolvedValue([]) },
  } as unknown as AtlasDB;

  const mockRegistry = {
    add: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  } as unknown as SourceRegistry;

  let service: AssistantService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AssistantService(mockLLMClient, mockDB, mockRegistry);
  });

  describe('process', () => {
    it('should handle search intent', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'search',
          confidence: 0.9,
          entities: { query: 'AI' },
        }),
      });
      (mockDB.articles.toArray as any).mockResolvedValue([
        { id: '1', title: 'AI News', tags: ['AI'], content: 'About AI' },
      ]);

      const response = await service.process('Find AI articles');

      expect(response.intent.type).toBe('search');
      expect(response.data).toBeDefined();
    });

    it('should handle recommend intent', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'recommend',
          confidence: 0.85,
          entities: {},
        }),
      });
      (mockDB.articles.toArray as any).mockResolvedValue([
        { id: '1', title: 'Tech News', tags: ['Tech'], score: 8 },
      ]);

      const response = await service.process('What should I read?');

      expect(response.intent.type).toBe('recommend');
    });

    it('should handle subscribe intent', async () => {
      (mockLLMClient.chat as any).mockResolvedValue({
        content: JSON.stringify({
          type: 'subscribe',
          confidence: 0.9,
          entities: { source: 'TechCrunch' },
        }),
      });

      const response = await service.process('Subscribe to TechCrunch');

      expect(response.intent.type).toBe('subscribe');
      expect(response.message).toContain('TechCrunch');
    });

    it('should handle general messages', async () => {
      (mockLLMClient.chat as any)
        .mockResolvedValueOnce({
          content: JSON.stringify({
            type: 'general',
            confidence: 0.5,
            entities: {},
          }),
        })
        .mockResolvedValueOnce({
          content: 'Hello! I can help you find and manage articles.',
        });

      const response = await service.process('Hello');

      expect(response.intent.type).toBe('general');
      expect(response.message).toBeTruthy();
    });
  });

  describe('getRecommendations', () => {
    it('should return article recommendations', async () => {
      (mockDB.articles.toArray as any).mockResolvedValue([
        { id: '1', title: 'Article 1', score: 8, tags: ['AI'] },
        { id: '2', title: 'Article 2', score: 7, tags: ['Tech'] },
      ]);

      const recs = await service.getRecommendations(2);

      expect(recs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('quickSubscribe', () => {
    it('should add source to registry', async () => {
      await service.quickSubscribe('https://example.com/feed', 'Example');

      expect(mockRegistry.add).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/core/assistant/assistant-service.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

```typescript
import type { LLMClient, LLMMessage } from '../llm';
import type { AtlasDB, StoredArticle } from '../storage/db';
import type { SourceRegistry } from '../sources/registry';
import { IntentParser } from './intent-parser';
import { RecommendationEngine } from './recommendation-engine';
import { ActionSuggester } from './action-suggester';
import { SummaryGenerator } from './summary-generator';
import type {
  AssistantResponse,
  DetectedIntent,
  ReadingHistoryEntry,
  SearchQuery,
} from './types';

const GENERAL_SYSTEM_PROMPT = `You are Atlas, an intelligent reading assistant. You help users:
- Find and discover articles
- Manage their reading sources
- Get personalized recommendations
- Summarize content

Be helpful, concise, and proactive in suggesting actions.`;

export class AssistantService {
  private llmClient: LLMClient;
  private db: AtlasDB;
  private registry: SourceRegistry;
  private intentParser: IntentParser;
  private recommendationEngine: RecommendationEngine;
  private actionSuggester: ActionSuggester;
  private summaryGenerator: SummaryGenerator;
  private readingHistory: ReadingHistoryEntry[] = [];

  constructor(
    llmClient: LLMClient,
    db: AtlasDB,
    registry: SourceRegistry
  ) {
    this.llmClient = llmClient;
    this.db = db;
    this.registry = registry;
    this.intentParser = new IntentParser(llmClient);
    this.recommendationEngine = new RecommendationEngine();
    this.actionSuggester = new ActionSuggester();
    this.summaryGenerator = new SummaryGenerator(llmClient);
  }

  /**
   * Process a user message and return response
   */
  async process(message: string): Promise<AssistantResponse> {
    // Parse intent
    const intent = await this.intentParser.parse(message);

    // Route to appropriate handler
    switch (intent.type) {
      case 'search':
        return this.handleSearch(intent);
      case 'configure_source':
        return this.handleConfigureSource(intent);
      case 'configure_filter':
        return this.handleConfigureFilter(intent);
      case 'subscribe':
        return this.handleSubscribe(intent);
      case 'summarize':
        return this.handleSummarize(intent);
      case 'recommend':
        return this.handleRecommend(intent);
      case 'action':
        return this.handleAction(intent);
      default:
        return this.handleGeneral(intent, message);
    }
  }

  /**
   * Handle search intent
   */
  private async handleSearch(intent: DetectedIntent): Promise<AssistantResponse> {
    const query = intent.entities.query as string || intent.originalQuery;
    const articles = await this.db.articles.toArray();

    // Simple search
    const results = articles.filter(a =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.content?.toLowerCase().includes(query.toLowerCase()) ||
      a.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
    );

    const message = results.length > 0
      ? `Found ${results.length} article${results.length > 1 ? 's' : ''} matching "${query}".`
      : `No articles found for "${query}". Try a different search or check your sources.`;

    return {
      message,
      intent,
      data: { articles: results.slice(0, 10) },
      followUp: results.length === 0
        ? ['Try searching for related topics', 'Add new sources to expand your content']
        : undefined,
    };
  }

  /**
   * Handle source configuration
   */
  private async handleConfigureSource(intent: DetectedIntent): Promise<AssistantResponse> {
    const action = intent.entities.action as string;
    const url = intent.entities.url as string;
    const name = intent.entities.name as string;

    if (action === 'add' && url) {
      try {
        await this.quickSubscribe(url, name || 'New Source');
        return {
          message: `Added source "${name || url}". It will be fetched shortly.`,
          intent,
          followUp: ['View your sources', 'Fetch articles now'],
        };
      } catch (error) {
        return {
          message: `Failed to add source: ${(error as Error).message}`,
          intent,
        };
      }
    }

    return {
      message: 'Please provide a URL to add as a source. For example: "Add feed https://example.com/rss"',
      intent,
    };
  }

  /**
   * Handle filter configuration
   */
  private async handleConfigureFilter(intent: DetectedIntent): Promise<AssistantResponse> {
    // TODO: Implement filter configuration
    return {
      message: 'Filter configuration coming soon. You can currently set filters in Settings.',
      intent,
    };
  }

  /**
   * Handle quick subscribe
   */
  private async handleSubscribe(intent: DetectedIntent): Promise<AssistantResponse> {
    const source = intent.entities.source as string;

    if (!source) {
      return {
        message: 'What source would you like to subscribe to? Provide a name or URL.',
        intent,
      };
    }

    // Check if it's a URL or a name
    if (source.startsWith('http')) {
      await this.quickSubscribe(source, 'New Source');
      return {
        message: `Subscribed to ${source}!`,
        intent,
      };
    }

    // It's a name - try to find matching source
    return {
      message: `To subscribe to "${source}", please provide the RSS feed URL.`,
      intent,
      followUp: [`Search for ${source} RSS feed`],
    };
  }

  /**
   * Handle summarize request
   */
  private async handleSummarize(intent: DetectedIntent): Promise<AssistantResponse> {
    const articleId = intent.entities.articleId as string;

    if (articleId) {
      const article = await this.db.articles.get(articleId);
      if (article && article.content) {
        const summary = await this.summaryGenerator.summarize(article.content);
        return {
          message: summary,
          intent,
          data: { article },
        };
      }
    }

    // No specific article - summarize recent
    const articles = await this.db.articles.toArray();
    const recent = articles.slice(0, 5);
    const digest = await this.summaryGenerator.generateDigest(recent);

    return {
      message: digest,
      intent,
      data: { articles: recent },
    };
  }

  /**
   * Handle recommendation request
   */
  private async handleRecommend(intent: DetectedIntent): Promise<AssistantResponse> {
    const count = (intent.entities.count as number) || 5;
    const recommendations = await this.getRecommendations(count);

    if (recommendations.length === 0) {
      return {
        message: 'No recommendations available. Try adding more sources or reading some articles first!',
        intent,
        followUp: ['Add a new source', 'Browse all articles'],
      };
    }

    const titles = recommendations.map(r => `• ${r.title}`).join('\n');
    return {
      message: `Here are some articles you might like:\n\n${titles}`,
      intent,
      data: { articles: recommendations },
    };
  }

  /**
   * Handle action request
   */
  private async handleAction(intent: DetectedIntent): Promise<AssistantResponse> {
    const actionType = intent.entities.action as string;

    return {
      message: `Action "${actionType}" will be executed.`,
      intent,
    };
  }

  /**
   * Handle general conversation
   */
  private async handleGeneral(intent: DetectedIntent, message: string): Promise<AssistantResponse> {
    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: GENERAL_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ];

      const response = await this.llmClient.chat(messages);

      return {
        message: response.content,
        intent,
        followUp: ['Search for articles', 'Get recommendations', 'Add a new source'],
      };
    } catch (error) {
      return {
        message: 'I can help you find articles, manage sources, and get recommendations. What would you like to do?',
        intent,
      };
    }
  }

  /**
   * Get article recommendations
   */
  async getRecommendations(count: number = 5): Promise<StoredArticle[]> {
    const articles = await this.db.articles.toArray();
    const preferences = this.recommendationEngine.analyzePreferences(this.readingHistory);
    const readIds = new Set(this.readingHistory.map(h => h.articleId));

    return this.recommendationEngine.recommend(articles, preferences, count, readIds);
  }

  /**
   * Quick subscribe to a source
   */
  async quickSubscribe(url: string, name: string): Promise<void> {
    await this.registry.add({
      id: `source-${Date.now()}`,
      name,
      type: 'rss',
      url,
      schedule: '0 * * * *',
      enabled: true,
      createdAt: Date.now(),
      lastFetchedAt: null,
    });
  }

  /**
   * Get action suggestions for an article
   */
  getActionSuggestions(article: StoredArticle): ReturnType<typeof this.actionSuggester.suggest> {
    return this.actionSuggester.suggest(article);
  }

  /**
   * Record reading history
   */
  recordRead(article: StoredArticle, completed: boolean = false): void {
    this.readingHistory.push({
      articleId: article.id,
      title: article.title,
      source: article.sourceName || 'Unknown',
      tags: article.tags || [],
      readAt: new Date().toISOString(),
      completed,
    });

    // Keep only last 100 entries
    if (this.readingHistory.length > 100) {
      this.readingHistory = this.readingHistory.slice(-100);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/core/assistant/assistant-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/assistant/assistant-service.ts src/core/assistant/assistant-service.test.ts
git commit -m "feat(assistant): add main AssistantService orchestrating all AI features"
```

---

### Task 7: Create Assistant Module Index

**Files:**
- Create: `src/core/assistant/index.ts`
- Modify: `src/core/index.ts`

**Step 1: Create assistant index**

```typescript
// src/core/assistant/index.ts
export * from './types';
export { IntentParser } from './intent-parser';
export { RecommendationEngine } from './recommendation-engine';
export { ActionSuggester } from './action-suggester';
export { SummaryGenerator } from './summary-generator';
export { AssistantService } from './assistant-service';
```

**Step 2: Add to core index**

Add to `src/core/index.ts`:

```typescript
// P5: AI Assistant
export * from './assistant';
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/assistant/index.ts src/core/index.ts
git commit -m "feat(assistant): add assistant module to core exports"
```

---

## Phase 3: UI Integration

### Task 8: Create useAssistant Hook

**Files:**
- Create: `src/hooks/useAssistant.ts`

**Step 1: Create the hook**

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { AssistantService, type AssistantResponse, type ActionSuggestion } from '../core/assistant';
import { LLMClient } from '../core/llm';
import { db } from '../core/storage/db';
import { registry } from '../core/sources/registry';
import type { Settings, StoredArticle } from '../../types';

export function useAssistant(settings: Settings | null) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<AssistantResponse | null>(null);
  const [actions, setActions] = useState<ActionSuggestion[]>([]);
  const serviceRef = useRef<AssistantService | null>(null);

  // Initialize service when settings change
  useEffect(() => {
    if (settings?.llm) {
      const llmClient = new LLMClient(settings.llm);
      serviceRef.current = new AssistantService(llmClient, db, registry);
    }
  }, [settings?.llm]);

  /**
   * Process a user message
   */
  const process = useCallback(async (message: string): Promise<AssistantResponse | null> => {
    if (!serviceRef.current) {
      return null;
    }

    setIsProcessing(true);
    try {
      const response = await serviceRef.current.process(message);
      setLastResponse(response);
      return response;
    } catch (error) {
      console.error('Assistant error:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Get recommendations
   */
  const getRecommendations = useCallback(async (count: number = 5) => {
    if (!serviceRef.current) {
      return [];
    }
    return serviceRef.current.getRecommendations(count);
  }, []);

  /**
   * Quick subscribe to a source
   */
  const quickSubscribe = useCallback(async (url: string, name: string) => {
    if (!serviceRef.current) {
      return;
    }
    await serviceRef.current.quickSubscribe(url, name);
  }, []);

  /**
   * Get action suggestions for an article
   */
  const getActions = useCallback((article: StoredArticle) => {
    if (!serviceRef.current) {
      return [];
    }
    const suggestions = serviceRef.current.getActionSuggestions(article);
    setActions(suggestions);
    return suggestions;
  }, []);

  /**
   * Record that user read an article
   */
  const recordRead = useCallback((article: StoredArticle, completed: boolean = false) => {
    if (serviceRef.current) {
      serviceRef.current.recordRead(article, completed);
    }
  }, []);

  return {
    isProcessing,
    lastResponse,
    actions,
    process,
    getRecommendations,
    quickSubscribe,
    getActions,
    recordRead,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useAssistant.ts
git commit -m "feat(ui): add useAssistant hook for React integration"
```

---

### Task 9: Add Assistant Commands to Chat

**Files:**
- Modify: `sidepanel.tsx`

**Step 1: Add assistant command suggestions**

Add new commands to the command menu in sidepanel.tsx. Find the existing commands array and add:

```typescript
const assistantCommands = [
  {
    command: '/recommend',
    title: 'Get Recommendations',
    description: 'Get personalized article recommendations based on your reading history',
  },
  {
    command: '/search',
    title: 'Search Articles',
    description: 'Search through your articles with natural language',
  },
  {
    command: '/subscribe',
    title: 'Quick Subscribe',
    description: 'Subscribe to a new RSS feed or source',
  },
  {
    command: '/summarize',
    title: 'Summarize',
    description: 'Get a summary of recent articles or a specific article',
  },
  {
    command: '/digest',
    title: 'Daily Digest',
    description: 'Generate a digest of today\'s top articles',
  },
];
```

**Step 2: Add command handler**

Add handler for assistant commands:

```typescript
const handleAssistantCommand = async (command: string, args: string) => {
  const { AssistantService } = await import('./src/core/assistant');
  const { LLMClient } = await import('./src/core/llm');
  const { db } = await import('./src/core/storage/db');
  const { registry } = await import('./src/core/sources/registry');

  if (!settings?.llm) {
    addMessage('assistant', 'Please configure your LLM settings first.');
    return;
  }

  const llmClient = new LLMClient(settings.llm);
  const assistant = new AssistantService(llmClient, db, registry);

  let message = '';
  switch (command) {
    case '/recommend':
      message = 'What should I read?';
      break;
    case '/search':
      message = `Search for ${args || 'articles'}`;
      break;
    case '/subscribe':
      message = `Subscribe to ${args}`;
      break;
    case '/summarize':
      message = 'Summarize recent articles';
      break;
    case '/digest':
      message = 'Generate daily digest';
      break;
    default:
      message = args;
  }

  const response = await assistant.process(message);
  addMessage('assistant', response.message);

  // If there are articles in the response, show them
  if (response.data?.articles) {
    // Show article cards in UI
  }
};
```

**Step 3: Commit**

```bash
git add sidepanel.tsx
git commit -m "feat(ui): add assistant commands to chat interface"
```

---

### Task 10: Add Action Buttons to Article Detail

**Files:**
- Modify: `src/components/ArticleDetail.tsx`

**Step 1: Import assistant and add action suggestions**

Add to ArticleDetail component:

```typescript
import { useState, useEffect } from 'react';
import { ActionSuggester, type ActionSuggestion } from '../core/assistant';

// Inside component:
const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);

useEffect(() => {
  if (article) {
    const suggester = new ActionSuggester();
    const actions = suggester.suggest(article);
    setSuggestions(actions.slice(0, 3)); // Show top 3
  }
}, [article]);
```

**Step 2: Add action buttons to JSX**

Add after the article meta section:

```tsx
{suggestions.length > 0 && (
  <div className="article-actions">
    <h4>Suggested Actions</h4>
    <div className="action-buttons">
      {suggestions.map((action, index) => (
        <button
          key={index}
          className="action-suggestion-btn"
          onClick={() => handleAction(action)}
          title={action.description}
        >
          {action.title}
        </button>
      ))}
    </div>
  </div>
)}
```

**Step 3: Add action handler**

```typescript
const handleAction = async (action: ActionSuggestion) => {
  switch (action.type) {
    case 'save':
      onToggleFavorite?.();
      break;
    case 'read_more':
      if (article?.url) {
        chrome.tabs.create({ url: article.url });
      }
      break;
    case 'search_related':
      // Navigate to search with article tags
      break;
    case 'export':
      // Trigger export modal
      break;
    case 'share':
      if (article?.url) {
        navigator.clipboard.writeText(article.url);
      }
      break;
  }
};
```

**Step 4: Add styles to sidepanel.css**

```css
/* ===== Action Suggestions ===== */
.article-actions {
  margin: 16px 0;
  padding: 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
}

.article-actions h4 {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-suggestion-btn {
  padding: 8px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-suggestion-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
```

**Step 5: Commit**

```bash
git add src/components/ArticleDetail.tsx sidepanel.css
git commit -m "feat(ui): add AI action suggestions to article detail"
```

---

### Task 11: Add Recommendation Widget

**Files:**
- Create: `src/components/RecommendationWidget.tsx`

**Step 1: Create the widget component**

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredArticle } from '../../types';

interface RecommendationWidgetProps {
  articles: StoredArticle[];
  onArticleClick: (article: StoredArticle) => void;
  onRefresh: () => Promise<void>;
}

export function RecommendationWidget({
  articles,
  onArticleClick,
  onRefresh,
}: RecommendationWidgetProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await onRefresh();
    } finally {
      setIsLoading(false);
    }
  };

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="recommendation-widget">
      <div className="recommendation-header">
        <h3>{t('recommendations.title', 'Recommended for you')}</h3>
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? '...' : '↻'}
        </button>
      </div>
      <div className="recommendation-list">
        {articles.map((article) => (
          <div
            key={article.id}
            className="recommendation-item"
            onClick={() => onArticleClick(article)}
          >
            <div className="recommendation-title">{article.title}</div>
            <div className="recommendation-meta">
              {article.sourceName}
              {article.score && <span className="recommendation-score">{article.score}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add styles**

```css
/* ===== Recommendation Widget ===== */
.recommendation-widget {
  margin: 16px;
  padding: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.recommendation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.recommendation-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.refresh-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.refresh-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommendation-item {
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.recommendation-item:hover {
  border-color: var(--accent);
}

.recommendation-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.3;
}

.recommendation-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}

.recommendation-score {
  background: var(--accent);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
```

**Step 3: Commit**

```bash
git add src/components/RecommendationWidget.tsx sidepanel.css
git commit -m "feat(ui): add recommendation widget component"
```

---

### Task 12: Integrate Recommendations into Chat View

**Files:**
- Modify: `sidepanel.tsx`

**Step 1: Import and use RecommendationWidget**

Add import:

```typescript
import { RecommendationWidget } from './src/components/RecommendationWidget';
```

**Step 2: Add state for recommendations**

```typescript
const [recommendations, setRecommendations] = useState<StoredArticle[]>([]);

// Load recommendations when chat view is empty
useEffect(() => {
  if (messages.length === 0 && settings?.llm) {
    loadRecommendations();
  }
}, [messages.length, settings?.llm]);

const loadRecommendations = async () => {
  const { RecommendationEngine } = await import('./src/core/assistant');
  const { db } = await import('./src/core/storage/db');

  const engine = new RecommendationEngine();
  const articles = await db.articles.toArray();

  // Simple recommendation without reading history for initial load
  const prefs = { favoriteTopics: [], favoriteSourceTypes: [], readingTimes: [], avgReadingDuration: 0 };
  const recs = engine.recommend(articles, prefs, 3);
  setRecommendations(recs);
};
```

**Step 3: Add to welcome message JSX**

Update the welcome message section:

```tsx
<div className="welcome-message">
  <h2>Welcome to Atlas</h2>
  <p>Ask anything or enable Browser Tools to automate your browser.</p>
  {!browserToolsEnabled && (
    <button className="welcome-cta" onClick={toggleBrowserTools}>
      Enable Browser Tools
    </button>
  )}

  {recommendations.length > 0 && (
    <RecommendationWidget
      articles={recommendations}
      onArticleClick={(article) => {
        setView({ type: 'article', articleId: article.id });
      }}
      onRefresh={loadRecommendations}
    />
  )}
</div>
```

**Step 4: Commit**

```bash
git add sidepanel.tsx
git commit -m "feat(ui): integrate recommendations into chat welcome view"
```

---

## Summary

**Total Tasks:** 12

**Phase 1 (Tasks 1-3):** Assistant Foundation
- Types, Intent Parser, Recommendation Engine

**Phase 2 (Tasks 4-7):** Core Assistant Service
- Action Suggester, Summary Generator, AssistantService, Module Index

**Phase 3 (Tasks 8-12):** UI Integration
- useAssistant hook, Chat commands, Article actions, Recommendation widget

---

**After completing all tasks:**

1. Natural language configuration via chat commands
2. Smart recommendations based on reading history
3. Dialog-based search across knowledge base
4. One-click subscribe from article context
5. AI-generated summaries and digests
6. Smart action suggestions on articles

**Key Integration Points:**
- AssistantService uses LLMClient from P2
- Recommendations work with articles from P1
- Integrates with P3 KnowledgeBase for search
- Uses P4 Export for export actions
