import {
  answerCallbackQuery,
  sendTelegramMessage,
  type InlineKeyboard,
} from '@/utils/telegram-bot';
import {
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

function isSpanish(lang?: string): boolean {
  return (lang || '').toLowerCase().startsWith('es');
}

function mainKeyboard(lang?: string): InlineKeyboard {
  const es = isSpanish(lang);
  const web = webAppUrl();
  const row1: InlineKeyboard[number] = web
    ? [
        { text: es ? '🚀 Abrir Shiba Miner' : '🚀 Open Shiba Miner', web_app: { url: web } },
      ]
    : [{ text: es ? '🚀 Abrir Shiba Miner' : '🚀 Open Shiba Miner', url: miniAppUrl() }];

  const row2: InlineKeyboard[number] = [
    { text: es ? '⛏ Cómo minar' : '⛏ How mining works', callback_data: 'help_mine' },
    { text: es ? '💰 Retiros' : '💰 Withdrawals', callback_data: 'help_withdraw' },
  ];

  const row3: InlineKeyboard[number] = [
    { text: es ? '📦 Planes' : '📦 Plans', callback_data: 'help_plans' },
    { text: es ? '👥 Invitar' : '👥 Referrals', callback_data: 'help_refs' },
  ];

  const row4: InlineKeyboard[number] = [
    { text: es ? '❓ FAQ' : '❓ FAQ', callback_data: 'help_faq' },
    { text: es ? '🆘 Soporte' : '🆘 Support', callback_data: 'help_support' },
  ];

  const links: InlineKeyboard[number] = [];
  const pay = payoutChannelLink();
  const qa = qaChannelLink();
  if (pay) links.push({ text: es ? '📡 Pagos en vivo' : '📡 Live payouts', url: pay });
  if (qa) links.push({ text: es ? '💬 Q&A' : '💬 Q&A channel', url: qa });
  links.push({ text: es ? '🌐 Abrir en Telegram' : '🌐 Open in Telegram', url: miniAppUrl() });

  return [row1, row2, row3, row4, links];
}

function welcomeText(name: string, lang?: string): string {
  const es = isSpanish(lang);
  const handle = botUsername();
  if (es) {
    return [
      `<b>Hola${name ? `, ${name}` : ''} 👋</b>`,
      ``,
      `Soy <b>@${handle}</b>, el asistente oficial de <b>Shiba Miner Pro</b>.`,
      ``,
      `Aquí puedes:`,
      `• Minar <b>SHIB</b> cada 5 minutos`,
      `• Activar planes de hashrate`,
      `• Completar quests y referir amigos`,
      `• Retirar a una wallet EVM (0x…)`,
      ``,
      `Usa los botones de abajo para empezar. Estoy disponible 24/7.`,
    ].join('\n');
  }
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

function helpMine(lang?: string): string {
  const es = isSpanish(lang);
  if (es) {
    return [
      `<b>⛏ Minería automática</b>`,
      ``,
      `1. Abre la app → pestaña <b>Miner</b>`,
      `2. Pulsa <b>START DIG</b>`,
      `3. Ganas <b>+1 SHIB cada 5 minutos</b>`,
      `4. Sigue minando aunque cierres Telegram — al volver se acredita lo pendiente`,
      ``,
      `También puedes reclamar el <b>Daily Bone</b> una vez al día.`,
    ].join('\n');
  }
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

function helpWithdraw(lang?: string): string {
  const es = isSpanish(lang);
  if (es) {
    return [
      `<b>💰 Retiros</b>`,
      ``,
      `• Mínimo: <b>1,424 SHIB</b> en el vault (Cash)`,
      `• Wallet: dirección EVM <code>0x…</code>`,
      `• Los pagos on-chain se publican para verificación en Shibarium`,
      ``,
      `Nunca compartas tu seed phrase. El bot nunca te pedirá claves privadas.`,
    ].join('\n');
  }
  return [
    `<b>💰 Withdrawals</b>`,
    ``,
    `• Minimum: <b>1,424 SHIB</b> in your Cash vault`,
    `• Wallet: EVM address <code>0x…</code>`,
    `• On-chain payouts are posted for Shibarium verification`,
    ``,
    `Never share your seed phrase. This bot will never ask for private keys.`,
  ].join('\n');
}

function helpPlans(lang?: string): string {
  const es = isSpanish(lang);
  if (es) {
    return [
      `<b>📦 Planes de mining</b>`,
      ``,
      `En <b>Plans</b> eliges un tier (~+40% ROI).`,
      `Puedes pagar con:`,
      `• SHIB (Ethereum)`,
      `• SHIB (BNB Chain)`,
      `• ETH o BNB a la misma dirección`,
      ``,
      `Elige la red correcta en tu wallet antes de enviar.`,
    ].join('\n');
  }
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

function helpRefs(lang?: string): string {
  const es = isSpanish(lang);
  if (es) {
    return [
      `<b>👥 Referidos</b>`,
      ``,
      `Abre <b>Pack</b>, copia o comparte tu link de invitación.`,
      `Cuando un amigo entra con tu link, ganas SHIB de bonus (más si es Premium).`,
    ].join('\n');
  }
  return [
    `<b>👥 Referrals</b>`,
    ``,
    `Open <b>Pack</b>, copy or share your invite link.`,
    `When a friend joins through it, you earn SHIB bonuses (more if they are Premium).`,
  ].join('\n');
}

function helpFaq(lang?: string): string {
  const es = isSpanish(lang);
  if (es) {
    return [
      `<b>❓ FAQ rápido</b>`,
      ``,
      `<b>¿Se detiene el minado al cerrar?</b> No — el servidor sigue contando.`,
      `<b>¿Cómo verifico un pago?</b> Cash → Live payouts → tap para abrir Shibariumscan.`,
      `<b>¿Qué es Earn?</b> Quests para ganar SHIB extra.`,
      ``,
      `Más tips en el canal de Q&A cuando esté vinculado.`,
    ].join('\n');
  }
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

function helpSupport(lang?: string): string {
  const es = isSpanish(lang);
  const support = process.env.SUPPORT_TELEGRAM || process.env.SUPPORT_USERNAME;
  const line = support
    ? es
      ? `Contacto: @${String(support).replace(/^@/, '')}`
      : `Contact: @${String(support).replace(/^@/, '')}`
    : es
      ? `Usa los botones de ayuda o abre la app y revisa Cash / Earn.`
      : `Use the help buttons or open the app and check Cash / Earn.`;
  if (es) {
    return [
      `<b>🆘 Soporte</b>`,
      ``,
      `Respuesta profesional y segura:`,
      `• No pedimos seeds ni claves privadas`,
      `• Verifica siempre los anuncios de @${botUsername()}`,
      ``,
      line,
    ].join('\n');
  }
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

function defaultReply(lang?: string): string {
  const es = isSpanish(lang);
  if (es) {
    return [
      `Gracias por escribir. Soy el asistente oficial de <b>Shiba Miner Pro</b>.`,
      ``,
      `Puedo ayudarte con minería, planes, retiros y referidos.`,
      `Elige una opción abajo o abre la app para empezar.`,
    ].join('\n');
  }
  return [
    `Thanks for reaching out. I'm the official <b>Shiba Miner Pro</b> assistant.`,
    ``,
    `I can help with mining, plans, withdrawals, and referrals.`,
    `Pick an option below or open the app to get started.`,
  ].join('\n');
}

function textForCallback(data: string, lang?: string): string {
  switch (data) {
    case 'help_mine':
      return helpMine(lang);
    case 'help_withdraw':
      return helpWithdraw(lang);
    case 'help_plans':
      return helpPlans(lang);
    case 'help_refs':
      return helpRefs(lang);
    case 'help_faq':
      return helpFaq(lang);
    case 'help_support':
      return helpSupport(lang);
    case 'menu':
      return welcomeText('', lang);
    default:
      return defaultReply(lang);
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
    const lang = cb.from?.language_code;
    const chatId = cb.message?.chat.id ?? cb.from?.id;
    const data = cb.data || 'menu';
    const fromId = cb.from?.id;

    await answerCallbackQuery({
      callbackQueryId: cb.id,
      text: isSpanish(lang) ? 'Listo' : 'Done',
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
            `<b>📣 Broadcast</b>`,
            ``,
            `Send to every numeric Telegram user in the DB:`,
            `<code>/broadcast Your message here</code>`,
            ``,
            `Preview audience size only:`,
            `<code>/broadcast_preview Hello miners</code>`,
            ``,
            `HTML is supported (keep it simple).`,
          ].join('\n'),
          parseMode: 'HTML',
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
      text: textForCallback(data, lang),
      parseMode: 'HTML',
      disablePreview: true,
      replyMarkup: { inline_keyboard: mainKeyboard(lang) },
    });
    return;
  }

  const msg = update.message;
  if (!msg?.chat?.id) return;
  if (msg.chat.type && msg.chat.type !== 'private') return;

  const lang = msg.from?.language_code;
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

    if (cmd === '/broadcast_preview' || cmd === '/broadcast') {
      const body = text.replace(/^\/broadcast(_preview)?(@\w+)?\s*/i, '').trim();
      if (!body) {
        await sendTelegramMessage({
          chatId: msg.chat.id,
          text: 'Usage: <code>/broadcast Message to all users</code>',
          parseMode: 'HTML',
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }
      const dryRun = cmd === '/broadcast_preview';
      const envelope = formatBroadcastEnvelope(body);

      if (dryRun) {
        const preview = await broadcastToAllUsers(envelope, { dryRun: true });
        await sendTelegramMessage({
          chatId: msg.chat.id,
          text: [
            `<b>Broadcast preview</b>`,
            `Targets: <b>${preview.total}</b>`,
            `Skipped invalid IDs: ${preview.skipped}`,
            ``,
            `<b>Message:</b>`,
            envelope,
          ].join('\n'),
          parseMode: 'HTML',
          replyMarkup: { inline_keyboard: jarvisKeyboard() },
        });
        return;
      }

      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: `JARVIS: broadcasting to users…`,
        parseMode: 'HTML',
      });
      const result = await broadcastToAllUsers(envelope);
      await sendTelegramMessage({
        chatId: msg.chat.id,
        text: [
          `<b>JARVIS · Broadcast complete</b>`,
          `Targets: ${result.total}`,
          `Sent: <b>${result.sent}</b>`,
          `Failed: ${result.failed}`,
          `Skipped: ${result.skipped}`,
        ].join('\n'),
        parseMode: 'HTML',
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

  let reply = defaultReply(lang);
  if (!text || lower.startsWith('/start') || lower === 'hi' || lower === 'hola' || lower === 'menu') {
    reply = welcomeText(name, lang);
  } else if (lower.includes('mine') || lower.includes('mina') || lower.includes('dig')) {
    reply = helpMine(lang);
  } else if (lower.includes('withdraw') || lower.includes('retiro') || lower.includes('cash')) {
    reply = helpWithdraw(lang);
  } else if (lower.includes('plan') || lower.includes('pay') || lower.includes('pago')) {
    reply = helpPlans(lang);
  } else if (lower.includes('refer') || lower.includes('amigo') || lower.includes('invite')) {
    reply = helpRefs(lang);
  } else if (lower.includes('faq') || lower.includes('help') || lower.includes('ayuda')) {
    reply = helpFaq(lang);
  } else if (lower.includes('support') || lower.includes('soporte')) {
    reply = helpSupport(lang);
  }

  await sendTelegramMessage({
    chatId: msg.chat.id,
    text: reply,
    parseMode: 'HTML',
    disablePreview: true,
    replyMarkup: { inline_keyboard: mainKeyboard(lang) },
  });
}
