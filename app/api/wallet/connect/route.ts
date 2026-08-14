// app/api/wallet/connect/route.ts

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

interface ConnectWalletRequestBody {
    initData: string;
    walletAddress: string;
}

export async function POST(req: Request) {
    const requestBody: ConnectWalletRequestBody = await req.json();
    const { initData: telegramInitData, walletAddress } = requestBody;

    if (!telegramInitData || !walletAddress) {
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
            data: { tonWalletAddress: walletAddress },
        });

        return NextResponse.json({
            success: true,
            message: 'Wallet connected successfully',
            walletAddress: updatedUser.tonWalletAddress,
        });

    } catch (error) {
        console.error('Error connecting wallet:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to connect wallet' }, { status: 500 });
    }
}