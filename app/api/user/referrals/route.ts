// app/api/user/referrals/route.ts

/**
 * This project was developed by Nikandr Surkov.
 * You may not use this code if you purchased it from any source other than the official website https://nikandr.com.
 * If you purchased it from the official website, you may use it for your own projects,
 * but you may not resell it or publish it publicly.
 * 
 * Website: https://nikandr.com
 * YouTube: https://www.youtube.com/@NikandrSurkov
 * Telegram: https://t.me/nikandr_s
 * Telegram channel for news/updates: https://t.me/clicker_game_news
 * GitHub: https://github.com/nikandr-surkov
 */

import { NextResponse } from 'next/server';
import prisma from '@/utils/prisma';
import { validateTelegramWebAppData } from '@/utils/server-checks';
import { calculateLevelIndex } from '@/utils/game-mechanics';
import { LEVELS } from '@/utils/consts';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const telegramInitData = url.searchParams.get('initData');

  if (!telegramInitData) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { validatedData, user } = validateTelegramWebAppData(telegramInitData);

  if (!validatedData) {
    return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 403 });
  }

  const telegramId = user.id?.toString();

  if (!telegramId) {
    return NextResponse.json({ error: 'Invalid user data' }, { status: 400 });
  }


  try {
    const dbUser = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        referrals: {
          select: {
            id: true,
            telegramId: true,
            name: true,
            points: true,
            referralPointsEarned: true,
          }
        }
      }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const referralsWithLevels = dbUser.referrals.map(referral => {
      const levelIndex = calculateLevelIndex(referral.points);
      const level = LEVELS[levelIndex];
      return {
        ...referral,
        levelName: level.name,
        levelImage: level.smallImage,
      };
    });

    return NextResponse.json({
      referrals: referralsWithLevels,
      referralCount: referralsWithLevels.length
    });
  } catch (error) {
    console.error('Error fetching user referrals:', error);
    return NextResponse.json({ error: 'Failed to fetch user referrals' }, { status: 500 });
  }
}