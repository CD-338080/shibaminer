/** Telegram Bot API helpers */

type InlineButton =
  | { text: string; url: string }
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };

export type InlineKeyboard = InlineButton[][];

function botToken(): string | null {
  return process.env.BOT_TOKEN || null;
}

export async function telegramApi(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; result?: unknown }> {
  const token = botToken();
  if (!token) return { ok: false, error: 'BOT_TOKEN missing' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string; result?: unknown };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${res.status}` };
    }
    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'request_failed' };
  }
}

export async function sendTelegramMessage(opts: {
  chatId?: string | number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disablePreview?: boolean;
  replyMarkup?: { inline_keyboard: InlineKeyboard };
}): Promise<{ ok: boolean; error?: string; result?: unknown }> {
  const chatId = opts.chatId ?? process.env.PAYOUT_CHANNEL_ID;
  if (!chatId) return { ok: false, error: 'chat_id missing' };

  return telegramApi('sendMessage', {
    chat_id: chatId,
    text: opts.text,
    parse_mode: opts.parseMode || 'HTML',
    disable_web_page_preview: opts.disablePreview ?? false,
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

export async function answerCallbackQuery(opts: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  return telegramApi('answerCallbackQuery', {
    callback_query_id: opts.callbackQueryId,
    text: opts.text,
    show_alert: opts.showAlert ?? false,
  });
}

export async function setTelegramWebhook(url: string, secret?: string) {
  return telegramApi('setWebhook', {
    url,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
    ...(secret ? { secret_token: secret } : {}),
  });
}

export async function getTelegramWebhookInfo() {
  return telegramApi('getWebhookInfo', {});
}
