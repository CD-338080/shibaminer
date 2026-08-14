'use client';

import { useEffect } from 'react';

/**
 * App-driven channel posts (no Jarvis).
 * Hits the payout feed so the server can auto-post to PAYOUT_CHANNEL_ID,
 * and paces Q&A separately.
 */
export function ChannelAnnounceTicker() {
  useEffect(() => {
    const tick = () => {
      void fetch(`/api/doge-payouts?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      }).catch(() => undefined);
      void fetch(`/api/qa-announce?announce=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      }).catch(() => undefined);
    };

    const delay = window.setTimeout(tick, 5000);
    const id = window.setInterval(tick, 60 * 1000);
    return () => {
      window.clearTimeout(delay);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
