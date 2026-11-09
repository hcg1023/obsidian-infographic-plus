import { setIcon } from "obsidian";
import { i18n } from "../lang";

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
	header.createSpan({ text: i18n.errorPrefix + options.message });
	if (options.onDetails) {
		const detailsBtn = parent.createEl("button", { text: i18n.viewDetails, cls: "infographic-error-details-btn" });
		detailsBtn.addEventListener("click", options.onDetails);
	}
}
