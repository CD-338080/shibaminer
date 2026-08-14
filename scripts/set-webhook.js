/**
 * Register Telegram webhook on Vercel so Jarvis works with the PC off.
 * Usage: npm run bot:webhook
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
const base = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'https://shibaminer-sigma.vercel.app'
).replace(/\/$/, '');
const webhookUrl = `${base}/api/telegram/webhook`;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function main() {
  if (!token) {
    console.error('BOT_TOKEN missing');
    process.exit(1);
  }
  console.log('Setting Telegram webhook →', webhookUrl);
  const set = await api('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
    ...(secret ? { secret_token: secret } : {}),
  });
  const info = await api('getWebhookInfo', {});
  console.log(JSON.stringify({ set, info: info.result }, null, 2));
  if (!set.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
