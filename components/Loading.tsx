'use client'

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { botUrlQr } from '@/images';
import ShibaCoin from '@/icons/ShibaCoin';
import {
  calculateEnergyLimit,
  calculateLevelIndex,
  calculatePointsPerClick,
  calculateProfitPerHour,
  GameState,
  InitialGameState,
  useGameStore,
} from '@/utils/game-mechanics';
import UAParser from 'ua-parser-js';
import { ALLOW_ALL_DEVICES } from '@/utils/consts';
import {
  DEV_TELEGRAM_ID,
  parseReferrerFromStartParam,
  resolveStartView,
} from '@/utils/bot-deep-links';

interface LoadingProps {
  setIsInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentView: (view: string) => void;
}

export default function Loading({ setIsInitialized, setCurrentView }: LoadingProps) {
  const initializeState = useGameStore((state: GameState) => state.initializeState);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const openTimestampRef = useRef(Date.now());
  const startViewRef = useRef('game');
  const [isAppropriateDevice, setIsAppropriateDevice] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [phase, setPhase] = useState<'enter' | 'ready' | 'exit'>('enter');
  const [bootError, setBootError] = useState<string | null>(null);

  const sendWelcomeMessage = async (telegramId: string, telegramName: string) => {
    try {
      if (process.env.NEXT_PUBLIC_BYPASS_TELEGRAM_AUTH === 'true') return;
      const response = await fetch('/api/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, telegramName }),
      });
      if (!response.ok) {
        console.error('Failed to send welcome message');
      }
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  };

  const fetchOrCreateUser = useCallback(async () => {
    try {
      let initData: string | undefined;
      let telegramId: string | undefined;
      let username: string | undefined;
      let telegramName: string | undefined;
      let startParam: string | undefined;

      if (typeof window !== 'undefined') {
        const WebApp = (await import('@twa-dev/sdk')).default;
        WebApp.ready();
        try {
          WebApp.bottomBarColor = '#0c0c0e';
          WebApp.headerColor = '#0c0c0e';
        } catch {
          /* older clients */
        }
        WebApp.disableVerticalSwipes();
        WebApp.expand();
        initData = WebApp.initData;
        telegramId = WebApp.initDataUnsafe.user?.id.toString();
        username = WebApp.initDataUnsafe.user?.username || 'Unknown User';
        telegramName = WebApp.initDataUnsafe.user?.first_name || 'Unknown User';
        startParam = WebApp.initDataUnsafe.start_param;
      }

      startViewRef.current = resolveStartView(startParam);
      const referrerTelegramId = parseReferrerFromStartParam(startParam);

      if (process.env.NEXT_PUBLIC_BYPASS_TELEGRAM_AUTH === 'true') {
        initData = 'temp';
        telegramId = DEV_TELEGRAM_ID;
        telegramName = 'Dev User';
      }

      const loadingInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 72) {
            clearInterval(loadingInterval);
            return prev;
          }
          return Math.min(72, prev + 4 + Math.random() * 8);
        });
      }, 220);

      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramInitData: initData,
          referrerTelegramId,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch or create user');
      }
      const userData = await response.json();

      if (!initData) throw new Error('initData is undefined');
      if (!telegramName) throw new Error('telegramName is undefined');

      void username;

      const initialState: InitialGameState = {
        userTelegramInitData: initData,
        userTelegramName: telegramName,
        lastClickTimestamp: userData.lastPointsUpdateTimestamp,
        gameLevelIndex: calculateLevelIndex(userData.points),
        points: userData.points,
        pointsBalance: userData.pointsBalance,
        unsynchronizedPoints: 0,
        multitapLevelIndex: userData.multitapLevelIndex,
        pointsPerClick: calculatePointsPerClick(userData.multitapLevelIndex),
        energy: userData.energy,
        maxEnergy: calculateEnergyLimit(userData.energyLimitLevelIndex),
        energyRefillsLeft: userData.energyRefillsLeft,
        energyLimitLevelIndex: userData.energyLimitLevelIndex,
        lastEnergyRefillTimestamp: userData.lastEnergyRefillsTimestamp,
        mineLevelIndex: userData.mineLevelIndex,
        profitPerHour: calculateProfitPerHour(userData.mineLevelIndex),
        tonWalletAddress: userData?.tonWalletAddress,
      };

      initializeState(initialState);

      if (telegramId) {
        await sendWelcomeMessage(telegramId, telegramName);
      }

      clearInterval(loadingInterval);
      setLoadingProgress(100);
      setIsDataLoaded(true);
      setBootError(null);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setBootError(
        process.env.NEXT_PUBLIC_BYPASS_TELEGRAM_AUTH === 'true'
          ? 'Boot failed — check /api/user and Prisma.'
          : 'Open this app inside Telegram, or set NEXT_PUBLIC_BYPASS_TELEGRAM_AUTH=true for local dev.'
      );
    }
  }, [initializeState]);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase('ready'), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const parser = new UAParser();
    const device = parser.getDevice();
    const isAppropriate = ALLOW_ALL_DEVICES || device.type === 'mobile' || device.type === 'tablet';
    setIsAppropriateDevice(isAppropriate);

    if (isAppropriate) {
      fetchOrCreateUser();
    }
  }, [fetchOrCreateUser]);

  useEffect(() => {
    if (!isDataLoaded) return;

    const currentTime = Date.now();
    const elapsedTime = currentTime - openTimestampRef.current;
    const remainingTime = Math.max(2800 - elapsedTime, 600);

    const exitTimer = window.setTimeout(() => setPhase('exit'), remainingTime);
    const doneTimer = window.setTimeout(() => {
      setCurrentView(startViewRef.current);
      setIsInitialized(true);
    }, remainingTime + 480);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [isDataLoaded, setIsInitialized, setCurrentView]);

  if (!isAppropriateDevice) {
    return (
      <div className="ld-root flex justify-center items-center h-[100dvh]">
        <div className="pointer-events-none absolute inset-0 ld-bg" />
        <div className="pointer-events-none absolute inset-0 ld-grid" />
        <div className="w-full max-w-xl flex flex-col items-center px-6 relative z-10">
          <ShibaCoin size={72} className="ld-coin-float mb-4" />
          <h1 className="ld-title text-2xl mb-2 text-center">Open on mobile</h1>
          <p className="ld-sub text-center mb-5 max-w-xs">
            Scan to launch Shiba Miner in Telegram and start digging SHIB offline.
          </p>
          <div className="ld-qr-wrap">
            <Image src={botUrlQr} alt="QR Code" width={188} height={188} />
          </div>
          <p className="mt-5 text-[#ff6b1a] font-bold tracking-wide font-mono text-sm">
            @{process.env.NEXT_PUBLIC_BOT_USERNAME || 'Shiba_Inu_Pro_Miner_Bot'}
          </p>
        </div>
        <LoadingStyles />
      </div>
    );
  }

  const pct = Math.min(100, Math.floor(loadingProgress));
  const statusLabel =
    bootError
      ? 'Boot error'
      : pct < 35
        ? 'Waking pack…'
        : pct < 75
          ? 'Syncing vault…'
          : pct < 100
            ? 'Almost ready…'
            : "Let's dig!";

  return (
    <div
      className={`ld-root flex justify-center items-center h-[100dvh] overflow-hidden ${
        phase === 'exit' ? 'ld-exit' : phase === 'ready' ? 'ld-ready' : 'ld-boot'
      }`}
    >
      <div className="absolute inset-0 bg-[#0c0c0e]" />
      <div className="pointer-events-none absolute inset-0 ld-bg" />
      <div className="pointer-events-none absolute inset-0 ld-grid" />
      <div className="pointer-events-none absolute -top-24 right-[-10%] w-[70%] h-[45%] ld-flare" />
      <div className="pointer-events-none absolute bottom-10 left-[-20%] w-[60%] h-[40%] ld-flare-soft" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden ld-stage">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute ld-spark"
            style={{
              left: `${8 + ((i * 11) % 84)}%`,
              top: `${10 + ((i * 13) % 72)}%`,
              animationDelay: `${i * 0.28}s`,
              animationDuration: `${2.8 + (i % 4) * 0.5}s`,
            }}
          >
            <ShibaCoin size={i % 2 === 0 ? 14 : 10} />
          </span>
        ))}
      </div>

      <div className="w-full max-w-xl flex flex-col items-center relative z-10 px-6 ld-stage">
        <div className="flex items-center gap-2 mb-5">
          <span className="ld-kicker">Shiba Inu · SHIB</span>
          <span className="ld-chip">OFFLINE MINE</span>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-[rgba(255,107,26,0.28)] blur-2xl scale-[1.35] ld-glow" />
          <div className="ld-ring" aria-hidden />
          <div className="ld-hero-coin relative">
            <ShibaCoin size={132} />
          </div>
        </div>

        <h1 className="ld-title text-center">
          SHIBA
          <span>MINER</span>
        </h1>
        <p className="ld-tagline">+1 SHIB every 5 minutes · keeps digging while closed</p>

        <div className="ld-card w-80 max-w-full mt-7">
          <div className="flex justify-between items-end mb-2.5 gap-3">
            <div className="min-w-0">
              <p className="ld-meta">Booting</p>
              <p className="text-sm font-bold text-[#f4ebe3] mt-0.5 truncate ld-status">{statusLabel}</p>
            </div>
            <span className="text-2xl font-extrabold text-[#ff6b1a] tabular-nums leading-none shrink-0 tracking-tight">
              {pct}
              <span className="text-sm font-bold text-[#9a8f86]">%</span>
            </span>
          </div>
          <div className="ld-track">
            <div className="ld-fill" style={{ width: `${loadingProgress}%` }} />
          </div>
          {bootError && (
            <p className="mt-3 text-[11px] text-[#ff8f5c] font-semibold leading-relaxed">{bootError}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-7">
          <span className="ld-pill">Auto dig</span>
          <span className="ld-pill-dot" />
          <span className="ld-pill">Telegram</span>
          <span className="ld-pill-dot" />
          <span className="ld-pill">SHIB</span>
        </div>
      </div>

      <LoadingStyles />
    </div>
  );
}

function LoadingStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Syne:wght@600;700;800&display=swap');

      .ld-root {
        --ink: #0c0c0e;
        --paper: #f4ebe3;
        --ember: #ff6b1a;
        --mute: #9a8f86;
        font-family: 'Syne', system-ui, sans-serif;
        background: var(--ink);
        color: var(--paper);
        position: relative;
      }
      .ld-boot .ld-stage {
        opacity: 0;
        transform: translateY(16px) scale(0.98);
      }
      .ld-ready .ld-stage {
        opacity: 1;
        transform: translateY(0) scale(1);
        transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ld-exit .ld-stage {
        opacity: 0;
        transform: translateY(-18px) scale(1.03);
        transition: opacity 0.42s ease, transform 0.42s ease;
      }
      .ld-exit {
        pointer-events: none;
      }
      .ld-bg {
        background:
          radial-gradient(ellipse 80% 50% at 80% -10%, rgba(255, 107, 26, 0.28), transparent 55%),
          radial-gradient(ellipse 70% 45% at 0% 100%, rgba(255, 107, 26, 0.12), transparent 50%),
          linear-gradient(165deg, #141210 0%, #0c0c0e 48%, #16120f 100%);
      }
      .ld-grid {
        opacity: 0.16;
        background-image:
          linear-gradient(rgba(244, 235, 227, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(244, 235, 227, 0.06) 1px, transparent 1px);
        background-size: 28px 28px;
        mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
      }
      .ld-flare {
        background: radial-gradient(circle, rgba(255, 107, 26, 0.32), transparent 68%);
        filter: blur(10px);
        animation: ldDrift 9s ease-in-out infinite alternate;
      }
      .ld-flare-soft {
        background: radial-gradient(circle, rgba(255, 140, 66, 0.14), transparent 70%);
        filter: blur(18px);
        animation: ldDrift 12s ease-in-out infinite alternate-reverse;
      }
      @keyframes ldDrift {
        from {
          transform: translate3d(0, 0, 0) scale(1);
        }
        to {
          transform: translate3d(-12px, 16px, 0) scale(1.06);
        }
      }
      .ld-kicker {
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: var(--ember);
      }
      .ld-chip {
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.14em;
        padding: 4px 9px;
        color: var(--ember);
        border: 1px solid rgba(255, 107, 26, 0.45);
        animation: ldPulseSoft 2s ease-in-out infinite;
      }
      .ld-title {
        font-size: clamp(2.4rem, 11vw, 3rem);
        font-weight: 800;
        letter-spacing: -0.04em;
        line-height: 0.92;
        text-transform: uppercase;
        color: var(--paper);
      }
      .ld-title span {
        display: block;
        color: transparent;
        -webkit-text-stroke: 1.4px rgba(244, 235, 227, 0.85);
      }
      .ld-tagline {
        margin-top: 10px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--mute);
        text-align: center;
        max-width: 17rem;
        line-height: 1.45;
      }
      .ld-sub {
        font-size: 13px;
        font-weight: 600;
        color: var(--mute);
        line-height: 1.45;
      }
      .ld-meta {
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--mute);
      }
      .ld-hero-coin {
        filter: drop-shadow(0 0 22px rgba(255, 107, 26, 0.45));
        animation: ldLogoFloat 2.6s ease-in-out infinite;
      }
      .ld-ring {
        position: absolute;
        inset: -14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 107, 26, 0.28);
        border-top-color: var(--ember);
        animation: ldCoinSpin 1.5s linear infinite;
      }
      .ld-coin-float {
        animation: ldLogoFloat 2.4s ease-in-out infinite;
        filter: drop-shadow(0 0 16px rgba(255, 107, 26, 0.35));
      }
      @keyframes ldCoinSpin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .ld-card {
        padding: 16px 18px;
        border: 1px solid rgba(255, 107, 26, 0.28);
        background: rgba(20, 18, 16, 0.82);
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
      }
      .ld-status {
        animation: ldPulseSoft 1.6s ease-in-out infinite;
      }
      .ld-track {
        height: 8px;
        background: rgba(255, 107, 26, 0.12);
        overflow: hidden;
      }
      .ld-fill {
        height: 100%;
        background: linear-gradient(90deg, #c23400, var(--ember), #ffb347);
        background-size: 220% 100%;
        animation: ldSheen 1.5s linear infinite;
        transition: width 0.28s ease-out;
      }
      .ld-qr-wrap {
        padding: 12px;
        border: 1px solid rgba(255, 107, 26, 0.35);
        background: rgba(244, 235, 227, 0.96);
      }
      .ld-pill {
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--mute);
      }
      .ld-pill-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--ember);
        opacity: 0.75;
      }
      .ld-spark {
        opacity: 0.35;
        animation-name: ldFloat;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        filter: drop-shadow(0 0 8px rgba(255, 107, 26, 0.35));
      }
      @keyframes ldSheen {
        0% {
          background-position: 0% 50%;
        }
        100% {
          background-position: 200% 50%;
        }
      }
      @keyframes ldLogoFloat {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-8px);
        }
      }
      @keyframes ldGlow {
        0%,
        100% {
          opacity: 0.45;
          transform: scale(1.15);
        }
        50% {
          opacity: 0.9;
          transform: scale(1.35);
        }
      }
      @keyframes ldPulseSoft {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.65;
        }
      }
      .ld-glow {
        animation: ldGlow 2.2s ease-in-out infinite;
      }
      @keyframes ldFloat {
        0%,
        100% {
          transform: translateY(0) rotate(0deg);
          opacity: 0.18;
        }
        50% {
          transform: translateY(-16px) rotate(12deg);
          opacity: 0.5;
        }
      }
    `}</style>
  );
}
