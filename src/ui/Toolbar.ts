// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.
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

	toolbarButton(toolbar, "copy", "Copy source to clipboard", () => handlers.onCopySource());
	toolbarButton(toolbar, "image", "Copy image to clipboard", () => handlers.onCopyImage());
	toolbarButton(toolbar, "download", "Export as PNG or SVG", () => handlers.onExport());

	toolbarButton(toolbar, "zoom-out", "Zoom out", () => handlers.onZoomOut());
	const zoomLabel = toolbar.createSpan({ cls: "infographic-zoom-label", text: "100%" });
	toolbarButton(toolbar, "zoom-in", "Zoom in", () => handlers.onZoomIn());
	toolbarButton(toolbar, "scan", "Fit to width", () => handlers.onFit());
	toolbarButton(toolbar, "maximize", "Open fullscreen viewer", () => handlers.onFullscreen());

	return {
		setZoomPercent: (percent: number) => zoomLabel.setText(`${Math.round(percent)}%`),
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
