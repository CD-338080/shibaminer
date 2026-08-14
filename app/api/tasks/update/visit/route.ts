// app/api/tasks/update/visit/route.ts

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

interface UpdateTaskRequestBody {
    initData: string;
    taskId: string;
}

export async function POST(req: Request) {
    const requestBody: UpdateTaskRequestBody = await req.json();
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

            // Check if the task is of type VISIT
            if (task.type !== 'VISIT') {
                throw new Error('Invalid task type for this operation');
            }

            // Check if the user has already started this task
            const existingUserTask = await prisma.userTask.findUnique({
                where: {
                    userId_taskId: {
                        userId: dbUser.id,
                        taskId: task.id,
                    },
                },
            });

            if (existingUserTask) {
                throw new Error('Task already started');
            }

            // Create a new UserTask entry
            const userTask = await prisma.userTask.create({
                data: {
                    userId: dbUser.id,
                    taskId: task.id,
                    taskStartTimestamp: new Date(),
                    isCompleted: false,
                },
            });

            return userTask;
        });

        return NextResponse.json({
            success: true,
            message: 'Task started successfully',
            taskStartTimestamp: result.taskStartTimestamp,
        });

    } catch (error) {
        console.error('Error updating task:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update task' }, { status: 500 });
    }
}