// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { Editor, MarkdownPostProcessorContext, MarkdownView, Notice, Plugin } from "obsidian";
import type { Infographic } from "@antv/infographic";
import { DEFAULT_SETTINGS, ErrorBehavior, InfographicSettingTab, InfographicSettings, ThemeSetting } from "./settings";
import { parseInfographicSpec, showParseError } from "./parser";
import { clearFenceSize, getFenceAlign, parseHeightParam, parseWidthParam, persistBlockHeight, persistBlockWidth, persistFenceUpdate, resolveFenceText, setFenceAlign } from "./fence";
import { FullscreenModal, getCachedBlockHeight, InfographicRenderChild } from "./renderer";
import { copyImageToClipboard, createErrorPlaceholder, createToolbar, ExportModal, SourceCodeModal } from "./ui";
import type { ToolbarControls } from "./ui";
import { i18n } from "./lang";

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
	private rerenderTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new InfographicSettingTab(this.app, this));
		this.registerMarkdownCodeBlockProcessor("infographic", (source, el, ctx) => {
			void this.processInfographicBlock(source, el, ctx);
		});
		this.registerCommands();
	}

	onunload(): void {
		if (this.rerenderTimer !== null) {
			window.clearTimeout(this.rerenderTimer);
			this.rerenderTimer = null;
		}
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
			if (this.settings.errorBehavior !== "hide") {
				showParseError(result.error);
			}
			this.handleError(el, result.error, source);
			return;
		}
		// 高度桥接：重建窗口内先撑起上次高度，渲染完成后撤除（见下方 rAF）
		const cachedHeight = getCachedBlockHeight(result.content);
		if (cachedHeight && cachedHeight > 0) {
			el.style.setProperty("min-height", `${cachedHeight}px`);
		}

		const container = el.createDiv({ cls: "infographic-wrapper" });

		// fence 参数：width=N（渲染宽度上限）、height=N（固定块高度）、align=center|left（水平对齐，缺省左对齐）
		const fence = resolveFenceText(this.app, ctx, el, source);
		const fenceWidth = fence ? parseWidthParam(fence) : null;
		if (fenceWidth !== null) {
			const available = el.clientWidth || fenceWidth;
			container.style.width = `${Math.min(fenceWidth, available)}px`;
		}
		const fenceHeight = fence ? parseHeightParam(fence) : null;
		const fenceAlign = fence ? getFenceAlign(fence) : null;
		let centered = fenceAlign !== null ? fenceAlign === "center" : this.settings.centerByDefault;
		container.toggleClass("infographic-centered", centered);

		// 缩放百分比实时显示：toolbar 在 renderChild 之后创建，先声明后由闭包引用
		let toolbarControls: ToolbarControls | null = null;

		const renderChild = new InfographicRenderChild(container, {
			content: result.content,
			isJson: result.isJson,
			theme: this.settings.theme,
			isDarkMode: this.isDarkMode(),
			explicitWidth: fenceWidth ?? undefined,
			explicitHeight: fenceHeight ?? undefined,
			onWidthCommit: (width) => persistBlockWidth(this.app, ctx, el, source, width),
			onHeightCommit: (height) => persistBlockHeight(this.app, ctx, el, source, height),
			enableResizeHandles: this.settings.enableResizeHandles,
			enableZoom: this.settings.enableZoom,
			onRenderError: (message) => this.handleError(el, message, source),
			onPanZoomChange: (state) => toolbarControls?.setZoomPercent(state.scale * 100),
		});
		ctx.addChild(renderChild);
		// PDF 导出等管线可能不触发 onload，这里保证幂等启动
		renderChild.ensureStarted();

		if (this.settings.showToolbar) {
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
						() => new Notice(i18n.copySourceSuccess),
						() => new Notice(i18n.copyFailed),
					);
				},
				onCopyImage: () => {
					const instance = renderChild.getInfographic();
					if (!instance) return;
					void (async () => {
						try {
							const dataUrl = await instance.toDataURL({ type: "png" });
							const outcome = await copyImageToClipboard(dataUrl, source);
							new Notice(outcome === "image" ? i18n.copyImageSuccess : i18n.copyImageFallback);
						} catch (error) {
							console.error("[Infographic Plugin] Copy image error:", error);
							new Notice(i18n.copyFailedWithReason + (error instanceof Error ? error.message : String(error)));
						}
					})();
				},
				onExport: () => {
					const instance = renderChild.getInfographic();
					if (instance) new ExportModal(this.app, instance).open();
				},
				onZoomIn: () => renderChild.zoomIn(),
				onZoomOut: () => renderChild.zoomOut(),
				onFit: () => {
					renderChild.fitWidth();
					persistFenceUpdate(this.app, ctx, el, source, (fence) => clearFenceSize(fence));
				},
				onFullscreen: () => this.openFullscreen(result.content, result.isJson, renderChild.getInfographic()),
			}, { showZoomControls: this.settings.enableZoom });
		}

		const doc = el.ownerDocument;
		const settleWin = doc.defaultView;
		if (settleWin && cachedHeight) {
			settleWin.requestAnimationFrame(() => {
				settleWin.requestAnimationFrame(() => {
					el.style.removeProperty("min-height");
				});
			});
		}
	}

	private openFullscreen(content: string, isJson: boolean, instance: Infographic | null): void {
		new FullscreenModal(this.app, {
			content,
			isJson,
			theme: this.resolveTheme(),
			sourceInstance: instance,
		}).open();
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

	/** 接管声明式设置读取：默认实现直接操作 loadData，绕开内存 settings；改读 this.settings 保证同步 */
	getControlValue(key: string): unknown {
		return (this.settings as unknown as Record<string, unknown>)[key];
	}

	/** 接管声明式设置写入：更新内存 settings 并落盘，随后防抖重渲染所有打开的笔记 */
	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.settings as unknown as Record<string, unknown>)[key] = value;
		await this.saveSettings();
		this.scheduleSettingsRerender();
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
		// R5：errorBehavior 合法性校验——手改 data.json 出现非法值时回退默认，防声明式 dropdown 出现空值
		let errorBehavior: ErrorBehavior = DEFAULT_SETTINGS.errorBehavior;
		if (data?.errorBehavior === "show-code" || data?.errorBehavior === "show-error" || data?.errorBehavior === "hide") {
			errorBehavior = data.errorBehavior;
		}
		this.settings = {
			theme,
			errorBehavior,
			enableResizeHandles: typeof data?.enableResizeHandles === "boolean" ? data.enableResizeHandles : DEFAULT_SETTINGS.enableResizeHandles,
			enableZoom: typeof data?.enableZoom === "boolean" ? data.enableZoom : DEFAULT_SETTINGS.enableZoom,
			showToolbar: typeof data?.showToolbar === "boolean" ? data.showToolbar : DEFAULT_SETTINGS.showToolbar,
			centerByDefault: typeof data?.centerByDefault === "boolean" ? data.centerByDefault : DEFAULT_SETTINGS.centerByDefault,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** 设置变更后防抖重渲染所有打开的笔记，已渲染块立即应用新设置（高度桥接会尽量稳住滚动） */
	private scheduleSettingsRerender(): void {
		if (this.rerenderTimer !== null) {
			window.clearTimeout(this.rerenderTimer);
		}
		this.rerenderTimer = window.setTimeout(() => {
			this.rerenderTimer = null;
			this.app.workspace.iterateAllLeaves((leaf) => {
				const view = leaf.view;
				if (view instanceof MarkdownView) {
					const state = view.getState();
					void view.setState(state, { history: false });
				}
			});
		}, 200);
	}
}
