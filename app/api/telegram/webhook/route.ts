import { NextResponse } from 'next/server';
import { handleTelegramUpdate, type TgUpdate } from '@/utils/bot-chat';
import { announceTodaysPayouts } from '@/utils/payout-announce';
import { loadPayoutTransactions } from '@/utils/payout-feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function tickPayoutsQuietly() {
  try {
    const txs = await loadPayoutTransactions();
    await announceTodaysPayouts(txs);
  } catch (e) {
    console.warn('webhook payout tick', e);
  }
}

/**
 * Telegram Bot webhook — 24/7 on Vercel (PC off).
 * Set with: npm run bot:webhook  OR  POST /api/telegram/setup-webhook?secret=CRON_SECRET
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET;
    if (secret) {
      const header = req.headers.get('x-telegram-bot-api-secret-token');
      if (header && header !== secret) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const update = (await req.json()) as TgUpdate;
    await handleTelegramUpdate(update);
    // Keep payout channel moving even if nobody opens the mini app
    void tickPayoutsQuietly();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('telegram webhook', e);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'Shiba Miner Pro bot webhook',
    hint: 'Telegram sends updates via POST. Configure with /api/telegram/setup-webhook',
  });
}
