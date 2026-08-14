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

const EXPLORER_BASES = Array.from(
  new Set(
    [
      SHIBARIUM_EXPLORER,
      'https://www.shibariumscan.io',
      'https://shibariumscan.io',
    ].map((u) => u.replace(/\/$/, ''))
  )
);

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

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ShibaMinerPro/1.0 (+https://shibaminer-sigma.vercel.app)',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('payout fetch failed', url, e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
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
  const total = item.total as { value?: string; decimals?: string } | string | undefined;
  const value =
    typeof total === 'string'
      ? total
      : String((total && typeof total === 'object' && total.value) || item.value || '0');

  try {
    if (BigInt(String(value).split('.')[0] || '0') <= BigInt(0)) return null;
  } catch {
    /* keep */
  }

  const tsRaw = String(item.timestamp || '');
  const parsedTs = tsRaw ? Date.parse(tsRaw) : NaN;
  const ts = Number.isFinite(parsedTs) ? parsedTs : Number(item.timeStamp) * 1000 || Date.now();

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

function rowsFromItems(items: unknown): PayoutRow[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const rows: PayoutRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const row = parseV2Transfer(item as Record<string, unknown>);
    if (!row || seen.has(row.txid)) continue;
    seen.add(row.txid);
    rows.push(row);
    if (rows.length >= 40) break;
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

async function fetchLiveShibNetworkTransfers(): Promise<PayoutRow[]> {
  const contract =
    process.env.SHIB_TOKEN_CONTRACT ||
    process.env.NEXT_PUBLIC_SHIB_TOKEN_CONTRACT ||
    SHIB_CONTRACT_DEFAULT;

  for (const base of EXPLORER_BASES) {
    const data = await fetchJson(`${base}/api/v2/tokens/${contract}/transfers`);
    const items =
      data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
        ? (data as { items: unknown[] }).items
        : null;
    const rows = rowsFromItems(items);
    if (rows.length) return rows;
  }
  return [];
}

async function fetchWalletOutbound(treasury: string): Promise<PayoutRow[]> {
  for (const base of EXPLORER_BASES) {
    const data = await fetchJson(
      `${base}/api/v2/addresses/${treasury}/token-transfers?type=ERC-20&filter=from`
    );
    const items =
      data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
        ? (data as { items: unknown[] }).items
        : null;
    const rows = rowsFromItems(items).slice(0, 30);
    if (rows.length) return rows;
  }
  return [];
}

export async function loadPayoutTransactions(): Promise<PayoutRow[]> {
  let transactions: PayoutRow[] = [];
  const feedUrl = process.env.SHIB_PAYOUT_FEED_URL || process.env.DOGE_PAYOUT_FEED_URL;

  try {
    transactions = await fetchLiveShibNetworkTransfers();
  } catch (e) {
    console.error('live SHIB network feed failed', e);
  }

  if (feedUrl) {
    try {
      const data = await fetchJson(feedUrl);
      const list = Array.isArray(data)
        ? data
        : data && typeof data === 'object'
          ? (data as { transactions?: unknown }).transactions
          : null;
      if (Array.isArray(list)) {
        const extra = list
          .map((raw) => normalizeFeedRow(raw as Record<string, unknown>))
          .filter((row): row is PayoutRow => Boolean(row));
        const byId = new Map<string, PayoutRow>();
        for (const tx of [...extra, ...transactions]) byId.set(tx.txid, tx);
        transactions = Array.from(byId.values());
      }
    } catch (e) {
      console.error('payout feed url failed', e);
    }
  }

  if (SHIBARIUM_TREASURY) {
    try {
      const wallet = await fetchWalletOutbound(SHIBARIUM_TREASURY);
      if (wallet.length) {
        const byId = new Map<string, PayoutRow>();
        for (const tx of [...wallet, ...transactions]) byId.set(tx.txid, tx);
        transactions = Array.from(byId.values());
      }
    } catch (err) {
      console.error('Shibarium wallet feed failed:', err);
    }
  }

  return transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);
}

export function payoutFeedMeta() {
  return {
    network: 'shibarium' as const,
    explorer: SHIBARIUM_EXPLORER,
    treasury: SHIBARIUM_TREASURY || null,
    treasuryUrl: SHIBARIUM_TREASURY ? shibariumAddressUrl(SHIBARIUM_TREASURY) : null,
  };
}
