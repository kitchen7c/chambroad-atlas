import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { initI18n } from './src/i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Settings, Message } from './types';
import { GeminiResponseSchema, PageContextSchema } from './types';
import { SourcesView } from './src/components/SourcesView';
import { ArticlesView } from './src/components/ArticlesView';
import { ArticleDetail } from './src/components/ArticleDetail';

type ViewState =
  | { type: 'chat' }
  | { type: 'sources' }
  | { type: 'articles'; sourceId?: string }
  | { type: 'article'; articleId: string };

// Custom component to handle link clicks - opens in new tab
const LinkComponent = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
  const handleLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      chrome.tabs.create({ url: href });
    }
  };

  return (
    <a
      href={href}
      onClick={handleLinkClick}
      style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
      title={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};

// Component to parse and display assistant messages with better formatting
const MessageParser = ({ content }: { content: string }) => {
  // Split message into logical sections - only on strong breaks (double newlines or numbered/bulleted lists)
  const sections = content
    .split(/\n+/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  // If only one section or very short content, just return as-is
  if (sections.length <= 1 || content.length < 150) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: LinkComponent as any }}>
        {content}
      </ReactMarkdown>
    );
  }

  // Display each section separately
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sections.map((section, idx) => (
        <div
          key={idx}
          style={{
            padding: '10px 12px',
            backgroundColor: '#2d2d2d',
            borderLeft: '3px solid #4d4d4d',
            borderRadius: '4px',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: LinkComponent as any }}>
            {section}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  );
};

function ChatSidebar() {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [browserToolsEnabled, setBrowserToolsEnabled] = useState(false);
  const [showBrowserToolsWarning, setShowBrowserToolsWarning] = useState(false);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [view, setView] = useState<ViewState>({ type: 'chat' });
  const abortControllerRef = useRef<AbortController | null>(null);
  const listenerAttachedRef = useRef(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandMenuIndex, setCommandMenuIndex] = useState(0);

  const executeTool = async (toolName: string, parameters: any, retryCount = 0): Promise<any> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500; // 1.5 seconds to allow page to load
    
    return new Promise((resolve, reject) => {
      const handleResponse = (response: any) => {
        const errorMsg = response?.error || chrome.runtime.lastError?.message || '';
        const isConnectionError = errorMsg.includes('Receiving end does not exist') || 
                                 errorMsg.includes('Could not establish connection');
        
        if (isConnectionError && retryCount < MAX_RETRIES) {
          
          setTimeout(async () => {
            try {
              const result = await executeTool(toolName, parameters, retryCount + 1);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }, RETRY_DELAY);
        } else {
          // Return response as-is (could be success or error)
          resolve(response);
        }
      };
      
      if (toolName === 'screenshot') {
        chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, handleResponse);
      } else if (toolName === 'click') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'click',
          selector: parameters.selector,
          coordinates: parameters.x !== undefined ? { x: parameters.x, y: parameters.y } : undefined
        }, handleResponse);
      } else if (toolName === 'type') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'fill',
          target: parameters.selector,
          value: parameters.text
        }, handleResponse);
      } else if (toolName === 'scroll') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'scroll',
          direction: parameters.direction,
          target: parameters.selector,
          amount: parameters.amount
        }, handleResponse);
      } else if (toolName === 'getPageContext') {
        chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }, handleResponse);
      } else if (toolName === 'getSelectedText') {
        chrome.runtime.sendMessage({ type: 'GET_SELECTED_TEXT' }, handleResponse);
      } else if (toolName === 'navigate') {
        chrome.runtime.sendMessage({ type: 'NAVIGATE', url: parameters.url }, handleResponse);
      } else if (toolName === 'getBrowserHistory') {
        chrome.runtime.sendMessage({ 
          type: 'GET_HISTORY',
          query: parameters.query,
          maxResults: parameters.maxResults
        }, handleResponse);
      } else if (toolName === 'pressKey') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'press_key',
          key: parameters.key
        }, handleResponse);
      } else if (toolName === 'clearInput') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'clear_input'
        }, handleResponse);
      } else if (toolName === 'keyCombo') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'key_combination',
          keys: parameters.keys
        }, handleResponse);
      } else if (toolName === 'hover') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'hover',
          coordinates: { x: parameters.x, y: parameters.y }
        }, handleResponse);
      } else if (toolName === 'dragDrop') {
        chrome.runtime.sendMessage({ 
          type: 'EXECUTE_ACTION', 
          action: 'drag_drop',
          coordinates: { x: parameters.x, y: parameters.y },
          destination: { x: parameters.destination_x, y: parameters.destination_y }
        }, handleResponse);
      } else {
        reject(new Error(`Unknown tool: ${toolName}`));
      }
    });
  };

  const slashCommands = [
    {
      command: '/page',
      insertText: '/page ',
      title: t('commands.page.title'),
      description: t('commands.page.desc'),
    },
    {
      command: '/summarize',
      insertText: '/summarize ',
      title: t('commands.summarize.title'),
      description: t('commands.summarize.desc'),
    },
    {
      command: '/sources',
      insertText: '/sources',
      title: t('commands.sources.title'),
      description: t('commands.sources.desc'),
    },
    {
      command: '/articles',
      insertText: '/articles',
      title: t('commands.articles.title'),
      description: t('commands.articles.desc'),
    },
    {
      command: '/back',
      insertText: '/back',
      title: t('commands.back.title'),
      description: t('commands.back.desc'),
    },
  ];

  const shouldShowCommandMenu = !isLoading && (commandMenuOpen || input.trimStart().startsWith('/'));

  const commandFilterToken = (() => {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith('/')) return '';
    return (trimmed.split(/\s+/)[0] || '').toLowerCase();
  })();

  const filteredCommands =
    commandFilterToken && commandFilterToken !== '/'
      ? slashCommands.filter((c) => c.command.startsWith(commandFilterToken))
      : slashCommands;

  useEffect(() => {
    if (!shouldShowCommandMenu) return;
    setCommandMenuIndex(0);
  }, [commandFilterToken, shouldShowCommandMenu]);

  const applySelectedCommand = () => {
    const selected = filteredCommands[commandMenuIndex];
    if (!selected) return;
    setInput(selected.insertText);
    setCommandMenuOpen(false);
    setCommandMenuIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const loadSettings = async () => {
    chrome.storage.local.get(['atlasSettings'], async (result) => {
      if (result.atlasSettings) {
        const oldSettings = result.atlasSettings;
        // Migrate from old format if needed
        if (!oldSettings.llm && oldSettings.apiKey) {
          const migratedSettings = {
            llm: {
              provider: 'google' as const,
              baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
              apiKey: oldSettings.apiKey,
              model: oldSettings.model || 'gemini-2.0-flash-exp',
            },
            provider: 'google' as const,
            apiKey: oldSettings.apiKey,
            model: oldSettings.model,
          };
          setSettings(migratedSettings);
          // Save migrated settings
          chrome.storage.local.set({ atlasSettings: migratedSettings });
        } else {
          setSettings(oldSettings);
        }
      } else {
        setShowSettings(true);
      }
    });
  };

  useEffect(() => {
    // Load settings on mount
    loadSettings();

    // Attach settings update listener only once to prevent duplicates
    if (!listenerAttachedRef.current) {
      const handleMessage = (request: any) => {
        if (request.type === 'SETTINGS_UPDATED') {
          console.log('Settings updated, refreshing...');
          loadSettings();
        }
      };

      chrome.runtime.onMessage.addListener(handleMessage);
      listenerAttachedRef.current = true;

      // Cleanup listener on unmount
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
        listenerAttachedRef.current = false;
      };
    }
  }, []);

  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const ensureApiKey = (): string => {
    // Support both new llm config and legacy fields
    const apiKey = settings?.llm?.apiKey || settings?.apiKey;
    if (!apiKey) {
      throw new Error('API key not configured. Please add it in Settings.');
    }
    return apiKey;
  };

  const ensureModel = (): string => {
    // Support both new llm config and legacy fields
    const model = settings?.llm?.model || settings?.model;
    if (!model) {
      throw new Error('AI model not configured. Please select a model in Settings.');
    }
    return model;
  };

  const getProvider = (): string => {
    return settings?.llm?.provider || settings?.provider || 'google';
  };

  const toggleBrowserTools = async () => {
    const newValue = !browserToolsEnabled;

    // Check if user has Google API key before enabling Browser Tools
    if (newValue) {
      if (!settings) {
        alert('⚠️ Please configure your settings first.');
        openSettings();
        return;
      }

      const provider = getProvider();
      const apiKey = settings?.llm?.apiKey || settings?.apiKey;
      if (provider !== 'google' || !apiKey) {
        const confirmed = window.confirm(
          '🌐 Browser Tools requires a Google API key\n\n' +
          'Browser Tools uses Gemini 2.5 Computer Use for browser automation.\n\n' +
          'Would you like to open Settings to add your Google API key?'
        );
        if (confirmed) {
          openSettings();
        }
        return;
      }
    }

    setBrowserToolsEnabled(newValue);

    if (newValue) {
      setShowBrowserToolsWarning(false);
    }
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const buildPageSummaryPrompt = (options: {
    page: { title: string; url: string; description?: string; textContent: string; links: Array<{ text: string; href: string }> };
    selectedText?: string;
    userQuestion?: string;
  }): { prompt: string; displayContent: string } => {
    const title = options.page.title.trim();
    const url = options.page.url.trim();
    const description = options.page.description?.trim();
    const textContent = options.page.textContent.trim().slice(0, 8000);

    const selectedText = options.selectedText?.trim().slice(0, 3000);
    const hasSelection = Boolean(selectedText);

    const links = options.page.links
      .map((link) => ({ text: link.text.trim(), href: link.href.trim() }))
      .filter((link) => link.text && link.href)
      .slice(0, 10);

    const userQuestion = options.userQuestion?.trim();
    const displayContent = userQuestion
      ? `总结当前页面：${userQuestion}`
      : hasSelection
        ? '总结当前页面（优先总结选中文本）'
        : '总结当前页面';

    const instruction = userQuestion
      ? `请基于以下页面内容回答这个问题：${userQuestion}`
      : hasSelection
        ? '请用中文总结我选中的内容，并结合页面上下文补充必要背景；最后给出 3 条要点。'
        : '请用中文总结并提炼当前页面内容；最后给出 5 条要点、2 条结论、1 条行动建议。';

    const prompt = [
      instruction,
      '',
      '【页面信息】',
      `标题：${title}`,
      `URL：${url}`,
      description ? `描述：${description}` : undefined,
      '',
      hasSelection ? '【选中文本】' : undefined,
      hasSelection ? selectedText : undefined,
      '',
      '【正文节选】',
      textContent,
      links.length > 0 ? '' : undefined,
      links.length > 0 ? '【链接节选】' : undefined,
      links.length > 0 ? links.map((link) => `- ${link.text} (${link.href})`).join('\n') : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');

    return { prompt, displayContent };
  };

  const newChat = async () => {
    // Clear messages
    setMessages([]);
    setInput('');
    setShowBrowserToolsWarning(false);
  };

  const streamWithGeminiComputerUse = async (messages: Message[]) => {
    try {
      const apiKey = ensureApiKey();

      // Add initial assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Get initial screenshot with retry logic
      let screenshot = await executeTool('screenshot', {});

      if (!screenshot?.screenshot) {
        const errorMsg = screenshot?.error || 'Unknown error capturing screenshot';
        console.error('❌ Screenshot failed. Full response:', JSON.stringify(screenshot, null, 2));
        throw new Error(`Failed to capture screenshot: ${errorMsg}`);
      }
      
      // Prepare conversation history
      const contents: any[] = [];
      
      // Add message history
      for (const msg of messages) {
        if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
      
      if (screenshot && screenshot.screenshot) {
        const lastUserContent = contents[contents.length - 1];
        if (lastUserContent && lastUserContent.role === 'user') {
          lastUserContent.parts.push({
            inline_data: {
              mime_type: 'image/png',
              data: screenshot.screenshot.split(',')[1]
            }
          });
        }
      }

      let responseText = '';
      const maxTurns = 30;

      const systemInstruction = `You are a browser automation assistant with ONLY browser control capabilities.

CRITICAL: You can ONLY use the computer_use tool functions for browser automation. DO NOT attempt to call any other functions like print, execute, or any programming functions.

AVAILABLE ACTIONS (computer_use tool only):
- click / click_at: Click at coordinates
- type_text_at: Type text (optionally with press_enter)
- scroll / scroll_down / scroll_up: Scroll the page
- navigate: Navigate to a URL
- wait / wait_5_seconds: Wait for page load

GUIDELINES:
1. NAVIGATION: Use 'navigate' function to go to websites
   Example: navigate({url: "https://www.reddit.com"})

2. INTERACTION: Use coordinates from the screenshot you see
   - Click at coordinates to interact with elements
   - Type text at coordinates to fill forms

3. NO HALLUCINATING: Only use the functions listed above. Do NOT invent or call functions like print(), execute(), or any code functions.

4. EFFICIENCY: Complete tasks in fewest steps possible.`;

      for (let turn = 0; turn < maxTurns; turn++) {
        if (abortControllerRef.current?.signal.aborted) {
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content += '\n\n🛑 **Stopped by user**';
            }
            return updated;
          });
          return; // Exit the agent loop
        }

        console.log(`\n--- Turn ${turn + 1}/${maxTurns} ---`);

        const requestBody = {
          contents,
          tools: [{
            computer_use: {
              environment: 'ENVIRONMENT_BROWSER'
            }
          }],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 1.0,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE'
            }
          ]
        };
        
        // Create abort controller with timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60 second timeout
        
        // Always use computer-use model for browser tools
        const computerUseModel = 'gemini-2.5-computer-use-preview-10-2025';

        let response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${computerUseModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: abortController.signal,
            }
          );
        } finally {
          clearTimeout(timeoutId);
        }
        
        if (!response.ok) {
          let errorDetails;
          try {
            errorDetails = await response.json();
            console.error('❌ Gemini API Error Response:', JSON.stringify(errorDetails, null, 2));
          } catch (e) {
            console.error('❌ Failed to parse error response:', e);
            errorDetails = { statusText: response.statusText };
          }

          const errorMessage = errorDetails?.error?.message || `API request failed with status ${response.status}: ${response.statusText}`;
          console.error('❌ Full error details:', errorDetails);

          throw new Error(errorMessage);
        }
        
        const data = await response.json();

        // Validate response structure with Zod
        let validatedData;
        try {
          validatedData = GeminiResponseSchema.parse(data);
        } catch (validationError) {
          console.error('❌ Gemini API response failed validation:', validationError);
          throw new Error(`Invalid Gemini API response format: ${(validationError as any).message}`);
        }

        // Check for safety blocks and prompt feedback
        if (validatedData.promptFeedback?.blockReason) {
          const blockReason = validatedData.promptFeedback.blockReason;
          console.error('🚫 Request blocked by safety filter:', blockReason);

          // Show detailed error to user
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = `⚠️ **Safety Filter Blocked Request**\n\nReason: ${blockReason}\n\nThis request was blocked by Gemini's safety filters. Try:\n- Using a different webpage\n- Simplifying your request\n- Avoiding sensitive actions\n\nFull response:\n\`\`\`json\n${JSON.stringify(validatedData, null, 2)}\n\`\`\``;
            }
            return updated;
          });
          return; // Exit the loop
        }

        const candidate = validatedData.candidates?.[0];

        if (!candidate) {
          console.error('❌ No candidate in response. Full response:', JSON.stringify(data, null, 2));
          throw new Error(`No candidate in Gemini response. Finish reason: ${data.candidates?.[0]?.finishReason || 'unknown'}. Full response: ${JSON.stringify(data)}`);
        }

        // Check if candidate has safety response requiring confirmation
        const safetyResponse = candidate.safetyResponse;
        if (safetyResponse?.requireConfirmation) {
          // Show confirmation dialog to user
          const confirmMessage = safetyResponse.message || 'This action requires confirmation. Do you want to proceed?';
          const userConfirmed = window.confirm(`🔒 Human Confirmation Required\n\n${confirmMessage}\n\nProceed with this action?`);

          if (!userConfirmed) {
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content += '\n\n❌ Action cancelled by user.';
              }
              return updated;
            });
            return; // Exit the loop
          }

          // Add confirmation to conversation
          contents.push({
            role: 'user',
            parts: [{ text: 'CONFIRMED: User approved this action. Please proceed.' }]
          });

          // Continue to next iteration to re-run with confirmation
          continue;
        }

        // Add model response to conversation
        contents.push(candidate.content);

        // Check if there are function calls
        const parts = candidate.content?.parts || [];
        const hasFunctionCalls = parts.some((p: any) => 'functionCall' in p && p.functionCall);

        if (!hasFunctionCalls) {
          // No more actions - task complete
          for (const part of parts) {
            if ('text' in part && typeof part.text === 'string') {
              responseText += part.text;
            }
          }
          break;
        }

        // Execute function calls
        const functionResponses: any[] = [];

        for (const part of parts) {
          if ('text' in part && typeof part.text === 'string') {
            responseText += part.text + '\n';
          } else if ('functionCall' in part && part.functionCall) {
            // Check if user clicked stop button
            if (abortControllerRef.current?.signal.aborted) {
              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = responseText + '\n\n🛑 **Stopped by user**';
                }
                return updated;
              });
              return; // Exit the agent loop
            }

            const funcName = part.functionCall.name;
            const funcArgs = part.functionCall.args || {};

            responseText += `\n[Executing: ${funcName}]\n`;

            // Execute the browser action
            const result = await executeBrowserAction(funcName, funcArgs);
            
            // Wait longer after navigation actions for page to load
            const isNavigationAction = ['navigate', 'open_web_browser', 'navigate_to', 'go_to', 'click', 'click_at', 'mouse_click', 'go_back', 'back', 'go_forward', 'forward'].includes(funcName);
            if (isNavigationAction) {
              await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5 seconds for page to load
            } else {
              await new Promise(resolve => setTimeout(resolve, 500)); // Normal wait
            }
            
            screenshot = await executeTool('screenshot', {});
            
            if (!screenshot || !screenshot.screenshot) {
              console.warn('Failed to capture screenshot after action');
              screenshot = { screenshot: '' }; // Continue without screenshot
            }
            
            // Get current page URL and viewport dimensions (required by Gemini)
            let currentUrl = '';
            let viewportInfo = '';
            try {
              const pageInfo = await executeTool('getPageContext', {});
              currentUrl = pageInfo?.url || '';

              // Include viewport dimensions to help Gemini understand coordinate space
              if (pageInfo?.viewport) {
                viewportInfo = ` Viewport: ${pageInfo.viewport.width}x${pageInfo.viewport.height}`;
              }
            } catch (error) {
              console.warn('Failed to get page URL:', error);
            }

            // Build function response with URL and viewport info (required by Gemini)
            const functionResponse: any = {
              name: funcName,
              response: {
                ...result,
                url: currentUrl,  // Gemini requires this
                viewport_info: viewportInfo,
                success: result.success !== false
              }
            };
            
            functionResponses.push(functionResponse);
            
            // Update UI
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content = responseText;
              }
              return updated;
            });
          }
        }
        
        // Add function responses back to conversation with new screenshot
        if (functionResponses.length > 0) {
          const userParts: any[] = functionResponses.map(fr => ({
            function_response: fr
          }));
          
          // Add new screenshot
          if (screenshot && screenshot.screenshot) {
            userParts.push({
              inline_data: {
                mime_type: 'image/png',
                data: screenshot.screenshot.split(',')[1]
              }
            });
          }
          
          contents.push({
            role: 'user',
            parts: userParts
          });
        }
      }
      
      // Final update
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = responseText || 'Task completed';
        }
        return updated;
      });
      
    } catch (error: any) {
      console.error('❌ Error with Gemini Computer Use:');
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Full error object:', error);
      throw error;
    }
  };

  // Scale coordinates from Gemini's 1000x1000 grid to actual viewport
  const scaleCoordinates = async (x: number, y: number) => {
    try {
      // Get actual viewport dimensions
      const pageInfo = await executeTool('getPageContext', {});
      const viewportWidth = pageInfo?.viewport?.width || 1440;
      const viewportHeight = pageInfo?.viewport?.height || 900;

      // Gemini uses 1000x1000 normalized coordinates
      const scaledX = Math.round((x / 1000) * viewportWidth);
      const scaledY = Math.round((y / 1000) * viewportHeight);
      return { x: scaledX, y: scaledY };
    } catch (error) {
      console.error('Failed to scale coordinates:', error);
      // Fallback to original coordinates if scaling fails
      return { x, y };
    }
  };

  const requiresUserConfirmation = async (functionName: string, args: any): Promise<boolean> => {
    let pageContext: any = {};
    try {
      pageContext = await executeTool('getPageContext', {});
    } catch (e) {
      console.warn('Could not get page context');
    }

    const url = pageContext?.url?.toLowerCase() || '';
    const pageText = pageContext?.text?.toLowerCase() || '';

    const alwaysConfirm = ['key_combination'];

    const isSensitivePage =
      url.includes('checkout') ||
      url.includes('payment') ||
      url.includes('login') ||
      url.includes('signin') ||
      url.includes('admin') ||
      url.includes('delete') ||
      url.includes('remove') ||
      pageText.includes('checkout') ||
      pageText.includes('payment') ||
      pageText.includes('purchase') ||
      pageText.includes('confirm order') ||
      pageText.includes('delete') ||
      pageText.includes('remove account');

    const isSensitiveInput = functionName.includes('type') && (
      args.text?.toLowerCase().includes('password') ||
      args.text?.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/) ||
      pageText.includes('credit card') ||
      pageText.includes('cvv') ||
      pageText.includes('social security')
    );

    const isFormSubmission = functionName === 'type_text_at' && args.press_enter === true;

    if (alwaysConfirm.includes(functionName) || isSensitivePage || isSensitiveInput || isFormSubmission) {
      const confirmMessage = `🔒 Confirm Action\n\nAction: ${functionName}\nPage: ${url}` +
        `${isSensitivePage ? '\n⚠️ Sensitive page' : ''}` +
        `${isSensitiveInput ? '\n⚠️ Sensitive data' : ''}` +
        `${isFormSubmission ? '\n⚠️ Form submission' : ''}\n\nProceed?`;
      return window.confirm(confirmMessage);
    }

    return false;
  };

  const executeBrowserAction = async (functionName: string, args: any) => {
    const userConfirmed = await requiresUserConfirmation(functionName, args);

    if (!userConfirmed && (
      ['key_combination'].includes(functionName) ||
      functionName.includes('type') ||
      functionName === 'type_text_at'
    )) {
      return { success: false, error: 'Action cancelled by user', userCancelled: true };
    }

    switch (functionName) {
      case 'click':
      case 'click_at':
      case 'mouse_click':
        // Scale coordinates from Gemini's 1000x1000 grid to actual viewport
        const clickCoords = await scaleCoordinates(
          args.x || args.coordinate?.x || 0,
          args.y || args.coordinate?.y || 0
        );
        return await executeTool('click', clickCoords);
      
      case 'type':
      case 'type_text':
      case 'keyboard_input':
      case 'input_text':
        return await executeTool('type', { 
          selector: 'input:focus, textarea:focus, [contenteditable="true"]:focus', 
          text: args.text || args.input || args.content
        });
      
      case 'scroll':
      case 'scroll_down':
      case 'scroll_up':
      case 'mouse_scroll':
        const direction = functionName === 'scroll_up' ? 'up' : 
                         functionName === 'scroll_down' ? 'down' : 
                         args.direction || 'down';
        return await executeTool('scroll', { 
          direction,
          amount: args.amount || args.pixels || args.delta || 500
        });
      
      case 'navigate':
      case 'open_web_browser':
      case 'navigate_to':
      case 'go_to':
        return await executeTool('navigate', { 
          url: args.url || args.address || args.uri
        });
      
      case 'get_screenshot':
      case 'take_screenshot':
      case 'screenshot':
        return await executeTool('screenshot', {});
      
      case 'get_page_info':
      case 'get_url':
      case 'get_page_content':
        return await executeTool('getPageContext', {});
      
      case 'wait':
      case 'sleep':
      case 'delay':
        const waitTime = (args.seconds || args.milliseconds / 1000 || 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return { success: true, message: `Waited ${waitTime}ms` };
      
      case 'press_key':
      case 'key_press':
        // Handle special keys like Enter, Tab, etc.
        return await executeTool('type', { 
          selector: 'input:focus, textarea:focus, [contenteditable="true"]:focus', 
          text: args.key || args.keyCode
        });
      
      case 'type_text_at':
        // Type text at coordinates (click first, then type)
        // This mimics Python's playwright keyboard.type() behavior
        if (args.x !== undefined && args.y !== undefined) {
          // Scale coordinates before clicking
          const typeCoords = await scaleCoordinates(args.x, args.y);
          await executeTool('click', typeCoords);
          // Wait for element to focus
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Clear existing text if requested
        if (args.clear_before_typing !== false) {
          // Use keyboard shortcuts to select all and delete (like Python implementation)
          const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
          if (isMac) {
            await executeTool('keyCombo', { keys: ['Meta', 'a'] });
          } else {
            await executeTool('keyCombo', { keys: ['Control', 'a'] });
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          await executeTool('pressKey', { key: 'Delete' });
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Use keyboard_type action which simulates actual keyboard typing
        const typeResult = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'EXECUTE_ACTION',
              action: 'keyboard_type',
              value: args.text || args.content
            },
            (response) => {
              resolve(response);
            }
          );
        });

        // If press_enter is requested, send Enter key
        if (args.press_enter) {
          await new Promise(resolve => setTimeout(resolve, 100));
          await executeTool('pressKey', { key: 'Enter' });
        }

        return typeResult;
      
      case 'key_combination':
        // Press keyboard key combinations like ["Control", "A"] or ["Enter"]
        const keys = args.keys || [args.key] || ['Enter'];
        return await executeTool('keyCombo', { keys });
      
      case 'hover_at':
        // Hover mouse at coordinates
        const hoverCoords = await scaleCoordinates(args.x || 0, args.y || 0);
        return await executeTool('hover', hoverCoords);
      
      case 'scroll_document':
        // Scroll the entire page
        const scrollDir = args.direction || 'down';
        return await executeTool('scroll', { direction: scrollDir, amount: 800 });
      
      case 'scroll_at':
        // Scroll at specific coordinates
        return await executeTool('scroll', { 
          direction: args.direction || 'down', 
          amount: args.magnitude || 800 
        });
      
      case 'wait_5_seconds':
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { success: true, message: 'Waited 5 seconds' };
      
      case 'go_back':
      case 'back':
        // Go back in browser history - properly async
        return new Promise<any>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.goBack(tabs[0].id);
              // Add small delay for navigation to register
              setTimeout(() => {
                resolve({ success: true, message: 'Navigated back' });
              }, 300);
            } else {
              resolve({ success: false, error: 'No active tab found' });
            }
          });
        });

      case 'go_forward':
      case 'forward':
        // Go forward in browser history - properly async
        return new Promise<any>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.goForward(tabs[0].id);
              // Add small delay for navigation to register
              setTimeout(() => {
                resolve({ success: true, message: 'Navigated forward' });
              }, 300);
            } else {
              resolve({ success: false, error: 'No active tab found' });
            }
          });
        });
      
      case 'search':
        // Navigate to Google search
        return await executeTool('navigate', { url: 'https://www.google.com' });
      
      case 'drag_and_drop':
        return await executeTool('dragDrop', { 
          x: args.x, 
          y: args.y, 
          destination_x: args.destination_x, 
          destination_y: args.destination_y 
        });
      
      default:
        console.warn('⚠️ Unknown Gemini function:', functionName, args);
        return { success: false, error: `Unknown function: ${functionName}`, args };
    }
  };

  const streamGoogle = async (messages: Message[], signal: AbortSignal) => {
    // Ensure API credentials are available
    const apiKey = ensureApiKey();
    const model = ensureModel();
    const provider = getProvider();
    const baseUrl = settings?.llm?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    // Add initial assistant message
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };
    setMessages(prev => [...prev, assistantMessage]);

    if (!messages || messages.length === 0) {
      throw new Error('No messages provided to stream');
    }

    let response: Response;

    if (provider === 'google') {
      // Google Gemini API
      response = await fetch(
        `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content || '' }],
            })),
          }),
          signal,
        }
      );
    } else {
      // OpenAI-compatible API (Deepseek, Qwen, GLM, OpenAI, Anthropic, Ollama, Custom)
      response = await fetch(
        `${baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content || '',
            })),
            stream: true,
          }),
          signal,
        }
      );
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let jsonBuffer = ''; // Accumulate all data for fallback parsing
    let parsedAnyChunk = false; // Track if we successfully parsed any chunk

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Fallback: If no chunks were parsed (formatted JSON response), try parsing the entire buffer
        if (!parsedAnyChunk && jsonBuffer.trim()) {
          try {
            let data = JSON.parse(jsonBuffer.trim());
            // Handle array response format (Google)
            if (Array.isArray(data) && data.length > 0) {
              data = data[0];
            }
            // Try Google format first
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            // Try OpenAI format
            if (!text) {
              text = data.choices?.[0]?.message?.content;
            }
            if (text) {
              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = text;
                }
                return updated;
              });
            }
          } catch (e) {
            console.warn('Failed to parse accumulated JSON buffer:', e);
          }
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      jsonBuffer += chunk; // Accumulate for fallback

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // Handle OpenAI SSE format: "data: {...}"
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const json = JSON.parse(jsonStr);
            const text = json.choices?.[0]?.delta?.content;
            if (text) {
              parsedAnyChunk = true;
              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content += text;
                }
                return updated;
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        } else {
          // Try Google format (direct JSON per line)
          try {
            const json = JSON.parse(line);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              parsedAnyChunk = true;
              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content += text;
                }
                return updated;
              });
            }
          } catch (e) {
            // Skip invalid JSON (expected for formatted responses)
          }
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !settings) return;

    // Handle commands
    const trimmedInput = input.trim();
    let pageSummaryRequest: { userQuestion?: string } | null = null;

    if (input.trim().startsWith('/')) {
      const spaceIndex = trimmedInput.indexOf(' ');
      const command = (spaceIndex === -1 ? trimmedInput : trimmedInput.slice(0, spaceIndex)).toLowerCase();
      const commandArgs = spaceIndex === -1 ? '' : trimmedInput.slice(spaceIndex + 1).trim();

      if (command === '/sources') {
        setView({ type: 'sources' });
        setInput('');
        return;
      }
      if (command === '/articles') {
        setView({ type: 'articles' });
        setInput('');
        return;
      }
      if (command === '/back') {
        setView({ type: 'chat' });
        setInput('');
        return;
      }

      if (command === '/page' || command === '/summarize') {
        pageSummaryRequest = { userQuestion: commandArgs || undefined };
      }
    }

    setInput('');
    setIsLoading(true);
    setIsUserScrolled(false); // Reset scroll state when user sends message

    abortControllerRef.current = new AbortController();

    try {
      let userContent = input;
      let displayContent: string | undefined;

      if (pageSummaryRequest) {
        const selectedTextResponse = await executeTool('getSelectedText', {});
        const selectedText = typeof selectedTextResponse?.text === 'string' ? selectedTextResponse.text : '';

        const pageContextResponse = await executeTool('getPageContext', {});
        if (pageContextResponse?.success === false) {
          const errorMessage = pageContextResponse.error || 'Failed to read page content';
          if (errorMessage.includes('chrome://') || errorMessage.includes('无法访问该页面')) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content:
                  `${errorMessage}\n\n` +
                  '提示：这类页面（如 `chrome://extensions` / 新标签页）Chrome 不允许扩展读取内容。\n' +
                  '请切换到一个普通网页（`https://...`）再输入 `/page`。',
              },
            ]);
            setIsLoading(false);
            return;
          }
          throw new Error(errorMessage);
        }

        const parsed = PageContextSchema.safeParse(pageContextResponse);
        if (!parsed.success) {
          throw new Error('Failed to parse page content (unexpected response shape)');
        }

        const summaryPrompt = buildPageSummaryPrompt({
          page: {
            title: parsed.data.title,
            url: parsed.data.url,
            description: parsed.data.metadata?.description,
            textContent: parsed.data.textContent,
            links: parsed.data.links ?? [],
          },
          selectedText,
          userQuestion: pageSummaryRequest.userQuestion,
        });

        userContent = summaryPrompt.prompt;
        displayContent = summaryPrompt.displayContent;
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userContent,
        displayContent,
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      // BROWSER TOOLS MODE - Use Gemini Computer Use API
      if (browserToolsEnabled && !pageSummaryRequest) {

        // Safety check: Ensure we have Google API key
        const provider = getProvider();
        const apiKey = settings?.llm?.apiKey || settings?.apiKey;
        if (provider !== 'google' || !apiKey) {
          setBrowserToolsEnabled(false);
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = '⚠️ **Browser Tools requires a Google API key**\n\nBrowser Tools uses Gemini 2.5 Computer Use.\n\nPlease:\n1. Open Settings (⚙️)\n2. Select "Google" as provider\n3. Add your Google API key\n4. Try again';
            }
            return updated;
          });
          setIsLoading(false);
          return;
        }

        await streamWithGeminiComputerUse(newMessages);
      } else {
        await streamGoogle(newMessages, abortControllerRef.current.signal);
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error('❌ Chat error occurred:');
      console.error('Error type:', typeof error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Full error object:', error);

      if (error.name !== 'AbortError') {
        const msg = String(error?.message || '');
        if (msg.includes('Cannot access a chrome:// URL') || msg.includes('无法访问该页面')) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content:
                '无法读取 `chrome://` 等浏览器内部页面的内容。\n\n' +
                '请切换到普通网页（`http/https`）后，再输入 `/page` 或 `/summarize`。',
            },
          ]);
          setIsLoading(false);
          return;
        }

        // Show detailed error message to user
        const errorDetails = error?.stack || JSON.stringify(error, null, 2);
        setMessages(prev => {
          const updated = prev.filter(m => m.content !== '');
          return [
            ...updated,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Error: ${error.message}\n\nDetails:\n\`\`\`\n${errorDetails}\n\`\`\``,
            },
          ];
        });
      }
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isLoading) return;
      setCommandMenuOpen(true);
      setCommandMenuIndex(0);
      return;
    }

    if (!shouldShowCommandMenu || filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCommandMenuIndex((prev) => (prev + 1) % filteredCommands.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCommandMenuIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      applySelectedCommand();
      return;
    }

    if (e.key === 'Enter') {
      const trimmed = input.trimStart();
      const token = trimmed.startsWith('/') ? (trimmed.split(/\s+/)[0] || '') : '';
      const isExactCommand = slashCommands.some((c) => c.command === token);
      const hasArgs = trimmed.includes(' ');
      const shouldAutocomplete = !hasArgs && (token === '/' || (token && !isExactCommand));
      if (shouldAutocomplete) {
        e.preventDefault();
        applySelectedCommand();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setCommandMenuOpen(false);
    }
  };

  // Check if user is scrolled to bottom
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll detection
  const handleScroll = () => {
    setIsUserScrolled(!isAtBottom());
  };

  // Auto-scroll to bottom when messages change (unless user scrolled up)
  useEffect(() => {
    if (!isUserScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isUserScrolled]);

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  if (showSettings && !settings) {
    return (
      <div className="chat-container">
        <div className="welcome-message" style={{ padding: '40px 20px' }}>
          <h2>{t('app.title')}</h2>
          <p style={{ marginBottom: '20px' }}>{t('settings.subtitle')}</p>
          <button
            onClick={openSettings}
            className="settings-icon-btn"
            style={{ width: 'auto', padding: '12px 24px' }}
          >
            {t('app.settings')}
          </button>
        </div>
      </div>
    );
  }

  // View switching for sources and articles
  if (view.type === 'sources') {
    return (
      <div className="chat-container dark-mode">
        <SourcesView
          onBack={() => setView({ type: 'chat' })}
          onSelectSource={(sourceId) => setView({ type: 'articles', sourceId })}
        />
      </div>
    );
  }

  if (view.type === 'articles') {
    return (
      <div className="chat-container dark-mode">
        <ArticlesView
          sourceId={view.sourceId}
          onBack={() => setView(view.sourceId ? { type: 'sources' } : { type: 'chat' })}
          onSelectArticle={(articleId) => setView({ type: 'article', articleId })}
        />
      </div>
    );
  }

  if (view.type === 'article') {
    return (
      <div className="chat-container dark-mode">
        <ArticleDetail
          articleId={view.articleId}
          onBack={() => setView({ type: 'articles' })}
        />
      </div>
    );
  }

  return (
    <div className="chat-container dark-mode">
      <div className="chat-header">
  <h1>Atlas</h1>
  <div className="header-actions">
    <button
      onClick={openSettings}
      className="icon-btn"
      title="Settings"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  </div>
</div>

      {showBrowserToolsWarning && (
        <div style={{
          padding: '12px 16px',
          background: '#fef3c7',
          borderBottom: '1px solid #fbbf24',
          fontSize: '13px',
          color: '#92400e',
        }}>
          <strong>Browser Tools Enabled!</strong> Now using Gemini 2.5 Computer Use Preview (overrides your selected model).
          {!settings?.llm?.apiKey && !settings?.apiKey && (
            <span> Please <a href="#" onClick={(e) => { e.preventDefault(); openSettings(); }} style={{ color: '#2563eb', textDecoration: 'underline' }}>set your Google API key</a> in settings.</span>
          )}
        </div>
      )}

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>{t('chat.welcome')}</h2>
            <p>{t('chat.welcomeDesc')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role}`}
            >
              <div className="message-content">
                {message.content ? (
                  message.role === 'assistant' ? (
                    <MessageParser content={message.content} />
                  ) : (
                    message.displayContent ?? message.content
                  )
                ) : (
                  isLoading && message.role === 'assistant' && (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        {shouldShowCommandMenu && filteredCommands.length > 0 && (
          <div className="command-menu" role="listbox" aria-label={t('commands.menuLabel')}>
            <div className="command-menu-header">
              <span>{t('commands.menuTitle')}</span>
              <span className="command-menu-hint">{t('commands.menuHint')}</span>
            </div>
            {filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.command}
                type="button"
                className={`command-item ${idx === commandMenuIndex ? 'active' : ''}`}
                onMouseEnter={() => setCommandMenuIndex(idx)}
                onClick={() => {
                  setCommandMenuIndex(idx);
                  applySelectedCommand();
                }}
              >
                <div className="command-item-main">
                  <div className="command-item-command">{cmd.command}</div>
                  <div className="command-item-title">{cmd.title}</div>
                </div>
                <div className="command-item-desc">{cmd.description}</div>
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={input}
          ref={inputRef}
          onKeyDown={handleInputKeyDown}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.placeholder')}
          disabled={isLoading}
          className="chat-input"
        />
        <button
          type="button"
          className="command-button"
          onClick={() => {
            if (isLoading) return;
            setCommandMenuOpen((prev) => !prev);
            setCommandMenuIndex(0);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          disabled={isLoading}
          title={t('commands.open')}
          aria-label={t('commands.open')}
        >
          /
        </button>
        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            className="send-button stop-button"
          >
            ⬛
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="send-button"
          >
            ⏎
          </button>
        )}
      </form>
      <div ref={messagesEndRef} />
    </div>
  );
}

// Initialize i18n before rendering
initI18n().then(() => {
  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(<ChatSidebar />);
});
