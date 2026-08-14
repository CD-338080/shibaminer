import { NextResponse } from 'next/server';
import { cronAuthorized, runChannelCron } from '@/utils/run-channel-cron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Vercel Cron: Jarvis webhook + payout channel + Q&A.
 * Auth: Bearer CRON_SECRET | ?secret= | x-vercel-cron
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    const result = await runChannelCron(req, { force });
    return NextResponse.json({
      via: 'cron',
      ok: result.payouts.ok,
      announced: (result.payouts.posted || 0) > 0,
      posted: result.payouts.posted,
      pending: result.payouts.pending,
      count: result.payouts.count,
      txids: result.payouts.txids,
      error: result.payouts.error,
      channel: process.env.PAYOUT_CHANNEL_ID?.replace(/^["']|["']$/g, '') || null,
      hasBotToken: Boolean(process.env.BOT_TOKEN),
      webhook: result.webhook,
      qa: result.qa,
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
