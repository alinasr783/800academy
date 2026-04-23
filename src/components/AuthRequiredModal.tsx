"use client";

import Link from "next/link";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthRequiredModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-primary/20 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-[2.5rem] shadow-premium max-w-md w-full p-10 sm:p-12 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        
        <div className="relative text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-primary text-4xl">account_circle</span>
          </div>
          
          <h2 className="font-headline text-3xl font-extrabold text-primary tracking-tight mb-4">
            Account Required
          </h2>
          
          <p className="text-on-surface-variant font-medium leading-relaxed mb-10">
            To complete your checkout and access your exams, you need to have an account at 800 Academy.
          </p>
          
          <div className="space-y-4">
            <Link
              href={`/join?mode=signup&next=${encodeURIComponent(window.location.pathname)}`}
              className="block w-full bg-primary text-white py-5 rounded-full font-bold text-lg hover:bg-secondary hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Create Account
            </Link>
            
            <Link
              href={`/join?mode=login&next=${encodeURIComponent(window.location.pathname)}`}
              className="block w-full bg-white text-primary border border-outline/50 py-5 rounded-full font-bold text-lg hover:bg-surface-variant transition-all"
            >
              Log In
            </Link>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-8 text-sm font-bold text-on-surface-variant/60 hover:text-primary transition-colors"
          >
            Not now, keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}
