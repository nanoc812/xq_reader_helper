# 雪球文章分析助手

一个基于 AI 的雪球文章分析浏览器扩展，帮助投资者分析和验证财经文章内容。

## 功能特点

- **AI 智能分析**：使用大模型分析雪球文章，提取核心观点
- **事实核查**：自动验证文章中的关键数据和事实
- **投资建议**：提供客观的分析判断，辅助投资决策
- **两种分析模式**：
  - 短文本模式：直接输入问题或观点进行分析
  - 长文本模式：自动抓取当前页面文章内容进行深度分析

## 支持的 AI 模型

- **Kimi** (Moonshot AI)
- **通义千问** (阿里云 DashScope)

## 安装方法

### 1. 从源码安装

1. 克隆本仓库：
   ```bash
   git clone https://github.com/nanoc812/xq_reader_helper.git
   ```

2. 打开 Edge 浏览器，访问 `edge://extensions/`

3. 开启「开发者模式」

4. 点击「加载解包的扩展」，选择克隆的文件夹

### 2. 使用扩展

1. 访问雪球网站 (xueqiu.com)
2. 点击浏览器工具栏的扩展图标打开侧边栏
3. 在设置页面配置 API Key
4. 输入分析内容或直接点击「分析当前页面」

## 配置说明

首次使用需要在设置页面配置 API Key：

- **Kimi API**：访问 https://platform.moonshot.cn/ 获取
- **通义千问 API**：访问 https://dashscope.console.aliyun.com/ 获取

## 文件结构

```
xq_reader_helper/
├── manifest.json      # 扩展配置文件
├── sidebar.html      # 侧边栏界面
├── sidebar.js        # 侧边栏逻辑
├── styles.css        # 样式文件
├── settings.html     # 设置页面
├── settings.js       # 设置逻辑
├── background.js     # 后台脚本
├── content.js        # 内容脚本
├── cw_Prompt.md      # AI 分析提示词
└── icons/            # 扩展图标
```

## 注意事项

- 本扩展仅在雪球网站 (xueqiu.com) 下可用
- 使用前请确保已配置有效的 API Key
- AI 分析结果仅供参考，不构成投资建议

## License

MIT
