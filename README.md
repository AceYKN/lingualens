# 语镜 LinguaLens

隐私优先、可自定义的多语言句子解构器。应用是纯前端 SPA，浏览器直接调用用户配置的 OpenAI 兼容接口；项目不包含服务器、数据库、账号或云端历史记录。

## 本地运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址，在“配置模型”中填写服务商、模型名和 API Key。目标接口必须允许浏览器跨域调用。

## 验证与构建

```bash
npm test
npm run lint
npm run build
```

构建产物位于 `dist/`，资源使用相对路径，可部署到 GitHub Pages、Netlify、Vercel、Cloudflare Pages 或任意静态服务器。

## 安全边界

- API Key 默认只保存在页面内存中，刷新后清除。
- 只有主动启用“保存到当前浏览器”后，Key 才会写入 Local Storage。
- 配置与分析导出永远不包含 API Key。
- 文本和 Key 只发往用户配置的模型接口，但第三方服务可能按其隐私政策处理数据。
- 纯前端应用不能像服务端那样完全隐藏 Key，建议使用有额度限制的专用 Key。

## 主要目录

- `src/analysis`：语言策略、分析模块、预设、Prompt 和输出 Schema
- `src/providers`：OpenAI 兼容 Provider Adapter 与错误归类
- `src/storage`：普通配置与 API Key 的隔离存储
- `src/components`：模型设置、高级设置、结果与文本联动组件
- `src/utils`：安全导出工具

"# lingualens" 
