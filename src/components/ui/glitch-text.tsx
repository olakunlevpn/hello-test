"use client";

import { useId } from "react";

interface GlitchTextProps {
  text: string;
  className?: string;
  speed?: "slow" | "normal" | "fast";
}

export default function GlitchText({ text, className = "", speed = "normal" }: GlitchTextProps) {
  const id = useId().replace(/:/g, "");
  const dur = speed === "fast" ? "1.5s" : speed === "slow" ? "4s" : "2.5s";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .gt-${id} {
          position: relative;
          display: inline-block;
          font-weight: bold;
        }
        .gt-${id}::before,
        .gt-${id}::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
        }
        .gt-${id}::before {
          color: #84cc16;
          animation: gt-b-${id} ${dur} infinite linear alternate-reverse;
          clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
        }
        .gt-${id}::after {
          color: #22c55e;
          animation: gt-a-${id} ${dur} infinite linear alternate-reverse;
          clip-path: polygon(0 65%, 100% 65%, 100% 100%, 0 100%);
        }
        @keyframes gt-b-${id} {
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(-2px, -1px); }
          60% { transform: translate(2px, 1px); }
          80% { transform: translate(2px, -1px); }
          100% { transform: translate(0); }
        }
        @keyframes gt-a-${id} {
          0% { transform: translate(0); }
          20% { transform: translate(2px, -1px); }
          40% { transform: translate(2px, 1px); }
          60% { transform: translate(-2px, -1px); }
          80% { transform: translate(-2px, 1px); }
          100% { transform: translate(0); }
        }
      `}} />
      <span className={`gt-${id} ${className}`} data-text={text}>
        {text}
      </span>
    </>
  );
}
