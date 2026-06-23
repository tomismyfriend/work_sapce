# AGENTS.md

## What this is

An **OpenCode Skill** (not an app). The repository is a set of markdown instruction files (`commands/`, `specs/`, `styles/`) that guide an AI agent to convert Markdown documents into PowerPoint-compatible SVG slides. The only executable code is `scripts/export_pdf.js` and `scripts/export_pptx.js`.

There is no build, test, lint, or typecheck pipeline.

## Architecture

```
SKILL.md                    # Skill entry point (frontmatter + overview)
commands/{quick,analyze,design,generate,export}.md  # Slash command definitions
specs/{svg-compatibility,design-system,page-templates}.md  # Generation rules
styles/{00-index,01..05}.md # 5 preset style definitions
scripts/                    # Node.js export scripts (separate package.json)
```

**Command flow**: `/ppt-quick` runs all steps; or step-by-step: `analyze` -> `design` -> `generate` -> `export`.

**Session state**: `.ppt-session/` (structure.json, design.json). **Output**: `ppt-output/`. Both gitignored.

## SVG-PPT compatibility (critical)

Every generated SVG **must** follow these 5 rules or PPT "Convert to Shape" will break:

1. **Rounded rectangles**: Use `<path>` with bezier curves. Never use `<rect rx="...">`.
2. **Font order**: `Microsoft YaHei, SimHei, PingFang SC, sans-serif` (Windows first).
3. **Text styling**: Use `style="..."` attribute. Avoid `text-anchor` / `dominant-baseline` as standalone attrs.
4. **Colors**: `#RRGGBB` only. Use `fill-opacity` / `stroke-opacity` for transparency. Never `rgba()` or 8-digit hex.
5. **Shadows**: Omit all `filter` / `drop-shadow`. Users add shadows manually in PPT.

Canvas: `1920x1080`, 80px margins, 8px spacing grid. See `specs/design-system.md` and `specs/svg-compatibility.md`.

## SKILL.md gotcha

`allowed-tools` **must** be a single space-separated string, not a YAML list:

```yaml
# Correct
allowed-tools: Read Write Glob Grep Bash WebSearch WebFetch

# WRONG - silently breaks skill loading with no error
allowed-tools:
  - Read
  - Write
```

## Export scripts

```bash
cd scripts && npm install          # installs deps + downloads Chromium
node export_pdf.js ./ppt-output/   # SVG -> PDF (uses Playwright)
node export_pptx.js ./ppt-output/  # SVG -> PPTX (uses pptxgenjs)
```

Deps: `playwright`, `pptxgenjs`, `pdf-lib`. Node >= 16. Cross-platform.

## Preset styles

`极简主义` | `商务咨询` | `科技暗黑` | `瑞士平面` | `品牌蓝` (default)

Each defined in `styles/01..05-*.md`. Custom styles go through `/ppt-design`.
