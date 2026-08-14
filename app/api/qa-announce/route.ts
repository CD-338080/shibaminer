import { NextResponse } from 'next/server';
import { announceRandomQa } from '@/utils/qa-posts';

/**
 * Random app Q&A → QA_CHANNEL_ID via BOT_TOKEN.
 * Client polls ?announce=1 (rate-limited by QA_ANNOUNCE_MIN).
 * ?force=1 skips the interval (still needs CRON_SECRET if FORCE_QA_SECRET=1, optional).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const announce = searchParams.get('announce') === '1';
  const force = searchParams.get('force') === '1';

  if (!announce && !force) {
    return NextResponse.json({
      ok: true,
      hint: 'Use ?announce=1 to post (paced). Optional ?force=1 for immediate.',
      channel: process.env.QA_CHANNEL_ID || null,
    });
  }

  try {
    const result = await announceRandomQa({ force });
    return NextResponse.json({
      ok: result.ok,
      posted: result.posted,
      nextInMs: result.nextInMs,
      qaId: result.qaId,
      error: result.error,
      channel: process.env.QA_CHANNEL_ID || null,
    });
  } catch (e) {
    console.error('qa-announce', e);
    return NextResponse.json({ ok: false, error: 'qa_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
