// app/api/onchain-tasks/route.ts

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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/utils/prisma';
import { validateTelegramWebAppData } from '@/utils/server-checks';

export async function GET(req: NextRequest) {
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
        // Fetch the user
        const user = await prisma.user.findUnique({
            where: { telegramId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch active onchain tasks
        const onchainTasks = await prisma.onchainTask.findMany({
            where: { isActive: true },
        });

        // Fetch user's completions
        const userCompletions = await prisma.onchainTaskCompletion.findMany({
            where: {
                userId: user.id,
                onchainTask: {
                    isActive: true,
                },
            },
        });

        // Combine task data with completion status
        const tasksWithCompletions = onchainTasks.map(task => ({
            ...task,
            isCompleted: userCompletions.some(
                completion => completion.onchainTaskId === task.id
            ),
        }));

        return NextResponse.json(tasksWithCompletions);
    } catch (error) {
        console.error('Fetch onchain tasks error:', error);
        return NextResponse.json({ error: 'Failed to fetch onchain tasks' }, { status: 500 });
    }
}