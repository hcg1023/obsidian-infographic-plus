import { moment } from "obsidian";
import en from "./locale/en";
import zhCn from "./locale/zh-cn";

const localeMap: Record<string, typeof en> = {
	en,
	"zh-cn": zhCn,
};

function resolveLocale(): string {
	const locale = moment.locale();
	if (localeMap[locale]) return locale;
	if (locale.startsWith("zh")) return "zh-cn";
	return "en";
}

export const i18n = localeMap[resolveLocale()]!;
