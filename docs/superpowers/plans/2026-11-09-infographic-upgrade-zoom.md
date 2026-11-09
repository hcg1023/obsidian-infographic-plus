# Infographic 升级与缩放查看 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 obsidian-infographic 升级到 @antv/infographic 0.2.20、对齐上游 shuuul v0.2.0 的成熟架构（生命周期/双语法/响应式/工具栏/fence 参数），并新增 CSS transform 视图层缩放 + 全屏查看器（参考 Obsidian 1.15 原生 Mermaid 交互）。

**Architecture:** MarkdownRenderChild（`renderer/InfographicView.ts`）管理库实例生命周期与响应式宽度；新增 `PanZoomController` 以 `transform: translate+scale` 实现缩放平移（不触发 ResizeObserver、不污染导出），笔记内与全屏 Modal 双场景复用；`fence.ts` 承担 fence 参数解析与唯一定位回写；`ui/` 提供 Toolbar/ExportModal/SourceModal；入口 `main.ts` 只做接线。

**Tech Stack:** TypeScript (strict)、Obsidian Plugin API 1.13+（声明式设置）、@antv/infographic 0.2.20（SVG 渲染）、esbuild、npm。

**Spec:** `docs/superpowers/specs/2026-11-09-infographic-upgrade-zoom-design.md`（本计划从 spec 出发，执行者须同时阅读 spec）

## Global Constraints

- `manifest.json`：`minAppVersion` 改为 `"1.13.0"`；`isDesktopOnly` 保持 `false`；`id` 保持 `antv-infographic` 不变；`version` 在 Task 10 才 bump 到 `1.1.0`。
- `package.json`：`@antv/infographic` 固定 `"0.2.20"`（精确 pin，防行为漂移）；`obsidian` 改 `"^1.13.1"`。包管理器只用 npm。
- **本项目无测试框架，禁止引入**（repo AGENTS.md + spec §10）。验证三板斧：① `npm run build`（tsc -noEmit + esbuild，必须零错误）；② 纯逻辑模块用一次性 node 断言脚本验证（jiti 已是 devDependency，`node --input-type=module -e` 或 heredoc 执行，脚本不落盘）；③ DOM/Obsidian 表面用手动冒烟（见下）。
- 手动冒烟标准流程（下称「标准冒烟」）：`npm run build` 后把 `main.js`、`manifest.json`、`styles.css` 复制到 `<VAULT>/.obsidian/plugins/antv-infographic/`（VAULT 路径在 Task 1 向用户确认一次，后续复用），Obsidian 内重载插件（或 Ctrl/Cmd+P → "Reload app without saving"），在测试笔记中粘贴验证内容。测试笔记内容固定为：

````markdown
```infographic width=500 align=center
{
  "template": "list-row-simple-horizontal-arrow",
  "data": {
    "items": [
      { "label": "Step 1", "desc": "Start" },
      { "label": "Step 2", "desc": "In Progress" },
      { "label": "Step 3", "desc": "Complete" }
    ]
  }
}
```

```infographic
infographic chart-bar-plain-text
data
  title Annual Revenue
  items
    - label 2023
      value 190
    - label 2024
      value 240
```

```infographic
{ "template": "invalid json"
```
````

- 凡移植/改写自上游 shuuul/obsidian-infographic 的文件，**文件首行**必须是：
  `// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.`
- 上游源码位置：`/tmp/upstream-infographic`。若目录不存在，先执行 `git clone --depth 1 https://github.com/shuuul/obsidian-infographic /tmp/upstream-infographic`。移植任务引用其行号均以此克隆为准。
- 用户可见文案：Notice 用简体中文（沿用现状），设置项 name/desc 用英文（Obsidian 惯例，与上游一致）。
- 每个 Task 结束时 `npm run build` 必须绿，然后 commit（conventional commits：feat:/fix:/chore:/docs:）。禁止提交 `main.js`/`data.json`（已 gitignore）。
- 命令与设置 ID 一旦发布不改名：命令 `insert-template`；设置键 `theme`、`errorBehavior`。

---

### Task 1: 依赖升级与许可合规清理

**Files:**
- Modify: `package.json`（dependencies 两个版本）
- Modify: `LICENSE`（换标准 MIT）
- Create: `LICENSE-APACHE-2.0`（上游 LICENSE 原文）
- Modify: `manifest.json`（minAppVersion）

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: 依赖锁定 `@antv/infographic@0.2.20` + `obsidian@^1.13.1`，后续所有任务在此环境编译。

- [ ] **Step 1: 改 package.json 依赖**

```diff
-		"@antv/infographic": "^0.2.7",
-		"obsidian": "latest"
+		"@antv/infographic": "0.2.20",
+		"obsidian": "^1.13.1"
```

- [ ] **Step 2: 改 manifest.json**

`"minAppVersion": "0.15.0"` → `"minAppVersion": "1.13.0"`（其余字段不动）。

- [ ] **Step 3: 替换 LICENSE 为标准 MIT**

现有 LICENSE 是 Obsidian 样例模板的 Dynalist Inc. 文本（名实不符，spec §8）。整体替换为：

```
MIT License

Copyright (c) 2026 hcg1023

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: 新增 LICENSE-APACHE-2.0**

`cp /tmp/upstream-infographic/LICENSE LICENSE-APACHE-2.0`（若克隆不存在先按 Global Constraints 克隆）。确认文件首两行为 `Apache License` / `Version 2.0, January 2004`。

- [ ] **Step 5: 安装并构建**

Run: `npm install && npm run build`
Expected: 安装成功，`@antv/infographic@0.2.20` 落盘，tsc + esbuild 零错误（旧代码 `toDataURL({type:'svg', embedResources:true, removeIds:false})` 在 0.2.20 类型下仍合法——`exporter/types.d.ts` 有这三个字段）。

- [ ] **Step 6: 升级回归冒烟**

向用户确认测试 VAULT 路径；执行标准冒烟。检查：JSON 块、DSL 块（`chart-bar-plain-text`）照常渲染；右键菜单复制/导出仍可用（旧代码此时尚未重写）；非法 JSON 块显示"渲染失败"错误文本（现状行为，Task 8 才升级三模式）。若 DSL 示例渲染异常，立即停下报告（对应 spec R9），不得继续。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json LICENSE LICENSE-APACHE-2.0 manifest.json
git commit -m "chore: bump @antv/infographic to 0.2.20, require Obsidian 1.13, fix licensing"
```

---

### Task 2: 双语法解析器 + fence 参数模块（纯逻辑）

**Files:**
- Create: `src/parser/InfographicParser.ts`
- Create: `src/parser/index.ts`
- Create: `src/fence.ts`

**Interfaces:**
- Consumes: `@antv/infographic` 的 `parseSyntax`（不需要，parser 只做 JSON 嗅探）；无前序任务接口。
- Produces:
  - `parseInfographicSpec(source: string): ParseResult`，`ParseResult = {success: true; content: string; isJson: boolean} | {success: false; error: string}`
  - `showParseError(error: string): void`
  - `isInfographicFence(line: string): boolean`
  - `parseWidthParam(fence: string): number | null`
  - `setFenceWidth(fence: string, width: number): string`
  - `getFenceAlign(fence: string): "center" | "left" | null`
  - `setFenceAlign(fence: string, align: "center" | "left" | null): string`
  - `resolveFenceText(app: App, ctx: MarkdownPostProcessorContext, el: HTMLElement, source: string): string | null`
  - `persistFenceUpdate(app: App, ctx: MarkdownPostProcessorContext, el: HTMLElement, source: string, update: (fence: string) => string): void`
  - `persistBlockWidth(app, ctx, el, source, width: number): void`

- [ ] **Step 1: 移植 parser**

`mkdir -p src/parser`；把 `/tmp/upstream-infographic/src/parser/InfographicParser.ts` 全文复制到 `src/parser/InfographicParser.ts`，文件头加 Apache-2.0 署名注释（Global Constraints 格式）。`src/parser/index.ts`：

```ts
export { parseInfographicSpec, showParseError } from "./InfographicParser";
export type { ParseResult } from "./InfographicParser";
```

- [ ] **Step 2: 移植 fence.ts**

创建 `src/fence.ts`，文件头加署名注释。内容 = 上游 `src/main.ts` 的三段迁移：

1. 纯字符串函数逐字复制：`setFenceWidth`（U main.ts:22-28）、`setFenceAlign`（35-42）、`getFenceAlign`（48-51）、`isInfographicFence`（54-56）、`parseWidthParam`（59-64）、`findUniqueSectionStart`（71-92）、`findUniqueBlockFence`（100-122）。
2. `resolveFenceText`（U main.ts:396-406）与 `persistFenceUpdate`（414-449）：方法体逐字复制，仅做两处机械替换——`this.app` → 参数 `app`，方法签名加 `app: App` 前缀参数；`import type { App, Editor, MarkdownPostProcessorContext } from "obsidian"`。
3. 追加：

```ts
export function persistBlockWidth(
	app: App,
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	source: string,
	width: number,
): void {
	persistFenceUpdate(app, ctx, el, source, (fence) => setFenceWidth(fence, width));
}
```

- [ ] **Step 3: 纯逻辑断言（不落盘脚本）**

Run（在仓库根目录）:

```bash
node --input-type=module -e "
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const f = await jiti.import('./src/fence.ts');
const p = await jiti.import('./src/parser/index.ts');
const assert = (await import('node:assert')).strict;

// fence 宽度
assert.equal(f.setFenceWidth('\`\`\`infographic', 500), '\`\`\`infographic width=500');
assert.equal(f.parseWidthParam('\`\`\`infographic width=600'), 600);
assert.equal(f.parseWidthParam('\`\`\`infographic width=100'), null); // <200 视为无
assert.equal(f.setFenceWidth('\`\`\`infographic width=600 align=center', 320), '\`\`\`infographic align=center width=320');
// fence 对齐
assert.equal(f.getFenceAlign('\`\`\`infographic align=center'), 'center');
assert.equal(f.getFenceAlign('\`\`\`infographic'), null);
assert.equal(f.setFenceAlign('\`\`\`infographic width=600', 'left'), '\`\`\`infographic width=600 align=left');
assert.equal(f.setFenceAlign('\`\`\`infographic align=center', null), '\`\`\`infographic');
assert.equal(f.isInfographicFence('  \`\`\`infographic width=1'), true);
assert.equal(f.isInfographicFence('\`\`\`json'), false);
// parser 双语法
const ok = p.parseInfographicSpec('{ \"template\": \"x\" }');
assert.deepEqual(ok, { success: true, content: '{ \"template\": \"x\" }', isJson: true });
assert.equal(p.parseInfographicSpec('infographic list-x').isJson, false);
assert.equal(p.parseInfographicSpec('').success, false);
assert.equal(p.parseInfographicSpec('{ bad').success, false);
console.log('fence+parser assertions passed');
"
```

Expected: 输出 `fence+parser assertions passed`。任何断言失败 → 对照上游实现修 `src/fence.ts`，不得改断言迁就实现。

- [ ] **Step 4: 构建并提交**

Run: `npm run build` → 零错误。

```bash
git add src/parser src/fence.ts
git commit -m "feat: port dual-syntax parser and fence parameter module from upstream"
```

---

### Task 3: 声明式设置与 defaultTheme 迁移

**Files:**
- Rewrite: `src/settings.ts`
- Modify: `src/main.ts`（仅 loadSettings/saveSettings 两方法替换；其余旧代码 Task 8 统一重写）

**Interfaces:**
- Consumes: Obsidian 1.13 `SettingDefinitionItem` 声明式设置 API。
- Produces:
  - `type ThemeSetting = "auto" | "light" | "dark"`
  - `type ErrorBehavior = "show-code" | "show-error" | "hide"`
  - `interface InfographicSettings { theme: ThemeSetting; errorBehavior: ErrorBehavior }`
  - `const DEFAULT_SETTINGS: InfographicSettings = { theme: "auto", errorBehavior: "show-code" }`
  - `class InfographicSettingTab extends PluginSettingTab`（`getSettingDefinitions()`）

- [ ] **Step 1: 重写 src/settings.ts**

```ts
// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type InfographicPlugin from "./main";

export type ThemeSetting = "auto" | "light" | "dark";
export type ErrorBehavior = "show-code" | "show-error" | "hide";

export interface InfographicSettings {
	theme: ThemeSetting;
	errorBehavior: ErrorBehavior;
}

export const DEFAULT_SETTINGS: InfographicSettings = {
	theme: "auto",
	errorBehavior: "show-code",
};

export class InfographicSettingTab extends PluginSettingTab {
	plugin: InfographicPlugin;

	constructor(app: App, plugin: InfographicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Theme",
				desc: "Color theme for infographics",
				control: {
					key: "theme",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.theme,
					options: { auto: "Auto (follow Obsidian)", light: "Light", dark: "Dark" },
				},
			},
			{
				name: "Error behavior",
				desc: "What to display when an infographic fails to render",
				control: {
					key: "errorBehavior",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.errorBehavior,
					options: {
						"show-code": "Show source code",
						"show-error": "Show error message only",
						hide: "Hide block entirely",
					},
				},
			},
		];
	}
}
```

- [ ] **Step 2: 替换 src/main.ts 的设置读写（含迁移）**

把现有 `loadSettings`/`saveSettings`（src/main.ts:24-30）替换为：

```ts
	async loadSettings() {
		const data = await this.loadData() as (Partial<InfographicSettings> & { defaultTheme?: string }) | null;
		let theme: ThemeSetting = DEFAULT_SETTINGS.theme;
		if (data?.theme === "auto" || data?.theme === "light" || data?.theme === "dark") {
			theme = data.theme;
		} else if (data?.defaultTheme === "light" || data?.defaultTheme === "dark") {
			// 旧版 defaultTheme 迁移：显式 light/dark 保留，其余（含 'default'）归 auto
			theme = data.defaultTheme;
		}
		this.settings = {
			theme,
			errorBehavior: data?.errorBehavior ?? DEFAULT_SETTINGS.errorBehavior,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
```

同时更新 `src/main.ts` 头部 import 与类型：`settings: InfographicSettings`，`import { DEFAULT_SETTINGS, InfographicSettings, InfographicSettingTab, ThemeSetting } from './settings'`。**注意**：旧 `settingsToOptions()`（src/main.ts:168-169）引用了被删的 `defaultTheme`——本步把它改为返回 `{}`（Task 8 整体删除前保持编译绿）：

```ts
	private settingsToOptions(): Partial<InfographicOptions> {
		return {};
	}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 零错误。若 `SettingDefinitionItem` 类型不存在，说明 obsidian 依赖未到 1.13——回查 Task 1。

- [ ] **Step 4: 冒烟**

标准冒烟：设置 → Community plugins → Antv Infographic 出现 Theme（Auto/Light/Dark）与 Error behavior 两项且可修改、重载后保留；控制台无 defaultTheme 报错。

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts src/main.ts
git commit -m "feat: declarative settings with auto theme and old defaultTheme migration"
```

---

### Task 4: InfographicView（MarkdownRenderChild + 响应式 + 错误订阅 + 拖宽手柄）

**Files:**
- Create: `src/renderer/InfographicView.ts`
- Create: `src/renderer/index.ts`
- Create: `src/ui/ErrorPlaceholder.ts`
- Create: `src/ui/index.ts`
- Create: `src/types/obsidian-window.ts`
- Create: `src/styles` 无——样式统一在 Task 6 的 `styles.css`。

**Interfaces:**
- Consumes: `parseInfographicSpec`（Task 2）；`InfographicSettings`（Task 3）。
- Produces:
  - `interface RenderOptions { content: string; isJson: boolean; theme: ThemeSetting; isDarkMode: boolean; explicitWidth?: number; onWidthCommit?: (width: number) => void; onRenderError?: (message: string) => void }`
  - `class InfographicRenderChild extends MarkdownRenderChild`：`ensureStarted()`、`getInfographic(): Infographic | null`
  - `interface RenderPayload { content: string; isJson: boolean; theme?: string; width: number; height: number; explicitWidth?: number }`
  - `function renderInfographicInto(container: HTMLElement, payload: RenderPayload): Infographic`（Task 9 全屏 Modal 复用）
  - `interface ErrorPlaceholderOptions { message: string; onDetails?: () => void }`
  - `function createErrorPlaceholder(parent: HTMLElement, options: ErrorPlaceholderOptions): void`（Task 8 解析错误路径复用；spec §3 错误占位卡）
- 本任务**不含** PanZoom 集成（Task 6 做）、**不含** print 快照（spec 砍单）。

- [ ] **Step 1: 建骨架与移植**

`mkdir -p src/renderer src/types src/ui`。`src/types/obsidian-window.ts` = 上游同名文件逐字复制（22 行，含 `declare global` Window.createEl 等 5 个_augments），文件头加署名注释。

`src/renderer/InfographicView.ts` 以 `/tmp/upstream-infographic/src/renderer/InfographicView.ts`（346 行）为底本，文件头加署名注释，按以下清单改造（其余逐字保留）：

1. **删除** print 相关：import `persistSnapshotDataUrl`；`RenderOptions` 的 `app`、`cacheDir` 字段；字段 `snapshotRefreshTimer`；方法 `getPrintContainerEl`/`setPrintSnapshot`/`schedulePrintSnapshotRefresh`/`generatePrintSnapshot`（282-345 行）；`render()` 内的 `this.schedulePrintSnapshotRefresh()` 调用；`cleanup()` 内 timer 清理段（RO 段保留）。
2. **改 RenderOptions** 为 Produces 所列形状（去掉 `isPrinting`，本任务不需要）。
3. **错误订阅（spec R5）**：`render()` 中 `new Infographic(...)` 后立即（注意走 `reportRenderError` 统一分发，见第 5 条）：

```ts
			instance.on("error", (error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[Infographic Plugin] Render error event:", message);
				this.hideLoading();
				this.reportRenderError(message);
			});
```
（`render()` 的 catch 分支里原来的 `this.renderError(message)` 同样改为 `this.reportRenderError(message)`。）

4. **抽出 `renderInfographicInto`**：把 `render()` 里 JSON/DSL 两分支的实例构造逻辑提为模块级导出函数（JSON 分支的 strip width/height/theme 逻辑保留），`render()` 调用它：

```ts
export interface RenderPayload {
	content: string;
	isJson: boolean;
	theme?: string;
	width: number;
	height: number;
	explicitWidth?: number;
}

interface ParsedInfographicConfig {
	width?: number;
	height?: number;
	theme?: string;
	template?: string;
	data?: InfographicOptions["data"];
}

/** 创建并渲染一个 Infographic 实例（JSON 走 parse+strip，DSL 直接 render）。 */
export function renderInfographicInto(container: HTMLElement, payload: RenderPayload): Infographic {
	if (payload.isJson) {
		const parsed = JSON.parse(payload.content) as ParsedInfographicConfig;
		const { width: jsonWidth, height: jsonHeight, theme: jsonTheme, ...rest } = parsed;
		const instance = new Infographic({
			container,
			width: payload.explicitWidth ?? jsonWidth ?? payload.width,
			height: payload.explicitWidth ? payload.width / (payload.width / payload.height) : jsonHeight ?? payload.height,
			theme: jsonTheme ?? payload.theme,
			...rest,
		});
		instance.render();
		return instance;
	}
	const instance = new Infographic({ container, width: payload.width, height: payload.height, theme: payload.theme });
	instance.render(payload.content);
	return instance;
}
```

`render()` 内改为：`this.infographic = renderInfographicInto(this.containerEl, { content, isJson, theme, width, height, explicitWidth })` 后接第 3 条的错误订阅（订阅的是 `this.infographic`）。

5. **错误占位卡与零高度兜底（spec §3 错误占位卡、R12）**——先建共享占位组件 `src/ui/ErrorPlaceholder.ts`：

```ts
import { setIcon } from "obsidian";

export interface ErrorPlaceholderOptions {
	message: string;
	/** 可选"View details"动作（如打开 SourceCodeModal） */
	onDetails?: () => void;
}

/**
 * 统一错误占位卡：解析失败/渲染失败/零高度产物都渲染它，
 * 绝不留高度为 0 的透明块或空白占位（spec §3）。
 */
export function createErrorPlaceholder(parent: HTMLElement, options: ErrorPlaceholderOptions): void {
	parent.addClass("infographic-error-block");
	const header = parent.createDiv({ cls: "infographic-error-header" });
	const icon = header.createSpan({ cls: "infographic-error-icon" });
	setIcon(icon, "circle-alert");
	header.createSpan({ text: `Error: ${options.message}` });
	if (options.onDetails) {
		const detailsBtn = parent.createEl("button", { text: "View details", cls: "infographic-error-details-btn" });
		detailsBtn.addEventListener("click", options.onDetails);
	}
}
```

`src/ui/index.ts`（Task 7 会追加其余导出）：

```ts
export { createErrorPlaceholder } from "./ErrorPlaceholder";
export type { ErrorPlaceholderOptions } from "./ErrorPlaceholder";
```

然后给 `InfographicRenderChild` 加三个成员（import `createErrorPlaceholder` 自 `../ui/ErrorPlaceholder`）：

```ts
	/** 渲染失败统一出口：优先交宿主（走错误三模式），否则本地占位卡兜底 */
	private reportRenderError(message: string): void {
		if (this.options.onRenderError) {
			this.options.onRenderError(message);
			return;
		}
		this.renderError(message);
	}

	private renderError(message: string): void {
		this.containerEl.empty();
		createErrorPlaceholder(this.containerEl, { message: `Failed to render infographic: ${message}` });
	}

	/**
	 * 零高度兜底：库对未知模板名等可能不报错只产出空 SVG（spec R12）。
	 * 渲染后 rAF 检查 svg 缺失或高度 <1px，按渲染失败走占位卡。
	 */
	private scheduleRenderSanityCheck(): void {
		const win = this.containerEl.ownerDocument.defaultView;
		if (!win) return;
		win.requestAnimationFrame(() => {
			if (!this.infographic || !this.containerEl.isConnected) return;
			const svg = this.containerEl.querySelector("svg");
			const height = svg?.getBoundingClientRect().height ?? 0;
			if (!svg || height < 1) {
				this.hideLoading();
				this.reportRenderError("渲染结果为空（请检查 template 模板名与数据是否有效）");
			}
		});
	}
```

（上游原有的 `renderError` 方法体替换为上面的新实现。）`render()` 成功路径末尾（`updateAspectRatioFromSVG()` 调用之后）追加 `this.scheduleRenderSanityCheck();`。

6. **拖宽期间不逐帧重渲染（spec R4）**：加字段 `private isResizing = false;`；`setupResizeHandles` 的 `pointerdown` 回调开头加 `this.isResizing = true;`；`onEnd` 末尾改为：

```ts
				this.isResizing = false;
				this.applyWrapperWidth(wrapper, latestWidth);
				// 拖拽期间 RO 被门控，松手一次性按新宽度重渲染
				if (this.infographic) {
					this.infographic.update({ width: latestWidth, height: latestWidth / this.aspectRatio });
				}
				this.options.onWidthCommit?.(latestWidth);
```

`setupResizeObserver` 回调开头加门控：`if (this.isResizing) return;`。

7. `cleanup()`（onunload 清理链，spec §9 顺序，本任务暂无 controller，Task 6 补第 1 步）：

```ts
	private cleanup(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.destroyInfographic();
	}
```

`src/renderer/index.ts`：

```ts
export { InfographicRenderChild, renderInfographicInto } from "./InfographicView";
export type { RenderOptions, RenderPayload } from "./InfographicView";
```

- [ ] **Step 2: 构建验证**

Run: `npm run build` → 零错误（此文件尚未被 main.ts 引用，属预期）。

- [ ] **Step 3: Commit**

```bash
git add src/renderer src/types src/ui
git commit -m "feat: port InfographicRenderChild with lifecycle, resize observer and error events"
```

---

### Task 5: PanZoomController（视图层缩放平移）

**Files:**
- Create: `src/renderer/PanZoomController.ts`

**Interfaces:**
- Consumes: 无（纯 DOM + 数学，不依赖 obsidian 模块——保证可在 node 中做数学断言）。
- Produces:
  - `interface PanZoomState { readonly scale: number; readonly x: number; readonly y: number }`
  - `interface PanZoomPoint { readonly x: number; readonly y: number }`
  - `interface PanZoomBounds { viewportWidth: number; viewportHeight: number; contentWidth: number; contentHeight: number }`
  - `function clampScale(scale: number, min: number, max: number): number`
  - `function zoomAt(state: PanZoomState, factor: number, anchor: PanZoomPoint, minScale: number, maxScale: number): PanZoomState`
  - `function clampPan(state: PanZoomState, bounds: PanZoomBounds): PanZoomState`
  - `class PanZoomController`：`getState()`、`isZoomed()`、`zoomTo(scale, anchor?)`、`zoomBy(factor, anchor?)`、`panBy(dx, dy)`、`reset()`、`relayout({resetIfZoomed}?)`、`destroy()`
  - `interface PanZoomOptions { viewportEl: HTMLElement; contentEl: HTMLElement; minScale?: number; maxScale?: number; wheelMode?: "when-zoomed" | "always"; onChange?: (state: PanZoomState) => void; onReset?: () => void }`

- [ ] **Step 1: 写数学断言（先红后绿——纯逻辑部分）**

Run:

```bash
node --input-type=module -e "console.log('pending implementation')" 
```

Expected: 输出 pending（模块尚不存在，无法 import——即红）。

- [ ] **Step 2: 实现 src/renderer/PanZoomController.ts（全文）**

```ts
export interface PanZoomState {
	readonly scale: number;
	readonly x: number;
	readonly y: number;
}

export interface PanZoomPoint {
	readonly x: number;
	readonly y: number;
}

export interface PanZoomBounds {
	viewportWidth: number;
	viewportHeight: number;
	contentWidth: number;
	contentHeight: number;
}

export function clampScale(scale: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, scale));
}

/**
 * 锚定缩放：s' = clamp(s * factor)；k = s' / s（触顶后用实际 k 重算，防止光标漂移）；
 * t' = a - k * (a - t)。等价于 @antv/infographic 编辑器的 calculateZoomedViewBox 数学。
 */
export function zoomAt(
	state: PanZoomState,
	factor: number,
	anchor: PanZoomPoint,
	minScale: number,
	maxScale: number,
): PanZoomState {
	const next = clampScale(state.scale * factor, minScale, maxScale);
	const k = next / state.scale;
	return {
		scale: next,
		x: anchor.x - k * (anchor.x - state.x),
		y: anchor.y - k * (anchor.y - state.y),
	};
}

/** scale<=1 归零；scale>1 时把 translate 夹在 [min(0, vp - s*c), max(0, vp - s*c)]。 */
export function clampPan(state: PanZoomState, bounds: PanZoomBounds): PanZoomState {
	if (state.scale <= 1) {
		return { scale: state.scale, x: 0, y: 0 };
	}
	const clampAxis = (t: number, viewport: number, content: number): number => {
		const lo = Math.min(0, viewport - state.scale * content);
		const hi = Math.max(0, viewport - state.scale * content);
		return Math.min(hi, Math.max(lo, t));
	};
	return {
		scale: state.scale,
		x: clampAxis(state.x, bounds.viewportWidth, bounds.contentWidth),
		y: clampAxis(state.y, bounds.viewportHeight, bounds.contentHeight),
	};
}

export interface PanZoomOptions {
	/** overflow:hidden 的裁剪层，接收 wheel/pointer 事件 */
	viewportEl: HTMLElement;
	/** 被 transform 的内容层（SVG 的父级）。Controller 不创建/不拥有 DOM */
	contentEl: HTMLElement;
	minScale?: number;
	maxScale?: number;
	/** scale=1 时不拦截滚轮（笔记内默认）；"always" 供全屏用 */
	wheelMode?: "when-zoomed" | "always";
	onChange?: (state: PanZoomState) => void;
	onReset?: () => void;
}

const WHEEL_ZOOM_RATE = 0.0015;
const EPSILON = 0.0001;

export class PanZoomController {
	private state: PanZoomState = { scale: 1, x: 0, y: 0 };
	private readonly minScale: number;
	private readonly maxScale: number;
	private readonly wheelMode: "when-zoomed" | "always";
	private readonly win: Window;
	private frame: number | null = null;
	private dragging = false;
	private dragPointerId: number | null = null;
	private dragLast: PanZoomPoint | null = null;
	private pinchPointers = new Map<number, PanZoomPoint>();
	private pinchStartDistance = 0;
	private pinchStartState: PanZoomState | null = null;
	private destroyed = false;
	private readonly options: PanZoomOptions;

	constructor(options: PanZoomOptions) {
		this.options = options;
		this.minScale = options.minScale ?? 1;
		this.maxScale = options.maxScale ?? 8;
		this.wheelMode = options.wheelMode ?? "when-zoomed";
		const view = options.contentEl.ownerDocument.defaultView;
		if (!view) throw new Error("PanZoomController: contentEl has no defaultView");
		this.win = view;

		options.viewportEl.addEventListener("wheel", this.onWheel, { passive: false });
		options.viewportEl.addEventListener("pointerdown", this.onPointerDown);
		options.viewportEl.addEventListener("dblclick", this.onDblClick);
	}

	getState(): PanZoomState {
		return this.state;
	}

	isZoomed(): boolean {
		return this.state.scale > 1 + EPSILON;
	}

	zoomTo(scale: number, anchor?: PanZoomPoint): void {
		this.applyZoom(this.state.scale * (clampScale(scale, this.minScale, this.maxScale) / this.state.scale), anchor);
	}

	zoomBy(factor: number, anchor?: PanZoomPoint): void {
		this.applyZoom(this.state.scale * factor, anchor);
	}

	panBy(dx: number, dy: number): void {
		this.applyState(
			clampPan({ scale: this.state.scale, x: this.state.x + dx, y: this.state.y + dy }, this.measure()),
		);
	}

	reset(): void {
		this.state = { scale: 1, x: 0, y: 0 };
		this.paint();
		this.options.onReset?.();
	}

	/** 容器尺寸变化（RO/拖宽）后调用：重算 clamp；resetIfZoomed 时直接回 fit 态。 */
	relayout(relayoutOptions?: { resetIfZoomed?: boolean }): void {
		if (relayoutOptions?.resetIfZoomed && this.isZoomed()) {
			this.reset();
			return;
		}
		this.applyState(clampPan(this.state, this.measure()));
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.frame !== null) {
			this.win.cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		this.detachWindowListeners();
		const vp = this.options.viewportEl;
		vp.removeEventListener("wheel", this.onWheel);
		vp.removeEventListener("pointerdown", this.onPointerDown);
		vp.removeEventListener("dblclick", this.onDblClick);
		this.options.contentEl.style.transform = "";
		this.options.viewportEl.style.touchAction = "";
		this.options.viewportEl.classList.remove("infographic-panning");
	}

	// ---- internals ----

	private applyZoom(targetScale: number, anchor?: PanZoomPoint): void {
		const factor = targetScale / this.state.scale;
		const a = anchor ?? { x: this.options.viewportEl.clientWidth / 2, y: this.options.viewportEl.clientHeight / 2 };
		const zoomed = zoomAt(this.state, factor, a, this.minScale, this.maxScale);
		this.applyState(clampPan(zoomed, this.measure()));
	}

	private applyState(next: PanZoomState): void {
		this.state = next;
		if (this.frame === null) {
			this.frame = this.win.requestAnimationFrame(() => {
				this.frame = null;
				this.paint();
			});
		}
	}

	private paint(): void {
		const { scale, x, y } = this.state;
		this.options.contentEl.style.transformOrigin = "0 0";
		this.options.contentEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
		// fit 态把垂直滑动还给笔记（pan-y）；放大后才独占触摸
		this.options.viewportEl.style.touchAction = this.isZoomed() ? "none" : "pan-y";
		this.options.onChange?.(this.state);
	}

	private measure(): PanZoomBounds {
		return {
			viewportWidth: this.options.viewportEl.clientWidth,
			viewportHeight: this.options.viewportEl.clientHeight,
			contentWidth: this.options.contentEl.offsetWidth,
			contentHeight: this.options.contentEl.offsetHeight,
		};
	}

	private localPoint(event: { clientX: number; clientY: number }): PanZoomPoint {
		const rect = this.options.viewportEl.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	private readonly onWheel = (event: WheelEvent): void => {
		if (this.destroyed) return;
		const modifier = event.ctrlKey || event.metaKey;
		// 滚轮红线（spec §3）：fit 态普通滚轮完全归笔记，绝不 preventDefault
		if (this.wheelMode !== "always" && !this.isZoomed() && !modifier) return;
		event.preventDefault();
		const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
		this.zoomBy(factor, this.localPoint(event));
	};

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.destroyed) return;
		this.pinchPointers.set(event.pointerId, this.localPoint(event));
		this.attachWindowListeners();

		if (this.pinchPointers.size === 2) {
			const [a, b] = [...this.pinchPointers.values()];
			this.pinchStartDistance = Math.hypot(a.x - b.x, a.y - b.y);
			this.pinchStartState = this.state;
			this.dragging = false;
			this.dragPointerId = null;
			this.dragLast = null;
			return;
		}
		if (this.pinchPointers.size > 2) return;
		if (!this.isZoomed() || event.button !== 0) return;

		this.dragging = true;
		this.dragPointerId = event.pointerId;
		this.dragLast = this.localPoint(event);
		this.options.viewportEl.classList.add("infographic-panning");
		try {
			this.options.viewportEl.setPointerCapture(event.pointerId);
		} catch {
			// 合成指针（自动化测试）无 pointerId，忽略
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (this.pinchPointers.has(event.pointerId)) {
			this.pinchPointers.set(event.pointerId, this.localPoint(event));
		}
		if (this.pinchPointers.size >= 2 && this.pinchStartState && this.pinchStartDistance > 0) {
			const [a, b] = [...this.pinchPointers.values()];
			const distance = Math.hypot(a.x - b.x, a.y - b.y);
			const factor = distance / this.pinchStartDistance;
			const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
			const zoomed = zoomAt(this.pinchStartState, factor, anchor, this.minScale, this.maxScale);
			this.applyState(clampPan(zoomed, this.measure()));
			return;
		}
		if (!this.dragging || event.pointerId !== this.dragPointerId || !this.dragLast) return;
		const point = this.localPoint(event);
		this.panBy(point.x - this.dragLast.x, point.y - this.dragLast.y);
		this.dragLast = point;
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		this.pinchPointers.delete(event.pointerId);
		if (this.pinchPointers.size < 2) {
			this.pinchStartState = null;
			this.pinchStartDistance = 0;
		}
		if (event.pointerId === this.dragPointerId) {
			this.dragging = false;
			this.dragPointerId = null;
			this.dragLast = null;
			this.options.viewportEl.classList.remove("infographic-panning");
		}
		if (this.pinchPointers.size === 0 && !this.dragging) {
			this.detachWindowListeners();
		}
	};

	private readonly onDblClick = (): void => {
		if (!this.destroyed) this.reset();
	};

	private attachWindowListeners(): void {
		this.win.addEventListener("pointermove", this.onPointerMove);
		this.win.addEventListener("pointerup", this.onPointerUp);
		this.win.addEventListener("pointercancel", this.onPointerUp);
	}

	private detachWindowListeners(): void {
		this.win.removeEventListener("pointermove", this.onPointerMove);
		this.win.removeEventListener("pointerup", this.onPointerUp);
		this.win.removeEventListener("pointercancel", this.onPointerUp);
	}
}
```

- [ ] **Step 3: 数学断言（绿）**

Run:

```bash
node --input-type=module -e "
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const m = await jiti.import('./src/renderer/PanZoomController.ts');
const assert = (await import('node:assert')).strict;
const { zoomAt, clampPan, clampScale } = m;

// 基本锚定缩放：s=1,t=0, factor=2, anchor=(100,50) → x=-100, y=-50
let r = zoomAt({ scale: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 }, 1, 8);
assert.equal(r.scale, 2);
assert.equal(r.x, -100);
assert.equal(r.y, -50);

// 触顶用实际 k：从 s=4 请求 factor=4（触顶 8），锚点保持不动（无漂移）
r = zoomAt({ scale: 4, x: -40, y: -20 }, 4, { x: 60, y: 30 }, 1, 8);
assert.equal(r.scale, 8);
const k = 8 / 4;
assert.equal(r.x, 60 - k * (60 - (-40)));
assert.equal(r.y, 30 - k * (30 - (-20)));

// 触底：s=0.5 请求再缩 → 回到 min=1
r = zoomAt({ scale: 0.5, x: 10, y: 10 }, 0.5, { x: 0, y: 0 }, 1, 8);
assert.equal(r.scale, 1);

// clampPan：s=2, vw=100, cw=80 → s*cw=160, x ∈ [-60, 0]
r = clampPan({ scale: 2, x: -100, y: 0 }, { viewportWidth: 100, viewportHeight: 90, contentWidth: 80, contentHeight: 40 });
assert.equal(r.x, -60);
r = clampPan({ scale: 2, x: 30, y: 0 }, { viewportWidth: 100, viewportHeight: 90, contentWidth: 80, contentHeight: 40 });
assert.equal(r.x, 0);
// s<=1 归零
r = clampPan({ scale: 1, x: 50, y: 50 }, { viewportWidth: 100, viewportHeight: 100, contentWidth: 50, contentHeight: 50 });
assert.deepEqual({ x: r.x, y: r.y }, { x: 0, y: 0 });
assert.equal(clampScale(99, 1, 8), 8);
console.log('panzoom math assertions passed');
"
```

Expected: `panzoom math assertions passed`。

- [ ] **Step 4: 构建并提交**

Run: `npm run build` → 零错误。

```bash
git add src/renderer/PanZoomController.ts
git commit -m "feat: add PanZoomController with anchored zoom, clamped pan and pinch support"
```

---

### Task 6: 笔记内缩放接线 + styles.css

**Files:**
- Modify: `src/renderer/InfographicView.ts`
- Modify: `src/renderer/index.ts`
- Rewrite: `styles.css`（替换样例占位注释）

**Interfaces:**
- Consumes: `PanZoomController`（Task 5）。
- Produces:
  - `RenderOptions` 新增字段：`onPanZoomChange?: (state: PanZoomState) => void`
  - `InfographicRenderChild` 新增方法：`getPanZoom(): PanZoomController | null`、`zoomIn(): void`（zoomBy 1.25）、`zoomOut(): void`（zoomBy 1/1.25）、`fitWidth(): void`（reset）
  - CSS 类：`infographic-viewport`、`infographic-content`、`infographic-panning`、`infographic-toolbar`（Task 7 填充按钮样式）、`infographic-resize-handle` 等。

- [ ] **Step 1: InfographicView 加 viewport/content 双层与 controller**

在 `InfographicRenderChild` 中：

1. `showLoading()` 前的结构改造——`containerEl` 即 viewport（overflow hidden 由 CSS 负责），SVG 的直接父级改为 content 层。修改 `showLoading()`：

```ts
	private showLoading(): void {
		this.containerEl.empty();
		this.containerEl.addClass("infographic-viewport");
		this.contentEl = this.containerEl.createDiv({ cls: "infographic-content" });
		this.loadingEl = this.contentEl.createDiv({ cls: "infographic-loading" });
		this.loadingEl.setText("Loading infographic...");
	}
```

新增字段 `private contentEl: HTMLElement | null = null;`、`private panZoom: PanZoomController | null = null;`。`render()` 里 `renderInfographicInto(this.containerEl, …)` 的第一参数改为 `this.contentEl!`。

2. `ensureStarted()` 末尾（`setupResizeHandles()` 之后）追加：

```ts
		this.panZoom = new PanZoomController({
			viewportEl: this.containerEl,
			contentEl: this.contentEl!,
			wheelMode: "when-zoomed",
			onChange: (state) => this.options.onPanZoomChange?.(state),
		});
```

3. RO 回调在 `this.infographic.update({ width, height })` 后追加 `this.panZoom?.relayout({ resetIfZoomed: true });`（spec R2：响应式更新后缩放基准失效，回 fit 态）。

4. 拖宽手柄 `pointerdown` 回调开头（`this.isResizing = true;` 之后）追加 `this.panZoom?.reset();`。

5. 新增公开方法：

```ts
	getPanZoom(): PanZoomController | null {
		return this.panZoom;
	}

	zoomIn(): void {
		this.panZoom?.zoomBy(1.25);
	}

	zoomOut(): void {
		this.panZoom?.zoomBy(1 / 1.25);
	}

	fitWidth(): void {
		this.panZoom?.reset();
	}
```

6. `cleanup()` 首行加 `this.panZoom?.destroy(); this.panZoom = null;`（spec §9 顺序第 1 步）。

7. import 加 `import { PanZoomController } from "./PanZoomController";` 与 `import type { PanZoomState } from "./PanZoomController";`。

`src/renderer/index.ts` 追加 `export { PanZoomController } from "./PanZoomController";` 与 `export type { PanZoomState, PanZoomOptions } from "./PanZoomController";`。

- [ ] **Step 2: 重写 styles.css（全文）**

```css
/* antv-infographic plugin styles */

/* 渲染块外层：定位上下文 + 手柄/工具栏的锚 */
.infographic-wrapper {
	position: relative;
	max-width: 100%;
}

.infographic-wrapper.infographic-centered {
	margin-inline: auto;
}

/* viewport：裁剪层。fit 态 touch-action 由 controller 写为 pan-y */
.infographic-viewport {
	position: relative;
	overflow: hidden;
}

/* content：被 transform 的层 */
.infographic-content {
	transform-origin: 0 0;
	width: 100%;
}

.infographic-viewport.infographic-panning .infographic-content,
.infographic-panning {
	cursor: grab;
}

.infographic-panning:active {
	cursor: grabbing;
}

/* 缩放百分比标签 */
.infographic-zoom-label {
	min-width: 3.2em;
	text-align: center;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	align-self: center;
	user-select: none;
}

/* 拖拽调宽手柄（两侧） */
.infographic-resize-handle {
	position: absolute;
	top: 0;
	bottom: 0;
	width: 12px;
	cursor: ew-resize;
	opacity: 0;
	z-index: 5;
}

.infographic-resize-left { left: -6px; }
.infographic-resize-right { right: -6px; }

.infographic-wrapper:hover .infographic-resize-handle,
.infographic-wrapper.infographic-resizing .infographic-resize-handle {
	opacity: 1;
}

.infographic-resize-handle::before {
	content: "";
	position: absolute;
	top: 0;
	bottom: 0;
	left: 5px;
	width: 2px;
	background: var(--background-modifier-border);
}

.infographic-resize-handle:hover::before {
	background: var(--interactive-accent);
}

.infographic-wrapper.infographic-resizing {
	user-select: none;
}

/* 错误态 */
.infographic-error-block {
	border: 1px solid var(--background-modifier-error-border);
	border-radius: var(--radius-s);
	padding: 0.75em;
}

.infographic-error-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	color: var(--text-error);
	margin-bottom: 0.5em;
}

.infographic-error-icon {
	display: inline-flex;
	flex: none;
}

.infographic-error-icon svg {
	width: 16px;
	height: 16px;
}

.infographic-error-details-btn {
	margin-bottom: 0.5em;
	padding: 0.25em 0.75em;
	border-radius: var(--radius-s);
}

.infographic-error-source {
	max-height: 300px;
	overflow: auto;
}

.infographic-error-message {
	color: var(--text-error);
	padding: 0.5em;
}

/* Loading */
.infographic-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5em;
	min-height: 120px;
	color: var(--text-muted);
}

.infographic-loading::before {
	content: "";
	width: 14px;
	height: 14px;
	border: 2px solid var(--text-faint);
	border-top-color: var(--interactive-accent);
	border-radius: 50%;
	animation: infographic-spin 0.8s linear infinite;
}

@keyframes infographic-spin {
	to { transform: rotate(360deg); }
}

.infographic-hidden {
	display: none;
}

/* PDF/打印：隐藏交互件（无 print 管线，直接打印当前渲染） */
@media print {
	.infographic-toolbar,
	.infographic-resize-handle {
		display: none !important;
	}
	.infographic-viewport {
		overflow: visible;
	}
	.infographic-wrapper {
		break-inside: avoid;
	}
}
```

（工具栏按钮样式在 Task 7 追加到本文件。）

- [ ] **Step 3: 构建并提交**

Run: `npm run build` → 零错误。

```bash
git add src/renderer/InfographicView.ts src/renderer/index.ts styles.css
git commit -m "feat: wire in-note pan/zoom viewport layer with print-safe styles"
```

---

### Task 7: UI 三件（Toolbar / ExportModal / SourceModal / 剪贴板降级链）

**Files:**
- Create: `src/ui/Toolbar.ts`
- Create: `src/ui/ExportModal.ts`
- Create: `src/ui/SourceModal.ts`
- Modify: `src/ui/index.ts`（Task 4 已创建，追加其余导出）
- Modify: `styles.css`（追加工具栏样式）

**Interfaces:**
- Consumes: `@antv/infographic` 的 `Infographic.toDataURL`。
- Produces:
  - `interface ToolbarHandlers { isCentered(): boolean; onToggleCenter(): void; onCopySource(): void; onCopyImage(): void; onExport(): void; onZoomIn(): void; onZoomOut(): void; onFit(): void; onFullscreen(): void }`
  - `interface ToolbarControls { setZoomPercent(percent: number): void }`
  - `function createToolbar(parent: HTMLElement, handlers: ToolbarHandlers): ToolbarControls`
  - `async function copyImageToClipboard(dataUrl: string, fallbackText: string): Promise<"image" | "text">`
  - `function dataUrlToBlob(dataUrl: string): Blob | null`
  - `class ExportModal extends Modal`：`constructor(app: App, infographic: Infographic, filename?: string)`
  - `class SourceCodeModal extends Modal`：`constructor(app: App, source: string)`

- [ ] **Step 1: 移植两个 Modal**

`mkdir -p src/ui`。`ExportModal.ts` = 上游 `src/ui/ExportModal.ts`（74 行）逐字复制 + 文件头署名注释；`SourceModal.ts` = 上游 `src/ui/SourceModal.ts`（68 行）逐字复制 + 署名注释。

- [ ] **Step 2: 写 src/ui/Toolbar.ts（全文）**

```ts
import { setIcon } from "obsidian";

export interface ToolbarHandlers {
	isCentered(): boolean;
	onToggleCenter(): void;
	onCopySource(): void;
	onCopyImage(): void;
	onExport(): void;
	onZoomIn(): void;
	onZoomOut(): void;
	onFit(): void;
	onFullscreen(): void;
}

export interface ToolbarControls {
	setZoomPercent(percent: number): void;
}

function toolbarButton(toolbar: HTMLElement, icon: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
	const btn = toolbar.createEl("button", { cls: "infographic-toolbar-btn" });
	btn.setAttribute("aria-label", ariaLabel);
	btn.setAttribute("type", "button");
	setIcon(btn, icon);
	btn.addEventListener("click", onClick);
	return btn;
}

export function createToolbar(parent: HTMLElement, handlers: ToolbarHandlers): ToolbarControls {
	const toolbar = parent.createDiv({ cls: "infographic-toolbar" });

	const centerBtn = toolbarButton(toolbar, "align-center", "Toggle center alignment", () => {
		handlers.onToggleCenter();
		const centered = handlers.isCentered();
		centerBtn.setAttribute("aria-pressed", String(centered));
		centerBtn.toggleClass("infographic-center-btn-active", centered);
	});
	centerBtn.setAttribute("aria-pressed", String(handlers.isCentered()));
	centerBtn.toggleClass("infographic-center-btn-active", handlers.isCentered());

	toolbarButton(toolbar, "copy", "Copy source to clipboard", handlers.onCopySource);
	toolbarButton(toolbar, "image", "Copy image to clipboard", handlers.onCopyImage);
	toolbarButton(toolbar, "download", "Export as PNG or SVG", handlers.onExport);

	toolbar.createDiv({ cls: "infographic-toolbar-separator" });

	toolbarButton(toolbar, "zoom-out", "Zoom out", handlers.onZoomOut);
	const zoomLabel = toolbar.createSpan({ cls: "infographic-zoom-label", text: "100%" });
	toolbarButton(toolbar, "zoom-in", "Zoom in", handlers.onZoomIn);
	toolbarButton(toolbar, "scan", "Fit to width", handlers.onFit);
	toolbarButton(toolbar, "maximize", "Open fullscreen viewer", handlers.onFullscreen);

	return {
		setZoomPercent: (percent: number) => zoomLabel.setText(`${Math.round(percent)}%`),
	};
}

/** data URL → Blob（移植自本仓库旧 main.ts） */
export function dataUrlToBlob(dataUrl: string): Blob | null {
	const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
	if (!match) return null;
	const mime = match[1];
	const binary = atob(match[2]);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mime });
}

/**
 * 复制图片降级链（spec R7）：clipboard.write(PNG) → 失败/不支持时 writeText(源码)。
 * 返回实际写入的形态，调用方据此显示不同 Notice。
 */
export async function copyImageToClipboard(dataUrl: string, fallbackText: string): Promise<"image" | "text"> {
	const blob = dataUrlToBlob(dataUrl);
	if (blob && typeof ClipboardItem !== "undefined") {
		try {
			await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
			return "image";
		} catch {
			// 落入文本降级
		}
	}
	await navigator.clipboard.writeText(fallbackText);
	return "text";
}
```

`src/ui/index.ts` 追加为（保留 Task 4 已有的 ErrorPlaceholder 两行）：

```ts
export { createErrorPlaceholder } from "./ErrorPlaceholder";
export type { ErrorPlaceholderOptions } from "./ErrorPlaceholder";
export { createToolbar, copyImageToClipboard, dataUrlToBlob } from "./Toolbar";
export type { ToolbarHandlers, ToolbarControls } from "./Toolbar";
export { ExportModal } from "./ExportModal";
export { SourceCodeModal } from "./SourceModal";
```

- [ ] **Step 3: styles.css 追加工具栏样式（文件末尾）**

```css
/* hover 工具栏 */
.infographic-toolbar {
	position: absolute;
	top: 6px;
	right: 6px;
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 2px 4px;
	border-radius: var(--radius-s);
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	opacity: 0;
	transition: opacity 0.15s ease;
	z-index: 10;
	user-select: none;
}

.infographic-wrapper:hover .infographic-toolbar,
.infographic-toolbar:focus-within {
	opacity: 1;
}

.infographic-toolbar-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	padding: 0;
	margin: 0;
	border: none;
	border-radius: var(--radius-s);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
}

.infographic-toolbar-btn:hover {
	background: var(--background-modifier-hover);
	color: var(--text-normal);
}

.infographic-toolbar-btn svg {
	width: 15px;
	height: 15px;
}

.infographic-toolbar-separator {
	width: 1px;
	height: 16px;
	margin: 0 3px;
	background: var(--background-modifier-border);
}

.infographic-center-btn-active {
	color: var(--interactive-accent);
}

.infographic-center-btn-active:hover {
	color: var(--interactive-accent);
}

/* 导出弹窗按钮组（上游样式） */
.infographic-export-modal h2 {
	margin-top: 0;
}

.infographic-export-buttons {
	display: flex;
	gap: 0.5em;
	justify-content: flex-end;
	margin-top: 1em;
}

.infographic-export-buttons button {
	padding: 0.4em 1em;
	border-radius: var(--radius-s);
}

/* 源码弹窗 */
.infographic-source-modal .infographic-source-code pre {
	max-height: 60vh;
	overflow: auto;
	user-select: text;
}

.infographic-source-buttons {
	display: flex;
	gap: 0.5em;
	justify-content: flex-end;
	margin-top: 1em;
}
```

- [ ] **Step 4: 构建并提交**

Run: `npm run build` → 零错误。

```bash
git add src/ui styles.css
git commit -m "feat: add hover toolbar, export/source modals and clipboard fallback chain"
```

---

### Task 8: main.ts 重构接线（processor / 错误三模式 / fence / 工具栏 / 命令）

**Files:**
- Rewrite: `src/main.ts`（全文替换，旧 `renderInfographic`/`dataUrlToBlob`/右键菜单/`settingsToOptions` 全部删除）

**Interfaces:**
- Consumes: Task 2 `parseInfographicSpec`/`showParseError`/`resolveFenceText`/`parseWidthParam`/`getFenceAlign`/`setFenceAlign`/`persistBlockWidth`/`persistFenceUpdate`；Task 4 `InfographicRenderChild`/`RenderOptions.onRenderError`/`createErrorPlaceholder`；Task 6 `getPanZoom`/`zoomIn`/`zoomOut`/`fitWidth`；Task 7 `createToolbar`/`copyImageToClipboard`/`ExportModal`/`SourceCodeModal`；Task 3 设置。Task 9 的 `FullscreenModal` 本任务先不引用（openFullscreen 为临时 Notice，Task 9 替换）。
- Produces: 插件完整行为（spec §3 笔记内交互、§4 P0/P1 全部、§10 验收 1-6/8/9）；`INFOGRAPHIC_TEMPLATE` 常量。

- [ ] **Step 1: 重写 src/main.ts（全文）**

```ts
import { Editor, MarkdownPostProcessorContext, Notice, Plugin } from "obsidian";
import type { Infographic } from "@antv/infographic";
import { DEFAULT_SETTINGS, ErrorBehavior, InfographicSettingTab, InfographicSettings, ThemeSetting } from "./settings";
import { parseInfographicSpec, showParseError } from "./parser";
import { getFenceAlign, parseWidthParam, persistBlockWidth, persistFenceUpdate, resolveFenceText, setFenceAlign } from "./fence";
import { InfographicRenderChild } from "./renderer";
import { copyImageToClipboard, createErrorPlaceholder, createToolbar, ExportModal, SourceCodeModal } from "./ui";
import type { ToolbarControls } from "./ui";

const INFOGRAPHIC_TEMPLATE = `{
  "template": "list-row-simple-horizontal-arrow",
  "data": {
    "items": [
      { "label": "Step 1", "desc": "Description" },
      { "label": "Step 2", "desc": "Description" },
      { "label": "Step 3", "desc": "Description" }
    ]
  }
}`;

export default class InfographicPlugin extends Plugin {
	settings: InfographicSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new InfographicSettingTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor("infographic", (source, el, ctx) => {
			void this.processInfographicBlock(source, el, ctx);
		});
		this.registerCommands();
	}

	private registerCommands(): void {
		this.addCommand({
			id: "insert-template",
			name: "Insert infographic template",
			editorCallback: (editor: Editor) => {
				const cursor = editor.getCursor();
				const template = "```infographic\n" + INFOGRAPHIC_TEMPLATE + "\n```\n";
				editor.replaceRange(template, cursor);
				editor.setCursor({ line: cursor.line + 2, ch: 0 });
			},
		});
	}

	private isDarkMode(): boolean {
		return this.app.workspace.containerEl.ownerDocument.body.classList.contains("theme-dark");
	}

	/** auto 主题在此刻解析为 light/dark（每次渲染/开全屏时现取，切主题后重渲即生效） */
	private resolveTheme(): string | undefined {
		if (this.settings.theme === "auto") {
			return this.isDarkMode() ? "dark" : "light";
		}
		return this.settings.theme;
	}

	private async processInfographicBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	): Promise<void> {
		const result = parseInfographicSpec(source);
		if (!result.success) {
			console.error("[Infographic Plugin] Parse error:", result.error, { source: source.substring(0, 200) });
			showParseError(result.error);
			this.handleError(el, result.error, source);
			return;
		}

		const container = el.createDiv({ cls: "infographic-wrapper" });

		// fence 参数：width=N（渲染宽度上限）、align=center|left（水平对齐，缺省左对齐）
		const fence = resolveFenceText(this.app, ctx, el, source);
		const fenceWidth = fence ? parseWidthParam(fence) : null;
		if (fenceWidth !== null) {
			const available = el.clientWidth || fenceWidth;
			container.style.width = `${Math.min(fenceWidth, available)}px`;
			container.addClass("infographic-has-width");
		}
		const fenceAlign = fence ? getFenceAlign(fence) : null;
		let centered = fenceAlign === "center";
		container.toggleClass("infographic-centered", centered);

		// 缩放百分比实时显示：toolbar 在 renderChild 之后创建，先声明后由闭包引用
		let toolbarControls: ToolbarControls | null = null;

		const renderChild = new InfographicRenderChild(container, {
			content: result.content,
			isJson: result.isJson,
			theme: this.settings.theme,
			isDarkMode: this.isDarkMode(),
			explicitWidth: fenceWidth ?? undefined,
			onWidthCommit: (width) => persistBlockWidth(this.app, ctx, el, source, width),
			onRenderError: (message) => this.handleError(el, message, source),
			onPanZoomChange: (state) => toolbarControls?.setZoomPercent(state.scale * 100),
		});
		ctx.addChild(renderChild);
		// PDF 导出等管线可能不触发 onload，这里保证幂等启动
		renderChild.ensureStarted();

		toolbarControls = createToolbar(container, {
			isCentered: () => centered,
			onToggleCenter: () => {
				centered = !centered;
				container.toggleClass("infographic-centered", centered);
				const align: "center" | "left" | null = centered ? "center" : null;
				persistFenceUpdate(this.app, ctx, el, source, (f) => setFenceAlign(f, align));
			},
			onCopySource: () => {
				void navigator.clipboard.writeText(source.trim()).then(
					() => new Notice("已复制源码到剪贴板"),
					() => new Notice("复制失败"),
				);
			},
			onCopyImage: () => {
				const instance = renderChild.getInfographic();
				if (!instance) return;
				void (async () => {
					try {
						const dataUrl = await instance.toDataURL({ type: "png" });
						const outcome = await copyImageToClipboard(dataUrl, source);
						new Notice(outcome === "image" ? "图表已复制到剪贴板" : "当前环境不支持复制图片，已复制源码；可用导出按钮保存 PNG");
					} catch (error) {
						console.error("[Infographic Plugin] Copy image error:", error);
						new Notice("复制失败: " + (error instanceof Error ? error.message : String(error)));
					}
				})();
			},
			onExport: () => {
				const instance = renderChild.getInfographic();
				if (instance) new ExportModal(this.app, instance).open();
			},
			onZoomIn: () => renderChild.zoomIn(),
			onZoomOut: () => renderChild.zoomOut(),
			onFit: () => renderChild.fitWidth(),
			onFullscreen: () => this.openFullscreen(result.content, result.isJson, renderChild.getInfographic()),
		});
	}

	// Task 9 将替换为真正的 FullscreenModal；本任务先保证按钮可用（临时提示）
	private openFullscreen(content: string, isJson: boolean, instance: Infographic | null): void {
		void content;
		void isJson;
		void instance;
		new Notice("全屏查看器将在下一任务启用");
	}

	/** 统一错误呈现（spec §3 错误占位卡）：解析失败与渲染失败共用，按 errorBehavior 走三模式 */
	private handleError(el: HTMLElement, error: string, source: string): void {
		const behavior: ErrorBehavior = this.settings.errorBehavior;
		el.empty();
		if (behavior === "hide") {
			el.addClass("infographic-hidden");
			return;
		}
		createErrorPlaceholder(el, {
			message: error,
			onDetails: behavior === "show-error"
				? () => new SourceCodeModal(this.app, source).open()
				: undefined,
		});
		if (behavior === "show-code") {
			const pre = el.createEl("pre", { cls: "infographic-error-source" });
			pre.createEl("code").setText(source);
		}
	}

	async loadSettings() {
		const data = await this.loadData() as (Partial<InfographicSettings> & { defaultTheme?: string }) | null;
		let theme: ThemeSetting = DEFAULT_SETTINGS.theme;
		if (data?.theme === "auto" || data?.theme === "light" || data?.theme === "dark") {
			theme = data.theme;
		} else if (data?.defaultTheme === "light" || data?.defaultTheme === "dark") {
			// 旧版 defaultTheme 迁移：显式 light/dark 保留，其余（含 'default'）归 auto
			theme = data.defaultTheme;
		}
		this.settings = {
			theme,
			errorBehavior: data?.errorBehavior ?? DEFAULT_SETTINGS.errorBehavior,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
```


- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 零错误、零未使用 import 告警（eslint: `npm run lint` 也跑一次，允许存量告警，不得新增）。

- [ ] **Step 3: 冒烟（spec §10 验收 1-6、8、9）**

标准冒烟后逐项核对：
1. JSON 块按 `width=500 align=center` 渲染且居中、宽 500px（不超栏宽）。
2. DSL 块渲染。
3. 非法 JSON 块：默认（show-code）显示带 `circle-alert` 图标的错误占位卡 + 源码；设置切 show-error → 占位卡 + View details 按钮 → 打开源码弹窗；切 hide → 块消失。**追加两个输入**：空 infographic 块、DSL 首行写不存在的模板名（如 `infographic no-such-template`）——两者都必须显示错误占位卡（后者由零高度兜底触发）；DevTools 检查所有失败块 `getBoundingClientRect().height > 0`，页面中不存在高度 0 的透明/空白块（hide 模式除外）。
4. hover 出工具栏；复制源码/导出 PNG/导出 SVG 可用；复制图片在桌面端写入剪贴板图片；右键图表 = Obsidian 原生菜单（旧自定义菜单已删）。
5. 缩放红线：fit 态普通滚轮滚动的是笔记；Ctrl/Cmd+滚轮以光标为锚缩放；点 ＋/− 步进缩放、百分比联动；放大后拖拽平移（grab 光标）、双击复位、scan 按钮复位。
6. 源码模式下拖右上手柄调宽：拖动中不逐帧重渲（CPU 平稳），松手图表按新宽重渲染且 fence 行回写 `width=N`；阅读模式下拖动手柄松手**不**改文件。
7. Ctrl+P → "Insert infographic template"：插入三步模板、光标落在块内、即刻渲染。
8. 反复滚动/切笔记 30 次：DevTools Performance/Memory 无持续增长；禁用再启用插件无报错。

任何一条不过 → 修到过再提交（禁止跳过）。移动端项（pinch/单指拖）无法在本机验证的，记录为"未验证，待真机"。

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: rewrite main pipeline with render child, toolbar, fence params and error modes"
```

---

### Task 9: 全屏查看器 FullscreenModal

**Files:**
- Create: `src/renderer/FullscreenModal.ts`
- Modify: `src/renderer/index.ts`
- Modify: `src/main.ts`（`openFullscreen` 替换实现）
- Modify: `styles.css`（追加全屏样式）

**Interfaces:**
- Consumes: `renderInfographicInto`（Task 4）、`PanZoomController`（Task 5）、`ExportModal`（Task 7）。
- Produces: `class FullscreenModal extends Modal`，`constructor(app: App, payload: FullscreenPayload)`；`interface FullscreenPayload { content: string; isJson: boolean; theme?: string; sourceInstance: Infographic | null }`。

- [ ] **Step 1: 写 src/renderer/FullscreenModal.ts（全文）**

```ts
import { App, Modal, setIcon } from "obsidian";
import type { Infographic } from "@antv/infographic";
import { PanZoomController } from "./PanZoomController";
import { renderInfographicInto } from "./InfographicView";
import { ExportModal } from "../ui/ExportModal";

export interface FullscreenPayload {
	content: string;
	isJson: boolean;
	theme?: string;
	/** 原笔记内实例：全屏内导出/复制恒为全图，不受视图缩放影响（spec §3） */
	sourceInstance: Infographic | null;
}

/**
 * 全屏查看器：重渲染新实例（大画布重排语义，非 clone），
 * 缩放平移复用 PanZoomController（wheelMode: always——Modal 内无笔记滚动冲突）。
 */
export class FullscreenModal extends Modal {
	private instance: Infographic | null = null;
	private controller: PanZoomController | null = null;
	private zoomLabel: HTMLElement | null = null;
	private readonly payload: FullscreenPayload;

	constructor(app: App, payload: FullscreenPayload) {
		super(app);
		this.payload = payload;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("infographic-fullscreen");

		this.buildToolbar(contentEl);

		const viewport = contentEl.createDiv({ cls: "infographic-fullscreen-viewport" });
		const stage = viewport.createDiv({ cls: "infographic-fullscreen-stage" });
		const loading = viewport.createDiv({ cls: "infographic-loading", text: "Loading infographic..." });

		try {
			const width = Math.max(320, viewport.clientWidth - 64 || 800);
			// 先按可用宽度渲染，再依 SVG viewBox 修正为“适应屏幕”（宽高都留 64px 边距）
			this.instance = renderInfographicInto(stage, {
				content: this.payload.content,
				isJson: this.payload.isJson,
				theme: this.payload.theme,
				width,
				height: width * 0.75,
			});
			this.fitToScreen(stage, viewport);
			loading.remove();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[Infographic Plugin] Fullscreen render error:", message);
			loading.addClass("infographic-error-message");
			loading.setText(`Failed to render infographic: ${message}`);
			return;
		}

		this.controller = new PanZoomController({
			viewportEl: viewport,
			contentEl: stage,
			wheelMode: "always",
			onChange: (state) => this.zoomLabel?.setText(`${Math.round(state.scale * 100)}%`),
		});
	}

	private fitToScreen(stage: HTMLElement, viewport: HTMLElement): void {
		if (!this.instance) return;
		const svg = stage.querySelector("svg");
		if (!svg) return;
		const parts = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
		if (!parts || parts.length !== 4 || !(parts[2] > 0) || !(parts[3] > 0)) return;
		const aspect = parts[3] / parts[2];
		const availWidth = viewport.clientWidth - 64 || stage.offsetWidth;
		const availHeight = viewport.clientHeight - 64 || stage.offsetHeight;
		const fitWidth = Math.min(availWidth, availHeight / aspect);
		this.instance.update({ width: fitWidth, height: fitWidth * aspect });
	}

	private buildToolbar(contentEl: HTMLElement): void {
		const toolbar = contentEl.createDiv({ cls: "infographic-fullscreen-toolbar" });
		const btn = (icon: string, ariaLabel: string, onClick: () => void): HTMLButtonElement => {
			const b = toolbar.createEl("button", { cls: "infographic-toolbar-btn" });
			b.setAttribute("aria-label", ariaLabel);
			b.setAttribute("type", "button");
			setIcon(b, icon);
			b.addEventListener("click", onClick);
			return b;
		};
		btn("zoom-out", "Zoom out", () => this.controller?.zoomBy(1 / 1.25));
		this.zoomLabel = toolbar.createSpan({ cls: "infographic-zoom-label", text: "100%" });
		btn("zoom-in", "Zoom in", () => this.controller?.zoomBy(1.25));
		btn("scan", "Fit to screen", () => this.controller?.reset());
		toolbar.createDiv({ cls: "infographic-toolbar-separator" });
		const exportBtn = btn("download", "Export as PNG or SVG", () => {
			if (this.payload.sourceInstance) {
				new ExportModal(this.app, this.payload.sourceInstance).open();
			}
		});
		if (!this.payload.sourceInstance) {
			exportBtn.disabled = true;
			exportBtn.setAttribute("aria-disabled", "true");
		}
		btn("x", "Close", () => this.close());
	}

	onClose(): void {
		// spec §9：先销毁 controller，再销毁实例
		this.controller?.destroy();
		this.controller = null;
		if (this.instance) {
			try {
				this.instance.destroy();
			} catch {
				// 库在已销毁状态可能 throw（上游同款防御）
			}
			this.instance = null;
		}
		this.contentEl.empty();
	}
}
```

`src/renderer/index.ts` 追加：

```ts
export { FullscreenModal } from "./FullscreenModal";
export type { FullscreenPayload } from "./FullscreenModal";
```

- [ ] **Step 2: main.ts 接线**

替换 Task 8 的 `openFullscreen` 占位实现为：

```ts
	private openFullscreen(content: string, isJson: boolean, instance: Infographic | null): void {
		new FullscreenModal(this.app, {
			content,
			isJson,
			theme: this.resolveTheme(),
			sourceInstance: instance,
		}).open();
	}
```

import 加 `import { FullscreenModal } from "./renderer";`。

- [ ] **Step 3: styles.css 追加全屏样式（文件末尾）**

```css
/* 全屏查看器 */
.infographic-fullscreen {
	padding: 0;
	display: flex;
	flex-direction: column;
	height: 100%;
}

.infographic-fullscreen-toolbar {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 6px 10px;
	border-bottom: 1px solid var(--background-modifier-border);
	background: var(--background-secondary);
	flex: none;
}

.infographic-fullscreen-viewport {
	position: relative;
	overflow: hidden;
	flex: 1 1 auto;
	display: flex;
	align-items: center;
	justify-content: center;
	touch-action: none;
}

.infographic-fullscreen-stage {
	transform-origin: 0 0;
}
```

- [ ] **Step 4: 构建并冒烟（spec §10 验收 7）**

Run: `npm run build` → 零错误。标准冒烟后：点工具栏 maximize → Modal 打开即适应屏幕（大图明显大于笔记内尺寸、无滚动条）；滚轮直接缩放（无需修饰键）；拖拽平移；双击/scan 复位；百分比联动；导出 PNG 出全图；Esc 与 × 都能关闭；关闭后笔记内实例仍可正常导出（未被破坏）。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/FullscreenModal.ts src/renderer/index.ts src/main.ts styles.css
git commit -m "feat: add fullscreen viewer with pan/zoom and full-image export"
```

---

### Task 10: README、版本收尾与全量回归

**Files:**
- Modify: `README.md`、`README.zh.md`
- Modify: `manifest.json`（version 1.1.0）
- Modify: `versions.json`
- Modify: `package.json`（version 1.1.0）

**Interfaces:**
- Consumes: 全部前序任务成果。
- Produces: 发布就绪的 1.1.0（spec §8 合规 + §10 全量回归通过）。

- [ ] **Step 1: 版本号**

`manifest.json`：`"version": "1.1.0"`。`package.json`：`"version": "1.1.0"`。`versions.json` 追加映射（保持 JSON 有效）：

```json
{
	"1.0.0": "0.15.0",
	"1.1.0": "1.13.0"
}
```

- [ ] **Step 2: README 双语更新**

`README.md` 与 `README.zh.md` 各追加/修订：

1. Features 列表：dual syntax (JSON + DSL)、responsive width、hover toolbar（copy source/copy image/export/center）、in-note zoom & pan（Ctrl/Cmd+wheel、zoom buttons、drag pan、double-click reset）、fullscreen viewer、`width=N` / `align=center` fence 参数、`insert-template` 命令、requires Obsidian 1.13+。
2. Usage：补 fence 参数说明与缩放交互表（fit 态滚轮归笔记 / Ctrl+滚轮缩放 / 放大后滚轮缩放+拖拽平移 / 双击复位 / 全屏内滚轮恒缩放）。
3. **Acknowledgments 段（Apache-2.0 §4a，双语都要有）**：

> This plugin incorporates code ported and modified from [shuuul/obsidian-infographic](https://github.com/shuuul/obsidian-infographic) (v0.2.0, Apache-2.0) — the dual-syntax parser, the MarkdownRenderChild renderer with resize handling, fence parameter parsing/persistence, and the export/source modals. Ported files carry an Apache-2.0 header notice; see `LICENSE-APACHE-2.0`. Changes: removed the PDF print-snapshot pipeline, reworked toolbar/zoom integration, added PanZoomController and the fullscreen viewer. The remainder of this plugin is MIT licensed.

中文版对应翻译（语义一致）。

- [ ] **Step 3: 构建与 lint**

Run: `npm run build && npm run lint`
Expected: build 零错误；lint 无新增告警。

- [ ] **Step 4: 全量回归（spec §10 十条全跑一遍）**

标准冒烟 + Task 8 Step 3 清单 + Task 9 Step 4 清单 + 本任务：老设置迁移（把 vault 插件目录 data.json 手动改为 `{"defaultTheme":"dark"}` → 重载 → 设置显示 Dark 且渲染暗色主题；`{"defaultTheme":"default"}` → 归 Auto）。任何一条不过 → 修复并重跑该条，禁止带病提交。

- [ ] **Step 5: Commit**

```bash
git add README.md README.zh.md manifest.json versions.json package.json
git commit -m "docs: document zoom/fullscreen features, bump 1.1.0, add upstream attribution"
```

---

## 计划自查记录（writing-plans Self-Review）

1. **Spec 覆盖**：spec §2（方案 A 数学/边界/滚轮策略/移动端）→ Task 5/6；§3 交互（工具栏/缩放控件/全屏/命令/**错误占位卡**）→ Task 7/8/9 + Task 4 第 5 条（ErrorPlaceholder + 零高度兜底）+ Task 8 Step 3 冒烟第 3 条；§4 P0（升级/生命周期/双语法/响应式/错误三模式/minAppVersion/迁移）→ Task 1/2/3/4/8/10，P1（工具栏/缩放/全屏/fence/命令/声明式设置）→ Task 3/6/7/8/9；§5 目录 → 各任务 Files 与产出一致（renderer 3 文件 + ui 5 文件 + fence + parser + types）；§6 接口 → Task 5 Produces 与 spec 签名一致；§7 R1-R12 → R1(数学断言)、R2(relayout reset)、R3(wheelMode 红线)、R4(isResizing 门控)、R5(error 订阅→reportRenderError)、R6(ownerDocument.defaultView)、R7(降级链)、R8(唯一定位移植)、R9(Task 1 Step 6 回归)、R10(loading/onClose destroy)、R11(PNG→SVG 上游 ExportModal 链)、R12(scheduleRenderSanityCheck 零高度检测→占位卡) 均有落点；§8 合规 → Task 1/10；§9 清理链 → Task 4 第 7 条 / Task 6 第 6 条；§10 十条（验收 4 含占位卡与零高度断言）→ Task 8 Step 3 / Task 9 Step 4 / Task 10 Step 4。无缺口。
2. **占位符扫描**：已复核全文无 "TBD/TODO/适当处理" 类空洞步骤；代码步骤均为可直接落盘的完整代码或精确到行号的移植指令。唯一有意的临时实现是 Task 8 `openFullscreen` 的 Notice 占位（FullscreenModal 在 Task 9 才创建），Task 9 Step 2 显式替换为最终实现，中间状态可构建、可冒烟。
3. **类型一致性**：`ParseResult`/`parseInfographicSpec`（Task 2↔8）；`RenderOptions.onRenderError`/`onPanZoomChange`、`getPanZoom/zoomIn/zoomOut/fitWidth`（Task 4/6↔8）；`renderInfographicInto(container, payload)`（Task 4↔9）；`createErrorPlaceholder(parent, {message, onDetails})`（Task 4↔8）；`createToolbar(parent, handlers): ToolbarControls`、`copyImageToClipboard(dataUrl, fallbackText)`（Task 7↔8）；`FullscreenPayload`（Task 9↔8 的 openFullscreen）；`theme: ThemeSetting`（settings ↔ RenderOptions）——签名已逐一核对一致。
