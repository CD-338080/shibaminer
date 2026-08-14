import {
  answerCallbackQuery,
  sendTelegramMessage,
  type InlineKeyboard,
} from '@/utils/telegram-bot';
import {
  broadcastKeyboard,
  broadcastToAllUsers,
  formatBroadcastEnvelope,
  getAppGrowthReport,
  getJarvisBrief,
  isJarvisAdmin,
  jarvisKeyboard,
  lookupUser,
} from '@/utils/bot-jarvis';

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

function webAppUrl(): string | null {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/clicker`;
}

function payoutChannelLink(): string | null {
  // Prefer public username if set; else omit
  const user = process.env.PAYOUT_CHANNEL_USERNAME?.replace(/^@/, '');
  if (user) return `https://t.me/${user}`;
  return null;
}

function qaChannelLink(): string | null {
  const user = process.env.QA_CHANNEL_USERNAME?.replace(/^@/, '');
  if (user) return `https://t.me/${user}`;
  return null;
}

function mainKeyboard(): InlineKeyboard {
  const web = webAppUrl();
  const row1: InlineKeyboard[number] = web
    ? [{ text: '🚀 Open Shiba Miner', web_app: { url: web } }]
    : [{ text: '🚀 Open Shiba Miner', url: miniAppUrl() }];

  const row2: InlineKeyboard[number] = [
    { text: '⛏ How mining works', callback_data: 'help_mine' },
    { text: '💰 Withdrawals', callback_data: 'help_withdraw' },
  ];

  const row3: InlineKeyboard[number] = [
    { text: '📦 Plans', callback_data: 'help_plans' },
    { text: '👥 Referrals', callback_data: 'help_refs' },
  ];

  const row4: InlineKeyboard[number] = [
    { text: '❓ FAQ', callback_data: 'help_faq' },
    { text: '🆘 Support', callback_data: 'help_support' },
  ];

  const links: InlineKeyboard[number] = [];
  const pay = payoutChannelLink();
  const qa = qaChannelLink();
  if (pay) links.push({ text: '📡 Live payouts', url: pay });
  if (qa) links.push({ text: '💬 Q&A channel', url: qa });
  links.push({ text: '🌐 Open in Telegram', url: miniAppUrl() });

  return [row1, row2, row3, row4, links];
}

function welcomeText(name: string): string {
  const handle = botUsername();
  return [
    `<b>Hello${name ? `, ${name}` : ''} 👋</b>`,
    ``,
    `I'm <b>@${handle}</b>, the official assistant for <b>Shiba Miner Pro</b>.`,
    ``,
    `With the mini app you can:`,
    `• Mine <b>SHIB</b> every 5 minutes`,
    `• Activate hashrate plans`,
    `• Complete quests & invite friends`,
    `• Withdraw to an EVM wallet (0x…)`,
    ``,
    `Use the buttons below to get started. I'm online 24/7.`,
  ].join('\n');
}

function helpMine(): string {
  return [
    `<b>⛏ Auto mining</b>`,
    ``,
    `1. Open the app → <b>Miner</b> tab`,
    `2. Tap <b>START DIG</b>`,
    `3. Earn <b>+1 SHIB every 5 minutes</b>`,
    `4. Mining continues offline — reopen to sync pending SHIB`,
    ``,
    `You can also claim the free <b>Daily Bone</b> once per day.`,
  ].join('\n');
}

function helpWithdraw(): string {
  return [
    `<b>💰 Withdrawals</b>`,
    ``,
    `• Minimum: <b>22,321,428.57 SHIB</b> in your Cash vault`,
    `• Also need at least <b>10 referrals</b> (Pack)`,
    `• Wallet: EVM address <code>0x…</code>`,
    `• On-chain payouts are posted for Shibarium verification`,
    ``,
    `Never share your seed phrase. This bot will never ask for private keys.`,
  ].join('\n');
}

function helpPlans(): string {
  return [
    `<b>📦 Mining plans</b>`,
    ``,
    `In <b>Plans</b> pick a tier (~+40% ROI).`,
    `You can pay with:`,
    `• SHIB (Ethereum)`,
    `• SHIB (BNB Chain)`,
    `• ETH or BNB to the same address`,
    ``,
    `Always select the matching network in your wallet before sending.`,
  ].join('\n');
}

function helpRefs(): string {
  return [
    `<b>👥 Referrals</b>`,
    ``,
    `Open <b>Pack</b>, copy or share your invite link.`,
    `When a friend joins through it, you earn SHIB bonuses (more if they are Premium).`,
  ].join('\n');
}

function helpFaq(): string {
  return [
    `<b>❓ Quick FAQ</b>`,
    ``,
    `<b>Does mining stop when I close the app?</b> No — the server keeps counting.`,
    `<b>How do I verify a payout?</b> Cash → Live payouts → tap to open Shibariumscan.`,
    `<b>What is Earn?</b> Quests for extra SHIB.`,
    ``,
    `More tips appear on the Q&A channel when linked.`,
  ].join('\n');
}

function helpSupport(): string {
  const support = process.env.SUPPORT_TELEGRAM || process.env.SUPPORT_USERNAME;
  const line = support
    ? `Contact: @${String(support).replace(/^@/, '')}`
    : `Use the help buttons or open the app and check Cash / Earn.`;
  return [
    `<b>🆘 Support</b>`,
    ``,
    `Professional & secure assistance:`,
    `• We never ask for seeds or private keys`,
    `• Only trust announcements from @${botUsername()}`,
    ``,
    line,
  ].join('\n');
}

function defaultReply(): string {
  return [
    `Thanks for reaching out. I'm the official <b>Shiba Miner Pro</b> assistant.`,
    ``,
    `I can help with mining, plans, withdrawals, and referrals.`,
    `Pick an option below or open the app to get started.`,
  ].join('\n');
}

function textForCallback(data: string): string {
  switch (data) {
    case 'help_mine':
      return helpMine();
    case 'help_withdraw':
      return helpWithdraw();
    case 'help_plans':
      return helpPlans();
    case 'help_refs':
      return helpRefs();
    case 'help_faq':
      return helpFaq();
    case 'help_support':
      return helpSupport();
    case 'menu':
      return welcomeText('');
    default:
      return defaultReply();
  }
}

export type TgUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string; language_code?: string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number; first_name?: string; language_code?: string };
    message?: { chat: { id: number }; message_id: number };
  };
};

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat.id ?? cb.from?.id;
    const data = cb.data || 'menu';
    const fromId = cb.from?.id;

    await answerCallbackQuery({
      callbackQueryId: cb.id,
      text: 'Done',
    });

    if (!chatId) return;

    if (data.startsWith('jarvis_')) {
      if (!isJarvisAdmin(fromId)) {
        await sendTelegramMessage({
          chatId,
          text: 'Unauthorized.',
          parseMode: 'HTML',
        });
        return;
      }
      if (data === 'jarvis_growth') {
        const report = await getAppGrowthReport();
        await sendTelegramMessage({
          chatId,
          text: report,
          parseMode: 'HTML',
          disablePreview: true,
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }
      if (data === 'jarvis_stats') {
        const brief = await getJarvisBrief();
        await sendTelegramMessage({
          chatId,
          text: brief,
          parseMode: 'HTML',
          disablePreview: true,
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }
      if (data === 'jarvis_bcast_help') {
        await sendTelegramMessage({
          chatId,
          text: [
            `<b>📣 /send — mass DM</b>`,
            ``,
            `Users receive <b>only your text</b> (no announcement header).`,
            `<code>/send Your message here</code>`,
            ``,
            `Preview (no send):`,
            `<code>/send_preview Hello miners</code>`,
            ``,
            `User DMs get: <b>Open Shiba Miner</b> only.`,
            `Admin-only: <b>Promotion</b> button on this Jarvis menu.`,
            ``,
            `HTML is supported (keep it simple).`,
          ].join('\n'),
          parseMode: 'HTML',
          disablePreview: true,
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }
      // jarvis_home
      const home = await getJarvisBrief();
      await sendTelegramMessage({
        chatId,
        text: home,
        parseMode: 'HTML',
        replyMarkup: { inline_keyboard: jarvisKeyboard() },
      });
      return;
    }

    await sendTelegramMessage({
      chatId,
      text: textForCallback(data),
      parseMode: 'HTML',
      disablePreview: true,
      replyMarkup: { inline_keyboard: mainKeyboard() },
    });
    return;
  }

  const msg = update.message;
  if (!msg?.chat?.id) return;
  if (msg.chat.type && msg.chat.type !== 'private') return;

  const name = msg.from?.first_name || '';
  const text = (msg.text || '').trim();
  const lower = text.toLowerCase();
  const fromId = msg.from?.id;

  // ——— Jarvis admin ———
  if (isJarvisAdmin(fromId)) {
    const cmd = lower.split(/\s+/)[0]?.split('@')[0] || '';

    if (cmd === '/growth') {
      const report = await getAppGrowthReport();
      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: report,
        parseMode: 'HTML',
        disablePreview: true,
        replyMarkup: { inline_keyboard: jarvisKeyboard() },
      });
      return;
    }

    if (cmd === '/stats') {
      const brief = await getJarvisBrief();
      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: brief,
        parseMode: 'HTML',
        disablePreview: true,
        replyMarkup: { inline_keyboard: jarvisKeyboard() },
      });
      return;
    }

    if (cmd === '/user') {
      const id = text.split(/\s+/)[1];
      if (!id) {
        await sendTelegramMessage({
          chatId: msg.chat.id,
          text: 'Usage: <code>/user 123456789</code>',
          parseMode: 'HTML',
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }
      const info = await lookupUser(id);
      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: info,
        parseMode: 'HTML',
        replyMarkup: { inline_keyboard: jarvisKeyboard() },
      });
      return;
    }

    if (
      cmd === '/send' ||
      cmd === '/send_preview' ||
      cmd === '/broadcast' ||
      cmd === '/broadcast_preview'
    ) {
      const body = text
        .replace(/^\/(send|broadcast)(_preview)?(@\w+)?\s*/i, '')
        .trim();
      if (!body) {
        await sendTelegramMessage({
          chatId: msg.chat.id,
          text: [
            `<b>Usage</b>`,
            `<code>/send Your message here</code>`,
            `<code>/send_preview Draft message</code>`,
            ``,
            `Users see only your text + Open Shiba Miner.`,
            `Promotion stays on the admin Jarvis menu.`,
          ].join('\n'),
          parseMode: 'HTML',
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }
      const dryRun = cmd === '/send_preview' || cmd === '/broadcast_preview';
      const envelope = formatBroadcastEnvelope(body);
      const buttons = broadcastKeyboard();

      if (dryRun) {
        const preview = await broadcastToAllUsers(envelope, { dryRun: true });
        await sendTelegramMessage({
          chatId: msg.chat.id,
          text: [
            `<b>/send preview</b>`,
            `Targets: <b>${preview.total}</b>`,
            `Skipped invalid IDs: ${preview.skipped}`,
            ``,
            `<b>Message users will see:</b>`,
            envelope,
            ``,
            `<b>User button:</b> Open Shiba Miner`,
          ].join('\n'),
          parseMode: 'HTML',
          disablePreview: true,
          replyMarkup: { inline_keyboard: buttons },
        });
        return;
      }

      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: `JARVIS: /send in progress…`,
        parseMode: 'HTML',
      });
      const result = await broadcastToAllUsers(envelope, {
        replyMarkup: { inline_keyboard: buttons },
      });
      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: [
          `<b>JARVIS · /send complete</b>`,
          `Targets: ${result.total}`,
          `Sent: <b>${result.sent}</b>`,
          `Failed: ${result.failed}`,
          `Skipped: ${result.skipped}`,
        ].join('\n'),
        parseMode: 'HTML',
        disablePreview: true,
        replyMarkup: { inline_keyboard: jarvisKeyboard() },
      });
      return;
    }

    // Any other message from admin → open Jarvis (no command required)
    const home = await getJarvisBrief();
    await sendTelegramMessage({
      chatId: msg.chat.id,
      text: home,
      parseMode: 'HTML',
      replyMarkup: { inline_keyboard: jarvisKeyboard() },
    });
    return;
  }

  if (
    lower.startsWith('/jarvis') ||
    lower.startsWith('/send') ||
    lower.startsWith('/broadcast') ||
    lower.startsWith('/growth') ||
    lower.startsWith('/admin')
  ) {
    await sendTelegramMessage({
      chatId: msg.chat.id,
      text: 'Unauthorized. Jarvis is restricted to admin.',
      parseMode: 'HTML',
    });
    return;
  }

  let reply = defaultReply();
  if (!text || lower.startsWith('/start') || lower === 'hi' || lower === 'hola' || lower === 'menu') {
    reply = welcomeText(name);
  } else if (lower.includes('mine') || lower.includes('mina') || lower.includes('dig')) {
    reply = helpMine();
  } else if (lower.includes('withdraw') || lower.includes('retiro') || lower.includes('cash')) {
    reply = helpWithdraw();
  } else if (lower.includes('plan') || lower.includes('pay') || lower.includes('pago')) {
    reply = helpPlans();
  } else if (lower.includes('refer') || lower.includes('amigo') || lower.includes('invite')) {
    reply = helpRefs();
  } else if (lower.includes('faq') || lower.includes('help') || lower.includes('ayuda')) {
    reply = helpFaq();
  } else if (lower.includes('support') || lower.includes('soporte')) {
    reply = helpSupport();
  }

  await sendTelegramMessage({
    chatId: msg.chat.id,
    text: reply,
    parseMode: 'HTML',
    disablePreview: true,
    replyMarkup: { inline_keyboard: mainKeyboard() },
  });
}
