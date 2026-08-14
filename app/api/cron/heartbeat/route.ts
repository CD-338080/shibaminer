import { NextResponse } from 'next/server';
import { announceTodaysPayouts } from '@/utils/payout-announce';
import { loadPayoutTransactions } from '@/utils/payout-feed';
import { announceRandomQa } from '@/utils/qa-posts';
import { getTelegramWebhookInfo, setTelegramWebhook } from '@/utils/telegram-bot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = searchParams.get('secret') || '';
  if (secret && (bearer === secret || q === secret)) return true;
  // Vercel Cron Jobs send this header
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

/**
 * 24/7 keep-alive (PC off): Jarvis webhook + payout channel + Q&A gate.
 * Vercel Cron Authorization: Bearer CRON_SECRET  OR  ?secret=  OR  x-vercel-cron
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forcePayouts = new URL(req.url).searchParams.get('force') === '1';

  try {
    const webhook = await ensureWebhook(req);
    const transactions = await loadPayoutTransactions();
    const payouts = await announceTodaysPayouts(transactions, Date.now(), { force: forcePayouts });
    const qa = await announceRandomQa({ force: false });

    return NextResponse.json({
      via: 'heartbeat',
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
    });
  } catch (e) {
    console.error('cron heartbeat', e);
    return NextResponse.json(
      { via: 'heartbeat', ok: false, error: e instanceof Error ? e.message : 'heartbeat_failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
