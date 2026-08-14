import { NextResponse } from 'next/server';
import { getTelegramWebhookInfo, setTelegramWebhook } from '@/utils/telegram-bot';

function resolvePublicBase(req: Request): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return new URL(req.url).origin;
}

/**
 * Register Telegram webhook → this app.
 * Auth: ?secret=CRON_SECRET or Bearer CRON_SECRET
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = searchParams.get('secret') || '';

  if (!secret || (bearer !== secret && q !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = resolvePublicBase(req);
  const webhookUrl = `${base}/api/telegram/webhook`;
  const tokenSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const set = await setTelegramWebhook(webhookUrl, tokenSecret || undefined);
  const info = await getTelegramWebhookInfo();

  return NextResponse.json({
    ok: set.ok,
    webhookUrl,
    setError: set.error,
    info: info.result,
  });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('secret') || '';
  if (!secret || q !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const info = await getTelegramWebhookInfo();
  return NextResponse.json({ ok: info.ok, info: info.result, error: info.error });
}
