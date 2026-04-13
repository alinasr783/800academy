"use client";

import { useEffect } from "react";

export default function SubjectScrollToExams({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const el = document.getElementById("exams-library");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [enabled]);

  return null;
}

