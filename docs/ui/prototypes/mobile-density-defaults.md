# Mobile browse density defaults

Shared mobile chrome now defaults to **dense browse mastheads** (subtitle-scale titles, ~20px) instead of display/title hero sizing.

| Component | Default | Opt-out |
|---|---|---|
| `ScreenHeader` | `compact` + `dense` | `dense={false}` for hero moments |
| `EditionPanelHeader` | `compact` + `dense` | `dense={false}` |
| `BrowseScreenShell` | passes dense masthead | `dense={false}` |
| `UtilityScreenShell` | dense utility masthead | edit shell if needed |
| `EditionSurfaceStack` | `dense` gap rhythm | `dense={false}` |
| `ApiStatusBanner` | `compact` strip | `compact={false}` |

`screenScrollInsets` uses tighter top/gap rhythm (`paddingTop: 8`, `gap: 12`) for tab browse surfaces.

Entity record panels (`EntityEditionPanel`) keep section-scale titles for longform reading beats.
