// app/api/admin/tasks/[id]/route.ts

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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const isLocalhost = req.headers.get('host')?.includes('localhost');
    const isAdminAccessEnabled = process.env.ACCESS_ADMIN === 'true';

    if (!isLocalhost || !isAdminAccessEnabled) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const taskData = await req.json();

        // Remove the id from the taskData
        const { id, ...updateData } = taskData;

        const task = await prisma.task.update({
            where: { id: params.id },
            data: updateData,
        });

        return NextResponse.json(task);
    } catch (error) {
        console.error('Update task error:', error);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}