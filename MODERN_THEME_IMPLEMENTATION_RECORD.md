# DT-FMS Modern Theme — Audit and Implementation Record

## Purpose

This record describes the DT-FMS Modern-only desktop UI implementation. Use it as the source of truth when applying the exact same visual system to another application.

The target application has exactly two appearance options:

- Modern Dark
- Modern Light

Classic themes are intentionally not available.

## Design decisions

- One palette family only: warm charcoal and gold for Modern Dark, pale neutral and gold for Modern Light.
- Light and dark mode are independent of application features; changing mode must never change data, permissions, routing, or behavior.
- All content containers are opaque. Transparency is reserved for genuine fixed modal/mobile-navigation backdrops only.
- Buttons are solid, high-contrast action controls. A control must not need hover state to become visible.
- Printed invoice and receipt previews remain white paper documents and are excluded from application-surface theming.
- Existing Tailwind utilities are supported through a scoped compatibility bridge rather than an unsafe global restyle.

## Theme runtime contract

Store only the current mode in local storage:

```text
dt-fms-color-mode = dark | light
```

Set the document data attributes on startup and whenever mode changes:

```ts
document.documentElement.dataset.fmsTheme = 'modern';
document.documentElement.dataset.fmsMode = colorMode;
```

If migrating an application that previously stored a classic theme choice, overwrite it with `modern` once. Remove the Classic/Modern selector from the interface; retain only the light/dark mode control.

## Exact Modern palette

### Modern Dark

```css
--fms-bg: #1d1a18;
--fms-surface: #25211f;
--fms-surface-raised: #2d2825;
--fms-card: #2a2522;
--fms-border: #443c37;
--fms-border-strong: #61554d;
--fms-text: #f5f1ec;
--fms-text-secondary: #d8d0c8;
--fms-text-muted: #ada39a;
--fms-text-inverse: #231f1b;
--fms-primary: #eab308;
--fms-primary-hover: #facc15;
--fms-primary-active: #ca8a04;
--fms-secondary: #eab308;
--fms-success: #22c55e;
--fms-warning: #facc15;
--fms-danger: #fb4f70;
--fms-info: #60a5fa;
--fms-input-bg: #211e1c;
--fms-input-border: #61554d;
--fms-input-focus: #facc15;
--fms-sidebar-bg: #211e1d;
--fms-sidebar-border: #443c37;
--fms-sidebar-active-bg: #4a3716;
--fms-sidebar-active-text: #facc15;
--fms-table-header: #25211f;
--fms-table-row: #2a2522;
--fms-table-row-hover: #37302c;
--fms-overlay: rgba(24, 21, 19, .64);
--fms-shadow: rgba(0, 0, 0, .48);
```

### Modern Light

```css
--fms-bg: #f4f4f7;
--fms-surface: #ffffff;
--fms-surface-raised: #f8f8fa;
--fms-card: #ffffff;
--fms-border: #dfdcd9;
--fms-border-strong: #b7b0aa;
--fms-text: #2b2928;
--fms-text-secondary: #5f5a56;
--fms-text-muted: #7d7670;
--fms-text-inverse: #231f1b;
--fms-primary: #eab308;
--fms-primary-hover: #facc15;
--fms-primary-active: #ca8a04;
--fms-secondary: #eab308;
--fms-success: #16a34a;
--fms-warning: #d99b00;
--fms-danger: #e11d48;
--fms-info: #4f7fd8;
--fms-input-bg: #ffffff;
--fms-input-border: #c3bcb6;
--fms-input-focus: #eab308;
--fms-sidebar-bg: #ecebe9;
--fms-sidebar-border: #dfdcd9;
--fms-sidebar-active-bg: #eee2be;
--fms-sidebar-active-text: #b77900;
--fms-table-header: #f0efed;
--fms-table-row: #ffffff;
--fms-table-row-hover: #f6f1e3;
--fms-overlay: rgba(255, 255, 255, .58);
--fms-shadow: rgba(43, 41, 40, .14);
```

## Semantic CSS primitives

Create these reusable classes instead of recreating styles module-by-module:

| Primitive | Use |
| --- | --- |
| `fms-app-shell` | Main application background and subtle branded gradient |
| `fms-surface` | Header and standard opaque surface |
| `fms-card` | Raised container/card with theme shadow |
| `fms-input` | Semantic input, border, focus, and placeholder treatment |
| `fms-btn` | Shared button sizing, focus, disabled behavior, and transition |
| `fms-btn-primary` | Main positive/action button |
| `fms-btn-accent` | Gold Modern accent action |
| `fms-btn-secondary` | Neutral contained action |
| `fms-btn-warning` | Warning/attention action |
| `fms-btn-danger` | Destructive action |
| `fms-btn-compact` | Dense table/card action modifier |
| `fms-dialog-overlay` / `fms-dialog` | Modal backdrop and panel |
| `fms-table` | Standard table surfaces |
| `fms-sidebar` / `fms-sidebar-active` | Sidebar base and selected navigation item |
| `fms-tab-strip` / `fms-tab` / `fms-tab-active` | Contained tab controls |

## Container and outline rules

- Container outlines use `--fms-border`.
- Inputs use `--fms-input-border` so they remain discoverable in both modes.
- Buttons use a slightly stronger outline derived from `--fms-border-strong`.
- Do not use a heavy outline around all containers in light mode. The intended effect is a subtle hairline border, as in the Modern Light reference.
- Modal panels may use `--fms-border-strong`; their fixed backdrop alone uses `--fms-overlay`.
- Never use `bg-slate-950/80`, `bg-black/80`, or a blur utility for ordinary content cards. Restrict overlay styling to elements that are actually `fixed` backdrops.

## Legacy Tailwind compatibility bridge

When porting a Tailwind UI, add a scoped bridge under `:root[data-fms-mode]`.

Required mappings:

- `bg-slate-950`, `bg-slate-900`, `bg-slate-800`, and `bg-slate-700` map to semantic input/surface/raised/border values.
- Normal content using translucent slate backgrounds remains opaque after mapping.
- Fixed `bg-slate-950/*` and `bg-black/*` elements map to `--fms-overlay`.
- `border-slate-*` maps to `--fms-border`.
- Existing text utilities map to `--fms-text`, `--fms-text-secondary`, and `--fms-text-muted`.
- Emerald maps to success/primary, blue and purple to secondary, cyan and sky to info, amber to warning, and rose/red to danger.
- Existing buttons with slate or colored backgrounds must receive solid semantic backgrounds. Do not keep low-opacity button fills.
- Normalise hover states too: `hover:bg-slate-*`, `hover:text-white`, and `hover:text-slate-*` must not reintroduce unreadable color combinations in light mode.

Do not apply this bridge to receipt/invoice paper preview containers identified as print documents.

## Module-specific additions made in DT-FMS

### Users

- User table rows use `fms-user-row` for an opaque normal and hover state.
- Manage Roles uses `fms-btn fms-btn-accent`.
- Row actions use compact secondary, accent, warning, and danger button variants.
- Delegated-permission notices use semantic info colors for readability in light mode.

### POS

- The mandatory clock-in panel uses `fms-pos-clockin-alert` and `fms-pos-clockin-alert-icon` for an opaque warning callout.
- Remove pulse animation from mandatory-action banners where it harms readability.
- Product, nozzle, category, payment, cart, and checkout controls are solid in their resting state.

### Dashboard and Stock

- Do not use bare text navigation links for actions. Use compact contained buttons.
- Wide transaction tables use a minimum table width plus horizontal scrolling rather than compressing labels or action buttons.

### Shifts and Station Settings

- Shift banner uses `fms-card`.
- Clock-in/save controls use `fms-btn-primary`.
- Secondary management actions use `fms-btn-secondary`.
- Shift tabs use `fms-tab-strip`, `fms-tab`, and `fms-tab-active`.

## Accessibility and responsiveness checklist

- Every button must have a visible resting state, not only hover feedback.
- Every button must have a `:focus-visible` outline based on `--fms-input-focus`.
- Disabled controls must use both disabled behavior and reduced opacity; never use color alone to indicate disabled state.
- Errors use a readable danger surface and text, plus `role="alert"`.
- Horizontal financial and transaction tables need `overflow-x-auto` and a `min-width` that preserves labels.
- Do not use dark veils in light mode outside a real modal backdrop.
- Ensure labels, muted text, and info notices meet legibility expectations in Modern Light.

## Files to replicate

| DT-FMS file | Responsibility |
| --- | --- |
| `src/index.css` | Tokens, semantic primitives, compatibility bridge, module-specific theme helpers |
| `src/hooks/useFmsTheme.ts` | Mode preference and Modern-only migration |
| `src/App.tsx` | Light/dark toggle only; no Classic selector |
| `src/components/AppDialog.tsx` | Themed application dialogs |
| `src/components/Sidebar.tsx` | Semantic sidebar surfaces and active navigation |

## Verification procedure

1. Start in Modern Dark and inspect every primary tab, modal, table, form, and sidebar state.
2. Toggle to Modern Light and repeat the inspection.
3. Confirm there is no Classic option in the UI and an old `dt-fms-theme=classic` preference is overwritten to `modern`.
4. Confirm content cards remain opaque in both modes; open a real modal to confirm its backdrop still works.
5. Confirm primary, secondary, warning, danger, compact, disabled, hover, and keyboard-focus button states.
6. Test narrow application width and verify wide tables scroll horizontally.
7. Test a printed receipt/invoice preview and confirm it remains a white paper document.
8. Run `npm run lint` (`tsc --noEmit`).

