# screens.json structure

```json
{
  "feature": "Feature name, written for the people viewing the mockup",
  "slug": "feature-name",
  "sources": ["plans/plan-x.md", "specs/123-y.md"],
  "mode": "existing-app",
  "device": "desktop",
  "lang": "en",
  "uiLang": "ja",
  "flows": [
    { "id": "configure", "name": "Flow name", "screens": ["vendor-list", "vendor-form"] }
  ],
  "screens": [
    {
      "id": "vendor-form",
      "name": "Screen name",
      "existing": true,
      "purpose": "One or two sentences: what this screen shows about the feature.",
      "states": [
        { "id": "auto-off", "name": "Auto-order off" },
        { "id": "weekly", "name": "On, weekly" }
      ],
      "specRefs": ["R1", "R2"],
      "assumptions": ["A1"]
    }
  ],
  "specRefs": [
    { "id": "R1", "text": "Quoted nearly verbatim from the spec.", "source": "plan-x.md › Track A" }
  ],
  "assumptions": [
    { "id": "A1", "text": "Something the mockup had to choose because the spec is silent." }
  ],
  "openQuestions": [
    { "id": "Q1", "text": "A question someone has to decide.", "screens": ["vendor-form"] }
  ]
}
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `feature` | yes | Feature name for viewers |
| `slug`, `mode` | yes | Copied from `inputs.json`; do not choose them yourself |
| `sources` | yes | Every file read to build this inventory. Must include the primary document and only files listed in `inputs.json` |
| `device` | yes | `desktop` or `mobile`: the device of most screens |
| `screens[].device` | no | Set when a screen differs from the top-level device (a feature with both web and app screens) |
| `lang` | yes | `vi`, `en` or `ja`: language of the viewer chrome and the notes |
| `uiLang` | no | Language of the UI labels when it differs from `lang` |
| `flows[].screens` | yes | Screen ids in the order they are visited |
| `screens[].id`, `states[].id` | yes | Lowercase letters, digits, hyphens. The screen id is also the fragment file name |
| `screens[].name`, `screens[].purpose`, `states[].name` | yes | Written in the `lang` language |
| `screens[].existing` | yes | `true` if the screen already exists in the app. Always `false` in `new-product` |
| `screens[].states` | yes | At least one. The first state is the one shown by default |
| `screens[].singleStateReason` | when there is only one state | Why no other state is needed |
| `screens[].unchangedReason` | when an existing screen is unchanged | Why it is still included (usually to lead into the flow) |
| `screens[].specRefs`, `screens[].assumptions` | at least one of the two | Ids pointing to the shared lists |
| `specRefs[]` | yes | `id`, `text` and `source` are all required. Ids are `R1`, `R2`... in the order they appear in the document |
| `assumptions[]` | yes (may be empty) | `id` (`A1`...), `text` |
| `openQuestions[]` | no | `id` (`Q1`...), `text`. Leave `screens` out to show the question on every screen |

## Standard state names

When a state is one of the concepts below, use exactly this id. `check.mjs` rejects other spellings (`no-data`, `fetching`, `failed`, `forbidden`...).

| Id | When |
|---|---|
| `default` | The screen in its most common condition, with data |
| `empty` | No data yet, or a search with no results |
| `loading` | Loading or processing |
| `validation-error` | The user entered something wrong or left something out |
| `error` | System error, a failed submission |
| `no-permission` | The user has no access |
| `disabled` | The feature is switched off by configuration |
| `confirm` | A confirmation dialog before an action |
| `success` | Right after an action succeeded |

Feature-specific states (for example `weekly`, `biweekly`) get a short domain id. When a screen has several variants of one concept, add a suffix: `error-timeout`, `confirm-delete`.

Requirement, assumption and question ids increase and are never reused. On a rerun, a deleted entry leaves a gap and a new entry takes the next number.

The `check.mjs` script of the `mockup-build` skill enforces these constraints.
