// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type InfographicPlugin from "./main";
import { i18n } from "./lang";

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
				name: i18n.themeName,
				desc: i18n.themeDesc,
				control: {
					key: "theme",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.theme,
					options: { auto: i18n.themeAuto, light: i18n.themeLight, dark: i18n.themeDark },
				},
			},
			{
				name: i18n.errorBehaviorName,
				desc: i18n.errorBehaviorDesc,
				control: {
					key: "errorBehavior",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.errorBehavior,
					options: {
						"show-code": i18n.errorShowCode,
						"show-error": i18n.errorShowError,
						hide: i18n.errorHide,
					},
				},
			},
		{
			name: i18n.resizeName,
			desc: i18n.resizeDesc,
			control: {
				key: "enableResizeHandles",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.enableResizeHandles,
			},
		},
		{
			name: i18n.zoomName,
			desc: i18n.zoomDesc,
			control: {
				key: "enableZoom",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.enableZoom,
			},
		},
		{
			name: i18n.toolbarName,
			desc: i18n.toolbarDesc,
			control: {
				key: "showToolbar",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.showToolbar,
			},
		},
		{
			name: i18n.centerName,
			desc: i18n.centerDesc,
			control: {
				key: "centerByDefault",
				type: "toggle",
				defaultValue: DEFAULT_SETTINGS.centerByDefault,
			},
		},
		];
	}
}
