import type en from "./en";

const zhCn: typeof en = {
	// Settings
	themeName: "主题",
	themeDesc: "信息图表的配色主题",
	themeAuto: "自动（跟随 Obsidian）",
	themeLight: "浅色",
	themeDark: "深色",
	errorBehaviorName: "错误处理方式",
	errorBehaviorDesc: "信息图表渲染失败时的显示方式",
	errorShowCode: "显示源码",
	errorShowError: "仅显示错误信息",
	errorHide: "完全隐藏",
	resizeName: "拖拽调整宽高",
	resizeDesc: "在图表边缘显示拖拽手柄以调整宽度与高度",
	zoomName: "笔记内缩放",
	zoomDesc: "Ctrl/Cmd+滚轮缩放、拖拽平移，以及工具栏缩放控件",
	toolbarName: "悬浮工具栏",
	toolbarDesc: "鼠标悬停图表时显示复制、导出与缩放工具栏",
	centerName: "默认居中显示",
	centerDesc: "图表默认水平居中，可被 align= 围栏参数逐块覆盖",

	// Toolbar aria labels
	ariaCenter: "切换居中对齐",
	ariaCopySource: "复制源码到剪贴板",
	ariaCopyImage: "复制图片到剪贴板",
	ariaExport: "导出为 PNG 或 SVG",
	ariaZoomOut: "缩小",
	ariaZoomIn: "放大",
	ariaFit: "适应宽度",
	ariaFullscreen: "打开全屏查看器",
	ariaFitScreen: "适应屏幕",
	ariaClose: "关闭",

	// Notices and popups
	copySourceSuccess: "已复制源码到剪贴板",
	copyFailed: "复制失败",
	copyImageSuccess: "图表已复制到剪贴板",
	copyImageFallback: "当前环境不支持复制图片，已复制源码；可用导出按钮保存 PNG",
	copyFailedWithReason: "复制失败：",
	parseErrorNotice: "信息图表错误：",

	loadingText: "正在加载信息图表…",
	errorPrefix: "错误：",
	viewDetails: "查看详情",
	renderFailedPrefix: "信息图表渲染失败：",
	emptyRender: "渲染结果为空（请检查 template 模板名与数据是否有效）",

	exportTitle: "导出信息图表",
	exportPng: "导出为 PNG",
	exportSvg: "导出为 SVG",
	cancel: "取消",
	exportedPng: "已导出为 PNG",
	exportedSvg: "已导出为 SVG",
	exportFailedPrefix: "导出失败：",

	sourceTitle: "信息图表源码",
	copyToClipboard: "复制到剪贴板",
	copiedToClipboard: "已复制到剪贴板",
};

export default zhCn;
