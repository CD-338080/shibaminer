import { announceTodaysPayouts } from '@/utils/payout-announce';
import { loadPayoutTransactions } from '@/utils/payout-feed';
import { announceRandomQa } from '@/utils/qa-posts';
import { getTelegramWebhookInfo, setTelegramWebhook } from '@/utils/telegram-bot';

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = searchParams.get('secret') || '';
  if (secret && (bearer === secret || q === secret)) return true;
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

function publicBase(req: Request): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return new URL(req.url).origin;
}

async function ensureWebhook(req: Request) {
  const want = `${publicBase(req)}/api/telegram/webhook`;
  const tokenSecret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET;
  try {
    const info = await getTelegramWebhookInfo();
    const current =
      info.ok && info.result && typeof info.result === 'object'
        ? String((info.result as { url?: string }).url || '')
        : '';
    if (current === want) {
      return { ok: true, url: want, skipped: true };
    }
    const set = await setTelegramWebhook(want, tokenSecret || undefined);
    return { ok: set.ok, url: want, error: set.error, skipped: false };
  } catch (e) {
    return { ok: false, url: want, error: e instanceof Error ? e.message : 'webhook_failed' };
  }
}

export async function tickPayoutsQuietly() {
  try {
    const transactions = await loadPayoutTransactions();
    await announceTodaysPayouts(transactions);
  } catch (e) {
    console.warn('payout tick', e);
  }
}

/** Jarvis webhook + payout channel + Q&A. Used by Vercel Cron. */
export async function runChannelCron(req: Request, opts?: { force?: boolean }) {
  const webhook = await ensureWebhook(req);
  const transactions = await loadPayoutTransactions();
  const payouts = await announceTodaysPayouts(transactions, Date.now(), {
    force: !!opts?.force,
  });
  const qa = await announceRandomQa({ force: false });

  return {
    webhook,
    payouts: {
      ok: payouts.ok,
      posted: payouts.posted,
      pending: payouts.pending,
      count: transactions.length,
      error: payouts.error || null,
      txids: payouts.txids || [],
    },
    qa: {
      ok: qa.ok,
      posted: qa.posted,
      nextInMs: qa.nextInMs,
      error: qa.error || null,
    },
  };
}
