// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
// Ported from https://github.com/shuuul/obsidian-infographic (src/renderer/InfographicView.ts)
import { MarkdownRenderChild } from "obsidian";
import { Infographic } from "@antv/infographic";
import type { InfographicOptions, StylizeConfig, ThemeConfig } from "@antv/infographic";
import type { ThemeSetting } from "../settings";
import { createErrorPlaceholder } from "../ui/ErrorPlaceholder";
import { PanZoomController } from "./PanZoomController";
import type { PanZoomState } from "./PanZoomController";
import { i18n } from "../lang";
export interface RenderOptions {
	content: string;
	isJson: boolean;
	theme: ThemeSetting;
	isDarkMode: boolean;
	/** 插件设置的风格化（渲染级 themeConfig.stylize）；JSON 块内自带 themeConfig.stylize 时以块内为准 */
	stylize?: StylizeConfig;
	/** Fence-level width override in px (```infographic width=N) */
	explicitWidth?: number;
	/** Fence-level height override in px (```infographic height=N) */
	explicitHeight?: number;
	/** 边缘拖拽调宽高手柄，缺省视为 true */
	enableResizeHandles?: boolean;
	/** Ctrl/Cmd+滚轮缩放与拖拽平移，缺省视为 true */
	enableZoom?: boolean;
	onWidthCommit?: (width: number) => void;
	onHeightCommit?: (height: number) => void;
	/** 适应宽度：请求宿主清除 fence 的 width/height 参数（写回源码模式生效）。 */
	onFitToWidth?: () => void;
	onRenderError?: (message: string) => void;
	/** 缩放/平移状态变化回调（Task 7 工具栏用于刷新百分比标签）。 */
	onPanZoomChange?: (state: PanZoomState) => void;
}

export interface RenderPayload {
	content: string;
	isJson: boolean;
	theme?: string;
	stylize?: StylizeConfig;
	width: number;
	height: number;
	explicitWidth?: number;
	explicitHeight?: number;
}


interface ParsedInfographicConfig {
	width?: number;
	height?: number;
	theme?: string;
	themeConfig?: ThemeConfig;
	template?: string;
	data?: InfographicOptions["data"];
}

/**
 * 块级 themeConfig 与插件设置 stylize 合并：其余字段块级优先，stylize 块级优先、缺省回落插件设置。
 * 两侧都为空时返回 undefined（不传 themeConfig，主题自带 stylize 生效）。
 */
function mergeThemeConfig(jsonThemeConfig: ThemeConfig | undefined, pluginStylize: StylizeConfig | undefined): ThemeConfig | undefined {
	if (!jsonThemeConfig && !pluginStylize) return undefined;
	return {
		...jsonThemeConfig,
		...(pluginStylize || jsonThemeConfig?.stylize ? { stylize: jsonThemeConfig?.stylize ?? pluginStylize } : {}),
	};
}

const DEFAULT_ASPECT_RATIO = 4 / 3;
const MIN_DRAG_WIDTH = 200;
const MIN_DRAG_HEIGHT = 100;

/** 块高缓存：回写 fence 触发重建时，新渲染先撑起旧高度（高度桥接），避免 CM6 在重建窗口内因高度塌缩丢失滚动锚点。 */
const blockHeightCache = new Map<string, number>();
const BLOCK_HEIGHT_CACHE_LIMIT = 50;

export function getCachedBlockHeight(content: string): number | null {
	return blockHeightCache.get(content) ?? null;
}

function cacheBlockHeight(content: string, height: number): void {
	if (!blockHeightCache.has(content) && blockHeightCache.size >= BLOCK_HEIGHT_CACHE_LIMIT) {
		// FIFO 淘汰最旧键；for..of 迭代键类型为 string，避开 next().value 的 any 断言
		for (const oldest of blockHeightCache.keys()) {
			blockHeightCache.delete(oldest);
			break;
		}
	}
	blockHeightCache.set(content, height);
}

/**
 * 创建并渲染一个 Infographic 实例（JSON 走 parse+strip，DSL 直接 render）。
 * onInit 在构造之后、render() 之前调用——用于提前订阅 "error" 事件，
 * 防止库在 render() 内同步 emit 时丢事件（Task 9 全屏 Modal 同样应经此订阅）。
 * explicitHeight（```infographic height=N）优先于 JSON/DSL 自带高度。
 */
export function renderInfographicInto(
	container: HTMLElement,
	payload: RenderPayload,
	onInit?: (instance: Infographic) => void,
): Infographic {
	if (payload.isJson) {
		const parsed = JSON.parse(payload.content) as ParsedInfographicConfig;
		const { width: jsonWidth, height: jsonHeight, theme: jsonTheme, themeConfig: jsonThemeConfig, ...rest } = parsed;
		const instance = new Infographic({
			container,
			width: payload.explicitWidth ?? jsonWidth ?? payload.width,
			height: payload.explicitHeight ?? (payload.explicitWidth ? payload.width / (payload.width / payload.height) : jsonHeight ?? payload.height),
			theme: jsonTheme ?? payload.theme,
			themeConfig: mergeThemeConfig(jsonThemeConfig, payload.stylize),
			...rest,
		});
		onInit?.(instance);
		instance.render();
		return instance;
	}
	const instance = new Infographic({
		container,
		width: payload.width,
		height: payload.explicitHeight ?? payload.height,
		theme: payload.theme,
		themeConfig: payload.stylize ? { stylize: payload.stylize } : undefined,
	});
	onInit?.(instance);
	instance.render(payload.content);
	return instance;
}

/** 存活渲染子组件注册表：设置变更时就地刷新，绕过 Obsidian 代码块渲染缓存（previewMode.rerender 会返回缓存结果） */
const liveRenderChildren = new Set<InfographicRenderChild>();

/** 对全部存活块就地应用新主题/风格化（阅读模式/实时预览/嵌入/hover 弹层均覆盖） */
export function applySettingsToAllInfographics(theme: string | undefined, stylize: StylizeConfig | undefined): void {
	for (const child of [...liveRenderChildren]) {
		if (child.containerEl.isConnected) child.applySettings(theme, stylize);
	}
}

export class InfographicRenderChild extends MarkdownRenderChild {
	private infographic: Infographic | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private options: RenderOptions;
	private loadingEl: HTMLElement | null = null;
	private aspectRatio: number = DEFAULT_ASPECT_RATIO;
	private started: boolean = false;
	private isResizing = false;
	private contentEl: HTMLElement | null = null;
	private panZoom: PanZoomController | null = null;
	/** 块级 JSON 自带主题（优先于插件设置，就地刷新时跳过） */
	private blockOwnTheme: string | undefined;
	/** 块级 JSON 自带主题配置（其 stylize 优先于插件设置） */
	private blockOwnThemeConfig: ThemeConfig | undefined;

	constructor(containerEl: HTMLElement, options: RenderOptions) {
		super(containerEl);
		this.options = options;
	}

	onload(): void {
		this.ensureStarted();
	}

	onunload(): void {
		this.cleanup();
	}

	getInfographic(): Infographic | null {
		return this.infographic;
	}

	getPanZoom(): PanZoomController | null {
		return this.panZoom;
	}

	zoomIn(): void {
		this.panZoom?.zoomBy(1.25);
	}

	zoomOut(): void {
		this.panZoom?.zoomBy(1 / 1.25);
	}

	/** 仅复位缩放/平移到 100%；不动块宽、不触发 fence 写回（完整还原用 fitWidth） */
	resetZoom(): void {
		this.panZoom?.reset();
	}

	/** 适应宽度：重置缩放，并请求宿主清除 fence 宽高参数（本地恢复见 fitToContainer） */
	fitWidth(): void {
		this.panZoom?.reset();
		this.fitToContainer();
		this.options.onFitToWidth?.();
	}

	/** 本地立即恢复自适应宽度（阅读模式/写回被拒时也生效，仅会话级） */
	private fitToContainer(): void {
		const wrapper = this.containerEl.closest<HTMLElement>(".infographic-wrapper");
		wrapper?.style.removeProperty("width");
		this.options.explicitWidth = undefined;
		this.options.explicitHeight = undefined;
		if (!this.infographic) return;
		const width = this.containerEl.clientWidth || wrapper?.clientWidth || 800;
		const height = width / this.aspectRatio;
		this.infographic.update({ width, height });
		this.rememberHeight();
	}

	/**
	 * Some Obsidian render pipelines (notably PDF export) may not invoke
	 * MarkdownRenderChild lifecycle hooks. This makes rendering idempotent and callable.
	 */
	ensureStarted(): void {
		if (this.started) return;
		this.started = true;
		liveRenderChildren.add(this);
		if (this.options.isJson) {
			// 块级 JSON 自带 theme/themeConfig 优先于插件设置，就地刷新时跳过对应字段（与首渲合并语义一致）
			try {
				const parsed = JSON.parse(this.options.content) as { theme?: string; themeConfig?: ThemeConfig };
				this.blockOwnTheme = parsed.theme;
				this.blockOwnThemeConfig = parsed.themeConfig;
			} catch {
				// 解析失败走错误卡片，无需块级覆盖
			}
		}
		this.showLoading();
		this.render();
		this.setupResizeObserver();
		if (this.options.enableResizeHandles !== false) this.setupResizeHandles();
		if (this.options.enableZoom !== false) {
			this.panZoom = new PanZoomController({
				viewportEl: this.containerEl,
				contentEl: this.contentEl!,
				wheelMode: "when-zoomed",
				onChange: (state) => this.options.onPanZoomChange?.(state),
			});
		}
	}

	/** 就地刷新主题与风格化：块级自带的字段跳过，其余走 update()（不动宽高/缩放） */
	applySettings(theme: string | undefined, stylize: StylizeConfig | undefined): void {
		if (!this.infographic) return;
		const update: Partial<InfographicOptions> = {};
		if (!this.blockOwnTheme && theme) update.theme = theme;
		// stylize 为空时传 null：清除此前就地应用过的风格化，库内 null 回落主题自带 stylize，
		// 正好是「无（跟随主题）」语义（渐变/图案清除已浏览器实测）
		update.themeConfig = this.blockOwnThemeConfig
			? mergeThemeConfig(this.blockOwnThemeConfig, stylize)
			: { stylize: stylize ?? null };
		try {
			this.infographic.update(update);
		} catch {
			// 实例已销毁等异常：静默跳过，块重建后自然应用新设置
		}
	}

	private getTheme(): string | undefined {
		if (this.options.theme === "auto") {
			return this.options.isDarkMode ? "dark" : "light";
		}
		return this.options.theme;
	}


	private showLoading(): void {
		this.containerEl.empty();
		this.containerEl.addClass("infographic-viewport");
		this.contentEl = this.containerEl.createDiv({ cls: "infographic-content" });
		this.loadingEl = this.contentEl.createDiv({ cls: "infographic-loading" });
		this.loadingEl.setText(i18n.loadingText);
	}

	private hideLoading(): void {
		if (this.loadingEl) {
			this.loadingEl.remove();
			this.loadingEl = null;
		}
	}

	private render(): void {
		const theme = this.getTheme();
		const containerWidth = this.containerEl.clientWidth || 800;
		const width = this.options.explicitWidth ?? containerWidth;
		const height = this.options.explicitHeight ?? width / DEFAULT_ASPECT_RATIO;

		try {
			this.infographic = renderInfographicInto(
				this.contentEl!,
				{
					content: this.options.content,
					isJson: this.options.isJson,
				theme,
				stylize: this.options.stylize,
				width,
				height,
					explicitWidth: this.options.explicitWidth,
					explicitHeight: this.options.explicitHeight,
				},
				(instance) => {
					instance.on("error", (error: unknown) => {
						const message = error instanceof Error ? error.message : String(error);
						console.error("[Infographic Plugin] Render error event:", message);
						this.hideLoading();
						this.reportRenderError(message);
					});
				},
			);
			this.hideLoading();
			this.updateAspectRatioFromSVG();
			this.scheduleRenderSanityCheck();
			this.rememberHeight();
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error("[Infographic Plugin] Render error:", message, {
				content: this.options.content.substring(0, 200),
				isJson: this.options.isJson,
			});
			this.hideLoading();
			this.reportRenderError(message);
		}
	}

	private setupResizeObserver(): void {
		if (typeof ResizeObserver === "undefined") return;

		this.resizeObserver = new ResizeObserver((entries) => {
			if (this.isResizing) return;
			if (this.infographic && this.containerEl.isConnected) {
				for (const entry of entries) {
					const { width } = entry.contentRect;
					if (width > 0) {
						const height = this.options.explicitHeight ?? width / this.aspectRatio;
						this.infographic.update({ width, height });
						this.rememberHeight();
						this.panZoom?.relayout({ resetIfZoomed: true });
					}
				}
			}
		});
		
		this.resizeObserver.observe(this.containerEl.parentElement ?? this.containerEl);
	}

	/** 渲染失败统一出口：优先交宿主（走错误三模式），否则本地占位卡兜底 */
	private reportRenderError(message: string): void {
		if (this.options.onRenderError) {
			this.options.onRenderError(message);
			return;
		}
		this.renderError(message);
	}

	private renderError(message: string): void {
		this.panZoom?.reset();
		this.destroyInfographic();
		this.containerEl.empty();
		createErrorPlaceholder(this.containerEl, { message: i18n.renderFailedPrefix + message });
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
				this.reportRenderError(i18n.emptyRender);
			}
		});
	}

	/**
	 * Drag handles on all four sides of the block: horizontal handles adjust
	 * the wrapper width, vertical ones the height. The ResizeObserver keeps
	 * the canvas in sync while dragging. Final sizes are persisted by the
	 * host via onWidthCommit / onHeightCommit.
	 */
	private setupResizeHandles(): void {
		const wrapper = this.containerEl.closest<HTMLElement>(".infographic-wrapper");
		if (!wrapper) return;

		for (const side of ["left", "right", "top", "bottom"] as const) {
			const isVertical = side === "top" || side === "bottom";
			const handle = wrapper.createDiv({cls: `infographic-resize-handle infographic-resize-${side}`});
			handle.setAttribute("aria-hidden", "true");
			this.registerDomEvent(handle, "pointerdown", (down: PointerEvent) => {
				this.isResizing = true;
				this.panZoom?.reset();
				down.preventDefault();
				const maxWidth = wrapper.parentElement?.clientWidth ?? wrapper.clientWidth;
				const startWidth = wrapper.clientWidth || maxWidth;
				const startHeight = wrapper.clientHeight || startWidth / this.aspectRatio;
				const startX = down.clientX;
				const startY = down.clientY;
				let latestWidth = startWidth;
				let latestHeight = startHeight;
				let frame: number | null = null;
				wrapper.addClass("infographic-resizing");
				try {
					handle.setPointerCapture(down.pointerId);
				} catch {
					// Synthetic pointers (e.g. automated tests) have no active pointer id.
				}

				const apply = () => {
					frame = null;
					if (isVertical) {
						wrapper.style.height = `${latestHeight}px`;
					} else {
						this.applyWrapperWidth(wrapper, latestWidth);
					}
				};
				const onMove = (move: PointerEvent) => {
					if (isVertical) {
						const dy = move.clientY - startY;
						const raw = side === "top" ? startHeight - dy : startHeight + dy;
						latestHeight = Math.max(MIN_DRAG_HEIGHT, Math.round(raw));
					} else {
						const dx = move.clientX - startX;
						const raw = side === "left" ? startWidth - dx : startWidth + dx;
						latestWidth = Math.max(MIN_DRAG_WIDTH, Math.min(maxWidth, Math.round(raw)));
					}
					if (frame === null) {
						const win = wrapper.ownerDocument.defaultView;
						frame = win ? win.requestAnimationFrame(apply) : (apply(), null);
					}
				};
				const onEnd = () => {
					handle.removeEventListener("pointermove", onMove);
					handle.removeEventListener("pointerup", onEnd);
					handle.removeEventListener("pointercancel", onEnd);
					if (frame !== null) {
						wrapper.ownerDocument.defaultView?.cancelAnimationFrame(frame);
						frame = null;
					}
					wrapper.removeClass("infographic-resizing");
					this.isResizing = false;
					if (isVertical) {
						wrapper.style.height = `${latestHeight}px`;
						this.options.explicitHeight = latestHeight; // 后续 RO/resizeToFit 尊重新高度
						if (this.infographic) {
							this.infographic.update({ height: latestHeight });
							this.rememberHeight();
						}
						this.options.onHeightCommit?.(latestHeight);
					} else {
						this.applyWrapperWidth(wrapper, latestWidth);
						// 拖拽期间 RO 被门控，松手一次性按新宽度重渲染
						if (this.infographic) {
							this.infographic.update({ width: latestWidth, height: this.options.explicitHeight ?? latestWidth / this.aspectRatio });
							this.rememberHeight();
						}
						this.options.onWidthCommit?.(latestWidth);
					}
				};
				handle.addEventListener("pointermove", onMove);
				handle.addEventListener("pointerup", onEnd);
				handle.addEventListener("pointercancel", onEnd);
			});
		}
	}

	/** 渲染/尺寸变化稳定后记录当前块高，供下次重建高度桥接 */
	private rememberHeight(): void {
		const win = this.containerEl.ownerDocument.defaultView;
		if (!win) return;
		win.requestAnimationFrame(() => {
			if (!this.containerEl.isConnected) return;
			const height = this.containerEl.offsetHeight;
			if (height > 0) cacheBlockHeight(this.options.content, height);
		});
	}

	private applyWrapperWidth(wrapper: HTMLElement, width: number): void {
		wrapper.style.width = `${width}px`;
	}

	private updateAspectRatioFromSVG(): void {
		if (!this.infographic) return;
		
		const svg = this.containerEl.querySelector("svg");
		if (!svg) return;

		const viewBox = svg.getAttribute("viewBox");
		if (viewBox) {
			const parts = viewBox.split(/\s+/).map(Number);
			const vbWidth = parts[2];
			const vbHeight = parts[3];
			if (parts.length === 4 && vbWidth !== undefined && vbHeight !== undefined && vbWidth > 0 && vbHeight > 0) {
				this.aspectRatio = vbWidth / vbHeight;
				this.resizeToFit();
				return;
			}
		}

		const rect = svg.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			this.aspectRatio = rect.width / rect.height;
			this.resizeToFit();
		}
	}

	private resizeToFit(): void {
		if (!this.infographic) return;
		
		const containerWidth = this.containerEl.clientWidth || 800;
		const width = containerWidth;
		const height = this.options.explicitHeight ?? width / this.aspectRatio;
		this.infographic.update({ width, height });
	}

	private destroyInfographic(): void {
		if (this.infographic) {
			try {
				this.infographic.destroy();
			} catch {
				// AntV Infographic may throw during cleanup if already destroyed
			}
			this.infographic = null;
		}
	}

	private cleanup(): void {
		liveRenderChildren.delete(this);
		this.panZoom?.destroy();
		this.panZoom = null;
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.destroyInfographic();
	}
}
