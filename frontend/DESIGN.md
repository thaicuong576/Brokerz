---
name: Brokerz Terminal
version: 0.1
principle: Quiet surface, sharp data, obvious state, restrained action.

colors:
  background: "#020617"
  surface: "#0F172A"
  surfaceRaised: "#111827"
  surfaceMuted: "#1E293B"
  border: "#243244"
  textPrimary: "#E5E7EB"
  textSecondary: "#94A3B8"
  textMuted: "#64748B"
  brand: "#F97316"
  brandHover: "#FB923C"
  action: "#F97316"
  actionHover: "#FB923C"
  marketUp: "#22C55E"
  marketDown: "#EF4444"
  marketReference: "#FACC15"
  warning: "#F59E0B"

typography:
  ui:
    fontFamily: Inter, Segoe UI, Roboto, Arial, sans-serif
  compact:
    fontFamily: Segoe UI, Inter, Roboto, Arial, sans-serif
    usage: Market numbers, tickers, badges, ratios, and compact tables. Do not use condensed or narrow fonts.
  h1:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 700
  h2:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 700
  body:
    fontSize: 0.8125rem
    lineHeight: 1.5
  label:
    fontSize: 0.625rem
    fontWeight: 700

layout:
  pageMaxWidth: 1440px
  pagePaddingDesktop: 20px
  pagePaddingMobile: 12px
  gridGap: 12px
  density: compact

components:
  card:
    backgroundColor: "{colors.surfaceRaised}"
    borderColor: "{colors.border}"
    rounded: 4px
    padding: 12px
    shadow: none
  buttonPrimary:
    backgroundColor: "{colors.action}"
    color: "#020617"
    rounded: 4px
    fontWeight: 700
  buttonSecondary:
    backgroundColor: "{colors.background}"
    borderColor: "{colors.border}"
    color: "{colors.textPrimary}"
    rounded: 4px
  badge:
    rounded: 4px
    fontFamily: "{typography.compact.fontFamily}"
    fontSize: 0.5625rem
  dashboardCard:
    minHeight: 168px
    numericFont: "{typography.compact.fontFamily}"
---

## Overview

Bloomberg terminal meets modern fintech minimalism.

Brokerz should feel like a professional market workstation, not a lending campaign page. The interface should be compact, calm, and precise. Trust comes from clear state, source transparency, and predictable workflows rather than large marketing blocks or decorative effects.

## Design Rules

1. Use dark neutral surfaces as the dominant visual system.
2. Use orange as the brand/action color for navigation, focus, and primary workflow buttons.
3. Use green only for positive market movement, success states, and confirmed live market state.
4. Use red, green, and yellow strictly for market semantics unless a component explicitly needs status color.
5. Keep dashboard cards flat: thin border, no glow, no heavy shadow.
6. Use regular-width sans plus tabular numerals for tickers, prices, percentages, volume, and ratios. Avoid condensed/narrow number fonts.
7. Avoid fake metrics, decorative finance widgets, oversized hero text, and uppercase-heavy copy.
8. Source labels should be available but quiet: `LIVE`, `TEMP`, `SRC`, `EOD`.
9. Daily brief content should be readable in compact editorial blocks, not one giant wall of bold text.
10. Mobile should prioritize task order over preserving desktop density.

## Dashboard Structure

1. Compact terminal header: workspace, role, data freshness.
2. Market summary row: VNINDEX, liquidity, breadth, foreign net.
3. Daily brief panel: draft/published state, scrollable content.
4. Analysis grid: top impact, sectors, foreign flow.
5. Broker actions: generate, save, publish, audit trail.

## Landing Structure

1. Compact hero with one value proposition.
2. Trust strip: broker approval, source transparency, workspace security.
3. Broker workflow: draft, review, publish.
4. Investor workflow: read, track, ask.
5. Data integrity: DNSE, SSI, source labels.
6. Final CTA.

## Anti-Patterns

- No neon/cyan glow.
- No giant dashboard hero.
- No large conversion-style orange CTAs inside operational screens.
- No deeply rounded cards or nested card stacks.
- No decorative fake market modules with made-up numbers.
- No long source labels repeated inside every card.
