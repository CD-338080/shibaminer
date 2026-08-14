// app/api/wallet/disconnect/route.ts

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

interface DisconnectWalletRequestBody {
    initData: string;
}

export async function POST(req: Request) {
    const requestBody: DisconnectWalletRequestBody = await req.json();
    const { initData: telegramInitData } = requestBody;

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
        const updatedUser = await prisma.user.update({
            where: { telegramId },
            data: { tonWalletAddress: null },
        });

        return NextResponse.json({
            success: true,
            message: 'Wallet disconnected successfully',
        });

    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        return NextResponse.json({ error: 'Failed to disconnect wallet' }, { status: 500 });
    }
}