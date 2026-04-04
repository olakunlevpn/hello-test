"use client";

import { useState, useEffect } from "react";
import { getRandomLoadingVerb } from "@/lib/loading-verbs";

export function LoadingText({ className }: { className?: string }) {
  const [verb, setVerb] = useState("Loading...");

  useEffect(() => {
    setVerb(getRandomLoadingVerb());
    const interval = setInterval(() => {
      setVerb(getRandomLoadingVerb());
    }, 3000); // Change every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return <span className={className}>{verb}</span>;
}
