/** Rollen im Vormerk-Formular. Wird von Website und Lambda gemeinsam genutzt. */
export const ROLES = [
  { value: 'musiker', label: 'Musiker:in / Solo-Artist' },
  { value: 'band', label: 'Band' },
  { value: 'producer', label: 'Producer:in / Beatmaker' },
  { value: 'creator', label: 'Podcast / Content Creator' },
  { value: 'studierende', label: 'Studierende:r (Musik / Medien)' },
  { value: 'betreiber', label: 'Studiobetreiber:in' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

export type Role = (typeof ROLES)[number]['value'];

export const ROLE_VALUES = ROLES.map((r) => r.value) as [Role, ...Role[]];

export const OPERATOR_ROLE: Role = 'betreiber';

/** Auswahl im Kund:innen-Formular. Studiobetreiber:innen haben ein eigenes Formular (Abschnitt "Für Studios"). */
export const CUSTOMER_ROLES = ROLES.filter((r) => r.value !== OPERATOR_ROLE);

export const STUDIO_TYPES = [
  { value: 'proberaum', label: 'Proberaum' },
  { value: 'aufnahmestudio', label: 'Aufnahmestudio' },
  { value: 'mixing', label: 'Mixing / Mastering' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

export type StudioType = (typeof STUDIO_TYPES)[number]['value'];

export const STUDIO_TYPE_VALUES = STUDIO_TYPES.map((t) => t.value) as [StudioType, ...StudioType[]];

export const audienceForRole = (role: string | undefined): 'operator' | 'musician' =>
  role === OPERATOR_ROLE ? 'operator' : 'musician';
