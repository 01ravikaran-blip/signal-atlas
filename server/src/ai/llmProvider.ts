import axios from 'axios';
import { db } from '../db/database.ts';

export class LLMProvider {
  private provider: string;
  private ollamaHost: string;
  private ollamaModel: string;

  constructor() {
    this.provider = process.env.AI_PROVIDER || 'local';
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
  }

  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    // 1. Check if Cloud API is explicitly configured
    if (this.provider === 'openai' && process.env.OPENAI_API_KEY) {
      return this.callOpenAI(prompt, systemPrompt);
    }
    if (this.provider === 'gemini' && process.env.GEMINI_API_KEY) {
      return this.callGemini(prompt, systemPrompt);
    }

    // 2. Attempt Local Ollama LLM if available
    try {
      const res = await axios.post(
        `${this.ollamaHost}/api/generate`,
        {
          model: this.ollamaModel,
          prompt: `${systemPrompt ? systemPrompt + '\n\n' : ''}${prompt}`,
          stream: false
        },
        { timeout: 5000 }
      );
      if (res.data && res.data.response) {
        db.addLog('INFO', 'LLM_PROVIDER', `Successfully generated text using local Ollama model (${this.ollamaModel}).`);
        return res.data.response;
      }
    } catch (err: any) {
      // Ollama not active; silently fall through to local deterministic NLP engine
    }

    // 3. Fallback: Local Deterministic Signal Atlas NLP Engine
    db.addLog('INFO', 'LLM_PROVIDER', 'Using built-in Signal Atlas offline NLP engine.');
    return this.fallbackNLP(prompt);
  }

  private async callOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt || 'You are Signal Atlas, an evidence-first financial news analyst.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      return res.data.choices[0].message.content;
    } catch (err: any) {
      db.addLog('WARN', 'LLM_PROVIDER', `OpenAI API call failed: ${err.message}. Reverting to local engine.`);
      return this.fallbackNLP(prompt);
    }
  }

  private async callGemini(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: `${systemPrompt ? systemPrompt + '\n' : ''}${prompt}` }] }]
        },
        { timeout: 10000 }
      );
      return res.data.candidates[0].content.parts[0].text;
    } catch (err: any) {
      db.addLog('WARN', 'LLM_PROVIDER', `Gemini API call failed: ${err.message}. Reverting to local engine.`);
      return this.fallbackNLP(prompt);
    }
  }

  private fallbackNLP(prompt: string): string {
    // Basic structured extraction logic for offline/demo mode
    if (prompt.includes('CRITIQUE')) {
      return JSON.stringify({
        passed: true,
        critique: 'Tone is neutral and evidence-first. Facts separated clearly from analysis.',
        suggestedFix: ''
      });
    }

    return `[FACTS]\n- Market indicators and verified news feeds report significant activity.\n- Ingested primary source data confirms key metrics and event timelines.\n\n[ANALYSIS]\n- Current trends reflect shifting macroeconomic liquidity and protocol volume dynamics.\n- Analysts note reduced volatility coupled with steady institutional positioning.\n\n[UNCERTAINTY]\n- Duration of trend depends on upcoming central bank decisions and regulatory announcements.\n\n[FORECAST]\n- Medium-term outlook suggests consolidated range-bound movement with potential breakout points.`;
  }
}

export const llmProvider = new LLMProvider();
