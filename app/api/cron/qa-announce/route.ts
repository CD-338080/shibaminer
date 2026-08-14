import { NextResponse } from 'next/server';
import { announceRandomQa } from '@/utils/qa-posts';

/** Cron: Bearer CRON_SECRET or ?secret= */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = searchParams.get('secret') || '';

  if (!secret || (bearer !== secret && q !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = searchParams.get('force') !== '0';
  const result = await announceRandomQa({ force });
  return NextResponse.json({ via: 'cron', ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
