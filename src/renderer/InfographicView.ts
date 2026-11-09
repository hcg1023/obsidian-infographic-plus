// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.
// Ported from https://github.com/shuuul/obsidian-infographic (src/renderer/InfographicView.ts)
import { MarkdownRenderChild } from "obsidian";
import { Infographic, type InfographicOptions } from "@antv/infographic";
import type { ThemeSetting } from "../settings";
import { createErrorPlaceholder } from "../ui/ErrorPlaceholder";
import { PanZoomController } from "./PanZoomController";
import type { PanZoomState } from "./PanZoomController";
export interface RenderOptions {
	content: string;
	isJson: boolean;
	theme: ThemeSetting;
	isDarkMode: boolean;
	/** Fence-level width override in px (```infographic width=N) */
	explicitWidth?: number;
	/** Called after a drag-resize commits, so the host can persist the width. */
	onWidthCommit?: (width: number) => void;
	onRenderError?: (message: string) => void;
	/** 缩放/平移状态变化回调（Task 7 工具栏用于刷新百分比标签）。 */
	onPanZoomChange?: (state: PanZoomState) => void;
}

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

const DEFAULT_ASPECT_RATIO = 4 / 3;
const MIN_DRAG_WIDTH = 200;

/**
 * 创建并渲染一个 Infographic 实例（JSON 走 parse+strip，DSL 直接 render）。
 * onInit 在构造之后、render() 之前调用——用于提前订阅 "error" 事件，
 * 防止库在 render() 内同步 emit 时丢事件（Task 9 全屏 Modal 同样应经此订阅）。
 */
export function renderInfographicInto(
	container: HTMLElement,
	payload: RenderPayload,
	onInit?: (instance: Infographic) => void,
): Infographic {
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
		onInit?.(instance);
		instance.render();
		return instance;
	}
	const instance = new Infographic({ container, width: payload.width, height: payload.height, theme: payload.theme });
	onInit?.(instance);
	instance.render(payload.content);
	return instance;
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

	fitWidth(): void {
		this.panZoom?.reset();
	}

	/**
	 * Some Obsidian render pipelines (notably PDF export) may not invoke
	 * MarkdownRenderChild lifecycle hooks. This makes rendering idempotent and callable.
	 */
	ensureStarted(): void {
		if (this.started) return;
		this.started = true;
		this.showLoading();
		this.render();
		this.setupResizeObserver();
		this.setupResizeHandles();
		this.panZoom = new PanZoomController({
			viewportEl: this.containerEl,
			contentEl: this.contentEl!,
			wheelMode: "when-zoomed",
			onChange: (state) => this.options.onPanZoomChange?.(state),
		});
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
		this.loadingEl.setText("Loading infographic...");
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
		const height = width / DEFAULT_ASPECT_RATIO;

		try {
			this.infographic = renderInfographicInto(
				this.contentEl!,
				{
					content: this.options.content,
					isJson: this.options.isJson,
					theme,
					width,
					height,
					explicitWidth: this.options.explicitWidth,
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
						const height = width / this.aspectRatio;
						this.infographic.update({ width, height });
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

	/**
	 * Drag handles on both sides of the block: dragging adjusts the wrapper
	 * width, the ResizeObserver keeps the canvas in sync. The final width is
	 * persisted by the host via onWidthCommit.
	 */
	private setupResizeHandles(): void {
		const wrapper = this.containerEl.closest<HTMLElement>(".infographic-wrapper");
		if (!wrapper) return;

		for (const side of ["left", "right"] as const) {
			const handle = wrapper.createDiv({cls: `infographic-resize-handle infographic-resize-${side}`});
			handle.setAttribute("aria-hidden", "true");
			this.registerDomEvent(handle, "pointerdown", (down: PointerEvent) => {
				this.isResizing = true;
				this.panZoom?.reset();
				down.preventDefault();
				const maxWidth = wrapper.parentElement?.clientWidth ?? wrapper.clientWidth;
				const startWidth = wrapper.clientWidth || maxWidth;
				const startX = down.clientX;
				let latestWidth = startWidth;
				let frame: number | null = null;
				wrapper.addClass("infographic-resizing");
				try {
					handle.setPointerCapture(down.pointerId);
				} catch {
					// Synthetic pointers (e.g. automated tests) have no active pointer id.
				}

				const apply = () => {
					frame = null;
					this.applyWrapperWidth(wrapper, latestWidth);
				};
				const onMove = (move: PointerEvent) => {
					const dx = move.clientX - startX;
					const raw = side === "left" ? startWidth - dx : startWidth + dx;
					latestWidth = Math.max(MIN_DRAG_WIDTH, Math.min(maxWidth, Math.round(raw)));
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
					this.applyWrapperWidth(wrapper, latestWidth);
					// 拖拽期间 RO 被门控，松手一次性按新宽度重渲染
					if (this.infographic) {
						this.infographic.update({ width: latestWidth, height: latestWidth / this.aspectRatio });
					}
					this.options.onWidthCommit?.(latestWidth);
				};
				handle.addEventListener("pointermove", onMove);
				handle.addEventListener("pointerup", onEnd);
				handle.addEventListener("pointercancel", onEnd);
			});
		}
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
		const height = width / this.aspectRatio;
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
		this.panZoom?.destroy();
		this.panZoom = null;
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.destroyInfographic();
	}
}
