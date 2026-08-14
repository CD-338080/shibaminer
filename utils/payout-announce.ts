import fs from 'fs';
import path from 'path';
import { sendTelegramMessage } from '@/utils/telegram-bot';
import { truncateTxHash } from '@/utils/shib-explorer';

export type AnnounceablePayout = {
  txid: string;
  timestamp: number;
  amount: string;
  address: string;
  explorerUrl?: string;
  type?: string;
};

type AnnounceState = {
  announced: string[];
  lastAnnounceAt: number;
  paceIndex: number;
};

const PACE_MINUTES = [10, 8, 4, 1];

function storePath(): string {
  const base = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data');
  return path.join(base, 'announced-payouts.json');
}

function loadState(): AnnounceState {
  const g = globalThis as typeof globalThis & { __shibPayoutAnnounce?: AnnounceState };
  if (g.__shibPayoutAnnounce) return g.__shibPayoutAnnounce;

  let state: AnnounceState = { announced: [], lastAnnounceAt: 0, paceIndex: 0 };
  try {
    const p = storePath();
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<AnnounceState>;
      state = {
        announced: Array.isArray(raw.announced) ? raw.announced.slice(-500) : [],
        lastAnnounceAt: Number(raw.lastAnnounceAt) || 0,
        paceIndex: Number(raw.paceIndex) || 0,
      };
    }
  } catch {
    /* ignore */
  }
  g.__shibPayoutAnnounce = state;
  return state;
}

function saveState(state: AnnounceState) {
  const g = globalThis as typeof globalThis & { __shibPayoutAnnounce?: AnnounceState };
  g.__shibPayoutAnnounce = state;
  try {
    const p = storePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          announced: state.announced.slice(-500),
          lastAnnounceAt: state.lastAnnounceAt,
          paceIndex: state.paceIndex,
        },
        null,
        0
      )
    );
  } catch (e) {
    console.warn('payout-announce save failed', e);
  }
}

function recentWindowStart(now = Date.now()): number {
  // "pagos del día" ≈ last 24 hours (covers local day across UTC offset)
  const hours = Number(process.env.PAYOUT_LOOKBACK_HOURS) || 24;
  return now - hours * 60 * 60 * 1000;
}

function shortAddr(addr: string): string {
  const a = String(addr || '');
  if (a.length < 12) return a || '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function paceEnabled(): boolean {
  const v = (process.env.PAYOUT_PACE_ENABLED || 'true').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function currentIntervalMs(state: AnnounceState): number {
  if (!paceEnabled()) return 0;
  const start = Number(process.env.PAYOUT_ANNOUNCE_MIN);
  const cycle =
    Number.isFinite(start) && start > 0
      ? [start, ...PACE_MINUTES.filter((m) => m < start)]
      : PACE_MINUTES;
  const unique = Array.from(new Set(cycle));
  const mins = unique[state.paceIndex % unique.length] ?? 10;
  return mins * 60 * 1000;
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

/** Today's (local TZ) / recent unannounced payouts, newest first */
export function todaysUnannounced(txs: AnnounceablePayout[], now = Date.now()): AnnounceablePayout[] {
  const state = loadState();
  const announced = new Set(state.announced);
  const dayStart = recentWindowStart(now);
  return txs
    .filter((tx) => tx.txid && tx.timestamp >= dayStart && !announced.has(tx.txid))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Post recent (today) payouts to PAYOUT_CHANNEL_ID via BOT_TOKEN.
 * Paced mode: one tx every 10→8→4→1 minutes.
 * Burst mode (PAYOUT_PACE_ENABLED=false): up to 5 new txs at once.
 */
export async function announceTodaysPayouts(
  txs: AnnounceablePayout[],
  now = Date.now()
): Promise<{
  ok: boolean;
  announced: boolean;
  posted: number;
  pending: number;
  nextInMs: number;
  error?: string;
  txids?: string[];
}> {
  const channel = process.env.PAYOUT_CHANNEL_ID;
  const token = process.env.BOT_TOKEN;
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

  const state = loadState();
  const pending = todaysUnannounced(txs, now);
  const interval = currentIntervalMs(state);
  const due = !paceEnabled() || now - state.lastAnnounceAt >= interval;

  if (!pending.length) {
    return {
      ok: true,
      announced: false,
      posted: 0,
      pending: 0,
      nextInMs: Math.max(0, interval - (now - state.lastAnnounceAt)),
    };
  }

  if (!due) {
    return {
      ok: true,
      announced: false,
      posted: 0,
      pending: pending.length,
      nextInMs: Math.max(0, interval - (now - state.lastAnnounceAt)),
    };
  }

  const batch = paceEnabled() ? pending.slice(0, 1) : pending.slice(0, 5);
  const postedTxids: string[] = [];

  for (const tx of batch) {
    const sent = await sendTelegramMessage({
      chatId: channel,
      text: formatPayoutChannelMessage(tx),
      parseMode: 'HTML',
      disablePreview: false,
    });
    if (!sent.ok) {
      return {
        ok: false,
        announced: postedTxids.length > 0,
        posted: postedTxids.length,
        pending: pending.length - postedTxids.length,
        nextInMs: interval,
        error: sent.error,
        txids: postedTxids,
      };
    }
    postedTxids.push(tx.txid);
    state.announced.push(tx.txid);
  }

  state.lastAnnounceAt = now;
  if (paceEnabled()) {
    state.paceIndex = (state.paceIndex + 1) % PACE_MINUTES.length;
  }
  saveState(state);

  const nextInterval = currentIntervalMs(state);
  return {
    ok: true,
    announced: true,
    posted: postedTxids.length,
    pending: Math.max(0, pending.length - postedTxids.length),
    nextInMs: nextInterval,
    txids: postedTxids,
  };
}
