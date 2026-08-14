import { MongoClient, type Db } from 'mongodb';
import { sendTelegramMessage, normalizeTelegramChatId } from '@/utils/telegram-bot';

export type QaItem = {
  id: string;
  q: string;
  a: string;
};

/** Random FAQ about Shiba Miner Pro */
export const SHIBA_QA_BANK: QaItem[] = [
  {
    id: 'mine-interval',
    q: 'How often does the free miner pay SHIB?',
    a: 'When you tap START DIG, the pack earns +1 SHIB every 5 minutes — even while Telegram is closed. Open the app again to sync your vault.',
  },
  {
    id: 'withdraw-min',
    q: 'What is the minimum to withdraw?',
    a: 'You need at least 22,321,428.57 SHIB in your Cash vault and a minimum of 10 referrals (Pack) before you can request a withdrawal to an ERC-20 address.',
  },
  {
    id: 'pay-networks',
    q: 'Which networks can I use to buy a mining plan?',
    a: 'Plans accept SHIB on Ethereum, SHIB on BNB Chain (BSC), plus native ETH and BNB — all to the same payment address shown in Plans.',
  },
  {
    id: 'plans-roi',
    q: 'Do higher plans pay more ROI?',
    a: 'Every plan targets ~+40% ROI. Higher tiers finish that gain faster with more GH/s and a shorter contract.',
  },
  {
    id: 'verify-payout',
    q: 'How do I verify a payout is real?',
    a: 'Open Cash → Live SHIB payouts and tap any row. It opens the tx on Shibariumscan so you can verify on-chain.',
  },
  {
    id: 'daily-bone',
    q: 'What is the Daily Bone?',
    a: 'A free SHIB drop on the Miner home screen once per UTC day. Claim it to stack streak bonuses.',
  },
  {
    id: 'referrals',
    q: 'How do friend invites work?',
    a: 'Share your Pack invite link. When friends join through it, you earn SHIB referral bonuses (higher if they are Telegram Premium).',
  },
  {
    id: 'earn-quests',
    q: 'What is the Earn tab for?',
    a: 'Earn has quests (visit links, Telegram, referrals). Complete them to claim extra SHIB into your vault.',
  },
  {
    id: 'wallet-address',
    q: 'What wallet address do I need for cashout?',
    a: 'Use a standard EVM address starting with 0x (Ethereum / Shibarium compatible). Double-check the network before sending anything.',
  },
  {
    id: 'offline-mine',
    q: 'Does mining stop if I close the mini app?',
    a: 'No. The server keeps the dig timer. When you reopen, pending SHIB from completed 5-minute ticks is credited to your balance.',
  },
  {
    id: 'shib-token',
    q: 'Is the balance real SHIB?',
    a: 'In-app SHIB is your vault balance from mining, quests, and referrals. Withdrawals are processed on-chain and posted to the payouts channel for transparency.',
  },
  {
    id: 'boost-plan',
    q: 'How do I boost my hashrate?',
    a: 'Open Plans, pick a tier (Pup → Shogun), pay the shown amount on the selected network, then tap I Paid. Hashrate unlocks after confirmations.',
  },
  {
    id: 'wrong-network',
    q: 'What if I send on the wrong network?',
    a: 'Always match the network shown in the payment sheet (Ethereum vs BNB Chain). Sending on the wrong chain can mean lost funds.',
  },
  {
    id: 'leaderboard',
    q: 'What is the Cash leaderboard?',
    a: 'It ranks miners by live SHIB vault balance so you can see top packs and share your rank.',
  },
  {
    id: 'bot-from',
    q: 'Who posts the payout alerts?',
    a: 'Official payout posts are sent automatically by the mini app whenever Cash loads live SHIB txs — from @Shiba_Inu_Pro_Miner_Bot with a Shibarium explorer link.',
  },
];

type QaState = {
  lastIds: string[];
  lastAt: number;
};

const COL_META = 'app_meta';
const QA_META_KEY = 'qa_announce_pace';

declare global {
  // eslint-disable-next-line no-var
  var __shibQaMongo: MongoClient | undefined;
}

function databaseNameFromUri(uri: string): string | undefined {
  try {
    const part = uri.split('?')[0]?.split('/').pop();
    if (part && part.length > 0 && !part.includes('@')) return part;
  } catch {
    /* ignore */
  }
  return undefined;
}

async function getDb(): Promise<Db | null> {
  const uri = process.env.DATABASE_URL;
  if (!uri) return null;
  try {
    if (!global.__shibQaMongo) {
      global.__shibQaMongo = new MongoClient(uri);
      await global.__shibQaMongo.connect();
    }
    const name = databaseNameFromUri(uri) || 'telegram_clicker';
    return global.__shibQaMongo.db(name);
  } catch (e) {
    console.error('qa mongo connect failed', e);
    return null;
  }
}

async function loadState(db: Db | null): Promise<QaState> {
  if (!db) return { lastIds: [], lastAt: 0 };
  try {
    const row = await db.collection(COL_META).findOne({ key: QA_META_KEY });
    const v = (row?.value || {}) as Partial<QaState>;
    return {
      lastIds: Array.isArray(v.lastIds) ? v.lastIds.map(String).slice(-20) : [],
      lastAt: Number(v.lastAt) || 0,
    };
  } catch {
    return { lastIds: [], lastAt: 0 };
  }
}

async function saveState(db: Db | null, state: QaState): Promise<void> {
  if (!db) return;
  try {
    await db.collection(COL_META).updateOne(
      { key: QA_META_KEY },
      { $set: { key: QA_META_KEY, value: state } },
      { upsert: true }
    );
  } catch (e) {
    console.warn('qa-announce save failed', e);
  }
}

/** Q&A cadence: default every 24 hours (QA_ANNOUNCE_HOURS). */
export function qaIntervalMs(): number {
  if (process.env.QA_ANNOUNCE_MIN) {
    const mins = Number(process.env.QA_ANNOUNCE_MIN);
    if (Number.isFinite(mins) && mins > 0) return mins * 60 * 1000;
  }
  const hours = Number(process.env.QA_ANNOUNCE_HOURS);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return h * 60 * 60 * 1000;
}

function pickRandomQa(avoid: string[]): QaItem {
  const pool = SHIBA_QA_BANK.filter((item) => !avoid.includes(item.id));
  const list = pool.length ? pool : SHIBA_QA_BANK;
  return list[Math.floor(Math.random() * list.length)]!;
}

function botHandle(): string {
  const bot =
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    process.env.PAYOUT_BOT_USERNAME ||
    'Shiba_Inu_Pro_Miner_Bot';
  return bot.replace(/^@/, '');
}

export function formatQaMessage(item: QaItem): string {
  return [
    `<b>❓ Shiba Miner · Q&amp;A</b>`,
    `<i>from @${botHandle()}</i>`,
    ``,
    `<b>Q:</b> ${item.q}`,
    ``,
    `<b>A:</b> ${item.a}`,
    ``,
    `#SHIB #ShibaMiner #FAQ`,
  ].join('\n');
}

/**
 * Post a random app Q&A to QA_CHANNEL_ID.
 * Rate-limited to once every QA_ANNOUNCE_HOURS (default 24).
 * force=true skips the interval (manual only).
 */
export async function announceRandomQa(
  opts?: { force?: boolean; now?: number }
): Promise<{
  ok: boolean;
  posted: boolean;
  nextInMs: number;
  qaId?: string;
  error?: string;
  intervalHours?: number;
}> {
  const channel = normalizeTelegramChatId(process.env.QA_CHANNEL_ID);
  const token = process.env.BOT_TOKEN?.trim().replace(/^["']|["']$/g, '');
  const now = opts?.now ?? Date.now();
  const wait = qaIntervalMs();

  if (!token) {
    return { ok: false, posted: false, nextInMs: 0, error: 'BOT_TOKEN missing' };
  }
  if (!channel) {
    return { ok: false, posted: false, nextInMs: 0, error: 'QA_CHANNEL_ID missing' };
  }

  const db = await getDb();
  const state = await loadState(db);
  const due = !!opts?.force || state.lastAt === 0 || now - state.lastAt >= wait;

  if (!due) {
    return {
      ok: true,
      posted: false,
      nextInMs: Math.max(0, wait - (now - state.lastAt)),
      intervalHours: wait / (60 * 60 * 1000),
    };
  }

  const item = pickRandomQa(state.lastIds);
  const sent = await sendTelegramMessage({
    chatId: channel,
    text: formatQaMessage(item),
    parseMode: 'HTML',
    disablePreview: true,
  });

  if (!sent.ok) {
    return {
      ok: false,
      posted: false,
      nextInMs: wait,
      error: sent.error,
      qaId: item.id,
      intervalHours: wait / (60 * 60 * 1000),
    };
  }

  const next: QaState = {
    lastAt: now,
    lastIds: [...state.lastIds.filter((id) => id !== item.id), item.id].slice(-8),
  };
  await saveState(db, next);

  return {
    ok: true,
    posted: true,
    nextInMs: wait,
    qaId: item.id,
    intervalHours: wait / (60 * 60 * 1000),
  };
}
