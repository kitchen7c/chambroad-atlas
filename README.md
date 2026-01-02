<div align="center">

# Chambroad Atlas

AI-powered browser automation tool with intelligent capabilities.

</div>

## Features

- **Browser Tools Mode**: Gemini 2.5 Computer Use for visual browser automation with screenshots, clicks, typing, scrolling, and navigation
- **Multi-Provider LLM Support**: Configure Google Gemini, OpenAI, Anthropic Claude, Ollama, or custom API endpoints
- **Sidebar Chat Interface**: Clean, modern React-based chat UI accessible from any tab
- **Direct Browser Automation**: No backend required - all API calls made directly from extension
- **Visual Feedback**: Blue click indicators and element highlighting during automation
- **Safety Features**: Confirmation dialogs for sensitive actions (checkout, payment, etc.)
- **Multi-language Support**: Chinese and English with auto-detection

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Chrome or Edge browser (Manifest V3 support)
- Google API key for Gemini (or other supported LLM provider)

### Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `dist` folder
   - Open Settings (⚙️ icon) to configure your API keys

### Running the Electron Browser

The project includes a standalone Electron-based browser application with built-in Atlas capabilities.

1. Build the Electron app:
```bash
cd electron-browser
npm install
npm run build
```

2. Start the Electron browser:
```bash
npm run start
```

3. Or, run in development mode with hot reload:
```bash
npm run dev
```

### Configuration

#### LLM Setup

Open Settings (⚙️ icon) to configure your LLM provider:

1. **Google Gemini** (Default)
   - Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Supports: Gemini 2.5 Pro, Flash, and Flash Lite

2. **OpenAI**
   - Get your key from [OpenAI Dashboard](https://platform.openai.com/api-keys)
   - Supports: GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo

3. **Anthropic Claude**
   - Get your key from [Anthropic Console](https://console.anthropic.com/)
   - Supports: Claude 3 Opus, Sonnet, Haiku

4. **Ollama (Local)**
   - Run locally at http://localhost:11434
   - Supports: Llama 3, Mistral, CodeLlama, etc.

5. **Custom API**
   - Configure any OpenAI-compatible API endpoint

### Development

Run with hot reload:
```bash
npm run dev
```

Then reload the extension in Chrome after each change.

## Documentation

- **[FAQ](./FAQ.md)** - Frequently asked questions and quick troubleshooting
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Detailed troubleshooting guide for common issues

## License

MIT
