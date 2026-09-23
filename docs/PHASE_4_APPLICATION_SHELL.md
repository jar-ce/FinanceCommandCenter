# FINANCE COMMAND CENTER (APEX OS)
## Phase 4 Application Shell & Navigation Specification

---

### 1. Executive Summary

**Phase 4 (Application Shell & Navigation)** establishes the complete frontend application architecture, layout engine, Command Rail navigation sidebar, Command Deck top control bar, global `Ctrl+K` Command Palette overlay, client-side routing across 14 domain section routes, design system token integration, accessible component primitives, and the reusable `ResizableTable` data table foundation for **Finance Command Center (APEX OS)**.

In strict compliance with Phase governance:
- **No business logic or fake data** (no fake ₹1,25,000, no fake +12.45%, no fake stock quotes, no fake IPO numbers) was created.
- All 14 domain routes render clean, visually consistent shell placeholder pages communicating structural readiness.
- Database schemas and backend APIs from Phase 3 remain 100% intact with zero architectural regressions.

---

### 2. Frontend Architecture & Technology Stack

- **Core Framework**: React 19 (`react`, `react-dom`).
- **Routing Engine**: React Router 7 (`react-router-dom`).
- **Build Tooling & Dev Server**: Vite 5 (`vite`, `@vitejs/plugin-react`).
- **Language & Type Strictness**: TypeScript 5 (`tsc`).
- **Icons**: Lucide React (`lucide-react`) vector icons.
- **Styling Architecture**: Vanilla CSS Custom Properties based on Phase 1 Design System (`apps/web/src/styles/tokens.css` and `apps/web/src/styles/global.css`). Zero Tailwind dependency.

#### Layout Component Hierarchy:
```
AppShell (Master Container)
 ├── CommandRail (Primary Navigation Sidebar)
 │    ├── Brand Header ("APEX OS / FINANCE COMMAND")
 │    ├── Collapse/Expand Toggle Button (Chevron)
 │    ├── Navigation Groups (Command Center, Khata, IPO, Markets, Portfolio, Intelligence, System)
 │    └── Rail Footer (Build & Phase Metadata)
 └── Main Viewport Area
      ├── CommandDeck (Top Control Deck Bar)
      │    ├── Breadcrumb Context ("APEX OS / [Active Page]")
      │    ├── Search / Command Palette Trigger Button (Ctrl+K)
      │    ├── System Status Badge (PGlite DB Active)
      │    └── Shell Action Placeholders (Notifications, Profile)
      └── Page Viewport Container (Routes Outlet)
           └── Registered Section Page (e.g. CommandCenterPage, KhataPage, etc.)
 └── GlobalOverlays
      └── CommandPalette (Ctrl+K / Cmd+K Modal Search Dialog)
```

---

### 3. Client-Side Routing Architecture

Client-side routing is configured in [`apps/web/src/App.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/App.tsx) supporting 14 domain section routes + 404 fallback:

| Path | Section Title | Domain Category | Target Phase |
| :--- | :--- | :--- | :--- |
| `/` | Command Center | Command Center | Phase 4 (Shell Ready) |
| `/khata` | Digital Khata | Digital Khata | Phase 5 (Khata Ledgers) |
| `/ipo` | IPO Dashboard | IPO Center | Phase 6 (IPO Center) |
| `/ipo/applications` | IPO Applications | IPO Center | Phase 6 (IPO Center) |
| `/ipo/allotment` | IPO Allotment Checker | IPO Center | Phase 6 (IPO Center) |
| `/markets` | Market Overview | Markets & Stocks | Phase 7 (Markets) |
| `/markets/stocks` | Stocks Explorer | Markets & Stocks | Phase 7 (Markets) |
| `/markets/watchlist` | Watchlist | Markets & Stocks | Phase 7 (Markets) |
| `/portfolio` | Portfolio Holdings | Portfolio & P&L | Phase 8 (Portfolio) |
| `/portfolio/transactions` | Transactions Log | Portfolio & P&L | Phase 8 (Portfolio) |
| `/portfolio/pnl` | P&L Statement | Portfolio & P&L | Phase 8 (Portfolio) |
| `/alerts` | Alerts Intelligence | Intelligence | Phase 9 (Intelligence) |
| `/reports` | Financial Reports | Intelligence | Phase 9 (Intelligence) |
| `/analytics` | Portfolio Analytics | Intelligence | Phase 9 (Intelligence) |
| `/notifications` | System Notifications | System | Shell Placeholder |
| `/settings` | System Settings | System | Shell Placeholder |
| `*` | 404 Route Not Found | Fallback | System Error |

---

### 4. Command Rail Navigation Bar

Implemented in [`apps/web/src/components/shell/CommandRail.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/components/shell/CommandRail.tsx):
- **Visual Style**: High-density financial command console aesthetic (`background: #181D29`, `border-right: 1px solid #2C3345`).
- **Collapsible Behavior**: Smooth CSS width transition between Expanded (`240px`) and Collapsed (`64px`).
- **Active Navigation Indication**: Highlighted active background (`#222736`), bright text (`#F8FAFC`), and primary blue left indicator bar (`3px solid #3B82F6`).
- **Icon Tooltips**: Collapsed mode displays hover/focus tooltips for icon-only navigation links using [`Tooltip.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/components/common/Tooltip.tsx).

---

### 5. Command Deck Header

Implemented in [`apps/web/src/components/shell/CommandDeck.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/components/shell/CommandDeck.tsx):
- **Sticky Control Bar**: Fixed at top (`56px` height) with backdrop blur filter (`backdrop-filter: blur(8px)`).
- **Contextual Breadcrumbs**: Displays current active section name dynamically based on route.
- **Search & Command Trigger**: Interactive button prompting `Search commands, pages... (Ctrl+K)`.
- **System Status Badge**: Integrates [`StatusIndicator.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/components/common/StatusIndicator.tsx) showing real-time backend health (`PGlite DB Active`).

---

### 6. Global Command Palette (`Ctrl+K`)

Implemented in [`apps/web/src/components/shell/CommandPalette.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/components/shell/CommandPalette.tsx):
- **Global Keybinding**: Opens on `Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS) from anywhere in the application.
- **Escape & Backdrop Closing**: Closes on `Escape` key or backdrop click.
- **Instant Search Filtering**: Real-time fuzzy filtering across all 16 navigation commands and categories.
- **Keyboard Navigation**:
  - `ArrowDown` / `ArrowUp`: Move selection highlighted index up and down.
  - `Enter`: Executes selected command, navigates to target route, and closes modal dialog.
- **Accessibility**: ARIA modal dialog markup (`role="dialog"`, `aria-modal="true"`).

---

### 7. Reusable Shell Primitives & Design System Tokens

#### 7.1 Design Tokens Specification (`apps/web/src/styles/tokens.css`):
- **Colors**: Dark mode defaults (`--color-bg-app: #0F131C`, `--color-bg-surface: #181D29`, `--color-bg-elevated: #222736`, `--color-brand-primary: #3B82F6`, `--color-positive: #10B981`, `--color-negative: #F43F5E`).
- **Typography**: Inter for interface labels (`var(--font-sans)`), JetBrains Mono for monospaced values (`var(--font-mono)`).
- **Tabular Numbers Rule**: Applied `.tabular-nums` (`font-variant-numeric: tabular-nums lining-nums; font-family: var(--font-mono)`) for numerical data.

#### 7.2 Component Inventory:
- **`AppShell`**: Master layout container grid.
- **`CommandRail`**: Collapsible left sidebar navigation.
- **`CommandDeck`**: Top header control deck bar.
- **`CommandPalette`**: Global `Ctrl+K` command search overlay.
- **`PageContainer`**: Responsive page wrapper (`max-width: 1600px`).
- **`PageHeader`**: Section page title, description, and phase badge.
- **`StatusIndicator`**: Pulsing system status badge.
- **`IconButton`**: Accessible icon button component.
- **`Tooltip`**: Hover/focus tooltip component.
- **`EmptyState`**: Zero-data illustration & message component.
- **`LoadingState`**: Skeleton loader treatment.
- **`ErrorState`**: System error banner with retry action.

---

### 8. Global Table Foundation (`ResizableTable`)

Implemented in [`apps/web/src/components/common/ResizableTable.tsx`](file:///D:/FinanceCommandCenter/apps/web/src/components/common/ResizableTable.tsx):
- **User-Controlled Column Resizing**: Header borders feature interactive drag handles (`cursor: col-resize`) with mouse drag listener calculating dynamic column widths.
- **Min / Max Column Width Constraints**: Enforces minimum (`60px`) and maximum (`800px`) boundaries per column.
- **Sticky Table Headers**: Headers remain visible during long scrolling (`position: sticky`, `top: 0`, `z-index: 100`).
- **Numeric Alignment & Tabular Nums**: Numeric columns are right-aligned with `tabular-nums lining-nums` monospaced font formatting.
- **State Handling**: Integrates seamlessly with `LoadingState`, `EmptyState`, and `ErrorState`.

---

### 9. Automated Testing & Verification Suite

All 19 monorepo automated tests passed with 100% success across both backend (`apps/api`) and frontend (`apps/web`):

#### 9.1 Backend Tests (`apps/api` - 10 / 10 passed):
1. `financial-precision.test.ts` (4 tests passed): `decimal.js` math, `NUMERIC(18, 4)` formatting, exact multiplication/division, and empirical PGlite database NUMERIC casting/scale rounding.
2. `db-migration.test.ts` (2 tests passed): DDL migration execution and atomic transaction rollback.
3. `repositories.test.ts` (2 tests passed): UserRepository/AuditLogRepository CRUD queries and empirical UUID v4 format verification.
4. `health.test.ts` (2 tests passed): HTTP `/api/v1/health` and `/api/v1/ready` database readiness probe.

#### 9.2 Frontend Tests (`apps/web` - 9 / 9 passed):
1. `shell.test.tsx` (3 tests passed): CommandRail navigation bar rendering, CommandDeck title context, and AppShell main content viewport.
2. `command-palette.test.tsx` (3 tests passed): `Ctrl+K` dialog visibility, real-time search filtering, and `Escape` key close listener.
3. `resizable-table.test.tsx` (3 tests passed): Column header rendering, row data tabular alignment, skeleton LoadingState, and EmptyState handling.

#### 9.3 Static Type Checking:
- `npm run type-check`: **0 errors** across `packages/shared-types`, `apps/api`, and `apps/web`.

#### 9.4 Production Frontend Build:
- Executed `npm run build --workspace=apps/web`:
  - Output: `dist/index.html` (0.85 kB), `dist/assets/index-DEjqn_rA.css` (3.25 kB), `dist/assets/index-1vwZjEvx.js` (315.01 kB).
  - Status: **`✓ built in 15.26s` with 0 errors**.

---

### 10. Manual Visual Verification

The following UI flows were verified in the frontend browser application:
1. **Command Center Landing (`/`)**: High-density operational control deck displaying system node cards and domain navigation matrix table.
2. **Command Rail Navigation**: Smooth collapse to icon-only mode with active route highlight and hover tooltips.
3. **Command Deck Header**: Correct breadcrumb section updates (`APEX OS / [Page]`) across all 14 routes.
4. **Command Palette (`Ctrl+K`)**: Opens instantly on key combination, filters matching commands, moves selection on arrow keys, and executes route navigation on `Enter`.
5. **Resizable Table**: Column drag handles smoothly adjust column widths without layout breaking.
6. **Placeholder Pages**: All 14 section routes render cleanly without fake financial figures or layout shifts.

---

### 11. Known Limitations

- **No Business Logic**: In strict compliance with Phase governance, no financial ledger posting, stock quote ingestion, IPO bidding, or portfolio calculation logic was implemented in Phase 4. All business workflows are deferred to their dedicated future phases.

---

### 🚨 CURRENT STATE & RECOMMENDED NEXT PHASE

**PHASE 4 COMPLETE — WAITING FOR HUMAN APPROVAL**

**Recommended Next Phase**: **PHASE 5 — Digital Khata Module**
*(Implementing Digital Khata database schemas, customer/supplier ledger accounts, debit/credit transaction posting, running balance calculation, and PDF statement generation).*

Waiting for explicit human review and authorization before starting Phase 5.
