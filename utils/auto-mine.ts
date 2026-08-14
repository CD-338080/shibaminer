export const AUTO_MINE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const AUTO_MINE_REWARD = 1; // +1 SHIB per tick
export const AUTO_MINE_MAX_OFFLINE_MS = 24 * 60 * 60 * 1000; // 24h cap

export function formatMineCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function settleAutoMine(
  lastTickAt: Date | null | undefined,
  now = Date.now()
): { ticks: number; reward: number; newLastTickAt: Date; msUntilNext: number } {
  if (!lastTickAt) {
    return {
      ticks: 0,
      reward: 0,
      newLastTickAt: new Date(now),
      msUntilNext: AUTO_MINE_INTERVAL_MS,
    };
  }

  const last = lastTickAt.getTime();
  const elapsed = Math.min(Math.max(0, now - last), AUTO_MINE_MAX_OFFLINE_MS);
  const ticks = Math.floor(elapsed / AUTO_MINE_INTERVAL_MS);
  const remainder = elapsed % AUTO_MINE_INTERVAL_MS;
  const newLastTickAt = new Date(last + ticks * AUTO_MINE_INTERVAL_MS);
  const msUntilNext = AUTO_MINE_INTERVAL_MS - remainder;

  return {
    ticks,
    reward: ticks * AUTO_MINE_REWARD,
    newLastTickAt,
    msUntilNext,
  };
}
