import { MongoClient, type Db } from 'mongodb';
import { sendTelegramMessage, normalizeTelegramChatId } from '@/utils/telegram-bot';
import { truncateTxHash } from '@/utils/shib-explorer';

export type AnnounceablePayout = {
  txid: string;
  timestamp: number;
  amount: string;
  address: string;
  explorerUrl?: string;
  type?: string;
};

const PACE_META_KEY = 'payout_announce_pace';
const COL_ANNOUNCED = 'payout_announced';
const COL_META = 'app_meta';

type PaceMeta = {
  lastAnnounceAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __shibPayoutMongo: MongoClient | undefined;
}

function databaseNameFromUri(uri: string): string | undefined {
  try {
    const path = uri.split('?')[0]?.split('/').pop();
    if (path && path.length > 0 && !path.includes('@')) return path;
  } catch {
    /* ignore */
  }
  return undefined;
}

async function getDb(): Promise<Db | null> {
  const uri = process.env.DATABASE_URL;
  if (!uri) return null;
  try {
    if (!global.__shibPayoutMongo) {
      global.__shibPayoutMongo = new MongoClient(uri);
      await global.__shibPayoutMongo.connect();
    }
    const name = databaseNameFromUri(uri) || 'telegram_clicker';
    return global.__shibPayoutMongo.db(name);
  } catch (e) {
    console.error('payout mongo connect failed', e);
    return null;
  }
}

function recentWindowStart(now = Date.now()): number {
  const hours = Number(process.env.PAYOUT_LOOKBACK_HOURS) || 48;
  return now - hours * 60 * 60 * 1000;
}

function shortAddr(addr: string): string {
  const a = String(addr || '');
  if (a.length < 12) return a || '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Seconds between channel posts (default 60). */
function announceIntervalMs(): number {
  const sec = Number(process.env.PAYOUT_ANNOUNCE_SEC);
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  const min = Number(process.env.PAYOUT_ANNOUNCE_MIN);
  if (Number.isFinite(min) && min > 0) return min * 60 * 1000;
  return 60 * 1000;
}

/** How many payouts to post per tick when due (default 3). */
function batchSize(): number {
  const n = Number(process.env.PAYOUT_BATCH_SIZE);
  if (Number.isFinite(n) && n > 0) return Math.min(10, Math.floor(n));
  return 3;
}

async function loadPace(db: Db | null): Promise<PaceMeta> {
  if (!db) return { lastAnnounceAt: 0 };
  try {
    const row = await db.collection(COL_META).findOne({ key: PACE_META_KEY });
    const v = (row?.value || {}) as Partial<PaceMeta>;
    return { lastAnnounceAt: Number(v.lastAnnounceAt) || 0 };
  } catch {
    return { lastAnnounceAt: 0 };
  }
}

async function savePace(db: Db | null, meta: PaceMeta): Promise<void> {
  if (!db) return;
  try {
    await db.collection(COL_META).updateOne(
      { key: PACE_META_KEY },
      { $set: { key: PACE_META_KEY, value: meta } },
      { upsert: true }
    );
  } catch (e) {
    console.warn('payout pace save failed', e);
  }
}

export function formatPayoutChannelMessage(tx: AnnounceablePayout): string {
  const link = tx.explorerUrl || `https://www.shibariumscan.io/tx/${tx.txid}`;
  const when = new Date(tx.timestamp).toUTCString();
  const bot =
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    process.env.PAYOUT_BOT_USERNAME ||
    'Shiba_Inu_Pro_Miner_Bot';
  const botHandle = bot.replace(/^@/, '');
  return [
    `<b>🐾 Shiba Miner · Payout</b>`,
    `<i>from @${botHandle}</i>`,
    ``,
    `💰 <b>${tx.amount}</b> SHIB`,
    `📤 To: <code>${shortAddr(tx.address)}</code>`,
    `🧾 Tx: <code>${truncateTxHash(tx.txid)}</code>`,
    `🕐 ${when}`,
    ``,
    `<a href="${link}">Verify on Shibarium ↗</a>`,
    ``,
    `#SHIB #ShibaMiner #Payout`,
  ].join('\n');
}

async function filterUnannounced(
  db: Db | null,
  txs: AnnounceablePayout[],
  now = Date.now()
): Promise<AnnounceablePayout[]> {
  const dayStart = recentWindowStart(now);
  const recent = txs
    .filter((tx) => tx.txid && Number(tx.timestamp) >= dayStart)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (!recent.length) return [];

  if (!db) return recent;

  try {
    const ids = recent.map((t) => t.txid);
    const rows = await db
      .collection(COL_ANNOUNCED)
      .find({ txid: { $in: ids } }, { projection: { txid: 1 } })
      .toArray();
    const already = new Set(rows.map((r) => String(r.txid)));
    return recent.filter((tx) => !already.has(tx.txid));
  } catch (e) {
    console.warn('announced lookup failed', e);
    return recent;
  }
}

/**
 * Post recent payouts (same feed as Cash / Airdrop) to PAYOUT_CHANNEL_ID.
 * Automatic — mini app + cron. No Jarvis.
 */
export async function announceTodaysPayouts(
  txs: AnnounceablePayout[],
  now = Date.now(),
  opts?: { force?: boolean }
): Promise<{
  ok: boolean;
  announced: boolean;
  posted: number;
  pending: number;
  nextInMs: number;
  error?: string;
  txids?: string[];
}> {
  const channel = normalizeTelegramChatId(process.env.PAYOUT_CHANNEL_ID);
  const token = process.env.BOT_TOKEN?.trim().replace(/^["']|["']$/g, '');
  if (!token || !channel) {
    return {
      ok: false,
      announced: false,
      posted: 0,
      pending: 0,
      nextInMs: 0,
      error: 'BOT_TOKEN or PAYOUT_CHANNEL_ID missing',
    };
  }

  const db = await getDb();
  const pace = await loadPace(db);
  const pending = await filterUnannounced(db, txs, now);
  const interval = announceIntervalMs();
  const due =
    !!opts?.force || pace.lastAnnounceAt === 0 || now - pace.lastAnnounceAt >= interval;

  if (!pending.length) {
    return {
      ok: true,
      announced: false,
      posted: 0,
      pending: 0,
      nextInMs: Math.max(0, interval - (now - pace.lastAnnounceAt)),
    };
  }

  if (!due) {
    return {
      ok: true,
      announced: false,
      posted: 0,
      pending: pending.length,
      nextInMs: Math.max(0, interval - (now - pace.lastAnnounceAt)),
    };
  }

  // Catch up: several txs per tick so the channel does not stall after 1 post
  const batch = pending.slice(0, batchSize());
  const postedTxids: string[] = [];

  for (const tx of batch) {
    const sent = await sendTelegramMessage({
      chatId: channel,
      text: formatPayoutChannelMessage(tx),
      parseMode: 'HTML',
      disablePreview: false,
    });
    if (!sent.ok) {
      console.error('payout announce send failed', sent.error, { channel, txid: tx.txid });
      if (postedTxids.length > 0) {
        await savePace(db, { lastAnnounceAt: now });
      }
      return {
        ok: false,
        announced: postedTxids.length > 0,
        posted: postedTxids.length,
        pending: pending.length - postedTxids.length,
        nextInMs: interval,
        error: sent.error || 'telegram_send_failed',
        txids: postedTxids,
      };
    }

    if (db) {
      try {
        await db.collection(COL_ANNOUNCED).updateOne(
          { txid: tx.txid },
          {
            $set: {
              txid: tx.txid,
              amount: tx.amount,
              announcedAt: new Date(now),
            },
          },
          { upsert: true }
        );
      } catch (e) {
        console.warn('announced save failed', e);
      }
    }
    postedTxids.push(tx.txid);
    // Soft Telegram rate limit between messages in the same tick
    if (batch.length > 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  await savePace(db, { lastAnnounceAt: now });

  console.log('payout announce posted', {
    posted: postedTxids.length,
    pending: Math.max(0, pending.length - postedTxids.length),
    channel,
  });

  return {
    ok: true,
    announced: true,
    posted: postedTxids.length,
    pending: Math.max(0, pending.length - postedTxids.length),
    nextInMs: interval,
    txids: postedTxids,
  };
}
