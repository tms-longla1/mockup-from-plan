# spec-mockup

A set of Claude Code skills that read a text plan or spec and generate a clickable HTML wireframe and mockup plus PNG screenshots, so a feature can be visualized before it is coded. It also works for features added to an existing app: the mockup reproduces the current screens and outlines what is new.

## Quick start

```
/plugin install spec-mockup --marketplace tms-longla1/mockup-from-plan
/spec-mockup:create
```

With no argument, `create` suggests the plan/spec documents it finds in your project and asks what to produce. The result opens in your browser when it is ready.

## Commands

| Command | Use it to |
|---|---|
| `/spec-mockup:create [files] [wishes]` | Build a mockup from a plan, spec, ticket or requirements document |
| `/spec-mockup:update [mockup] [change]` | Rebuild after the document changed, change the outputs, or adjust the screens |

Arguments are optional and can be written in plain words, in English, Vietnamese or Japanese:

```
/spec-mockup:create docs/plan-invoice.md
/spec-mockup:create docs/plan-invoice.md images only, the web source is in ../web
/spec-mockup:update invoice
/spec-mockup:update invoice add the wireframe too
/spec-mockup:update invoice add an empty state to the list screen
```

You can also just ask, for example "make a mockup of docs/plan-invoice.md"; Claude picks the right command.

## How it works

Only `create` and `update` appear in the `/` menu. The other three run behind them.

| Skill | What it does | Result |
|---|---|---|
| `create` | Entry point. Finds the documents, asks once for what is missing, invokes the skills below, reports | `inputs.json` |
| `update` | Entry point for an existing mockup: rebuilds what changed, changes the outputs, adjusts screens | |
| `spec-to-screens` | Extracts screens, flows, states, source-quoted requirements, assumptions, open questions | `screens.json` |
| `ui-context` | Existing apps only: captures colors, fonts, app chrome and the current screens from source code, design files or screenshots | `theme.json`, `custom.css`, as-is fragments |
| `mockup-build` | Writes each screen, assembles the files, self-checks, captures images, writes the report | `dist/wireframe.html`, `dist/mockup.html`, `dist/png/`, `REPORT.md` |

## One output standard for every input

The input can be a technical plan, a ticket, a user story, a requirements document, a screen description, HTML design files, screenshots, a source code folder, or several of these at once. The result is always the same set of files, described in [output-contract.md](skills/create/references/output-contract.md). Two scripts enforce the standard:

- `inputs.mjs` takes any paths, classifies every file, then names the folder and picks the mode by fixed rules.
- `run.mjs` checks, builds, captures images and writes `REPORT.md` from a single template. A mockup counts as done only when this command passes.

## Requirements

- Node.js 18 or later. No packages to install.
- Chrome, Chromium or Edge for the self-check and the screenshots. If the browser is in an unusual location, set `CHROME_PATH`.

## Installation

**For yourself** (Claude Code 2.1.275 or later), type in Claude Code:

```
/plugin install spec-mockup --marketplace tms-longla1/mockup-from-plan
```

On older versions, install in two steps:

```
/plugin marketplace add tms-longla1/mockup-from-plan
/plugin install spec-mockup@spec-mockup
```

**For a whole team in one project**: add this to that project's `.claude/settings.json` and commit it. Anyone who opens the project in Claude Code is prompted to install the plugin.

```json
{
  "extraKnownMarketplaces": {
    "spec-mockup": { "source": { "source": "github", "repo": "tms-longla1/mockup-from-plan" } }
  },
  "enabledPlugins": { "spec-mockup@spec-mockup": true }
}
```

Private repository: whoever installs needs read access to the repository and git/GitHub credentials on their machine.

**Updating**: `/plugin marketplace update spec-mockup`.

## Usage

Open Claude Code in your project folder and run `/spec-mockup:create`, with or without arguments. Claude asks at most one round of questions, in a dialog, and only for what it cannot work out:

- which document to use, if you did not name one;
- what to produce: HTML mockup with images, HTML mockup only, images only, or wireframe only;
- where the source code or design files are, if the document is about an existing app and you did not give them.

While it works, it posts one line per finished stage. The plugin's scripts are pre-approved for the duration of the command, so you are not asked to confirm each step.

The result is written to `mockups/` in your project. If you do not want to commit the results, add `mockups/` to the project's `.gitignore`.

### Outputs

| What you say | What you get |
|---|---|
| "HTML mockup with images" (default) | `dist/mockup.html` and images, including images that outline the new parts |
| "HTML only" | `dist/mockup.html` |
| "images only" | PNG images |
| "wireframe only" | `dist/wireframe.html` and its images |
| "everything" | Mockup and wireframe, HTML and images |

To change the outputs later: `/spec-mockup:update <mockup> images only`.

### Viewing the result

Open `mockups/<feature-name>/dist/mockup.html` in a browser:

- left column: the flows and screens;
- state bar: switch the state of the screen (empty, error, ...);
- "New parts" button: outlines what the feature adds to an existing screen;
- "Notes" button and right column: the spec requirements the screen shows, the assumptions, the open questions.

The viewer and the report are available in English, Vietnamese and Japanese; they follow the language you talk to Claude in.

When the spec changes, run `/spec-mockup:update <mockup>`. It detects which documents changed and updates the existing mockup instead of starting over. Run it without a name to see every mockup and whether its documents changed.

All mockups built so far are listed in `mockups/index.html`.

## Developing the plugin

Notes for people changing the skills or scripts are in [DEVELOPMENT.md](DEVELOPMENT.md).

## Limitations

- A mockup is an illustration, not a final design. How closely it matches the real app depends on the UI sources provided.
- Native mobile apps are only simulated with HTML inside a phone frame.
- The kit loads no fonts from the network, so the app's font renders correctly only if it is installed on the viewer's machine.
