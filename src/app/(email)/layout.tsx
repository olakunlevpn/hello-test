"use client";

import {
  FluentProvider,
  webLightTheme,
} from "@fluentui/react-components";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function EmailLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <FluentProvider theme={webLightTheme} style={{ height: "100vh" }}>
        {children}
      </FluentProvider>
    </SessionProvider>
  );
}
