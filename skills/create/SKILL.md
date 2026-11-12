---
name: create
description: Generate a clickable HTML wireframe and mockup, PNG screenshots and a report from a text plan or spec, to visualize a feature before coding it. Accepts any mix of inputs (plan, ticket, user story, requirements document, design files, screenshots, source code) and always produces the same output structure. Works for new products and for features added to an existing app. Use when the user provides a plan, spec, user story or ticket and wants to see the UI or the screen flow, or says "mockup", "wireframe", "prototype", "draw the screens", "visualize the spec", "vẽ màn hình", "hình dung tính năng", "モックアップ". Not for final UI design and not for implementing the real feature.
argument-hint: "[plan/spec files or folders] [what you want, e.g. images only]"
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/../mockup-build/scripts/*)
---

# Create a mockup from a plan/spec

The user's request: $ARGUMENTS

This skill orchestrates three sub-skills (`spec-to-screens`, `ui-context`, `mockup-build`). It does not analyze the spec or write HTML itself. When installed as a plugin their names carry the plugin prefix, for example `spec-mockup:spec-to-screens`.

The scripts live at `${CLAUDE_SKILL_DIR}/../mockup-build/scripts/`, written below as `<scripts>`. Always call them with exactly that path, so they run without permission prompts.

The output follows one standard whatever the inputs are: [references/output-contract.md](references/output-contract.md). `inputs.mjs` decides the folder name and the mode, `run.mjs` checks the result and writes the report. Do not do by hand what these scripts do.

## Talking to the user

- Write every message in the language the user writes in.
- The user may not know the plugin's vocabulary (slug, fidelity, fragment). Say "mockup" and "wireframe", "file HTML", "ảnh", "màn hình", "trạng thái"; never ask them to choose a mode or a slug.
- Ask everything you need in **one** question round, before the long work starts, using the AskUserQuestion tool when it is available (up to four questions in one call). Never ask something the request or the files already answer.
- While working, post one short line when each stage finishes, for example: "Đã đọc plan: 3 màn hình, 7 trạng thái, 2 câu hỏi mở. Đang dựng giao diện…". No other narration.

## Workflow

1. **Look around**: `node <scripts>/status.mjs`. It reports whether Node and a browser are available, the mockups already built in this project, and documents that look like a plan or spec.
   - Node is too old: stop and tell the user to install Node 18 or later.
   - No browser: continue, and tell the user up front that images and the visual check will be skipped until Chrome or Edge is installed (or `CHROME_PATH` is set).
2. **Understand the request** in "The user's request" above. Split it into paths (they exist on disk) and wishes (anything else, such as "chỉ cần ảnh", "source ở ../web").
   - A path matches an existing mockup's primary document, or the user names an existing mockup: this is an update. Follow the `update` skill instead and stop here.
3. **Ask once, only what is missing**:
   - No document given: ask which document to use. Offer the top candidates from `status.mjs` as options (the user can still type another path). If there are none, ask for a path.
   - Outputs not stated: ask what to produce. Options: "Mockup HTML + ảnh" (`mockup,html,png,highlight`), "Chỉ mockup HTML" (`mockup,html`), "Chỉ ảnh" (`mockup,png,highlight`), "Chỉ wireframe" (`wireframe`). Adapt the labels to the user's language. The user can also answer "tất cả" (`all`).
   - The document mentions existing app files or screens but no source code, design files or screenshots were given: ask for their path, with an option "Không có, dựng theo mô tả".
   - If you cannot ask (non-interactive session), use the first option of each question and say so in the final message.
   - Mapping wishes to outputs: "chỉ cần ảnh" / "images only" is `mockup,png,highlight`; "wireframe thôi" is `wireframe`; "HTML để bấm thử" is `mockup,html`; "tất cả" is `all`. No fidelity named means both; no format named means both.
4. **Normalize the inputs**: `node <scripts>/inputs.mjs <path...> --outputs <selection>`. Use exactly the folder, slug and mode it prints. Override with `--slug` or `--mode` only when the user asks or the script is clearly wrong, and mention it at the end.
5. **Invoke `spec-to-screens`** to create `screens.json`. If it finds that the document changes nothing in the UI, stop and tell the user; do not draw screens for a backend-only change. Post the stage line with the counts.
6. **If the mode is `existing-app`, invoke `ui-context`** to capture the app's look and the current screens.
7. **Invoke `mockup-build`** to write the screens and run `run.mjs`. Its last run uses `--open` so the result opens in the browser, unless the user asked not to or only `png` was selected.
8. **Final message**, described below.

Every generated file lives in `mockups/<slug>/`. Do not modify the app's source code.

## Final message

Short, in the user's language, in this order:

1. One line with the result: passed, failed, or built without the visual check. Then the links printed by `run.mjs` on its `Open:` lines, and the path to `REPORT.md`.
2. What was drawn: number of screens and states; which screens are new and which already existed.
3. The assumptions and the open questions, as a short list. This is the most valuable part; never drop it.
4. What in the document is not shown and why (for example backend logic), in one line.
5. Remaining errors or warnings and any skipped step, only if there are some.
6. One line with what the user can do next, for example: "Sửa plan rồi gõ `/spec-mockup:update <slug>` để dựng lại, hoặc `/spec-mockup:update <slug> chỉ cần wireframe` để đổi đầu ra."
