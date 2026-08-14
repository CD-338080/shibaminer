// components/PointSynchronizer.tsx

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

import { useEffect, useCallback, useRef, useState } from 'react';
import { useGameStore } from '@/utils/game-mechanics';
import { useToast } from '@/contexts/ToastContext';

export function PointSynchronizer() {
    const showToast = useToast();
    const {
        userTelegramInitData,
        energy,
        unsynchronizedPoints,
        lastClickTimestamp,
        resetUnsynchronizedPoints
    } = useGameStore();

    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const syncWithServer = useCallback(async () => {
        if (unsynchronizedPoints < 1 || isSyncing) return;
        setIsSyncing(true);
        const pointsToSync = unsynchronizedPoints;
        const syncTimestamp = Date.now();
        //showToast(`Trying to synchronize ${pointsToSync}`, 'success');

        try {
            console.log("Sending data to server:", {
                initData: userTelegramInitData,
                unsynchronizedPoints: pointsToSync,
                currentEnergy: energy,
                syncTimestamp,
            });

            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    initData: userTelegramInitData,
                    unsynchronizedPoints: pointsToSync,
                    currentEnergy: energy,
                    syncTimestamp,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to sync with server: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            console.log("Data from server: ", data);

            resetUnsynchronizedPoints(pointsToSync);
            //showToast(`Successfully synchronized! Points synced: ${pointsToSync}`, 'success');
        } catch (error) {
            showToast(`Error syncing with server: ${error instanceof Error ? error.message : String(error)}`, 'error');
            console.error('Error syncing with server:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [userTelegramInitData, unsynchronizedPoints, energy, resetUnsynchronizedPoints]);

    useEffect(() => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        console.log("unsynchronizedPoints", unsynchronizedPoints);
        syncTimeoutRef.current = setTimeout(() => {
            if (unsynchronizedPoints > 1) {
                syncWithServer();
            }
        }, 2000);

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [lastClickTimestamp, unsynchronizedPoints, syncWithServer]);

    return null;
}