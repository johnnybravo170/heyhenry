/**
 * Generates a 768-dim embedding for a text input using Gemini
 * gemini-embedding-001 with Matryoshka truncation to 768 dims.
 * Dimension must match the pgvector column — do not switch models
 * without re-embedding every row.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );
  const data = (await res.json()) as { embedding?: { values?: number[] }; error?: unknown };
  if (!res.ok) throw new Error(`Gemini embed error: ${JSON.stringify(data.error)}`);
  const emb = data.embedding?.values;
  if (!emb || emb.length !== 768) {
    throw new Error(`Embedding returned ${emb?.length ?? 0} dims, expected 768`);
  }
  return emb;
}

export async function contentHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Buffer.from(buf).toString('hex');
}
