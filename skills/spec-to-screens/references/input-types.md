# How to read each input type

`inputs.json` assigns a `type` to every file. The reading approach differs, but what you extract is always the same: source-quoted UI requirements, screens, states, assumptions, open questions.

| `type` | Characteristics | How to read it |
|---|---|---|
| `plan` | Technical plan: mixes schema, API, jobs and tests with UI changes | Find the sections about screens, forms, components, labels and messages. Skip schema, migrations, jobs and tests. A "files changed" section tells you which screens already exist. Copy the UI-related items of an "assumptions / open questions" section into `openQuestions` |
| `spec` | Ticket, user story, change request: short, written in business terms, often with ticket metadata at the top | Each acceptance criterion or behavior bullet is one requirement. Specs usually lack UI detail: what is missing becomes an assumption, not something you infer |
| `requirements` | Requirements document for the whole system, long | Read only the sections related to the feature at hand. If the user did not say which feature, ask once before building a mockup of the whole document |
| `screen-description` | Document describing each screen, often with screen codes | Each screen in the document is a candidate screen; use the document's screen code in `name`. This is the best source for layout and labels |
| `document` | Document of unknown type | Read it like a `spec` |
| `test-case` | Test cases | Do not take requirements from here. Use it to find states and edge cases the spec only touches on |

## Several documents at once

- The primary document (`role: primary`) sets the scope: the mockup draws only the feature the primary document describes. `supporting` documents only add detail within that scope.
- When two documents contradict each other, follow the primary document and record the contradiction in `openQuestions`.
- Each `specRef` gives as `source` the file the quote actually comes from.

## Translations and bilingual documents

- A file with `translationOf` is a translation of another input file. The original is authoritative; the translation is a reading aid. If the two differ in content, follow the original and record it in `openQuestions`.
- Bilingual ticket (the same content in two languages in one file): record each requirement once, quoted in the `lang` language.
- UI labels always stay in the app's original language, even when the surrounding quote is translated.

## Large files

For a file with `large: true` in `inputs.json`: read the table of contents or the list of headings first, then only the UI-related sections. Do not read the whole file.

## UI sources

Files with `role: ui-source` (source code, design files, screenshots) are not a source of requirements. They are handled by the `ui-context` skill. At this step use them only to determine which screens already exist.
