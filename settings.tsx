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
        const oldSettings = result.atlasSettings;
        // Migrate from old format if needed
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
        } else if (oldSettings.llm) {
          setSettings(oldSettings);
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

      // OpenAI-compatible APIs
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
    // Save with backward compatibility fields
    const saveData = {
      ...settings,
      provider: 'google' as const,
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
        <LLMSettings
          config={settings.llm}
          onChange={handleLLMChange}
          onTestConnection={handleTestConnection}
        />

        <div className="setting-group">
          <label htmlFor="composio-key">Composio API Key</label>
          <div className="api-key-input-wrapper">
            <input
              id="composio-key"
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
              aria-label={showComposioKey ? 'Hide Composio key' : 'Show Composio key'}
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

        <div className="info-box">
          <h3>🔒 Privacy & Security</h3>
          <p>Your API keys are stored locally in your browser and only sent to the respective AI providers.</p>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<SettingsPage />);
