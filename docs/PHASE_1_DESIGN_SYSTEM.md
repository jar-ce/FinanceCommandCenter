# FINANCE COMMAND CENTER
## Phase 1 Design System & Visual Identity Specification

---

### 1. Product Personality & Brand Direction

**Finance Command Center** is designed as a high-density, professional financial operating system. Its visual and interaction identity reflects **Command, Precision, Transparency, and Speed**.

#### Core Personality Pillars:
- **Command Deck Clarity**: Important financial numbers, ledger balances, P&L figures, and market updates take immediate visual priority without unnecessary decorative clutter.
- **High Information Density**: Built for efficient scanning with structured tabular alignments, crisp typography, and subtle panel borders.
- **Cohesive Operating System**: Khata, IPOs, Stocks, Portfolio, Alerts, and Reports operate as unified facets of a single control deck rather than disparate tools.

#### Brand Identity Concepts:
- **Working Name**: `FINANCE COMMAND CENTER` (Brand Codename: **APEX OS**)
- **Visual Metaphor**: *Flight Control Radar meets High-Frequency Financial Desk* — clean grid structures, monospaced numerical alignments, subtle dark glassmorphism, and instant keyboard-driven interactions.

---

### 2. Semantic Color Architecture

The color system is engineered for long-session readability, high data contrast, and compliance with WCAG 2.1 AA accessibility standards in both Dark and Light modes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DARK MODE COLOR TOKENS                           │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ Background: #0F131C   │ │ Surface Base: #181D29 │ │ Elevated: #222736 │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ Primary:    #3B82F6   │ │ Accent Teal:  #14B8A6 │ │ Border:   #2C3345 │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ Profit/Credit: #10B981│ │ Loss/Debit:   #F43F5E │ │ Warning:  #F59E0B │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Token Palette Definitions:

| Token Name | Dark Mode Value | Light Mode Value | Semantic Role / Usage |
| :--- | :--- | :--- | :--- |
| `color.bg.app` | `hsl(222, 24%, 9%)` (`#0F131C`) | `hsl(210, 40%, 98%)` (`#F8FAFC`) | Main application viewport background |
| `color.bg.surface` | `hsl(222, 20%, 13%)` (`#181D29`) | `hsl(0, 0%, 100%)` (`#FFFFFF`) | Main panel cards, sidebar, table containers |
| `color.bg.elevated` | `hsl(222, 18%, 17%)` (`#222736`) | `hsl(214, 32%, 93%)` (`#E2E8F0`) | Modals, dropdown menus, tooltips, popovers |
| `color.brand.primary` | `hsl(217, 91%, 60%)` (`#3B82F6`) | `hsl(221, 83%, 53%)` (`#2563EB`) | Primary action buttons, active navigation items |
| `color.brand.accent` | `hsl(172, 66%, 50%)` (`#14B8A6`) | `hsl(173, 80%, 40%)` (`#0D9488`) | Secondary highlights, metrics indicators |
| `color.text.primary` | `hsl(210, 40%, 98%)` (`#F8FAFC`) | `hsl(222, 47%, 11%)` (`#0F172A`) | Primary headings, table text, main numbers |
| `color.text.secondary` | `hsl(215, 20%, 65%)` (`#94A3B8`) | `hsl(215, 16%, 47%)` (`#64748B`) | Subtitles, labels, table column headers |
| `color.text.muted` | `hsl(215, 15%, 45%)` (`#64748B`) | `hsl(215, 16%, 65%)` (`#94A3B8`) | Disabled text, footers, subtle timestamps |
| `color.border` | `hsl(217, 19%, 24%)` (`#2C3345`) | `hsl(214, 32%, 91%)` (`#E2E8F0`) | Component outlines, panel borders |
| `color.positive` | `hsl(158, 64%, 52%)` (`#10B981`) | `hsl(158, 76%, 36%)` (`#059669`) | Khata Credit, Stock Gain, Realized Profit |
| `color.negative` | `hsl(350, 89%, 60%)` (`#F43F5E`) | `hsl(350, 84%, 54%)` (`#E11D48`) | Khata Debit, Stock Loss, Realized Loss |
| `color.warning` | `hsl(38, 92%, 50%)` (`#F59E0B`) | `hsl(38, 92%, 50%)` (`#D97706`) | Active IPO status, Alerts, Caution states |
| `color.info` | `hsl(199, 89%, 48%)` (`#0EA5E9`) | `hsl(199, 89%, 48%)` (`#0284C7`) | General notices, system updates |
| `color.focus` | `hsl(217, 91%, 60%)` (`#3B82F6`) | `hsl(221, 83%, 53%)` (`#2563EB`) | Accessibility keyboard focus rings |

---

### 3. Typography System

The typography scale utilizes **Inter** for structural labels and UI interfaces, paired with **JetBrains Mono** for numerical values, financial figures, transaction ledgers, and tabular data.

#### Numeric Scanning Rule:
All financial data tables, stock prices, P&L numbers, and Khata balances must use:
```css
font-variant-numeric: tabular-nums lining-nums;
font-family: var(--font-mono);
```

#### Typography Scale:

| Scale Level | Font Family | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | Inter | `32px` (`2rem`) | `1.2` | `700 Bold` | Main Dashboard Greeting, Major KPI Value |
| `h1` | Inter | `24px` (`1.5rem`) | `1.3` | `600 SemiBold` | Section Page Titles |
| `h2` | Inter | `20px` (`1.25rem`) | `1.4` | `600 SemiBold` | Card Headers, Panel Titles |
| `h3` | Inter | `16px` (`1rem`) | `1.4` | `500 Medium` | Sub-panel titles, Table Header Labels |
| `body` | Inter | `14px` (`0.875rem`) | `1.5` | `400 Regular` | General UI Text, Input Text, Notes |
| `small` | Inter | `12px` (`0.75rem`) | `1.5` | `400 Regular` | Secondary Metadata, Badges, Labels |
| `num-hero` | JetBrains Mono | `28px` (`1.75rem`) | `1.2` | `700 Bold` | Portfolio Net Worth, Total Khata Balance |
| `num-card` | JetBrains Mono | `20px` (`1.25rem`) | `1.3` | `600 SemiBold` | Card KPIs, Stock LTP, P&L Totals |
| `num-table` | JetBrains Mono | `13px` (`0.8125rem`) | `1.4` | `500 Medium` | Data Table Cells, Ledger Amounts, Rates |

---

### 4. Spacing, Shapes & Surface Language

#### Spacing Grid Scale (Base: 4px)
`space-1`: `4px` | `space-2`: `8px` | `space-3`: `12px` | `space-4`: `16px` | `space-6`: `24px` | `space-8`: `32px` | `space-12`: `48px` | `space-16`: `64px`

#### Shape & Border Radii
- `radius-sm`: `4px` (Table cells, status badges, code snippets)
- `radius-md`: `8px` (Form inputs, buttons, dropdown menus, modals)
- `radius-lg`: `12px` (Main panel cards, feature section containers)
- `radius-pill`: `9999px` (Avatars, pill tags)

#### Surface Elevation & Borders
Avoid excessive floating cards or layered drop shadows. Use subtle `1px` structural borders (`var(--color-border)`) and clean background contrast to establish hierarchy:
- Base Surface: `background: var(--color-bg-surface); border: 1px solid var(--color-border);`
- Hover Surface: `background: var(--color-bg-elevated); border-color: var(--color-brand-primary);`

---

### 5. Navigation & Layout Architecture

The navigation concept consists of a **Command Rail** (Left Navigation) paired with a top **Command Deck Bar**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ COMMAND DECK: [Logo] [Search / Cmd+K...] [Market Status] [Quick Actions]   │
├──────────────┬──────────────────────────────────────────────────────────────┤
│ COMMAND RAIL │ SECTION BREADCRUMB & CONTEXTUAL ACTIONS                      │
│ [Dashboard]  ├──────────────────────────────────────────────────────────────┤
│ [Khata]      │ MAIN CONTENT WORKSPACE                                       │
│ [IPO Center] │                                                              │
│ [Stocks]     │                                                              │
│ [Portfolio]  │                                                              │
│ [Alerts]     │                                                              │
│ [Reports]    │                                                              │
├──────────────┤                                                              │
│ [Settings]   │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

- **Global Command Palette (`Ctrl+K`)**: Instant overlay search allowing users to type commands to navigate to any Khata party, Stock ticker, IPO listing, or Report.
- **Contextual Action Bar**: Header section containing page-specific actions (e.g., "+ Add Party", "+ Log Trade", "Check Allotment", "Export PDF").

---

### 6. Dashboard Architecture ("Financial Command Center")

The Dashboard prioritizes critical financial metrics across all domain modules into a single control panel:

1. **Top Metric Strip (Executive Matrix)**:
   - Total Net Worth & Portfolio Value (with Day Change % & Realized/Unrealized P&L split)
   - Total Khata Receivable vs Payable Net Balance
   - Active & Upcoming IPO Summary Indicator
   - Live Market Index Tickers (NIFTY 50 / SENSEX)

2. **Main Split Deck**:
   - *Left Deck (Stock & Portfolio Focus)*: Top Holdings performance, Active Watchlist highlights, Market Gainers/Losers.
   - *Right Deck (Khata & Operations Focus)*: Outstanding Ledger Payment Reminders, Recent Khata Transactions, Upcoming IPO Bidding Dates.

---

### 7. Core Module UX Concepts

#### 7.1 Digital Khata UX
- **Split Ledger View**: Left panel lists Parties (Customers/Suppliers) sorted by net balance; Right panel shows the active party's chronological ledger statement.
- **Clear Transaction Controls**: Distinct Green (+ Credit / You Gave) and Red (- Debit / You Got) posting buttons with mandatory amount, date, and description fields.
- **Statement & Reminders**: One-click PDF/CSV statement download and automated SMS/WhatsApp payment reminder triggers.

#### 7.2 IPO Center UX
- **Pipeline Kanban / Calendar Tabs**: Categorized by `Upcoming`, `Open Now`, `Closed`, and `Recently Listed`.
- **IPO Detail Card**: Clear breakdown of Price Band (₹), Lot Size, Issue Size, Bidding Dates, GMP indicator (where available), and Subscription Multiples.
- **Allotment Verification Modal**: Direct status check for public exchange feeds; guided registrar redirect modal for Link Intime, KFintech, and Bigshare with copyable Application/PAN numbers.

#### 7.3 Stocks & Market Data UX
- **Trading Desk Layout**: Integrated TradingView candlestick/line chart header, live LTP badge, 52-week high/low range bar, OHLC metrics table, and fundamentals summary.
- **Instant Watchlist Action**: One-click star icon to add/remove symbols from personal watchlists.

#### 7.4 Portfolio & P&L UX
- **P&L Breakdown Grid**: Clear visual separation of:
  - *Invested Amount* (₹)
  - *Current Value* (₹)
  - *Realized P&L* (Profit/Loss from closed positions)
  - *Unrealized P&L* (Mark-to-market open positions)
  - *Overall Return %*
- **Holdings Table**: Resizable columns showing Symbol, Qty, Avg Buy Price, LTP, Current Value, Day P&L, and Total P&L.

---

### 8. Reusable Component Inventory & Table System

#### 8.1 Table System Architecture
Tables are the backbone of Finance Command Center. The table component system includes:
- **User-Resizable Columns**: Interactive drag handles on table header borders.
- **Numeric Column Alignment**: Right-aligned numeric data cells (`text-align: right; font-family: var(--font-mono);`).
- **Sticky Table Headers**: Headers remain visible during long scrolling.
- **Row Action Controls**: Quick inline action buttons on hover (Edit, View, Delete, Log Trade).
- **Empty / Loading / Error States**: Custom skeleton loaders, zero-data illustrations, and retry prompts.

#### 8.2 Component Inventory Categories
1. **Navigation**: Command Rail, Command Deck Bar, Command Palette (`Ctrl+K`), Tabs.
2. **Data Entry**: Input, Select, Currency Input, DatePicker, Checkbox, Switch.
3. **Data Display**: Data Table, Metric Card, Badge, Status Indicator, Financial Stat Box.
4. **Feedback**: Toast Notifications, Alert Banners, Skeleton Loaders, Empty States, Modal Dialogs.

---

### 9. Design Tokens Specification

The design tokens are codified into standard CSS Custom Properties:

```css
:root {
  /* Color Palette - Dark Mode Defaults */
  --color-bg-app: #0F131C;
  --color-bg-surface: #181D29;
  --color-bg-elevated: #222736;
  --color-brand-primary: #3B82F6;
  --color-brand-accent: #14B8A6;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
  --color-text-muted: #64748B;
  --color-border: #2C3345;
  --color-positive: #10B981;
  --color-negative: #F43F5E;
  --color-warning: #F59E0B;
  --color-info: #0EA5E9;
  --color-focus: #3B82F6;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;

  /* Motion */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Z-Indexes */
  --z-base: 0;
  --z-sticky: 100;
  --z-dropdown: 200;
  --z-modal: 500;
  --z-toast: 1000;
}
```

---

### 10. Accessibility & Motion Philosophy

- **Keyboard First**: Every interactive element (buttons, table rows, tabs, inputs, command palette) is navigable via `Tab`, `Arrow keys`, `Enter`, and `Escape`.
- **Focus Rings**: High-visibility `2px solid var(--color-focus)` outline with `2px` offset.
- **Restrained Motion**: Animations limited to micro-interactions (modal fade-in `150ms`, tab indicator slide `200ms`, button click scale `98%`). Full support for `@media (prefers-reduced-motion: reduce)`.
- **Contrast Ratios**: Minimum contrast ratio of 4.5:1 for standard text and 3:1 for large display metrics against background surfaces.

---

### 11. Phase 1 Deliverable Files

The Phase 1 design system specification and tokens have been recorded in the workspace documentation:
- [`docs/PHASE_1_DESIGN_SYSTEM.md`](file:///D:/FinanceCommandCenter/docs/PHASE_1_DESIGN_SYSTEM.md)

---

*Specification authored by Senior UI/UX & Design Architecture Team.*
