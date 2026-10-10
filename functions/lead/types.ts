import type { Role, StudioType } from '../../src/lib/roles.ts';

export type LeadStatus = 'pending' | 'confirmed';

export interface Lead {
  id: string;
  email: string;
  status: LeadStatus;
  role: Role;
  name?: string;
  city?: string;
  operator?: { studioName?: string; studioCity?: string; studioType?: StudioType; website?: string };
  attribution: Record<string, string | undefined>;
  formId?: string;
  ctaLocation?: string;
  consent: { text: string; version: string; at: string };
  ipHash: string;
  tokenHash: string;
  tokenExpiresAt: string;
  unsubTokenHash: string;
  lastMailAt: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  /** Unix-Sekunden; DynamoDB-TTL löscht unbestätigte Leads automatisch. Bei Bestätigung entfernt. */
  ttl?: number;
}

export interface LeadStore {
  get(id: string): Promise<Lead | undefined>;
  put(lead: Lead): Promise<void>;
  delete(id: string): Promise<void>;
  /** Erhöht den Zähler für key im aktuellen Fenster und liefert den neuen Wert. */
  hit(key: string, windowSeconds: number): Promise<number>;
  list(): Promise<Lead[]>;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  replyTo?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
