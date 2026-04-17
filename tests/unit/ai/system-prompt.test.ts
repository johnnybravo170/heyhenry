import { describe, expect, it } from 'vitest';
import { getSystemPrompt } from '@/lib/ai/system-prompt';

describe('AI system prompt', () => {
  it('returns a string containing the tenant name', () => {
    const prompt = getSystemPrompt('Acme Washing', 'America/Vancouver');
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Acme Washing');
  });

  it('returns a string containing the timezone', () => {
    const prompt = getSystemPrompt('Test Co', 'America/Toronto');
    expect(prompt).toContain('America/Toronto');
  });

  it('contains "Henry"', () => {
    const prompt = getSystemPrompt('Test Co', 'America/Vancouver');
    expect(prompt).toContain('Henry');
  });

  it('mentions CAD currency', () => {
    const prompt = getSystemPrompt('Test Co', 'America/Vancouver');
    expect(prompt).toContain('CAD');
  });

  it('sets the proactive tone (no asking permission)', () => {
    const prompt = getSystemPrompt('Test Co', 'America/Vancouver');
    expect(prompt).toContain('Let me check');
  });
});
