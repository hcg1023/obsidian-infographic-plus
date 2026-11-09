// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type InfographicPlugin from "./main";

export type ThemeSetting = "auto" | "light" | "dark";
export type ErrorBehavior = "show-code" | "show-error" | "hide";

export interface InfographicSettings {
	theme: ThemeSetting;
	errorBehavior: ErrorBehavior;
	enableResizeHandles: boolean;
	enableZoom: boolean;
	showToolbar: boolean;
	centerByDefault: boolean;
}

export const DEFAULT_SETTINGS: InfographicSettings = {
	theme: "auto",
	errorBehavior: "show-code",
	enableResizeHandles: true,
	enableZoom: true,
	showToolbar: true,
	centerByDefault: false,
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
		{
			name: "Drag to resize",
			desc: "Show drag handles on block edges to adjust width and height",
			control: {
				key: "enableResizeHandles",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.enableResizeHandles,
			},
		},
		{
			name: "In-note zoom",
			desc: "Ctrl/Cmd+wheel zoom, drag to pan, and zoom controls on the toolbar",
			control: {
				key: "enableZoom",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.enableZoom,
			},
		},
		{
			name: "Hover toolbar",
			desc: "Show the toolbar with copy, export and zoom actions when hovering a block",
			control: {
				key: "showToolbar",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.showToolbar,
			},
		},
		{
			name: "Center blocks by default",
			desc: "Center blocks horizontally unless overridden by the align= fence parameter",
			control: {
				key: "centerByDefault",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.centerByDefault,
			},
		},
		];
	}
}
