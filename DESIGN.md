# Tallya Design Guide

Tallya is a quiet desktop tool for local work memory. The interface should feel focused, light, and close to the operating system, not like a web admin panel or marketing site.

## Product Positioning

Tallya / 职迹 is a local-first AI work memory tool. It helps users turn daily work notes into searchable, reviewable local work memory that can later support report generation.

Tallya is not:

- A back-office management system.
- A SaaS marketing site.
- A generic daily-report generator.
- A project management system.

The home screen's core task is always:

> 今天做了什么？

## Entry Model (current architecture)

Tallya records work as **entries**, not one record per day. See `docs/PLAN.md` for the full plan.

- An entry is one low-friction note: text + timestamp. Capture has no required fields and no AI gate — typing and pressing Enter saves it.
- The home body is the day's entry stream (composer on top, entries newest-first below), not a single textarea.
- **Clarifications** attach detail to an entry without rewriting it (AI-asked or manual). They show as quiet sub-items under the entry.
- AI is an optional enhancement: it suggests follow-up questions ("追问"), it never blocks capture and never invents content. Without AI configured, "补充" degrades to a manual input.
- Search (Spotlight) spans entries and their clarifications, backed by SQLite FTS5.
- Reports (daily / weekly / custom range) are generated on top of entries, with preview, save, history, and gap-filling follow-ups.

## Product Personality

Tallya is a quiet, restrained, and reliable local work memory assistant.

It does not rush users, create pressure, use exaggerated language, or turn work records into performance supervision. It should feel like a long-term record keeper: gently helping users put down what happened today, then retrieving it later for weekly reports, reviews, performance notes, handoffs, or search.

## Design Principles

- Keep the product minimal, local-first, and non-intrusive.
- Reduce input burden. Optional details should remain optional enhancements, not required form fields.
- Preserve clear information hierarchy.
- Keep the first screen as the actual working surface. Do not add marketing-style hero sections or extra navigation chrome.
- Prefer calm density: enough whitespace for reading, but no oversized cards or decorative empty space.
- Use existing primitives and patterns before inventing new ones.
- Treat layout drift, overlapping text, and inconsistent shell widths as bugs.
- Avoid adding visible instructional copy unless it helps the current task.
- Do not pile up feature entry points.
- If a button has no executable value, do not show it.
- Default states should stay light. Complex capabilities belong in secondary entry points.

## Shell And Home

- The home layout is intentionally minimal: one compact toolbar and one main work body.
- Do not adjust the home UI while working on unrelated surfaces such as settings, reports, or data tools.
- Keep toolbar actions small, quiet, and icon-led where appropriate.
- All clickable elements must include `cursor-pointer`; disabled states use `cursor-not-allowed`.
- The home screen is the day's entry stream: a composer plus the current day's entries. History (other days) is reached via the toolbar date switch; search is a secondary entry point.
- Search should use a Spotlight / Command Palette pattern.
- Do not use disabled buttons as placeholders for future features.

## Visual Rules

- Use a light neutral background.
- Use white or near-white cards and surfaces.
- Keep borders light.
- Keep shadows restrained.
- Use the black primary button only for the primary action.
- Use `ghost` or text-like styling for secondary actions.
- Avoid large blue areas, gradients, and complex icons.
- Do not make lightweight tools look like back-office systems.
- Do not make form controls visually heavier than the surrounding content.

## Dialogs

- Use shadcn `Dialog` for modal surfaces inside the main Tauri window.
- Do not create new Tauri windows for settings or lightweight task flows.
- Dialog overlays should reuse the memory overlay style:
  - `overlayClassName="tallya-memory-overlay"`
  - `className` includes `tallya-dialog-content`
- Dialog title sections should follow the memory detail dialog:
  - Header: `shrink-0 gap-1.5 px-6 pt-5 pb-4`
  - Title: `text-lg leading-6 font-semibold tracking-normal text-app-ink`
  - Description: `text-[13px] leading-[1.5] text-app-ink-muted`
- Avoid heavy shadows beyond the established dialog shadow tokens.
- Keep close buttons in the top-right corner.

## Settings Dialog

- Settings uses a left grouped menu plus right content pane. Do not use top Tabs.
- Dialog size:
  - `width: min(760px, calc(100vw - 48px))`
  - `height: min(600px, calc(100vh - 64px))`
- The dialog must stay within the visible Tauri window.
- The right pane scrolls with `TallyaScrollArea` when content overflows.
- Left menu:
  - Width around `144px`.
  - Item height around `36px`.
  - Default background transparent.
  - Hover background `#F8FAFC`.
  - Selected background `#F1F5F9`, text weight `600`.
  - No oversized white pill blocks or admin-sidebar styling.
- Right content:
  - Use lightweight setting rows, not heavy cards.
  - Labels are 14px and semibold.
  - Descriptions use muted text.
  - Keep related actions and status text visually grouped.
  - Avoid repeating the left menu label as unnecessary large page chrome.
- Use segmented controls instead of a Select when there are only a few fixed choices and the control fits comfortably.
- Dangerous actions must use a confirmation dialog.
- Do not expose development-only Mock Provider choices.

## Forms And Controls

- Use shadcn components generated by the CLI when adding new primitives.
- Inputs, Selects, Switches, and Buttons should match the current quiet surface style.
- Prefer Tailwind 4 canonical classes where available; avoid arbitrary px classes when a canonical class exists.
- Do not expose mock or development-only providers in user-facing settings.

## Data And AI

- User-visible AI providers are Codex CLI, OpenAI Compatible, and Claude / Anthropic. Do not expose Mock or unfinished providers.
- Structure AI settings as provider management first, provider-specific configuration second.
- Do not expose Mock or development-only providers in user-facing settings.
- Settings persistence must go through repository/service modules, not direct component storage access.
- Codex command uses an internal default unless an explicit advanced setting is requested. Do not expose command-path configuration in the lightweight settings UI.
- Provider health checks should use a shared model such as `unknown`, `checking`, `available`, and `unavailable`.
- AI failures should show friendly messages and preserve user input.
- Test generation from settings must not save a formal work memory.

## Copy

- Use concise Chinese labels.
- Copy should be gentle, restrained, and clear.
- Avoid bossy, supervisory, overexcited, or overly cute language.
- Avoid words such as `必须`, `立即`, `马上`, `赶紧`, and avoid unnecessary exclamation marks.
- Reminder copy should prefer soft openings such as `可以...`.
- Prefer words such as `沉淀`, `整理`, `回顾`, `留下`, and `继续跟进`.
- Do not make users feel like they missed an obligation.
- Do not use `日报` as the core product concept. Prefer `工作记忆`, `沉淀`, and `整理`.
- Status text should be explicit and close to its related action, for example:
  - `状态：尚未检测`
  - `状态：可用`
  - `状态：配置异常`
  - `状态：检测失败`
- Do not imply future system integrations are already active. Use light notes such as:
  - `提醒配置会保存在本机，系统通知能力将在接入后生效。`
  - `部分启动与托盘行为需要系统权限支持。`
- Copy examples:
  - Avoid: `快来填写今天的日报！`
  - Avoid: `你还没有记录工作！`
  - Avoid: `立即生成周报！`
  - Prefer: `可以花一分钟沉淀一下今天的工作。`
  - Prefer: `今天还没有工作记忆。`
  - Prefer: `可以整理一下这周的工作脉络了。`

## Code Organization

- TSX files should stay focused. When a component grows, split it by responsibility into smaller files.
- Keep Dialog shells small; move content sections, menu, confirmation dialogs, and state hooks into separate files.
- Split pages, dialogs, panels, lists, list items, and settings groups by responsibility.
- Keep UI display components as pure as practical.
- Business logic belongs in service / repository / provider modules.
- Do not call `localStorage`, Tauri commands, shell operations, or AI providers directly from UI components.
- AI Provider, settings, and memory storage must each have independent modules.
- Avoid unrelated refactors while implementing a scoped UI change.
- Keep generated shadcn primitives consistent with project cursor rules after generation.
- `src/components/ui` is only for shadcn base components. Do not put business components there.
- Business UI components belong under `src/features/work-memory/components`.
- Settings UI components belong under `src/features/work-memory/components/settings`.
- AI Provider logic belongs under `src/features/work-memory/services/ai`.

## Directory Boundaries

- `src/features/work-memory/components`: business UI components.
- `src/features/work-memory/components/settings`: settings page components.
- `src/features/work-memory/hooks`: page state and interaction hooks.
- `src/features/work-memory/services`: business services, repositories, AI providers, and window capabilities.
- `src/features/work-memory/services/ai`: AI Provider, AI Service, Codex CLI Provider, Mock Provider, and related tests.
- `src/components/ui`: shadcn base components only; no business components.

## Verification

- Do not run `pnpm tauri dev`.
- Do not start a new dev server for browser checks. Use the already-running `http://localhost:1420`.
- For frontend logic or layout changes, run type-check and lint.
- For backend command changes, run `cargo check`.
