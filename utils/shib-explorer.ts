/** Shiba Inu L2 — Shibarium explorer (Blockscout) */
export const SHIBARIUM_EXPLORER =
  process.env.NEXT_PUBLIC_SHIBARIUM_EXPLORER || 'https://www.shibariumscan.io';

const DEFAULT_TREASURY = '0xDBd90A9276Fdbc3Bc5DCE8F552A9A813674A89dD';

const RAW_TREASURY_CANDIDATES = [
  process.env.NEXT_PUBLIC_SHIB_TREASURY_ADDRESS,
  process.env.SHIB_TREASURY_ADDRESS,
  process.env.NEXT_PUBLIC_DOGE_PAYOUT_ADDRESS,
  DEFAULT_TREASURY,
];

export function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address || '').trim());
}

/** Only EVM (0x…) addresses — ignore legacy Dogecoin base58. */
export const SHIBARIUM_TREASURY =
  RAW_TREASURY_CANDIDATES.map((v) => String(v || '').trim()).find(isEvmAddress) || DEFAULT_TREASURY;

export function shibariumTxUrl(txid: string): string {
  const hash = String(txid || '').trim();
  if (!hash) return SHIBARIUM_EXPLORER;
  const normalized = hash.startsWith('0x') ? hash : hash.length === 64 ? `0x${hash}` : hash;
  return `${SHIBARIUM_EXPLORER}/tx/${normalized}`;
}

export function shibariumAddressUrl(address: string): string {
  const addr = String(address || '').trim();
  if (!addr || !isEvmAddress(addr)) return SHIBARIUM_EXPLORER;
  return `${SHIBARIUM_EXPLORER}/address/${addr}`;
}

export function truncateTxHash(id: string, head = 8, tail = 6): string {
  const s = String(id || '');
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
