// utils/user.ts

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

export function getUserTelegramId(initData: string): string | null {
  try {
    // Decode the URL-encoded string
    const decodedInitData = decodeURIComponent(initData);

    // Parse the query string
    const params = new URLSearchParams(decodedInitData);

    // Get the 'user' parameter and parse it as JSON
    const userString = params.get('user');
    if (!userString) {
      return null;
    }

    const user = JSON.parse(userString);
    return user.id?.toString() || null;
  } catch (error) {
    console.error('Error parsing initData:', error);
    return null;
  }
}