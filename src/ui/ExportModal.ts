// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.
import {App, Modal, Notice} from "obsidian";
import type {Infographic} from "@antv/infographic";

declare const activeWindow: Window;

export class ExportModal extends Modal {
	private infographic: Infographic;
	private filename: string;

	constructor(app: App, infographic: Infographic, filename: string = "infographic") {
		super(app);
		this.infographic = infographic;
		this.filename = filename;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.addClass("infographic-export-modal");

		contentEl.createEl("h2", {text: "Export infographic"});

		const buttonContainer = contentEl.createDiv({cls: "infographic-export-buttons"});

		const pngButton = buttonContainer.createEl("button", {text: "Export as PNG"});
		pngButton.addEventListener("click", () => void this.exportAsPng());

		const svgButton = buttonContainer.createEl("button", {text: "Export as SVG"});
		svgButton.addEventListener("click", () => void this.exportAsSvg());

		const cancelButton = buttonContainer.createEl("button", {text: "Cancel"});
		cancelButton.addEventListener("click", () => this.close());
	}

	private async exportAsPng(): Promise<void> {
		try {
			const dataUrl = await this.infographic.toDataURL({type: "png"});
			this.downloadDataUrl(dataUrl, `${this.filename}.png`);
			new Notice("Exported as PNG");
			this.close();
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error("[Infographic Plugin] Export error:", message);
			new Notice(`Export failed: ${message}`);
		}
	}

	private async exportAsSvg(): Promise<void> {
		try {
			const dataUrl = await this.infographic.toDataURL({type: "svg"});
			this.downloadDataUrl(dataUrl, `${this.filename}.svg`);
			new Notice("Exported as SVG");
			this.close();
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error("[Infographic Plugin] Export error:", message);
			new Notice(`Export failed: ${message}`);
		}
	}

	private downloadDataUrl(dataUrl: string, filename: string): void {
		const doc = activeWindow.document;
		const link = doc.win.createEl("a");
		link.href = dataUrl;
		link.download = filename;
		doc.body.appendChild(link);
		link.click();
		doc.body.removeChild(link);
	}

	onClose(): void {
		const {contentEl} = this;
		contentEl.empty();
	}
}
