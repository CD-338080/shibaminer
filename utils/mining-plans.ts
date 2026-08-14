export type MiningPlanBadge = 'popular' | 'best' | 'foryou' | null;

export type MiningPlan = {
  id: string;
  name: string;
  tagline: string;
  contractDays: number;
  boostPercent: number;
  ghs: number;
  /** Payment amount in SHIB */
  shib: number;
  usd: number;
  dailyShib: number;
  badge: MiningPlanBadge;
  features: string[];
};

export const MINE_SHOWCASE_KEY = 'shiba_mine_showcase_v1';

/** Same EVM address for SHIB (ETH/BSC), ETH, and BNB */
export const MINING_PAYMENT_ADDRESS =
  process.env.NEXT_PUBLIC_SHIB_PAYOUT_ADDRESS ||
  '0xfbECeA46b0D7F032fc6DAB8DD4a7c1D54FB7590B';

export type MiningPayAsset = 'shib' | 'eth' | 'bnb';
export type MiningPayNetwork = 'ethereum' | 'bsc';

export type MiningPayOption = {
  id: string;
  asset: MiningPayAsset;
  network: MiningPayNetwork;
  label: string;
  networkLabel: string;
  symbol: string;
  hint: string;
};

export const MINING_PAY_OPTIONS: MiningPayOption[] = [
  {
    id: 'shib-eth',
    asset: 'shib',
    network: 'ethereum',
    label: 'SHIB',
    networkLabel: 'Ethereum',
    symbol: 'SHIB',
    hint: 'Send SHIB (ERC-20) on Ethereum',
  },
  {
    id: 'shib-bsc',
    asset: 'shib',
    network: 'bsc',
    label: 'SHIB',
    networkLabel: 'BNB Chain',
    symbol: 'SHIB',
    hint: 'Send SHIB (BEP-20) on BNB Smart Chain',
  },
  {
    id: 'eth',
    asset: 'eth',
    network: 'ethereum',
    label: 'ETH',
    networkLabel: 'Ethereum',
    symbol: 'ETH',
    hint: 'Send native ETH to the same address',
  },
  {
    id: 'bnb',
    asset: 'bnb',
    network: 'bsc',
    label: 'BNB',
    networkLabel: 'BNB Chain',
    symbol: 'BNB',
    hint: 'Send native BNB to the same address',
  },
];

/** Fallback USD rates if live fetch fails */
export const FALLBACK_ETH_USD = 3400;
export const FALLBACK_BNB_USD = 580;

/** SHIB per 1 USD (from $20 = 4,494,382.02247191 SHIB) */
export const SHIB_PER_USD = 4494382.02247191 / 20;

export function formatNativeExact(amount: number, digits = 6): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  return trimZeros(amount.toFixed(digits));
}

export function usdToNative(usd: number, priceUsd: number): number {
  if (!priceUsd || priceUsd <= 0) return 0;
  return usd / priceUsd;
}

export function usdToShib(usd: number): number {
  return usd * SHIB_PER_USD;
}

/** Daily payout for ~+40% ROI over contractDays */
function dailyAtRoi(shibCost: number, contractDays: number, roiPct = 40): number {
  return (shibCost * (1 + roiPct / 100)) / contractDays;
}

/** ~+40% ROI across tiers; higher GH/s = shorter contract */
export const MINING_PLANS: MiningPlan[] = [
  {
    id: 'pup',
    name: 'Pup Pack',
    tagline: 'Start digging with light hashrate',
    contractDays: 30,
    boostPercent: 40,
    ghs: 120,
    shib: usdToShib(20),
    usd: 20,
    dailyShib: dailyAtRoi(usdToShib(20), 30),
    badge: null,
    features: ['Auto payouts', 'No maintenance fee', 'Cancel anytime after contract'],
  },
  {
    id: 'alpha',
    name: 'Alpha Dig',
    tagline: 'Best balance of speed and cost',
    contractDays: 14,
    boostPercent: 40,
    ghs: 420,
    shib: usdToShib(50),
    usd: 50,
    dailyShib: dailyAtRoi(usdToShib(50), 14),
    badge: 'foryou',
    features: ['Priority pool lane', 'Daily SHIB drops', '14-day contract'],
  },
  {
    id: 'kennel',
    name: 'Kennel Vault',
    tagline: 'Most miners pick this tier',
    contractDays: 10,
    boostPercent: 40,
    ghs: 980,
    shib: usdToShib(200),
    usd: 200,
    dailyShib: dailyAtRoi(usdToShib(200), 10),
    badge: 'popular',
    features: ['High GH/s cluster', 'Faster ROI window', 'On-chain SHIB settle'],
  },
  {
    id: 'shogun',
    name: 'Shogun Rig',
    tagline: 'Maximum hashrate, shortest runway',
    contractDays: 7,
    boostPercent: 40,
    ghs: 2200,
    shib: usdToShib(1000),
    usd: 1000,
    dailyShib: dailyAtRoi(usdToShib(1000), 7),
    badge: 'best',
    features: ['Dedicated workers', 'Fastest +40% path', 'Whale-grade throughput'],
  },
];

export function getRecommendedPlan(): MiningPlan {
  return MINING_PLANS.find((p) => p.badge === 'foryou') ?? MINING_PLANS[1] ?? MINING_PLANS[0];
}

export function formatGhs(ghs: number): string {
  if (ghs >= 1000) return `${(ghs / 1000).toFixed(ghs % 1000 === 0 ? 0 : 1)} TH/s`;
  return `${ghs} GH/s`;
}

/** Compact display: 4.49M, 224.7M, 1.2B */
export function formatPlanShib(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    const v = amount / 1_000_000_000;
    return `${trimZeros(v.toFixed(2))}B`;
  }
  if (abs >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${trimZeros(v.toFixed(abs >= 100_000_000 ? 1 : 2))}M`;
  }
  if (abs >= 1_000) {
    const v = amount / 1_000;
    return `${trimZeros(v.toFixed(1))}K`;
  }
  return trimZeros(amount.toFixed(2));
}

/** Full precision for clipboard / payment */
export function formatPlanShibExact(amount: number): string {
  if (Number.isInteger(amount)) return String(amount);
  // Avoid scientific notation; trim trailing zeros
  return trimZeros(amount.toFixed(8));
}

function trimZeros(value: string): string {
  if (!value.includes('.')) return value;
  return value.replace(/\.?0+$/, '');
}

/** @deprecated use formatPlanShib */
export const formatPlanDoge = formatPlanShib;

export function planContractTotal(plan: MiningPlan): number {
  return Number((plan.dailyShib * plan.contractDays).toFixed(0));
}

export function planNetProfit(plan: MiningPlan): number {
  return Number((planContractTotal(plan) - plan.shib).toFixed(0));
}

export function planRoiPct(plan: MiningPlan): number {
  if (plan.shib <= 0) return 0;
  return Math.round((planNetProfit(plan) / plan.shib) * 100);
}

export function getPlanActivationsBucket(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${Math.floor(d.getUTCHours() / 6)}`;
}

export function getTodayPlanActivations(planId: string): number {
  let hash = 0;
  const key = `${getPlanActivationsBucket()}:${planId}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return 40 + (hash % 180);
}

export function msUntilPlanSlotRefresh(now = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    Math.floor(d.getUTCHours() / 6) * 6 + 6,
    0,
    0,
    0
  );
  return Math.max(0, next - now);
}

export function formatSlotCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
