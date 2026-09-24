# Contributing

Thanks for helping out. This guide covers setup, the checks every commit runs, and how to write commit messages.

## Setup

You need [uv](https://docs.astral.sh/uv/) and Node 24+.

```bash
# Backend deps (includes ruff, ty, import-linter, commitizen, pre-commit)
cd backend && uv sync

# Frontend deps
cd frontend && npm install

# Git hooks, from the repo root: installs both the pre-commit and commit-msg hooks
uv run --project backend pre-commit install
```

`CLAUDE.md` has the commands for running the dev servers.

## Pre-commit hooks

`.pre-commit-config.yaml` runs these checks on staged files at each commit:

| Area     | Hook                                   | Also runs as                         |
| -------- | -------------------------------------- | ------------------------------------ |
| All      | whitespace, EOF, YAML/TOML, merge markers, large files, private keys | |
| Backend  | `ruff format`, `ruff check --fix`      | `uv run ruff format . && uv run ruff check .` |
| Backend  | `ty check`                             | `uv run ty check`                    |
| Backend  | `lint-imports`                         | `uv run lint-imports`                |
| Frontend | `oxlint`                               | `npm run lint`                       |
| Frontend | `tsc -b`                               | `npm run typecheck`                  |

The Python hooks run through `uv run` and the frontend hooks through `npm`, so they use the tool versions in `backend/uv.lock` and `frontend/package-lock.json`. Only the generic file hooks are pinned in the config.

To run every hook on the whole repo, from the repo root:

```bash
uv run --project backend pre-commit run --all-files
```

If a hook fixes files (formatting, whitespace), stage the fixes and commit again. Tests don't run in the hooks. Run them yourself before you open a PR:

```bash
cd backend && uv run pytest
cd frontend && npm test
```

## Import rules

Imports have to follow the layers of the architecture. Moving code to the right layer is almost always a better fix than loosening a rule.

**Backend.** [import-linter](https://import-linter.readthedocs.io/) contracts live in `backend/.importlinter`:

- `app.main` → `app.routes` → `app.navigator | app.models` → `app.engine | app.environment`. A module can import only from layers below it. Modules in the same layer (split by `|`) can't import each other.
- Inside `app.engine`, `diagrams` and `engine` sit above `model`, which sits above `logic`.
- `app.engine` must stay deterministic. It can't import `fastapi`, `anthropic`, `typesafe_sdk`, `app.models`, or `app.environment`.

**Frontend.** These rules live in `frontend/.oxlintrc.json` and follow the layout in `frontend/README.md`:

- `types/` imports nothing from the app.
- `lib/` is pure logic. It can't import React, `hooks/`, or `components/`.
- `hooks/` can't import `components/`.
- `components/` don't fetch. They can't import `navigatorStart` or `navigatorReply` from `lib/api`. Call those from a hook.
- `import/no-cycle`, `no-self-import`, and `no-duplicates` apply everywhere.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook checks each message with [commitizen](https://commitizen-tools.github.io/commitizen/).

```
<type>(<optional scope>): <summary>

<optional body>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Add `!` after the type or scope for a breaking change, as in `feat(api)!: rename /determine`. Examples:

```
feat(navigator): ask about amplified sound in parks
fix(engine): stop short-circuiting on unknown facts
docs: document the import rules
```

For a guided prompt, run `uv run --project backend cz commit` from the repo root.

## Pull requests

- Branch off `development` and keep each PR to one change.
- Make sure the hooks and both test suites pass.
- If you change the API, update `docs/API_CONTRACT.md` in the same PR.
- If you change rules in `backend/app/engine/rules.yaml`, regenerate the diagrams in `docs/rules/` with `cd backend && uv run python -m app.engine.diagrams`.

## Releases

Releases are cut from `development` with `./release.sh`, which tags `vX.Y.Z` and moves the `production` branch that Railway deploys. See `docs/RELEASING.md`.
