/**
 * Local Telegram bot long-polling (dev).
 * Forwards updates to Next.js webhook so Jarvis/Prisma share one codebase.
 * Usage: npm run bot:poll   (requires npm run dev)
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
const APP_BASE = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.BOT_POLL_APP_URL ||
  ''
).replace(/\/$/, '');

let offset = 0;
let lastPayoutTick = 0;

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function tickPayoutAnnounce() {
  if (!APP_BASE || !SECRET) return;
  const now = Date.now();
  if (now - lastPayoutTick < 55_000) return;
  lastPayoutTick = now;
  try {
    const url = `${APP_BASE}/api/cron/payout-announce?secret=${encodeURIComponent(SECRET)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (data.posted) {
      console.log('payout posted', data.posted, data.txids || []);
    } else if (data.error) {
      console.warn('payout announce', data.error, 'pending=', data.pending);
    } else {
      console.log(
        'payout tick pending=',
        data.pending ?? 0,
        'nextInMs=',
        data.nextInMs ?? '—'
      );
    }
  } catch (e) {
    console.warn('payout tick failed', e.message || e);
  }
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
  if (APP_BASE) {
    console.log('Payout announce tick →', APP_BASE + '/api/cron/payout-announce');
  } else {
    console.warn(
      'Set NEXT_PUBLIC_APP_URL or APP_URL to enable payout channel ticks from bot:poll'
    );
  }
  await api('deleteWebhook', { drop_pending_updates: false });
  void tickPayoutAnnounce();

  for (;;) {
    try {
      void tickPayoutAnnounce();
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
