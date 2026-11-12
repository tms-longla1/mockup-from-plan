---
name: ui-context
description: Read the source code, design files or screenshots of an existing app to capture its colors, fonts, app chrome and the current state of the relevant screens, written as theme.json, custom.css and HTML fragments that serve as the base for a mockup of a new feature. Use when building a mockup for a feature added to an existing app, or when the create or update skill invokes it in existing-app mode.
user-invocable: false
---

# Capture the UI context of an existing app

Input: `mockups/<slug>/screens.json` and the entries with role `ui-source` in `mockups/<slug>/inputs.json` (source code, design files, screenshots). Runs only in `existing-app` mode.
Output, all inside `mockups/<slug>/`:

- `theme.json`: color, font and radius tokens. Structure in [references/theme-schema.md](references/theme-schema.md).
- `screens/_partials/<name>.html`: chrome repeated across screens (sidebar, top bar).
- `screens/<id>.html` for every screen with `existing: true`: the screen **as it is today**, without the new feature.
- `custom.css` (when needed): app-specific styling the kit does not cover.

This skill only reproduces the current state. The additions are made by the `mockup-build` skill. Before writing fragments, read `references/fragment-guide.md` of the `mockup-build` skill to learn the available classes and attributes.

## Workflow

1. **Pick sources in order of trust**: `source-code` and `source-file`, then `design-html`, then `screenshot`, and last the descriptions in the documents. When two sources disagree, follow the earlier one. Record the sources used in `theme.json.source`. Whatever the source type, the result is the same set of files listed above.
   - `source-code`: `inputs.json` already records the `stack` (for example `react`, `tailwindcss`, `flutter`). Tailwind: take colors from the config and the classes on the components. Component library (MUI, Ant Design...): take the customized theme; for what is not customized use the library defaults. Flutter or native: take `ThemeData`/the palette and rebuild with the `m-mobile` classes.
   - `design-html`: read the files of the relevant screens; take colors from the classes and CSS in them. Do not copy scripts or CDN links.
   - `screenshot`: look at the image for layout, labels and dominant colors. Colors read from an image are estimates: say so in `theme.json.notes`.
2. **Limit what you read.** Read only:
   - the files that define the shared look: Tailwind config, CSS variables, theme file, global CSS;
   - the shared layout: sidebar, header;
   - the files of the screens with `existing: true` in `screens.json`. Plans usually name the files they change; search by those names.

   Do not scan the whole repository. If about 15 files are not enough, stop reading and record what is missing as an assumption.
3. **Write `theme.json`**: map the app's colors, fonts, font size, radius and sidebar width onto the kit tokens.
4. **Note the icon style.** If the app uses an icon library, pick the closest icons in `assets/icons.json` of `mockup-build`. If the app uses emoji as icons, keep the emoji and set `"allowEmoji": true`.
5. **Write the chrome** into `_partials/`: the real app's menu order and labels, with the selected menu item marked `is-active`.
6. **Write the current state of each existing screen**: the app's layout, labels, table columns and field order. Use kit classes first; add to `custom.css` only what the kit cannot express. In `custom.css` prefer token variables (`var(--c-...)`) over hard-coded colors, so the wireframe version stays readable.
7. **Anything without a source** (for example a dialog that is not in the design files): reconstruct it from the closest description available, then add an assumption to `screens.json` saying which part was reconstructed and from what, and attach that assumption id to the screen.

## Data on the screens

- Use the sample data already present in the design files or the fixtures/seeds of the source. If there is none, make up data that fits the domain.
- Never copy real customer data, API keys, `.env` contents or any other sensitive information from the source into the mockup.

## Self-check before finishing

- `theme.json` has all required tokens.
- Every screen with `existing: true` has an as-is fragment that contains nothing of the new feature.
- Menu labels, column names and field names match the source; nothing was renamed.
- Everything reconstructed without a source is an assumption in `screens.json`.
