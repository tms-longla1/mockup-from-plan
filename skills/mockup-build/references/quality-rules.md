# Content rules

A mockup exists so that people reading the spec picture the feature correctly. A good-looking mockup that contradicts the spec does more harm than no mockup.

## Stay true to the spec

- Draw only what is in `screens.json`. If a screen needs an element the spec does not mention to make sense (a back button, a title), add an assumption to `screens.json` and attach `data-assume`.
- Do not add filters, search boxes, pagination, charts, statistics, menus or tabs to a new screen "to make it look real".
- On an existing screen, keep the current state. Do not rearrange, relabel or "improve" anything that is not part of the feature.
- Labels, buttons, messages: copy them verbatim from the spec, in the UI language (`uiLang`). When the spec gives no wording, write a short, concrete, domain-specific text and record it as an assumption.
- Do not write business logic. Interaction stops at changing screens, switching states, opening and closing.

## States

- Each state must differ visibly from the others in a screenshot.
- An error state shows the exact message in the right place (at the field, at the top of the form, or as a toast) according to the spec.
- An empty state says why it is empty and what the user does next, if the spec says so.
- A loading state uses `m-skeleton` or `m-spinner` on the area that is loading; do not cover the whole screen unless the spec says so.
- A control that is disabled under a condition is drawn both enabled and disabled.

## Sample data

- Take names, codes, units and value ranges from the spec or the app's sample data. If the spec says "target 10, stock 8, order 2", use exactly those numbers.
- Do not use "Lorem ipsum", "User 1", "Test 123", "John Doe".
- A table has 3 to 6 rows; the rows differ, and at least one shows an edge case the spec mentions (an empty value, a long name, a different status).
- Never put real customer data or sensitive information into a mockup.

## Sloppy UI

The following make viewers recognize generated output at once and stop trusting the content. Do not use them unless the real app has exactly that:

- gradient backgrounds or buttons, especially purple and blue;
- emoji in place of icons (if the real app uses emoji, keep them and set `allowEmoji` in `theme.json`);
- large radii and shadows on every block;
- a big centered headline with a tagline;
- a row of three stat cards with decorative numbers;
- badges, colored labels or icons on every row that carry no information;
- marketing wording ("seamless experience", "Welcome back!");
- explanatory notes about the UI written on the UI. Explanations belong in `purpose`, the assumptions and the open questions in `screens.json`.

In `existing-app` mode the app decides the style. In `new-product` mode keep the neutral kit as is; do not invent brand colors or write decorative `custom.css`.

## New versus existing

- Viewers must be able to answer "what does the feature add to this screen" just by switching on the "New parts" button.
- `data-new` goes only on what the plan adds or changes. A label whose wording changed counts as new.
- Do not draw what the plan removes; state the removal in the screen's `purpose`.
