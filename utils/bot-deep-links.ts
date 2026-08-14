const BOT_USERNAME = (process.env.NEXT_PUBLIC_BOT_USERNAME || 'Shiba_Inu_Miner_Bot').replace(
  /^@/,
  ''
);
const APP_SHORT_NAME = process.env.NEXT_PUBLIC_TG_APP_SHORT_NAME || 'SHIB';

/** Must match bypass user id in utils/server-checks.ts */
export const DEV_TELEGRAM_ID = 'undefined';

/** Deep link that opens the mini app with referral start param */
export function getReferralAppUrl(telegramId: string): string {
  const id = String(telegramId).trim();
  if (!id) return '';
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=kentId${id}`;
}

export function getBotUsername(): string {
  return BOT_USERNAME;
}

export function isBypassTelegramAuth(): boolean {
  return process.env.NEXT_PUBLIC_BYPASS_TELEGRAM_AUTH === 'true';
}

/** Parse referrer id from Telegram start_param (e.g. kentId123456) */
export function parseReferrerFromStartParam(startParam?: string | null): string | null {
  if (!startParam) return null;
  const raw = String(startParam).replace(/^kentId/i, '').trim();
  return raw || null;
}

/** Optional deep-link view after boot (default miner home) */
export function resolveStartView(startParam?: string | null): string {
  if (!startParam) return 'game';
  const p = String(startParam).toLowerCase();
  if (p.includes('mine') || p.includes('plans')) return 'mine';
  if (p.includes('friends') || p.includes('pack') || p.includes('ref')) return 'friends';
  if (p.includes('earn') || p.includes('tasks')) return 'earn';
  if (p.includes('airdrop') || p.includes('cash') || p.includes('withdraw')) return 'airdrop';
  return 'game';
}
