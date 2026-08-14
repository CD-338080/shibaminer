'use client';

import Image from 'next/image';
import { IconProps } from '../utils/types';

const ShibaCoin = ({ size = 24, className = '' }: IconProps) => {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        background: '#000',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
      aria-hidden
    >
      <Image
        src="/images/shib-logo.jpg"
        alt=""
        fill
        sizes={`${size}px`}
        style={{ objectFit: 'cover', objectPosition: 'center' }}
        priority={size >= 96}
      />
    </span>
  );
};

export default ShibaCoin;
