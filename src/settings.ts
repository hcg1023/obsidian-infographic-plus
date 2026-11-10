// Portions Copyright 2025 shuuul (https://github.com/shuuul/obsidian-infographic), Apache-2.0. Modified for antv-infographic-plus.
import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import { getThemes } from "@antv/infographic";
import type { StylizeConfig } from "@antv/infographic";
import type InfographicPlugin from "./main";
import { i18n } from "./lang";

/** "auto" 跟随 Obsidian 明暗，其余为 @antv/infographic 注册的主题 id（getThemes() 动态获取） */
export type ThemeSetting = "auto" | (string & {});
export type ErrorBehavior = "show-code" | "show-error" | "hide";
/** none = 不覆盖（主题自带 stylize 生效，如 hand-drawn 的 rough）；其余为渲染级覆盖 */
export type StylizeTypeSetting = "none" | "rough" | "pattern" | "linear-gradient" | "radial-gradient";

export interface InfographicSettings {
	theme: ThemeSetting;
	errorBehavior: ErrorBehavior;
	enableResizeHandles: boolean;
	enableZoom: boolean;
	showToolbar: boolean;
	centerByDefault: boolean;
	stylizeType: StylizeTypeSetting;
	/** rough：粗糙度（rough.js 语义，默认 1 上下浮动） */
	stylizeRoughness: number;
	/** pattern：图案名，@antv/infographic 内置图案（0.2.20：dot/line/square/hex/diamond/mosaic；库无公开枚举 API 故写死名单） */
	stylizePattern: string;
	/** 渐变起始色（#RRGGBB） */
	stylizeColorFrom: string;
	/** 渐变结束色（#RRGGBB） */
	stylizeColorTo: string;
	/** linear-gradient：颜色角度（0/90/180/270） */
	stylizeAngle: number;
}

export const DEFAULT_SETTINGS: InfographicSettings = {
	theme: "auto",
	errorBehavior: "show-code",
	enableResizeHandles: true,
	enableZoom: true,
	showToolbar: true,
	centerByDefault: false,
	stylizeType: "none",
	stylizeRoughness: 1,
	stylizePattern: "dot",
	stylizeColorFrom: "#FF356A",
	stylizeColorTo: "#7C3AED",
	stylizeAngle: 0,
};

/** 内置图案下拉（名单取自 0.2.20 esm/renderer/stylize/patterns/index.js） */
export function patternOptions(): Record<string, string> {
	return {
		dot: i18n.stylizePatternDot,
		line: i18n.stylizePatternLine,
		square: i18n.stylizePatternSquare,
		hex: i18n.stylizePatternHex,
		diamond: i18n.stylizePatternDiamond,
		mosaic: i18n.stylizePatternMosaic,
	};
}

/** 主题下拉选项：auto + 库注册主题（getThemes 动态获取，新版本新增主题自动出现；未知名原样展示） */
export function themeOptions(): Record<string, string> {
	const knownNames: Record<string, string> = {
		light: i18n.themeLight,
		dark: i18n.themeDark,
		"hand-drawn": i18n.themeHandDrawn,
	};
	const options: Record<string, string> = { auto: i18n.themeAuto };
	for (const id of getThemes()) {
		options[id] = knownNames[id] ?? id;
	}
	return options;
}

/**
 * 设置 → 渲染级 themeConfig.stylize。none 返回 undefined（不覆盖，主题自带 stylize 生效）；
 * pattern 名为空或渐变颜色列表为空时同样退回 undefined，避免渲染出无效果配置。
 */
export function buildStylizeConfig(settings: InfographicSettings): StylizeConfig | undefined {
	switch (settings.stylizeType) {
		case "rough": {
			const roughness = Number(settings.stylizeRoughness);
			return { type: "rough", ...(Number.isFinite(roughness) && roughness >= 0 ? { roughness } : {}) };
		}
		case "pattern": {
			const pattern = settings.stylizePattern.trim();
			return pattern ? { type: "pattern", pattern } : undefined;
		}
		case "linear-gradient":
		case "radial-gradient": {
			const colors = [settings.stylizeColorFrom, settings.stylizeColorTo].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
			if (colors.length < 2) return undefined;
			if (settings.stylizeType === "linear-gradient") {
				const angle = Number(settings.stylizeAngle);
				return { type: "linear-gradient", colors, ...(Number.isFinite(angle) ? { angle } : {}) };
			}
			return { type: "radial-gradient", colors };
		}
		default:
			return undefined;
	}
}

export class InfographicSettingTab extends PluginSettingTab {
	plugin: InfographicPlugin;

	constructor(app: App, plugin: InfographicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** 声明式设置读取：默认实现直连 loadData 落盘数据，改读内存 settings 保证与运行态同步 */
	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	/** 声明式设置写入：更新内存并落盘 → 防抖重渲所有打开笔记 → update() 重算 visible 条件行（风格化参数随类型显隐） */
	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
		this.plugin.scheduleSettingsRerender();
		this.update();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const s = this.plugin.settings;
		return [
			{
				name: i18n.themeName,
				desc: i18n.themeDesc,
				control: {
					key: "theme",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.theme,
					options: themeOptions(),
				},
			},
			{
				name: i18n.stylizeName,
				desc: i18n.stylizeDesc,
				control: {
					key: "stylizeType",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.stylizeType,
					options: {
						none: i18n.stylizeNone,
						rough: i18n.stylizeRough,
						pattern: i18n.stylizePattern,
						"linear-gradient": i18n.stylizeLinear,
						"radial-gradient": i18n.stylizeRadial,
					},
				},
			},
			{
				name: i18n.stylizeRoughnessName,
				desc: i18n.stylizeRoughnessDesc,
				visible: () => s.stylizeType === "rough",
				control: {
					key: "stylizeRoughness",
					type: "number",
					defaultValue: DEFAULT_SETTINGS.stylizeRoughness,
					min: 0,
					step: 0.1,
				},
			},
			{
				name: i18n.stylizePatternName,
				desc: i18n.stylizePatternDesc,
				visible: () => s.stylizeType === "pattern",
				control: {
					key: "stylizePattern",
					type: "dropdown",
					defaultValue: DEFAULT_SETTINGS.stylizePattern,
					options: patternOptions(),
				},
			},
			{
				name: i18n.stylizeColorFromName,
				desc: i18n.stylizeColorFromDesc,
				visible: () => s.stylizeType === "linear-gradient" || s.stylizeType === "radial-gradient",
				control: {
					key: "stylizeColorFrom",
					type: "color",
					defaultValue: DEFAULT_SETTINGS.stylizeColorFrom,
				},
			},
			{
				name: i18n.stylizeColorToName,
				desc: i18n.stylizeColorToDesc,
				visible: () => s.stylizeType === "linear-gradient" || s.stylizeType === "radial-gradient",
				control: {
					key: "stylizeColorTo",
					type: "color",
					defaultValue: DEFAULT_SETTINGS.stylizeColorTo,
				},
			},
			{
				name: i18n.stylizeAngleName,
				desc: i18n.stylizeAngleDesc,
				visible: () => s.stylizeType === "linear-gradient",
				control: {
					key: "stylizeAngle",
					type: "number",
					defaultValue: DEFAULT_SETTINGS.stylizeAngle,
					min: 0,
					max: 360,
					step: 15,
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
