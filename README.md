# AntV Infographic

> Obsidian plugin for rendering infographic diagrams using [@antv/infographic](https://github.com/antvis/Infographic)

[**中文文档**](README.zh.md)

## Installation

### Method 1: Install from the Community Plugin Store (Recommended)

1. Open **Settings → Community plugins** in Obsidian.
2. Click **Browse** and search for **"AntV Infographic"**.
3. Click **Install**, then **Enable**.

> If the plugin doesn't show up in search yet, it may still be under review — use one of the methods below in the meantime.

### Method 2: Pre-built Files Only

1. Download the following files from the [latest release](https://github.com/hcg1023/obsidian-infographic-plus/releases/latest):
   - `main.js`
   - `manifest.json`
   - `styles.css`

2. Create an `antv-infographic-plus` folder in your vault's `.obsidian/plugins/` directory (if it doesn't exist)

3. Place the downloaded files in `.obsidian/plugins/antv-infographic-plus/`

4. Enable the plugin in Obsidian settings

### Method 3: Install via Obsidian BRAT Plugin

Useful for tracking beta builds before they reach the store:

1. Make sure you have installed the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, click the "Add a beta plugin" button and add this plugin's GitHub repository URL:
   ```
   https://github.com/hcg1023/obsidian-infographic-plus
   ```
3. Version Selection
   - Select "Latest version", or install a specific version as needed
4. Click the Add Plugin button and BRAT will automatically download and install the latest version of the plugin

### Method 4: Build from Source

1. Clone the project to your Obsidian plugins directory:
   ```bash
   cd ~/.obsidian/plugins
   git clone https://github.com/hcg1023/obsidian-infographic-plus.git
   cd obsidian-infographic-plus
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Enable the plugin in Obsidian settings

## Usage

### Basic Example

In your Obsidian notes, use the `infographic` code block:

````markdown
```infographic
infographic list-row-simple-horizontal-arrow
data
  items
    - label Step 1
      desc Start
    - label Step 2
      desc In Progress
    - label Step 3
      desc Complete
```
````

### Advanced Example with Template

````markdown
```infographic
infographic chart-bar-plain-text
data
  title 年度营收增长
  desc 展示近三年及本年目标营收对比（单位：亿元）
  items
    - label 2021年
      value 120
      desc 转型初期，稳步试水
      icon lucide/sprout
    - label 2022年
      value 150
      desc 平台优化，效率显著提升
      icon lucide/zap
    - label 2023年
      value 190
      desc 深化数智融合，全面增长
      icon lucide/brain-circuit
    - label 2024年
      value 240
      desc 拓展生态协同，冲击新高
      icon lucide/trophy
theme light
  palette antv
```
````

### Fence Parameters

The opening fence line accepts optional parameters:

````markdown
```infographic width=600 align=center
```
````

- `width=N` — cap the rendering width at `N` pixels (minimum 200). When absent, the block is responsive and fills the available note width.
- `height=N` — fix the block height at `N` pixels (minimum 100). Can be used independently of `width=N`, e.g. ```` ```infographic height=360 ````. You can also drag the top/bottom edge handles to adjust the height; on release the fence line is rewritten with `height=N` (same as width).
- `align=center` — center the block horizontally (default is left-aligned).

Both parameters are also editable interactively: drag the resize handles on the sides of a block to change its width, and use the toolbar center-align button. The change is persisted back into the fence line of your note.

UI strings follow the Obsidian language (English / Simplified Chinese).

### Zoom & Pan

The rendered infographic is interactive:

| Interaction | Behavior |
|---|---|
| Mouse wheel (fit state) | Scrolls the note as usual — the block stays out of the way |
| `Ctrl`/`Cmd` + wheel | Zoom in / out at any time |
| Wheel after zooming in | Keeps zooming (wheel is captured by the block) |
| Drag while zoomed | Pan the diagram |
| Double-click | Reset to fit-width state |
| Toolbar `+` / `−` / fit buttons | Zoom in, zoom out, or reset zoom; **Fit to width** also restores the block to the full note-column width by clearing the `width=N` / `height=N` parameters (session-only in reading mode) |
| Fullscreen viewer | Wheel always zooms; drag pans; export the full image or copy the source |

Open the fullscreen viewer via the toolbar maximize button. The `infographic: Insert infographic template` command inserts a ready-made template into the current note.

## Export

Hover over the rendered infographic (or tap it on mobile) to reveal the toolbar — since mobile has no right-click menu, the toolbar is the only export entry point:

1. **Copy source** - Copy the infographic source code to the clipboard
2. **Copy image** - Copy the infographic (PNG format) to clipboard for pasting into other applications
3. **Export PNG / SVG** - Open the export dialog to download the infographic as a PNG image or an SVG vector file

## Development

### Prerequisites

- Node.js >= 16
- npm or yarn

### Build

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Run linter
npm run lint
```

### Project Structure

```
obsidian-infographic-plus/
├── src/
│   ├── main.ts       # Main plugin code
│   └── settings.ts   # Plugin settings
├── main.js           # Compiled plugin
├── manifest.json     # Plugin manifest
├── styles.css        # Plugin styles
└── package.json      # Dependencies
```

## Options

This plugin uses [@antv/infographic](https://github.com/antvis/Infographic) for rendering. The infographic content is passed directly to the Infographic instance.

### Plugin settings

| Setting | Default | Description |
|---|---|---|
| Drag to resize | on | Show drag handles on block edges to adjust width and height |
| In-note zoom | on | Ctrl/Cmd+wheel zoom, drag to pan, and zoom controls on the toolbar |
| Hover toolbar | on | Show the toolbar with copy, export and zoom actions when hovering a block. Note: with this off there is no copy/export entry |
| Center blocks by default | off | Center blocks horizontally unless overridden by the `align=` fence parameter |


## Features

- Dual syntax: JSON specs and the concise Infographic DSL both work in `infographic` code blocks
- Responsive width — blocks fill the note width, or cap them with the `width=N` fence parameter
- `align=center` fence parameter (and a toolbar toggle) for horizontal centering
- Hover toolbar: copy source, copy image, export PNG/SVG, center-align, zoom controls
- In-note zoom & pan: Ctrl/Cmd+wheel to zoom, zoom buttons, drag to pan, double-click to reset
- Fullscreen viewer with wheel zoom, drag pan and full-image export
- `insert-template` command to scaffold a new infographic block
- Error handling with friendly error placeholder cards
- Requires Obsidian 1.13+

## Acknowledgments

This plugin incorporates code ported and modified from [shuuul/obsidian-infographic](https://github.com/shuuul/obsidian-infographic) (v0.2.0, Apache-2.0) — the dual-syntax parser, the MarkdownRenderChild renderer with resize handling, fence parameter parsing/persistence, and the export/source modals. Ported files carry an Apache-2.0 header notice; see `LICENSE-APACHE-2.0`. Changes: removed the PDF print-snapshot pipeline, reworked toolbar/zoom integration, added PanZoomController and the fullscreen viewer. The remainder of this plugin is MIT licensed.

## License

MIT License

## Credits

- Built with [@antv/infographic](https://github.com/antvis/Infographic)
- Based on [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
