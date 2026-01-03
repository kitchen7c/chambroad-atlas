// src/core/browser-agent/actions.ts

import type { ActionType } from './types';

// Function calling tool definition for LLMs
export const browserActionTool = {
  name: 'browser_action',
  description: 'Execute browser actions like clicking, typing, scrolling, and navigating.',
  parameters: {
    type: 'object' as const,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: [
          'click', 'type', 'scroll', 'navigate', 'screenshot', 'wait',
          'hover', 'select', 'pressKey', 'goBack', 'goForward', 'refresh',
          'dragDrop', 'uploadFile', 'switchTab', 'executeJS',
          'getElements', 'getElementDetails'
        ] as ActionType[],
        description: 'The action to perform'
      },
      params: {
        type: 'object',
        description: 'Action parameters (varies by action type)',
        properties: {
          // Click/hover params
          index: { type: 'number', description: 'Element index from getElements' },
          selector: { type: 'string', description: 'CSS selector' },
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          // Type params
          text: { type: 'string', description: 'Text to type' },
          clear: { type: 'boolean', description: 'Clear field before typing' },
          // Scroll params
          direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
          amount: { type: 'number', description: 'Scroll amount in pixels' },
          // Navigate params
          url: { type: 'string', description: 'URL to navigate to' },
          // Wait params
          ms: { type: 'number', description: 'Milliseconds to wait' },
          // Select params
          value: { type: 'string', description: 'Option value to select' },
          // Key params
          key: { type: 'string', description: 'Key to press' },
          modifiers: { type: 'array', items: { type: 'string' } },
          // getElements params
          type: { type: 'string', enum: ['button', 'input', 'link', 'select', 'image', 'all'] },
          visible: { type: 'boolean', description: 'Only visible elements' },
          // getElementDetails params
          indices: { type: 'array', items: { type: 'number' } },
          // executeJS params
          code: { type: 'string', description: 'JavaScript code to execute' },
          // DragDrop params
          from: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
          to: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
        }
      }
    }
  }
};

// Convert tool to OpenAI format
export function toOpenAITool() {
  return {
    type: 'function' as const,
    function: browserActionTool
  };
}

// Convert tool to Anthropic format
export function toAnthropicTool() {
  return {
    name: browserActionTool.name,
    description: browserActionTool.description,
    input_schema: browserActionTool.parameters
  };
}

// Convert tool to Google format
export function toGoogleTool() {
  return {
    functionDeclarations: [{
      name: browserActionTool.name,
      description: browserActionTool.description,
      parameters: browserActionTool.parameters
    }]
  };
}
