import { NextResponse } from 'next/server';

/**
 * Cron / manual trigger for payout channel posts.
 * Auth: Authorization: Bearer CRON_SECRET  OR  ?secret=CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = searchParams.get('secret') || '';

  if (!secret || (bearer !== secret && q !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/doge-payouts?announce=1&t=${Date.now()}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ via: 'cron', ...data });
}

export async function POST(req: Request) {
  return GET(req);
}
