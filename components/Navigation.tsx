'use client'

import { triggerHapticFeedback } from '@/utils/ui';
import { playSfx } from '@/utils/sfx';

type NavIconProps = { active?: boolean };

const activeStroke = '#ff6b1a';
const activeFill = 'rgba(255,107,26,0.2)';

function MinerIcon({ active }: NavIconProps) {
  const stroke = active ? activeStroke : 'currentColor';
  const fill = active ? activeFill : 'rgba(244,235,227,0.04)';
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="12" fill={fill} stroke={stroke} strokeWidth="2" />
      <path
        d="M16 9.5v13M12.5 13.5c0-1.7 1.6-3 3.5-3s3.5 1.3 3.5 3c0 2.2-2.2 2.8-3.5 3.5-1.3.7-3.5 1.3-3.5 3.5 0 1.7 1.6 3 3.5 3s3.5-1.3 3.5-3"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon({ active }: NavIconProps) {
  const stroke = active ? activeStroke : 'currentColor';
  const fill = active ? activeFill : 'rgba(244,235,227,0.04)';
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="12" fill={fill} stroke={stroke} strokeWidth="2" />
      <path
        d="M9.5 11h1.6l1.1 8.2c.1.7.7 1.2 1.4 1.2h7.6c.7 0 1.2-.5 1.3-1.1l1-5.8H12"
        stroke={stroke}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 11l-.7-2.2H9.5"
        stroke={stroke}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14.2" cy="22.6" r="1.15" fill={stroke} />
      <circle cx="20.6" cy="22.6" r="1.15" fill={stroke} />
    </svg>
  );
}

function FriendsIcon({ active }: NavIconProps) {
  const stroke = active ? activeStroke : 'currentColor';
  const fill = active ? activeFill : 'rgba(244,235,227,0.04)';
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="12" fill={fill} stroke={stroke} strokeWidth="2" />
      <circle cx="16" cy="13" r="3.2" stroke={stroke} strokeWidth="2" />
      <path
        d="M10.5 22c1.2-2.4 3.1-3.5 5.5-3.5s4.3 1.1 5.5 3.5"
        stroke={stroke}
        strokeWidth="2"
      />
      <circle cx="23" cy="12.5" r="2.2" stroke={stroke} strokeWidth="1.7" />
      <circle cx="9" cy="12.5" r="2.2" stroke={stroke} strokeWidth="1.7" />
    </svg>
  );
}

function EarnIcon({ active }: NavIconProps) {
  const stroke = active ? activeStroke : 'currentColor';
  const fill = active ? activeFill : 'rgba(244,235,227,0.04)';
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="12" fill={fill} stroke={stroke} strokeWidth="2" />
      <rect x="11" y="10" width="10" height="13" rx="2" stroke={stroke} strokeWidth="2" />
      <path
        d="M13.5 10V9c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v1"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M14 16h4M14 19.5h4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="13.5" r="1" fill={stroke} />
    </svg>
  );
}

function WithdrawIcon({ active }: NavIconProps) {
  const stroke = active ? activeStroke : 'currentColor';
  const fill = active ? activeFill : 'rgba(244,235,227,0.04)';
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="12" fill={fill} stroke={stroke} strokeWidth="2" />
      <rect x="8.5" y="12" width="15" height="10" rx="2.5" stroke={stroke} strokeWidth="2" />
      <path d="M8.5 15h15" stroke={stroke} strokeWidth="2" />
      <circle cx="20.5" cy="19" r="1.4" fill={stroke} />
      <path
        d="M16 7.5v5M13.5 10L16 12.5 18.5 10"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const navItems = [
  { name: 'Miner', view: 'game', Icon: MinerIcon },
  { name: 'Plans', view: 'mine', Icon: CartIcon },
  { name: 'Pack', view: 'friends', Icon: FriendsIcon },
  { name: 'Earn', view: 'earn', Icon: EarnIcon },
  { name: 'Cash', view: 'airdrop', Icon: WithdrawIcon },
];

interface NavigationProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export default function Navigation({ currentView, setCurrentView }: NavigationProps) {
  const handleViewChange = (view: string) => {
    if (typeof setCurrentView !== 'function') {
      console.error('setCurrentView is not a function:', setCurrentView);
      return;
    }
    if (view === currentView) return;

    try {
      playSfx('nav');
      triggerHapticFeedback(window, 'light');
      setCurrentView(view);
    } catch (error) {
      console.error('Error occurred while changing view:', error);
    }
  };

  if (typeof setCurrentView !== 'function') {
    return null;
  }

  return (
    <nav className="nav-root fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl z-40">
      <div className="nav-bar flex justify-around items-stretch text-[10px] max-h-24">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const { Icon } = item;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => handleViewChange(item.view)}
              className="flex-1"
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`nav-item ${isActive ? 'is-active' : ''}`}>
                <div className="w-7 h-7 relative">
                  <Icon active={isActive} />
                </div>
                <p className="nav-label">{item.name}</p>
              </div>
            </button>
          );
        })}
      </div>

      <style jsx global>{`
        .nav-root {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .nav-bar {
          background: rgba(12, 12, 14, 0.94);
          border-top: 1px solid rgba(255, 107, 26, 0.28);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          height: 4rem;
          margin: 4px;
          padding: 6px 4px;
          color: #9a8f86;
          border: 1px solid transparent;
          transition:
            color 0.15s ease,
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }
        .nav-item.is-active {
          color: #ff6b1a;
          background: rgba(255, 107, 26, 0.12);
          border-color: rgba(255, 107, 26, 0.4);
          box-shadow: 0 0 18px rgba(255, 107, 26, 0.16);
        }
        .nav-label {
          margin: 0;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .nav-item.is-active .nav-label {
          color: #ff6b1a;
        }
      `}</style>
    </nav>
  );
}
