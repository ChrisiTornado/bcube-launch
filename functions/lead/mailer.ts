import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Mailer, MailMessage } from './types.ts';

export class SesMailer implements Mailer {
  constructor(
    private readonly from: string,
    private readonly client = new SESv2Client({}),
    private readonly configurationSet?: string,
  ) {}

  async send(m: MailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [m.to] },
        ReplyToAddresses: m.replyTo ? [m.replyTo] : undefined,
        ConfigurationSetName: this.configurationSet,
        Content: {
          Simple: {
            Subject: { Data: m.subject, Charset: 'UTF-8' },
            Body: { Html: { Data: m.html, Charset: 'UTF-8' }, Text: { Data: m.text, Charset: 'UTF-8' } },
            Headers: m.headers ? Object.entries(m.headers).map(([Name, Value]) => ({ Name, Value })) : undefined,
          },
        },
      }),
    );
  }
}

/** Lokal: Mails landen als HTML-Datei in dev/outbox und als Text in der Konsole. */
export class OutboxMailer implements Mailer {
  public readonly sent: MailMessage[] = [];

  constructor(private readonly dir?: string) {}

  async send(m: MailMessage): Promise<void> {
    this.sent.push(m);
    if (!this.dir) return;
    await mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTo = m.to.replace(/[^a-z0-9@._-]/gi, '_');
    const file = join(this.dir, `${stamp}_${safeTo}.html`);
    await writeFile(file, m.html, 'utf8');
    console.log(`\n✉️  Mail an ${m.to}: "${m.subject}"\n   gespeichert: ${file}\n${m.text.split('\n').map((l) => '   ' + l).join('\n')}\n`);
  }
}
