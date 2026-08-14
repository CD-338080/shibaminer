// utils/server-checks.ts

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

import crypto from 'crypto';

interface ValidatedData {
  [key: string]: string;
}

interface User {
  id?: string;
  username?: string;
  first_name?: string;
  is_premium?: boolean;
}

interface ValidationResult {
  validatedData: ValidatedData | null;
  user: User;
  message: string;
}

export function validateTelegramWebAppData(telegramInitData: string): ValidationResult {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const BYPASS_AUTH = process.env.BYPASS_TELEGRAM_AUTH === 'true';

  console.log("validateTelegramWebAppData");
  console.log("telegramInitData", telegramInitData);

  let validatedData: ValidatedData | null = null;
  let user: User = {};
  let message = '';

  if (BYPASS_AUTH) {
    validatedData = { temp: '' };
    // Keep id as 'undefined' string for compatibility with existing local DB rows
    user = { id: 'undefined', username: 'Unknown User', first_name: 'Dev User' };
    message = 'Authentication bypassed for development';
  } else {
    if (!BOT_TOKEN) {
      return { message: 'BOT_TOKEN is not set', validatedData: null, user: {} };
    }

    const initData = new URLSearchParams(telegramInitData);
    const hash = initData.get('hash');
    
    if (!hash) {
      return { message: 'Hash is missing from initData', validatedData: null, user: {} };
    }

    initData.delete('hash');

    // Check if auth_date is present and not older than 3 hours
    const authDate = initData.get('auth_date');
    if (!authDate) {
      return { message: 'auth_date is missing from initData', validatedData: null, user: {} };
    }

    const authTimestamp = parseInt(authDate, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeDifference = currentTimestamp - authTimestamp;
    const threeHoursInSeconds = 3 * 60 * 60;

    if (timeDifference > threeHoursInSeconds) {
      return { message: 'Telegram data is older than 3 hours', validatedData: null, user: {} };
    }

    const dataCheckString = Array.from(initData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    console.log("Data Check String:", dataCheckString);

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    console.log("Calculated Hash:", calculatedHash);
    console.log("Received Hash:", hash);

    if (calculatedHash === hash) {
      validatedData = Object.fromEntries(initData.entries());
      message = 'Validation successful';
      const userString = validatedData['user'];
      if (userString) {
        try {
          user = JSON.parse(userString);
          console.log("Parsed user data:", user);
        } catch (error) {
          console.error('Error parsing user data:', error);
          message = 'Error parsing user data';
          validatedData = null;
        }
      } else {
        message = 'User data is missing';
        validatedData = null;
      }
    } else {
      message = 'Hash validation failed';
      console.log(message);
    }
  }

  return { validatedData, user, message };
}