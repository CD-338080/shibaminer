// app/page.tsx

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

'use client'

import Image from 'next/image';
import { mainCharacter } from '@/images';
import IceCube from '@/icons/IceCube';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="bg-[#1d2025] flex justify-center items-center h-screen">
      <div className="w-full max-w-xl text-white flex flex-col items-center">
        <div className="w-64 h-64 rounded-full circle-outer p-2 mb-8">
          <div className="w-full h-full rounded-full circle-inner overflow-hidden relative">
            <Image
              src={mainCharacter}
              alt="Main Character"
              fill
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                transform: 'scale(1.05) translateY(10%)'
              }}
            />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Welcome to TonIce</h1>
        
        <p className="text-xl mb-2">The game is on the <Link href="/clicker" className="underline">Clicker</Link> page.</p>
        <p className="text-xl mb-6">Developed by <Link href="https://www.youtube.com/@NikandrSurkov" target="_blank" className="underline">Nikandr Surkov</Link>.</p>
        
        <div className="flex items-center space-x-2">
          <IceCube className="w-8 h-8 animate-pulse" />
          <IceCube className="w-8 h-8 animate-pulse delay-100" />
          <IceCube className="w-8 h-8 animate-pulse delay-200" />
        </div>
      </div>
    </div>
  );
}
