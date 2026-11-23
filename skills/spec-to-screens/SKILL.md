---
name: spec-to-screens
description: Read a text plan or spec and extract the screens, flows, states, source-quoted requirements, assumptions and open questions into screens.json. This is the first step of building a mockup/wireframe from a spec. Use when you need to know what a plan/spec changes in the UI, or when the create or update skill invokes it.
user-invocable: false
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/../mockup-build/scripts/*)
---

# From a spec to a list of screens

Input: `mockups/<slug>/inputs.json` (created by `inputs.mjs`: the classified files, the slug, the mode).
Output: `mockups/<slug>/screens.json` following [references/screens-schema.md](references/screens-schema.md). Read the schema before writing.

The input may be a technical plan, a ticket, a user story, a requirements document, a screen description, or several of these together. How to read each type is in [references/input-types.md](references/input-types.md). Whatever the input is, `screens.json` always has the same structure and the same naming conventions.

The goal is an honest inventory of what the spec says about the UI. Anything that is not in the spec but is still needed to draw the screens must be recorded as an assumption, never added silently.

## Workflow

1. **Read `inputs.json`**, then read the files with role `primary` and `supporting` as described for their type. Take `slug` and `mode` from `inputs.json`; do not choose them yourself. If a document points to another file you need (the original spec, an earlier plan) that is not in `inputs.json`, add it with `node ${CLAUDE_SKILL_DIR}/../mockup-build/scripts/inputs.mjs --dir mockups/<slug> <path>` before reading it. `sources` in `screens.json` may contain only files that are in `inputs.json`.
2. **Keep only what affects the user.** Technical plans mix schema, jobs, migrations and tests with UI changes. Keep the statements that change what the user sees or does: screens, fields, buttons, labels, messages, show/hide/disable conditions, access rights, flows. Keep a backend rule only when it surfaces in the UI (for example a validation message or a default value).
3. **If nothing is left**, stop: report that the plan does not change the UI and do not create `screens.json`.
4. **Write `specRefs`**: one entry per UI requirement, `R1`, `R2`..., with `text` quoted nearly verbatim and `source` in the form `file-name › section heading`. Split until each entry corresponds to one thing that can be drawn.
5. **Identify the screens.** A screen is a real UI surface: a page, a dialog, a mobile screen. Set `existing: true` if it already exists in the app. In `existing-app` mode, add an entry screen (for example the list that holds the button opening a form) only when viewers need it to see where the feature lives, and set `unchangedReason`.
6. **Identify the states** of each screen, using the standard state names in the schema. Go through: default, empty, loading, validation error, system error, no permission, disabled, long or large data, after success. Include the states the spec mentions or the feature certainly has; a state the spec does not mention but you still draw gets an assumption. Do not add states just to complete the set: when a screen truly has one state, set `singleStateReason`.
   - When `inputs.json` has `"detail": "quick"`: keep only the states the documents name, plus the default; set `singleStateReason` to "quick sketch" where that leaves one. Add an entry screen only when the feature has no screen of its own.
7. **Write `assumptions`** (`A1`...): layout, wording and behavior the spec does not state but the mockup has to choose. **Write `openQuestions`** (`Q1`...): places where the spec is contradictory, vague, or needs a product decision. If the plan has its own open-questions section, copy the UI-related ones here.
8. **Split into `flows`**: each flow is one thing the user does from start to finish, listing the screens in the order they are visited. Give each flow a one-sentence `goal` (who does what, and why).
9. **Write `summary`**: two to four plain sentences, taken from the documents, saying what the feature is, who it is for, where it lives in the app and what changes for the user. It opens the overview page of the mockup and the report, so a reader who has not seen the spec must understand the feature from it. No marketing wording.
10. **Language and device**: `lang` is the language the user is writing in (used for screen names and notes). `uiLang` is the language of the UI labels according to the spec/app. Copy UI labels verbatim from the spec; do not translate them. A feature with both web and app screens is still one `screens.json`: set the top-level `device` to the majority and give the other screens their own `device`.
11. **Write `screens.json`**.

## When `screens.json` already exists

Read the old file first. Keep the ids of screens, requirements and assumptions that still hold. Edit what changed, add new entries with the next id, remove assumptions the new spec has answered. Finally list for the user what changed since the last run.

## Self-check before finishing

- Every UI statement in the spec is covered by at least one `specRef`, and every `specRef` is attached to at least one screen.
- Every screen has at least one `specRef` or assumption. A screen that traces back to nothing was invented: delete it.
- No button, field, filter or screen was added "for completeness".
- The `text` of each `specRef` is the spec's wording, not your interpretation.
