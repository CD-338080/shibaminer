// app/api/license/route.ts

/**
 * This project was developed by Nikandr Surkov.
 * You may not use this code if you purchased it from any source other than the official website https://nikandr.com.
 * If you purchased it from the official website, you may use it for your own projects,
 * but you may not resell it or publish it publicly.
 * 
 * Website: https://nikandr.com
 * YouTube: https://www.youtube.com/@NikandrSurkov
 * Telegram: https://t.me/nikandr_s
 * Telegram channel for news/updates: https://t.me/clicker_game_news
 * GitHub: https://github.com/nikandr-surkov
 */

import { NextResponse } from 'next/server';

const licenseInfo = `
This project was developed by Nikandr Surkov.
You may not use this code if you purchased it from any source other than the official website https://nikandr.com.
If you purchased it from the official website, you may use it for your own projects,
but you may not resell it or publish it publicly.

Website: https://nikandr.com
YouTube: https://www.youtube.com/@NikandrSurkov
Telegram: https://t.me/nikandr_s
Telegram channel for news/updates: https://t.me/clicker_game_news
GitHub: https://github.com/nikandr-surkov
`;

export async function GET(req: Request) {
  return NextResponse.json({ 
    license: licenseInfo.trim(),
    version: '1.0.0',
    lastUpdated: '2024-08-20'
  }, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}