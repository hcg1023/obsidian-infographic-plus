// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import {App, Modal, Notice} from "obsidian";
import { i18n } from "../lang";

export class SourceCodeModal extends Modal {
	private source: string;
	private formattedSource: string;

	constructor(app: App, source: string) {
		super(app);
		this.source = source;
		this.formattedSource = this.formatSource();
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.addClass("infographic-source-modal");

		contentEl.createEl("h2", {text: i18n.sourceTitle});

		const codeContainer = contentEl.createDiv({cls: "infographic-source-code"});
		const pre = codeContainer.createEl("pre");
		const code = pre.createEl("code");
		code.setText(this.formattedSource);

		const buttonContainer = contentEl.createDiv({cls: "infographic-source-buttons"});
		
		const copyButton = buttonContainer.createEl("button", {text: i18n.copyToClipboard});
		copyButton.addEventListener("click", () => this.copyToClipboard());

		const closeButton = buttonContainer.createEl("button", {text: i18n.cancel});
		closeButton.addEventListener("click", () => this.close());

		this.scope.register(["Mod"], "c", () => {
			this.copyToClipboard();
			return false;
		});

		this.scope.register([], "Escape", () => {
			this.close();
			return false;
		});
	}

	private copyToClipboard(): void {
		navigator.clipboard.writeText(this.formattedSource).then(() => {
			new Notice(i18n.copiedToClipboard);
		}).catch(() => {
			new Notice(i18n.copyFailed);
		});
	}

	private formatSource(): string {
		const trimmed = this.source.trim();
		if (trimmed.startsWith("{")) {
			try {
				const parsed: unknown = JSON.parse(trimmed);
				return JSON.stringify(parsed, null, 2);
			} catch {
				return this.source;
			}
		}
		return this.source;
	}

	onClose(): void {
		const {contentEl} = this;
		contentEl.empty();
	}
}
