import { describe, expect, it } from 'vitest';
import { parseAttribution } from '../src/lib/attribution';

describe('parseAttribution', () => {
  it('liest UTM-Parameter und kürzt den Referrer auf die Origin', () => {
    const a = parseAttribution(
      'https://bcube.at/?utm_source=instagram&utm_medium=paid_social&utm_campaign=bcube_launch_2027&foo=bar',
      'https://l.instagram.com/some/path?u=secret',
    );
    expect(a.utm).toEqual({ utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: 'bcube_launch_2027' });
    expect(a.referrer).toBe('https://l.instagram.com');
    expect(a.landingPath).toBe('/');
  });

  it('ignoriert interne Referrer und ungültige Werte', () => {
    expect(parseAttribution('https://bcube.at/', 'https://bcube.at/impressum/').referrer).toBe('');
    expect(parseAttribution('https://bcube.at/', 'kein-url').referrer).toBe('');
  });
});
