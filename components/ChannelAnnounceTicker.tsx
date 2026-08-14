'use client';

import { useEffect } from 'react';

/**
 * Keeps payout (+ QA) channel posts flowing while the mini app is open.
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

    const delay = window.setTimeout(tick, 2500);
    const id = window.setInterval(tick, 45 * 1000);
    return () => {
      window.clearTimeout(delay);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
