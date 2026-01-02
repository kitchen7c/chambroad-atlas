import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LLMConfig, LLMProvider } from '../../types';
import { LLM_PROVIDER_PRESETS } from '../../types';

interface LLMSettingsProps {
  config: LLMConfig | undefined;
  onChange: (config: LLMConfig) => void;
  onTestConnection?: () => Promise<{ success: boolean; error?: string }>;
}

export function LLMSettings({ config, onChange, onTestConnection }: LLMSettingsProps) {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCustom, setIsCustom] = useState(config?.provider === 'custom');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const defaultConfig: LLMConfig = {
    provider: 'google',
    baseUrl: LLM_PROVIDER_PRESETS.google.baseUrl,
    apiKey: '',
    model: LLM_PROVIDER_PRESETS.google.defaultModel,
  };

  const currentConfig = config || defaultConfig;

  // Sync isCustom state with config
  useEffect(() => {
    setIsCustom(config?.provider === 'custom');
  }, [config?.provider]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setTestStatus('idle'), 3000);
  };

  const availableModels = isCustom
    ? []
    : LLM_PROVIDER_PRESETS[currentConfig.provider as Exclude<LLMProvider, 'custom'>]?.models || [];

  return (
    <div className="llm-settings">
      <h3>🤖 {t('settings.llm.title')}</h3>

      <div className="setting-group">
        <label htmlFor="llm-provider">{t('settings.llm.provider')}</label>
        <select
          id="llm-provider"
          value={currentConfig.provider}
          onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
        >
          <option value="google">{t('providers.google')}</option>
          <option value="openai">{t('providers.openai')}</option>
          <option value="anthropic">{t('providers.anthropic')}</option>
          <option value="deepseek">{t('providers.deepseek')}</option>
          <option value="qwen">{t('providers.qwen')}</option>
          <option value="glm">{t('providers.glm')}</option>
          <option value="ollama">{t('providers.ollama')}</option>
          <option value="custom">{t('providers.custom')}</option>
        </select>
      </div>

      <div className="setting-group">
        <label htmlFor="llm-baseurl">{t('settings.llm.baseUrl')}</label>
        <input
          id="llm-baseurl"
          type="text"
          value={currentConfig.baseUrl}
          onChange={(e) => onChange({ ...currentConfig, baseUrl: e.target.value })}
          placeholder="https://api.example.com/v1"
          disabled={!isCustom && currentConfig.provider !== 'custom'}
        />
        {!isCustom && (
          <p className="help-text">{t('settings.llm.baseUrlHelp', { provider: currentConfig.provider })}</p>
        )}
      </div>

      <div className="setting-group">
        <label htmlFor="llm-apikey">{t('settings.llm.apiKey')}</label>
        <div className="api-key-input-wrapper">
          <input
            id="llm-apikey"
            type={showApiKey ? 'text' : 'password'}
            value={currentConfig.apiKey}
            onChange={(e) => onChange({ ...currentConfig, apiKey: e.target.value })}
            placeholder={t('settings.llm.apiKeyPlaceholder')}
          />
          <button
            type="button"
            className="toggle-visibility"
            onClick={() => setShowApiKey(!showApiKey)}
            aria-label={showApiKey ? t('settings.llm.apiKeyHide') : t('settings.llm.apiKeyShow')}
          >
            {showApiKey ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="llm-model">{t('settings.llm.model')}</label>
        {isCustom ? (
          <input
            id="llm-model"
            type="text"
            value={currentConfig.model}
            onChange={(e) => onChange({ ...currentConfig, model: e.target.value })}
            placeholder={t('settings.llm.modelPlaceholder')}
          />
        ) : (
          <select
            id="llm-model"
            value={currentConfig.model}
            onChange={(e) => onChange({ ...currentConfig, model: e.target.value })}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        )}
      </div>

      <details className="advanced-options">
        <summary>{t('settings.llm.advancedOptions')}</summary>
        <div className="setting-group">
          <label htmlFor="llm-temperature">{t('settings.llm.temperature')}</label>
          <input
            id="llm-temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={currentConfig.options?.temperature ?? 0.7}
            onChange={(e) => {
              const temp = parseFloat(e.target.value);
              if (!isNaN(temp)) {
                onChange({
                  ...currentConfig,
                  options: { ...currentConfig.options, temperature: temp }
                });
              }
            }}
          />
        </div>
        <div className="setting-group">
          <label htmlFor="llm-max-tokens">{t('settings.llm.maxTokens')}</label>
          <input
            id="llm-max-tokens"
            type="number"
            min="1"
            value={currentConfig.options?.maxTokens ?? 4096}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value > 0) {
                onChange({
                  ...currentConfig,
                  options: { ...currentConfig.options, maxTokens: value }
                });
              }
            }}
          />
        </div>
        <div className="setting-group">
          <label htmlFor="llm-timeout">{t('settings.llm.timeout')}</label>
          <input
            id="llm-timeout"
            type="number"
            min="1"
            value={currentConfig.options?.timeout ?? 60}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value > 0) {
                onChange({
                  ...currentConfig,
                  options: { ...currentConfig.options, timeout: value }
                });
              }
            }}
          />
        </div>
      </details>

      {onTestConnection && (
        <div className="test-connection">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing' || !currentConfig.apiKey}
            className={`test-button ${testStatus}`}
          >
            {testStatus === 'testing' ? t('settings.llm.testing') :
             testStatus === 'success' ? `✓ ${t('settings.llm.connected')}` :
             testStatus === 'error' ? `✗ ${t('settings.llm.failed')}` : t('settings.llm.testConnection')}
          </button>
          {testError && <p className="error-text">{testError}</p>}
        </div>
      )}
    </div>
  );
}

export default LLMSettings;
