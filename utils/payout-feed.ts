import {
  SHIBARIUM_EXPLORER,
  SHIBARIUM_TREASURY,
  isEvmAddress,
  shibariumAddressUrl,
  shibariumTxUrl,
} from '@/utils/shib-explorer';
import type { AnnounceablePayout } from '@/utils/payout-announce';

export type PayoutRow = AnnounceablePayout & {
  type: string;
  status: string;
  confirmations?: number;
  addressUrl?: string;
};

const SHIB_CONTRACT_DEFAULT = '0x495eea66B0f8b636D441dC6a98d8F5C3D455C4c0';

function shibContract(): string {
  return (
    process.env.SHIB_TOKEN_CONTRACT ||
    process.env.NEXT_PUBLIC_SHIB_TOKEN_CONTRACT ||
    SHIB_CONTRACT_DEFAULT
  ).toLowerCase();
}

function formatShibAmount(value: string | number, decimals = 18): string {
  try {
    const raw = BigInt(String(value).split('.')[0] || '0');
    let base = BigInt(1);
    const ten = BigInt(10);
    for (let i = 0; i < decimals; i++) base *= ten;
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

function parseV2Transfer(item: Record<string, unknown>): PayoutRow | null {
  const token = item.token as
    | { address_hash?: string; address?: string; decimals?: string }
    | undefined;
  const tokenAddr = String(token?.address_hash || token?.address || '').toLowerCase();
  const want = shibContract();
  if (tokenAddr && tokenAddr !== want) return null;

  const txid = String(item.transaction_hash || item.tx_hash || item.hash || '').trim();
  if (!txid) return null;

  const toObj = item.to as { hash?: string } | string | undefined;
  const to = typeof toObj === 'string' ? toObj : String(toObj?.hash || '');
  if (!to) return null;

  const decimals = Number(token?.decimals || 18) || 18;
  const total = item.total as { value?: string } | string | undefined;
  const value =
    typeof total === 'string'
      ? total
      : String((total && typeof total === 'object' && total.value) || item.value || '0');

  // Skip dust / empty
  try {
    if (BigInt(String(value).split('.')[0] || '0') <= BigInt(0)) return null;
  } catch {
    /* keep */
  }

  const tsRaw = String(item.timestamp || '');
  const ts = tsRaw ? Date.parse(tsRaw) : Number(item.timeStamp) * 1000 || Date.now();

  return {
    txid,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    amount: formatShibAmount(value, decimals),
    address: to,
    type: 'Withdrawal',
    status: 'Confirmed',
    explorerUrl: shibariumTxUrl(txid),
    addressUrl: isEvmAddress(to) ? shibariumAddressUrl(to) : undefined,
  };
}

/**
 * Live network-wide SHIB transfers (many distinct txs every minute).
 * Best source for a busy payout channel.
 */
async function fetchLiveShibNetworkTransfers(): Promise<PayoutRow[]> {
  const contract =
    process.env.SHIB_TOKEN_CONTRACT ||
    process.env.NEXT_PUBLIC_SHIB_TOKEN_CONTRACT ||
    SHIB_CONTRACT_DEFAULT;
  const url = `${SHIBARIUM_EXPLORER}/api/v2/tokens/${contract}/transfers`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(data.items)) return [];

  const seen = new Set<string>();
  const rows: PayoutRow[] = [];
  for (const item of data.items) {
    const row = parseV2Transfer(item);
    if (!row || seen.has(row.txid)) continue;
    seen.add(row.txid);
    rows.push(row);
    if (rows.length >= 40) break;
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

/** Outbound SHIB from a specific hot wallet. */
async function fetchWalletOutbound(treasury: string): Promise<PayoutRow[]> {
  const url = `${SHIBARIUM_EXPLORER}/api/v2/addresses/${treasury}/token-transfers?type=ERC-20&filter=from`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(data.items)) return [];

  const seen = new Set<string>();
  const rows: PayoutRow[] = [];
  for (const item of data.items) {
    const row = parseV2Transfer(item);
    if (!row || seen.has(row.txid)) continue;
    seen.add(row.txid);
    rows.push(row);
    if (rows.length >= 30) break;
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

export async function loadPayoutTransactions(): Promise<PayoutRow[]> {
  let transactions: PayoutRow[] = [];
  const feedUrl = process.env.SHIB_PAYOUT_FEED_URL || process.env.DOGE_PAYOUT_FEED_URL;

  if (feedUrl) {
    try {
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
    } catch (e) {
      console.error('payout feed url failed', e);
    }
  }

  // Prefer live network SHIB flow (high volume, always fresh hashes)
  if (transactions.length < 5) {
    try {
      const live = await fetchLiveShibNetworkTransfers();
      if (live.length) {
        const byId = new Map<string, PayoutRow>();
        for (const tx of [...live, ...transactions]) byId.set(tx.txid, tx);
        transactions = Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (e) {
      console.error('live SHIB network feed failed', e);
    }
  }

  // Merge busy treasury wallet outbound if configured
  if (SHIBARIUM_TREASURY) {
    try {
      const wallet = await fetchWalletOutbound(SHIBARIUM_TREASURY);
      if (wallet.length) {
        const byId = new Map<string, PayoutRow>();
        for (const tx of [...wallet, ...transactions]) byId.set(tx.txid, tx);
        transactions = Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (err) {
      console.error('Shibarium wallet feed failed:', err);
    }
  }

  return transactions.slice(0, 40);
}

export function payoutFeedMeta() {
  return {
    network: 'shibarium' as const,
    explorer: SHIBARIUM_EXPLORER,
    treasury: SHIBARIUM_TREASURY || null,
    treasuryUrl: SHIBARIUM_TREASURY ? shibariumAddressUrl(SHIBARIUM_TREASURY) : null,
  };
}
