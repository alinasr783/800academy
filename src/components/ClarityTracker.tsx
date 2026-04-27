"use client";

import { useEffect } from "react";
import clarity from "@microsoft/clarity";

export default function ClarityTracker() {
  useEffect(() => {
    // Check if the project ID is available
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    
    if (projectId) {
      clarity.init(projectId);
    } else {
      console.warn("Microsoft Clarity Project ID is missing. Please set NEXT_PUBLIC_CLARITY_PROJECT_ID in your environment variables.");
    }
  }, []);

  return null;
}
