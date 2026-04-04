"use client";

import { tokens } from "@fluentui/react-components";
import type { StatusColor } from "@/types/account";

const colorMap: Record<StatusColor, string> = {
  green: tokens.colorPaletteGreenForeground1,
  yellow: tokens.colorPaletteYellowForeground1,
  red: tokens.colorPaletteRedForeground1,
};

interface StatusIndicatorProps {
  color: StatusColor;
  size?: number;
}

export default function StatusIndicator({
  color,
  size = 8,
}: StatusIndicatorProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: colorMap[color],
      }}
    />
  );
}
