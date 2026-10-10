/** AWS-Lambda-Einstiegspunkt (API Gateway HTTP API, Payload 2.0). */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { SesMailer } from './mailer.ts';
import { DynamoLeadStore } from './store.ts';
import { verifyTurnstile } from './turnstile.ts';

let app: ReturnType<typeof createApp> | undefined;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  if (!app) {
    const config = await loadConfig();
    if (!config.tableName) throw new Error('TABLE_NAME fehlt');
    app = createApp({
      config,
      store: new DynamoLeadStore(config.tableName),
      mailer: new SesMailer(config.mailFrom, undefined, config.sesConfigurationSet),
      verifyTurnstile,
    });
  }
  return app(event);
}
