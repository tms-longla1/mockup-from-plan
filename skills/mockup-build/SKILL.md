---
name: mockup-build
description: Write the mockup screens as HTML fragments following screens.json, assemble them into self-contained, clickable wireframe.html and mockup.html files, then self-check, capture PNG screenshots of every screen in every state and write the report. Use after screens.json exists (and theme.json for an existing app), when a mockup needs to be rebuilt or re-captured, or when the create or update skill invokes it.
user-invocable: false
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*)
---

# Build the mockup

Input, inside `mockups/<slug>/`: `inputs.json`, `screens.json`, `theme.json`; in `existing-app` mode also `screens/_partials/`, the as-is fragments of the existing screens, and possibly `custom.css`.

Output:

- `screens/<id>.html`: one fragment per screen.
- `dist/wireframe.html`, `dist/mockup.html`: each self-contained, opens directly in a browser.
- `dist/png/<wireframe|mockup>/NN-<screen>--<state>.png`.
- Only the fidelities and formats listed under `outputs` in `inputs.json` are kept in `dist/`. Fragments are always written in full, because every output is assembled from them.
- `REPORT.md`, `dist/report.json` and `mockups/index.html`: written by the script, never by hand.

You only write fragments. The overview page, the viewer, navigation, component kit, icons and assembly are handled by the bundled scripts and assets. Do not rewrite them and do not edit files in `dist/` by hand.

The scripts are at `${CLAUDE_SKILL_DIR}/scripts/`; below this is written as `<skill>/scripts`. Always call them with exactly that path, so they run without permission prompts.

## Workflow

1. **Read** [references/fragment-guide.md](references/fragment-guide.md) (how to write a fragment, the interaction attributes, the class list) and [references/quality-rules.md](references/quality-rules.md) (what content is and is not allowed). Read both before writing the first fragment.
2. **Write a fragment** for every screen in `screens.json`, one file per screen. Run `node <skill>/scripts/check.mjs mockups/<slug>` (under a second) after writing them and fix its errors before the first `run.mjs`.
   - Quick sketch (`"detail": "quick"` in `inputs.json`): use the neutral kit with no `custom.css`. On an existing screen, draw in detail only the area the feature changes, mark it `data-new`, and stand in for everything else with labeled blocks: `<div class="m-placeholder">Vendor table (unchanged)</div>`. Keep the app's real section and menu names in those labels when the documents give them.
   - Four or more screens to write from scratch and the Agent tool is available: write the shared partials yourself first, then hand the screens to parallel subagents, two or three screens each. Give every subagent the paths of `screens.json`, `theme.json`, `_partials/`, `references/fragment-guide.md` and `references/quality-rules.md`, the screen ids it owns, and the rule that it writes only `screens/<id>.html` for those ids and runs `check.mjs` before finishing.
   - A screen with `existing: true` already has an as-is fragment: edit that file, add the parts of the new feature and put `data-new` on exactly what was added.
   - A new screen: write it from scratch, reusing `_partials` for the chrome.
   - Every state in `screens.json` must have an element carrying the matching `data-state`.
   - Put `data-spec` or `data-assume` on the element that shows each requirement and assumption.
3. **Run the final stage with one command**: `node <skill>/scripts/run.mjs mockups/<slug>`. Add `--open` on the last run only when the calling skill asks for it. It checks, builds, opens the file in headless Chrome to catch JavaScript errors and states that show nothing, captures the images and writes `REPORT.md`. Fix every `ERROR` line. For each `WARNING` line, fix it or have a concrete reason to keep it.
   - `run.mjs` captures everything with one browser process and prints `Review:` lines: review sheets that show every screen in every state on one or two images. They are temporary and not an output.
   - Exit code 3 means it was built but no browser was found. If the session has a browser-control tool, use it to open `dist/mockup.html` and capture it. Otherwise tell the user plainly that the visual check was skipped.
4. **While fixing errors** run `check.mjs` (static, under a second) until it is clean, then `run.mjs` again. The last run must always be `run.mjs`, because only it writes the report.
5. **Look at the review sheets** printed on the `Review:` lines, with the image-reading tool. They show every screen in every state, with the new parts outlined, so one or two images replace the individual screenshots. Open an individual PNG only to inspect a problem the sheet shows. When `png` is among the outputs, also look at `dist/png/mockup/00-overview.png` (the summary reads well on its own, the roadmap follows the real order of the flow, thumbnails are not empty). Look for:
   - broken layout, overflowing or overlapping elements, clipped text;
   - two states that look identical;
   - new parts that are not outlined, or an outline around something that is not new;
   - an existing screen that does not match its source (menu order, columns, button colors);
   - the signs listed under "Sloppy UI" in quality-rules.
6. **Fix and rerun** `run.mjs`. Do at most two review rounds (one for a quick sketch). If problems remain, stop and report exactly what could not be fixed.

## shoot.mjs options

- Check only, no capture: `--verify-only`.
- Review sheets into a folder: `--sheet-dir <dir>`.
- One screen only: `--only <screen-id>`.
- One fidelity only: `--fidelity mockup` or `--fidelity wireframe`.

## Done when

- `run.mjs` exits with code 0 and `REPORT.md` shows a passing status.
- `dist/` contains exactly the selected outputs. Do not add `--outputs` yourself when running `run.mjs`; the selection lives in `inputs.json`.
- You have looked at the images and none of the problems in step 5 remain.

Report the path to `REPORT.md`, plus any warning you kept and why.
