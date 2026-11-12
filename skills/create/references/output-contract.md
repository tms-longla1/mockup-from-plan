# Output contract

Every feature is one folder `mockups/<slug>/` with the files below, whatever the input was. The content of `dist/` depends on the output selection; the other files are always present.

```
mockups/
  index.html                 List of all mockups, updated by run.mjs
  <slug>/
    inputs.json              Classified inputs, slug, mode, output selection   (inputs.mjs)
    screens.json             Screens, flows, states, requirements, assumptions (spec-to-screens)
    theme.json               The app's colors and fonts, or the default kit    (ui-context / inputs.mjs)
    custom.css               Only when an existing app needs its own styling   (ui-context)
    screens/<id>.html        One file per screen                               (ui-context, mockup-build)
    screens/_partials/       Shared app chrome
    REPORT.md                Report for people                                 (run.mjs)
    dist/mockup.html         Version styled like the app
    dist/wireframe.html      Grayscale version with the same content
    dist/png/<fidelity>/NN-<screen>--<state>.png
    dist/png/<fidelity>/NN-<screen>--<state>--new.png   New parts outlined
    dist/report.json         Report for machines
```

## Fixed rules

| Item | Rule | Decided by |
|---|---|---|
| Primary document | In this order: plan, spec, requirements document, screen description, other document. A translation is never primary when its original is present | `inputs.mjs` |
| `slug` | The primary document's file name without the `plan-` prefix, the language suffix and the extension; lowercase ASCII joined by hyphens; at most 48 characters. If the file name is unusable, the title is used | `inputs.mjs` |
| Mode | `existing-app` if the inputs include a UI source, or the primary document mentions two or more source files. Otherwise `new-product` | `inputs.mjs` |
| Screen ids | Lowercase letters, digits, hyphens; also the fragment file name | checked by `check.mjs` |
| Requirement, assumption, question ids | `R1`, `A1`, `Q1`... increasing in the order they appear in the document. A rerun keeps the old ids | checked by `check.mjs` |
| State names | Use the standard name when the concept matches: `default`, `empty`, `loading`, `error`, `validation-error`, `no-permission`, `disabled`, `confirm`, `success` | checked by `check.mjs` |
| Image size | Desktop 1440 wide, at least 900 high. Mobile 390 wide (2x image), at least 844 high | `shoot.mjs` |
| Images | When `png` is selected: every screen in every state, for each selected fidelity | checked by `run.mjs` |
| Report structure | Status, outputs, inputs, screens, requirements, assumptions, open questions, self-check, images | `run.mjs` |
| Overall status | `pass`: no errors and all images present. `fail`: errors remain. `unverified`: built, but no browser was available | `run.mjs` |

## Output selection

Stored as `outputs` in `inputs.json`, set with `inputs.mjs --outputs <list>`. `run.mjs --outputs` overrides it for a single run.

| Keyword | Meaning |
|---|---|
| `mockup`, `wireframe` | Fidelity to produce. If neither is named, both are produced |
| `html`, `png` | Format to produce. If neither is named, both are produced |
| `highlight` | Adds the `--new` images that outline the new parts (implies `png`) |
| `all` | Everything. The default when nothing is selected |

Examples: `mockup,html` produces only `dist/mockup.html`; `png` produces images for both fidelities and no HTML file; `wireframe` produces the wireframe in both formats.

Whatever is selected, `run.mjs` still builds and opens the mockup in a browser to check it, still writes `REPORT.md` and `dist/report.json`, and removes unselected outputs from `dist/`. `REPORT.md` lists only what was produced.

A mockup counts as done only when `run.mjs` exits with code 0.
