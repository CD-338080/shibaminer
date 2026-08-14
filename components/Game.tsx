'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import TopInfoSection from '@/components/TopInfoSection';
import { useGameStore } from '@/utils/game-mechanics';
import { LEVELS } from '@/utils/consts';
import { triggerHapticFeedback, triggerHapticNotification } from '@/utils/ui';
import { playSfx } from '@/utils/sfx';
import {
  DAILY_CLAIM_REWARD,
  formatCountdown,
  msUntilNextUtcMidnight,
} from '@/utils/daily-claim';
import {
  AUTO_MINE_INTERVAL_MS,
  AUTO_MINE_REWARD,
  formatMineCountdown,
} from '@/utils/auto-mine';
import { getRecommendedPlan } from '@/utils/mining-plans';
import { useToast } from '@/contexts/ToastContext';
import ShibaCoinIcon from '@/icons/ShibaCoin';

interface GameProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

function ShibaMark({
  size = 96,
  pulsing = false,
}: {
  size?: number;
  pulsing?: boolean;
}) {
  return (
    <div
      className={`sh-mark ${pulsing ? 'sh-mark-hit' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ShibaCoinIcon size={size} />
    </div>
  );
}

/** Live dig chamber — rings, sparks, countdown (no spinning coin) */
function DigForge({
  active,
  progress,
  countdown,
  pulse,
  reward,
}: {
  active: boolean;
  progress: number;
  countdown: string;
  pulse: boolean;
  reward: number;
}) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div
      className={`sh-forge ${active ? 'is-live' : 'is-idle'} ${pulse ? 'is-hit' : ''}`}
      aria-hidden={!active}
    >
      <div
        className="sh-forge-arc"
        style={{
          background: `conic-gradient(from 210deg, #ff6b1a ${pct}%, rgba(244,235,227,0.08) ${pct}%)`,
        }}
      />
      <div className="sh-forge-arc-mask" />

      <span className="sh-forge-ring r1" />
      <span className="sh-forge-ring r2" />
      <span className="sh-forge-ring r3" />

      <span className="sh-forge-beam" />
      <span className="sh-forge-impact" />

      <div className="sh-forge-sparks">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`sh-spark s${i}`} />
        ))}
      </div>

      <div className="sh-forge-core">
        <p className="sh-forge-label">{active ? 'NEXT DROP' : 'STANDBY'}</p>
        <p className="sh-forge-time">{active ? countdown : '5:00'}</p>
        <p className="sh-forge-unit">
          +{reward} <span>SHIB</span>
        </p>
      </div>
    </div>
  );
}

export default function Game({ setCurrentView }: GameProps) {
  const showToast = useToast();
  const {
    points,
    pointsBalance,
    gameLevelIndex,
    userTelegramInitData,
    setPoints,
    setPointsBalance,
  } = useGameStore();

  const [miningActive, setMiningActive] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [msUntilNext, setMsUntilNext] = useState(AUTO_MINE_INTERVAL_MS);
  const [sessionMined, setSessionMined] = useState(0);
  const [claimedToday, setClaimedToday] = useState(true);
  const [streak, setStreak] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimCountdown, setClaimCountdown] = useState(
    formatCountdown(msUntilNextUtcMidnight())
  );
  const [awayBanner, setAwayBanner] = useState<number | null>(null);
  const [stillMiningBanner, setStillMiningBanner] = useState(false);
  const [coinPulse, setCoinPulse] = useState(false);
  const openedRef = useRef(false);
  const recommended = getRecommendedPlan();

  const pulseCoin = useCallback(() => {
    setCoinPulse(true);
    window.setTimeout(() => setCoinPulse(false), 700);
  }, []);

  const applyBalance = useCallback(
    (
      data: { points?: number; pointsBalance?: number; reward?: number },
      opts?: { silentToast?: boolean; showAwayBanner?: boolean }
    ) => {
      if (typeof data.points === 'number') setPoints(data.points);
      if (typeof data.pointsBalance === 'number') setPointsBalance(data.pointsBalance);
      if (data.reward && data.reward > 0) {
        setSessionMined((n) => n + data.reward!);
        playSfx('claim');
        triggerHapticNotification('success');
        pulseCoin();
        if (opts?.showAwayBanner) {
          setAwayBanner(data.reward);
        } else if (!opts?.silentToast) {
          showToast(`+${data.reward} SHIB mined`, 'success');
        }
      }
    },
    [setPoints, setPointsBalance, showToast, pulseCoin]
  );

  const refreshMiner = useCallback(async () => {
    if (!userTelegramInitData) return;
    try {
      const res = await fetch(
        `/api/auto-mine?initData=${encodeURIComponent(userTelegramInitData)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const wasFirstOpen = !openedRef.current;
      openedRef.current = true;

      setMiningActive(!!data.active);
      if (typeof data.msUntilNext === 'number') setMsUntilNext(data.msUntilNext);

      const offlineReward = typeof data.reward === 'number' ? data.reward : 0;
      applyBalance(data, {
        showAwayBanner: wasFirstOpen && offlineReward > 0,
        silentToast: wasFirstOpen && offlineReward > 0,
      });

      if (wasFirstOpen && data.active) {
        setStillMiningBanner(true);
      }
    } catch (e) {
      console.error('Failed to refresh auto-mine', e);
    }
  }, [userTelegramInitData, applyBalance]);

  useEffect(() => {
    refreshMiner();
  }, [refreshMiner]);

  useEffect(() => {
    if (awayBanner == null) return;
    const id = window.setTimeout(() => setAwayBanner(null), 3200);
    return () => window.clearTimeout(id);
  }, [awayBanner]);

  useEffect(() => {
    if (!stillMiningBanner) return;
    const id = window.setTimeout(() => setStillMiningBanner(false), 2800);
    return () => window.clearTimeout(id);
  }, [stillMiningBanner]);

  useEffect(() => {
    const loadClaim = async () => {
      if (!userTelegramInitData) return;
      try {
        const res = await fetch(
          `/api/daily-claim?initData=${encodeURIComponent(userTelegramInitData)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setClaimedToday(!!data.claimedToday);
        if (typeof data.streak === 'number') setStreak(data.streak);
      } catch (e) {
        console.error('Failed to load daily claim', e);
      }
    };
    loadClaim();
  }, [userTelegramInitData]);

  useEffect(() => {
    const id = setInterval(() => {
      setClaimCountdown(formatCountdown(msUntilNextUtcMidnight()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!miningActive) return;

    const tick = window.setInterval(() => {
      setMsUntilNext((prev: number) => Math.max(0, prev - 1000));
    }, 1000);

    // Settle with DB when the 5m window ends (and every 30s as backup)
    const settle = window.setInterval(() => {
      void refreshMiner();
    }, 30_000);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(settle);
    };
  }, [miningActive, refreshMiner]);

  useEffect(() => {
    if (!miningActive || msUntilNext > 0) return;
    // Hit zero → ask server to credit DB, then sync countdown
    const id = window.setTimeout(() => {
      void refreshMiner();
    }, 200);
    return () => window.clearTimeout(id);
  }, [miningActive, msUntilNext, refreshMiner]);

  const handleToggleMining = async () => {
    if (!userTelegramInitData || isToggling) return;
    setIsToggling(true);
    triggerHapticFeedback(window, 'medium');
    try {
      const action = miningActive ? 'stop' : 'start';
      const res = await fetch('/api/auto-mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: userTelegramInitData, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Miner error', 'error');
        return;
      }
      setMiningActive(!!data.active);
      if (typeof data.msUntilNext === 'number') setMsUntilNext(data.msUntilNext);
      applyBalance(data);
      playSfx(data.active ? 'success' : 'click');
      showToast(
        data.active ? 'Shiba pack digging — earns offline' : 'Mining stopped',
        data.active ? 'success' : 'error'
      );
    } catch (e) {
      console.error(e);
      showToast('Could not update miner', 'error');
    } finally {
      setIsToggling(false);
    }
  };

  const handleDailyClaim = async () => {
    if (claimedToday || isClaiming || !userTelegramInitData) return;
    setIsClaiming(true);
    triggerHapticFeedback(window, 'medium');
    try {
      const res = await fetch('/api/daily-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: userTelegramInitData }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setClaimedToday(true);
        showToast(data.error || 'Already claimed today', 'error');
        return;
      }
      setClaimedToday(true);
      if (typeof data.streak === 'number') setStreak(data.streak);
      if (typeof data.points === 'number') setPoints(data.points);
      if (typeof data.pointsBalance === 'number') setPointsBalance(data.pointsBalance);
      playSfx('claim');
      triggerHapticNotification('success');
      pulseCoin();
      showToast(`+${data.reward ?? DAILY_CLAIM_REWARD} SHIB daily drop!`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to claim daily reward', 'error');
    } finally {
      setIsClaiming(false);
    }
  };

  const calculateProgress = () => {
    if (gameLevelIndex >= LEVELS.length - 1) return 100;
    const currentLevelMin = LEVELS[gameLevelIndex].minPoints;
    const nextLevelMin = LEVELS[gameLevelIndex + 1].minPoints;
    return Math.min(((points - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100, 100);
  };

  const tickProgress =
    AUTO_MINE_INTERVAL_MS > 0
      ? Math.min(100, ((AUTO_MINE_INTERVAL_MS - msUntilNext) / AUTO_MINE_INTERVAL_MS) * 100)
      : 0;

  const statusLine = miningActive
    ? `DIGGING · next ${formatMineCountdown(msUntilNext)}`
    : 'PACK IDLE · tap to dig';

  return (
    <div className="sh-root flex justify-center min-h-screen">
      <div className="w-full max-w-xl h-[100dvh] max-h-[100dvh] flex flex-col text-[#f4ebe3] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 sh-bg" />
        <div className="pointer-events-none absolute inset-0 sh-grid" />
        <div className="pointer-events-none absolute -top-24 right-[-20%] w-[70%] h-[45%] sh-flare" />
        <div className="pointer-events-none absolute bottom-16 left-[-30%] w-[75%] h-[40%] sh-flare-soft" />

        <div className="relative z-10 shrink-0">
          <TopInfoSection isGamePage={true} setCurrentView={setCurrentView} />
        </div>

        {(awayBanner != null || stillMiningBanner) && (
          <div className="relative z-20 px-4 pt-2">
            {awayBanner != null && (
              <div className="sh-toast-away" role="status">
                <span className="sh-eyebrow">offline haul</span>
                <p className="sh-toast-value">
                  +{awayBanner} <span>SHIB</span>
                </p>
              </div>
            )}
            {stillMiningBanner && awayBanner == null && (
              <div className="sh-toast-live" role="status">
                Pack already digging — no tap required
              </div>
            )}
          </div>
        )}

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-28 px-4 sh-scroll">
          <header className="mt-3 sh-brand">
            <p className="sh-kicker">Shiba Inu · SHIB</p>
            <h1 className="sh-title">
              SHIBA
              <span>MINER</span>
            </h1>
            <p className="sh-sub">
              One switch. {AUTO_MINE_REWARD} SHIB every 5 minutes — keeps stacking while Telegram is
              closed.
            </p>
          </header>

          <section className="mt-5 sh-ledger" aria-label="Balance">
            <div className="flex items-center gap-3 min-w-0">
              <ShibaMark size={42} pulsing={coinPulse} />
              <div className="min-w-0">
                <p className="sh-meta">vault</p>
                <p className="sh-balance" suppressHydrationWarning>
                  {Math.floor(pointsBalance).toLocaleString()}
                  <span>SHIB</span>
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className={`sh-status ${miningActive ? 'is-on' : 'is-off'}`}>
                {miningActive ? 'ON AIR' : 'STANDBY'}
              </span>
              <p className="sh-meta mt-2">
                RANK {gameLevelIndex + 1}/{LEVELS.length}
              </p>
            </div>
          </section>

          <section className="mt-3 sh-drop" aria-label="Daily claim">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="sh-meta accent">daily bone</p>
                {streak > 0 && <span className="sh-streak">streak {streak}</span>}
              </div>
              <p className="sh-drop-amt">
                +{DAILY_CLAIM_REWARD} SHIB <em>free</em>
              </p>
              {claimedToday && (
                <p className="sh-meta mt-1">resets in {claimCountdown}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDailyClaim}
              disabled={claimedToday || isClaiming}
              className={claimedToday || isClaiming ? 'sh-btn-ghost' : 'sh-btn-fire'}
            >
              {isClaiming ? '…' : claimedToday ? 'LOCKED' : 'CLAIM'}
            </button>
          </section>

          <section className="mt-5 sh-arena" aria-label="Miner">
            <div className={`sh-arena-inner ${miningActive ? 'is-live' : ''}`}>
              <DigForge
                active={miningActive}
                progress={tickProgress}
                countdown={formatMineCountdown(msUntilNext)}
                pulse={coinPulse}
                reward={AUTO_MINE_REWARD}
              />

              <p className="sh-statusline">{statusLine}</p>

              <div className="sh-meter">
                <div
                  className="sh-meter-fill"
                  style={{ width: `${miningActive ? tickProgress : 0}%` }}
                />
              </div>

              <button
                type="button"
                onClick={handleToggleMining}
                disabled={isToggling || !userTelegramInitData}
                className={`sh-cta ${miningActive ? 'is-stop' : 'is-go'}`}
              >
                {isToggling ? '…' : miningActive ? 'STOP DIG' : 'START DIG'}
              </button>

              <p className="sh-footnote">
                Close the app anytime. Server keeps the haul and drops it on reopen.
              </p>
            </div>
          </section>

          {!miningActive && (
            <button
              type="button"
              className="mt-3 sh-boost"
              onClick={() => {
                triggerHapticFeedback(window);
                setCurrentView('mine');
              }}
            >
              Push harder → {recommended.name} · +{recommended.boostPercent}% /{' '}
              {recommended.contractDays}d
            </button>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="sh-tile">
              <span className="sh-meta">rate</span>
              <span className="sh-tile-val">{AUTO_MINE_REWARD}/5m</span>
            </div>
            <div className="sh-tile">
              <span className="sh-meta">session</span>
              <span className="sh-tile-val">+{sessionMined}</span>
            </div>
            <div className="sh-tile">
              <span className="sh-meta">/hour</span>
              <span className="sh-tile-val">{(60 / 5) * AUTO_MINE_REWARD}</span>
            </div>
          </div>

          <div className="mt-4 mb-2">
            <div className="flex justify-between sh-meta mb-1">
              <span className="truncate max-w-[60%]">{LEVELS[gameLevelIndex].name}</span>
              <span>{Math.round(calculateProgress())}%</span>
            </div>
            <div className="sh-xp">
              <div className="sh-xp-fill" style={{ width: `${calculateProgress()}%` }} />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Syne:wght@600;700;800&display=swap');

        .sh-root {
          --ink: #0c0c0e;
          --paper: #f4ebe3;
          --ember: #ff6b1a;
          --ember-deep: #c23400;
          --mute: #9a8f86;
          font-family: 'Syne', system-ui, sans-serif;
          background: var(--ink);
          color: var(--paper);
        }
        .sh-scroll {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
          overscroll-behavior-y: contain;
        }
        .sh-bg {
          background:
            radial-gradient(ellipse 80% 50% at 80% -10%, rgba(255, 107, 26, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 45% at 0% 100%, rgba(255, 107, 26, 0.12), transparent 50%),
            linear-gradient(165deg, #141210 0%, #0c0c0e 48%, #16120f 100%);
        }
        .sh-grid {
          opacity: 0.18;
          background-image:
            linear-gradient(rgba(244, 235, 227, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 235, 227, 0.06) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
        }
        .sh-flare {
          background: radial-gradient(circle, rgba(255, 107, 26, 0.35), transparent 68%);
          filter: blur(8px);
          animation: shDrift 9s ease-in-out infinite alternate;
        }
        .sh-flare-soft {
          background: radial-gradient(circle, rgba(255, 140, 66, 0.16), transparent 70%);
          filter: blur(20px);
          animation: shDrift 12s ease-in-out infinite alternate-reverse;
        }
        @keyframes shDrift {
          from {
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            transform: translate3d(-12px, 18px, 0) scale(1.08);
          }
        }
        .sh-brand {
          padding-top: 4px;
        }
        .sh-kicker {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--ember);
        }
        .sh-title {
          margin-top: 6px;
          font-size: clamp(2.4rem, 11vw, 3.1rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 0.9;
          text-transform: uppercase;
        }
        .sh-title span {
          display: block;
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(244, 235, 227, 0.85);
        }
        .sh-sub {
          margin-top: 10px;
          max-width: 19rem;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          color: var(--mute);
        }
        .sh-eyebrow {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--ember);
        }
        .sh-toast-away {
          padding: 14px 16px;
          border: 1px solid rgba(255, 107, 26, 0.55);
          background: linear-gradient(120deg, rgba(255, 107, 26, 0.18), rgba(12, 12, 14, 0.92));
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
          animation: shIn 0.4s cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }
        .sh-toast-value {
          margin-top: 4px;
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .sh-toast-value span {
          margin-left: 6px;
          font-size: 0.85rem;
          color: var(--ember);
        }
        .sh-toast-live {
          padding: 11px 14px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          border-left: 3px solid var(--ember);
          background: rgba(255, 107, 26, 0.1);
          animation: shIn 0.35s ease-out both;
        }
        @keyframes shIn {
          from {
            opacity: 0;
            transform: translateY(-10px) skewX(-2deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) skewX(0);
          }
        }
        .sh-ledger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid rgba(244, 235, 227, 0.12);
          border-bottom: 1px solid rgba(244, 235, 227, 0.12);
        }
        .sh-meta {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--mute);
        }
        .sh-meta.accent {
          color: var(--ember);
        }
        .sh-balance {
          margin-top: 2px;
          font-size: 1.85rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .sh-balance span {
          margin-left: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: var(--ember);
        }
        .sh-status {
          display: inline-block;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          padding: 5px 8px;
          border: 1px solid currentColor;
        }
        .sh-status.is-on {
          color: #7dffb3;
          animation: shBlink 1.6s ease-in-out infinite;
        }
        .sh-status.is-off {
          color: var(--mute);
        }
        @keyframes shBlink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.55;
          }
        }
        .sh-drop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 0 4px;
        }
        .sh-drop-amt {
          margin-top: 4px;
          font-size: 15px;
          font-weight: 700;
        }
        .sh-drop-amt em {
          font-style: normal;
          color: var(--mute);
          font-weight: 600;
        }
        .sh-streak {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 3px 7px;
          color: var(--ink);
          background: var(--ember);
        }
        .sh-btn-fire {
          flex-shrink: 0;
          padding: 12px 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          color: var(--ink);
          background: var(--ember);
          clip-path: polygon(0 0, 100% 0, 100% 72%, 88% 100%, 0 100%);
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .sh-btn-fire:active {
          transform: translateY(1px) scale(0.98);
        }
        .sh-btn-ghost {
          flex-shrink: 0;
          padding: 12px 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          color: var(--mute);
          border: 1px solid rgba(154, 143, 134, 0.45);
          background: transparent;
          cursor: not-allowed;
        }
        .sh-arena {
          margin-top: 8px;
          border: 1px solid rgba(244, 235, 227, 0.14);
          background: linear-gradient(180deg, rgba(255, 107, 26, 0.1), rgba(12, 12, 14, 0.55));
          position: relative;
          overflow: hidden;
        }
        .sh-arena::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--ember), transparent);
          opacity: 0.55;
        }
        .sh-arena-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 22px 16px 22px;
        }
        .sh-arena-inner.is-live::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 55% 40% at 50% 35%, rgba(255, 107, 26, 0.16), transparent 70%);
          pointer-events: none;
          animation: shPulseGlow 2.2s ease-in-out infinite;
        }
        @keyframes shPulseGlow {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
        }

        /* Dig forge — countdown reactor */
        .sh-forge {
          position: relative;
          width: 210px;
          height: 210px;
          display: grid;
          place-items: center;
          isolation: isolate;
        }
        .sh-forge-arc {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          transition: background 0.9s linear;
          opacity: 0.95;
        }
        .sh-forge-arc-mask {
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 42%, #1a1512 0%, #0c0c0e 72%);
          border: 1px solid rgba(255, 107, 26, 0.22);
          z-index: 1;
        }
        .sh-forge-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255, 107, 26, 0.2);
          z-index: 2;
          pointer-events: none;
        }
        .sh-forge-ring.r1 {
          inset: 28px;
        }
        .sh-forge-ring.r2 {
          inset: 46px;
          border-style: dashed;
          opacity: 0.7;
        }
        .sh-forge-ring.r3 {
          inset: 64px;
          opacity: 0.45;
        }
        .sh-forge.is-live .sh-forge-ring.r1 {
          animation: shRingExpand 2.8s ease-out infinite;
          border-color: rgba(255, 107, 26, 0.55);
        }
        .sh-forge.is-live .sh-forge-ring.r2 {
          animation: shRingSpin 12s linear infinite;
          border-color: rgba(255, 107, 26, 0.4);
        }
        .sh-forge.is-live .sh-forge-ring.r3 {
          animation: shRingExpand 2.8s ease-out 0.9s infinite;
        }
        @keyframes shRingExpand {
          0% {
            transform: scale(0.92);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.12);
            opacity: 0;
          }
        }
        @keyframes shRingSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .sh-forge-beam {
          position: absolute;
          top: 18%;
          left: 50%;
          width: 3px;
          height: 38%;
          transform: translateX(-50%);
          background: linear-gradient(180deg, transparent, rgba(255, 107, 26, 0.15), transparent);
          z-index: 2;
          opacity: 0.35;
        }
        .sh-forge.is-live .sh-forge-beam {
          opacity: 1;
          background: linear-gradient(180deg, transparent, #ff6b1a, #ffb347, transparent);
          box-shadow: 0 0 14px rgba(255, 107, 26, 0.65);
          animation: shBeam 0.85s ease-in-out infinite;
        }
        @keyframes shBeam {
          0%,
          100% {
            opacity: 0.55;
            transform: translateX(-50%) scaleY(0.92);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scaleY(1.05);
          }
        }
        .sh-forge-impact {
          position: absolute;
          bottom: 26%;
          left: 50%;
          width: 42px;
          height: 8px;
          transform: translateX(-50%);
          border-radius: 50%;
          background: rgba(255, 107, 26, 0.15);
          z-index: 2;
        }
        .sh-forge.is-live .sh-forge-impact {
          animation: shImpact 0.85s ease-in-out infinite;
          background: rgba(255, 107, 26, 0.55);
          box-shadow: 0 0 18px rgba(255, 107, 26, 0.55);
        }
        @keyframes shImpact {
          0%,
          100% {
            transform: translateX(-50%) scaleX(0.7);
            opacity: 0.4;
          }
          50% {
            transform: translateX(-50%) scaleX(1.25);
            opacity: 1;
          }
        }
        .sh-forge-sparks {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          opacity: 0;
        }
        .sh-forge.is-live .sh-forge-sparks {
          opacity: 1;
        }
        .sh-spark {
          position: absolute;
          left: 50%;
          bottom: 28%;
          width: 4px;
          height: 4px;
          margin-left: -2px;
          background: #ff6b1a;
          opacity: 0;
        }
        .sh-forge.is-live .sh-spark {
          animation: shSpark 1.8s ease-out infinite;
        }
        .sh-spark.s0 {
          animation-delay: 0s;
          --dx: -28px;
          --dy: -72px;
        }
        .sh-spark.s1 {
          animation-delay: 0.15s;
          --dx: 22px;
          --dy: -80px;
        }
        .sh-spark.s2 {
          animation-delay: 0.35s;
          --dx: -40px;
          --dy: -48px;
        }
        .sh-spark.s3 {
          animation-delay: 0.5s;
          --dx: 36px;
          --dy: -54px;
        }
        .sh-spark.s4 {
          animation-delay: 0.7s;
          --dx: -12px;
          --dy: -90px;
        }
        .sh-spark.s5 {
          animation-delay: 0.9s;
          --dx: 10px;
          --dy: -66px;
        }
        .sh-spark.s6 {
          animation-delay: 1.05s;
          --dx: -48px;
          --dy: -36px;
        }
        .sh-spark.s7 {
          animation-delay: 1.2s;
          --dx: 48px;
          --dy: -40px;
        }
        .sh-spark.s8 {
          animation-delay: 1.4s;
          --dx: 0px;
          --dy: -96px;
        }
        .sh-spark.s9 {
          animation-delay: 1.55s;
          --dx: -20px;
          --dy: -58px;
        }
        @keyframes shSpark {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.6);
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--dx), var(--dy)) scale(0.2);
          }
        }
        .sh-forge-core {
          position: relative;
          z-index: 4;
          text-align: center;
          padding: 8px 12px;
        }
        .sh-forge-label {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.22em;
          color: var(--mute);
        }
        .sh-forge.is-live .sh-forge-label {
          color: var(--ember);
          animation: shBlink 1.6s ease-in-out infinite;
        }
        .sh-forge-time {
          margin-top: 4px;
          font-size: 2.35rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          color: var(--paper);
          text-shadow: 0 0 24px rgba(255, 107, 26, 0.25);
        }
        .sh-forge.is-idle .sh-forge-time {
          color: rgba(244, 235, 227, 0.35);
          text-shadow: none;
        }
        .sh-forge-unit {
          margin-top: 6px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--paper);
        }
        .sh-forge-unit span {
          color: var(--ember);
        }
        .sh-forge.is-hit .sh-forge-core {
          animation: shHit 0.7s ease-out;
        }
        .sh-forge.is-hit .sh-forge-arc-mask {
          box-shadow: inset 0 0 28px rgba(255, 107, 26, 0.35);
        }

        .sh-mark {
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          filter: drop-shadow(0 8px 16px rgba(255, 107, 26, 0.22));
        }
        .sh-mark > span {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
        .sh-mark-hit {
          animation: shHit 0.7s ease-out;
        }
        @keyframes shHit {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.08);
            filter: drop-shadow(0 0 18px rgba(255, 107, 26, 0.65));
          }
          100% {
            transform: scale(1);
          }
        }
        .sh-statusline {
          margin-top: 18px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--mute);
          text-align: center;
        }
        .sh-meter {
          margin-top: 12px;
          width: 100%;
          max-width: 220px;
          height: 3px;
          background: rgba(244, 235, 227, 0.12);
          overflow: hidden;
        }
        .sh-meter-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--ember-deep), var(--ember));
          transition: width 0.9s linear;
        }
        .sh-cta {
          margin-top: 18px;
          width: 100%;
          max-width: 230px;
          padding: 15px 18px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.18em;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .sh-cta:active {
          transform: scale(0.97);
        }
        .sh-cta.is-go {
          color: var(--ink);
          background: var(--ember);
          box-shadow: 0 0 0 1px rgba(255, 107, 26, 0.4), 0 12px 28px rgba(255, 107, 26, 0.28);
        }
        .sh-cta.is-stop {
          color: var(--paper);
          background: transparent;
          border: 1px solid rgba(244, 235, 227, 0.35);
        }
        .sh-footnote {
          margin-top: 14px;
          max-width: 240px;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.45;
          color: var(--mute);
        }
        .sh-boost {
          width: 100%;
          padding: 13px 14px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--paper);
          border: 1px solid rgba(255, 107, 26, 0.35);
          background: rgba(255, 107, 26, 0.08);
        }
        .sh-boost:active {
          transform: scale(0.99);
        }
        .sh-tile {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 10px;
          border-top: 1px solid rgba(244, 235, 227, 0.14);
        }
        .sh-tile-val {
          font-size: 15px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .sh-xp {
          height: 2px;
          background: rgba(244, 235, 227, 0.12);
          overflow: hidden;
        }
        .sh-xp-fill {
          height: 100%;
          background: var(--ember);
          transition: width 0.4s ease;
        }
      `}</style>
    </div>
  );
}
