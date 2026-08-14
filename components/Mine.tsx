'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopInfoSection from '@/components/TopInfoSection';
import { triggerHapticFeedback } from '@/utils/ui';
import { useToast } from '@/contexts/ToastContext';
import ShibaCoin from '@/icons/ShibaCoin';
import {
  FALLBACK_BNB_USD,
  FALLBACK_ETH_USD,
  MINING_PAYMENT_ADDRESS,
  MINING_PAY_OPTIONS,
  MINING_PLANS,
  MINE_SHOWCASE_KEY,
  formatGhs,
  formatNativeExact,
  formatPlanShib,
  formatPlanShibExact,
  formatSlotCountdown,
  getPlanActivationsBucket,
  getRecommendedPlan,
  getTodayPlanActivations,
  msUntilPlanSlotRefresh,
  planContractTotal,
  planNetProfit,
  planRoiPct,
  usdToNative,
  type MiningPayOption,
  type MiningPlan,
} from '@/utils/mining-plans';

interface MineProps {
  setCurrentView: (view: string) => void;
}

function PlanPurchaseSheet({
  plan,
  onClose,
}: {
  plan: MiningPlan;
  onClose: () => void;
}) {
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payOption, setPayOption] = useState<MiningPayOption>(MINING_PAY_OPTIONS[0]);
  const [ethUsd, setEthUsd] = useState(FALLBACK_ETH_USD);
  const [bnbUsd, setBnbUsd] = useState(FALLBACK_BNB_USD);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin&vs_currencies=usd',
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        const eth = Number(data?.ethereum?.usd);
        const bnb = Number(data?.binancecoin?.usd);
        if (!cancelled && eth > 0) setEthUsd(eth);
        if (!cancelled && bnb > 0) setBnbUsd(bnb);
      } catch {
        /* keep fallbacks */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountDisplay = useMemo(() => {
    if (payOption.asset === 'shib') {
      return {
        compact: formatPlanShib(plan.shib),
        exact: formatPlanShibExact(plan.shib),
        symbol: 'SHIB',
      };
    }
    if (payOption.asset === 'eth') {
      const exact = formatNativeExact(usdToNative(plan.usd, ethUsd), 6);
      return { compact: exact, exact, symbol: 'ETH' };
    }
    const exact = formatNativeExact(usdToNative(plan.usd, bnbUsd), 6);
    return { compact: exact, exact, symbol: 'BNB' };
  }, [payOption, plan.shib, plan.usd, ethUsd, bnbUsd]);

  const copyText = useCallback(
    async (value: string, label: string) => {
      triggerHapticFeedback(window);
      try {
        await navigator.clipboard.writeText(value);
        showToast(`${label} copied`, 'success');
      } catch {
        showToast('Could not copy. Long-press to select.', 'error');
      }
    },
    [showToast]
  );

  const handlePaid = () => {
    triggerHapticFeedback(window, 'heavy');
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      setSubmitted(true);
      showToast('Payment submitted. Hashrate unlocks after confirmations.', 'success');
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="mine-sheet relative w-full max-w-xl animate-slide-up max-h-[92dvh] overflow-y-auto">
        <div className="mine-sheet-handle" />
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="mine-eyebrow">Activate plan</p>
            <h3 className="text-2xl font-extrabold text-[#f4ebe3] leading-tight tracking-tight">
              {plan.name}
            </h3>
            <p className="text-xs text-[#9a8f86] font-semibold mt-1">
              {formatGhs(plan.ghs)} · {plan.contractDays}-day contract
            </p>
          </div>
          <button type="button" className="mine-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="mine-pay-card mb-3">
          <p className="mine-eyebrow mb-2">Pay with</p>
          <div className="grid grid-cols-2 gap-2">
            {MINING_PAY_OPTIONS.map((opt) => {
              const active = payOption.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={active ? 'mine-pay-opt mine-pay-opt-on' : 'mine-pay-opt'}
                  onClick={() => {
                    triggerHapticFeedback(window);
                    setPayOption(opt);
                  }}
                >
                  <span className="mine-pay-opt-asset">{opt.label}</span>
                  <span className="mine-pay-opt-net">{opt.networkLabel}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#9a8f86] mt-2 font-semibold leading-relaxed">
            {payOption.hint}
          </p>
        </div>

        <div className="mine-pay-card mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="mine-meta">Send exactly</span>
            <span className="mine-usd-pill">≈ ${plan.usd} USD</span>
          </div>
          <button
            type="button"
            className="w-full text-left"
            onClick={() => copyText(amountDisplay.exact, 'Amount')}
          >
            <div className="flex items-center gap-2">
              {payOption.asset === 'shib' ? (
                <ShibaCoin size={28} />
              ) : (
                <span className="mine-asset-badge">{amountDisplay.symbol}</span>
              )}
              <div className="min-w-0">
                <p className="text-2xl font-extrabold text-[#ff6b1a] tabular-nums leading-none tracking-tight">
                  {amountDisplay.compact}
                  <span className="ml-1.5 text-sm font-bold text-[#9a8f86]">
                    {amountDisplay.symbol}
                  </span>
                </p>
                <p className="text-[10px] text-[#9a8f86] mt-1.5 font-mono truncate">
                  {amountDisplay.exact} · {payOption.networkLabel}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-[#ff6b1a] mt-2 font-semibold">Tap to copy exact amount</p>
          </button>
        </div>

        <div className="mine-pay-card mb-3">
          <p className="mine-eyebrow text-center mb-2">
            Payment address · {payOption.networkLabel}
          </p>
          <button
            type="button"
            className="w-full bg-[#0c0c0e] border border-[rgba(255,107,26,0.35)] p-3 text-xs break-all text-center text-[#f4ebe3] font-mono"
            onClick={() => copyText(MINING_PAYMENT_ADDRESS, 'Address')}
          >
            {MINING_PAYMENT_ADDRESS}
          </button>
          <p className="text-xs text-[#ff6b1a] text-center mt-2 font-semibold">Tap to copy</p>
          <p className="text-[10px] text-[#9a8f86] text-center mt-2 font-semibold leading-relaxed">
            Same address for SHIB (ETH/BSC), ETH, and BNB — pick the matching network in your wallet.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="mine-mini-stat">
            <span className="mine-meta">Contract</span>
            <span className="mine-mini-value">{plan.contractDays}d</span>
          </div>
          <div className="mine-mini-stat">
            <span className="mine-meta">Daily</span>
            <span className="mine-mini-value">~{formatPlanShib(plan.dailyShib)}</span>
          </div>
          <div className="mine-mini-stat">
            <span className="mine-meta">ROI</span>
            <span className="mine-mini-value text-[#7dffb3]">+{planRoiPct(plan)}%</span>
          </div>
        </div>

        <p className="text-[11px] text-[#9a8f86] leading-relaxed mb-4 text-center font-semibold">
          Wrong network = lost funds. Activation unlocks after confirmations.
        </p>

        {submitted ? (
          <button type="button" className="mine-btn w-full" onClick={onClose}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="mine-btn w-full"
            onClick={handlePaid}
            disabled={confirming}
          >
            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-[#0c0c0e] border-t-transparent" />
                Verifying…
              </span>
            ) : (
              `I Paid with ${payOption.symbol}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Mine({ setCurrentView }: MineProps) {
  const [selected, setSelected] = useState<MiningPlan | null>(null);
  const [showcase, setShowcase] = useState(false);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0);
  const [tourLabel, setTourLabel] = useState('Preparing plans…');
  const scrollRef = useRef<HTMLDivElement>(null);
  const planRefs = useRef<Record<string, HTMLElement | null>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(MINE_SHOWCASE_KEY) === '1') {
        sessionStorage.removeItem(MINE_SHOWCASE_KEY);
        setShowcase(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!showcase) return;

    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animateScrollTo = (top: number, durationMs: number) =>
      new Promise<void>((resolve) => {
        const scroller = scrollRef.current;
        if (!scroller) {
          resolve();
          return;
        }
        const start = scroller.scrollTop;
        const delta = top - start;
        if (Math.abs(delta) < 2) {
          scroller.scrollTop = top;
          resolve();
          return;
        }
        const t0 = performance.now();
        const step = (now: number) => {
          if (cancelled) {
            resolve();
            return;
          }
          const raw = Math.min(1, (now - t0) / durationMs);
          scroller.scrollTop = start + delta * easeInOutCubic(raw);
          if (raw < 1) {
            rafRef.current = requestAnimationFrame(step);
          } else {
            rafRef.current = null;
            resolve();
          }
        };
        rafRef.current = requestAnimationFrame(step);
      });

    const getPlanScrollTop = (planId: string) => {
      const scroller = scrollRef.current;
      const node = planRefs.current[planId];
      if (!scroller || !node) return 0;
      const scrollerRect = scroller.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const target =
        scroller.scrollTop +
        (nodeRect.top - scrollerRect.top) -
        (scrollerRect.height / 2 - nodeRect.height / 2);
      return Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight));
    };

    const runTour = async () => {
      await wait(200);
      if (cancelled) return;

      const scroller = scrollRef.current;
      if (!scroller) return;

      scroller.style.overflowY = 'hidden';
      setTourLabel('Opening SHIB plan catalog…');
      setTourStep(0);

      await animateScrollTo(0, 320);
      await wait(260);
      if (cancelled) return;

      setTourLabel('Scanning every cloud plan…');
      const bottom = scroller.scrollHeight - scroller.clientHeight;
      await animateScrollTo(bottom, 1450);
      await wait(380);
      if (cancelled) return;

      const order = [...MINING_PLANS].reverse();
      for (let i = 0; i < order.length; i++) {
        if (cancelled) return;
        const plan = order[i];
        setSpotlightId(plan.id);
        setTourStep(i + 1);
        setTourLabel(`${plan.name} · ${formatGhs(plan.ghs)}`);
        try {
          triggerHapticFeedback(window, 'light');
        } catch {
          /* ignore */
        }
        await animateScrollTo(getPlanScrollTop(plan.id), 820);
        await wait(480);
      }

      if (cancelled) return;
      setSpotlightId(null);
      setTourLabel('Choose your mining plan');
      setTourStep(order.length);
      await animateScrollTo(0, 1050);
      await wait(420);

      scroller.style.overflowY = '';
      if (!cancelled) setShowcase(false);
    };

    void runTour();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const scroller = scrollRef.current;
      if (scroller) scroller.style.overflowY = '';
    };
  }, [showcase]);

  const networkStats = useMemo(
    () => [
      { label: 'Pool hashrate', value: '18.4 PH/s' },
      { label: 'Active contracts', value: '12.8k' },
      { label: 'Uptime', value: '99.7%' },
    ],
    []
  );

  const openPlan = (plan: MiningPlan) => {
    triggerHapticFeedback(window);
    setSelected(plan);
  };

  const recommended = useMemo(() => getRecommendedPlan(), []);
  const recommendedRoi = planRoiPct(recommended);
  const [activationBucket, setActivationBucket] = useState(() => getPlanActivationsBucket());
  const todayActivations = useMemo(
    () => getTodayPlanActivations(recommended.id),
    [recommended.id, activationBucket]
  );
  const [slotMsLeft, setSlotMsLeft] = useState(() => msUntilPlanSlotRefresh());

  useEffect(() => {
    setSlotMsLeft(msUntilPlanSlotRefresh());
    const id = window.setInterval(() => {
      setSlotMsLeft(msUntilPlanSlotRefresh());
      const nextBucket = getPlanActivationsBucket();
      setActivationBucket((prev) => (prev === nextBucket ? prev : nextBucket));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const slotLabel = formatSlotCountdown(slotMsLeft);
  const tourTotal = MINING_PLANS.length;
  const tourProgress = showcase ? Math.min(100, (tourStep / Math.max(tourTotal, 1)) * 100) : 0;

  return (
    <div
      className={`mine-root flex justify-center min-h-screen ${showcase ? 'mine-showcase mine-showcase-live' : ''}`}
    >
      <div className="w-full max-w-xl h-[100dvh] max-h-[100dvh] flex flex-col text-[#f4ebe3] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 mine-bg" />
        <div className="pointer-events-none absolute inset-0 mine-grid" />

        <div className="relative z-10 shrink-0">
          <TopInfoSection isGamePage={true} setCurrentView={setCurrentView} />
        </div>

        <div
          ref={scrollRef}
          className={`relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-44 px-4 mine-scroll ${
            showcase ? 'mine-scroll-tour' : ''
          }`}
        >
          {showcase && (
            <div className="mt-3 mine-showcase-banner">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="mine-eyebrow mb-1">Free account detected</p>
                  <p className="text-sm font-bold text-[#f4ebe3] leading-snug">{tourLabel}</p>
                </div>
                <span className="mine-tour-count shrink-0">
                  {Math.min(tourStep, tourTotal)}/{tourTotal}
                </span>
              </div>
              <div className="mine-tour-track">
                <div className="mine-tour-fill" style={{ width: `${tourProgress}%` }} />
              </div>
            </div>
          )}

          <div
            className={`mt-3 mine-hero ${showcase ? 'mine-rise-item' : ''}`}
            style={showcase ? { animationDelay: '0.05s' } : undefined}
          >
            <div className="flex items-center gap-2 mb-2">
              <p className="mine-eyebrow">Shiba Inu · Cloud</p>
              <span className="mine-chip">GH/s</span>
            </div>
            <h1 className="mine-title">
              MINING
              <span>PLANS</span>
            </h1>
            <p className="mine-sub">
              Rent cloud hashrate. Same ~+40% ROI on every plan — higher tiers finish in fewer days.
              Paid in SHIB, ETH, or BNB.
            </p>
          </div>

          <div
            className={`mt-3 grid grid-cols-3 gap-2 ${showcase ? 'mine-rise-item' : ''}`}
            style={showcase ? { animationDelay: '0.12s' } : undefined}
          >
            {networkStats.map((stat) => (
              <div key={stat.label} className="mine-stat">
                <span className="mine-meta">{stat.label}</span>
                <span className="mine-stat-value">{stat.value}</span>
              </div>
            ))}
          </div>

          {!showcase && (
            <div className="mt-3 mine-social-proof">
              <span className="mine-social-dot" aria-hidden />
              <p className="text-[12px] font-semibold text-[#f4ebe3] leading-snug">
                <span className="text-[#ff6b1a] tabular-nums">{todayActivations}</span> miners
                activated <span className="font-bold">{recommended.name}</span> today
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {MINING_PLANS.map((plan, index) => {
              const monthly = Number((plan.dailyShib * 30).toFixed(0));
              const contractTotal = planContractTotal(plan);
              const netProfit = planNetProfit(plan);
              const roiPct = planRoiPct(plan);
              const isPopular = plan.badge === 'popular';
              const isBest = plan.badge === 'best';
              const isForYou = plan.badge === 'foryou';
              const riseDelay = 0.22 + (MINING_PLANS.length - 1 - index) * 0.09;
              const isSpotlight = spotlightId === plan.id;

              return (
                <article
                  key={plan.id}
                  ref={(node) => {
                    planRefs.current[plan.id] = node;
                  }}
                  className={`mine-plan ${isPopular ? 'mine-plan-hot' : ''} ${isBest ? 'mine-plan-best' : ''} ${
                    isForYou ? 'mine-plan-foryou' : ''
                  } ${showcase ? 'mine-plan-rise' : ''} ${isSpotlight ? 'mine-plan-spotlight' : ''}`}
                  style={showcase ? { animationDelay: `${riseDelay}s` } : undefined}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-lg font-extrabold text-[#f4ebe3] leading-none">
                          {plan.name}
                        </h2>
                        {isForYou && <span className="mine-badge-foryou">Best for you</span>}
                        {isPopular && <span className="mine-badge-hot">Most popular</span>}
                        {isBest && <span className="mine-badge-best">Fastest ROI</span>}
                      </div>
                      <p className="text-[11px] text-[#9a8f86] font-medium">{plan.tagline}</p>
                    </div>
                    <div className="mine-ghs-pill shrink-0">
                      <span className="text-[9px] uppercase tracking-[0.12em] opacity-80">
                        Hashrate
                      </span>
                      <span className="font-bold text-sm leading-none">{formatGhs(plan.ghs)}</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ShibaCoin size={22} />
                        <p className="text-xl font-extrabold text-[#ff6b1a] tabular-nums leading-none tracking-tight">
                          {formatPlanShib(plan.shib)}
                          <span className="ml-1 text-[11px] font-bold text-[#9a8f86]">SHIB</span>
                        </p>
                      </div>
                      <p className="text-[11px] text-[#9a8f86] font-medium mt-1">
                        ≈ ${plan.usd} · SHIB / ETH / BNB
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="mine-meta">Est. daily</p>
                      <p className="text-base font-bold text-[#f4ebe3] tabular-nums tracking-tight">
                        +{formatPlanShib(plan.dailyShib)}
                        <span className="ml-1 text-[10px] text-[#9a8f86]">SHIB</span>
                      </p>
                    </div>
                  </div>

                  <div className="mine-profit-row mb-3">
                    <div className="min-w-0">
                      <p className="mine-meta">Contract total</p>
                      <p className="text-sm font-bold text-[#f4ebe3] tabular-nums tracking-tight">
                        {formatPlanShib(contractTotal)}
                        <span className="ml-1 text-[10px] text-[#9a8f86]">SHIB</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="mine-meta">Net profit</p>
                      <p className="text-sm font-bold text-[#7dffb3] tabular-nums tracking-tight">
                        +{formatPlanShib(netProfit)}
                        <span className="ml-1 text-[10px] text-[#9a8f86]">SHIB</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    <div className="mine-plan-meta">
                      <span className="mine-meta">Contract</span>
                      <span className="mine-meta-value">{plan.contractDays}d</span>
                    </div>
                    <div className="mine-plan-meta">
                      <span className="mine-meta">Monthly</span>
                      <span className="mine-meta-value">~{formatPlanShib(monthly)}</span>
                    </div>
                    <div className="mine-plan-meta">
                      <span className="mine-meta">ROI</span>
                      <span className="mine-meta-value text-[#7dffb3]">+{roiPct}%</span>
                    </div>
                  </div>

                  <ul className="mine-features mb-3">
                    {plan.features.slice(0, 3).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>

                  <button type="button" className="mine-btn w-full" onClick={() => openPlan(plan)}>
                    Activate {plan.name}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mt-4 mine-info mb-2">
            <p className="text-sm text-[#9a8f86] font-medium leading-relaxed">
              Every plan targets the same ~+40% ROI. Higher plans pay that gain faster with more
              GH/s and a shorter contract. Pay with SHIB (ETH or BSC), ETH, or BNB to the same
              address. Estimates may vary with network
              difficulty. No hidden fees.
            </p>
          </div>
        </div>

        {!selected && !showcase && (
          <div className="mine-sticky-cta">
            <div className="mine-sticky-inner">
              <div className="min-w-0">
                <p className="mine-meta leading-none mb-1">
                  Best for you · refreshes in{' '}
                  <span className="tabular-nums text-[#ff6b1a]">{slotLabel}</span>
                </p>
                <p className="text-sm font-bold text-[#f4ebe3] leading-tight truncate">
                  {recommended.name} · +{recommendedRoi}% in {recommended.contractDays}d
                </p>
              </div>
              <button
                type="button"
                className="mine-sticky-btn shrink-0"
                onClick={() => openPlan(recommended)}
              >
                Activate
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <PlanPurchaseSheet plan={selected} onClose={() => setSelected(null)} />}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Syne:wght@600;700;800&display=swap');

        .mine-root {
          --ink: #0c0c0e;
          --paper: #f4ebe3;
          --ember: #ff6b1a;
          --mute: #9a8f86;
          font-family: 'Syne', system-ui, sans-serif;
          background: var(--ink);
          color: var(--paper);
        }
        .mine-bg {
          background:
            radial-gradient(ellipse 80% 50% at 80% -10%, rgba(255, 107, 26, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 45% at 0% 100%, rgba(255, 107, 26, 0.12), transparent 50%),
            linear-gradient(165deg, #141210 0%, #0c0c0e 48%, #16120f 100%);
        }
        .mine-grid {
          opacity: 0.16;
          background-image:
            linear-gradient(rgba(244, 235, 227, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 235, 227, 0.06) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
        }
        .mine-scroll {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }
        .mine-eyebrow {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--ember);
        }
        .mine-meta {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--mute);
        }
        .mine-title {
          font-size: clamp(2.1rem, 10vw, 2.75rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 0.92;
          text-transform: uppercase;
        }
        .mine-title span {
          display: block;
          color: transparent;
          -webkit-text-stroke: 1.4px rgba(244, 235, 227, 0.85);
        }
        .mine-sub {
          margin-top: 10px;
          max-width: 20rem;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
          color: var(--mute);
        }
        .mine-chip {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
          padding: 3px 8px;
          color: var(--ember);
          border: 1px solid rgba(255, 107, 26, 0.45);
        }
        .mine-showcase-live {
          animation: minePageIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes minePageIn {
          from {
            opacity: 0.55;
            filter: blur(3px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
        }
        .mine-hero {
          padding: 6px 2px 0;
        }
        .mine-social-proof {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          border-top: 1px solid rgba(244, 235, 227, 0.12);
          border-bottom: 1px solid rgba(244, 235, 227, 0.12);
        }
        .mine-social-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #7dffb3;
          box-shadow: 0 0 0 4px rgba(125, 255, 179, 0.15);
          flex-shrink: 0;
          animation: minePulseDot 1.6s ease-in-out infinite;
        }
        @keyframes minePulseDot {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.55;
          }
        }
        .mine-showcase-banner {
          position: sticky;
          top: 0;
          z-index: 20;
          padding: 14px 16px;
          border: 1px solid rgba(255, 107, 26, 0.45);
          background: linear-gradient(120deg, rgba(255, 107, 26, 0.16), rgba(12, 12, 14, 0.95));
          backdrop-filter: blur(8px);
          animation: mineRiseUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .mine-tour-count {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 6px 10px;
          color: var(--ink);
          background: var(--ember);
        }
        .mine-tour-track {
          height: 3px;
          background: rgba(244, 235, 227, 0.12);
          overflow: hidden;
        }
        .mine-tour-fill {
          height: 100%;
          background: linear-gradient(90deg, #c23400, var(--ember));
          transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .mine-rise-item {
          animation: mineRiseUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .mine-plan-rise {
          opacity: 0;
          animation: minePlanRise 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .mine-plan-spotlight {
          border-color: rgba(255, 107, 26, 0.85) !important;
          box-shadow: 0 0 0 1px rgba(255, 107, 26, 0.45), 0 18px 40px rgba(255, 107, 26, 0.22) !important;
          transform: scale(1.02);
          z-index: 3;
          opacity: 1 !important;
          filter: none !important;
        }
        .mine-showcase .mine-plan:not(.mine-plan-spotlight) {
          opacity: 0.4;
          filter: saturate(0.7);
          transform: scale(0.985);
        }
        @keyframes mineRiseUp {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes minePlanRise {
          0% {
            opacity: 0;
            transform: translateY(56px) scale(0.94);
            filter: blur(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        .mine-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 6px;
          border-top: 1px solid rgba(244, 235, 227, 0.14);
          text-align: center;
        }
        .mine-stat-value {
          font-weight: 700;
          font-size: 13px;
          color: var(--ember);
          font-variant-numeric: tabular-nums;
        }
        .mine-plan {
          padding: 14px;
          border: 1px solid rgba(244, 235, 227, 0.14);
          background: linear-gradient(180deg, rgba(255, 107, 26, 0.08), rgba(12, 12, 14, 0.35));
          transition:
            transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.45s ease,
            border-color 0.45s ease,
            opacity 0.45s ease,
            filter 0.45s ease;
        }
        .mine-plan-hot {
          border-color: rgba(255, 107, 26, 0.45);
        }
        .mine-plan-best {
          border-color: rgba(125, 255, 179, 0.35);
        }
        .mine-plan-foryou {
          border-color: rgba(255, 107, 26, 0.7);
          box-shadow: 0 0 0 1px rgba(255, 107, 26, 0.25);
        }
        .mine-badge-hot,
        .mine-badge-best,
        .mine-badge-foryou {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 8px;
        }
        .mine-badge-hot {
          color: var(--ink);
          background: var(--ember);
        }
        .mine-badge-best {
          color: #0c0c0e;
          background: #7dffb3;
        }
        .mine-badge-foryou {
          color: var(--paper);
          border: 1px solid rgba(255, 107, 26, 0.55);
        }
        .mine-ghs-pill {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          padding: 8px 10px;
          color: var(--ink);
          background: var(--ember);
          clip-path: polygon(0 0, 100% 0, 100% 72%, 88% 100%, 0 100%);
        }
        .mine-profit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid rgba(244, 235, 227, 0.1);
          border-bottom: 1px solid rgba(244, 235, 227, 0.1);
        }
        .mine-plan-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 4px;
          border-top: 1px solid rgba(244, 235, 227, 0.1);
        }
        .mine-meta-value {
          font-size: 12px;
          font-weight: 700;
          color: var(--paper);
        }
        .mine-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 4px;
        }
        .mine-features li {
          position: relative;
          padding-left: 14px;
          font-size: 11px;
          color: var(--mute);
          font-weight: 600;
        }
        .mine-features li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          width: 6px;
          height: 6px;
          background: var(--ember);
        }
        .mine-btn {
          padding: 14px 18px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink);
          background: var(--ember);
          transition: transform 0.15s ease;
        }
        .mine-btn:active {
          transform: scale(0.98);
        }
        .mine-btn:disabled {
          opacity: 0.75;
        }
        .mine-sticky-cta {
          position: absolute;
          left: 0;
          right: 0;
          bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
          z-index: 30;
          padding: 0 12px;
          pointer-events: none;
        }
        .mine-sticky-inner {
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px 10px 14px;
          border: 1px solid rgba(255, 107, 26, 0.4);
          background: rgba(12, 12, 14, 0.92);
          backdrop-filter: blur(10px);
        }
        .mine-sticky-btn {
          padding: 11px 16px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink);
          background: var(--ember);
        }
        .mine-sticky-btn:active {
          transform: scale(0.97);
        }
        .mine-info {
          padding: 14px 0;
          border-top: 1px solid rgba(244, 235, 227, 0.12);
        }
        .mine-sheet {
          padding: 12px 18px calc(24px + env(safe-area-inset-bottom, 0px));
          border-radius: 20px 20px 0 0;
          background: linear-gradient(180deg, #1a1613 0%, #0c0c0e 100%);
          border-top: 1px solid rgba(255, 107, 26, 0.35);
          max-height: min(92dvh, 720px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .mine-sheet-handle {
          width: 40px;
          height: 4px;
          margin: 0 auto 12px;
          border-radius: 999px;
          background: rgba(244, 235, 227, 0.25);
        }
        .mine-close {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: var(--mute);
          border: 1px solid rgba(244, 235, 227, 0.2);
          flex-shrink: 0;
        }
        .mine-pay-card {
          padding: 12px;
          border: 1px solid rgba(255, 107, 26, 0.25);
          background: rgba(255, 107, 26, 0.06);
        }
        .mine-pay-opt {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 10px 12px;
          text-align: left;
          border: 1px solid rgba(244, 235, 227, 0.16);
          background: rgba(12, 12, 14, 0.65);
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .mine-pay-opt-on {
          border-color: rgba(255, 107, 26, 0.7);
          background: rgba(255, 107, 26, 0.14);
        }
        .mine-pay-opt-asset {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: var(--paper);
        }
        .mine-pay-opt-net {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--mute);
        }
        .mine-pay-opt-on .mine-pay-opt-net {
          color: var(--ember);
        }
        .mine-asset-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--ink);
          background: var(--ember);
        }
        .mine-usd-pill {
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          font-size: 10px;
          font-weight: 600;
          color: var(--ember);
          border: 1px solid rgba(255, 107, 26, 0.35);
          padding: 3px 8px;
        }
        .mine-mini-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 4px;
          border-top: 1px solid rgba(244, 235, 227, 0.12);
          text-align: center;
        }
        .mine-mini-value {
          font-size: 11px;
          font-weight: 700;
          color: var(--paper);
        }
      `}</style>
    </div>
  );
}
