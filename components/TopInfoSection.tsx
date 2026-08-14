'use client'

import Settings from '@/icons/Settings';
import ShibaCoin from '@/icons/ShibaCoin';
import { LEVELS } from '@/utils/consts';
import { useGameStore } from '@/utils/game-mechanics';
import { formatNumber, triggerHapticFeedback } from '@/utils/ui';
import { AUTO_MINE_INTERVAL_MS, AUTO_MINE_REWARD } from '@/utils/auto-mine';
import Image from 'next/image';

interface TopInfoSectionProps {
  isGamePage?: boolean;
  setCurrentView: (view: string) => void;
}

const AUTO_MINE_PER_HOUR =
  Math.round((60 * 60 * 1000) / AUTO_MINE_INTERVAL_MS) * AUTO_MINE_REWARD;

export default function TopInfoSection({ isGamePage = false, setCurrentView }: TopInfoSectionProps) {
  const { userTelegramName, gameLevelIndex, profitPerHour } = useGameStore();

  const handleSettingsClick = () => {
    triggerHapticFeedback(window);
    setCurrentView('settings');
  };

  const ratePerHour = isGamePage ? AUTO_MINE_PER_HOUR : profitPerHour;
  const nameColor = isGamePage ? 'text-[#f4ebe3]' : 'text-white';
  const subColor = isGamePage ? 'text-[#9a8f86]' : 'text-slate-400';
  const chipBg = isGamePage
    ? 'bg-[#0c0c0e]/70 border-[rgba(255,107,26,0.35)]'
    : 'bg-slate-900/70 border-white/[0.08]';
  const labelColor = isGamePage ? 'text-[#9a8f86]' : 'text-slate-500';
  const liveDot = isGamePage
    ? 'bg-[#ff6b1a] shadow-[0_0_8px_rgba(255,107,26,0.7)]'
    : 'bg-[#14b8a6] shadow-[0_0_8px_rgba(20,184,166,0.8)]';
  const settingsBtn = isGamePage
    ? 'bg-[#0c0c0e]/70 border-[rgba(255,107,26,0.35)] text-[#9a8f86] hover:text-[#ff6b1a] hover:border-[#ff6b1a]/60'
    : 'bg-slate-900/70 border-white/[0.08] text-slate-300 hover:text-[#14b8a6] hover:border-[#14b8a6]/40';
  const levelBadge = isGamePage ? 'bg-[#ff6b1a] text-[#0c0c0e]' : 'bg-[#14b8a6] text-[#042f2e]';
  const avatarBorder = isGamePage
    ? 'border-[rgba(255,107,26,0.4)] bg-[#141210]'
    : 'border-white/10 bg-slate-900/80';
  const rateColor = isGamePage ? 'text-[#ff6b1a]' : 'text-[#c47a0a]';

  return (
    <div className="px-4 z-10 pt-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div
              className={`w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center ${avatarBorder}`}
            >
              {isGamePage ? (
                <ShibaCoin size={36} />
              ) : (
                <Image
                  src={LEVELS[gameLevelIndex].smallImage}
                  width={28}
                  height={28}
                  alt="Level"
                  className="object-contain"
                />
              )}
            </div>
            <span
              className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none ${levelBadge}`}
            >
              {gameLevelIndex + 1}
            </span>
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate leading-tight ${nameColor}`}>
              {userTelegramName || 'Player'}
            </p>
            <p className={`text-[10px] font-medium truncate mt-0.5 tracking-wide ${subColor}`}>
              {LEVELS[gameLevelIndex].name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm ${chipBg}`}>
            {isGamePage && (
              <div
                className={`flex flex-col items-center pr-2 border-r ${
                  isGamePage ? 'border-[rgba(255,107,26,0.25)]' : 'border-white/10'
                }`}
              >
                <span className={`text-[9px] uppercase tracking-[0.16em] font-bold ${labelColor}`}>
                  Live
                </span>
                <span className={`mt-1 w-1.5 h-1.5 rounded-full ${liveDot}`} />
              </div>
            )}
            <div className="flex flex-col items-end">
              <span
                className={`text-[9px] uppercase tracking-[0.14em] font-bold whitespace-nowrap ${labelColor}`}
              >
                SHIB / hr
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <ShibaCoin size={16} />
                <span className={`text-sm font-black tabular-nums leading-none ${rateColor}`}>
                  +{formatNumber(ratePerHour)}
                </span>
              </div>
            </div>
          </div>

          {isGamePage && (
            <button
              type="button"
              onClick={handleSettingsClick}
              aria-label="Settings"
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors active:scale-95 ${settingsBtn}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
