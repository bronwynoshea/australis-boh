import React from 'react';

interface AnimatedBackgroundBlobsProps {
  theme?: 'dark' | 'light';
}

const brandColorClasses = [
  'bg-brand-journey/15 dark:bg-brand-journey/25',
  'bg-brand-cafe/20 dark:bg-brand-cafe/30',
  'bg-brand-dna/15 dark:bg-brand-dna/25',
  'bg-brand-coach/15 dark:bg-brand-coach-dark/25',
  'bg-brand-mentor/15 dark:bg-brand-mentor/25',
];

/**
 * Layer 2: Static Blobs
 * Renders absolutely positioned, blurred circles with brand colors.
 */
const AnimatedBackgroundBlobs: React.FC<AnimatedBackgroundBlobsProps> = ({ theme }) => {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Journey blob - top left */}
      <div className={`absolute -top-16 -left-16 w-48 h-48 md:w-80 md:h-80 rounded-full filter blur-2xl md:blur-3xl opacity-70 ${brandColorClasses[0]}`}></div>
      
      {/* Cafe blob - top right */}
      <div className={`absolute -top-8 right-0 w-40 h-40 md:w-72 md:h-72 rounded-full filter blur-2xl md:blur-3xl opacity-70 ${brandColorClasses[1]}`}></div>
      
      {/* DNA blob - bottom left */}
      <div className={`absolute -bottom-24 left-10 w-56 h-56 md:w-96 md:h-96 rounded-full filter blur-2xl md:blur-3xl opacity-70 ${brandColorClasses[2]}`}></div>
      
      {/* Coach blob - bottom right */}
      <div className={`absolute -bottom-12 -right-12 w-48 h-48 md:w-80 md:h-80 rounded-full filter blur-2xl md:blur-3xl opacity-70 ${brandColorClasses[3]}`}></div>
      
      {/* Mentor blob - center right */}
      <div className={`absolute top-1/2 right-1/4 w-32 h-32 md:w-56 md:h-56 rounded-full filter blur-xl md:blur-2xl opacity-70 ${brandColorClasses[4]}`}></div>
    </div>
  );
};

export default AnimatedBackgroundBlobs;