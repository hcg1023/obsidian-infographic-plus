// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { Editor, MarkdownPostProcessorContext, Notice, Plugin } from "obsidian";
import type { Infographic } from "@antv/infographic";
import { buildStylizeConfig, DEFAULT_SETTINGS, ErrorBehavior, InfographicSettingTab, InfographicSettings, patternOptions, StylizeTypeSetting, ThemeSetting } from "./settings";
import { parseInfographicSpec } from "./parser";
import { clearFenceSize, getFenceAlign, parseHeightParam, parseWidthParam, persistBlockHeight, persistBlockWidth, persistFenceUpdate, resolveFenceText, setFenceAlign } from "./fence";
import { applySettingsToAllInfographics, FullscreenModal, getCachedBlockHeight, InfographicRenderChild } from "./renderer";
import { copyImageToClipboard, createErrorPlaceholder, createToolbar, ExportModal, openInfographicMenu, SourceCodeModal } from "./ui";
import type { ToolbarControls, ToolbarHandlers } from "./ui";
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
			// 错误呈现只走笔记内错误卡片（errorBehavior 三模式），不再弹 Notice——多块/重渲时弹窗会刷屏
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
			stylize: buildStylizeConfig(this.settings),
		});
		ctx.addChild(renderChild);
		// PDF 导出等管线可能不触发 onload，这里保证幂等启动
		renderChild.ensureStarted();

		// 工具栏与右键菜单共用同一份 handlers，两处入口调用相同逻辑
		const handlers: ToolbarHandlers = {
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
			onZoomReset: () => renderChild.resetZoom(),
			onFit: () => {
				renderChild.fitWidth();
				persistFenceUpdate(this.app, ctx, el, source, (fence) => clearFenceSize(fence));
			},
			onFullscreen: () => this.openFullscreen(result.content, result.isJson, renderChild.getInfographic()),
		};
		if (this.settings.showToolbar) {
			toolbarControls = createToolbar(container, handlers, { showZoomControls: this.settings.enableZoom });
		}
		// 右键快捷菜单：与工具栏同一份 handlers，不受 showToolbar 开关影响
		container.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			openInfographicMenu(handlers, event, { showZoomActions: this.settings.enableZoom });
		});

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
			stylize: buildStylizeConfig(this.settings),
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

	async loadSettings() {
		const data = await this.loadData() as (Partial<InfographicSettings> & { defaultTheme?: string }) | null;
		// 主题：auto/任意已注册主题 id；兼容旧版 defaultTheme（显式 light/dark 保留，其余归 auto）
		let theme: ThemeSetting = DEFAULT_SETTINGS.theme;
		if (typeof data?.theme === "string" && data.theme) {
			theme = data.theme;
		} else if (data?.defaultTheme === "light" || data?.defaultTheme === "dark") {
			theme = data.defaultTheme;
		}
		// R5：errorBehavior 合法性校验——手改 data.json 出现非法值时回退默认，防声明式 dropdown 出现空值
		let errorBehavior: ErrorBehavior = DEFAULT_SETTINGS.errorBehavior;
		if (data?.errorBehavior === "show-code" || data?.errorBehavior === "show-error" || data?.errorBehavior === "hide") {
			errorBehavior = data.errorBehavior;
		}
		// 风格化：类型走白名单，参数按各自形态校验后回退默认
		const stylizeTypes: StylizeTypeSetting[] = ["none", "rough", "pattern", "linear-gradient", "radial-gradient"];
		const stylizeType: StylizeTypeSetting = stylizeTypes.includes(data?.stylizeType as StylizeTypeSetting)
			? (data!.stylizeType as StylizeTypeSetting)
			: DEFAULT_SETTINGS.stylizeType;
		this.settings = {
			theme,
			errorBehavior,
			enableResizeHandles: typeof data?.enableResizeHandles === "boolean" ? data.enableResizeHandles : DEFAULT_SETTINGS.enableResizeHandles,
			enableZoom: typeof data?.enableZoom === "boolean" ? data.enableZoom : DEFAULT_SETTINGS.enableZoom,
			showToolbar: typeof data?.showToolbar === "boolean" ? data.showToolbar : DEFAULT_SETTINGS.showToolbar,
			centerByDefault: typeof data?.centerByDefault === "boolean" ? data.centerByDefault : DEFAULT_SETTINGS.centerByDefault,
			stylizeType,
			stylizeRoughness: typeof data?.stylizeRoughness === "number" && Number.isFinite(data.stylizeRoughness) ? data.stylizeRoughness : DEFAULT_SETTINGS.stylizeRoughness,
			stylizePattern: typeof data?.stylizePattern === "string" && data.stylizePattern in patternOptions() ? data.stylizePattern : DEFAULT_SETTINGS.stylizePattern,
			stylizeColorFrom: typeof data?.stylizeColorFrom === "string" && /^#[0-9a-fA-F]{6}$/.test(data.stylizeColorFrom) ? data.stylizeColorFrom : DEFAULT_SETTINGS.stylizeColorFrom,
			stylizeColorTo: typeof data?.stylizeColorTo === "string" && /^#[0-9a-fA-F]{6}$/.test(data.stylizeColorTo) ? data.stylizeColorTo : DEFAULT_SETTINGS.stylizeColorTo,
			stylizeAngle: typeof data?.stylizeAngle === "number" && Number.isFinite(data.stylizeAngle) ? data.stylizeAngle : DEFAULT_SETTINGS.stylizeAngle,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 设置变更后防抖刷新所有存活块（由设置页 setControlValue 触发）。
	 * 就地 update 实例而非重跑渲染管线：previewMode.rerender 命中 Obsidian 代码块渲染缓存，
	 * 会拿回旧结果（此前"必须关页签重开才生效"的根因）。宽高/缩放不受影响。
	 */
	scheduleSettingsRerender(): void {
		if (this.rerenderTimer !== null) {
			window.clearTimeout(this.rerenderTimer);
		}
		this.rerenderTimer = window.setTimeout(() => {
			this.rerenderTimer = null;
			applySettingsToAllInfographics(this.resolveTheme(), buildStylizeConfig(this.settings));
		}, 200);
	}
}
