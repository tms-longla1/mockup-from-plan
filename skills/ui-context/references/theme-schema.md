# theme.json structure

```json
{
  "source": "web/tailwind.config.ts, web/src/components/layout/sidebar.tsx",
  "allowEmoji": false,
  "notes": "Short notes on the style: table density, primary button style, icon style.",
  "tokens": {
    "c-bg": "#f8fafc",
    "c-primary": "#2563eb"
  }
}
```

`tokens` holds CSS variable names without the `--` prefix. The build script turns them into `:root { --c-bg: ...; }`. Values must not contain `;`, `{`, `}` or `<`.

In `new-product` mode `inputs.mjs` creates this file with `"source": "kit-default"` and empty `tokens`; leave it as is.

## Tokens

| Token | Required | Meaning |
|---|---|---|
| `c-bg` | yes | Page background |
| `c-surface` | yes | Background of cards, tables, dialogs |
| `c-surface-2` | | Secondary background: table header, disabled field |
| `c-border` | yes | Borders |
| `c-text` | yes | Main text |
| `c-text-muted` | yes | Secondary text |
| `c-primary` | yes | Color of `.m-btn--primary`, links, the selected tab |
| `c-primary-text` | | Text on a `c-primary` background |
| `c-primary-soft` | | Light tint of the primary color |
| `c-danger`, `c-danger-soft` | | Errors, deletion |
| `c-success`, `c-success-soft` | | Success |
| `c-warning`, `c-warning-soft` | | Warnings |
| `c-nav-bg`, `c-nav-text` | | Sidebar background and text |
| `c-nav-active-bg`, `c-nav-active-text` | | Selected menu item |
| `font` | yes | The app's font stack. The mockup loads no fonts from the network, so always end with system fonts |
| `font-mono` | | Font for codes and numbers |
| `font-size` | | Base font size, default `14px` |
| `radius`, `radius-sm` | | Corner radius |
| `shadow`, `shadow-lg` | | Shadow of cards and dialogs. Set `none` for a flat app |
| `nav-width` | | Sidebar width |

If the app has several button colors (for example an orange primary button and a blue export button), put the most common main-action color into `c-primary` and define the other buttons in `custom.css`.
