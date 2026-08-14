import { announceTodaysPayouts } from '@/utils/payout-announce';
import { loadPayoutTransactions } from '@/utils/payout-feed';
import { announceRandomQa } from '@/utils/qa-posts';
import { getTelegramWebhookInfo, publicAppBase, setTelegramWebhook } from '@/utils/telegram-bot';

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

function publicBase(_req: Request): string {
  return publicAppBase();
}

async function ensureWebhook(req: Request) {
  const want = `${publicBase(req)}/api/telegram/webhook`;
  try {
    const info = await getTelegramWebhookInfo();
    const result =
      info.ok && info.result && typeof info.result === 'object'
        ? (info.result as { url?: string; last_error_message?: string })
        : null;
    const current = String(result?.url || '');
    const lastError = String(result?.last_error_message || '');
    if (current === want && !lastError) {
      return { ok: true, url: want, skipped: true };
    }
    // Never attach CRON_SECRET — preview/auth 401s kill Jarvis while payouts still work.
    const set = await setTelegramWebhook(want);
    return { ok: set.ok, url: want, error: set.error || lastError || undefined, skipped: false };
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

/** Payouts first so a webhook hiccup never blocks the channel. */
export async function runChannelCron(req: Request, opts?: { force?: boolean }) {
  const transactions = await loadPayoutTransactions();
  const payouts = await announceTodaysPayouts(transactions, Date.now(), {
    force: !!opts?.force,
  });
  const qa = await announceRandomQa({ force: false });
  const webhook = await ensureWebhook(req);

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
