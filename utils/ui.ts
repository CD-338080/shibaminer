// utils/ui.ts

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

export const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
};

export const capitalizeFirstLetter = (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1);
}


type TelegramWindow = Window & typeof globalThis & {
    Telegram?: {
        WebApp?: {
            HapticFeedback: {
                impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
                notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
            };
        };
    };
};

export function triggerHapticFeedback(
    telegramWebApp: TelegramWindow | Window = window,
    style: 'light' | 'medium' | 'heavy' = 'medium'
) {
    if (!telegramWebApp) return;

    const vibrationEnabled = localStorage.getItem('vibrationEnabled') !== 'false';
    if (!vibrationEnabled) return;

    const hapticFeedback = (telegramWebApp as TelegramWindow).Telegram?.WebApp?.HapticFeedback;
    if (hapticFeedback?.impactOccurred) {
        hapticFeedback.impactOccurred(style);
    }
}

export function triggerHapticNotification(
    type: 'error' | 'success' | 'warning' = 'success',
    telegramWebApp: TelegramWindow | Window = window
) {
    if (!telegramWebApp) return;

    const vibrationEnabled = localStorage.getItem('vibrationEnabled') !== 'false';
    if (!vibrationEnabled) return;

    const hapticFeedback = (telegramWebApp as TelegramWindow).Telegram?.WebApp?.HapticFeedback;
    if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred(type);
    } else if (hapticFeedback?.impactOccurred) {
        hapticFeedback.impactOccurred(type === 'error' ? 'heavy' : 'medium');
    }
}
