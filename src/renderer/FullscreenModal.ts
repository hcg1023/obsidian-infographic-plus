import { App, Modal, setIcon } from "obsidian";
import type { Infographic } from "@antv/infographic";
import { PanZoomController } from "./PanZoomController";
import { renderInfographicInto } from "./InfographicView";
import { ExportModal } from "../ui/ExportModal";
import { i18n } from "../lang";

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
		this.containerEl.addClass("infographic-fullscreen-container");
		this.payload = payload;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("infographic-fullscreen");

		this.buildToolbar(contentEl);

		const viewport = contentEl.createDiv({ cls: "infographic-fullscreen-viewport" });
		const stage = viewport.createDiv({ cls: "infographic-fullscreen-stage" });
		const loading = viewport.createDiv({ cls: "infographic-loading", text: i18n.loadingText });

		let renderFailed = false;
		try {
			const width = Math.max(320, viewport.clientWidth > 0 ? viewport.clientWidth - 64 : 800);
			// 先按可用宽度渲染，再依 SVG viewBox 修正为“适应屏幕”（宽高都留 64px 边距）
			// error 订阅经 onInit 前移到 render() 之前，防同步 emit 丢事件（task-6-report）
			this.instance = renderInfographicInto(
				stage,
				{
					content: this.payload.content,
					isJson: this.payload.isJson,
					theme: this.payload.theme,
					width,
					height: width * 0.75,
				},
				(instance) =>
					instance.on("error", (e: unknown) => {
						renderFailed = true;
						const message = e instanceof Error ? e.message : String(e);
						console.error("[Infographic Plugin] Fullscreen render error:", message);
						// render() 返回后异步 emit 时 loading 可能已被移除——重新挂回保证错误可见
						if (!loading.isConnected) viewport.appendChild(loading);
						loading.addClass("infographic-error-message");
						loading.setText(i18n.renderFailedPrefix + message);
					}),
			);
			if (!renderFailed) {
				this.fitToScreen(stage, viewport);
				loading.remove();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[Infographic Plugin] Fullscreen render error:", message);
			loading.addClass("infographic-error-message");
			loading.setText(i18n.renderFailedPrefix + message);
			return;
		}

		this.controller = new PanZoomController({
			viewportEl: viewport,
			contentEl: stage,
			wheelMode: "always",
			onChange: (state) => this.zoomLabel?.setText(`${Math.round(state.scale * 100)}%`),
		});

		const modalBg = this.containerEl.querySelector(".modal-bg");
		modalBg?.addEventListener("click", () => this.close());
	}

	private fitToScreen(stage: HTMLElement, viewport: HTMLElement): void {
		if (!this.instance) return;
		const svg = stage.querySelector("svg");
		if (!svg) return;
		const parts = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
		const [vbW, vbH] = parts?.length === 4 ? [parts[2]!, parts[3]!] : [0, 0];
		if (!(vbW > 0) || !(vbH > 0)) return;
		const aspect = vbH / vbW;
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
		btn("zoom-out", i18n.ariaZoomOut, () => this.controller?.zoomBy(1 / 1.25));
		this.zoomLabel = toolbar.createSpan({ cls: "infographic-zoom-label", text: "100%" });
		btn("zoom-in", i18n.ariaZoomIn, () => this.controller?.zoomBy(1.25));
		btn("move-horizontal", i18n.ariaFitScreen, () => this.controller?.reset());
		toolbar.createDiv({ cls: "infographic-toolbar-separator" });
		const exportBtn = btn("download", i18n.ariaExport, () => {
			if (this.payload.sourceInstance) {
				new ExportModal(this.app, this.payload.sourceInstance).open();
			}
		});
		if (!this.payload.sourceInstance) {
			exportBtn.disabled = true;
			exportBtn.setAttribute("aria-disabled", "true");
		}
		btn("x", i18n.ariaClose, () => this.close());
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
