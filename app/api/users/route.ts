import { NextResponse } from 'next/server';
import prisma from '@/utils/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEADERBOARD_LIMIT = 50;

/**
 * GET /api/users
 * Public leaderboard for Cash / Airdrop — ranked by vault SHIB (pointsBalance).
 */
export async function GET() {
  try {
    const [total, rows] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: [{ pointsBalance: 'desc' }, { points: 'desc' }],
        take: LEADERBOARD_LIMIT,
        select: {
          id: true,
          name: true,
          telegramId: true,
          isPremium: true,
          points: true,
          pointsBalance: true,
        },
      }),
    ]);

    const users = rows.map((u, index) => ({
      id: u.id,
      rank: index + 1,
      name: (u.name && String(u.name).trim()) || `Miner ···${String(u.telegramId || '').slice(-4)}`,
      telegramId: u.telegramId || null,
      isPremium: Boolean(u.isPremium),
      points: Number(u.points) || 0,
      pointsBalance: Number(u.pointsBalance) || 0,
    }));

    return NextResponse.json(
      {
        users,
        total,
        limit: LEADERBOARD_LIMIT,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/users', error);
    return NextResponse.json({ error: 'Failed to load leaderboard', users: [], total: 0 }, { status: 500 });
  }
}
