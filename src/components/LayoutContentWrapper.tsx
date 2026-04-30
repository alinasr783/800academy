"use client";

import { useEffect, useState } from "react";

export default function LayoutContentWrapper({ children }: { children: React.ReactNode }) {
  const [isAppMode, setIsAppMode] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsAppMode(localStorage.getItem("isAppMode") === "true");
    };
    check();
    window.addEventListener("appModeChange", check);
    return () => window.removeEventListener("appModeChange", check);
  }, []);

  return (
    <main className={`transition-all duration-300 ${isAppMode ? 'lg:pl-[72px] pt-16' : 'pt-20'}`}>
      {children}
    </main>
  );
}
