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
    api.ts              fetch client, ApiError, NoPdfTemplateError
    rules.ts            terminal result -> Permit / OtherItem rows
    summary.ts          summary headline, due lines, site check, fees
    forms.ts            fillReducer: the form-filling state machine, plus field/pill views
    ink.ts, exportPdf.ts, format.ts, dates.ts
  hooks/                state over the lib modules
    useNavigator.ts     intake chat over /api/navigator
    useFormFiller.ts    loads specs, steps fillReducer on a timer
    useInk.ts, useToast.ts, useAlive.ts
  components/
    session/            PermitSession: owns shared state, picks the screen
    intake/             IntakeScreen, ChatMessage, Chips, Composer, Ledger
    summary/            SummaryScreen, SiteCheckCard, PermitCard, OtherList, NotNeededList
    filler/             FillerScreen, FormsList, FormToolbar, Paper, PaperField, PenOverlay, Feed, AskBox
    layout/, ui/        Header; Check, Dots, Working, Toast, Staggered
  App.tsx               remounts PermitSession on "Start over"
tests/                  vitest suites, mirroring src/
  setup.ts              jest-dom matchers, cleanup
  fixtures.ts           shared wire-shape builders
```

Components take plain props and callbacks, so each one renders on its own in a test. Screens don't fetch; hooks do.

## Styling

Each component has its own CSS Module (`Foo.module.css`). `src/styles.css` holds only the design tokens (CSS variables), the reset, keyframes, and a few shared classes (`btn`, `scroll`, `a-rise`, …) that modules pull in with `composes: … from global`. Variants use data attributes (`data-tone`, `data-status`) or ARIA state (`aria-pressed`, `aria-current`), not class juggling.

Inline `style` is a lint error. The one exception is `ui/Staggered.tsx`, which sets a `--i` custom property that stylesheets read for staggered animation delays.
