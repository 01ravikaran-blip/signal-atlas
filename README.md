# Signal Atlas 🌐📊

**Signal Atlas** is an autonomous, evidence-first global financial, crypto, DeFi, AI, Web3, stock market, and macro news publishing system.

---

## 🚀 LLM Integration (Groq API)

Signal Atlas uses the **Groq API** as its high-speed, high-quality LLM engine.

### Active Models & Tiered Fallback
- **Primary Model**: `llama-3.3-70b-versatile` (Highest quality for deep market analysis, structured updates, and multi-part thread drafting)
- **Fallback Model**: `mixtral-8x7b-32768` (Balanced throughput and high contextual reasoning)
- **Speed Fallback**: `gemma2-9b-it` (Fastest, low-cost execution for high-frequency processing)

### Modular Provider Support
While Groq is the default primary provider, Signal Atlas maintains modular compatibility for legacy local setups:
- `LLM_PROVIDER=groq` (Default)
- `LLM_PROVIDER=ollama` (Local model fallback)

---

## 🛠️ Environment Configuration

Set up your `.env` file in the root directory:

```env
# SIGNAL ATLAS CONFIGURATION
DEMO_MODE=false
PORT=5050
CLIENT_PORT=3000
EMERGENCY_PAUSE=false

# GROQ API CONFIGURATION
GROQ_API_KEY=gsk_...
LLM_PROVIDER=groq
AI_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile

# CONTENT MIX RATIOS
PUBLISH_INTERVAL_MINUTES=5
CRYPTO_DEFI_PERCENT=50
AI_WEB3_PERCENT=25
STOCKS_MACRO_PERCENT=25
MIN_CONFIDENCE_THRESHOLD=0.70

# PLATFORM CREDENTIALS
BLUESKY_HANDLE=signalatlas.bsky.social
BLUESKY_APP_PASSWORD=...
FARCASTER_NEYNAR_API_KEY=...
FARCASTER_SIGNER_UUID=...
DISCORD_WEBHOOK_URL=...
TELEGRAM_BOT_TOKEN=...
```

---

## ⚡ Key Architecture & Features

1. **Multi-Agent Roles**: 11 specialized agent roles (news collector, market analyst, source verifier, trend scorer, post writer, thread writer, critic/editor, safety checker, platform formatter, publication manager, analytics summarizer).
2. **Structured JSON Generation & Repair**: Automated JSON syntax repair & retry logic for robust payload parsing.
3. **Cost & Token Tracking**: Real-time logging of prompt, completion, and total daily token usage along with USD cost estimates.
4. **Safety & Quality Gates**: 11 strict content quality checks, rumor filters, financial advice warnings, and block vault audit logs.
5. **Multi-Platform Autonomous Publishing**: Real-time distribution across Bluesky, Farcaster, Telegram, and Discord.

---

## 🧪 Testing & Verification

Run the comprehensive 17-point test suite and Groq integration test runner:

```bash
# Run full test suite
npm test

# Build production client and server
npm run build
```
