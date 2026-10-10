import { readFile, writeFile } from 'node:fs/promises';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Lead, LeadStore } from './types.ts';

const LEAD_PREFIX = 'lead#';
const RATE_PREFIX = 'rate#';

/** Single-Table-Design: pk = "lead#<id>" bzw. "rate#<key>#<fenster>". */
export class DynamoLeadStore implements LeadStore {
  private readonly doc: DynamoDBDocumentClient;

  constructor(private readonly tableName: string, client = new DynamoDBClient({})) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async get(id: string): Promise<Lead | undefined> {
    const res = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk: LEAD_PREFIX + id }, ConsistentRead: true }));
    if (!res.Item) return undefined;
    const { pk: _pk, ...lead } = res.Item;
    return lead as Lead;
  }

  async put(lead: Lead): Promise<void> {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { pk: LEAD_PREFIX + lead.id, ...lead } }));
  }

  async delete(id: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk: LEAD_PREFIX + id } }));
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds);
    const res = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `${RATE_PREFIX}${key}#${window}` },
        UpdateExpression: 'ADD #c :one SET #t = if_not_exists(#t, :ttl)',
        ExpressionAttributeNames: { '#c': 'count', '#t': 'ttl' },
        ExpressionAttributeValues: { ':one': 1, ':ttl': (window + 2) * windowSeconds },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(res.Attributes?.count ?? 1);
  }

  async list(): Promise<Lead[]> {
    const items: Lead[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'begins_with(pk, :p)',
          ExpressionAttributeValues: { ':p': LEAD_PREFIX },
          ExclusiveStartKey: start,
        }),
      );
      for (const item of res.Items ?? []) {
        const { pk: _pk, ...lead } = item;
        items.push(lead as Lead);
      }
      start = res.LastEvaluatedKey;
    } while (start);
    return items;
  }
}

/** Lokaler Speicher für Entwicklung und Tests (optional als JSON-Datei persistiert). */
export class MemoryLeadStore implements LeadStore {
  private leads = new Map<string, Lead>();
  private counters = new Map<string, number>();
  private loaded = false;

  constructor(
    private readonly file?: string,
    private readonly nowMs: () => number = Date.now,
  ) {}

  private async load() {
    if (this.loaded || !this.file) return;
    this.loaded = true;
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as Lead[];
      data.forEach((l) => this.leads.set(l.id, l));
    } catch {
      /* Datei existiert noch nicht */
    }
  }

  private async save() {
    if (this.file) await writeFile(this.file, JSON.stringify([...this.leads.values()], null, 2));
  }

  async get(id: string) {
    await this.load();
    const lead = this.leads.get(id);
    if (lead?.ttl && lead.ttl * 1000 < this.nowMs()) return undefined;
    return lead ? structuredClone(lead) : undefined;
  }

  async put(lead: Lead) {
    await this.load();
    this.leads.set(lead.id, structuredClone(lead));
    await this.save();
  }

  async delete(id: string) {
    await this.load();
    this.leads.delete(id);
    await this.save();
  }

  async hit(key: string, windowSeconds: number) {
    const window = Math.floor(this.nowMs() / 1000 / windowSeconds);
    const k = `${key}#${window}`;
    const next = (this.counters.get(k) ?? 0) + 1;
    this.counters.set(k, next);
    return next;
  }

  async list() {
    await this.load();
    return [...this.leads.values()].map((l) => structuredClone(l));
  }
}
