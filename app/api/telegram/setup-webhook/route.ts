import { NextResponse } from 'next/server';
import { getTelegramWebhookInfo, publicAppBase, setTelegramWebhook } from '@/utils/telegram-bot';

function resolvePublicBase(_req: Request): string {
  return publicAppBase();
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
  const set = await setTelegramWebhook(webhookUrl);
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
