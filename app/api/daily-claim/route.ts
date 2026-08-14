import { NextResponse } from 'next/server';
import prisma from '@/utils/prisma';
import { validateTelegramWebAppData } from '@/utils/server-checks';
import {
  DAILY_CLAIM_REWARD,
  previousUtcDateKey,
  utcDateKey,
} from '@/utils/daily-claim';

async function resolveUser(initData: string) {
  if (!initData) return { error: NextResponse.json({ error: 'Invalid request' }, { status: 400 }) };
  const { validatedData, user } = validateTelegramWebAppData(initData);
  if (!validatedData) {
    return { error: NextResponse.json({ error: 'Invalid Telegram data' }, { status: 403 }) };
  }
  const telegramId = user.id?.toString();
  if (!telegramId) {
    return { error: NextResponse.json({ error: 'Invalid user data' }, { status: 400 }) };
  }
  const dbUser = await prisma.user.findUnique({ where: { telegramId } });
  if (!dbUser) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }
  return { dbUser, telegramId };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const initData = searchParams.get('initData') || '';
    const resolved = await resolveUser(initData);
    if ('error' in resolved && resolved.error) return resolved.error;
    const { dbUser } = resolved as {
      dbUser: { dailyClaimLastDate: string | null; dailyClaimStreak: number };
    };
    const today = utcDateKey();
    return NextResponse.json({
      claimedToday: dbUser.dailyClaimLastDate === today,
      streak: dbUser.dailyClaimStreak ?? 0,
    });
  } catch (e) {
    console.error('daily-claim GET', e);
    return NextResponse.json({ error: 'Failed to load daily claim' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const initData = body.initData || '';
    const resolved = await resolveUser(initData);
    if ('error' in resolved && resolved.error) return resolved.error;
    const { dbUser, telegramId } = resolved as {
      telegramId: string;
      dbUser: { dailyClaimLastDate: string | null; dailyClaimStreak: number };
    };

    const today = utcDateKey();
    if (dbUser.dailyClaimLastDate === today) {
      return NextResponse.json({ error: 'Already claimed today' }, { status: 409 });
    }

    const yesterday = previousUtcDateKey();
    const nextStreak =
      dbUser.dailyClaimLastDate === yesterday
        ? (dbUser.dailyClaimStreak || 0) + 1
        : 1;

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        points: { increment: DAILY_CLAIM_REWARD },
        pointsBalance: { increment: DAILY_CLAIM_REWARD },
        dailyClaimLastDate: today,
        dailyClaimStreak: nextStreak,
      },
    });

    return NextResponse.json({
      reward: DAILY_CLAIM_REWARD,
      streak: updated.dailyClaimStreak,
      points: updated.points,
      pointsBalance: updated.pointsBalance,
    });
  } catch (e) {
    console.error('daily-claim POST', e);
    return NextResponse.json({ error: 'Failed to claim daily reward' }, { status: 500 });
  }
}
