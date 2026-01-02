# Frequently Asked Questions (FAQ)

## Q: Stream API is not responding when using a proxy?

**A:** The extension has been updated to be compatible with proxy environments. If you encounter issues:
1. Make sure you're using the latest version
2. Check browser console for error messages (F12 → Console tab)
3. Try refreshing the extension (chrome://extensions → Reload)
4. Recommended proxies: mihomo/Clash, V2Ray with US nodes (Los Angeles, New York)

---

## Q: Browser Tools shows "Quota exceeded" error?

**A:** This is NOT a quota issue! This error means your API key doesn't have access to Computer Use models.

**Why this happens:**
- Browser Tools requires `gemini-2.5-computer-use-preview` model
- This is an experimental Google feature with limited access
- Most free API keys don't have this permission yet

**What you can do:**
1. **Wait for Google to open access**:
   - Computer Use is in preview/experimental phase
   - Expected to be available to more users in 2025

2. **Use regular chat features**:
   - AI conversations work normally
   - Browser history search works
   - All features except Browser Tools are available

---

## Q: How to use this extension in mainland China?

**A:** You need a proxy to access Google APIs:

**Recommended setup:**
- Proxy software: mihomo/Clash, V2Ray
- Recommended nodes: US West Coast (Los Angeles), US East Coast (New York), Japan (Tokyo)
- Protocol: Ensure HTTP/HTTPS proxy is enabled

**Testing your connection:**
- Visit: https://generativelanguage.googleapis.com/
- Should not show connection error

---

## Q: What LLM providers are supported?

**A:** Atlas supports multiple providers:

1. **Google Gemini** (Default)
   - Gemini 2.5 Pro, Flash, Flash Lite
   - Required for Browser Tools mode

2. **OpenAI**
   - GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo

3. **Anthropic Claude**
   - Claude 3 Opus, Sonnet, Haiku

4. **Ollama (Local)**
   - Run models locally
   - Llama 3, Mistral, CodeLlama, etc.

5. **Custom API**
   - Any OpenAI-compatible endpoint

---

## Q: Why does my API key work in Google AI Studio but not here?

**A:** Check these possibilities:

1. **Network issue**: Extension can't reach Google API
   - Solution: Use proxy, check firewall settings

2. **Different quota limits**: Extension and AI Studio may have separate rate limits
   - Solution: Wait for quota reset (daily at UTC 00:00)

3. **Stream API vs regular API**: Extension uses streaming which may have different behavior
   - Solution: Check browser console for specific errors

---

## Q: Is my API key secure?

**A:** Yes, your API keys are stored locally:
- Saved in Chrome's local storage
- Never sent to any third-party servers
- Only used to communicate directly with LLM provider APIs
- You can verify by checking the code (open source)

---

## Q: Where can I get help?

**A:** Multiple options:

1. **GitHub Issues**: https://github.com/ComposioHQ/open-chatgpt-atlas/issues
2. **Check TROUBLESHOOTING.md** for detailed diagnostic steps
3. **Browser Console**: Press F12 → Console tab for error details

---

## 🔧 Quick Troubleshooting

**Extension loads but shows no response:**
- Check API key is configured in Settings
- Check network connection (proxy if needed)
- Look at browser console for errors

**"Failed to fetch" error:**
- Network connectivity issue
- Try different proxy node
- Check if LLM API is accessible

**Computer Use features not working:**
- This is expected - requires special model access
- Use regular chat mode instead

---

**For more detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
