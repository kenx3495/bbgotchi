import React from 'react';

interface AvatarProps {
  size?: number;
  className?: string;
}

export const SharkwowAvatar: React.FC<AvatarProps> = ({ size = 120, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    className={className}
    style={{ borderRadius: '50%' }}
  >
    {/* Background */}
    <circle cx="60" cy="60" r="58" fill="#E3F2FD" />

    {/* Shark suit body */}
    <ellipse cx="60" cy="70" rx="35" ry="40" fill="#607D8B" />

    {/* Shark suit belly */}
    <ellipse cx="60" cy="75" rx="22" ry="28" fill="#ECEFF1" />

    {/* Shark fin */}
    <path d="M60 20 L70 45 L50 45 Z" fill="#607D8B" />

    {/* Cat face */}
    <circle cx="60" cy="55" r="22" fill="#FFE0B2" />

    {/* Cat ears */}
    <path d="M42 40 L38 25 L50 35 Z" fill="#FFE0B2" />
    <path d="M78 40 L82 25 L70 35 Z" fill="#FFE0B2" />
    <path d="M43 38 L40 28 L49 36 Z" fill="#FFAB91" />
    <path d="M77 38 L80 28 L71 36 Z" fill="#FFAB91" />

    {/* Eyes */}
    <ellipse cx="52" cy="52" rx="5" ry="6" fill="#263238" />
    <ellipse cx="68" cy="52" rx="5" ry="6" fill="#263238" />
    <circle cx="53" cy="50" r="2" fill="white" />
    <circle cx="69" cy="50" r="2" fill="white" />

    {/* Nose */}
    <ellipse cx="60" cy="60" rx="3" ry="2" fill="#F48FB1" />

    {/* Mouth */}
    <path d="M54 64 Q60 68 66 64" stroke="#263238" strokeWidth="1.5" fill="none" strokeLinecap="round" />

    {/* Whiskers */}
    <line x1="35" y1="58" x2="48" y2="60" stroke="#BDBDBD" strokeWidth="1" />
    <line x1="35" y1="62" x2="48" y2="62" stroke="#BDBDBD" strokeWidth="1" />
    <line x1="72" y1="60" x2="85" y2="58" stroke="#BDBDBD" strokeWidth="1" />
    <line x1="72" y1="62" x2="85" y2="62" stroke="#BDBDBD" strokeWidth="1" />

    {/* Shark teeth on suit */}
    <path d="M38 85 L42 92 L46 85 L50 92 L54 85" stroke="white" strokeWidth="2" fill="none" />
    <path d="M66 85 L70 92 L74 85 L78 92 L82 85" stroke="white" strokeWidth="2" fill="none" />
  </svg>
);

export default SharkwowAvatar;
