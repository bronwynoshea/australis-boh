import React from 'react';

const AngledLogo: React.FC<{ size?: 'xs' | 'sm' | 'md' | 'lg' | 'login' }> = ({ size = 'lg' }) => {
  const sizes = {
    xs: 'w-8 h-8',
    sm: 'w-11 h-11',
    md: 'w-16 h-16',
    lg: 'w-20 h-20 md:w-24 md:h-24',
    login: 'w-11 h-11 md:w-[4.9rem] md:h-[4.9rem]'
  };
  
  return (
    <div className={`relative flex items-center justify-center ${sizes[size]}`} aria-hidden="true">
      <svg
        viewBox="0 0 96 96"
        className="h-full w-full overflow-visible drop-shadow-[0_18px_28px_rgba(99,92,205,0.3)] transition-transform hover:scale-105"
        fill="none"
      >
        <defs>
          <linearGradient id="slotz-logo-face" x1="22" y1="14" x2="74" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8F7CFF" />
            <stop offset="0.5" stopColor="#635CCD" />
            <stop offset="1" stopColor="#4B3BAA" />
          </linearGradient>
          <linearGradient id="slotz-logo-shine" x1="31" y1="25" x2="67" y2="70" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#D8D2FF" />
          </linearGradient>
        </defs>
        <g transform="rotate(8 48 48)">
          <rect x="17" y="10" width="62" height="76" rx="18" fill="url(#slotz-logo-face)" />
          <rect x="18.5" y="11.5" width="59" height="73" rx="16.5" stroke="white" strokeOpacity="0.2" strokeWidth="3" />
          <path d="M33 30H63" stroke="url(#slotz-logo-shine)" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M29 48H67" stroke="url(#slotz-logo-shine)" strokeWidth="6.5" strokeLinecap="round" strokeOpacity="0.9" />
          <path d="M34 67H62" stroke="url(#slotz-logo-shine)" strokeWidth="6.5" strokeLinecap="round" strokeOpacity="0.72" />
          <circle cx="48" cy="48" r="9.5" fill="#F4F0FF" />
          <circle cx="48" cy="48" r="4.5" fill="#635CCD" fillOpacity="0.72" />
        </g>
      </svg>
    </div>
  );
};

export default AngledLogo;
