import React from 'react';

/**
 * Static background blobs component for full-screen voice experiences
 */
const StaticBackgroundBlobs: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Blob 1 */}
      <div
        className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--module-accent-color, #8B5CF6) 0%, transparent 70%)',
        }}
      />
      {/* Blob 2 */}
      <div
        className="absolute top-1/2 -left-40 w-96 h-96 rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--module-accent-color, #8B5CF6) 0%, transparent 70%)',
        }}
      />
      {/* Blob 3 */}
      <div
        className="absolute -bottom-40 right-1/4 w-72 h-72 rounded-full opacity-10 blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--module-accent-color, #8B5CF6) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};

export default StaticBackgroundBlobs;



