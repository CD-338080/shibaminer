import { NextResponse } from 'next/server';
import { announceTodaysPayouts, type AnnounceablePayout } from '@/utils/payout-announce';
import { loadPayoutTransactions, payoutFeedMeta } from '@/utils/payout-feed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeClientTxs(raw: unknown): AnnounceablePayout[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const txid = String(row.txid || row.hash || '').trim();
      if (!txid) return null;
      return {
        txid,
        timestamp: Number(row.timestamp) || Date.now(),
        amount: String(row.amount ?? '0'),
        address: String(row.address || row.to || ''),
        explorerUrl: row.explorerUrl ? String(row.explorerUrl) : undefined,
        type: row.type ? String(row.type) : 'Withdrawal',
      } satisfies AnnounceablePayout;
    })
    .filter((tx): tx is AnnounceablePayout => Boolean(tx));
}

/**
 * Live payout feed for Cash / Airdrop.
 * Always tries to auto-post unannounced txs to PAYOUT_CHANNEL_ID (paced).
 * ?announce=0 disables the side-effect. ?force=1 skips the pace gate once.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const skipAnnounce = searchParams.get('announce') === '0';
  const force = searchParams.get('force') === '1';

  try {
    const transactions = await loadPayoutTransactions();

    let announce: Awaited<ReturnType<typeof announceTodaysPayouts>> | null = null;
    if (!skipAnnounce) {
      announce = await announceTodaysPayouts(transactions, Date.now(), { force });
      if (announce.error) {
        console.error('auto payout channel', announce.error);
      }
    }

    return NextResponse.json({
      transactions,
      ...payoutFeedMeta(),
      channelPost: announce
        ? {
            ok: announce.ok,
            posted: announce.posted,
            pending: announce.pending,
            nextInMs: announce.nextInMs,
            error: announce.error || null,
            txids: announce.txids || [],
          }
        : null,
    });
  } catch (error) {
    console.error('shib/doge-payouts error:', error);
    return NextResponse.json({ transactions: [], error: 'feed_unavailable' }, { status: 200 });
  }
}

/**
 * POST body: { transactions?: [...] , force?: boolean }
 * Announces the same txs the client is showing in Airdrop (preferred path).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    let txs = normalizeClientTxs(body?.transactions);

    if (!txs.length) {
      txs = await loadPayoutTransactions();
    }

    const result = await announceTodaysPayouts(txs, Date.now(), { force });
    return NextResponse.json({
      ok: result.ok,
      posted: result.posted,
      pending: result.pending,
      nextInMs: result.nextInMs,
      error: result.error || null,
      txids: result.txids || [],
      count: txs.length,
      ...payoutFeedMeta(),
    });
  } catch (e) {
    console.error('doge-payouts POST announce', e);
    return NextResponse.json({ ok: false, error: 'announce_failed' }, { status: 500 });
  }
}
