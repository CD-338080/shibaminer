'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ShibaCoin from '@/icons/ShibaCoin';
import { formatNumber, triggerHapticFeedback } from '@/utils/ui';
import { useGameStore } from '@/utils/game-mechanics';
import { useToast } from '@/contexts/ToastContext';
import { getRecommendedPlan, MINE_SHOWCASE_KEY } from '@/utils/mining-plans';
import { MINIMUM_WITHDRAW_REFERRALS, MINIMUM_WITHDRAW_SHIB } from '@/utils/consts';

interface WithdrawPopupProps {
  onClose: () => void;
  balance: number;
  minimumWithdraw: number;
  setCurrentView?: (view: string) => void;
}

/** SHIB (ERC-20) Ethereum address */
function isValidShibAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

const WithdrawPopup: React.FC<WithdrawPopupProps> = ({
  onClose,
  balance,
  minimumWithdraw,
  setCurrentView,
}) => {
  const { userTelegramInitData } = useGameStore();
  const showToast = useToast();
  const recommended = useMemo(() => getRecommendedPlan(), []);

  const [referralCount, setReferralCount] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 0 = wallet, 1 = amount, 2 = plan gate (final)
  const [withdrawStep, setWithdrawStep] = useState(0);
  const [userWalletAddress, setUserWalletAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState(balance.toString());

  const MINIMUM_WITHDRAW = minimumWithdraw > 0 ? minimumWithdraw : MINIMUM_WITHDRAW_SHIB;
  const MINIMUM_REFERRAL = MINIMUM_WITHDRAW_REFERRALS;

  const addressTrimmed = userWalletAddress.trim();
  const addressTouched = addressTrimmed.length > 0;
  const addressValid = isValidShibAddress(userWalletAddress);

  const fetchReferralData = useCallback(async () => {
    if (!userTelegramInitData) return;

    try {
      if (!isInitialLoading) setIsRefreshing(true);

      const response = await fetch(
        `/api/user/referrals?initData=${encodeURIComponent(userTelegramInitData)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error('Failed to fetch referrals');

      const data = await response.json();
      setReferralCount(data.referralCount || 0);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      showToast('Error fetching referrals. Please try again later.', 'error');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [userTelegramInitData, showToast, isInitialLoading]);

  useEffect(() => {
    fetchReferralData();
    const interval = setInterval(fetchReferralData, 45000);
    return () => clearInterval(interval);
  }, [fetchReferralData]);

  const hasMetRequirements = referralCount >= MINIMUM_REFERRAL && balance >= MINIMUM_WITHDRAW;

  const handleClose = useCallback(() => {
    triggerHapticFeedback(window);
    onClose();
  }, [onClose]);

  const nextStep = () => {
    triggerHapticFeedback(window);
    setWithdrawStep((prev) => prev + 1);
  };

  const prevStep = () => {
    triggerHapticFeedback(window);
    setWithdrawStep((prev) => Math.max(0, prev - 1));
  };

  const goToFriends = () => {
    triggerHapticFeedback(window, 'heavy');
    onClose();
    if (typeof setCurrentView === 'function') {
      setCurrentView('friends');
    } else {
      showToast('Open the Friends tab to invite miners.', 'success');
    }
  };

  const goToMiningPlans = (planId?: string) => {
    triggerHapticFeedback(window, 'heavy');
    try {
      sessionStorage.setItem(MINE_SHOWCASE_KEY, '1');
      if (planId) sessionStorage.setItem('doge_mine_focus_plan', planId);
    } catch {
      /* ignore */
    }
    onClose();
    if (typeof setCurrentView === 'function') {
      setCurrentView('mine');
    } else {
      showToast('Open the Purchase tab to view mining plans.', 'success');
    }
  };

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 bg-[#2b1d0e]/45 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="wd-load">
          <ShibaCoin size={48} className="wd-spin" />
        </div>
      </div>
    );
  }

  const StepHeader = ({ title, step }: { title: string; step: string }) => (
    <div className="w-full mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#0284c7]">
          Shiba Miner cashout
        </span>
        <span className="wd-chip">SHIB</span>
      </div>
      <h3 className="text-2xl font-bold text-[#2b1d0e] tracking-tight">{title}</h3>
      <p className="text-xs text-[#c47a0a] font-bold uppercase tracking-[0.18em] mt-1">{step}</p>
    </div>
  );

  const renderPlanGate = () => (
    <div className="flex flex-col">
      <StepHeader title="Account status" step="Step 3 of 3" />

      <div className="wd-free-banner mb-4">
        <div className="wd-free-icon" aria-hidden>
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#b45309] font-bold mb-2 text-center">
          Free account detected
        </p>
        <h4 className="text-xl font-bold text-[#2b1d0e] text-center leading-tight mb-2">
          Please buy a mining plan
        </h4>
        <p className="text-sm text-[#6b5424] font-medium text-center leading-relaxed">
          Cashouts require an active cloud mining contract. Upgrade your account to unlock fee-free
          withdrawals and higher hashrate.
        </p>
      </div>

      <div className="wd-card mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#8b6914] font-medium">Account type</span>
          <span className="text-[#b45309] font-bold">Free</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#8b6914] font-medium">Mining plan</span>
          <span className="text-[#2b1d0e] font-bold">None</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8b6914] font-medium">Withdraw status</span>
          <span className="text-[#0284c7] font-bold">Locked</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => goToMiningPlans(recommended.id)}
        className="wd-btn-pro"
      >
        Activate {recommended.name} · Best for you
      </button>
      <button type="button" onClick={() => goToMiningPlans()} className="wd-btn mt-2">
        View all mining plans
      </button>
      <button type="button" onClick={prevStep} className="wd-link-btn mt-3">
        ← Back
      </button>
      <button type="button" onClick={handleClose} className="wd-link-btn mt-1">
        Maybe later
      </button>
    </div>
  );

  const renderWalletAddressStep = () => (
    <div className="flex flex-col">
      <StepHeader title="Destination wallet" step="Step 1 of 3" />
      <div className="wd-card mb-5">
        <p className="text-sm text-[#9a8f86] font-medium mb-3">
          Enter the Ethereum wallet that will receive your SHIB (ERC-20).
        </p>
        <div className="wd-input">
          <input
            type="text"
            className="flex-1 min-w-0 bg-transparent text-[#f4ebe3] outline-none font-mono text-sm placeholder:text-[#9a8f86]"
            placeholder="0x..."
            value={userWalletAddress}
            onChange={(e) => setUserWalletAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {addressTouched && (
          <p
            className={`mt-2 text-xs font-bold ${
              addressValid ? 'text-[#7dffb3]' : 'text-[#fb7185]'
            }`}
          >
            {addressValid ? 'Valid SHIB (ERC-20) address' : 'Invalid Ethereum address'}
          </p>
        )}
        <p className="mt-2 text-[11px] text-[#9a8f86] font-medium leading-relaxed">
          Ethereum network only. Payouts usually arrive within 24–48h after approval.
        </p>
      </div>
      <button
        type="button"
        onClick={nextStep}
        disabled={!addressValid}
        className={addressValid ? 'wd-btn' : 'wd-btn-off'}
      >
        Continue
      </button>
    </div>
  );

  const renderAmountStep = () => (
    <div className="flex flex-col">
      <StepHeader title="Amount" step="Step 2 of 3" />
      <div className="wd-card mb-4">
        <div className="wd-input mb-2">
          <input
            type="number"
            className="flex-1 min-w-0 bg-transparent text-[#2b1d0e] outline-none text-2xl font-bold tabular-nums placeholder:text-[#a89060]"
            placeholder="0"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            min={MINIMUM_WITHDRAW}
            max={balance}
          />
          <span className="text-[#c47a0a] font-bold shrink-0 flex items-center gap-1">
            <ShibaCoin size={18} /> SHIB
          </span>
        </div>
        <div className="flex justify-between text-xs text-[#8b6914] font-medium">
          <span>Min {formatNumber(MINIMUM_WITHDRAW)}</span>
          <span>Max {formatNumber(balance)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setWithdrawAmount(MINIMUM_WITHDRAW.toString())}
            className="wd-mini"
          >
            Min
          </button>
          <button
            type="button"
            onClick={() => setWithdrawAmount(Math.floor(balance * 0.5).toString())}
            className="wd-mini"
          >
            Half
          </button>
          <button
            type="button"
            onClick={() => setWithdrawAmount(balance.toString())}
            className="wd-mini wd-mini-on"
          >
            Max
          </button>
        </div>
      </div>
      <div className="wd-card mb-4">
        <p className="text-xs text-[#8b6914] font-medium mb-1">Payout timing</p>
        <p className="text-sm text-[#0284c7] font-bold">Usually within 24–48h</p>
        <p className="text-[11px] text-[#6b5424] font-medium mt-1 leading-relaxed">
          After your mining plan is active, approved cashouts land as SHIB on Ethereum.
        </p>
      </div>
      <button
        type="button"
        onClick={nextStep}
        disabled={
          !withdrawAmount ||
          Number(withdrawAmount) < MINIMUM_WITHDRAW ||
          Number(withdrawAmount) > balance
        }
        className={
          withdrawAmount &&
          Number(withdrawAmount) >= MINIMUM_WITHDRAW &&
          Number(withdrawAmount) <= balance
            ? 'wd-btn'
            : 'wd-btn-off'
        }
      >
        Continue
      </button>
      <button type="button" onClick={prevStep} className="wd-link-btn mt-3">
        ← Back
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1d0e]/40 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto no-scrollbar rounded-[28px] border-2 border-[#c47a0a]/25 bg-gradient-to-b from-[#dff3ff] via-[#f7ecd4] to-[#f0d9a0] p-5 shadow-[0_20px_50px_rgba(139,105,20,0.25)]"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
      >
        <div className="pointer-events-none absolute -top-16 right-0 w-48 h-48 rounded-full bg-[#f0b429]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-10 w-40 h-40 rounded-full bg-[#7dd3fc]/30 blur-3xl" />

        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-white/80 border border-[#c47a0a]/25 text-[#8b6914] hover:text-[#2b1d0e] text-2xl flex items-center justify-center"
        >
          &times;
        </button>

        {isRefreshing && (
          <div className="absolute top-5 left-5 z-10">
            <div className="w-4 h-4 rounded-full border-2 border-[#f0b429] border-t-transparent animate-spin" />
          </div>
        )}

        <div className="relative z-[1]">
          {!hasMetRequirements ? (
            <div className="flex flex-col">
              <StepHeader title="Requirements" step="Not unlocked yet" />

              <div className="wd-card mb-3">
                <div className="flex justify-between mb-2">
                  <span className="text-[#6b5424] text-sm font-medium">Balance</span>
                  <span className="text-[#c47a0a] font-bold flex items-center gap-1">
                    <ShibaCoin size={14} /> {formatNumber(MINIMUM_WITHDRAW)} SHIB
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#c47a0a]/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] to-[#f0b429]"
                    style={{ width: `${Math.min((balance / MINIMUM_WITHDRAW) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[#8b6914] mt-2 font-medium">
                  Current: {formatNumber(balance)} SHIB
                  {balance < MINIMUM_WITHDRAW
                    ? ` · need ${formatNumber(MINIMUM_WITHDRAW - balance)} more`
                    : ''}
                </p>
              </div>

              <div className="wd-card mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-[#6b5424] text-sm font-medium">Referrals</span>
                  <span className="text-[#0284c7] font-bold">{MINIMUM_REFERRAL}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#c47a0a]/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] to-[#f0b429]"
                    style={{
                      width: `${Math.min((referralCount / MINIMUM_REFERRAL) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-[#8b6914] mt-2 font-medium">
                  Current: {referralCount}/{MINIMUM_REFERRAL}
                  {referralCount < MINIMUM_REFERRAL
                    ? ` · need ${MINIMUM_REFERRAL - referralCount} more`
                    : ''}
                </p>
              </div>

              <button type="button" onClick={goToFriends} className="wd-btn">
                Invite friends
              </button>
              <button type="button" onClick={handleClose} className="wd-link-btn mt-3">
                OK
              </button>
            </div>
          ) : (
            <>
              {withdrawStep === 0 && renderWalletAddressStep()}
              {withdrawStep === 1 && renderAmountStep()}
              {withdrawStep === 2 && renderPlanGate()}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');

        .wd-load {
          font-family: 'Fredoka', system-ui, sans-serif;
        }
        .wd-spin {
          animation: wdSpin 2.8s linear infinite;
          filter: drop-shadow(0 8px 16px rgba(139, 105, 20, 0.3));
        }
        @keyframes wdSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .wd-chip {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 3px 8px;
          border-radius: 999px;
          color: #92400e;
          background: rgba(240, 180, 41, 0.28);
          border: 1.5px solid rgba(196, 122, 10, 0.35);
        }
        .wd-card {
          width: 100%;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255, 252, 240, 0.88);
          border: 2px solid rgba(196, 122, 10, 0.2);
          box-shadow: 0 8px 20px rgba(139, 105, 20, 0.08);
        }
        .wd-free-banner {
          padding: 18px 16px;
          border-radius: 20px;
          background: linear-gradient(160deg, rgba(254, 243, 199, 0.95), rgba(255, 237, 213, 0.9));
          border: 2px solid rgba(245, 158, 11, 0.45);
          box-shadow: 0 12px 28px rgba(180, 83, 9, 0.12);
        }
        .wd-free-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 12px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #b45309;
          background: rgba(255, 255, 255, 0.75);
          border: 1.5px solid rgba(245, 158, 11, 0.4);
        }
        .wd-input {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.75);
          border: 1.5px solid rgba(196, 122, 10, 0.22);
        }
        .wd-btn {
          width: 100%;
          padding: 14px 16px;
          border-radius: 16px;
          font-family: 'Fredoka', system-ui, sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 13px;
          color: #2b1d0e;
          background: linear-gradient(135deg, #ffe566, #f0b429 45%, #38bdf8);
          box-shadow: 0 10px 24px rgba(240, 180, 41, 0.32);
        }
        .wd-btn:active {
          transform: scale(0.98);
        }
        .wd-btn-pro {
          width: 100%;
          padding: 14px 16px;
          border-radius: 16px;
          font-family: 'Fredoka', system-ui, sans-serif;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 12px;
          color: #2b1d0e;
          background: linear-gradient(135deg, #ffe566 0%, #f0b429 50%, #38bdf8 100%);
          box-shadow:
            0 0 0 1px rgba(240, 180, 41, 0.35),
            0 12px 28px rgba(196, 122, 10, 0.28);
        }
        .wd-btn-pro:active {
          transform: scale(0.98);
        }
        .wd-btn-off {
          width: 100%;
          padding: 14px 16px;
          border-radius: 16px;
          font-family: 'Fredoka', system-ui, sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 13px;
          color: #a8a29e;
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid rgba(168, 162, 158, 0.45);
          cursor: not-allowed;
        }
        .wd-link-btn {
          width: 100%;
          padding: 10px;
          font-family: 'Fredoka', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #8b6914;
          background: transparent;
        }
        .wd-mini {
          padding: 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #5c3d06;
          background: rgba(255, 255, 255, 0.7);
          border: 1.5px solid rgba(196, 122, 10, 0.18);
        }
        .wd-mini-on {
          color: #2b1d0e;
          background: linear-gradient(135deg, #f0b429, #38bdf8);
          border: none;
        }
      `}</style>
    </div>
  );
};

export default WithdrawPopup;
