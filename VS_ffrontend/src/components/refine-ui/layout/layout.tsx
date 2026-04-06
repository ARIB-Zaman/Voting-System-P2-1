"use client";

import { Header } from "@/components/refine-ui/layout/header";
import { ThemeProvider } from "@/components/refine-ui/theme/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";
import { Sidebar } from "./sidebar";
import {
  AttentionOverlayProvider,
  AttentionOverlay,
} from "@/components/custom/attention-overlay";

export function Layout({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      {/*
        AttentionOverlayProvider wraps EVERYTHING so:
          - Header's "I'm Losing Attention" button can read/write state
          - AttentionOverlay (portal-mounted to body) shares the same state
        This avoids any prop-drilling while keeping the feature self-contained.
      */}
      <AttentionOverlayProvider>
        <SidebarProvider>
          <Sidebar />
          <SidebarInset>
            <Header />
            <main
              className={cn(
                "@container/main",
                "container",
                "mx-auto",
                "relative",
                "w-full",
                "flex",
                "flex-col",
                "flex-1",
                "px-2",
                "pt-4",
                "md:p-4",
                "lg:px-6",
                "lg:pt-6"
              )}
            >
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>

        {/*
          AttentionOverlay renders via React.createPortal to document.body,
          so it floats above ALL content with zero layout impact.
          It must live inside AttentionOverlayProvider to access shared state.
        */}
        <AttentionOverlay />
      </AttentionOverlayProvider>
    </ThemeProvider>
  );
}

Layout.displayName = "Layout";
