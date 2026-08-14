import prisma from '@/utils/prisma';
import { sendTelegramMessage, type InlineKeyboard } from '@/utils/telegram-bot';
import { utcDateKey } from '@/utils/daily-claim';

export function getAdminIds(): Set<string> {
  const raw = [
    process.env.WITHDRAW_ADMIN_TELEGRAM_ID,
    process.env.JARVIS_ADMIN_TELEGRAM_ID,
    process.env.ADMIN_TELEGRAM_ID,
  ]
    .filter(Boolean)
    .join(',');
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isJarvisAdmin(telegramId?: string | number | null): boolean {
  if (telegramId == null) return false;
  return getAdminIds().has(String(telegramId));
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export async function getAppGrowthReport(): Promise<string> {
  const now = Date.now();
  const d1 = new Date(now - 24 * 60 * 60 * 1000);
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    premiumUsers,
    miningActive,
    withReferrer,
    withWallet,
    claimedToday,
    new24h,
    new7d,
    balanceAgg,
    pointsAgg,
    referralAgg,
    topBalances,
    topReferrers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { autoMineActive: true } }).catch(() => 0),
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.user.count({ where: { tonWalletAddress: { not: null } } }),
    prisma.user
      .count({
        where: {
          dailyClaimLastDate: utcDateKey(),
        },
      })
      .catch(() => 0),
    prisma.user.count({ where: { lastPointsUpdateTimestamp: { gte: d1 } } }),
    prisma.user.count({ where: { lastPointsUpdateTimestamp: { gte: d7 } } }),
    prisma.user.aggregate({ _sum: { pointsBalance: true }, _avg: { pointsBalance: true } }),
    prisma.user.aggregate({ _sum: { points: true } }),
    prisma.user.aggregate({ _sum: { referralPointsEarned: true } }),
    prisma.user.findMany({
      orderBy: { pointsBalance: 'desc' },
      take: 5,
      select: { name: true, telegramId: true, pointsBalance: true },
    }),
    prisma.user.findMany({
      orderBy: { referralPointsEarned: 'desc' },
      take: 5,
      select: { name: true, telegramId: true, referralPointsEarned: true },
    }),
  ]);

  const vault = balanceAgg._sum.pointsBalance || 0;
  const avgVault = balanceAgg._avg.pointsBalance || 0;
  const lifetime = pointsAgg._sum.points || 0;
  const refPts = referralAgg._sum.referralPointsEarned || 0;

  const topBalLines = topBalances
    .map(
      (u, i) =>
        `${i + 1}. ${u.name || 'Miner'} · ${fmt(u.pointsBalance)} SHIB · <code>${u.telegramId}</code>`
    )
    .join('\n');

  const topRefLines = topReferrers
    .map(
      (u, i) =>
        `${i + 1}. ${u.name || 'Miner'} · ${fmt(u.referralPointsEarned)} · <code>${u.telegramId}</code>`
    )
    .join('\n');

  return [
    `<b>🕹 JARVIS · Growth Report</b>`,
    `<i>${new Date().toUTCString()}</i>`,
    ``,
    `<b>Users</b>`,
    `• Total: <b>${fmt(totalUsers)}</b>`,
    `• Premium: <b>${fmt(premiumUsers)}</b> (${pct(premiumUsers, totalUsers)})`,
    `• Active miners: <b>${fmt(miningActive)}</b> (${pct(miningActive, totalUsers)})`,
    `• Referred users: <b>${fmt(withReferrer)}</b> (${pct(withReferrer, totalUsers)})`,
    `• Wallets linked: <b>${fmt(withWallet)}</b>`,
    `• Daily claim today: <b>${fmt(claimedToday)}</b>`,
    ``,
    `<b>Activity signal</b>`,
    `• Touched last 24h: <b>${fmt(new24h)}</b>`,
    `• Touched last 7d: <b>${fmt(new7d)}</b>`,
    ``,
    `<b>Economy</b>`,
    `• Vault SHIB (sum): <b>${fmt(vault)}</b>`,
    `• Avg vault: <b>${fmt(avgVault)}</b>`,
    `• Lifetime points: <b>${fmt(lifetime)}</b>`,
    `• Referral SHIB earned: <b>${fmt(refPts)}</b>`,
    ``,
    `<b>Top vaults</b>`,
    topBalLines || '—',
    ``,
    `<b>Top referral earners</b>`,
    topRefLines || '—',
  ].join('\n');
}

export async function getJarvisBrief(): Promise<string> {
  const [total, mining, active24h] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { autoMineActive: true } }).catch(() => 0),
    prisma.user.count({
      where: { lastPointsUpdateTimestamp: { gte: new Date(Date.now() - 86400000) } },
    }),
  ]);
  return [
    `<b>🕹 JARVIS online</b>`,
    ``,
    `Users: <b>${fmt(total)}</b> · Mining: <b>${fmt(mining)}</b> · 24h active: <b>${fmt(active24h)}</b>`,
    ``,
    `<b>Commands</b>`,
    `Send any message — Jarvis opens automatically`,
    `/growth — full growth report`,
    `/stats — quick stats`,
    `/send &lt;message&gt; — DM all users`,
    `/send_preview &lt;message&gt; — preview only`,
    `/payout — post next payout to channel (force)`,
    `/user &lt;telegramId&gt; — lookup user`,
    ``,
    `Only authorized admin IDs can use Jarvis.`,
  ].join('\n');
}

export function jarvisKeyboard(): InlineKeyboard {
  return [
    [
      { text: '📈 Growth', callback_data: 'jarvis_growth' },
      { text: '⚡ Quick stats', callback_data: 'jarvis_stats' },
    ],
    [
      { text: '📣 /send help', callback_data: 'jarvis_bcast_help' },
      { text: '🔄 Refresh', callback_data: 'jarvis_home' },
    ],
  ];
}

export const PROMOTION_URL = 'https://t.me/AdEaslyLTCBot';

function miniAppDeepLink(): string {
  const bot = (
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    process.env.PAYOUT_BOT_USERNAME ||
    'Shiba_Inu_Pro_Miner_Bot'
  ).replace(/^@/, '');
  const short = process.env.NEXT_PUBLIC_TG_APP_SHORT_NAME || 'SHIB';
  return `https://t.me/${bot}/${short}`;
}

/** Buttons attached to every /send mass DM */
export function broadcastKeyboard(): InlineKeyboard {
  return [
    [{ text: '🚀 Open Shiba Miner', url: miniAppDeepLink() }],
    [{ text: '🎁 Promotion', url: PROMOTION_URL }],
  ];
}

export async function lookupUser(telegramId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { telegramId: String(telegramId) },
    include: { _count: { select: { referrals: true, completedTasks: true } } },
  });
  if (!u) return `No user found for <code>${telegramId}</code>.`;
  return [
    `<b>User lookup</b>`,
    `Name: <b>${u.name || '—'}</b>`,
    `TG ID: <code>${u.telegramId}</code>`,
    `Premium: ${u.isPremium ? 'yes' : 'no'}`,
    `Vault: <b>${fmt(u.pointsBalance)}</b> SHIB`,
    `Points: <b>${fmt(u.points)}</b>`,
    `Mining: ${u.autoMineActive ? 'ON' : 'OFF'}`,
    `Referrals: ${u._count.referrals}`,
    `Tasks done: ${u._count.completedTasks}`,
    `Wallet: <code>${u.tonWalletAddress || '—'}</code>`,
    `Last touch: ${u.lastPointsUpdateTimestamp.toISOString()}`,
  ].join('\n');
}

export type BroadcastResult = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Send HTML message to every user with a numeric Telegram ID.
 * Skips invalid IDs like bypass "undefined".
 * Attaches Open Miner + Promotion buttons by default.
 */
export async function broadcastToAllUsers(
  html: string,
  opts?: {
    dryRun?: boolean;
    onProgress?: (done: number, total: number) => void;
    replyMarkup?: { inline_keyboard: InlineKeyboard };
    disablePreview?: boolean;
  }
): Promise<BroadcastResult> {
  const users = await prisma.user.findMany({
    select: { telegramId: true },
  });

  const targets = users
    .map((u) => u.telegramId)
    .filter((id) => /^\d+$/.test(String(id)));

  const result: BroadcastResult = {
    total: targets.length,
    sent: 0,
    failed: 0,
    skipped: users.length - targets.length,
  };

  if (opts?.dryRun) return result;

  const replyMarkup = opts?.replyMarkup ?? { inline_keyboard: broadcastKeyboard() };

  for (let i = 0; i < targets.length; i++) {
    const id = targets[i]!;
    const res = await sendTelegramMessage({
      chatId: id,
      text: html,
      parseMode: 'HTML',
      disablePreview: opts?.disablePreview ?? true,
      replyMarkup,
    });
    if (res.ok) result.sent += 1;
    else result.failed += 1;
    opts?.onProgress?.(i + 1, targets.length);
    // Soft rate-limit (~25 msg/s ceiling; stay safer)
    await new Promise((r) => setTimeout(r, 45));
  }

  return result;
}

export function formatBroadcastEnvelope(body: string): string {
  const bot = (
    process.env.NEXT_PUBLIC_BOT_USERNAME || 'Shiba_Inu_Pro_Miner_Bot'
  ).replace(/^@/, '');
  return [
    `<b>🐾 Shiba Miner</b>`,
    `<i>Announcement · @${bot}</i>`,
    ``,
    body.trim(),
    ``,
    `<i>Tap below to open the miner or check today’s promotion.</i>`,
  ].join('\n');
}
