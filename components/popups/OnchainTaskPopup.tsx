// components/popups/OnchainTaskPopup.tsx

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

'use client'

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import IceCube from '@/icons/IceCube';
import { formatNumber, triggerHapticFeedback } from '@/utils/ui';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useToast } from '@/contexts/ToastContext';
import { Address, beginCell, fromNano, toNano } from '@ton/core';
import { useGameStore } from '@/utils/game-mechanics';

interface OnchainTask {
    id: string;
    smartContractAddress: string;
    price: string;
    collectionMetadata: {
        name: string;
        description: string;
        image: string;
    };
    itemMetadata: any;
    points: number;
    isActive: boolean;
    isCompleted: boolean;
}

interface OnchainTaskPopupProps {
    task: OnchainTask;
    onClose: () => void;
    onUpdate: (updatedTask: OnchainTask) => void;
}

const OnchainTaskPopup: React.FC<OnchainTaskPopupProps> = React.memo(({ task, onClose, onUpdate }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [tonConnectUI] = useTonConnectUI();
    const showToast = useToast();
    const { userTelegramInitData, incrementPoints } = useGameStore();

    const handleMint = useCallback(async () => {
        if (!tonConnectUI.account) {
            showToast('Please connect your TON wallet first', 'error');
            return;
        }

        setIsLoading(true);
        try {
            triggerHapticFeedback(window);

            const nftCollectionAddress = Address.parse(task.smartContractAddress);
            const userAddress = Address.parse(tonConnectUI.account.address);
            const totalMintCost = BigInt(task.price) + BigInt(toNano(0.05));

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 60,
                messages: [
                    {
                        address: nftCollectionAddress.toString(),
                        amount: totalMintCost.toString(),
                        payload: beginCell().storeUint(0, 32).storeStringTail("Mint").endCell().toBoc().toString('base64'),
                    },
                ],
            });

            showToast('Minting transaction sent successfully!', 'success');
        } catch (error) {
            console.error('Error minting NFT:', error);
            showToast('Error minting NFT. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [task, tonConnectUI, showToast]);

    const handleCheck = useCallback(async () => {
        setIsLoading(true);
        try {
            triggerHapticFeedback(window);
            const response = await fetch('/api/onchain-tasks/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    initData: userTelegramInitData,
                    taskId: task.id,
                }),
            });

            const data = await response.json();

            // Even if response.ok is false, we want to show the message from the server
            if (data.success) {
                incrementPoints(task.points);
                const updatedTask = { ...task, isCompleted: true };
                onUpdate(updatedTask);
                showToast(data.message || 'Task completed successfully!', 'success');
                onClose(); // Close the popup after successful completion
            } else {
                // Show the error message from the server
                showToast(data.error || data.message || 'Failed to complete task. Please try again.', 'error');
            }
        } catch (error) {
            // This will only trigger for network errors or other exceptions
            console.error('Error checking NFT:', error);
            showToast('Error checking NFT. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [task, userTelegramInitData, incrementPoints, showToast, onClose, onUpdate]);

    const handleClose = useCallback(() => {
        triggerHapticFeedback(window);
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 280); // Match this to the animation duration
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
            <div className={`bg-[#272a2f] rounded-t-3xl p-6 w-full max-w-xl ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
                <div className="flex justify-between items-center mb-4">
                    <div className="w-8"></div>
                    <h2 className="text-3xl text-white text-center font-bold">{task.collectionMetadata.name}</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <Image src={task.collectionMetadata.image} alt={task.collectionMetadata.name} width={80} height={80} className="mx-auto mb-4 rounded-lg" />
                <p className="text-gray-300 text-center mb-4">{task.collectionMetadata.description}</p>
                <div className="flex justify-center items-center mb-4">
                    <IceCube className="w-6 h-6" />
                    <span className="text-white font-bold text-2xl ml-1">+{formatNumber(task.points)}</span>
                </div>
                <p className="text-center mb-4">Price: {formatTON(task.price)} TON</p>
                {task.isCompleted ? (
                    <button
                        className="w-full py-6 text-xl font-bold bg-green-500 text-white rounded-2xl flex items-center justify-center"
                        disabled
                    >
                        Completed
                    </button>
                ) : (
                    <>
                        <button
                            className={`w-full py-6 text-xl font-bold text-white rounded-2xl flex items-center justify-center ${isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-500'
                                }`}
                            onClick={handleMint}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-t-2 border-white border-solid rounded-full animate-spin"></div>
                            ) : (
                                'Mint NFT'
                            )}
                        </button>
                        <button
                            className={`w-full mt-4 py-6 text-xl font-bold text-white rounded-2xl flex items-center justify-center ${isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500'
                                }`}
                            onClick={handleCheck}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-t-2 border-white border-solid rounded-full animate-spin"></div>
                            ) : (
                                'Check'
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});

OnchainTaskPopup.displayName = 'OnchainTaskPopup';

// Helper function to format TON amount
function formatTON(nanoTON: string): string {
    return (parseInt(nanoTON) / 1e9).toFixed(2);
}

export default OnchainTaskPopup;