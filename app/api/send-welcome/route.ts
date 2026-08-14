import { NextResponse } from 'next/server';
import { sendTelegramMessage, type InlineKeyboard } from '@/utils/telegram-bot';

function botUsername(): string {
  return (
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    process.env.PAYOUT_BOT_USERNAME ||
    'Shiba_Inu_Pro_Miner_Bot'
  ).replace(/^@/, '');
}

function appShortName(): string {
  return process.env.NEXT_PUBLIC_TG_APP_SHORT_NAME || 'SHIB';
}

function miniAppUrl(): string {
  return `https://t.me/${botUsername()}/${appShortName()}`;
}

function welcomeKeyboard(): InlineKeyboard {
  const openRow = [{ text: '🚀 Open Shiba Miner', url: miniAppUrl() }];

  return [
    openRow,
    [
      { text: '⛏ How mining works', callback_data: 'help_mine' },
      { text: '💰 Withdrawals', callback_data: 'help_withdraw' },
    ],
    [
      { text: '📦 Plans', callback_data: 'help_plans' },
      { text: '👥 Referrals', callback_data: 'help_refs' },
    ],
  ];
}

function englishWelcome(name: string): string {
  const handle = botUsername();
  const greet = name && name !== 'Unknown User' ? `, ${name}` : '';
  return [
    `<b>Welcome${greet} 👋</b>`,
    ``,
    `You're in <b>Shiba Miner Pro</b> — powered by @${handle}.`,
    ``,
    `<b>Quick start</b>`,
    `• Tap <b>START DIG</b> → earn <b>+1 SHIB every 5 minutes</b>`,
    `• Mining continues while Telegram is closed`,
    `• Claim your daily bone on the Miner home screen`,
    `• Boost hashrate in <b>Plans</b> (SHIB / ETH / BNB)`,
    `• Invite friends in <b>Pack</b> for bonus SHIB`,
    ``,
    `Withdrawals open from <b>Cash</b> once you hit the minimum vault balance.`,
    ``,
    `Never share seed phrases. We will never ask for private keys.`,
    ``,
    `Let's dig. 🐾`,
  ].join('\n');
}

/** In-memory once-per-process dedupe (also checked against localStorage-ish via query). */
const welcomed = new Set<string>();

/**
 * POST /api/send-welcome
 * Body: { telegramId: string, telegramName?: string }
 * Sends an English welcome DM with action buttons.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const telegramId = String(body.telegramId || '').trim();
    const telegramName = String(body.telegramName || '').trim();

    if (!/^\d+$/.test(telegramId)) {
      return NextResponse.json({ ok: false, error: 'invalid_telegram_id' }, { status: 400 });
    }

    if (!process.env.BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: 'BOT_TOKEN missing' }, { status: 500 });
    }

    const force = body.force === true;
    if (!force && welcomed.has(telegramId)) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already_welcomed' });
    }

    const sent = await sendTelegramMessage({
      chatId: telegramId,
      text: englishWelcome(telegramName),
      parseMode: 'HTML',
      disablePreview: true,
      replyMarkup: { inline_keyboard: welcomeKeyboard() },
    });

    if (!sent.ok) {
      return NextResponse.json({ ok: false, error: sent.error }, { status: 502 });
    }

    welcomed.add(telegramId);
    return NextResponse.json({ ok: true, sent: true });
  } catch (e) {
    console.error('send-welcome', e);
    return NextResponse.json({ ok: false, error: 'welcome_failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/send-welcome',
    language: 'en',
    hint: 'POST { telegramId, telegramName }',
  });
}
