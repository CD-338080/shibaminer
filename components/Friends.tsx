'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useGameStore } from '@/utils/game-mechanics';
import { baseGift, bigGift } from '@/images';
import { formatNumber, triggerHapticFeedback } from '@/utils/ui';
import { REFERRAL_BONUS_BASE, REFERRAL_BONUS_PREMIUM, LEVELS } from '@/utils/consts';
import { getUserTelegramId } from '@/utils/user';
import { getReferralAppUrl, DEV_TELEGRAM_ID, isBypassTelegramAuth } from '@/utils/bot-deep-links';
import Copy from '@/icons/Copy';
import ShibaCoin from '@/icons/ShibaCoin';
import { useToast } from '@/contexts/ToastContext';
import { initUtils } from '@telegram-apps/sdk';

function resolveTelegramId(initData: string): string | null {
  const fromInit = getUserTelegramId(initData);
  if (fromInit) return fromInit;
  if (typeof window === 'undefined') {
    return isBypassTelegramAuth() ? DEV_TELEGRAM_ID : null;
  }
  try {
    const w = window as Window & {
      Telegram?: {
        WebApp?: {
          initData?: string;
          initDataUnsafe?: { user?: { id?: number } };
        };
      };
    };
    const id = w.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (id != null) return String(id);
    const raw = w.Telegram?.WebApp?.initData;
    if (raw) {
      const parsed = getUserTelegramId(raw);
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }
  // Local / bypass: same id used by server-checks when BYPASS_TELEGRAM_AUTH=true
  if (isBypassTelegramAuth() || initData === 'temp') {
    return DEV_TELEGRAM_ID;
  }
  return null;
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall through - Telegram WebView often blocks clipboard API */
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('Clipboard copy failed');
}
interface Referral {
  id: string;
  telegramId: string;
  name: string | null;
  points: number;
  referralPointsEarned: number;
  levelName: string;
  levelImage: StaticImageData;
}

type ShareAction = 'open' | 'copy-open' | 'telegram' | 'native';

type ShareOption = {
  id: string;
  label: string;
  color: string;
  action: ShareAction;
  getUrl?: (inviteLink: string, shareText: string) => string;
  appUrl?: (inviteLink: string, shareText: string) => string;
  icon: React.ReactNode;
};

function ShibaIcon({ size = 24 }: { size?: number }) {
  return <ShibaCoin size={size} />;
}

const SHARE_OPTIONS: ShareOption[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#229ED9',
    action: 'telegram',
    getUrl: (link, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    action: 'open',
    getUrl: (link, text) => `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${link}`)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.85 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    id: 'messenger',
    label: 'Messenger',
    color: '#0084FF',
    action: 'copy-open',
    appUrl: () => 'https://www.messenger.com/',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8l3.13 3.259L19.752 8l-6.559 6.963z" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    action: 'open',
    getUrl: (link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: 'x',
    label: 'X',
    color: '#000000',
    action: 'open',
    getUrl: (link, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.227-8.26L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    action: 'copy-open',
    appUrl: () => 'https://www.instagram.com/',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    action: 'copy-open',
    appUrl: () => 'https://www.tiktok.com/',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    id: 'sms',
    label: 'SMS',
    color: '#34C759',
    action: 'open',
    getUrl: (link, text) => `sms:?body=${encodeURIComponent(`${text}\n\n${link}`)}`,
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
      </svg>
    ),
  },
  {
    id: 'more',
    label: 'More',
    color: 'linear-gradient(135deg, #ff6b1a, #c23400)',
    action: 'native',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
      </svg>
    ),
  },
];

const TELEGRAM_SHARE = SHARE_OPTIONS[0];

const SHARE_HOOK = 'Mine SHIB with me';

async function buildStoriesShareCard(inviteLink: string): Promise<Blob> {
  const w = 1080;
  const h = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#141210');
  sky.addColorStop(0.45, '#0c0c0e');
  sky.addColorStop(1, '#1a120e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(w * 0.5, 280, 420, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 107, 26, 0.28)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(w * 0.82, 1500, 360, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 107, 26, 0.12)';
  ctx.fill();

  // Coin
  const coinX = w / 2;
  const coinY = 620;
  const coinR = 160;
  const coinGrad = ctx.createRadialGradient(coinX - 40, coinY - 40, 20, coinX, coinY, coinR);
  coinGrad.addColorStop(0, '#ff8a3d');
  coinGrad.addColorStop(0.55, '#ff6b1a');
  coinGrad.addColorStop(1, '#c23400');
  ctx.beginPath();
  ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2);
  ctx.fillStyle = coinGrad;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffe1c7';
  ctx.stroke();
  ctx.fillStyle = '#0c0c0e';
  ctx.font = 'bold 150px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', coinX, coinY + 12);

  ctx.fillStyle = '#ff6b1a';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText('AUTOMATIC SHIBA MINING', coinX, 880);

  ctx.fillStyle = '#f4ebe3';
  ctx.font = 'bold 110px system-ui, sans-serif';
  ctx.fillText('Shiba Miner', coinX, 980);

  ctx.fillStyle = '#9a8f86';
  ctx.font = '600 52px system-ui, sans-serif';
  ctx.fillText(SHARE_HOOK, coinX, 1090);

  // Link pill
  const pillW = 860;
  const pillH = 88;
  const pillX = (w - pillW) / 2;
  const pillY = 1220;
  ctx.fillStyle = 'rgba(255, 107, 26, 0.1)';
  const rr = 44;
  ctx.beginPath();
  ctx.moveTo(pillX + rr, pillY);
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, rr);
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, rr);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY, rr);
  ctx.arcTo(pillX, pillY, pillX + pillW, pillY, rr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 107, 26, 0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#f4ebe3';
  ctx.font = '600 28px system-ui, sans-serif';
  const shortLink = inviteLink.length > 42 ? `${inviteLink.slice(0, 39)}...` : inviteLink;
  ctx.fillText(shortLink, coinX, pillY + pillH / 2);

  ctx.fillStyle = '#ff6b1a';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('Shiba Inu ? SHIB', coinX, 1420);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export share card'));
    }, 'image/png');
  });
}
export default function Friends() {
  const showToast = useToast();

  const { userTelegramInitData } = useGameStore();
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);
  const [showBonusesList, setShowBonusesList] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const inviteLink = useMemo(() => {
    const userTelegramId = resolveTelegramId(userTelegramInitData || '');
    if (!userTelegramId) return '';
    return getReferralAppUrl(userTelegramId);
  }, [userTelegramInitData]);

  // Accept any kentId value (numeric Telegram ids and bypass 'undefined')
  const hasInviteLink = /[?&]startapp=kentId[^&\s]+/.test(inviteLink) || /kentId[^&\s/]+/.test(inviteLink);

  const shareText = SHARE_HOOK;

  const requireInviteLink = useCallback((): boolean => {
    if (hasInviteLink && inviteLink) return true;
    showToast('Open Shiba Miner from Telegram to get your invite link.', 'error');
    return false;
  }, [hasInviteLink, inviteLink, showToast]);

  const handleShowBonusesList = useCallback(() => {
    triggerHapticFeedback(window);
    setShowBonusesList((prevState) => !prevState);
  }, []);

  const fetchReferrals = useCallback(async () => {
    setIsLoadingReferrals(true);
    try {
      const response = await fetch(
        `/api/user/referrals?initData=${encodeURIComponent(userTelegramInitData)}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch referrals');
      }
      const data = await response.json();
      setReferrals(data.referrals);
      setReferralCount(data.referralCount);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      showToast('Failed to fetch referrals. Please try again later.', 'error');
    } finally {
      setIsLoadingReferrals(false);
    }
  }, [userTelegramInitData, showToast]);

  const handleFetchReferrals = useCallback(() => {
    triggerHapticFeedback(window);
    fetchReferrals();
  }, [fetchReferrals]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const copyInviteLink = useCallback(async () => {
    if (!hasInviteLink) throw new Error('Missing invite link');
    await copyTextToClipboard(inviteLink);
  }, [inviteLink, hasInviteLink]);

  const handleCopyInviteLink = useCallback(() => {
    triggerHapticFeedback(window);
    if (!requireInviteLink()) return;
    copyInviteLink()
      .then(() => {
        setCopyButtonText('Copied!');
        showToast('Invite link copied to clipboard!', 'success');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
      })
      .catch(() => showToast('Failed to copy link. Please try again.', 'error'));
  }, [copyInviteLink, requireInviteLink, showToast]);

  const openExternal = useCallback((url: string) => {
    try {
      const utils = initUtils();
      utils.openLink(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleShareOption = useCallback(
    async (option: ShareOption) => {
      triggerHapticFeedback(window);
      if (!requireInviteLink()) return;

      try {
        if (option.action === 'native') {
          if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({
              title: 'Shiba Miner',
              text: `${shareText}\n${inviteLink}`,
              url: inviteLink,
            });
            showToast(`Shared via ${option.label}!`, 'success');
          } else {
            await copyInviteLink();
            showToast('Link copied - paste it anywhere!', 'success');
          }
          setShowShareSheet(false);
          return;
        }

        if (option.action === 'copy-open') {
          await copyInviteLink();
          try {
            const blob = await buildStoriesShareCard(inviteLink);
            const file = new File([blob], 'shiba-miner-invite.png', { type: 'image/png' });
            if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Shiba Miner',
                text: `${SHARE_HOOK}\n${inviteLink}`,
              });
              showToast(`Card + link ready for ${option.label}!`, 'success');
              setShowShareSheet(false);
              return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'shiba-miner-invite.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch {
            /* link already copied - still open the app */
          }
          showToast(`Link copied! Paste it in ${option.label}.`, 'success');
          const target = option.appUrl?.(inviteLink, shareText);
          if (target) {
            setTimeout(() => openExternal(target), 250);
          }
          setShowShareSheet(false);
          return;
        }

        if (option.action === 'telegram') {
          const url = option.getUrl?.(inviteLink, shareText);
          if (!url) return;
          try {
            const utils = initUtils();
            utils.openTelegramLink(url);
          } catch {
            openExternal(url);
          }
          showToast('Opening Telegram...', 'success');
          setShowShareSheet(false);
          return;
        }

        const url = option.getUrl?.(inviteLink, shareText);
        if (url) {
          openExternal(url);
          showToast(`Opening ${option.label}...`, 'success');
          setShowShareSheet(false);
        }
      } catch (error) {
        console.error(`Share via ${option.label} failed:`, error);
        try {
          await copyInviteLink();
          showToast('Could not open app - link copied instead.', 'success');
        } catch {
          showToast(`Failed to share via ${option.label}.`, 'error');
        }
      }
    },
    [inviteLink, shareText, copyInviteLink, openExternal, requireInviteLink, showToast]
  );

  const handleInviteFriend = useCallback(() => {
    triggerHapticFeedback(window);
    if (!requireInviteLink()) return;
    setShowShareSheet(true);
  }, [requireInviteLink]);

  const closeShareSheet = useCallback(() => {
    triggerHapticFeedback(window);
    setShowShareSheet(false);
  }, []);

  const handleTelegramShare = useCallback(async () => {
    triggerHapticFeedback(window);
    if (!requireInviteLink()) return;
    const url =
      TELEGRAM_SHARE.getUrl?.(inviteLink, shareText) ||
      `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
    try {
      const utils = initUtils();
      if (typeof utils.openTelegramLink === 'function') {
        utils.openTelegramLink(url);
      } else {
        utils.openLink(url);
      }
    } catch {
      openExternal(url);
    }
    showToast('Opening Telegram...', 'success');
  }, [requireInviteLink, inviteLink, shareText, openExternal, showToast]);

  const handleSaveShareCard = useCallback(async () => {
    triggerHapticFeedback(window);
    if (!requireInviteLink()) return;
    setSavingCard(true);
    try {
      const blob = await buildStoriesShareCard(inviteLink);
      const file = new File([blob], 'shiba-miner-invite.png', { type: 'image/png' });

      await copyInviteLink();

      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Shiba Miner',
          text: `${SHARE_HOOK}\n${inviteLink}`,
        });
        showToast('Share card ready - paste your link in Stories!', 'success');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shiba-miner-invite.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Card saved + link copied for Stories!', 'success');
    } catch (error) {
      console.error('Share card failed:', error);
      try {
        await copyInviteLink();
        showToast('Could not save card - invite link copied instead.', 'success');
      } catch {
        showToast('Failed to create share card.', 'error');
      }
    } finally {
      setSavingCard(false);
    }
  }, [inviteLink, copyInviteLink, requireInviteLink, showToast]);

  return (
    <div className="fr-root flex justify-center min-h-screen">
      <div className="w-full max-w-xl h-[100dvh] max-h-[100dvh] flex flex-col text-[#f4ebe3] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 fr-bg" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={{backgroundImage:"linear-gradient(rgba(244,235,227,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(244,235,227,0.06) 1px, transparent 1px)", backgroundSize:"28px 28px"}} />

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-36 px-4 pt-4 fr-scroll">
          {/* Hero */}
          <div className="fr-hero">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#ff6b1a] font-bold">
                Referral rewards
              </p>
              <span className="fr-chip-gold">SHIB</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#f4ebe3] leading-none uppercase">
              Invite Pack
            </h1>
            <p className="text-xs text-[#9a8f86] font-medium mt-2 leading-relaxed">
              Both earn SHIB. Share: <span className="text-[#ff6b1a] font-bold">{SHARE_HOOK}</span>
            </p>
          </div>

          {/* Bonus cards */}
          <div className="mt-4 space-y-2">
            <div className="fr-card flex items-center gap-3">
              <Image src={baseGift} alt="Gift" width={40} height={40} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#f4ebe3]">Invite a friend</p>
                <div className="flex items-center mt-1">
                  <ShibaIcon size={18} />
                  <span className="ml-1.5 text-xs text-[#9a8f86] font-medium">
                    <span className="text-[#ff6b1a] font-bold">+{formatNumber(REFERRAL_BONUS_BASE)}</span>{' '}
                    SHIB for you and your friend
                  </span>
                </div>
              </div>
            </div>

            <div className="fr-card flex items-center gap-3">
              <Image src={bigGift} alt="Premium Gift" width={40} height={40} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#f4ebe3]">Invite with Telegram Premium</p>
                <div className="flex items-center mt-1">
                  <ShibaIcon size={18} />
                  <span className="ml-1.5 text-xs text-[#9a8f86] font-medium">
                    <span className="text-[#ff6b1a] font-bold">
                      +{formatNumber(REFERRAL_BONUS_PREMIUM)}
                    </span>{' '}
                    SHIB for you and your friend
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={handleShowBonusesList} className="fr-link mt-4">
            {showBonusesList ? 'Hide bonuses' : 'More bonuses'}
          </button>

          {showBonusesList && (
            <div className="mt-4 fr-panel">
              <div className="fr-panel-head">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#ff6b1a] font-bold">
                  Bonus for leveling up
                </p>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex justify-between text-[#9a8f86] px-2 mb-1 text-[10px] uppercase tracking-wider font-bold">
                  <span className="flex-1">Level</span>
                  <div className="flex justify-between flex-1">
                    <span>Friend</span>
                    <span>Premium</span>
                  </div>
                </div>
                {LEVELS.slice(1).map((level, index) => (
                  <div key={index} className="fr-level-row">
                    <div className="flex items-center flex-1 min-w-0">
                      <Image
                        src={level.smallImage}
                        alt={level.name}
                        width={36}
                        height={36}
                        className="rounded-lg mr-2 shrink-0"
                      />
                      <span className="font-bold text-[#f4ebe3] text-sm truncate">{level.name}</span>
                    </div>
                    <div className="flex items-center justify-between flex-1">
                      <div className="flex items-center mr-3">
                        <ShibaIcon size={14} />
                        <span className="text-[#ff6b1a] text-sm font-bold ml-1">
                          +{formatNumber(level.friendBonus)}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <ShibaIcon size={14} />
                        <span className="text-[#ff6b1a] text-sm font-bold ml-1">
                          +{formatNumber(level.friendBonusPremium)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-[#f4ebe3]">
                Your friends{' '}
                <span className="text-[#ff6b1a]">({referralCount})</span>
              </h2>
              <button
                type="button"
                onClick={handleFetchReferrals}
                className="fr-icon-btn"
                aria-label="Refresh friends"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {isLoadingReferrals ? (
                <div className="space-y-2 animate-pulse">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="fr-card flex items-center gap-3">
                      <div className="w-12 h-12 bg-[rgba(255,107,26,0.12)] rounded-full shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-[rgba(255,107,26,0.12)] rounded w-24" />
                        <div className="h-3 bg-[rgba(255,107,26,0.1)] rounded w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : referrals.length > 0 ? (
                <ul className="space-y-2">
                  {referrals.map((referral: Referral) => (
                    <li key={referral.id} className="fr-card flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Image
                          src={referral.levelImage}
                          alt={referral.levelName}
                          width={48}
                          height={48}
                          className="rounded-full shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-bold truncate block text-sm text-[#f4ebe3]">
                            {referral.name || `Player ???${referral.telegramId.slice(-4)}`}
                          </span>
                          <p className="text-xs text-[#9a8f86] font-medium mt-0.5">
                            {referral.levelName} ? {formatNumber(referral.points)} SHIB
                          </p>
                        </div>
                      </div>
                      <span className="text-[#ff6b1a] shrink-0 font-bold flex items-center gap-1 text-sm">
                        +{formatNumber(referral.referralPointsEarned)}
                        <ShibaIcon size={16} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="fr-empty">
                  <p className="text-base font-bold text-[#f4ebe3] mb-1">No friends yet</p>
                  <p className="text-xs text-[#9a8f86] font-medium mb-3 leading-relaxed">
                    Invite 1 friend ? you both get{' '}
                    <span className="text-[#ff6b1a] font-bold">
                      +{formatNumber(REFERRAL_BONUS_BASE)} SHIB
                    </span>
                  </p>
                  <div className="fr-empty-reward mb-4">
                    <ShibaIcon size={22} />
                    <span className="font-bold text-sm text-[#f4ebe3]">
                      Example: you + friend ={' '}
                      <span className="text-[#ff6b1a]">
                        +{formatNumber(REFERRAL_BONUS_BASE * 2)} SHIB
                      </span>{' '}
                      total
                    </span>
                  </div>
                  <button type="button" className="fr-btn w-full" onClick={handleTelegramShare}>
                    Invite on Telegram
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed CTA ? Telegram first */}
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-40 flex gap-2 px-4">
          <button type="button" className="fr-btn-tg flex-1" onClick={handleTelegramShare}>
            Share on Telegram
          </button>
          <button
            type="button"
            className="fr-btn-more"
            onClick={handleInviteFriend}
            aria-label="More share options"
          >
            More
          </button>
          <button
            type="button"
            className="fr-btn-icon"
            onClick={handleCopyInviteLink}
            aria-label="Copy invite link"
          >
            {copyButtonText === 'Copied!' ? (
              <span className="text-[#f4ebe3] font-bold text-lg">?</span>
            ) : (
              <Copy />
            )}
          </button>
        </div>
      </div>

      {showShareSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeShareSheet();
          }}
        >
          <div className="w-full max-w-xl rounded-t-3xl border-2 border-[rgba(255,107,26,0.35)] bg-gradient-to-b from-[#1a1613] to-[#0c0c0e] p-5 pb-8 fr-sheet">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[rgba(255,107,26,0.45)]" />
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#ff6b1a] font-bold">
                  Share Shiba Miner
                </p>
                <h3 className="text-xl font-bold mt-1 text-[#f4ebe3]">Invite via</h3>
              </div>
              <button
                type="button"
                onClick={closeShareSheet}
                className="w-9 h-9 rounded-xl bg-[rgba(244,235,227,0.08)] border border-[rgba(255,107,26,0.35)] text-[#9a8f86] hover:text-[#f4ebe3] text-2xl flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <p className="text-sm font-bold text-[#f4ebe3] mt-2 mb-1">{SHARE_HOOK}</p>
            <p className="text-[11px] text-[#9a8f86] font-medium mb-4 break-all leading-relaxed">
              {hasInviteLink ? inviteLink : 'Loading your invite link...'}
            </p>

            <div className="fr-share-card mb-4">
              <div className="fr-share-card-preview">
                <div className="fr-share-card-coin">
                  <ShibaIcon size={42} />
                </div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#ff6b1a] font-bold">
                  Shiba Miner
                </p>
                <p className="text-lg font-bold text-[#f4ebe3] leading-tight mt-1">{SHARE_HOOK}</p>
                <p className="text-[10px] text-[#9a8f86] font-medium mt-2">Stories ? TikTok ? IG</p>
              </div>
              <button
                type="button"
                className="fr-btn w-full mt-3"
                onClick={handleSaveShareCard}
                disabled={savingCard}
              >
                {savingCard ? 'Preparing?' : 'Save Stories card'}
              </button>
              <p className="text-[10px] text-center text-[#9a8f86] font-medium mt-2">
                Saves image + copies your invite link
              </p>
            </div>

            <button type="button" className="fr-btn-tg w-full mb-4" onClick={handleTelegramShare}>
              Share on Telegram
            </button>

            <div className="grid grid-cols-3 gap-3">
              {SHARE_OPTIONS.filter((o) => o.id !== 'telegram').map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleShareOption(option)}
                  className="fr-share-item"
                >
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    style={{ background: option.color }}
                  >
                    {option.icon}
                  </span>
                  <span className="text-xs font-bold text-[#9a8f86]">{option.label}</span>
                </button>
              ))}
            </div>

            <button type="button" onClick={handleCopyInviteLink} className="fr-btn w-full mt-5">
              {copyButtonText === 'Copied!' ? 'Link copied' : 'Copy invite link'}
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Syne:wght@600;700;800&display=swap');

        .fr-root {
          --ink: #0c0c0e;
          --paper: #f4ebe3;
          --ember: #ff6b1a;
          --mute: #9a8f86;
          font-family: 'Syne', system-ui, sans-serif;
          background: var(--ink);
          color: var(--paper);
        }
        .fr-bg {
          background:
            radial-gradient(ellipse 80% 50% at 80% -10%, rgba(255, 107, 26, 0.28), transparent 55%),
            radial-gradient(ellipse 70% 45% at 0% 100%, rgba(255, 107, 26, 0.12), transparent 50%),
            linear-gradient(165deg, #141210 0%, #0c0c0e 48%, #16120f 100%);
        }
        .fr-scroll {
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }
        .fr-hero {
          padding: 16px;
          border-radius: 22px;
          background: rgba(255, 107, 26, 0.06);
          border: 2px solid rgba(255, 107, 26, 0.28);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
        }
        .fr-chip-gold {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 3px 8px;
          border-radius: 999px;
          color: #ff6b1a;
          background: rgba(255, 107, 26, 0.2);
          border: 1.5px solid rgba(255, 107, 26, 0.4);
        }
        .fr-card {
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255, 107, 26, 0.06);
          border: 1.5px solid rgba(255, 107, 26, 0.22);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
        }
        .fr-link {
          display: block;
          width: 100%;
          text-align: center;
          color: #ff6b1a;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.04em;
        }
        .fr-panel {
          border-radius: 22px;
          background: rgba(255, 107, 26, 0.05);
          border: 2px solid rgba(255, 107, 26, 0.22);
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
        }
        .fr-panel-head {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 107, 26, 0.18);
        }
        .fr-level-row {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.65);
          border: 1.5px solid rgba(255, 107, 26, 0.18);
        }
        .fr-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9a8f86;
          background: rgba(255, 255, 255, 0.75);
          border: 1.5px solid rgba(255, 107, 26, 0.25);
        }
        .fr-icon-btn:hover {
          color: #c47a0a;
        }
        .fr-empty {
          text-align: center;
          color: #9a8f86;
          background: rgba(255, 107, 26, 0.05);
          border: 2px solid rgba(255, 107, 26, 0.22);
          border-radius: 18px;
          padding: 20px 16px;
          font-weight: 500;
          font-size: 13px;
        }
        .fr-empty-reward {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 107, 26, 0.12);
          border: 1.5px solid rgba(255, 107, 26, 0.35);
        }
        .fr-share-card {
          padding: 12px;
          border-radius: 18px;
          background: rgba(255, 107, 26, 0.08);
          border: 1.5px solid rgba(255, 107, 26, 0.28);
        }
        .fr-share-card-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 18px 14px;
          border-radius: 14px;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 107, 26, 0.25), transparent 60%), linear-gradient(180deg, #1a1613 0%, #0c0c0e 100%);
          border: 1.5px solid rgba(255, 107, 26, 0.25);
        }
        .fr-share-card-coin {
          margin-bottom: 8px;
          filter: drop-shadow(0 8px 14px rgba(255, 107, 26, 0.35));
        }
        .fr-btn {
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #0c0c0e;
          background: #ff6b1a;
          box-shadow: 0 10px 24px rgba(255, 107, 26, 0.28);
          transition: transform 0.15s ease;
        }
        .fr-btn:active {
          transform: scale(0.97);
        }
        .fr-btn:disabled {
          opacity: 0.75;
        }
        .fr-btn-tg {
          padding: 14px 12px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #ffffff;
          background: linear-gradient(135deg, #34b7f1 0%, #229ed9 55%, #1a8bc4 100%);
          box-shadow: 0 10px 24px rgba(34, 158, 217, 0.35);
          transition: transform 0.15s ease;
        }
        .fr-btn-tg:active {
          transform: scale(0.97);
        }
        .fr-btn-more {
          padding: 14px 12px;
          min-width: 64px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #f4ebe3;
          background: rgba(12, 12, 14, 0.95);
          border: 2px solid rgba(255, 107, 26, 0.4);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
        }
        .fr-btn-more:active {
          transform: scale(0.97);
        }
        .fr-btn-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #0c0c0e;
          background: #ff6b1a;
          box-shadow: 0 10px 24px rgba(255, 107, 26, 0.28);
        }
        .fr-btn-icon:active {
          transform: scale(0.95);
        }
        .fr-sheet {
          animation: frSlideUp 0.25s ease-out;
        }
        @keyframes frSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0.6;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .fr-share-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 107, 26, 0.06);
          border: 1.5px solid rgba(255, 107, 26, 0.22);
          transition: border-color 0.2s ease, transform 0.15s ease;
        }
        .fr-share-item:hover {
          border-color: rgba(240, 180, 41, 0.55);
        }
        .fr-share-item:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
}
