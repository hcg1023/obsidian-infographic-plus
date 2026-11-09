// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { setIcon } from "obsidian";
import { i18n } from "../lang";

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

export function createToolbar(parent: HTMLElement, handlers: ToolbarHandlers, options?: { showZoomControls?: boolean }): ToolbarControls {
	const toolbar = parent.createDiv({ cls: "infographic-toolbar" });
	toolbar.addEventListener("pointerdown", (event) => event.stopPropagation());
	toolbar.addEventListener("mousedown", (event) => event.preventDefault());
	toolbar.addEventListener("click", (event) => event.stopPropagation());
	const centerBtn = toolbarButton(toolbar, "align-center", i18n.ariaCenter, () => {
		handlers.onToggleCenter();
		const centered = handlers.isCentered();
		centerBtn.setAttribute("aria-pressed", String(centered));
		centerBtn.toggleClass("infographic-center-btn-active", centered);
	});
	centerBtn.setAttribute("aria-pressed", String(handlers.isCentered()));
	centerBtn.toggleClass("infographic-center-btn-active", handlers.isCentered());

	toolbarButton(toolbar, "copy", i18n.ariaCopySource, () => handlers.onCopySource());
	toolbarButton(toolbar, "image", i18n.ariaCopyImage, () => handlers.onCopyImage());
	toolbarButton(toolbar, "download", i18n.ariaExport, () => handlers.onExport());

	let zoomLabel: HTMLElement | null = null;
	if (options?.showZoomControls !== false) {
		toolbarButton(toolbar, "zoom-out", i18n.ariaZoomOut, () => handlers.onZoomOut());
		zoomLabel = toolbar.createSpan({ cls: "infographic-zoom-label", text: "100%" });
		toolbarButton(toolbar, "zoom-in", i18n.ariaZoomIn, () => handlers.onZoomIn());
	}
	toolbarButton(toolbar, "move-horizontal", i18n.ariaFit, () => handlers.onFit());
	toolbarButton(toolbar, "maximize-2", i18n.ariaFullscreen, () => handlers.onFullscreen());
	return {
		setZoomPercent: (percent: number) => zoomLabel?.setText(`${Math.round(percent)}%`),
	};
}

/** data URL → Blob（移植自本仓库旧 main.ts） */
export function dataUrlToBlob(dataUrl: string): Blob | null {
	const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
	if (!match) return null;
	const mime = match[1];
	const binary = atob(match[2]!);
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
