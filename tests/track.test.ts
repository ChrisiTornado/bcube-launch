import { describe, expect, it } from 'vitest';
import { sanitizeProps } from '../src/lib/track';

describe('sanitizeProps', () => {
  it('entfernt personenbezogene Schlüssel und E-Mail-artige Werte', () => {
    expect(
      sanitizeProps({ email: 'a@b.at', name: 'Max', cta_id: 'hero', note: 'kontakt: max@test.at', depth: 50, ok: true, empty: '' }),
    ).toEqual({ cta_id: 'hero', depth: 50, ok: true });
  });

  it('kürzt lange Werte auf 100 Zeichen', () => {
    expect(sanitizeProps({ x: 'a'.repeat(300) }).x).toHaveLength(100);
  });
});
