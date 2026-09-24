# SF Permit Navigator frontend

React 19 + TypeScript + Vite. Talks to the FastAPI backend through `/api` (see `docs/API_CONTRACT.md`).

```bash
npm run dev        # port 5173, proxies /api to :8000
npm run typecheck
npm run lint
npm test           # or npm run test:watch
npm run build
```

## Layout

```
src/
  types/api.ts          wire shapes from the API contract
  lib/                  pure logic, no React
    api.ts              fetch client, ApiError
    rules.ts            terminal result -> Permit / OtherItem rows
    mermaid.ts          Mermaid source -> SVG, loaded lazily
    summary.ts          summary headline, due lines, site check, fees
    format.ts, dates.ts
  hooks/                state over the lib modules
    useNavigator.ts     intake chat over /api/v1/navigator
    useRuleDiagrams.ts  /rules page: diagram list, selected one as SVG
    useToast.ts, useAlive.ts
  components/
    session/            PermitSession: owns shared state, picks the screen
    intake/             IntakeScreen, ChatMessage, Choices, Composer, Ledger
    summary/            SummaryScreen, SiteCheckCard, PermitCard, OtherList, NotNeededList
    rules/              RulesPage, RulesScreen: the rule engine's flowcharts at /rules/:diagramId?
    layout/             Shell (header + page + small print, around every route but 404), Header, NotFound
    ui/                 Check, Dots, Working, Toast, Staggered
  App.tsx               the route table (React Router); each visit to / remounts PermitSession
tests/                  vitest suites, mirroring src/
  setup.ts              jest-dom matchers, cleanup
  fixtures.ts           shared wire-shape builders
```

Components take plain props and callbacks, so each one renders on its own in a test. Screens don't fetch; hooks do.

## Styling

Each component has its own CSS Module (`Foo.module.css`). `src/styles.css` holds only the design tokens (CSS variables), the reset, keyframes, and a few shared classes (`btn`, `scroll`, `a-rise`, …) that modules pull in with `composes: … from global`. Variants use data attributes (`data-tone`, `data-status`) or ARIA state (`aria-pressed`, `aria-current`), not class juggling.

Inline `style` is a lint error. The one exception is `ui/Staggered.tsx`, which sets a `--i` custom property that stylesheets read for staggered animation delays.
