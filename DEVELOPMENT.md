# Developing spec-mockup

## Try your changes

Load the plugin from this folder without installing it, from inside any test project:

```
claude --plugin-dir /path/to/this-repo
/spec-mockup:create
```

When you open this repo itself in Claude Code, `.claude/skills` (a local symlink to `skills/`, not committed) makes the skills available without the plugin prefix.

Check the manifest before pushing:

```
claude plugin validate .
```

## Scripts

`/spec-mockup:create` and `/spec-mockup:update` call these scripts. Users never need to run them; they are useful for debugging, or for rebuilding after editing a screen file by hand. Writing `screens.json` and the screen files is Claude's job, so the scripts alone do not produce a new mockup.

```bash
S=<plugin>/skills/mockup-build/scripts     # <plugin> is the plugin's install folder, or this repo
node $S/status.mjs                                     # environment, existing mockups, candidate documents
node $S/inputs.mjs docs/plan-x.md ../app/web           # classify the inputs, create mockups/<name>/inputs.json
node $S/inputs.mjs --dir mockups/<name>                # rerun: see which files changed
node $S/inputs.mjs --dir mockups/<name> --outputs png  # change the outputs
node $S/run.mjs mockups/<name> --open                  # check, build, capture images, write REPORT.md, open the result
node $S/check.mjs mockups/<name>                       # static check only
```

| Script | Role |
|---|---|
| `status.mjs` | Environment check, existing mockups and whether their documents changed, candidate documents |
| `inputs.mjs` | Classifies the inputs, picks the primary document, slug and mode, stores the output selection in `inputs.json` |
| `check.mjs` | Static checks of `screens.json`, the screen fragments and the theme |
| `build.mjs` | Assembles the fragments into `dist/mockup.html` and `dist/wireframe.html` |
| `shoot.mjs` | Opens the built file in headless Chrome, catches runtime errors, captures the PNG images |
| `run.mjs` | Runs check, build and shoot, then writes `REPORT.md`, `dist/report.json` and `mockups/index.html` |

## Releasing

Bump `version` in both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, commit and push. Users get it with `/plugin marketplace update spec-mockup`.
