# P0 基础框架实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建智能信息中枢的基础框架，包括灵活的 LLM 配置和多语言支持。

**Architecture:**
- 扩展现有 Settings 类型支持自定义 Base URL 和模型
- 使用 react-i18next 实现中英双语自动切换
- 为 Chrome Extension 和 Electron App 分别适配

**Tech Stack:** TypeScript, React, react-i18next, Zod

---

## Phase 1: 灵活的 LLM 配置

### Task 1: 扩展 LLM 配置类型定义

**Files:**
- Modify: `types.ts:1-20`
- Modify: `electron-browser/src/renderer/types.ts:20-25`

**Step 1: 更新 Chrome Extension 的 Settings 类型**

在 `types.ts` 中扩展 Settings 接口：

```typescript
// types.ts - 在文件顶部，Settings 接口之前添加

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'ollama' | 'custom';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  options?: LLMOptions;
}

// 预设模板
export const LLM_PROVIDER_PRESETS: Record<Exclude<LLMProvider, 'custom'>, { baseUrl: string; defaultModel: string; models: string[] }> = {
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash-exp',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-turbo',
    models: ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus-20240229',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    models: ['llama3', 'llama2', 'mistral', 'codellama'],
  },
};
```

**Step 2: 运行 TypeScript 检查**

Run: `cd /Users/tangliang/Documents/bootcamp/chambroad-atlas && npx tsc --noEmit`
Expected: 无错误（或仅有与新增类型无关的现有错误）

**Step 3: 更新 Settings 接口以使用 LLMConfig**

修改 `types.ts` 中的 Settings 接口：

```typescript
export interface Settings {
  // LLM 配置
  llm: LLMConfig;
  // 兼容旧字段（逐步废弃）
  provider?: 'google';
  apiKey?: string;
  model?: string;
  // 工具配置
  toolMode?: ToolMode;
  composioApiKey?: string;
}
```

**Step 4: 添加 Zod 验证 Schema**

在 `types.ts` 底部添加：

```typescript
export const LLMOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  timeout: z.number().positive().optional(),
  headers: z.record(z.string()).optional(),
});

export const LLMConfigSchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic', 'ollama', 'custom']),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  options: LLMOptionsSchema.optional(),
});

export const SettingsSchemaV2 = z.object({
  llm: LLMConfigSchema,
  toolMode: z.enum(['tool-router']).optional(),
  composioApiKey: z.string().optional(),
});
```

**Step 5: Commit**

```bash
git add types.ts
git commit -m "feat(types): add flexible LLM configuration types

- Add LLMProvider, LLMOptions, LLMConfig interfaces
- Add provider presets for Google, OpenAI, Anthropic, Ollama
- Add Zod validation schemas for runtime type safety"
```

---

### Task 2: 更新 Electron App 的类型定义

**Files:**
- Modify: `electron-browser/src/renderer/types.ts`

**Step 1: 同步 LLM 配置类型到 Electron**

将相同的类型定义添加到 `electron-browser/src/renderer/types.ts`：

```typescript
// electron-browser/src/renderer/types.ts - 在文件顶部添加

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'ollama' | 'custom';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  options?: LLMOptions;
}

export const LLM_PROVIDER_PRESETS: Record<Exclude<LLMProvider, 'custom'>, { baseUrl: string; defaultModel: string; models: string[] }> = {
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash-exp',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-turbo',
    models: ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus-20240229',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    models: ['llama3', 'llama2', 'mistral', 'codellama'],
  },
};
```

**Step 2: 更新 Electron Settings 接口**

```typescript
export interface Settings {
  // 新的 LLM 配置
  llm?: LLMConfig;
  // 兼容旧字段
  googleApiKey: string;
  composioApiKey?: string;
  model: string;
}
```

**Step 3: 更新 Zod Schema**

```typescript
export const LLMConfigSchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic', 'ollama', 'custom']),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    timeout: z.number().positive().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
});

export const SettingsSchema = z.object({
  llm: LLMConfigSchema.optional(),
  googleApiKey: z.string(),
  composioApiKey: z.string().optional(),
  model: z.string(),
});
```

**Step 4: Commit**

```bash
git add electron-browser/src/renderer/types.ts
git commit -m "feat(electron): sync LLM configuration types"
```

---

### Task 3: 创建新的 LLM 设置组件

**Files:**
- Create: `src/components/LLMSettings.tsx`

**Step 1: 创建组件目录**

```bash
mkdir -p /Users/tangliang/Documents/bootcamp/chambroad-atlas/src/components
```

**Step 2: 创建 LLMSettings 组件**

创建文件 `src/components/LLMSettings.tsx`：

```tsx
import { useState, useEffect } from 'react';
import type { LLMConfig, LLMProvider } from '../types';
import { LLM_PROVIDER_PRESETS } from '../types';

interface LLMSettingsProps {
  config: LLMConfig | undefined;
  onChange: (config: LLMConfig) => void;
  onTestConnection?: () => Promise<{ success: boolean; error?: string }>;
}

export function LLMSettings({ config, onChange, onTestConnection }: LLMSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCustom, setIsCustom] = useState(config?.provider === 'custom');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');

  const defaultConfig: LLMConfig = {
    provider: 'google',
    baseUrl: LLM_PROVIDER_PRESETS.google.baseUrl,
    apiKey: '',
    model: LLM_PROVIDER_PRESETS.google.defaultModel,
  };

  const currentConfig = config || defaultConfig;

  const handleProviderChange = (provider: LLMProvider) => {
    if (provider === 'custom') {
      setIsCustom(true);
      onChange({
        ...currentConfig,
        provider: 'custom',
      });
    } else {
      setIsCustom(false);
      const preset = LLM_PROVIDER_PRESETS[provider];
      onChange({
        ...currentConfig,
        provider,
        baseUrl: preset.baseUrl,
        model: preset.defaultModel,
      });
    }
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;

    setTestStatus('testing');
    setTestError('');

    try {
      const result = await onTestConnection();
      if (result.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(result.error || 'Connection failed');
      }
    } catch (e) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Unknown error');
    }

    // Reset status after 3 seconds
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const availableModels = isCustom
    ? []
    : LLM_PROVIDER_PRESETS[currentConfig.provider as Exclude<LLMProvider, 'custom'>]?.models || [];

  return (
    <div className="llm-settings">
      <h3>🤖 LLM Configuration</h3>

      {/* Provider Selection */}
      <div className="setting-group">
        <label>Provider</label>
        <select
          value={currentConfig.provider}
          onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
        >
          <option value="google">Google Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="custom">Custom API</option>
        </select>
      </div>

      {/* Base URL */}
      <div className="setting-group">
        <label>Base URL</label>
        <input
          type="text"
          value={currentConfig.baseUrl}
          onChange={(e) => onChange({ ...currentConfig, baseUrl: e.target.value })}
          placeholder="https://api.example.com/v1"
          disabled={!isCustom && currentConfig.provider !== 'custom'}
        />
        {!isCustom && (
          <p className="help-text">Using default URL for {currentConfig.provider}</p>
        )}
      </div>

      {/* API Key */}
      <div className="setting-group">
        <label>API Key</label>
        <div className="api-key-input-wrapper">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={currentConfig.apiKey}
            onChange={(e) => onChange({ ...currentConfig, apiKey: e.target.value })}
            placeholder="Enter your API key"
          />
          <button
            type="button"
            className="toggle-visibility"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="setting-group">
        <label>Model</label>
        {isCustom ? (
          <input
            type="text"
            value={currentConfig.model}
            onChange={(e) => onChange({ ...currentConfig, model: e.target.value })}
            placeholder="Enter model name (e.g., gpt-4-turbo)"
          />
        ) : (
          <select
            value={currentConfig.model}
            onChange={(e) => onChange({ ...currentConfig, model: e.target.value })}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        )}
      </div>

      {/* Advanced Options Toggle */}
      <details className="advanced-options">
        <summary>Advanced Options</summary>
        <div className="setting-group">
          <label>Temperature</label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={currentConfig.options?.temperature ?? 0.7}
            onChange={(e) => onChange({
              ...currentConfig,
              options: { ...currentConfig.options, temperature: parseFloat(e.target.value) }
            })}
          />
        </div>
        <div className="setting-group">
          <label>Max Tokens</label>
          <input
            type="number"
            min="1"
            value={currentConfig.options?.maxTokens ?? 4096}
            onChange={(e) => onChange({
              ...currentConfig,
              options: { ...currentConfig.options, maxTokens: parseInt(e.target.value) }
            })}
          />
        </div>
        <div className="setting-group">
          <label>Timeout (seconds)</label>
          <input
            type="number"
            min="1"
            value={currentConfig.options?.timeout ?? 60}
            onChange={(e) => onChange({
              ...currentConfig,
              options: { ...currentConfig.options, timeout: parseInt(e.target.value) }
            })}
          />
        </div>
      </details>

      {/* Test Connection */}
      {onTestConnection && (
        <div className="test-connection">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing' || !currentConfig.apiKey}
            className={`test-button ${testStatus}`}
          >
            {testStatus === 'testing' ? 'Testing...' :
             testStatus === 'success' ? '✓ Connected' :
             testStatus === 'error' ? '✗ Failed' : 'Test Connection'}
          </button>
          {testError && <p className="error-text">{testError}</p>}
        </div>
      )}
    </div>
  );
}

export default LLMSettings;
```

**Step 3: Commit**

```bash
git add src/components/LLMSettings.tsx
git commit -m "feat(ui): add LLMSettings component for flexible LLM configuration"
```

---

### Task 4: 更新 Settings 页面集成 LLMSettings

**Files:**
- Modify: `settings.tsx`

**Step 1: 导入 LLMSettings 并更新状态**

修改 `settings.tsx`，将新的 LLM 配置集成：

```tsx
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Settings, LLMConfig } from './types';
import { LLM_PROVIDER_PRESETS } from './types';
import { LLMSettings } from './src/components/LLMSettings';

function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    llm: {
      provider: 'google',
      baseUrl: LLM_PROVIDER_PRESETS.google.baseUrl,
      apiKey: '',
      model: LLM_PROVIDER_PRESETS.google.defaultModel,
    },
    toolMode: 'tool-router',
    composioApiKey: '',
  });
  const [saved, setSaved] = useState(false);
  const [showComposioKey, setShowComposioKey] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['atlasSettings'], (result) => {
      if (result.atlasSettings) {
        // 兼容旧格式
        const oldSettings = result.atlasSettings;
        if (!oldSettings.llm && oldSettings.apiKey) {
          setSettings({
            llm: {
              provider: 'google',
              baseUrl: LLM_PROVIDER_PRESETS.google.baseUrl,
              apiKey: oldSettings.apiKey,
              model: oldSettings.model || LLM_PROVIDER_PRESETS.google.defaultModel,
            },
            toolMode: oldSettings.toolMode,
            composioApiKey: oldSettings.composioApiKey,
          });
        } else {
          setSettings(result.atlasSettings);
        }
      }
    });
  }, []);

  const handleLLMChange = (llmConfig: LLMConfig) => {
    setSettings({ ...settings, llm: llmConfig });
  };

  const handleTestConnection = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { provider, baseUrl, apiKey, model } = settings.llm;

      // Simple test based on provider
      if (provider === 'google') {
        const response = await fetch(
          `${baseUrl}/models/${model}?key=${apiKey}`,
          { method: 'GET' }
        );
        if (!response.ok) {
          const error = await response.json();
          return { success: false, error: error.error?.message || 'Connection failed' };
        }
        return { success: true };
      }

      // For OpenAI-compatible APIs
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  };

  const handleSave = () => {
    // 保存时同时保留兼容字段
    const saveData = {
      ...settings,
      // 兼容旧代码
      provider: 'google',
      apiKey: settings.llm.apiKey,
      model: settings.llm.model,
    };

    chrome.storage.local.set({ atlasSettings: saveData }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }, () => {
        if (chrome.runtime.lastError) {
          console.log('Sidebar not active, but settings saved');
        }
      });
    });
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Configure your AI provider and preferences</p>
      </div>

      <div className="settings-content">
        {/* LLM Settings Component */}
        <LLMSettings
          config={settings.llm}
          onChange={handleLLMChange}
          onTestConnection={handleTestConnection}
        />

        {/* Composio API Key */}
        <div className="setting-group">
          <label>Composio API Key</label>
          <div className="api-key-input-wrapper">
            <input
              type={showComposioKey ? 'text' : 'password'}
              value={settings.composioApiKey || ''}
              onChange={(e) => setSettings({ ...settings, composioApiKey: e.target.value })}
              placeholder="Enter your Composio API key (optional)"
              className="api-key-input"
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowComposioKey(!showComposioKey)}
            >
              {showComposioKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <p className="help-text">
            Enable Composio Tool Router for access to 500+ app integrations.
          </p>
        </div>

        <button
          className={`save-button ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={!settings.llm.apiKey}
        >
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<SettingsPage />);
```

**Step 2: 运行构建检查**

Run: `cd /Users/tangliang/Documents/bootcamp/chambroad-atlas && npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add settings.tsx
git commit -m "feat(settings): integrate LLMSettings for flexible provider configuration"
```

---

## Phase 2: 多语言支持 (i18n)

### Task 5: 安装 i18n 依赖

**Files:**
- Modify: `package.json`
- Modify: `electron-browser/package.json`

**Step 1: 安装 Chrome Extension 的 i18n 依赖**

Run: `cd /Users/tangliang/Documents/bootcamp/chambroad-atlas && npm install i18next react-i18next`

**Step 2: 安装 Electron 的 i18n 依赖**

Run: `cd /Users/tangliang/Documents/bootcamp/chambroad-atlas/electron-browser && npm install i18next react-i18next`

**Step 3: Commit**

```bash
git add package.json package-lock.json electron-browser/package.json electron-browser/package-lock.json
git commit -m "deps: add i18next and react-i18next for multi-language support"
```

---

### Task 6: 创建语言包

**Files:**
- Create: `src/locales/zh/translation.json`
- Create: `src/locales/en/translation.json`

**Step 1: 创建目录结构**

```bash
mkdir -p /Users/tangliang/Documents/bootcamp/chambroad-atlas/src/locales/zh
mkdir -p /Users/tangliang/Documents/bootcamp/chambroad-atlas/src/locales/en
```

**Step 2: 创建中文语言包**

创建文件 `src/locales/zh/translation.json`：

```json
{
  "app": {
    "title": "Atlas",
    "subtitle": "智能信息中枢",
    "search": "搜索...",
    "newChat": "新对话",
    "settings": "设置"
  },
  "chat": {
    "placeholder": "输入消息...",
    "send": "发送",
    "stop": "停止",
    "welcome": "今天我能帮你做什么？",
    "welcomeDesc": "我是 Atlas，你的 AI 助手。我可以帮你浏览网页、分析内容、执行各种任务。"
  },
  "settings": {
    "title": "设置",
    "subtitle": "配置你的 AI 服务商和偏好",
    "llm": {
      "title": "大模型配置",
      "provider": "服务商",
      "baseUrl": "API 地址",
      "apiKey": "API 密钥",
      "model": "模型",
      "testConnection": "测试连接",
      "testing": "测试中...",
      "connected": "已连接",
      "failed": "连接失败",
      "advancedOptions": "高级选项",
      "temperature": "温度",
      "maxTokens": "最大 Token 数",
      "timeout": "超时时间（秒）"
    },
    "composio": {
      "title": "Composio API Key",
      "placeholder": "输入你的 Composio API key（可选）",
      "help": "启用 Composio Tool Router 以访问 500+ 应用集成"
    },
    "language": {
      "title": "语言",
      "auto": "跟随系统",
      "zh": "中文",
      "en": "English"
    },
    "save": "保存设置",
    "saved": "已保存！",
    "privacy": {
      "title": "隐私与安全",
      "desc": "你的 API 密钥仅存储在本地浏览器中，只会发送给相应的 AI 服务商。绝不会与第三方共享。"
    }
  },
  "features": {
    "browserTools": {
      "title": "浏览器工具",
      "desc": "点击浏览器工具按钮启用 Gemini 2.5 Computer Use 进行直接浏览器自动化"
    },
    "toolRouter": {
      "title": "工具路由",
      "desc": "添加 Composio API key 以访问 500+ 应用集成（Gmail、Slack、GitHub 等）"
    }
  },
  "providers": {
    "google": "Google Gemini",
    "openai": "OpenAI",
    "anthropic": "Anthropic Claude",
    "ollama": "Ollama（本地）",
    "custom": "自定义 API"
  },
  "errors": {
    "apiKeyRequired": "请先配置 API Key",
    "connectionFailed": "连接失败",
    "networkError": "网络错误"
  }
}
```

**Step 3: 创建英文语言包**

创建文件 `src/locales/en/translation.json`：

```json
{
  "app": {
    "title": "Atlas",
    "subtitle": "Intelligent Information Hub",
    "search": "Search...",
    "newChat": "New Chat",
    "settings": "Settings"
  },
  "chat": {
    "placeholder": "Message Atlas...",
    "send": "Send",
    "stop": "Stop",
    "welcome": "How can I help you today?",
    "welcomeDesc": "I'm Atlas, your AI assistant. I can help you browse the web, analyze content, and perform various tasks."
  },
  "settings": {
    "title": "Settings",
    "subtitle": "Configure your AI provider and preferences",
    "llm": {
      "title": "LLM Configuration",
      "provider": "Provider",
      "baseUrl": "Base URL",
      "apiKey": "API Key",
      "model": "Model",
      "testConnection": "Test Connection",
      "testing": "Testing...",
      "connected": "Connected",
      "failed": "Failed",
      "advancedOptions": "Advanced Options",
      "temperature": "Temperature",
      "maxTokens": "Max Tokens",
      "timeout": "Timeout (seconds)"
    },
    "composio": {
      "title": "Composio API Key",
      "placeholder": "Enter your Composio API key (optional)",
      "help": "Enable Composio Tool Router for access to 500+ app integrations"
    },
    "language": {
      "title": "Language",
      "auto": "System Default",
      "zh": "中文",
      "en": "English"
    },
    "save": "Save Settings",
    "saved": "Saved!",
    "privacy": {
      "title": "Privacy & Security",
      "desc": "Your API keys are stored locally in your browser and only sent to the respective AI providers. Never shared with third parties."
    }
  },
  "features": {
    "browserTools": {
      "title": "Browser Tools",
      "desc": "Click the Browser Tools button to enable Gemini 2.5 Computer Use for direct browser automation"
    },
    "toolRouter": {
      "title": "Tool Router",
      "desc": "Add Composio API key to access 500+ integrations (Gmail, Slack, GitHub, etc.)"
    }
  },
  "providers": {
    "google": "Google Gemini",
    "openai": "OpenAI",
    "anthropic": "Anthropic Claude",
    "ollama": "Ollama (Local)",
    "custom": "Custom API"
  },
  "errors": {
    "apiKeyRequired": "Please configure your API key first",
    "connectionFailed": "Connection failed",
    "networkError": "Network error"
  }
}
```

**Step 4: Commit**

```bash
git add src/locales/
git commit -m "feat(i18n): add Chinese and English translation files"
```

---

### Task 7: 创建 i18n 配置

**Files:**
- Create: `src/i18n.ts`

**Step 1: 创建 i18n 初始化文件**

创建文件 `src/i18n.ts`：

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh/translation.json';
import enTranslation from './locales/en/translation.json';

/**
 * 检测系统语言
 * - Chrome Extension: chrome.i18n.getUILanguage()
 * - Electron: 通过 preload 暴露的 API
 * - Browser: navigator.language
 */
export function detectLanguage(): string {
  let lang = 'en';

  // Chrome 扩展环境
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    lang = chrome.i18n.getUILanguage();
  }
  // Electron 环境（通过 preload 暴露）
  else if (typeof window !== 'undefined' && (window as any).electronAPI?.getLocale) {
    lang = (window as any).electronAPI.getLocale();
  }
  // 普通浏览器环境
  else if (typeof navigator !== 'undefined') {
    lang = navigator.language;
  }

  // 中文变体统一处理
  if (lang.startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}

/**
 * 获取用户设置的语言偏好
 * 如果用户手动设置了语言，优先使用用户设置
 */
export async function getUserLanguagePreference(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['atlasLanguage'], (result) => {
        resolve(result.atlasLanguage || null);
      });
    } else if (typeof localStorage !== 'undefined') {
      resolve(localStorage.getItem('atlasLanguage'));
    } else {
      resolve(null);
    }
  });
}

/**
 * 保存用户语言偏好
 */
export function saveLanguagePreference(lang: string | 'auto'): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    if (lang === 'auto') {
      chrome.storage.local.remove(['atlasLanguage']);
    } else {
      chrome.storage.local.set({ atlasLanguage: lang });
    }
  } else if (typeof localStorage !== 'undefined') {
    if (lang === 'auto') {
      localStorage.removeItem('atlasLanguage');
    } else {
      localStorage.setItem('atlasLanguage', lang);
    }
  }
}

/**
 * 初始化 i18n
 */
export async function initI18n(): Promise<typeof i18n> {
  const userLang = await getUserLanguagePreference();
  const detectedLang = detectLanguage();
  const initialLang = userLang || detectedLang;

  await i18n.use(initReactI18next).init({
    lng: initialLang,
    fallbackLng: 'en',
    resources: {
      zh: { translation: zhTranslation },
      en: { translation: enTranslation },
    },
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
  });

  return i18n;
}

/**
 * 切换语言
 */
export function changeLanguage(lang: string): void {
  i18n.changeLanguage(lang);
  saveLanguagePreference(lang);
}

export default i18n;
```

**Step 2: Commit**

```bash
git add src/i18n.ts
git commit -m "feat(i18n): add i18n configuration with auto language detection"
```

---

### Task 8: 集成 i18n 到应用入口

**Files:**
- Modify: `settings.tsx`
- Modify: `sidepanel.tsx`

**Step 1: 更新 settings.tsx 以使用 i18n**

在 `settings.tsx` 顶部添加 i18n 导入和初始化：

```tsx
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { initI18n, changeLanguage, detectLanguage } from './src/i18n';
import type { Settings, LLMConfig } from './types';
import { LLM_PROVIDER_PRESETS } from './types';

// 等待 i18n 初始化完成后再渲染
initI18n().then(() => {
  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(<SettingsPage />);
});

function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState<'auto' | 'zh' | 'en'>('auto');
  // ... 其余代码保持不变，但将硬编码文本替换为 t() 调用

  // 示例：
  // <h1>Settings</h1> 改为 <h1>{t('settings.title')}</h1>
  // <label>Provider</label> 改为 <label>{t('settings.llm.provider')}</label>
}
```

**Step 2: 更新 sidepanel.tsx 以使用 i18n**

在 `sidepanel.tsx` 顶部添加 i18n 导入：

```tsx
import { useTranslation } from 'react-i18next';
import { initI18n } from './src/i18n';

// 在组件中使用
function ChatSidebar() {
  const { t } = useTranslation();

  // 示例替换:
  // "How can I help you today?" 改为 {t('chat.welcome')}
  // "Message Atlas..." 改为 {t('chat.placeholder')}
}

// 初始化
initI18n().then(() => {
  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(<ChatSidebar />);
});
```

**Step 3: 运行构建检查**

Run: `npm run build`
Expected: 构建成功

**Step 4: Commit**

```bash
git add settings.tsx sidepanel.tsx
git commit -m "feat(i18n): integrate i18n into settings and sidepanel"
```

---

### Task 9: 添加语言切换组件

**Files:**
- Create: `src/components/LanguageSwitch.tsx`

**Step 1: 创建语言切换组件**

创建文件 `src/components/LanguageSwitch.tsx`：

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, detectLanguage, getUserLanguagePreference } from '../i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = useState<'auto' | 'zh' | 'en'>('auto');

  useEffect(() => {
    getUserLanguagePreference().then((pref) => {
      if (pref === 'zh' || pref === 'en') {
        setPreference(pref);
      } else {
        setPreference('auto');
      }
    });
  }, []);

  const handleChange = (value: 'auto' | 'zh' | 'en') => {
    setPreference(value);
    if (value === 'auto') {
      const systemLang = detectLanguage();
      i18n.changeLanguage(systemLang);
      // Clear saved preference
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.remove(['atlasLanguage']);
      } else {
        localStorage.removeItem('atlasLanguage');
      }
    } else {
      changeLanguage(value);
    }
  };

  return (
    <div className="setting-group">
      <label>🌐 {t('settings.language.title')}</label>
      <select
        value={preference}
        onChange={(e) => handleChange(e.target.value as 'auto' | 'zh' | 'en')}
      >
        <option value="auto">{t('settings.language.auto')}</option>
        <option value="zh">{t('settings.language.zh')}</option>
        <option value="en">{t('settings.language.en')}</option>
      </select>
    </div>
  );
}

export default LanguageSwitch;
```

**Step 2: Commit**

```bash
git add src/components/LanguageSwitch.tsx
git commit -m "feat(i18n): add LanguageSwitch component for manual language selection"
```

---

### Task 10: 为 Electron 添加 i18n 支持

**Files:**
- Modify: `electron-browser/src/preload/index.ts`
- Create: `electron-browser/src/renderer/i18n.ts`
- Copy: 语言包到 Electron

**Step 1: 在 preload 中暴露 getLocale**

修改 `electron-browser/src/preload/index.ts`，添加 getLocale：

```typescript
// 在 contextBridge.exposeInMainWorld 中添加
getLocale: () => {
  // Electron 可通过 ipc 获取，这里用 navigator 作为 fallback
  return navigator.language;
},
```

**Step 2: 复制语言包到 Electron**

```bash
mkdir -p /Users/tangliang/Documents/bootcamp/chambroad-atlas/electron-browser/src/renderer/locales
cp -r /Users/tangliang/Documents/bootcamp/chambroad-atlas/src/locales/* /Users/tangliang/Documents/bootcamp/chambroad-atlas/electron-browser/src/renderer/locales/
```

**Step 3: 创建 Electron 的 i18n 配置**

创建 `electron-browser/src/renderer/i18n.ts`（与 Chrome 版本类似但适配 Electron）

**Step 4: Commit**

```bash
git add electron-browser/
git commit -m "feat(electron): add i18n support with locale detection"
```

---

## 完成检查清单

- [ ] LLM 配置类型定义已更新
- [ ] LLMSettings 组件已创建
- [ ] Settings 页面已集成新组件
- [ ] i18n 依赖已安装
- [ ] 中英文语言包已创建
- [ ] i18n 配置已完成
- [ ] 语言切换组件已创建
- [ ] Electron 应用已适配
- [ ] 构建测试通过

---

*计划创建时间: 2026-01-02*
