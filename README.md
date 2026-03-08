# KingMe - Financial Freedom Tracker

A cross-platform app (iOS, Android, Web) that tracks your path to financial freedom. KingMe measures freedom in **days** — how long can your asset income sustain your lifestyle without working?

When your passive income covers all your obligations, you're **KINGED** — financially free.

## Core Concept

```
Freedom Score = Asset Income / Daily Needs
```

Track every income stream, obligation, debt, and asset in one place. KingMe shows you exactly where you stand and what moves to make next.

## Features

### Financial Dashboard
- **Freedom Score** with visual progression through 5 stages (Drowning to Enthroned)
- **Cash flow analysis** per bank account — see where every dollar goes
- **Payment calendar** with upcoming bills and due dates
- **Portfolio trend tracking** with daily snapshots and sparkline charts
- **Net worth calculator** across all asset classes

### Asset Tracking
- **Solana wallet sync** — auto-detect tokens, DeFi positions, staking (via Helius)
- **Stocks & brokerage** accounts with live market prices
- **Real estate** with rental income and primary residence tracking
- **Retirement accounts** (401k, IRA, Roth)
- **Crypto portfolio** with live pricing via CoinGecko
- **Business assets** with revenue tracking

### Income & Cash Flow
- **Multiple income sources** — salary, trading, business, rental, dividends
- **Paycheck breakdown** — gross to net with pre-tax deductions, taxes, post-tax
- **Trading income tracking** with Drift perps integration
- **Yield farming & DeFi income** tracking

### Smart Scenarios ("What-If")
- **AI-generated recommendations** based on your financial profile
- Invest idle cash, stake crypto, debt payoff (avalanche), refinance opportunities
- Perena USD* yield, Kamino lending, HYSA transfers
- Side hustle & business suggestions for income-constrained users
- Debt waterfall strategy and obligations audit for high-debt users
- Real-time Jupiter swap quotes for on-chain scenarios

### Trading & DeFi
- **Trading Tracker** — log trades, track PnL, allocate profits to goals
- **Drift integration** — sync perps history, positions, and assets from on-chain
- **Jupiter swaps** — execute token swaps directly from scenario recommendations
- **Kamino lending** — deposit/withdraw from lending vaults
- **Accumulation plans** — DCA targets with cost basis tracking
- **Watchlist** with entry targets, alerts, and price tracking (12+ tokens)

### Alerts & Insights
- **Position alerts** — take profit, stop loss, buy the dip, deploy idle capital
- **Watchlist alerts** — entry targets hit, tokens running hot
- **Trade insights** — pattern analysis on your trading history
- **Thesis alerts** — track investment theses and get notified on deviations
- **Windfall detection** — large deposits trigger deployment planning
- **Spending gap alerts** — flag discrepancies in spending vs obligations

### Planning Tools
- **Goal tracker** with progress and reachability scoring
- **Desire planner** — AI-powered research and action plans (Claude API)
- **Business dashboard** — revenue, expenses, profit tracking
- **Divorce simulator** — asset division scenario analysis
- **Bank consolidation analysis** — optimize across accounts
- **Companionship expense tracking**

### Gamification
- **Achievement badges** — unlock badges for financial milestones
- **5 freedom stages** with avatar progression
- **Demo personas** — try the app with 7 pre-built financial profiles

## Freedom Stages

| Freedom | State | Description |
|---------|-------|-------------|
| < 30 days | **Drowning** | Living paycheck to paycheck |
| 30-180 days | **Struggling** | Building a buffer |
| 180-730 days | **Breaking Surface** | Real runway emerging |
| 730-3650 days | **Rising** | Multi-year freedom |
| 3650+ days | **KINGED** | Passive income covers everything |

## Demo Personas

Try the app instantly with pre-built profiles spanning every financial state:

| Persona | State | Description |
|---------|-------|-------------|
| Broke College Student | Barely surviving (+$37/mo) | Part-time barista, student loans, meme coins |
| Paycheck to Paycheck | Underwater (-$175/mo) | Warehouse worker, sinking slowly |
| Comfortable Middle Class | Stable | Homeowner, 401k, Solana DeFi positions |
| Crypto Trader | Volatile (-$850 bad month) | Full-time degen, asset-rich but cash-poor |
| High Earner, High Debt | Stretched thin | $200K income eaten by lifestyle inflation |
| Millionaire Next Door | Comfortable | Paid-off house, rental income, index funds |
| KINGED | Financially free | Passive income exceeds all expenses |

## Tech Stack

- **React Native** (Expo) — iOS, Android, Web
- **Expo Router** — file-based routing
- **TypeScript** — full type safety
- **Zustand** — state management with AsyncStorage persistence
- **Solana Web3.js** — blockchain integration
- **Mobile Wallet Adapter** — Phantom, Solflare, Backpack
- **Helius API** — enriched Solana wallet data
- **Jupiter Aggregator** — token swaps via Vercel edge functions
- **Drift Protocol** — perps trading, spot swaps, withdrawals
- **Kamino Finance** — lending vaults
- **Perena** — USD* stablecoin yield
- **Claude API** (Anthropic) — AI-powered planning and research
- **CoinGecko** — live crypto prices
- **CryptoJS + NaCl** — encrypted local storage
- **Vercel** — API edge functions and hosting

## Project Structure

```
KingMe/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Main tab navigation (dashboard, income, assets, obligations, debts, desires)
│   ├── onboarding/         # 11-step onboarding flow
│   ├── asset/[id].tsx      # Asset detail
│   ├── bank/[id].tsx       # Bank account detail
│   ├── debt/[id].tsx       # Debt detail
│   ├── trading.tsx         # Trading tracker
│   ├── watchlist.tsx       # Token watchlist
│   ├── goals.tsx           # Goal management
│   ├── spending.tsx        # Spending analytics
│   └── ...                 # 20+ screens
├── src/
│   ├── types/              # TypeScript interfaces
│   ├── store/              # Zustand store
│   ├── services/           # API integrations (25+ services)
│   ├── components/         # UI components (50+)
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Calculations, scenario generator, demo personas
│   └── providers/          # Wallet provider, context
├── api/                    # Vercel edge functions (swap, RPC, AI planning, backup)
└── assets/                 # Images, fonts, animations
```

## Setup

### Prerequisites

- Node.js 18+
- npm
- Expo CLI

### Install & Run

```bash
npm install
npx expo start

# Press 'w' for web, 'i' for iOS simulator, 'a' for Android
```

### Environment Variables

Create a `.env` file:

```
EXPO_PUBLIC_HELIUS_API_KEY=your_helius_key
EXPO_PUBLIC_CLAUDE_API_KEY=your_claude_key
```

## Design Philosophy

- **Dark mode** — clean, data-forward UI
- **Privacy-first** — encrypted local storage, your data stays on your device
- **Actionable** — every insight has a next step
- **Cross-chain ready** — Solana-native with traditional finance integration
- **No nagging** — gentle nudges, respects your intelligence

---

**Get to infinite freedom and sit on your throne** 👑
