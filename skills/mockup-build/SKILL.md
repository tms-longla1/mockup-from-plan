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

You only write fragments. The viewer, navigation, component kit, icons and assembly are handled by the bundled scripts and assets. Do not rewrite them and do not edit files in `dist/` by hand.

The scripts are at `${CLAUDE_SKILL_DIR}/scripts/`; below this is written as `<skill>/scripts`. Always call them with exactly that path, so they run without permission prompts.

## Workflow

1. **Read** [references/fragment-guide.md](references/fragment-guide.md) (how to write a fragment, the interaction attributes, the class list) and [references/quality-rules.md](references/quality-rules.md) (what content is and is not allowed). Read both before writing the first fragment.
2. **Write a fragment** for every screen in `screens.json`, one file per screen.
   - A screen with `existing: true` already has an as-is fragment: edit that file, add the parts of the new feature and put `data-new` on exactly what was added.
   - A new screen: write it from scratch, reusing `_partials` for the chrome.
   - Every state in `screens.json` must have an element carrying the matching `data-state`.
   - Put `data-spec` or `data-assume` on the element that shows each requirement and assumption.
3. **Run the final stage with one command**: `node <skill>/scripts/run.mjs mockups/<slug>`. Add `--open` on the last run only when the calling skill asks for it. It checks, builds, opens the file in headless Chrome to catch JavaScript errors and states that show nothing, captures the images and writes `REPORT.md`. Fix every `ERROR` line. For each `WARNING` line, fix it or have a concrete reason to keep it.
   - Exit code 3 means it was built but no browser was found. If the session has a browser-control tool, use it to open `dist/mockup.html` and capture it. Otherwise tell the user plainly that the visual check was skipped.
4. **While fixing errors** you can run the parts separately for speed: `check.mjs` (static check only), `build.mjs`, `shoot.mjs`. The last run must always be `run.mjs`, because only it writes the report.
5. **Look at the images** with the image-reading tool. If the outputs do not include `png`, `run.mjs` still captures one set into a temp folder and prints its path on the "Review images" line; look at those. Only review the kinds of image that exist in this run. At minimum look at: the default state of every screen, every state with a dialog or an error, the `--new` version of every existing screen, and one wireframe image. Look for:
   - broken layout, overflowing or overlapping elements, clipped text;
   - two states that look identical;
   - new parts that are not outlined, or an outline around something that is not new;
   - an existing screen that does not match its source (menu order, columns, button colors);
   - the signs listed under "Sloppy UI" in quality-rules.
6. **Fix and rerun** `run.mjs`. If errors remain after three rounds, stop and report exactly what could not be fixed.

## shoot.mjs options

- Check only, no capture: `--verify-only`.
- One screen only: `--only <screen-id>`.
- One fidelity only: `--fidelity mockup` or `--fidelity wireframe`.

## Done when

- `run.mjs` exits with code 0 and `REPORT.md` shows a passing status.
- `dist/` contains exactly the selected outputs. Do not add `--outputs` yourself when running `run.mjs`; the selection lives in `inputs.json`.
- You have looked at the images and none of the problems in step 5 remain.

Report the path to `REPORT.md`, plus any warning you kept and why.
