"use client";

import { useEffect, useRef, useCallback } from "react";

interface LetterGlitchProps {
  text?: string;
  glitchColors?: string[];
  glitchSpeed?: number;
  className?: string;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>{}[]";

export default function LetterGlitch({
  text = "",
  glitchColors = ["#84cc16", "#22c55e", "#14b8a6"],
  glitchSpeed = 80,
  className = "",
}: LetterGlitchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    // Throttle to ~12fps for performance
    if (time - lastFrameRef.current < glitchSpeed) {
      animationRef.current = requestAnimationFrame((t) => draw(ctx, width, height, t));
      return;
    }
    lastFrameRef.current = time;

    ctx.fillStyle = "rgba(10, 10, 10, 0.92)";
    ctx.fillRect(0, 0, width, height);

    const fontSize = 14;
    const cols = Math.floor(width / (fontSize * 0.65));
    const rows = Math.floor(height / fontSize);

    ctx.font = `${fontSize}px monospace`;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * fontSize * 0.65;
        const y = (row + 1) * fontSize;

        // Randomly decide what to render
        const rand = Math.random();

        if (rand < 0.03) {
          // Glitch character — bright color
          ctx.fillStyle = glitchColors[Math.floor(Math.random() * glitchColors.length)];
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y);
        } else if (rand < 0.15) {
          // Dim character
          ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "132, 204, 22" : "100, 100, 100"}, ${0.05 + Math.random() * 0.15})`;
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y);
        }
      }
    }

    // Render centered text if provided
    if (text) {
      const textFontSize = Math.min(width * 0.08, 48);
      ctx.font = `bold ${textFontSize}px monospace`;
      ctx.textAlign = "center";

      // Glitch offset
      const offsetX = (Math.random() - 0.5) * (Math.random() > 0.95 ? 8 : 0);
      const offsetY = (Math.random() - 0.5) * (Math.random() > 0.95 ? 4 : 0);

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillText(text, width / 2 + 2, height / 2 + 2);

      // Main text
      ctx.fillStyle = Math.random() > 0.97
        ? glitchColors[Math.floor(Math.random() * glitchColors.length)]
        : "#e5e5e5";
      ctx.fillText(text, width / 2 + offsetX, height / 2 + offsetY);

      ctx.textAlign = "start";
    }

    // Occasional scanline effect
    if (Math.random() > 0.97) {
      const scanY = Math.random() * height;
      ctx.fillStyle = `rgba(132, 204, 22, 0.04)`;
      ctx.fillRect(0, scanY, width, 2);
    }

    animationRef.current = requestAnimationFrame((t) => draw(ctx, width, height, t));
  }, [text, glitchColors, glitchSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    animationRef.current = requestAnimationFrame((t) => draw(ctx, canvas.width, canvas.height, t));

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
