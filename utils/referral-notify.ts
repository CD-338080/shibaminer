import { sendTelegramMessage } from '@/utils/telegram-bot';
import { broadcastKeyboard } from '@/utils/bot-jarvis';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatReferralAlert(opts: {
  newbieName: string;
  isPremium: boolean;
  bonusShib: number;
}): string {
  const name = escapeHtml((opts.newbieName || 'A new miner').trim() || 'A new miner');
  const premiumLine = opts.isPremium
    ? `⭐ <b>TELEGRAM PREMIUM</b> invite — big bonus unlocked`
    : `🐕 Standard invite — still stacking your Pack`;

  return [
    `🔥🔥🔥`,
    `<b>NEW REFERRAL ALERT</b>`,
    `━━━━━━━━━━━━━━━━`,
    ``,
    `Someone just joined <b>Shiba Miner Pro</b> with YOUR link!`,
    ``,
    `👤 Miner: <b>${name}</b>`,
    premiumLine,
    `💰 Vault credit: <b>+${fmt(opts.bonusShib)} SHIB</b>`,
    ``,
    `🚀 Keep sharing your Pack invite — every friend = more SHIB.`,
    `━━━━━━━━━━━━━━━━`,
    `#SHIB #Pack #Referral`,
  ].join('\n');
}

/** Notify referrer via bot DM. Never throws to the caller. */
export async function notifyReferrerOfNewInvite(opts: {
  referrerTelegramId: string;
  newbieName: string;
  isPremium: boolean;
  bonusShib: number;
}): Promise<void> {
  const chatId = String(opts.referrerTelegramId || '').trim();
  if (!chatId || !/^\d+$/.test(chatId)) return;

  try {
    const sent = await sendTelegramMessage({
      chatId,
      text: formatReferralAlert(opts),
      parseMode: 'HTML',
      disablePreview: true,
      replyMarkup: { inline_keyboard: broadcastKeyboard() },
    });
    if (!sent.ok) {
      console.warn('referral notify failed', sent.error, { chatId });
    }
  } catch (e) {
    console.warn('referral notify error', e);
  }
}
