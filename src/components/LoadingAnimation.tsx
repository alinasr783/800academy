"use client";

import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface LoadingAnimationProps {
  fullScreen?: boolean;
  variant?: 'official' | 'portal' | 'result';
}

const LoadingAnimation = ({ fullScreen = false, variant = 'official' }: LoadingAnimationProps) => {
  // Select URL based on variant
  const lottieSrc = (() => {
    switch (variant) {
      case 'portal':
        return "https://lottie.host/15bb3f04-c632-48f6-b27f-774656975ba1/EkAwJsX8Sm.lottie";
      case 'result':
        return "https://lottie.host/9d9600d4-2a80-4891-a225-14a301ad894e/cpuQbrJCF0.lottie";
      case 'official':
      default:
        return "https://lottie.host/2e99062d-d5e6-42c3-ba21-ec443ef5bb8e/CKc6xquYkO.lottie";
    }
  })();

  const animation = (
    <div className="w-64 h-64 md:w-80 md:h-80">
      <DotLottieReact
        src={lottieSrc}
        loop
        autoplay
      />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-4">
          {animation}
          <div className="text-secondary font-black text-xs uppercase tracking-[0.4em] animate-pulse">
            {variant === 'portal' ? 'Entering Experience...' : 
             variant === 'result' ? 'Calculating Results...' : 
             'Loading Profile...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      {animation}
    </div>
  );
};

export default LoadingAnimation;
