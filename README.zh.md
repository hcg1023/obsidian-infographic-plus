# obsidian-infographic

> 使用 [@antv/infographic](https://github.com/antvis/Infographic) 渲染信息图表的 Obsidian 插件

[**English**](README.md)

## 安装

> **注意**: 该插件目前尚未被 Obsidian 官方插件商店收录，无法直接从插件商店安装。请使用以下方式之一手动安装：

### 方式一：通过 Obsidian BRAT 插件安装（推荐）

1. 确保已安装 [BRAT 插件](https://github.com/TfTHacker/obsidian42-brat)
2. 在 BRAT 设置中点击 "Add a beta plugin" 按钮，添加本插件的 GitHub 仓库 URL：
   ```
   https://github.com/hcg1023/obsidian-infographic
   ```
3. 版本选择
   - 选择 "Latest version" ，或者根据需要安装指定版本
4. 点击 Add Plugin 按钮 BRAT 会自动下载并安装最新版本的插件

### 方式二: 从源码构建

1. 将项目克隆到 Obsidian 插件目录：
   ```bash
   cd ~/.obsidian/plugins
   git clone https://github.com/hcg1023/obsidian-infographic.git
   cd obsidian-infographic
   ```

2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```

3. 在 Obsidian 设置中启用该插件

### 方式三: 下载源码 + 预编译文件

1. 下载项目源码到 `.obsidian/plugins` 目录下
2. 从[最新版本发布页面](https://github.com/hcg1023/obsidian-infographic/releases/latest)下载 `main.js` 文件
3. 将 `main.js` 放到 `.obsidian/plugins/obsidian-infographic/` 目录下
4. 在 Obsidian 设置中启用该插件

### 方式四: 仅使用预编译文件

1. 从[最新版本发布页面](https://github.com/hcg1023/obsidian-infographic/releases/latest)下载以下文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`

2. 在 `.obsidian/plugins/` 目录下创建 `obsidian-infographic` 文件夹（如果不存在）

3. 将下载的文件放到 `.obsidian/plugins/obsidian-infographic/` 目录下

4. 在 Obsidian 设置中启用该插件

## 使用方法

### 基础示例

在 Obsidian 笔记中，使用 `infographic` 代码块：

````markdown
```infographic
infographic list-row-simple-horizontal-arrow
data
  items
    - label 步骤 1
      desc 开始
    - label 步骤 2
      desc 进行中
    - label 步骤 3
      desc 完成
```
````

### 高级示例（带主题配置）

````markdown
```infographic
infographic chart-bar-plain-text
data
  title 年度营收增长
  desc 展示近三年及本年目标营收对比（单位：亿元）
  items
    - label 2021年
      value 120
      desc 转型初期，稳步试水
      icon lucide/sprout
    - label 2022年
      value 150
      desc 平台优化，效率显著提升
      icon lucide/zap
    - label 2023年
      value 190
      desc 深化数智融合，全面增长
      icon lucide/brain-circuit
    - label 2024年
      value 240
      desc 拓展生态协同，冲击新高
      icon lucide/trophy
theme light
  palette antv
```
````

### Fence 参数

代码块首行 fence 支持可选参数：

````markdown
```infographic width=600 align=center
```
````

- `width=N` —— 将渲染宽度限制为 `N` 像素（最小 200）。缺省时块为响应式，自动填满笔记可用宽度。
- `height=N` —— 固定块高度为 `N` 像素（最小 100）。可与 `width=N` 独立使用，例如 ```` ```infographic height=360 ````。也可以拖动块上/下边缘手柄调节高度，松手后回写 fence 行的 `height=N`（与 width 相同）。
- `align=center` —— 块水平居中（缺省左对齐）。

这两个参数也可以交互式修改：拖动块两侧的调节手柄改变宽度，或使用工具栏的居中按钮。修改结果会持久化写回笔记中的 fence 行。

### 缩放与平移

渲染后的信息图表支持交互：

| 交互 | 行为 |
|---|---|
| 滚轮（适宽状态） | 正常滚动笔记，图表块不拦截 |
| `Ctrl`/`Cmd` + 滚轮 | 随时缩放 |
| 放大后滚轮 | 持续缩放（滚轮被图表块接管） |
| 放大后拖拽 | 平移图表 |
| 双击 | 复位到适宽状态 |
| 工具栏 `+` / `−` / 适宽按钮 | 放大、缩小、复位 |
| 全屏查看器 | 滚轮恒为缩放；拖拽平移；支持导出完整图像或复制源码 |

通过工具栏的最大化按钮打开全屏查看器。`Infographic: Insert infographic template` 命令可在当前笔记中插入现成模板。

## 导出功能

将鼠标悬停在渲染后的信息图表上（或在移动端轻点图表）即可显示工具栏——移动端没有右键菜单，工具栏是唯一的导出入口：

1. **复制源码** - 将信息图表的源码复制到剪贴板
2. **复制图片** - 将信息图表（PNG 格式）复制到剪贴板，以便粘贴到其他应用程序中
3. **导出 PNG / SVG** - 打开导出对话框，将信息图表下载为 PNG 图片或 SVG 矢量文件

## 开发

### 前置要求

- Node.js >= 16
- npm 或 yarn

### 构建

```bash
# 安装依赖
npm install

# 开发模式（支持热重载）
npm run dev

# 生产构建
npm run build

# 运行代码检查
npm run lint
```

### 项目结构

```
obsidian-infographic/
├── src/
│   ├── main.ts       # 主要插件代码
│   └── settings.ts   # 插件设置
├── main.js           # 编译后的插件
├── manifest.json     # 插件清单
├── styles.css        # 插件样式
└── package.json      # 依赖项
```

## 配置选项

本插件使用 [@antv/infographic](https://github.com/antvis/Infographic) 进行渲染。信息图表内容会直接传递给 Infographic 实例。

有关信息图表语法和功能的更多信息，请参阅 [Infographic 文档](https://github.com/antvis/Infographic)。

## 特性

- 双语法：`infographic` 代码块同时支持 JSON 配置与简洁的 Infographic DSL
- 响应式宽度——自动填满笔记宽度，也可用 `width=N` fence 参数限定
- `align=center` fence 参数（及工具栏开关）实现水平居中
- 悬停工具栏：复制源码、复制图片、导出 PNG/SVG、居中、缩放控件
- 笔记内缩放与平移：Ctrl/Cmd+滚轮缩放、缩放按钮、拖拽平移、双击复位
- 全屏查看器：滚轮缩放、拖拽平移、完整图像导出
- `insert-template` 命令快速插入信息图表模板
- 友好的错误占位卡提示
- 需要 Obsidian 1.13+

## 许可证

MIT License

## 致谢与许可说明

本插件包含移植并修改自 [shuuul/obsidian-infographic](https://github.com/shuuul/obsidian-infographic)（v0.2.0，Apache-2.0）的代码——包括双语法解析器、带尺寸自适应的 MarkdownRenderChild 渲染器、fence 参数解析与持久化，以及导出/源码弹窗。移植文件均带有 Apache-2.0 头部声明，详见 `LICENSE-APACHE-2.0`。改动内容：移除了 PDF 打印快照管线，重做了工具栏/缩放集成，新增了 PanZoomController 与全屏查看器。本插件其余部分采用 MIT 许可证。

## 相关项目

- 使用 [@antv/infographic](https://github.com/antvis/Infographic) 构建
- 基于 [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
