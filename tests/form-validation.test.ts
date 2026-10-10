import { describe, expect, it } from 'vitest';
import { validateLead, type LeadFormValues } from '../src/lib/form';

const base: LeadFormValues = {
  email: 'musik@example.at',
  name: '',
  role: 'band',
  city: '',
  consent: true,
  studioName: '',
  studioCity: '',
  studioType: '',
  studioWebsite: '',
};

describe('validateLead (Client)', () => {
  it('akzeptiert gültige Minimal-Eingaben', () => {
    expect(validateLead(base)).toEqual({});
  });

  it('meldet Pflichtfelder auf Deutsch', () => {
    const errors = validateLead({ ...base, email: '', role: '', consent: false });
    expect(errors.email).toMatch(/E-Mail/);
    expect(errors.role).toBeTruthy();
    expect(errors.consent).toMatch(/Einwilligung/);
  });

  it('prüft E-Mail-Format und Längen', () => {
    expect(validateLead({ ...base, email: 'kein-at.at' }).email).toMatch(/gültige/);
    expect(validateLead({ ...base, name: 'x'.repeat(81) }).name).toBeTruthy();
  });

  it('prüft die Studio-Website nur bei Betreiber:innen', () => {
    expect(validateLead({ ...base, studioWebsite: 'quatsch' })).toEqual({});
    const op = { ...base, role: 'betreiber', studioName: 'Klangraum' };
    expect(validateLead({ ...op, studioWebsite: 'quatsch' }).studioWebsite).toBeTruthy();
    expect(validateLead({ ...op, studioWebsite: 'https://mein-studio.at' })).toEqual({});
  });

  it('verlangt bei Betreiber:innen den Studionamen, bei Kund:innen nicht', () => {
    expect(validateLead({ ...base, role: 'betreiber', studioName: '  ' }).studioName).toMatch(/Studios/);
    expect(validateLead({ ...base, role: 'band', studioName: '' })).toEqual({});
  });
});
