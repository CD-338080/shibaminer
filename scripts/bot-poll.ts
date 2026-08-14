/**
 * Local long-polling for Telegram bot (dev).
 * Usage: npm run bot:poll
 * Stop with Ctrl+C. Do not run together with an active webhook.
 */
import fs from 'fs';
import path from 'path';
import { handleTelegramUpdate, type TgUpdate } from '../utils/bot-chat';

function loadEnvFile() {
  try {
    const p = path.join(process.cwd(), '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

let offset = 0;

async function deleteWebhook() {
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: false }),
  });
}

async function poll() {
  const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=${encodeURIComponent(
    JSON.stringify(['message', 'callback_query'])
  )}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    ok?: boolean;
    result?: Array<TgUpdate & { update_id: number }>;
    description?: string;
  };
  if (!data.ok) {
    console.error('getUpdates failed', data.description);
    await new Promise((r) => setTimeout(r, 3000));
    return;
  }
  for (const update of data.result || []) {
    offset = update.update_id + 1;
    try {
      await handleTelegramUpdate(update);
      console.log('handled update', update.update_id);
    } catch (e) {
      console.error('handle failed', e);
    }
  }
}

async function main() {
  console.log(
    'Shiba Miner bot polling… @' + (process.env.NEXT_PUBLIC_BOT_USERNAME || 'bot')
  );
  await deleteWebhook();
  for (;;) {
    try {
      await poll();
    } catch (e) {
      console.error(e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main();
