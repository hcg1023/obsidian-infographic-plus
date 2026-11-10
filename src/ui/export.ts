// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import {Menu, Notice} from "obsidian";
import type {Infographic} from "@antv/infographic";
import {i18n} from "../lang";

declare const activeWindow: Window;

/** 执行导出并触发下载，成功/失败以 Notice 反馈（无弹窗） */
export async function exportInfographic(instance: Infographic, format: "png" | "svg", filename = "infographic"): Promise<void> {
	try {
		const dataUrl = await instance.toDataURL({type: format});
		const doc = activeWindow.document;
		const link = doc.win.createEl("a");
		link.href = dataUrl;
		link.download = `${filename}.${format}`;
		doc.body.appendChild(link);
		link.click();
		doc.body.removeChild(link);
		new Notice(format === "png" ? i18n.exportedPng : i18n.exportedSvg);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error("[Infographic Plugin] Export error:", message);
		new Notice(i18n.exportFailedPrefix + message);
	}
}

/**
 * 导出菜单（PNG/SVG 两项直达）：工具栏导出按钮、块右键菜单、全屏查看器共用，
 * 替代原导出弹窗——点击即出菜单、选中即下载，省去弹窗确认步骤。
 * instance 为空（如无源实例的全屏）时两项禁用。
 */
export function openExportMenu(event: MouseEvent, instance: Infographic | null): void {
	const menu = new Menu();
	for (const format of ["png", "svg"] as const) {
		menu.addItem((item) => {
			item.setTitle(format === "png" ? i18n.exportPng : i18n.exportSvg)
				.setIcon(format === "png" ? "image" : "file-code");
			if (instance) {
				item.onClick(() => void exportInfographic(instance, format));
			} else {
				item.setDisabled(true);
			}
		});
	}
	menu.showAtMouseEvent(event);
}
