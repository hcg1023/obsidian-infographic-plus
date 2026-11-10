// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { Menu, setIcon } from "obsidian";
import { i18n } from "../lang";

export interface ToolbarHandlers {
	isCentered(): boolean;
	onToggleCenter(): void;
	onCopySource(): void;
	onCopyImage(): void;
	onExport(event: MouseEvent): void;
	/** 右键菜单直达导出（无二次菜单）：png/svg */
	onExportFormat(format: "png" | "svg"): void;
	onZoomIn(): void;
	onZoomOut(): void;
	/** 仅复位缩放/平移到 100%，不还原块宽、不改源码（区别于 onFit） */
	onZoomReset(): void;
	onFit(): void;
	onFullscreen(): void;
}

export interface ToolbarControls {
	setZoomPercent(percent: number): void;
}

function toolbarButton(toolbar: HTMLElement, icon: string, ariaLabel: string, onClick: (event: MouseEvent) => void, tier?: "low" | "mid"): HTMLButtonElement {
	const btn = toolbar.createEl("button", {
		cls: tier ? `infographic-toolbar-btn infographic-toolbar-${tier}` : "infographic-toolbar-btn",
	});
	btn.setAttribute("aria-label", ariaLabel);
	btn.setAttribute("type", "button");
	setIcon(btn, icon);
	btn.addEventListener("click", onClick);
	return btn;
}

/**
 * 快捷菜单：块上右键与工具栏「更多」按钮共用，消费与工具栏同一份 handlers，保证两处入口逻辑一致。
 * showZoomActions 与 createToolbar 的 showZoomControls 对应同一设置。
 */
export function openInfographicMenu(handlers: ToolbarHandlers, event: MouseEvent, options?: { showZoomActions?: boolean }): void {
	const menu = new Menu();
	menu.addItem((item) =>
		item.setTitle(i18n.menuCenter).setIcon("align-center").setChecked(handlers.isCentered()).onClick(() => handlers.onToggleCenter()),
	);
	menu.addSeparator();
	menu.addItem((item) => item.setTitle(i18n.menuCopySource).setIcon("copy").onClick(() => handlers.onCopySource()));
	menu.addItem((item) => item.setTitle(i18n.menuCopyImage).setIcon("image").onClick(() => handlers.onCopyImage()));
	menu.addItem((item) => item.setTitle(i18n.exportPng).setIcon("image").onClick(() => handlers.onExportFormat("png")));
	menu.addItem((item) => item.setTitle(i18n.exportSvg).setIcon("file-code").onClick(() => handlers.onExportFormat("svg")));
	menu.addSeparator();
	if (options?.showZoomActions !== false) {
		menu.addItem((item) => item.setTitle(i18n.ariaZoomOut).setIcon("zoom-out").onClick(() => handlers.onZoomOut()));
		menu.addItem((item) => item.setTitle(i18n.ariaZoomIn).setIcon("zoom-in").onClick(() => handlers.onZoomIn()));
	}
	menu.addItem((item) => item.setTitle(i18n.ariaFit).setIcon("move-horizontal").onClick(() => handlers.onFit()));
	menu.addSeparator();
	menu.addItem((item) => item.setTitle(i18n.menuFullscreen).setIcon("maximize-2").onClick(() => handlers.onFullscreen()));
	menu.showAtMouseEvent(event);
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
	}, "low");
	centerBtn.setAttribute("aria-pressed", String(handlers.isCentered()));
	centerBtn.toggleClass("infographic-center-btn-active", handlers.isCentered());

	toolbarButton(toolbar, "copy", i18n.ariaCopySource, () => handlers.onCopySource(), "low");
	toolbarButton(toolbar, "image", i18n.ariaCopyImage, () => handlers.onCopyImage(), "low");
	toolbarButton(toolbar, "download", i18n.ariaExport, (event) => handlers.onExport(event), "low");

	let zoomLabel: HTMLElement | null = null;
	if (options?.showZoomControls !== false) {
		toolbarButton(toolbar, "zoom-out", i18n.ariaZoomOut, () => handlers.onZoomOut(), "mid");
		// 百分比标签即按钮：点击=仅缩放复位（标签复用按钮基类，键盘/焦点/各状态样式全部继承）
		zoomLabel = toolbar.createEl("button", { cls: "infographic-toolbar-btn infographic-zoom-label infographic-toolbar-mid", text: "100%" });
		zoomLabel.setAttribute("aria-label", i18n.ariaZoomReset);
		zoomLabel.setAttribute("type", "button");
		zoomLabel.addEventListener("click", () => handlers.onZoomReset());
		toolbarButton(toolbar, "zoom-in", i18n.ariaZoomIn, () => handlers.onZoomIn(), "mid");
	}
	toolbarButton(toolbar, "move-horizontal", i18n.ariaFit, () => handlers.onFit(), "low");

	// 「更多」按钮：仅在容器查询判定窄屏折叠时显示，打开与右键相同的菜单
	const moreBtn = toolbar.createEl("button", { cls: "infographic-toolbar-btn infographic-toolbar-more" });
	moreBtn.setAttribute("aria-label", i18n.ariaMore);
	moreBtn.setAttribute("aria-haspopup", "menu");
	moreBtn.setAttribute("type", "button");
	setIcon(moreBtn, "more-horizontal");
	moreBtn.addEventListener("click", (event) => {
		openInfographicMenu(handlers, event, { showZoomActions: options?.showZoomControls !== false });
	});

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
