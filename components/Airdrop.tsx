'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useGameStore } from '@/utils/game-mechanics';
import { useToast } from '@/contexts/ToastContext';
import { triggerHapticFeedback, formatNumber } from '@/utils/ui';
import WithdrawPopup from '@/components/popups/WithdrawPopup';
import TopInfoSection from '@/components/TopInfoSection';
import ShibaCoin from '@/icons/ShibaCoin';
import {
  SHIBARIUM_EXPLORER,
  SHIBARIUM_TREASURY,
  shibariumAddressUrl,
  shibariumTxUrl,
  truncateTxHash,
} from '@/utils/shib-explorer';
import { MINIMUM_WITHDRAW_SHIB } from '@/utils/consts';

function ShibaToken({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 56 : size === 'sm' ? 32 : 48;
  return (
    <div className="shrink-0 flex items-center justify-center rounded-full overflow-hidden">
      <ShibaCoin size={px} />
    </div>
  );
}

interface AirdropProps {
  setCurrentView?: (view: string) => void;
}

type PayoutTx = {
  txid: string;
  timestamp: number;
  amount: string;
  address: string;
  type: string;
  status: string;
  confirmations?: number;
  explorerUrl?: string;
};

const MINIMUM_WITHDRAW = MINIMUM_WITHDRAW_SHIB;
const MINER_WALLET_URL = SHIBARIUM_TREASURY
  ? shibariumAddressUrl(SHIBARIUM_TREASURY)
  : SHIBARIUM_EXPLORER;

function PayoutCard({
  tx,
  formatPayoutTime,
}: {
  tx: PayoutTx;
  formatPayoutTime: (ts: number) => string;
}) {
  const href = tx.explorerUrl || shibariumTxUrl(tx.txid);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="air-payout-card"
      title="Verify on Shibarium"
    >
      <ShibaToken size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[#f4ebe3] tabular-nums leading-tight tracking-tight">
          {tx.amount} <span className="text-[#ff6b1a] font-bold text-xs">SHIB</span>
        </p>
        <p className="text-[10px] text-[#9a8f86] uppercase tracking-[0.14em] font-semibold mt-0.5">
          {formatPayoutTime(tx.timestamp)}
          {tx.status ? ` · ${tx.status}` : ''}
        </p>
        <p className="text-[9px] text-[#ff6b1a] font-mono truncate mt-0.5" title={tx.txid}>
          {truncateTxHash(tx.txid)} · Shibarium ↗
        </p>
      </div>
    </a>
  );
}

export default function Airdrop({ setCurrentView }: AirdropProps = {}) {
  const [tonConnectUI] = useTonConnectUI();
  const { tonWalletAddress, setTonWalletAddress, userTelegramInitData, pointsBalance } =
    useGameStore();

  const currentTelegramId = (() => {
    try {
      if (!userTelegramInitData) return null;
      const params = new URLSearchParams(userTelegramInitData);
      const userRaw = params.get('user');
      if (!userRaw) return null;
      const user = JSON.parse(userRaw) as { id?: number | string };
      return user.id != null ? String(user.id) : null;
    } catch {
      return null;
    }
  })();
  const [copied, setCopied] = useState(false);
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const showToast = useToast();
  const [transactions, setTransactions] = useState<PayoutTx[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [showWithdrawPopup, setShowWithdrawPopup] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [appUsers, setAppUsers] = useState<
    {
      id: string;
      rank: number;
      name: string;
      telegramId: string | null;
      isPremium: boolean;
      points: number;
      pointsBalance: number;
    }[]
  >([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const hasLoadedUsersRef = useRef(false);
  const hasLoadedTxRef = useRef(false);

  const transactionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shouldScroll = localStorage.getItem('scrollToTransactions') === 'true';
    if (shouldScroll && transactionsRef.current) {
      setTimeout(() => {
        transactionsRef.current?.scrollIntoView({ behavior: 'smooth' });
        localStorage.removeItem('scrollToTransactions');
      }, 500);
    }
  }, []);

  const saveWalletAddress = useCallback(
    async (address: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/wallet/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: userTelegramInitData,
            walletAddress: address,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save wallet address');
        }

        const data = await response.json();
        setTonWalletAddress(data.walletAddress);
        return true;
      } catch (error) {
        console.error('Error saving wallet address:', error);
        return false;
      }
    },
    [userTelegramInitData, setTonWalletAddress]
  );

  const disconnectWallet = useCallback(async () => {
    try {
      const response = await fetch('/api/wallet/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: userTelegramInitData }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect wallet');
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      throw error;
    }
  }, [userTelegramInitData]);

  const handleWalletConnection = useCallback(
    async (address: string) => {
      setIsProcessingWallet(true);
      try {
        const success = await saveWalletAddress(address);
        if (!success) {
          if (tonConnectUI.account?.address) {
            await tonConnectUI.disconnect();
          }
          showToast('Failed to save wallet address. Please try connecting again.', 'error');
        } else {
          showToast('Wallet connected successfully!', 'success');
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
        showToast('An error occurred while connecting the wallet.', 'error');
      } finally {
        setIsProcessingWallet(false);
        setIsConnecting(false);
      }
    },
    [tonConnectUI, showToast, saveWalletAddress]
  );

  const handleWalletDisconnection = useCallback(async () => {
    setIsProcessingWallet(true);
    try {
      await disconnectWallet();
      setTonWalletAddress(null);
      showToast('Wallet disconnected successfully!', 'success');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      showToast('An error occurred while disconnecting the wallet.', 'error');
    } finally {
      setIsProcessingWallet(false);
    }
  }, [setTonWalletAddress, showToast, disconnectWallet]);

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange(async (wallet) => {
      if (wallet && isConnecting) {
        await handleWalletConnection(wallet.account.address);
      } else if (!wallet && !isConnecting) {
        await handleWalletDisconnection();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [tonConnectUI, handleWalletConnection, handleWalletDisconnection, isConnecting]);

  const copyToClipboard = () => {
    if (tonWalletAddress) {
      triggerHapticFeedback(window);
      navigator.clipboard.writeText(tonWalletAddress);
      setCopied(true);
      showToast('Address copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchTransactions = useCallback(async () => {
    try {
      if (!hasLoadedTxRef.current) {
        setIsLoadingTransactions(true);
      }
      const res = await fetch(`/api/doge-payouts?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch Shiba Inu transactions');
      }
      const data = await res.json();
      const list = Array.isArray(data.transactions) ? data.transactions : [];
      const processed: PayoutTx[] = list
        .filter((tx: PayoutTx) => Boolean(tx?.txid))
        .map((tx: PayoutTx) => {
          const txid = String(tx.txid);
          return {
            txid,
            timestamp: Number(tx.timestamp) || Date.now(),
            amount: String(tx.amount ?? '0'),
            address: String(tx.address ?? ''),
            type: tx.type || 'Withdrawal',
            status: tx.status || 'Confirmed',
            confirmations: tx.confirmations,
            explorerUrl: tx.explorerUrl || shibariumTxUrl(txid),
          };
        })
        .sort((a: PayoutTx, b: PayoutTx) => b.timestamp - a.timestamp);

      setTransactions(processed);
      hasLoadedTxRef.current = true;
    } catch (e) {
      console.error('Error fetching SHIB transactions:', e);
      // Keep UI quiet — empty feed is fine without a toast spam
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    const visualId = setInterval(fetchTransactions, 90000);
    // Backup tick for paced channel posts (server gate enforces 10→8→4→1 min)
    const announceOnce = () => {
      void fetch(`/api/doge-payouts?announce=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      }).catch(() => undefined);
      void fetch(`/api/qa-announce?announce=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      }).catch(() => undefined);
    };
    const announceDelay = window.setTimeout(announceOnce, 2500);
    const announceId = window.setInterval(announceOnce, 60 * 1000);
    return () => {
      clearInterval(visualId);
      window.clearTimeout(announceDelay);
      window.clearInterval(announceId);
    };
  }, [fetchTransactions]);

  const fetchUsers = useCallback(async () => {
    try {
      if (!hasLoadedUsersRef.current) {
        setIsLoadingUsers(true);
      }
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/users?t=${Date.now()}`
          : `/api/users?t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data.users) ? data.users : [];
      setTotalUsers(typeof data.total === 'number' ? data.total : list.length);
      setAppUsers(list);
      hasLoadedUsersRef.current = true;
    } catch (e) {
      console.error('Error fetching users:', e);
      if (!hasLoadedUsersRef.current) {
        setTotalUsers(0);
        setAppUsers([]);
        showToast('Could not load users. Try again later.', 'error');
      }
    } finally {
      setIsLoadingUsers(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
    const intervalId = setInterval(fetchUsers, 90000);
    return () => clearInterval(intervalId);
  }, [fetchUsers]);

  const formatPayoutTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = Math.floor((now - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleWithdrawClick = () => {
    triggerHapticFeedback(window);
    setShowWithdrawPopup(true);
  };

  const canWithdraw = pointsBalance >= MINIMUM_WITHDRAW;
  const shibNeeded = Math.max(0, MINIMUM_WITHDRAW - pointsBalance);
  const progressPct = Math.min(100, (pointsBalance / Math.max(MINIMUM_WITHDRAW, 1)) * 100);
  const half = Math.ceil(transactions.length / 2);
  const row1 = transactions.slice(0, half);
  const row2 = transactions.slice(half);
  const row2List = row2.length ? [...row2, ...row2] : [...transactions, ...transactions];
  const latestPayout = transactions[0] || null;
  const myRankEntry = appUsers.find(
    (u) => !!currentTelegramId && u.telegramId === currentTelegramId
  );
  const myRank = myRankEntry?.rank ?? null;

  const handleShareRank = useCallback(async () => {
    triggerHapticFeedback(window);
    const rankLabel = myRank != null ? `#${myRank}` : 'the leaderboard';
    const text = `I'm ${rankLabel} on Shiba Miner 🐶`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Shiba Miner',
          text,
        });
        showToast('Rank shared!', 'success');
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast('Rank copied — paste anywhere!', 'success');
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Rank copied — paste anywhere!', 'success');
      } catch {
        showToast('Could not share rank.', 'error');
      }
    }
  }, [myRank, showToast]);

  return (
    <div className="air-root flex justify-center min-h-screen">
      <div className="w-full max-w-xl h-[100dvh] max-h-[100dvh] flex flex-col text-[#f4ebe3] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 air-bg" />
        <div className="pointer-events-none absolute inset-0 air-grid" />

        <div className="relative z-10 shrink-0">
          {setCurrentView && <TopInfoSection isGamePage={true} setCurrentView={setCurrentView} />}
        </div>

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-28 px-4 air-scroll">
          {/* Hero */}
          <div className="mt-3 air-hero">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#ff6b1a] font-bold">
                    Shiba Miner · Cash
                  </p>
                  <span className="air-chip-gold">SHIB</span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#f4ebe3] leading-none uppercase">
                  Withdraw
                </h1>
                <p className="text-xs text-[#9a8f86] font-medium mt-2 max-w-[240px] leading-relaxed">
                  Live SHIB payouts on Shibarium. Tap any row to verify the tx on-chain.
                </p>
              </div>
              <div className="air-token-glow">
                <ShibaToken size="lg" />
              </div>
            </div>
          </div>

          {/* Live payouts */}
          <section ref={transactionsRef} className="mt-4 air-panel">
            <div className="air-panel-head">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#ff6b1a] font-bold">
                Live SHIB payouts
              </p>
              <a
                href={MINER_WALLET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="air-verify-badge"
              >
                <span className="air-live-dot" />
                Shibarium scan ↗
              </a>
            </div>

            {!isLoadingTransactions && latestPayout && (
              <div className="air-last-payout">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a8f86] font-bold">
                      Last cashout
                    </p>
                    <p className="text-xl font-extrabold text-[#f4ebe3] tabular-nums leading-none mt-1 tracking-tight">
                      {latestPayout.amount}{' '}
                      <span className="text-sm text-[#ff6b1a]">SHIB</span>
                    </p>
                    <p className="text-[11px] text-[#9a8f86] font-medium mt-1">
                      {formatPayoutTime(latestPayout.timestamp)}
                      {latestPayout.status ? ` · ${latestPayout.status}` : ''}
                    </p>
                  </div>
                  <a
                    href={
                      latestPayout.explorerUrl || shibariumTxUrl(latestPayout.txid)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="air-verify-badge shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Verify ↗
                  </a>
                </div>
              </div>
            )}

            <div className="p-3 space-y-3">
              {isLoadingTransactions ? (
                <>
                  <div className="flex gap-3 overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 w-[200px] flex-shrink-0 rounded-xl bg-[rgba(255,107,26,0.1)] animate-pulse" />
                    ))}
                  </div>
                  <div className="flex gap-3 overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={`b-${i}`}
                        className="h-16 w-[200px] flex-shrink-0 rounded-xl bg-[rgba(255,107,26,0.1)] animate-pulse"
                      />
                    ))}
                  </div>
                </>
              ) : transactions.length === 0 ? (
                <div className="text-center py-6 px-2">
                  <p className="text-[#9a8f86] text-xs font-medium mb-3">
                    Waiting for next on-chain payout…
                  </p>
                  <a
                    href={MINER_WALLET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="air-verify-badge inline-flex"
                  >
                    Open Shibarium explorer ↗
                  </a>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden">
                    <div className="flex gap-3 px-1 air-marquee-1">
                      {[...row1, ...row1].map((tx, idx) => (
                        <PayoutCard
                          key={`r1-${tx.txid}-${idx}`}
                          tx={tx}
                          formatPayoutTime={formatPayoutTime}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex gap-3 px-1 air-marquee-2">
                      {row2List.map((tx, idx) => (
                        <PayoutCard
                          key={`r2-${tx.txid}-${idx}`}
                          tx={tx}
                          formatPayoutTime={formatPayoutTime}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Balance + CTA */}
          <div className="mt-4 air-balance">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#9a8f86] font-bold">
                  SHIB balance
                </p>
                <p
                  className="text-3xl font-extrabold tabular-nums text-[#f4ebe3] leading-none mt-1 tracking-tight"
                  suppressHydrationWarning
                >
                  {formatNumber(pointsBalance)}
                  <span className="ml-2 text-sm font-bold text-[#ff6b1a]">SHIB</span>
                </p>
              </div>
              <div className="air-vault-badge">Vault</div>
            </div>

            <div className="air-progress-track mb-1">
              <div className="air-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] text-[#9a8f86] font-medium mb-4">
              {canWithdraw ? (
                <>Ready to withdraw · min {formatNumber(MINIMUM_WITHDRAW)} SHIB</>
              ) : (
                <>
                  Min {formatNumber(MINIMUM_WITHDRAW)} SHIB · need{' '}
                  <span className="text-[#ff6b1a] font-bold tabular-nums">
                    {formatNumber(shibNeeded)}
                  </span>{' '}
                  more
                </>
              )}
            </p>

            {tonWalletAddress && (
              <button
                type="button"
                onClick={copyToClipboard}
                className="mb-4 w-full flex items-center justify-between gap-2 border border-[rgba(255,107,26,0.35)] bg-[rgba(255,107,26,0.06)] px-3 py-2.5 text-xs font-mono text-[#9a8f86] hover:text-[#f4ebe3] transition-colors"
              >
                <span className="truncate">{tonWalletAddress.slice(0, 10)}…{tonWalletAddress.slice(-6)}</span>
                <span className="text-[10px] uppercase tracking-wider shrink-0 text-[#ff6b1a] font-bold">
                  {copied ? 'Copied' : 'Copy'}
                </span>
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleWithdrawClick}
                disabled={!canWithdraw}
                className={canWithdraw ? 'air-btn flex-1' : 'air-btn-off flex-1'}
              >
                {isProcessingWallet ? 'Wait…' : 'Withdraw SHIB'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback(window);
                  fetchTransactions();
                }}
                className="air-btn-ghost"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          <section className="mt-4 air-panel mb-2">
            <div className="air-panel-head">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#ff6b1a] font-bold">
                Leaderboard
              </p>
              <div className="flex items-center gap-2">
                {!isLoadingUsers && (
                  <span className="text-[10px] uppercase tracking-wider text-[#9a8f86] font-semibold">
                    {formatNumber(totalUsers)} miners
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleShareRank}
                  className="air-share-rank"
                  disabled={isLoadingUsers}
                >
                  {myRank != null ? `Share #${myRank}` : 'Share rank'}
                </button>
              </div>
            </div>
            <div className="p-3">
              {isLoadingUsers ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-xl bg-[rgba(255,107,26,0.1)] animate-pulse"
                    />
                  ))}
                </div>
              ) : appUsers.length === 0 ? (
                <p className="text-[#9a8f86] text-xs text-center py-4 font-medium">No miners yet</p>
              ) : (
                <ul className="space-y-1.5 max-h-[28rem] overflow-y-auto no-scrollbar">
                  {appUsers.map((u) => {
                    const isCurrentUser =
                      !!currentTelegramId && u.telegramId === currentTelegramId;
                    const isTop3 = u.rank <= 3;
                    const displayBalance = isCurrentUser
                      ? pointsBalance
                      : Number(u.pointsBalance) || 0;
                    return (
                      <li
                        key={u.id}
                        className={`air-rank-row ${
                          isCurrentUser ? 'air-rank-you' : isTop3 ? 'air-rank-top' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`air-rank-badge ${
                              u.rank === 1
                                ? 'air-rank-1'
                                : u.rank === 2
                                  ? 'air-rank-2'
                                  : u.rank === 3
                                    ? 'air-rank-3'
                                    : ''
                            }`}
                          >
                            {u.rank}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[#f4ebe3] font-bold truncate flex items-center gap-1.5 text-sm">
                              {u.name}
                              {isCurrentUser && <span className="air-you-tag">You</span>}
                              {u.isPremium && (
                                <span className="text-[#ff6b1a] text-[10px] font-black">PRO</span>
                              )}
                            </p>
                            {u.telegramId && (
                              <p className="text-[#9a8f86] text-[10px] font-mono truncate">
                                ID ···{u.telegramId.slice(-4)}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className="text-[#ff6b1a] font-bold tabular-nums shrink-0 text-sm"
                          title={`${displayBalance} SHIB`}
                        >
                          {Math.floor(displayBalance).toLocaleString('en-US')}{' '}
                          <span className="text-[10px] font-bold text-[#9a8f86]">SHIB</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!isLoadingUsers && appUsers.length > 0 && (
                <p className="text-[10px] text-[#9a8f86] text-center mt-2 font-medium">
                  {totalUsers > appUsers.length
                    ? `Showing ${appUsers.length} of ${totalUsers.toLocaleString('en-US')}`
                    : `${appUsers.length.toLocaleString('en-US')} miners · live SHIB balances`}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {showWithdrawPopup && (
        <WithdrawPopup
          onClose={() => setShowWithdrawPopup(false)}
          balance={pointsBalance}
          minimumWithdraw={MINIMUM_WITHDRAW}
          setCurrentView={setCurrentView}
        />
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Syne:wght@600;700;800&display=swap');

        .air-root {
          --ink: #0c0c0e;
          --paper: #f4ebe3;
          --ember: #ff6b1a;
          --mute: #9a8f86;
          font-family: 'Syne', system-ui, sans-serif;
          background: var(--ink);
          color: var(--paper);
        }
        .air-bg {
          background:
            radial-gradient(ellipse 80% 50% at 80% -10%, rgba(255, 107, 26, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 45% at 0% 100%, rgba(255, 107, 26, 0.12), transparent 50%),
            linear-gradient(165deg, #141210 0%, #0c0c0e 48%, #16120f 100%);
        }
        .air-grid {
          opacity: 0.16;
          background-image:
            linear-gradient(rgba(244, 235, 227, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 235, 227, 0.06) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
        }
        .air-scroll {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }
        .air-hero {
          padding: 16px;
          border: 1px solid rgba(255, 107, 26, 0.28);
          background: rgba(20, 18, 16, 0.72);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
        }
        .air-chip-gold {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
          padding: 3px 8px;
          color: var(--ember);
          border: 1px solid rgba(255, 107, 26, 0.45);
        }
        .air-token-glow {
          position: relative;
          padding: 6px;
          filter: drop-shadow(0 0 18px rgba(255, 107, 26, 0.45));
        }
        .air-panel {
          border: 1px solid rgba(255, 107, 26, 0.22);
          background: rgba(20, 18, 16, 0.78);
          overflow: hidden;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        }
        .air-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 107, 26, 0.16);
        }
        .air-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ember);
          box-shadow: 0 0 8px rgba(255, 107, 26, 0.8);
          animation: airPulse 1.6s ease-in-out infinite;
          flex-shrink: 0;
        }
        .air-verify-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ember);
          background: rgba(255, 107, 26, 0.1);
          border: 1px solid rgba(255, 107, 26, 0.4);
          text-decoration: none;
          white-space: nowrap;
          max-width: 100%;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .air-verify-badge:hover {
          background: rgba(255, 107, 26, 0.18);
          border-color: rgba(255, 107, 26, 0.65);
        }
        .air-last-payout {
          margin: 10px 12px 0;
          padding: 12px 14px;
          border: 1px solid rgba(255, 107, 26, 0.4);
          background: linear-gradient(
            165deg,
            rgba(255, 107, 26, 0.14),
            rgba(20, 18, 16, 0.9)
          );
        }
        .air-share-rank {
          padding: 5px 9px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink);
          background: var(--ember);
          border: 1px solid rgba(255, 107, 26, 0.8);
        }
        .air-share-rank:disabled {
          opacity: 0.55;
        }
        @keyframes airPulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.85);
          }
        }
        .air-payout-card {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          width: 228px;
          min-width: 228px;
          padding: 12px 14px;
          border: 1px solid rgba(255, 107, 26, 0.22);
          background: rgba(12, 12, 14, 0.85);
          text-decoration: none;
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
        }
        .air-payout-card:hover {
          border-color: rgba(255, 107, 26, 0.55);
          background: rgba(255, 107, 26, 0.08);
          transform: translateY(-1px);
        }
        .air-balance {
          padding: 16px;
          border: 1px solid rgba(255, 107, 26, 0.28);
          background: rgba(20, 18, 16, 0.82);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
        }
        .air-vault-badge {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 8px 12px;
          color: var(--ink);
          background: var(--ember);
        }
        .air-progress-track {
          height: 8px;
          background: rgba(255, 107, 26, 0.12);
          overflow: hidden;
        }
        .air-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #c23400, var(--ember));
          transition: width 0.45s ease;
        }
        .air-btn {
          padding: 14px 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink);
          background: var(--ember);
          box-shadow: 0 10px 24px rgba(255, 107, 26, 0.28);
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .air-btn:active {
          transform: scale(0.97);
        }
        .air-btn-off {
          padding: 14px 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6b6560;
          background: rgba(244, 235, 227, 0.06);
          border: 1px solid rgba(154, 143, 134, 0.35);
          cursor: not-allowed;
        }
        .air-btn-ghost {
          padding: 14px 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--mute);
          background: transparent;
          border: 1px solid rgba(255, 107, 26, 0.28);
          flex-shrink: 0;
        }
        .air-btn-ghost:active {
          transform: scale(0.96);
        }
        .air-rank-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid rgba(255, 107, 26, 0.14);
          background: rgba(12, 12, 14, 0.55);
        }
        .air-rank-top {
          border-color: rgba(255, 107, 26, 0.35);
          background: rgba(255, 107, 26, 0.08);
        }
        .air-rank-you {
          border-color: rgba(255, 107, 26, 0.55);
          background: rgba(255, 107, 26, 0.14);
        }
        .air-rank-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
          color: var(--mute);
          background: rgba(244, 235, 227, 0.06);
          border: 1px solid rgba(154, 143, 134, 0.25);
        }
        .air-rank-1 {
          color: var(--ink);
          background: var(--ember);
          border-color: transparent;
        }
        .air-rank-2 {
          color: var(--paper);
          background: rgba(154, 143, 134, 0.35);
          border-color: transparent;
        }
        .air-rank-3 {
          color: var(--paper);
          background: #c23400;
          border-color: transparent;
        }
        .air-you-tag {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 2px 6px;
          color: var(--ink);
          background: var(--ember);
        }
        @keyframes air-scroll-1 {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes air-scroll-2 {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }
        .air-marquee-1 {
          width: max-content;
          animation: air-scroll-1 30s linear infinite;
        }
        .air-marquee-2 {
          width: max-content;
          animation: air-scroll-2 35s linear infinite;
        }
      `}</style>
    </div>
  );
}
