# obsidian-infographic 升级与缩放查看设计

- 日期：2026-11-09
- 状态：已经用户确认（6 节设计全部通过）
- 评审：role-pm（MVP 边界与砍单）、role-architect（方案裁决与风险清单）两席独立论证后合并

## 1. 背景与目标

本插件（`antv-infographic`，当前 1.0.2）用 `@antv/infographic` 在 Obsidian 中渲染 ` ```infographic ` 代码块。现状问题：

- 依赖停留在 0.2.7（最新 0.2.20，含 PNG 导出多行文本截断修复、ShadowRoot 支持等）。
- 无 `MarkdownRenderChild` 生命周期管理：`new Infographic` 后无人 `destroy()`；块级 `contextmenu` 监听通过 `plugin.registerDomEvent` 注册在插件生命周期上（src/main.ts:50），每次重渲染累积泄漏。
- 仅支持 DSL 语法（JSON 不解析）；无响应式（分栏/改窗宽后错位）；错误处理只打一行文本；无命令。
- 无缩放/平移能力，大图（宽表格、层级图）在笔记栏宽内看不清。

本次版本目标：升级库、对齐上游 shuuul/obsidian-infographic（Apache-2.0，v0.2.0）的成熟设计、新增视图层缩放 + 全屏查看（参考 Obsidian 1.15 原生 Mermaid 交互：响应笔记宽度、可缩放平移）。

### 已确认的用户决策

1. 功能吸收范围 = 交互增强级：核心修复 + hover 工具栏 + fence 参数（width/align）与拖拽调宽回写；**不做** PDF 导出管线。
2. 缩放交互 = 全屏查看 + 视图层缩放按钮（mermaid 式控件）。
3. 兼容底线 = Obsidian 1.13.0+（采用声明式设置 API）；`isDesktopOnly` 保持 `false`。

## 2. 缩放实现方案裁决

**采用方案 A：CSS transform 视图层缩放。** SVG 按容器宽度渲染一次；缩放平移只改内层 `transform: translate(x,y) scale(s)`；导出走原实例 `toDataURL()`，恒为全图、不受视图缩放影响。

**否决方案 B（库原生 `editable: true` + ZoomWheel/DragCanvas）**，依据 0.2.20 dist 源码：

1. `shouldZoom` 硬编码要求 Ctrl/Cmd（光标枢轴）或 Shift（中心缩放），裸滚轮直接 return——不满足 mermaid 式体验（`editor/interactions/zoom-wheel.js:61-71`）。
2. 缩放前必须先点击激活该图表（`interaction.isActive()` 门控 + document 级 click 判定）。
3. `DragCanvas({trigger: []})` 是死路：`drag-canvas.js:39-42` 对空数组永远 return；必须指定触发键（默认 `Space`，与 Obsidian 编辑器语义冲突）。
4. `editable: true` 副作用包：SVG 强制 `userSelect='none'`；每实例向 document 挂 click/wheel/keyup 监听（一屏 N 图 = N 份全局监听）；DragCanvas 直写 `document.body.style.cursor`。
5. `update()` 即全量重渲染并销毁重建 editor（`runtime/Infographic.js:62-97`）→ ResizeObserver 联动的每次响应式更新都清空缩放态。响应式宽度与缩放态无法共存。
6. 缩放污染导出：`exportToSVG` 克隆当前 SVG 且 `computeFullViewBox` 只扩不缩 → 缩放后导出为裁剪图。

**否决方案 C（`instance.update({width, height})` 当缩放）**：`compose()` 把宽高传入 Structure 组件参与布局决策（文本换行、栅格列数会变），是重排版不是缩放；每档一次全量重渲染必卡。C 的正当用途只有响应式宽度——即方案 A 中 ResizeObserver 的用法。

### 方案 A 实现要点

- 锚定缩放：`s' = clamp(s·k_req, min, max)`，`k = s'/s`（**触顶时必须用实际 k 重算**，否则漂移），`t' = a − k·(a − t)`。按钮缩放 a = viewport 中心；滚轮缩放 a = 光标位置。
- 平移边界：`s ≤ 1` 时 `t = 0` 且禁用 pan；`s > 1` 时 `t.x ∈ [min(0, vw − s·cw), max(0, vw − s·cw)]`，y 同理；viewport 层 `overflow: hidden`。
- `transform` 不改 layout 尺寸 → 不触发 ResizeObserver → 与响应式宽度正交。
- 拖拽调宽期间：pointerdown 时 `controller.reset()`；RO 触发 `update()` 后 `relayout({resetIfZoomed: true})`。
- 滚轮策略（不劫持笔记滚动是红线）：fit 态（scale=1）完全不拦截滚轮；Ctrl/Cmd+滚轮任何时候缩放（preventDefault 阻止浏览器页面缩放）；scale>1 时滚轮直接缩放。全屏 Modal 内恒定拦截。
- 移动端：双 PointerEvent 距离实现 pinch；`touch-action: none` 只加在 viewport 层；scale>1 单指拖 = 平移。
- rAF 合帧：wheel/pointermove 只记 pending 增量，帧回调统一 apply。

## 3. 交互设计

### 笔记内（阅读模式 / 实时预览）

- 图表默认 fit 容器宽度（响应式）。
- hover 显示工具栏（移动端 tap 唤出）：**居中、复制源码、复制图片、导出 PNG、导出 SVG、全屏**。完全替代现有右键菜单（移动端无右键；每个动作一个入口，避免双入口漂移；右键恢复 Obsidian 原生行为）。
- mermaid 式缩放控件组，与工具栏一体（工具栏右侧按钮组：**− / 百分比 / ＋ / 适应宽度 / 全屏**），同一 hover/tap 入口出现；不做条件显隐（fit 态点 ＋ 开始看细节本身就是核心用例）。
- 双击图表 = 重置缩放。

### 全屏查看器（FullscreenModal）

- 打开时按适应屏幕**重渲染新实例**（不是 clone：全屏语义就是大画布重排；clone 无法 update/toDataURL，且全屏宽度 ≠ 笔记宽度导致布局不符）。
- loading 态；控件常显；滚轮恒缩放；拖拽平移；双击重置；Esc / 关闭按钮退出。
- 导出/复制按钮持有**原笔记内实例**引用（`renderChild.getInfographic()` 模式），导出恒为全图。
- `onClose()` 中 destroy 实例 + `controller.destroy()` + `contentEl.empty()`；同屏仅允许一个全屏 Modal。

### 命令

- `insert-template`：光标处插入 ```infographic 围栏 + 三步 JSON 模板（`list-row-simple-horizontal-arrow`，与上游 INFOGRAPHIC_TEMPLATE 一致），光标落在模板内，插入后即刻渲染。

### 错误占位卡（统一失败呈现）

解析失败（非法 JSON/空块）、渲染失败（库 throw 或 `emit('error')`）、渲染产物为空（如模板名错误，库可能不报错只产出空 SVG）三种路径**必须**落到同一张错误占位卡：图标（lucide `circle-alert`）+ 错误信息 +（按 errorBehavior 设置）"View details" 按钮打开 SourceCodeModal 或直接附源码。**任何失败路径不得留下高度为 0 的透明块或空白占位**；`hide` 模式（用户显式选择）除外。产物为空的兜底：渲染后 rAF 检测 SVG 缺失或 `getBoundingClientRect().height < 1` 即按渲染失败处理。

## 4. 功能边界

| 层级 | 内容 | 依据 |
|---|---|---|
| P0 必须 | 库升级 0.2.20；MarkdownRenderChild 生命周期 + destroy；双语法解析；ResizeObserver 响应式；错误三模式（show-code / show-error / hide）+ SourceModal；minAppVersion→1.13.0；defaultTheme→auto 设置迁移 | 修内存泄漏/幽灵实例；JSON 支持补半用户面；声明式设置 API 前提 |
| P1 进 MVP | hover 工具栏（替代右键菜单）；视图层缩放控件；全屏 Modal；fence `width=N`/`align=center` 读取 + 拖拽调宽回写；insert-template 命令；声明式设置（主题 auto/light/dark、错误行为） | 用户决策 + PM 席 |
| P2 不进验收 | refresh 命令；centerByDefault 设置；主题切换实时重渲 | 有响应式后场景消失大半/锦上添花 |
| 砍单 | PDF 导出管线（printSnapshot/snapshotFileCache/beforeprint）；editable 编辑器；autoRender 设置；缩放行为设置项；右键菜单；active-leaf-change 强刷 | 用户拍板 + PM 席补量化理由（PDF 管线为每次渲染+250ms 快照的常驻性能税） |

## 5. 目录结构

```
src/
  main.ts                     # 瘦入口：processor 注册、命令、错误三模式调度（~200 行）
  settings.ts                 # 声明式设置（getSettingDefinitions）
  fence.ts                    # fence 参数解析/回写/唯一定位（从上游 main.ts:22-122、414-453 整体迁出）
  parser/InfographicParser.ts # 双语法解析（JSON / DSL，parseSyntax）
  renderer/InfographicView.ts # MarkdownRenderChild：RO、viewBox 宽高比推导、拖宽手柄
  renderer/PanZoomController.ts   # 新增：视图层缩放/平移控制器
  renderer/FullscreenModal.ts     # 新增：全屏查看器（复用 PanZoomController）
  ui/ErrorPlaceholder.ts      # 新增：统一错误占位卡（解析失败/渲染失败/零高度产物共用）
  ui/Toolbar.ts               # hover 工具栏（从上游 main.ts:307-353 抽出）
  ui/ExportModal.ts
  ui/SourceModal.ts
  types/obsidian-window.ts    # popout 窗口类型支撑
styles.css                    # 工具栏/控件/手柄/Modal 样式（沿用上游 + 新增缩放控件）
```

不移植 `renderer/printSnapshot.ts`、`renderer/snapshotFileCache.ts`。

## 6. PanZoomController 接口

```ts
export interface PanZoomState {
	readonly scale: number; // 1 = fit 态
	readonly x: number;     // translate px（viewport 坐标系）
	readonly y: number;
}

export interface PanZoomOptions {
	/** overflow:hidden 的裁剪层，接收 wheel/pointer 事件 */
	viewportEl: HTMLElement;
	/** 被 transform 的内容层（SVG 的父级）。Controller 不创建/不拥有 DOM */
	contentEl: HTMLElement;
	minScale?: number;   // default 1
	maxScale?: number;   // default 8
	/** scale=1 时不拦截滚轮（笔记内用）；'always' 供全屏用 */
	wheelMode?: 'when-zoomed' | 'always';
	onChange?: (state: PanZoomState) => void; // rAF 合帧后回调（百分比显示用）
	onReset?: () => void;
}

export declare class PanZoomController {
	constructor(options: PanZoomOptions);
	getState(): PanZoomState;
	isZoomed(): boolean;
	zoomTo(scale: number, anchor?: { x: number; y: number }): void;
	zoomBy(factor: number, anchor?: { x: number; y: number }): void;
	panBy(dx: number, dy: number): void;
	reset(): void;
	relayout(options?: { resetIfZoomed?: boolean }): void;
	destroy(): void;
}
```

设计决策：只接管既有元素、不创建 DOM（笔记内 wrapper 内层 div 与全屏 modal viewport div 双场景零改动复用）；window/document 级监听集中在 `destroy()` 移除；rAF 与 window 监听取 `contentEl.ownerDocument.defaultView`（popout 正确性，修正上游用裸 `window` 的不规范处）。

## 7. 降级与风险

| # | 风险/故障点 | 严重度 | 缓解 |
|---|---|---|---|
| R1 | 锚定缩放 clamp 触顶未按实际 k 重算 → 光标漂移 | 中 | `zoomTo/zoomBy` 统一单公式；验证矩阵：3 锚点 × 放大/缩小 × 触顶 |
| R2 | zoom 态下拖宽/RO 更新后 transform 基准失效 | 中 | 拖宽 pointerdown 与 RO-update 后均 reset |
| R3 | 滚轮劫持笔记滚动 | 高 | `wheelMode: 'when-zoomed'`：fit 态零拦截；全屏内才 always |
| R4 | 拖宽期间 RO 每帧全量重渲染（上游无 debounce） | 中 | 拖拽期只改 CSS width，pointerup 提交时一次 update；RO 回调 rAF 合帧（对上游的改进） |
| R5 | 库 0.2.20 解析错误 `emit('error')` 不 throw，try/catch 静默失效 | 高 | 强制 `instance.on('error', …)` 订阅 + try/catch 兜底，两路都进错误三模式 |
| R6 | popout 窗口 rAF/监听引用主 window | 中 | 统一 `ownerDocument.defaultView`；保留 types/obsidian-window.ts |
| R7 | ClipboardItem 部分移动 WebView 不支持 | 中 | 降级链：`clipboard.write(PNG)` → `writeText(源码)` + Notice 引导导出 |
| R8 | fence 回写误定位改坏笔记 | 高 | 只吸收上游唯一定位守卫（`findUniqueBlockFence` matches===1）；阅读模式/hover 他文件/重复块三场景均放弃回写（重复块给"宽度仅本次会话生效"Notice）。实现偏离：三场景（阅读模式/hover 他文件/重复块）均静默放弃持久化，不弹 Notice——避免每次拖动打扰；用户可从宽度未回写感知 |
| R9 | 库 0.2.7→0.2.20 行为差异回归 | 中 | 升级后用 README 全部示例 + 存量笔记人工比对 |
| R10 | ResizeObserver 不可用（防御） | 低 | 降级为一次性定宽渲染（parentElement.clientWidth） |
| R11 | toDataURL PNG 失败 | 低 | PNG → SVG 回退链（导出按钮内） |
| R12 | 渲染产物为空（模板名/数据错误时库可能不报错只产出空 SVG）→ 用户看到高度 0 的透明块 | 高 | 渲染后 rAF 零高度检测（svg 缺失或 height<1）→ 按渲染失败走错误占位卡（§3 错误占位卡） |

## 8. 许可合规

- 本地 `LICENSE` 现为 Obsidian 样例模板的 Dynalist Inc. 文本，与 `package.json` 的 `"license": "MIT"` 名实不符——随本次换为标准 MIT 文本。
- 移植自上游（Apache-2.0）的代码：仓库根新增 `LICENSE-APACHE-2.0`（上游原文）；每个移植/改写文件头部加 `// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.`；README 致谢段注明来源仓库、版本（v0.2.0）与改动范围（Apache-2.0 §4a "state changes"）。
- 不做重许可：主许可 MIT + 部分文件 Apache-2.0 并存。

## 9. 生命周期清理链（MarkdownRenderChild.onunload）

1. `panZoomController.destroy()`（最先）
2. `clearTimeout` 挂起 timer
3. `resizeObserver.disconnect()`
4. `infographic.destroy()` 包 try/catch（库已销毁态可能 throw）

注册纪律：块级 DOM 事件一律 `renderChild.registerDomEvent`（禁止 `plugin.registerDomEvent` 用于块级元素）；`ctx.addChild(renderChild)` 必须调用；window/document 级监听只允许存在于 PanZoomController（destroy 集中清理）。

## 10. 验收标准

1. **生命周期**：长笔记反复滚动/切换 30+ 次，DOM 节点与堆内存不持续增长；卸载插件无残留。
2. **双语法**：官方 JSON 与 DSL 示例均渲染；非法 JSON 显示可诊断错误。
3. **响应式**：拖分栏线图表跟随新宽度、宽高比保持。
4. **错误三模式与占位卡**：show-code/show-error/hide 生效；View details 打开 SourceModal；解析失败、渲染失败、未知模板名三种输入均显示错误占位卡（图标+信息），**页面中不存在高度为 0 的透明/空白块**（hide 模式除外）。
5. **工具栏**：hover（移动端 tap）出现；复制源码/复制图片/导出 PNG+SVG 可用（移动端降级有 Notice）；右键恢复原生行为。
6. **缩放红线**：fit 态普通滚轮滚笔记；Ctrl/Cmd+滚轮缩放；放大后滚轮缩放/拖拽平移/双击复位；百分比实时；导出不受缩放影响。
7. **全屏**：打开即 fit 屏幕；缩放/平移/重置/Esc/导出可用。
8. **fence**：`width=500` 渲染 500px（不超可用宽度）；拖手柄回写 fence 行；阅读模式/hover 他文件/重复块三场景不误写。
9. **命令**：Ctrl+P 插入模板，光标落模板内，即刻渲染。
10. **升级回归**：README 全部示例照常渲染；defaultTheme 老设置迁移不报错。

验证方式：`npm run build`（tsc + esbuild）+ 手动装载 Obsidian 冒烟（复制 main.js/manifest.json/styles.css 到测试 vault）。项目无测试框架，不引入。

## 11. 非目标

- PDF 导出管线（可后续单独版本评估）
- 图表编辑能力（`editable: true` 完整编辑器；若未来库提供非 editable 交互挂载点或 shouldZoom 配置化，可重评方案 B）
- 网络功能、遥测（遵守 Obsidian 开发者政策，全程本地）
