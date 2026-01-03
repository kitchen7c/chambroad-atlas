// src/core/browser-agent/agent.ts

import { LLMClient, LLMMessage, LLMTool } from '../llm/client';
import type { LLMConfig } from '../../../types';
import type { BrowserAction, ActionResult, AgentMode } from './types';
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

  // Run the agent with a task
  async run(task: string): Promise<string> {
    this.abortController = new AbortController();
    const maxTurns = this.options.maxTurns || 20;

    // Get initial page context
    const pageSummary = await getPageSummary();

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
          actions = response.toolCalls.map(tc => ({
            action: tc.arguments.action as BrowserAction['action'],
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
            const confirmed = await this.options.callbacks?.onConfirmRequired?.(message, action);

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
        const newSummary = await getPageSummary();

        this.messages.push({
          role: 'assistant',
          content: response.content || `Executed ${actions.length} action(s)`
        });

        this.messages.push({
          role: 'user',
          content: `## 操作结果\n${resultSummary}\n\n## 当前页面状态\nURL: ${newSummary.url}\n标题: ${newSummary.title}\n\n请继续完成任务，或者如果任务已完成，总结结果。`
        });

      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return lastResponse + '\n\n[Stopped by user]';
        }
        this.options.callbacks?.onError?.(error as Error);
        throw error;
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

      return actions.map(a => ({
        action: a.action,
        params: a.params || {}
      }));
    } catch {
      return [];
    }
  }
}
