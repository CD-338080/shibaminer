// app/api/onchain-tasks/check/route.ts

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
import { getHttpEndpoint } from '@orbs-network/ton-access';
import { Address, TonClient } from '@ton/ton';

interface NFTCheckResult {
    success: boolean;
    error?: string;
    status?: number;
}

async function checkNFTOwnership(contractAddress: string, userAddress: string): Promise<NFTCheckResult> {
    try {
        const endpoint = 'https://toncenter.com/api/v2/getTransactions';
        const apiKey = process.env.TONCENTER_API_KEY;

        if (!apiKey) {
            return {
                success: false,
                error: 'API configuration error. Please try again later.',
                status: 503 // Service Unavailable
            };
        }

        const contractAddr = Address.parse(contractAddress);
        const userAddr = Address.parse(userAddress);

        console.log("Checking NFT ownership:");
        console.log("Contract address:", contractAddr.toString());
        console.log("User address:", userAddr.toString());

        try {
            const response = await fetch(
                `${endpoint}?` + new URLSearchParams({
                    address: userAddr.toString(),
                    limit: '50',
                    to_lt: '0',
                    archival: 'true',
                    api_key: apiKey
                }),
                {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json',
                        'X-API-Key': apiKey
                    }
                }
            );

            if (!response.ok) {
                return {
                    success: false,
                    error: 'TON API service is currently unavailable. Please try again later.',
                    status: 503
                };
            }

            const data = await response.json();
            const transactions = data.result || [];

            console.log("Found transactions:", transactions.length);

            // Check transactions
            for (const tx of transactions) {
                // Check in_msg
                if (tx.in_msg) {
                    if (tx.in_msg.source === contractAddr.toString()) {
                        console.log("Found incoming message from contract");
                        return { success: true, status: 200 };
                    }

                    // Check for NFT transfer messages
                    if (tx.in_msg.msg_data && typeof tx.in_msg.msg_data === 'object') {
                        const msgText = tx.in_msg.msg_data.text || '';
                        if (msgText.includes('Mint') || msgText.includes('NFT')) {
                            console.log("Found NFT-related message:", msgText);
                            return { success: true, status: 200 };
                        }
                    }
                }

                // Check out_msgs
                if (tx.out_msgs && Array.isArray(tx.out_msgs)) {
                    for (const msg of tx.out_msgs) {
                        if (msg.destination === contractAddr.toString()) {
                            // Check for NFT transfer or mint messages
                            if (msg.msg_data && typeof msg.msg_data === 'object') {
                                const msgText = msg.msg_data.text || '';
                                if (msgText.includes('Mint') || msgText.includes('NFT')) {
                                    console.log("Found NFT-related outgoing message:", msgText);
                                    return { success: true, status: 200 };
                                }
                            }

                            // Check for value transfers to contract
                            if (msg.value && parseInt(msg.value) > 0) {
                                console.log("Found value transfer to contract");
                                return { success: true, status: 200 };
                            }
                        }
                    }
                }
            }

            return {
                success: false,
                error: 'You have not minted an NFT from this collection yet',
                status: 400 // Bad Request - user hasn't met the requirements
            };

        } catch (error) {
            console.log("Error fetching transactions:", error);
            return {
                success: false,
                error: 'Unable to verify NFT ownership. Please try again later.',
                status: 503
            };
        }

    } catch (error) {
        console.error('Error checking NFT ownership:', error);
        return {
            success: false,
            error: 'Unable to verify NFT ownership. Please try again later.',
            status: 503
        };
    }
}

interface CheckOnchainTaskRequestBody {
    initData: string;
    taskId: string;
}

export async function POST(req: Request) {
    const requestBody: CheckOnchainTaskRequestBody = await req.json();
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
                return { error: 'User not found', status: 404 };
            }

            if (!dbUser.tonWalletAddress) {
                return { error: 'User has no connected wallet', status: 400 };
            }

            // Find the task
            const task = await prisma.onchainTask.findUnique({
                where: { id: taskId },
            });

            if (!task) {
                return { error: 'Task not found', status: 404 };
            }

            // Check if the task is active
            if (!task.isActive) {
                return { error: 'This task is no longer active', status: 400 };
            }

            // Check if the user has already completed this task
            const existingCompletion = await prisma.onchainTaskCompletion.findFirst({
                where: {
                    onchainTaskId: task.id,
                    userId: dbUser.id,
                },
            });

            if (existingCompletion) {
                return {
                    error: 'You have already completed this task',
                    status: 400,
                };
            }

            // Check if the wallet address has already completed this task
            const walletCompletion = await prisma.onchainTaskCompletion.findFirst({
                where: {
                    onchainTaskId: task.id,
                    userWalletAddress: dbUser.tonWalletAddress,
                },
            });

            if (walletCompletion) {
                return {
                    error: 'This wallet address has already completed this task',
                    status: 400,
                };
            }

            // Check NFT ownership with improved error handling
            const nftCheckResult = await checkNFTOwnership(
                task.smartContractAddress,
                dbUser.tonWalletAddress
            );

            if (!nftCheckResult.success) {
                return {
                    error: nftCheckResult.error,
                    status: nftCheckResult.status
                };
            }

            // Create the OnchainTaskCompletion
            await prisma.onchainTaskCompletion.create({
                data: {
                    userId: dbUser.id,
                    onchainTaskId: task.id,
                    userWalletAddress: dbUser.tonWalletAddress,
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
                status: 200,
            };
        });

        return NextResponse.json(
            { message: result.message || result.error, success: result.success },
            { status: result.status }
        );

    } catch (error) {
        console.error('Error checking onchain task:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to check onchain task' },
            { status: 500 }
        );
    }
}