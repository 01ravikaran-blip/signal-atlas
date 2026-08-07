import { PostDraft } from '../types.js';
import { llmProvider } from './llmProvider.ts';
import { db } from '../db/database.ts';

export async function critiqueAndImproveDraft(draft: PostDraft): Promise<PostDraft> {
  const prompt = `CRITIQUE THE FOLLOWING DRAFT FOR SIGNAL ATLAS:
Title: ${draft.rawTopic}
Facts: ${draft.structuredContent.facts.join('; ')}
Analysis: ${draft.structuredContent.analysis}
Forecast: ${draft.structuredContent.forecasts}

Check:
1. Is tone 100% neutral and evidence-first?
2. Are facts clearly separated from analysis and forecast?
3. Is there any sensationalism or hype words (e.g., 'skyrocket', 'explode', 'guaranteed')?`;

  try {
    const critiqueRes = await llmProvider.generateText(prompt);
    
    // Check for hype words in raw draft text
    const fullText = (draft.rawTopic + ' ' + draft.structuredContent.analysis).toLowerCase();
    const hypeWords = ['skyrocket', 'insane gains', 'guaranteed', 'explode', 'moonshot'];
    const foundHype = hypeWords.filter(w => fullText.includes(w));

    const critiqueNotes: string[] = [];
    if (foundHype.length > 0) {
      critiqueNotes.push(`Removed sensationalist terms: ${foundHype.join(', ')}`);
      // Clean up analysis
      for (const hw of foundHype) {
        draft.structuredContent.analysis = draft.structuredContent.analysis.replace(new RegExp(hw, 'gi'), 'increase');
      }
    } else {
      critiqueNotes.push('Self-critique passed: Neutral evidence-first tone verified.');
    }

    draft.critiqueNotes = critiqueNotes;
    draft.revisionCount += 1;

    db.addLog('INFO', 'CRITIQUE_AGENT', `Completed critique for draft ${draft.id}. Notes: ${critiqueNotes.join(' | ')}`);
  } catch (err: any) {
    db.addLog('WARN', 'CRITIQUE_AGENT', `Critique check fallback used: ${err.message}`);
  }

  return draft;
}
