import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { initI18n } from './src/i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Settings, Message } from './types';
import { PageContextSchema } from './types';
import { SourcesView } from './src/components/SourcesView';
import { ArticlesView } from './src/components/ArticlesView';
import { ArticleDetail } from './src/components/ArticleDetail';
import { TabBar, TabType } from './src/components/TabBar';
import { Toggle } from './src/components/Toggle';
import { BrowserAgent, AgentCallbacks } from './src/core/browser-agent';

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
          className="message-section"
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
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [view, setView] = useState<ViewState>({ type: 'chat' });
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const abortControllerRef = useRef<AbortController | null>(null);
  const browserAgentRef = useRef<BrowserAgent | null>(null);
  const listenerAttachedRef = useRef(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandMenuIndex, setCommandMenuIndex] = useState(0);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'chat') {
      setView({ type: 'chat' });
    } else if (tab === 'sources') {
      setView({ type: 'sources' });
    } else if (tab === 'articles') {
      setView({ type: 'articles' });
    }
  };

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

    if (newValue && !settings) {
      alert('⚠️ Please configure your settings first.');
      openSettings();
      return;
    }

    setBrowserToolsEnabled(newValue);
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (browserAgentRef.current) {
      browserAgentRef.current.stop();
    }
    setIsLoading(false);
  };

  const runBrowserAgent = async (task: string) => {
    if (!settings?.llm) {
      throw new Error('LLM not configured');
    }

    const callbacks: AgentCallbacks = {
      onThinking: (message) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content = message;
          }
          return updated;
        });
      },
      onActionStart: (action) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content += `\n[${action.action}...]`;
          }
          return updated;
        });
      },
      onActionComplete: (_action, result) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            lastMsg.content += ` ${result.success ? '✓' : '✗'}`;
          }
          return updated;
        });
      },
      onConfirmRequired: async (message, _action) => {
        return window.confirm(message);
      },
      onError: (error) => {
        console.error('Browser agent error:', error);
      }
    };

    browserAgentRef.current = new BrowserAgent(settings.llm, {
      maxTurns: 20,
      callbacks
    });

    // Add initial assistant message
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Analyzing page...',
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const result = await browserAgentRef.current.run(task);

      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content = result;
        }
        return updated;
      });
    } catch (error) {
      throw error;
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

      // BROWSER TOOLS MODE - Use Browser Agent (any LLM)
      if (browserToolsEnabled && !pageSummaryRequest) {
        await runBrowserAgent(userContent);
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
            className="icon-btn"
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
    <div className="chat-container">
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

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>{t('welcome.title')}</h2>
            <p>{t('welcome.desc')}</p>
            {!browserToolsEnabled && (
              <button className="welcome-cta" onClick={toggleBrowserTools}>
                {t('browserTools.enable')}
              </button>
            )}
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

      <div className="input-area">
        <div className="input-controls">
          <Toggle
            label={t('browserTools.label')}
            checked={browserToolsEnabled}
            onChange={toggleBrowserTools}
            disabled={isLoading}
            hint={browserToolsEnabled ? t('browserTools.hint') : undefined}
          />
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
          {isLoading ? (
            <button type="button" onClick={stop} className="send-button stop-button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="send-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          )}
        </form>

        <div className="input-footer">
          <button onClick={newChat} className="new-chat-btn" disabled={isLoading}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {t('app.newChat')}
          </button>
        </div>
      </div>
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
