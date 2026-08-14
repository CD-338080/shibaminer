import { NextResponse } from 'next/server';
import { handleTelegramUpdate, type TgUpdate } from '@/utils/bot-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Telegram Bot webhook — 24/7 on Vercel (PC off).
 * Set with: npm run bot:webhook  OR  POST /api/telegram/setup-webhook?secret=CRON_SECRET
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const header = req.headers.get('x-telegram-bot-api-secret-token');
      if (header !== secret) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const update = (await req.json()) as TgUpdate;
    await handleTelegramUpdate(update);
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
