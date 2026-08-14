// app/api/tasks/check/referral/route.ts

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

interface CheckReferralTaskRequestBody {
    initData: string;
    taskId: string;
}

export async function POST(req: Request) {
    const requestBody: CheckReferralTaskRequestBody = await req.json();
    const { initData: telegramInitData, taskId } = requestBody;

    if (!telegramInitData || !taskId) {
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
        const result = await prisma.$transaction(async (prisma) => {
            // Find the user
            const dbUser = await prisma.user.findUnique({
                where: { telegramId },
                include: { referrals: true }
            });

            if (!dbUser) {
                throw new Error('User not found');
            }

            // Find the task
            const task = await prisma.task.findUnique({
                where: { id: taskId },
            });

            if (!task) {
                throw new Error('Task not found');
            }

            // Check if the task is active
            if (!task.isActive) {
                throw new Error('This task is no longer active');
            }

            // Check if the task is of type REFERRAL
            if (task.type !== 'REFERRAL') {
                throw new Error('Invalid task type for this operation');
            }

            // Find the user's task
            const userTask = await prisma.userTask.findUnique({
                where: {
                    userId_taskId: {
                        userId: dbUser.id,
                        taskId: task.id,
                    },
                },
            });

            if (userTask?.isCompleted) {
                throw new Error('Task already completed');
            }

            if (task.type !== 'REFERRAL' || !task.taskData) {
                throw new Error('Invalid task type or missing task data for this operation');
            }

            // Safely access friendsNumber with a default value
            const requiredReferrals = (task.taskData as any).friendsNumber || 0;
            const currentReferrals = dbUser.referrals.length;

            if (currentReferrals < requiredReferrals) {
                return {
                    success: false,
                    message: `You need ${requiredReferrals - currentReferrals} more referrals to complete this task.`,
                    currentReferrals,
                    requiredReferrals,
                };
            }

            // Update or create the UserTask as completed
            const updatedUserTask = await prisma.userTask.upsert({
                where: {
                    userId_taskId: {
                        userId: dbUser.id,
                        taskId: task.id,
                    },
                },
                update: {
                    isCompleted: true,
                },
                create: {
                    userId: dbUser.id,
                    taskId: task.id,
                    isCompleted: true,
                },
            });

            // Add points to user's balance
            await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    points: { increment: task.points },
                    pointsBalance: { increment: task.points },
                },
            });

            return {
                success: true,
                message: 'Task completed successfully',
                isCompleted: updatedUserTask.isCompleted,
                currentReferrals,
                requiredReferrals,
            };
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error checking referral task:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check referral task' }, { status: 500 });
    }
}