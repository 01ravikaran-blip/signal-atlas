import axios from 'axios';
import Groq from 'groq-sdk';
import { db } from '../db/database.ts';
import { AiStatusReport, TokenUsageStats, AgentRole } from '../types.js';

export const GROQ_MODELS = {
  PRIMARY: 'llama-3.3-70b-versatile',
  FALLBACK: 'mixtral-8x7b-32768',
  SPEED_FALLBACK: 'gemma2-9b-it'
} as const;

// Token cost estimates per 1,000,000 tokens (USD)
const MODEL_PRICING = {
  [GROQ_MODELS.PRIMARY]: { prompt: 0.59, completion: 0.79 },
  [GROQ_MODELS.FALLBACK]: { prompt: 0.24, completion: 0.24 },
  [GROQ_MODELS.SPEED_FALLBACK]: { prompt: 0.07, completion: 0.07 }
};

export interface GenerateOptions {
  modelTier?: 'primary' | 'fallback' | 'speed_fallback';
  temperature?: number;
  maxTokens?: number;
  agentRole?: AgentRole;
  repairAttempts?: number;
}

export class LLMProvider {
  private groqApiKey?: string;
  private groqClient?: Groq;
  private primaryModel: string;
  private fallbackModel: string;
  private speedFallbackModel: string;
  
  private ollamaBaseUrl: string;
  private ollamaModel: string;
  
  private cloudApiKey?: string;
  private cloudBaseUrl: string;
  private cloudModel: string;

  private lastStatus: AiStatusReport;
  private fallbackEventsCount = 0;

  private tokenStats: TokenUsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    dailyPromptTokens: 0,
    dailyCompletionTokens: 0,
    dailyTotalTokens: 0,
    dailyRequestCount: 0,
    estimatedDailyCostUsd: 0
  };

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.primaryModel = process.env.LLM_MODEL || process.env.GROQ_MODEL || GROQ_MODELS.PRIMARY;
    this.fallbackModel = GROQ_MODELS.FALLBACK;
    this.speedFallbackModel = GROQ_MODELS.SPEED_FALLBACK;

    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';

    this.cloudApiKey = process.env.CLOUD_LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    this.cloudBaseUrl = process.env.CLOUD_LLM_BASE_URL || 'https://api.openai.com/v1';
    this.cloudModel = process.env.CLOUD_LLM_MODEL || 'gpt-4o-mini';

    if (this.groqApiKey) {
      try {
        this.groqClient = new Groq({ apiKey: this.groqApiKey });
      } catch (err: any) {
        db.addLog('ERROR', 'AI_PROVIDER', `Failed to initialize Groq client: ${err.message}`);
      }
    }

    this.lastStatus = {
      provider: this.resolveProviderType(),
      model: this.resolveModelName(),
      reachability: 'unknown',
      fallbackEnabled: !this.isProduction,
      tokenUsage: { ...this.tokenStats },
      fallbackEventsCount: 0,
      activeModelTier: 'primary',
      modelsAvailable: {
        primary: this.primaryModel,
        fallback: this.fallbackModel,
        speedFallback: this.speedFallbackModel
      }
    };
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || process.env.IS_PROD_TEST === 'true';
  }

  public resolveProviderType(): 'groq' | 'cloud' | 'ollama' | 'demo' {
    const providerEnv = (process.env.LLM_PROVIDER || process.env.AI_PROVIDER || 'groq').toLowerCase();

    if (providerEnv === 'groq' || (providerEnv === 'auto' && (this.groqApiKey || process.env.GROQ_API_KEY))) {
      return 'groq';
    }
    if (providerEnv === 'ollama' || providerEnv === 'local') {
      return 'ollama';
    }
    if (providerEnv === 'cloud' || providerEnv === 'openai' || providerEnv === 'gemini') {
      return 'cloud';
    }
    if (this.groqApiKey || process.env.GROQ_API_KEY) {
      return 'groq';
    }
    if (this.cloudApiKey) {
      return 'cloud';
    }
    if (!this.isProduction && providerEnv === 'ollama') {
      return 'ollama';
    }
    return 'demo';
  }

  public resolveModelName(): string {
    const type = this.resolveProviderType();
    if (type === 'groq') return this.primaryModel;
    if (type === 'cloud') return this.cloudModel;
    if (type === 'ollama') return this.ollamaModel;
    return 'signal-atlas-nlp-demo';
  }

  public validateEnvironmentConfig(): { valid: boolean; message: string } {
    const provider = this.resolveProviderType();

    if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY || this.groqApiKey;
      if (!apiKey) {
        return {
          valid: false,
          message: '[AI_CONFIG_ERROR] GROQ_API_KEY environment variable is missing for groq provider.'
        };
      }
      return { valid: true, message: `Groq configured with model ${this.primaryModel}.` };
    }

    if (provider === 'ollama') {
      const host = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || this.ollamaBaseUrl;
      const model = process.env.OLLAMA_MODEL || this.ollamaModel;
      if (!host || !model) {
        return {
          valid: false,
          message: '[AI_CONFIG_ERROR] OLLAMA_HOST or OLLAMA_MODEL environment variable missing for ollama provider.'
        };
      }
      return { valid: true, message: `Ollama configured at ${host} with model ${model}.` };
    }

    if (provider === 'cloud') {
      if (!this.cloudApiKey) {
        return {
          valid: false,
          message: '[AI_CONFIG_ERROR] CLOUD_LLM_API_KEY / OPENAI_API_KEY missing for cloud provider.'
        };
      }
      return { valid: true, message: `Cloud LLM configured with model ${this.cloudModel}.` };
    }

    return { valid: true, message: 'Running in built-in demo NLP engine mode.' };
  }

  public async checkReachability(): Promise<AiStatusReport> {
    const type = this.resolveProviderType();
    const startTime = Date.now();

    if (type === 'groq') {
      const apiKey = process.env.GROQ_API_KEY || this.groqApiKey;
      if (!apiKey) {
        this.lastStatus = {
          provider: 'groq',
          model: this.primaryModel,
          reachability: 'unreachable',
          fallbackEnabled: !this.isProduction,
          lastError: 'Missing GROQ_API_KEY in environment',
          tokenUsage: { ...this.tokenStats },
          fallbackEventsCount: this.fallbackEventsCount,
          activeModelTier: 'primary',
          modelsAvailable: {
            primary: this.primaryModel,
            fallback: this.fallbackModel,
            speedFallback: this.speedFallbackModel
          }
        };
        return this.lastStatus;
      }

      try {
        if (!this.groqClient) {
          this.groqClient = new Groq({ apiKey });
        }
        // Lightweight probe to verify API key validity
        await this.groqClient.models.list();
        const latency = Date.now() - startTime;

        this.lastStatus = {
          provider: 'groq',
          model: this.primaryModel,
          reachability: 'reachable',
          fallbackEnabled: !this.isProduction,
          lastLatencyMs: latency,
          tokenUsage: { ...this.tokenStats },
          fallbackEventsCount: this.fallbackEventsCount,
          activeModelTier: 'primary',
          modelsAvailable: {
            primary: this.primaryModel,
            fallback: this.fallbackModel,
            speedFallback: this.speedFallbackModel
          }
        };
      } catch (err: any) {
        this.lastStatus = {
          provider: 'groq',
          model: this.primaryModel,
          reachability: 'unreachable',
          fallbackEnabled: !this.isProduction,
          lastError: err.message,
          tokenUsage: { ...this.tokenStats },
          fallbackEventsCount: this.fallbackEventsCount,
          activeModelTier: 'primary',
          modelsAvailable: {
            primary: this.primaryModel,
            fallback: this.fallbackModel,
            speedFallback: this.speedFallbackModel
          }
        };
      }
      return this.lastStatus;
    }

    if (type === 'cloud') {
      if (!this.cloudApiKey) {
        this.lastStatus = {
          provider: 'cloud',
          model: this.cloudModel,
          reachability: 'unreachable',
          fallbackEnabled: !this.isProduction,
          lastError: 'Missing CLOUD_LLM_API_KEY in environment',
          tokenUsage: { ...this.tokenStats }
        };
        return this.lastStatus;
      }
      this.lastStatus = {
        provider: 'cloud',
        model: this.cloudModel,
        reachability: 'reachable',
        fallbackEnabled: !this.isProduction,
        lastLatencyMs: Date.now() - startTime,
        tokenUsage: { ...this.tokenStats }
      };
      return this.lastStatus;
    }

    if (type === 'ollama') {
      const currentOllamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || this.ollamaBaseUrl;
      if (this.isProduction && (currentOllamaUrl.includes('localhost') || currentOllamaUrl.includes('127.0.0.1'))) {
        this.lastStatus = {
          provider: 'ollama',
          model: this.ollamaModel,
          reachability: 'unreachable',
          fallbackEnabled: false,
          lastError: 'Rejected localhost Ollama in production environment',
          tokenUsage: { ...this.tokenStats }
        };
        return this.lastStatus;
      }

      try {
        await axios.get(`${this.ollamaBaseUrl}/api/tags`, { timeout: 2000 });
        this.lastStatus = {
          provider: 'ollama',
          model: this.ollamaModel,
          reachability: 'reachable',
          fallbackEnabled: !this.isProduction,
          lastLatencyMs: Date.now() - startTime,
          tokenUsage: { ...this.tokenStats }
        };
      } catch (err: any) {
        this.lastStatus = {
          provider: 'ollama',
          model: this.ollamaModel,
          reachability: 'unreachable',
          fallbackEnabled: !this.isProduction,
          lastError: err.message,
          tokenUsage: { ...this.tokenStats }
        };
      }
      return this.lastStatus;
    }

    // Demo mode
    this.lastStatus = {
      provider: 'demo',
      model: 'signal-atlas-nlp-demo',
      reachability: 'reachable',
      fallbackEnabled: true,
      tokenUsage: { ...this.tokenStats }
    };
    return this.lastStatus;
  }

  public logStartupStatus(): void {
    const validation = this.validateEnvironmentConfig();
    const provider = this.resolveProviderType();
    const model = this.resolveModelName();
    const reachability = (this.groqApiKey || this.cloudApiKey || provider === 'demo') ? 'reachable' : 'unreachable';
    const fallback = !this.isProduction ? 'enabled' : 'disabled';

    console.log(`=================================================`);
    console.log(`🤖 GROQ / SIGNAL ATLAS AI ENGINE INITIALIZED`);
    console.log(`📡 AI Provider: ${provider.toUpperCase()}`);
    console.log(`🧠 Primary Model: ${model}`);
    console.log(`⚡ Speed Fallback: ${GROQ_MODELS.SPEED_FALLBACK}`);
    console.log(`🛡️ Fallback Strategy: ${fallback}`);
    console.log(`📋 Status: ${validation.message}`);
    console.log(`=================================================`);

    db.addLog('INFO', 'AI_PROVIDER', `AI Provider initialized (${provider}) with primary model: ${model}. Status: ${validation.message}`);
  }

  /**
   * Primary text generation with retry and multi-tier model fallback hierarchy
   */
  public async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    const providerType = this.resolveProviderType();

    if (providerType === 'groq') {
      return this.callGroqWithFallback(prompt, systemPrompt, options);
    }

    if (providerType === 'cloud') {
      if (!this.cloudApiKey) {
        const errMsg = '[AI_PROVIDER] Production requires CLOUD_LLM_API_KEY. Cloud AI API key is missing.';
        db.addLog('ERROR', 'AI_PROVIDER', errMsg);
        if (this.isProduction) throw new Error(errMsg);
        return this.fallbackNLP(prompt);
      }
      return this.callCloudWithRetry(prompt, systemPrompt);
    }

    if (providerType === 'ollama') {
      return this.callOllama(prompt, systemPrompt);
    }

    // Demo Mode
    if (this.isProduction) {
      throw new Error('[AI_PROVIDER] Production mode prohibits unverified offline demo fallback.');
    }
    db.addLog('INFO', 'AI_PROVIDER', 'Using built-in Signal Atlas offline NLP engine (Demo Mode).');
    return this.fallbackNLP(prompt);
  }

  /**
   * Execute structured JSON generation with invalid JSON repair & retry logic
   */
  public async generateJSON<T>(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<T> {
    const jsonSystemPrompt = `${systemPrompt ? systemPrompt + '\n\n' : ''}CRITICAL: You MUST respond strictly in valid JSON format. Do not include markdown code block markers (like \`\`\`json), comments, or introductory text. Respond ONLY with the JSON object.`;

    const repairAttempts = options?.repairAttempts ?? 2;
    let rawText = await this.generateText(prompt, jsonSystemPrompt, { ...options, temperature: 0.1 });

    for (let attempt = 0; attempt <= repairAttempts; attempt++) {
      try {
        const cleaned = this.cleanJsonString(rawText);
        const parsed = JSON.parse(cleaned);
        return parsed as T;
      } catch (err: any) {
        db.addLog('WARN', 'AI_PROVIDER', `JSON parse failed (attempt ${attempt + 1}/${repairAttempts + 1}): ${err.message}. Text preview: ${rawText.substring(0, 100)}`);
        
        if (attempt < repairAttempts) {
          // Trigger invalid JSON repair prompt
          const repairPrompt = `The following response failed to parse as valid JSON:\n\n${rawText}\n\nError: ${err.message}\n\nPlease repair and return strictly valid JSON for the original prompt: "${prompt.substring(0, 200)}"`;
          rawText = await this.generateText(repairPrompt, 'Fix the JSON syntax so it parses cleanly.', { ...options, temperature: 0.0 });
        } else {
          throw new Error(`Failed to parse valid JSON after ${repairAttempts + 1} attempts: ${err.message}`);
        }
      }
    }

    throw new Error('Failed to generate valid JSON output.');
  }

  /**
   * Stream response tokens for real-time dashboard UI
   */
  public async generateTextStream(
    prompt: string,
    onChunk: (text: string) => void,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY || this.groqApiKey;
    if (!apiKey) {
      const full = await this.generateText(prompt, systemPrompt, options);
      onChunk(full);
      return full;
    }

    if (!this.groqClient) {
      this.groqClient = new Groq({ apiKey });
    }

    const modelName = this.getModelForTier(options?.modelTier || 'primary');
    let accumulated = '';

    try {
      const stream = await this.groqClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt || 'You are Signal Atlas, an evidence-first financial news analyst.' },
          { role: 'user', content: prompt }
        ],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1500,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          accumulated += content;
          onChunk(content);
        }
      }
      return accumulated;
    } catch (err: any) {
      db.addLog('WARN', 'AI_PROVIDER', `Streaming failed on ${modelName}, falling back to standard completion: ${err.message}`);
      const full = await this.generateText(prompt, systemPrompt, options);
      onChunk(full);
      return full;
    }
  }

  /**
   * Groq multi-tier call logic: Primary (Llama-3.3-70b) -> Fallback (Mixtral-8x7b) -> Speed (Gemma2-9b)
   */
  private async callGroqWithFallback(
    prompt: string,
    systemPrompt?: string,
    options?: GenerateOptions
  ): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY || this.groqApiKey;
    if (!apiKey) {
      const errMsg = '[AI_PROVIDER] Missing GROQ_API_KEY environment variable.';
      db.addLog('ERROR', 'AI_PROVIDER', errMsg);
      if (this.isProduction) throw new Error(errMsg);
      return this.fallbackNLP(prompt);
    }

    if (!this.groqClient) {
      this.groqClient = new Groq({ apiKey });
    }

    const modelsToTry = [
      { name: this.primaryModel, tier: 'primary' as const },
      { name: this.fallbackModel, tier: 'fallback' as const },
      { name: this.speedFallbackModel, tier: 'speed_fallback' as const }
    ];

    // If specific model tier requested, put it first
    if (options?.modelTier === 'fallback') {
      modelsToTry.unshift(modelsToTry.splice(1, 1)[0]);
    } else if (options?.modelTier === 'speed_fallback') {
      modelsToTry.unshift(modelsToTry.splice(2, 1)[0]);
    }

    let lastError: any = null;

    for (const { name: modelName, tier } of modelsToTry) {
      const maxRetries = 2;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const startTime = Date.now();
          const response = await this.groqClient.chat.completions.create({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt || this.getSystemPromptForRole(options?.agentRole) },
              { role: 'user', content: prompt }
            ],
            temperature: options?.temperature ?? this.getDefaultTempForRole(options?.agentRole),
            max_tokens: options?.maxTokens ?? 2048
          });

          const content = response.choices[0]?.message?.content || '';
          const latency = Date.now() - startTime;

          // Track tokens and cost
          const promptTokens = response.usage?.prompt_tokens || Math.ceil(prompt.length / 4);
          const completionTokens = response.usage?.completion_tokens || Math.ceil(content.length / 4);
          this.recordTokenUsage(promptTokens, completionTokens, modelName);

          this.lastStatus = {
            provider: 'groq',
            model: modelName,
            reachability: 'reachable',
            fallbackEnabled: !this.isProduction,
            lastLatencyMs: latency,
            tokenUsage: { ...this.tokenStats },
            fallbackEventsCount: this.fallbackEventsCount,
            activeModelTier: tier,
            modelsAvailable: {
              primary: this.primaryModel,
              fallback: this.fallbackModel,
              speedFallback: this.speedFallbackModel
            }
          };

          db.addLog('SUCCESS', 'AI_PROVIDER', `Generated completion via Groq model ${modelName} (${tier}) in ${latency}ms [tokens: ${promptTokens}+${completionTokens}].`);
          return content;
        } catch (err: any) {
          lastError = err;
          db.addLog('WARN', 'AI_PROVIDER', `Groq request on ${modelName} (attempt ${attempt}/${maxRetries}) failed: ${err.message}`);

          // Rate limit handling (429)
          if (err.status === 429 || err.message?.includes('rate limit')) {
            db.addLog('WARN', 'AI_PROVIDER', `Rate limit hit on Groq (${modelName}). Backing off.`);
            await new Promise(res => setTimeout(res, 2000 * attempt));
          } else if (attempt < maxRetries) {
            await new Promise(res => setTimeout(res, 1000 * attempt));
          }
        }
      }

      // Record fallback event when switching models
      this.fallbackEventsCount++;
      db.addLog('WARN', 'AI_PROVIDER', `Falling back from model ${modelName} to next model tier.`);
    }

    this.lastStatus = {
      provider: 'groq',
      model: this.primaryModel,
      reachability: 'unreachable',
      fallbackEnabled: !this.isProduction,
      lastError: lastError?.message || 'All Groq models failed',
      tokenUsage: { ...this.tokenStats },
      fallbackEventsCount: this.fallbackEventsCount,
      activeModelTier: 'offline'
    };

    if (this.isProduction) {
      throw new Error(`All Groq API models failed execution: ${lastError?.message}`);
    }

    db.addLog('WARN', 'AI_PROVIDER', 'All Groq models failed; falling back to offline demo NLP engine.');
    return this.fallbackNLP(prompt);
  }

  private async callOllama(prompt: string, systemPrompt?: string): Promise<string> {
    const currentOllamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || this.ollamaBaseUrl;
    if (this.isProduction && (currentOllamaUrl.includes('localhost') || currentOllamaUrl.includes('127.0.0.1'))) {
      const errMsg = '[AI_PROVIDER] Production rejected localhost Ollama URL.';
      db.addLog('ERROR', 'AI_PROVIDER', errMsg);
      if (this.isProduction) throw new Error(errMsg);
      return this.fallbackNLP(prompt);
    }

    try {
      const res = await axios.post(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          model: this.ollamaModel,
          prompt: `${systemPrompt ? systemPrompt + '\n\n' : ''}${prompt}`,
          stream: false
        },
        { timeout: 8000 }
      );
      if (res.data && res.data.response) {
        db.addLog('INFO', 'AI_PROVIDER', `Generated text using local Ollama model (${this.ollamaModel}).`);
        return res.data.response;
      }
    } catch (err: any) {
      db.addLog('WARN', 'AI_PROVIDER', `Ollama request failed: ${err.message}`);
      if (this.isProduction) throw new Error(`Ollama process unavailable: ${err.message}`);
    }

    return this.fallbackNLP(prompt);
  }

  private async callCloudWithRetry(prompt: string, systemPrompt?: string, maxAttempts = 3): Promise<string> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const res = await axios.post(
          `${this.cloudBaseUrl}/chat/completions`,
          {
            model: this.cloudModel,
            messages: [
              { role: 'system', content: systemPrompt || 'You are Signal Atlas, an evidence-first financial news analyst.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          },
          {
            headers: { 'Authorization': `Bearer ${this.cloudApiKey}`, 'Content-Type': 'application/json' },
            timeout: 15000
          }
        );
        const latency = Date.now() - startTime;
        this.lastStatus = {
          provider: 'cloud',
          model: this.cloudModel,
          reachability: 'reachable',
          fallbackEnabled: !this.isProduction,
          lastLatencyMs: latency
        };
        return res.data.choices[0].message.content;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    if (this.isProduction) throw new Error(`Cloud LLM failed: ${lastError?.message}`);
    return this.fallbackNLP(prompt);
  }

  private recordTokenUsage(promptTokens: number, completionTokens: number, modelName: string) {
    const total = promptTokens + completionTokens;
    this.tokenStats.promptTokens += promptTokens;
    this.tokenStats.completionTokens += completionTokens;
    this.tokenStats.totalTokens += total;

    this.tokenStats.dailyPromptTokens += promptTokens;
    this.tokenStats.dailyCompletionTokens += completionTokens;
    this.tokenStats.dailyTotalTokens += total;
    this.tokenStats.dailyRequestCount += 1;

    // Calculate estimated USD cost
    const pricing = MODEL_PRICING[modelName as keyof typeof MODEL_PRICING] || MODEL_PRICING[GROQ_MODELS.PRIMARY];
    const costPrompt = (promptTokens / 1_000_000) * pricing.prompt;
    const costCompletion = (completionTokens / 1_000_000) * pricing.completion;
    this.tokenStats.estimatedDailyCostUsd += (costPrompt + costCompletion);

    // Warning for free tier threshold (14,400 requests/day or high token consumption)
    if (this.tokenStats.dailyRequestCount >= 10000) {
      db.addLog('WARN', 'AI_PROVIDER', `[RATE_LIMIT_WARNING] Approaching daily free-tier request limit (${this.tokenStats.dailyRequestCount}/14400 requests).`);
    }
  }

  private getModelForTier(tier: 'primary' | 'fallback' | 'speed_fallback'): string {
    if (tier === 'fallback') return this.fallbackModel;
    if (tier === 'speed_fallback') return this.speedFallbackModel;
    return this.primaryModel;
  }

  private getDefaultTempForRole(role?: AgentRole): number {
    switch (role) {
      case 'source_verifier':
      case 'safety_checker':
      case 'critic_editor':
        return 0.1;
      case 'news_collector':
      case 'market_analyst':
      case 'trend_scorer':
      case 'analytics_summarizer':
        return 0.2;
      case 'post_writer':
      case 'thread_writer':
      case 'platform_formatter':
      case 'publication_manager':
      default:
        return 0.3;
    }
  }

  private getSystemPromptForRole(role?: AgentRole): string {
    switch (role) {
      case 'news_collector':
        return 'You are the Signal Atlas News Collector agent. Identify high-impact signal, strip hype, and extract core verifiable market claims.';
      case 'market_analyst':
        return 'You are the Signal Atlas Market Analyst agent. Synthesize cross-asset technical and macroeconomic data with institutional precision.';
      case 'source_verifier':
        return 'You are the Signal Atlas Source Verifier agent. Rigorously score source credibility, cross-validate claims, and detect unconfirmed rumors.';
      case 'trend_scorer':
        return 'You are the Signal Atlas Trend Scorer agent. Evaluate story impact, novelty, and velocity to calculate quantitative market scores.';
      case 'post_writer':
        return 'You are the Signal Atlas Post Writer agent. Generate objective, evidence-first market updates structured into FACTS, ANALYSIS, UNCERTAINTY, and FORECAST.';
      case 'thread_writer':
        return 'You are the Signal Atlas Thread Writer agent. Break complex developing market events into structured, highly informative multi-part threads.';
      case 'critic_editor':
        return 'You are the Signal Atlas Critic/Editor agent. Enforce strict tone compliance, eliminate sensationalism, and verify separation of facts from speculation.';
      case 'safety_checker':
        return 'You are the Signal Atlas Safety Checker agent. Audit content for regulatory risks, financial advice violations, fraud, and brand reputation protection.';
      case 'platform_formatter':
        return 'You are the Signal Atlas Platform Formatter agent. Tailor payloads for Bluesky, Farcaster, Telegram, and Discord following exact platform character limits and formatting rules.';
      case 'publication_manager':
        return 'You are the Signal Atlas Publication Manager agent. Schedule and coordinate autonomous content distribution across social channels.';
      case 'analytics_summarizer':
        return 'You are the Signal Atlas Analytics Summarizer agent. Analyze engagement performance, audience feedback, and post metrics to refine content strategy.';
      default:
        return 'You are Signal Atlas, an evidence-first financial news and market intelligence engine.';
    }
  }

  private cleanJsonString(raw: string): string {
    let clean = raw.trim();
    // Remove markdown codeblock wrapper if present
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    }
    return clean;
  }

  private fallbackNLP(prompt: string): string {
    if (prompt.includes('CRITIQUE')) {
      return JSON.stringify({
        passed: true,
        critique: 'Tone is neutral and evidence-first. Facts separated clearly from analysis.',
        suggestedFix: ''
      });
    }

    return `[FACTS]\n- Market indicators and verified news feeds report significant activity.\n- Ingested primary source data confirms key metrics and event timelines.\n\n[ANALYSIS]\n- Current trends reflect shifting macroeconomic liquidity and protocol volume dynamics.\n- Analysts note reduced volatility coupled with steady institutional positioning.\n\n[UNCERTAINTY]\n- Duration of trend depends on upcoming central bank decisions and regulatory announcements.\n\n[FORECAST]\n- Medium-term outlook suggests consolidated range-bound movement with potential breakout points.`;
  }

  public getStatus(): AiStatusReport {
    return this.lastStatus;
  }

  public getTokenStats(): TokenUsageStats {
    return { ...this.tokenStats };
  }
}

export const llmProvider = new LLMProvider();
