import { NextResponse } from 'next/server';
import { announceTodaysPayouts } from '@/utils/payout-announce';
import { loadPayoutTransactions, payoutFeedMeta } from '@/utils/payout-feed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Live payout feed for Cash / Withdraw UI.
 * ?announce=1 → post today's new payouts to PAYOUT_CHANNEL_ID (paced).
 * ?force=1 with announce → skip pace gate (one batch now).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const announce = searchParams.get('announce') === '1';
  const force = searchParams.get('force') === '1';

  try {
    const transactions = await loadPayoutTransactions();

    if (announce) {
      const result = await announceTodaysPayouts(transactions, Date.now(), { force });
      return NextResponse.json({
        ok: result.ok,
        announced: result.announced,
        posted: result.posted,
        pending: result.pending,
        nextInMs: result.nextInMs,
        count: transactions.length,
        txids: result.txids,
        error: result.error,
        channel: process.env.PAYOUT_CHANNEL_ID || null,
        ...payoutFeedMeta(),
      });
    }

    return NextResponse.json({
      transactions,
      ...payoutFeedMeta(),
    });
  } catch (error) {
    console.error('shib/doge-payouts error:', error);
    return NextResponse.json({ transactions: [], error: 'feed_unavailable' }, { status: 200 });
  }
}
