import { GoogleGenAI } from '@google/genai';

/**
 * Generates a 768-dim embedding for a text input using Gemini
 * text-embedding-004. Dimension must match the pgvector column — do not
 * switch models without re-embedding every row.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: [{ role: 'user', parts: [{ text }] }],
  });
  const emb = res.embeddings?.[0]?.values;
  if (!emb || emb.length !== 768) {
    throw new Error(`Embedding returned ${emb?.length ?? 0} dims, expected 768`);
  }
  return emb;
}

export async function contentHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Buffer.from(buf).toString('hex');
}
