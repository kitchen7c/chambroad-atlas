<div align="center">

# Chambroad Atlas

AI-powered browser automation tool with intelligent tool routing.

</div>

## Features

- **Tool Router Mode**: Composio's intelligent tool routing for accessing Gmail, Slack, GitHub, and 500+ integrations
- **Browser Tools Mode**: Gemini 2.5 Computer Use for visual browser automation with screenshots, clicks, typing, scrolling, and navigation
- **Sidebar Chat Interface**: Clean, modern React-based chat UI accessible from any tab
- **Direct Browser Automation**: No backend required - all API calls made directly from extension
- **Visual Feedback**: Blue click indicators and element highlighting during automation
- **Safety Features**: Confirmation dialogs for sensitive actions (checkout, payment, etc.)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Chrome or Edge browser (Manifest V3 support)
- Google API key for Gemini (required)
- Composio API key (optional, for Tool Router mode)

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

#### Required Setup

1. **Google API Key** (Required)
   - Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Add it in Settings under "Google API Key"
   - Supports: Gemini 2.5 Pro, Flash, and Flash Lite

2. **Composio API Key** (Optional - for Tool Router mode)
   - Get your key from [Composio Dashboard](https://app.composio.dev/settings)
   - Add it in Settings under "Composio API Key"
   - Enables access to 500+ app integrations

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
