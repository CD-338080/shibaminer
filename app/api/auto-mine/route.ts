import { NextResponse } from 'next/server';
import prisma from '@/utils/prisma';
import { validateTelegramWebAppData } from '@/utils/server-checks';
import { AUTO_MINE_INTERVAL_MS, settleAutoMine } from '@/utils/auto-mine';

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

async function settleAndRespond(telegramId: string, activeOverride?: boolean) {
  const dbUser = await prisma.user.findUnique({ where: { telegramId } });
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const active = typeof activeOverride === 'boolean' ? activeOverride : !!dbUser.autoMineActive;
  const now = Date.now();

  if (!active) {
    return NextResponse.json({
      active: false,
      msUntilNext: AUTO_MINE_INTERVAL_MS,
      reward: 0,
      points: dbUser.points,
      pointsBalance: dbUser.pointsBalance,
    });
  }

  const lastTick = dbUser.autoMineLastTickAt ?? new Date(now);
  const settled = settleAutoMine(lastTick, now);

  let points = dbUser.points;
  let pointsBalance = dbUser.pointsBalance;

  if (settled.ticks > 0) {
    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        points: { increment: settled.reward },
        pointsBalance: { increment: settled.reward },
        autoMineActive: true,
        autoMineLastTickAt: settled.newLastTickAt,
      },
    });
    points = updated.points;
    pointsBalance = updated.pointsBalance;
  } else {
    // Keep timer anchored even when no reward yet
    await prisma.user.update({
      where: { telegramId },
      data: {
        autoMineActive: true,
        autoMineLastTickAt: dbUser.autoMineLastTickAt ?? settled.newLastTickAt,
      },
    });
  }

  return NextResponse.json({
    active: true,
    msUntilNext: settled.msUntilNext,
    reward: settled.reward,
    ticks: settled.ticks,
    points,
    pointsBalance,
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const initData = searchParams.get('initData') || '';
    const resolved = await resolveUser(initData);
    if ('error' in resolved && resolved.error) return resolved.error;
    const { telegramId } = resolved as { telegramId: string };
    return settleAndRespond(telegramId);
  } catch (e) {
    console.error('auto-mine GET', e);
    return NextResponse.json({ error: 'Failed to load miner' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const initData = body.initData || '';
    const action = body.action as 'start' | 'stop';
    const resolved = await resolveUser(initData);
    if ('error' in resolved && resolved.error) return resolved.error;
    const { telegramId, dbUser } = resolved as {
      telegramId: string;
      dbUser: { autoMineActive: boolean; autoMineLastTickAt: Date | null };
    };

    if (action === 'start') {
      const now = new Date();
      await prisma.user.update({
        where: { telegramId },
        data: {
          autoMineActive: true,
          // Fresh start timer if newly activating; keep existing if already digging
          autoMineLastTickAt: dbUser.autoMineActive && dbUser.autoMineLastTickAt
            ? dbUser.autoMineLastTickAt
            : now,
        },
      });
      return settleAndRespond(telegramId, true);
    }

    if (action === 'stop') {
      const settleRes = await settleAndRespond(telegramId, true);
      const payload = await settleRes.json();
      await prisma.user.update({
        where: { telegramId },
        data: { autoMineActive: false },
      });
      return NextResponse.json({
        ...payload,
        active: false,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('auto-mine POST', e);
    return NextResponse.json({ error: 'Failed to update miner' }, { status: 500 });
  }
}
