# How to write a fragment

A fragment is the HTML inside one screen, stored at `screens/<screen-id>.html`. The build script wraps it in the viewer. A fragment has no `<html>`, `<head>`, `<body>`, `<script>`, `<link>` or `<iframe>`, no event attributes (`onclick`...), no resources loaded over the network and no `position: fixed`.

## Common skeletons

Desktop with a sidebar:

```html
<div class="m-app">
  <!--#include sidebar-->
  <div>
    <div class="m-topbar">...</div>
    <div class="m-main">
      <div class="m-page-head"><h1>Page title</h1><button class="m-btn m-btn--primary" type="button">...</button></div>
      ...
    </div>
  </div>
</div>
```

Mobile (`device: "mobile"`):

```html
<div class="m-mobile">
  <div class="m-mobile__bar"><i data-icon="arrow-left" data-goto="home"></i><span>Title</span></div>
  <div class="m-mobile__body">...</div>
  <div class="m-mobile__foot"><button class="m-btn m-btn--primary m-btn--block" type="button">...</button></div>
</div>
```

`<!--#include name-->` inserts the content of `screens/_partials/name.html`. Use it for parts repeated across screens. If the selected menu item differs between screens, create one partial per group.

## Interaction attributes

Every interaction goes through the attributes below. Values always use double quotes.

| Attribute | Effect |
|---|---|
| `data-state="a b"` | The element is shown only when the screen is in state `a` or `b`. Elements without it are shown in every state |
| `data-set-state="a"` | Clicking switches the current screen to state `a` |
| `data-goto="screen-id"` or `"screen-id#state"` | Clicking moves to another screen |
| `data-open="id"` | Clicking shows the element with that `id` (dialog, menu) |
| `data-close` or `data-close="id"` | Hides the enclosing dialog/drawer/menu, or the element with that `id` |
| `data-toggle="id"` | Toggles the element with that `id` |
| `data-new` | The element is an addition made by the feature. Only on screens with `existing: true` |
| `data-spec="R1 R2"` | The element shows these requirements. The ids must be in the screen's `specRefs` |
| `data-assume="A1"` | The element relies on this assumption. The id must be in the screen's `assumptions` |
| `data-icon="name"` | Inserts an icon. Write `<i data-icon="search"></i>`. The name must exist in `assets/icons.json` |

Working with states:

- When something changes between states, write one element per variant, each with its own `data-state`. Write the shared part once, without `data-state`.
- Connect the states with `data-set-state` on the very control that causes the change (a checkbox, a submit button, an option in a list), so viewers can click through.
- A confirmation dialog or the result after saving should be a state of its own so it gets a screenshot. `data-open` suits minor details that need no image; an element opened with `data-open` needs the `hidden` attribute initially and no `data-state`.
- Put `data-new` on the smallest element that fully contains the addition (one field, one column, one button), not on the whole card or form.
- Put `data-spec` and `data-assume` on container elements (`div`, `p`, `td`), not on `input`.

## Kit classes

Use the existing classes before writing your own CSS. Use `style=""` only for small sizing and alignment.

| Group | Classes |
|---|---|
| Layout | `m-app`, `m-app--top`, `m-sidebar`, `m-sidebar__brand`, `m-sidebar__group`, `m-nav-item` (+`is-active`), `m-topbar`, `m-main`, `m-page-head`, `m-breadcrumb`, `m-row` (+`--top`, `--between`, `--end`, `--nowrap`), `m-stack` (+`--sm`, `--lg`), `m-grid-2`, `m-grid-3`, `m-grid-4`, `m-grow`, `m-divider` |
| Text | `m-h1`, `m-h2`, `m-h3`, `m-muted`, `m-small`, `m-mono`, `m-right`, `m-center`, `m-nowrap` |
| Buttons | `m-btn` (+`--primary`, `--danger`, `--danger-outline`, `--ghost`, `--sm`, `--block`, the `disabled` attribute) |
| Forms | `m-field` (+`is-error`), `m-label`, `m-req`, `m-input`, `m-select`, `m-textarea`, `m-help`, `m-error`, `m-check`, `m-switch`, `m-input-group` |
| Content | `m-card` (`__head`, `__body`, `__foot`), `m-section-title`, `m-table-wrap`, `m-table` (rows `is-selected`, `is-muted`), `m-badge` (+`--primary`, `--success`, `--warning`, `--danger`, `--solid`), `m-tabs`, `m-tab` (+`is-active`), `m-list`, `m-list-item`, `m-avatar`, `m-img`, `m-pagination`, `m-page` |
| Placeholder | `m-placeholder` (+`--tall`): a labeled block standing in for an unchanged part of an existing screen in a quick sketch |
| Feedback | `m-alert` (+`--info`, `--success`, `--warning`, `--danger`), `m-empty`, `m-skeleton` (+`--lg`), `m-spinner`, `m-progress` |
| Overlays | `m-modal` > `m-modal__box` (+`--sm`, `--lg`) > `m-modal__head`, `m-modal__body`, `m-modal__foot`; `m-drawer`; `m-toast` (+`--success`, `--danger`); `m-anchor` > `m-menu` > `m-menu__item` |
| Mobile | `m-mobile`, `m-mobile__bar`, `m-mobile__body`, `m-mobile__foot`, `m-tabbar`, `m-tabbar__item` (+`is-active`) |

Notes:

- Place `m-modal` and `m-drawer` as siblings of the screen's main container, not inside `m-main`.
- A dropdown that must show its options: build it with an `m-anchor` holding a button styled `m-select` and an `m-menu`, because a real `<select>` does not open in a screenshot.
- Images and charts: use `m-img` with one line describing the content. Do not embed images.
- A field with an error: `m-field is-error` plus an `m-error` carrying the exact message.

## Example: adding a field to an existing form

```html
<div class="m-field" data-new data-spec="R1 R2">
  <label class="m-label">Frequency</label>
  <select class="m-select" disabled data-state="auto-off"><option>Every week</option></select>
  <div class="m-anchor" data-state="weekly">
    <button class="m-select m-row m-row--between" type="button" data-set-state="options"><span>Every week</span><span>▾</span></button>
  </div>
  <div class="m-anchor" data-state="options">
    <button class="m-select m-row m-row--between" type="button" data-set-state="weekly"><span>Every week</span><span>▴</span></button>
    <div class="m-menu" style="left: 0; right: 0; top: 100%">
      <div class="m-menu__item" data-set-state="weekly">Every week</div>
      <div class="m-menu__item" data-set-state="biweekly">Every 2 weeks</div>
    </div>
  </div>
</div>
```
