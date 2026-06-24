---
name: docx-to-md
description: Convert Word .docx files to Markdown with image extraction and OCR
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: cli
---

## What I do

- Convert `.docx` files to clean Markdown
- Extract embedded images to a local `images/` folder (not base64 inline)
- Run OCR on extracted images to embed text descriptions for AI readability
- Preserve headings, lists, links, code blocks, and basic formatting

## When to use me

Use this when the user asks to convert a Word document (`.docx`) to Markdown.

## Installation

This skill is self-contained. All scripts are in `.opencode/skills/docx-to-md/scripts/`.

### First-time setup

```bash
cd .opencode/skills/docx-to-md/scripts
npm install
node setup.js
```

This will:
1. Install dependencies (mammoth, turndown, tesseract.js@5)
2. Download Chinese + English OCR language packs (~30MB compressed)

Note: tesseract.js@5 expects `.traineddata.gz` files (compressed). Do not decompress them.

### Global installation

To make this skill available in all projects:

```powershell
# Copy to global OpenCode skills directory
Copy-Item -Recurse ".opencode\skills\docx-to-md" "$env:USERPROFILE\.config\opencode\skills\docx-to-md"

# Run setup in the global location
cd "$env:USERPROFILE\.config\opencode\skills\docx-to-md\scripts"
npm install
node setup.js
```

## Usage

### Step 1: Convert docx to markdown

```bash
node .opencode/skills/docx-to-md/scripts/convert.js input.docx output.md images/
```

- Images extracted to `images/` directory
- Image references use relative paths: `![](images/image_001.png)`
- Underscore escaping disabled to avoid `\_` in code content
- EMF images extracted but not displayable in browsers

### Step 2: OCR image content

```bash
node .opencode/skills/docx-to-md/scripts/ocr.js images/ ocr_results.json
```

- Uses tesseract.js@5 with `chi_sim+eng` languages
- Outputs JSON with filename → extracted text mapping

### Step 3: Embed OCR results

Insert `<details>` blocks below each image reference:

```markdown
![](images/image_001.png)

<details>
<summary>图片内容（OCR提取）</summary>

\`\`\`
[OCR extracted text - manually clean up garbled characters]
\`\`\`

</details>
```

### Step 4: Post-processing

- **Manually review and clean up OCR output** — Tesseract produces garbled characters for mixed Chinese+code diagrams
- Fix hex values (e.g., `gx28` → `0x28`, `6x28` → `0x28`)
- Fix function names and code identifiers
- EMF images cannot be OCR'd — note this in the details block

## Limitations

- **Tesseract OCR quality is poor for technical diagrams** with mixed Chinese text and code. For high-quality results, use a Vision LLM (GPT-4o, Gemini, Claude Vision) instead
- Complex tables may not convert cleanly
- EMF format images are not displayable in browsers
- Embedded OLE objects and macros are not converted

## File structure

```
.opencode/skills/docx-to-md/
├── SKILL.md              # This file
└── scripts/
    ├── package.json      # Dependencies
    ├── setup.js          # Downloads tessdata language packs
    ├── convert.js        # Docx → Markdown converter
    ├── ocr.js            # Image OCR processor
    └── tessdata/         # Language data (created by setup.js)
        ├── chi_sim.traineddata.gz  (~19MB)
        └── eng.traineddata.gz      (~10MB)
```

Total package size: ~30MB (mostly language data).
