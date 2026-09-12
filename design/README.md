# Design prototype

`canvas/Main.dc.html` is the clickable frontend prototype (Design Components format: one HTML file, template + a `Component` class). `canvas/canvas.json` is the artboard layout.

Live canvas: https://claude.ai/code/artifact/93351f0e-ff82-4a3b-b164-589f9981d6f4

Three stages: chat intake with the event file beside it, an animated permit summary, then a form filler with a live paper and action feed. The 13 rules in `rules()` and the per-form fields in `paperSpec()` are the spec for the React build; every threshold, fee, and lead time comes from `docs/DATA_SOURCES.md`.

The built canvas file (`sf-permit-navigator.html`, ~2.5 MB editor payload) is not committed. Re-seed it from `Main.dc.html` with the `/design` skill.
