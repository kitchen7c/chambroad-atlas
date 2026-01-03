// src/core/browser-agent/agent.ts

import { LLMClient, LLMMessage, LLMTool } from '../llm/client';
import type { LLMConfig } from '../../../types';
import type { BrowserAction, ActionResult, AgentMode, ActionType } from './types';
import { browserActionTool } from './actions';
import { selectAgentMode, supportsFunctionCalling } from './providers';
import { getConfirmLevel, formatConfirmMessage } from './safety';
import { buildSystemPrompt, buildUserMessage, buildFallbackPrompt } from './prompts';
import { executeAction, getPageSummary } from './action-executor';

export interface AgentCallbacks {
  onActionStart?: (action: BrowserAction) => void;
  onActionComplete?: (action: BrowserAction, result: ActionResult) => void;
  onThinking?: (message: string) => void;
  onConfirmRequired?: (message: string, action: BrowserAction) => Promise<boolean>;
  onError?: (error: Error) => void;
}

export interface AgentOptions {
  maxTurns?: number;
  callbacks?: AgentCallbacks;
}

export class BrowserAgent {
  private llmClient: LLMClient;
  private mode: AgentMode;
  private usesFunctionCalling: boolean;
  private messages: LLMMessage[] = [];
  private abortController: AbortController | null = null;

  constructor(
    config: LLMConfig,
    private options: AgentOptions = {}
  ) {
    this.llmClient = new LLMClient(config);
    this.mode = selectAgentMode(config.provider);
    this.usesFunctionCalling = supportsFunctionCalling(config.provider);
  }

  // Validate if a string is a valid ActionType
  private isValidActionType(action: unknown): action is ActionType {
    const validActions: ActionType[] = [
      'click', 'type', 'scroll', 'navigate', 'screenshot', 'wait',
      'hover', 'select', 'pressKey', 'goBack', 'goForward', 'refresh',
      'dragDrop', 'uploadFile', 'switchTab', 'executeJS',
      'getElements', 'getElementDetails'
    ];
    return typeof action === 'string' && validActions.includes(action as ActionType);
  }

  // Run the agent with a task
  async run(task: string): Promise<string> {
    this.abortController = new AbortController();
    // Validate and clamp maxTurns to reasonable range (1-100)
    const maxTurns = Math.min(Math.max(this.options.maxTurns || 20, 1), 100);

    // Get initial page context
    let pageSummary;
    try {
      pageSummary = await getPageSummary();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.callbacks?.onError?.(err);
      throw new Error(`Failed to get page summary: ${err.message}`);
    }

    // Build initial messages
    const systemPrompt = this.usesFunctionCalling
      ? buildSystemPrompt(this.mode)
      : buildFallbackPrompt(this.mode);

    this.messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(task, pageSummary) }
    ];

    let lastResponse = '';

    for (let turn = 0; turn < maxTurns; turn++) {
      if (this.abortController.signal.aborted) {
        return lastResponse + '\n\n[Stopped by user]';
      }

      this.options.callbacks?.onThinking?.(`Turn ${turn + 1}/${maxTurns}`);

      try {
        // Call LLM
        const tools: LLMTool[] = this.usesFunctionCalling ? [browserActionTool] : [];
        const response = await this.llmClient.chat(this.messages, {
          tools,
          signal: this.abortController.signal
        });

        lastResponse = response.content;

        // Check for tool calls
        let actions: BrowserAction[] = [];

        if (response.toolCalls?.length) {
          // Function calling response
          actions = response.toolCalls
            .filter(tc => this.isValidActionType(tc.arguments.action))
            .map(tc => ({
              action: tc.arguments.action as ActionType,
              params: tc.arguments.params as Record<string, unknown>
            }));
        } else if (!this.usesFunctionCalling && response.content) {
          // Try to parse JSON from markdown
          actions = this.parseActionsFromMarkdown(response.content);
        }

        // If no actions, task is complete
        if (actions.length === 0) {
          return response.content;
        }

        // Execute actions
        const results: ActionResult[] = [];
        for (const action of actions) {
          // Check if confirmation needed
          const confirmLevel = getConfirmLevel(action, pageSummary);

          if (confirmLevel === 'confirm') {
            const message = formatConfirmMessage(action, pageSummary);
            let confirmed = false;
            try {
              confirmed = await this.options.callbacks?.onConfirmRequired?.(message, action) || false;
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              this.options.callbacks?.onError?.(err);
              // Default to denying the action on error
              confirmed = false;
            }

            if (!confirmed) {
              results.push({ success: false, message: 'Action cancelled by user' });
              continue;
            }
          }

          if (confirmLevel === 'block') {
            results.push({ success: false, message: 'Action blocked for safety' });
            continue;
          }

          this.options.callbacks?.onActionStart?.(action);
          const result = await executeAction(action);
          this.options.callbacks?.onActionComplete?.(action, result);
          results.push(result);

          // Small delay between actions
          await new Promise(r => setTimeout(r, 300));
        }

        // Add results to conversation
        const resultSummary = results.map((r, i) =>
          `Action ${i + 1}: ${r.success ? '✓' : '✗'} ${r.message}`
        ).join('\n');

        // Get updated page state
        let newSummary;
        try {
          newSummary = await getPageSummary();
        } catch {
          newSummary = { url: '未知', title: '未知', elements: { buttons: 0, inputs: 0, links: 0, selects: 0, images: 0, forms: 0 }, visibleText: '', viewport: { width: 0, height: 0 }, scrollPosition: { x: 0, y: 0 } };
        }

        // Build element info for continuation
        const elements = newSummary.elements || {};
        const elementsInfo = Object.entries(elements)
          .filter(([_, count]) => (count as number) > 0)
          .map(([type, count]) => `${count} 个${type === 'buttons' ? '按钮' : type === 'inputs' ? '输入框' : type === 'links' ? '链接' : type === 'selects' ? '下拉框' : type}`)
          .join(', ') || '无';

        // Update pageSummary for safety checks in next iteration
        pageSummary = newSummary;

        this.messages.push({
          role: 'assistant',
          content: response.content || `Executed ${actions.length} action(s)`
        });

        this.messages.push({
          role: 'user',
          content: `## 操作结果\n${resultSummary}\n\n## 当前页面状态\nURL: ${newSummary.url || '未知'}\n标题: ${newSummary.title || '未知'}\n可交互元素: ${elementsInfo}\n\n页面内容摘要:\n${(newSummary.visibleText || '').slice(0, 300)}\n\n请继续完成任务，或者如果任务已完成，总结结果。`
        });

      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return lastResponse + '\n\n[Stopped by user]';
        }
        const err = error instanceof Error ? error : new Error(String(error));
        this.options.callbacks?.onError?.(err);
        throw err;
      }
    }

    return lastResponse + '\n\n[Reached maximum turns]';
  }

  // Stop the agent
  stop(): void {
    this.abortController?.abort();
  }

  // Parse actions from markdown JSON blocks
  private parseActionsFromMarkdown(content: string): BrowserAction[] {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const actions = Array.isArray(parsed) ? parsed : [parsed];

      return actions
        .filter(a => this.isValidActionType(a.action))
        .map(a => ({
          action: a.action as ActionType,
          params: a.params || {}
        }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.callbacks?.onError?.(new Error(`Failed to parse action JSON: ${err.message}`));
      return [];
    }
  }
}
