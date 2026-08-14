import { NextResponse } from 'next/server';
import { cronAuthorized, runChannelCron } from '@/utils/run-channel-cron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    const result = await runChannelCron(req, { force });
    return NextResponse.json({ via: 'cron', ...result });
  } catch (e) {
    console.error('cron tick', e);
    return NextResponse.json(
      { via: 'cron', ok: false, error: e instanceof Error ? e.message : 'tick_failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
