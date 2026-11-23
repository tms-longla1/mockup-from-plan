---
name: update
description: Update a mockup that was already built with this plugin: rebuild it after its plan/spec changed, change which outputs are produced (mockup, wireframe, HTML, images), or apply a requested change to its screens. Use when the user wants to refresh, redo, adjust or re-export an existing mockup in the mockups/ folder.
argument-hint: "[mockup name] [what to change, e.g. images only / add an error state]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/../mockup-build/scripts/*)
---

# Update an existing mockup

The user's request: $ARGUMENTS

The scripts live at `${CLAUDE_SKILL_DIR}/../mockup-build/scripts/`, written below as `<scripts>`. Always call them with exactly that path. Talk to the user as described in the `create` skill: their language, plain words, at most one question round, one short line per finished stage.

## Workflow

1. **Look around**: `node <scripts>/status.mjs`. It lists the existing mockups, their status, their outputs and whether their documents changed since the last run.
2. **Pick the mockup.** Match the request against the mockup names, feature names and primary documents.
   - Exactly one mockup exists, or one clearly matches: use it.
   - Several could match, or none was named: ask which one, offering the existing mockups as options (prefer the ones whose documents changed).
   - None exists: tell the user and follow the `create` skill instead.
3. **Work out what to do**, from the request and from the `documents:` line of `status.mjs`. Several can apply at once.

| Situation | What to do |
|---|---|
| Documents changed, or the user says the plan/spec changed | `node <scripts>/inputs.mjs --dir mockups/<slug>`, then invoke `spec-to-screens` (it keeps existing ids and edits only what changed), `ui-context` if the mode is `existing-app` and the affected existing screens changed, then `mockup-build` |
| New input given (another document, source code, screenshots) | `node <scripts>/inputs.mjs --dir mockups/<slug> <new-path...>`, then as in the row above |
| Different outputs wanted ("chỉ cần ảnh", "thêm wireframe") | `node <scripts>/inputs.mjs --dir mockups/<slug> --outputs <selection>`, then `node <scripts>/run.mjs mockups/<slug>`. No sub-skill is needed |
| Switch between a quick sketch and the app's real look ("làm giống app thật", "chỉ cần phác") | `node <scripts>/inputs.mjs --dir mockups/<slug> --detail <full|quick>`. Going to `full` in an existing app: invoke `ui-context`, then `mockup-build` to redraw the screens in the app's look. Going to `quick`: invoke `mockup-build` to redraw with the neutral kit and placeholders, and delete `custom.css` |
| A change to the screens ("thêm trạng thái lỗi", "đổi nhãn nút") | Check the change against the documents. If the documents support it, invoke `mockup-build` to edit the screens. If they do not, make the change only as an assumption: add it to `assumptions` in `screens.json` and mark it with `data-assume`, and tell the user the spec does not say this |
| Nothing changed and no change requested | Tell the user the mockup is up to date and give its links. Run `run.mjs` again only if the report is missing or failed |

   The output keywords and their mapping from plain wishes are in the `create` skill.
4. **Finish with `node <scripts>/run.mjs mockups/<slug> --open`** (without `--open` if the user asked not to open it or only images were selected).
5. **Final message** in the user's language: the result and the `Open:` links; what changed compared with the previous version (screens, states, assumptions and open questions added or removed); the assumptions and open questions that are still open; remaining errors or warnings, if any.

Never delete the mockup folder to start over unless the user asks for it.
