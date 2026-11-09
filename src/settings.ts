// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic.
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type InfographicPlugin from "./main";

export type ThemeSetting = "auto" | "light" | "dark";
export type ErrorBehavior = "show-code" | "show-error" | "hide";

export interface InfographicSettings {
	theme: ThemeSetting;
	errorBehavior: ErrorBehavior;
}

export const DEFAULT_SETTINGS: InfographicSettings = {
	theme: "auto",
	errorBehavior: "show-code",
};

export class InfographicSettingTab extends PluginSettingTab {
	plugin: InfographicPlugin;

	constructor(app: App, plugin: InfographicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Theme",
				desc: "Color theme for infographics",
				control: {
					key: "theme",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.theme,
					options: { auto: "Auto (follow Obsidian)", light: "Light", dark: "Dark" },
				},
			},
			{
				name: "Error behavior",
				desc: "What to display when an infographic fails to render",
				control: {
					key: "errorBehavior",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.errorBehavior,
					options: {
						"show-code": "Show source code",
						"show-error": "Show error message only",
						hide: "Hide block entirely",
					},
				},
			},
		];
	}
}
