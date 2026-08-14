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

/** Pull recent outbound token txs from Shibariumscan (Blockscout). */
async function fetchShibariumPayouts(treasury: string): Promise<PayoutRow[]> {
  const tokenContract =
    process.env.SHIB_TOKEN_CONTRACT || process.env.NEXT_PUBLIC_SHIB_TOKEN_CONTRACT;
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
    result?: Array<Record<string, string>> | string;
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

/** Blockscout v2 fallback when legacy module API is empty. */
async function fetchShibariumPayoutsV2(treasury: string): Promise<PayoutRow[]> {
  const tokenContract = (
    process.env.SHIB_TOKEN_CONTRACT ||
    process.env.NEXT_PUBLIC_SHIB_TOKEN_CONTRACT ||
    ''
  ).toLowerCase();
  const url = `${SHIBARIUM_EXPLORER}/api/v2/addresses/${treasury}/token-transfers?type=ERC-20&filter=from`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(data.items)) return [];

  const rows: PayoutRow[] = [];
  for (const item of data.items) {
    const token = item.token as { address_hash?: string; address?: string; decimals?: string } | undefined;
    const tokenAddr = String(token?.address_hash || token?.address || '').toLowerCase();
    if (tokenContract && tokenAddr && tokenAddr !== tokenContract) continue;

    const txid = String(item.transaction_hash || item.tx_hash || '');
    if (!txid) continue;

    const toObj = item.to as { hash?: string } | string | undefined;
    const to = typeof toObj === 'string' ? toObj : String(toObj?.hash || '');
    const decimals = Number(token?.decimals || 18) || 18;
    const total = item.total as { value?: string } | string | undefined;
    const value =
      typeof total === 'string'
        ? total
        : String((total && typeof total === 'object' && total.value) || item.value || '0');
    const tsRaw = String(item.timestamp || '');
    const ts = tsRaw ? Date.parse(tsRaw) : Date.now();

    rows.push({
      txid,
      timestamp: Number.isFinite(ts) ? ts : Date.now(),
      amount: formatShibAmount(value, decimals),
      address: to,
      type: 'Withdrawal',
      status: 'Confirmed',
      explorerUrl: shibariumTxUrl(txid),
      addressUrl: isEvmAddress(to) ? shibariumAddressUrl(to) : undefined,
    });

    if (rows.length >= 30) break;
  }

  return rows;
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

  if (transactions.length === 0 && SHIBARIUM_TREASURY) {
    try {
      transactions = await fetchShibariumPayouts(SHIBARIUM_TREASURY);
      if (transactions.length === 0) {
        transactions = await fetchShibariumPayoutsV2(SHIBARIUM_TREASURY);
      }
    } catch (err) {
      console.error('Shibariumscan fetch failed:', err);
    }
  }

  return transactions;
}

export function payoutFeedMeta() {
  return {
    network: 'shibarium' as const,
    explorer: SHIBARIUM_EXPLORER,
    treasury: SHIBARIUM_TREASURY || null,
    treasuryUrl: SHIBARIUM_TREASURY ? shibariumAddressUrl(SHIBARIUM_TREASURY) : null,
  };
}
