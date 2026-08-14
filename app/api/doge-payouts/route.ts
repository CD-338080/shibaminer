import { NextResponse } from 'next/server';
import {
  SHIBARIUM_EXPLORER,
  SHIBARIUM_TREASURY,
  isEvmAddress,
  shibariumAddressUrl,
  shibariumTxUrl,
} from '@/utils/shib-explorer';
import { announceTodaysPayouts } from '@/utils/payout-announce';

type PayoutRow = {
  txid: string;
  timestamp: number;
  amount: string;
  address: string;
  type: string;
  status: string;
  confirmations?: number;
  explorerUrl?: string;
  addressUrl?: string;
};

function formatShibAmount(value: string | number, decimals = 18): string {
  try {
    const raw = BigInt(String(value).split('.')[0] || '0');
    const base = BigInt(10) ** BigInt(decimals);
    const whole = raw / base;
    const frac = raw % base;
    if (frac === BigInt(0)) return whole.toLocaleString('en-US');
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4);
    return fracStr ? `${whole.toLocaleString('en-US')}.${fracStr}` : whole.toLocaleString('en-US');
  } catch {
    return String(value);
  }
}

function normalizeFeedRow(raw: Record<string, unknown>): PayoutRow | null {
  const txid = String(raw.txid || raw.hash || '').trim();
  if (!txid) return null;
  const address = String(raw.address || raw.to || SHIBARIUM_TREASURY || '').trim();
  return {
    txid,
    timestamp: Number(raw.timestamp) || Date.now(),
    amount: String(raw.amount ?? '0'),
    address,
    type: String(raw.type || 'Withdrawal'),
    status: String(raw.status || 'Confirmed'),
    confirmations: typeof raw.confirmations === 'number' ? raw.confirmations : undefined,
    explorerUrl: String(raw.explorerUrl || '') || shibariumTxUrl(txid),
    addressUrl: address && isEvmAddress(address) ? shibariumAddressUrl(address) : undefined,
  };
}

/** Pull recent outbound token txs from Shibariumscan (Blockscout). */
async function fetchShibariumPayouts(treasury: string): Promise<PayoutRow[]> {
  const tokenContract = process.env.SHIB_TOKEN_CONTRACT || process.env.NEXT_PUBLIC_SHIB_TOKEN_CONTRACT;
  const rows: PayoutRow[] = [];

  const qs = new URLSearchParams({
    module: 'account',
    action: tokenContract ? 'tokentx' : 'txlist',
    address: treasury,
    sort: 'desc',
    page: '1',
    offset: '40',
  });
  if (tokenContract) qs.set('contractaddress', tokenContract);

  const url = `${SHIBARIUM_EXPLORER}/api?${qs.toString()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return rows;

  const data = (await res.json()) as {
    status?: string;
    result?: Array<Record<string, string>>;
  };
  if (!Array.isArray(data.result)) return rows;

  for (const tx of data.result) {
    const from = String(tx.from || '').toLowerCase();
    if (from !== treasury.toLowerCase()) continue;

    const txid = String(tx.hash || '');
    if (!txid) continue;

    const decimals = Number(tx.tokenDecimal || 18) || 18;
    const value = tx.value || '0';
    const to = String(tx.to || '');
    const ts = Number(tx.timeStamp) * 1000 || Date.now();
    const conf = Number(tx.confirmations) || undefined;

    rows.push({
      txid,
      timestamp: ts,
      amount: formatShibAmount(value, decimals),
      address: to,
      type: 'Withdrawal',
      status: conf && conf > 0 ? 'Confirmed' : 'Pending',
      confirmations: conf,
      explorerUrl: shibariumTxUrl(txid),
      addressUrl: isEvmAddress(to) ? shibariumAddressUrl(to) : undefined,
    });

    if (rows.length >= 30) break;
  }

  return rows;
}

async function loadTransactions(): Promise<PayoutRow[]> {
  let transactions: PayoutRow[] = [];
  const feedUrl = process.env.SHIB_PAYOUT_FEED_URL || process.env.DOGE_PAYOUT_FEED_URL;

  if (feedUrl) {
    const res = await fetch(feedUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.transactions;
      if (Array.isArray(list)) {
        transactions = list
          .map((raw) => normalizeFeedRow(raw as Record<string, unknown>))
          .filter((row): row is PayoutRow => Boolean(row));
      }
    }
  }

  if (transactions.length === 0 && SHIBARIUM_TREASURY) {
    try {
      transactions = await fetchShibariumPayouts(SHIBARIUM_TREASURY);
    } catch (err) {
      console.error('Shibariumscan fetch failed:', err);
    }
  }

  return transactions;
}

/**
 * Live payout feed for Cash / Withdraw UI.
 * ?announce=1 → post today's new payouts to PAYOUT_CHANNEL_ID (paced).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const announce = searchParams.get('announce') === '1';

  try {
    const transactions = await loadTransactions();

    if (announce) {
      const result = await announceTodaysPayouts(transactions);
      return NextResponse.json({
        ok: result.ok,
        announced: result.announced,
        posted: result.posted,
        pending: result.pending,
        nextInMs: result.nextInMs,
        count: transactions.length,
        txids: result.txids,
        error: result.error,
        channel: process.env.PAYOUT_CHANNEL_ID || null,
      });
    }

    return NextResponse.json({
      transactions,
      network: 'shibarium',
      explorer: SHIBARIUM_EXPLORER,
      treasury: SHIBARIUM_TREASURY || null,
      treasuryUrl: SHIBARIUM_TREASURY ? shibariumAddressUrl(SHIBARIUM_TREASURY) : null,
    });
  } catch (error) {
    console.error('shib/doge-payouts error:', error);
    return NextResponse.json({ transactions: [], error: 'feed_unavailable' }, { status: 200 });
  }
}
