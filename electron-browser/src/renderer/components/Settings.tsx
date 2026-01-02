import { useState } from 'react';
import type { Settings as SettingsType } from '../types';

interface SettingsProps {
  settings: SettingsType | null;
  onSave: (settings: SettingsType) => void;
  onClose: () => void;
}

const Settings = ({ settings, onSave, onClose }: SettingsProps) => {
  const [googleApiKey, setGoogleApiKey] = useState(settings?.googleApiKey || '');
  const [model, setModel] = useState(settings?.model || 'gemini-2.0-flash-exp');

  const handleSave = async () => {
    onSave({
      googleApiKey,
      model,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Settings</h1>
        <button
          onClick={onClose}
          style={{
            padding: '6px 14px',
            backgroundColor: '#f5f5f5',
            color: '#1a1a1a',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Close
        </button>
      </div>

      {/* Settings Form */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Google API Key */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600 }}>
              Google API Key <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="password"
              value={googleApiKey}
              onChange={(e) => setGoogleApiKey(e.target.value)}
              placeholder="Enter your Google API key"
              style={{
                padding: '10px 12px',
                backgroundColor: '#f5f5f5',
                color: '#1a1a1a',
                border: '1px solid #e5e5e5',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
              Required for Gemini models. Get your key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb' }}
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600 }}>Gemini Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                padding: '10px 12px',
                backgroundColor: '#f5f5f5',
                color: '#1a1a1a',
                border: '1px solid #e5e5e5',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Experimental)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
            </select>
            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
              Recommended: Gemini 2.0 Flash for best performance
            </p>
          </div>

          {/* Info Section */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              borderLeft: '3px solid #2563eb',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              About Atlas Browser
            </h3>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.6', margin: 0 }}>
              Atlas Browser provides two modes:
              <br />
              <br />
              <strong>Chat Mode:</strong> AI assistant for general conversation and help.
              <br />
              <br />
              <strong>Web Mode:</strong> Browser automation powered by Gemini Computer Use for
              visual web interaction (screenshots, clicks, typing, navigation)
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div
        style={{
          padding: '20px',
          borderTop: '1px solid #e5e5e5',
          backgroundColor: '#ffffff',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <button
            onClick={handleSave}
            disabled={!googleApiKey}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: googleApiKey ? '#1a1a1a' : '#f5f5f5',
              color: googleApiKey ? '#ffffff' : '#999',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
