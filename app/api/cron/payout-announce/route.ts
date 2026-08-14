import { NextResponse } from 'next/server';
import { announceTodaysPayouts } from '@/utils/payout-announce';
import { loadPayoutTransactions } from '@/utils/payout-feed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = searchParams.get('secret') || '';
  if (secret && (bearer === secret || q === secret)) return true;
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

/**
 * Cron / manual trigger for payout channel posts.
 * Auth: Authorization: Bearer CRON_SECRET  OR  ?secret=CRON_SECRET
 * Optional: ?force=1 to skip pace (post one/batch now)
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    const transactions = await loadPayoutTransactions();
    const result = await announceTodaysPayouts(transactions, Date.now(), { force });

    return NextResponse.json({
      via: 'cron',
      ok: result.ok,
      announced: result.announced,
      posted: result.posted,
      pending: result.pending,
      nextInMs: result.nextInMs,
      count: transactions.length,
      txids: result.txids,
      error: result.error,
      channel: process.env.PAYOUT_CHANNEL_ID?.replace(/^["']|["']$/g, '') || null,
      hasBotToken: Boolean(process.env.BOT_TOKEN),
    });
  } catch (e) {
    console.error('cron payout-announce', e);
    return NextResponse.json(
      {
        via: 'cron',
        ok: false,
        error: e instanceof Error ? e.message : 'announce_failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
