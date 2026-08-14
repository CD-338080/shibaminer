/**
 * Local Telegram bot long-polling (dev / Jarvis chat only).
 * Payout channel posts are handled by the mini app + Vercel cron — not here.
 * Usage: npm run bot:poll
 */
const fs = require('fs');
const path = require('path');

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

const WEBHOOK_URL =
  process.env.BOT_POLL_WEBHOOK_URL || 'http://127.0.0.1:3000/api/telegram/webhook';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET || '';

let offset = 0;

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function forward(update) {
  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) headers['x-telegram-bot-api-secret-token'] = SECRET;
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`webhook ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function main() {
  console.log(
    'Shiba Miner bot polling →',
    WEBHOOK_URL,
    '@' + (process.env.NEXT_PUBLIC_BOT_USERNAME || 'bot')
  );
  await api('deleteWebhook', { drop_pending_updates: false });

  for (;;) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=${encodeURIComponent(
        JSON.stringify(['message', 'callback_query'])
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) {
        console.error('getUpdates', data.description);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      for (const update of data.result || []) {
        offset = update.update_id + 1;
        try {
          await forward(update);
          console.log('handled', update.update_id);
        } catch (e) {
          console.error('forward failed', e.message || e);
        }
      }
    } catch (e) {
      console.error(e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main();
