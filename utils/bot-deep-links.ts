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
