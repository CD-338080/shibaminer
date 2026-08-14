'use client';

import { useEffect } from 'react';

/**
 * Keep payout (+ QA) channel posts flowing even when Cash tab is closed.
 * Server still enforces pace / secrets.
 */
export function ChannelAnnounceTicker() {
  useEffect(() => {
    const tick = () => {
      void fetch(`/api/doge-payouts?announce=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      }).catch(() => undefined);
      void fetch(`/api/qa-announce?announce=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
      }).catch(() => undefined);
    };

    const delay = window.setTimeout(tick, 4000);
    const id = window.setInterval(tick, 60 * 1000);
    return () => {
      window.clearTimeout(delay);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
