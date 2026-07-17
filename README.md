# 语镜 LinguaLens

多语言句子解构器，支持两种连接方式：

- **免费公共服务**：浏览器调用 Cloudflare Pages Function，由服务端使用站点专用 DeepSeek Key；访客不需要配置 Key。
- **自备 Key（BYOK）**：浏览器直接调用用户选择的 OpenAI 兼容接口，文本与 Key 不经过项目方服务。

## 安全设计

- DeepSeek Key 与 Turnstile Secret 只存为 Cloudflare 加密 Secret，不进入 GitHub 或浏览器。
- 公共接口固定 DeepSeek 地址、模型参数与服务端 Prompt；客户端不能传入 API 地址、模型、Prompt 或自定义指令。
- 公共文本最多 500 字符；每个匿名访客每分钟 10 次、每天 50 次。
- 输出预算按分析深度分配：快速 5K、标准 9K、深度最高 16K；`PUBLIC_MAX_OUTPUT_TOKENS` 是单次输出安全上限，不是每日总量。
- Turnstile Token 必须由 Pages Function 逐次验证，过期或重复使用的 Token 会被拒绝。
- KV 使用访客 IP 作为短期额度键：分钟记录约 2 分钟后删除，每日记录最多保留 48 小时；不保存句子正文或分析结果。
- `GLOBAL_DAILY_LIMIT` 提供全站每日熔断，默认 5,000 次。仍建议在 DeepSeek 后台设置余额告警或项目级预算。

> Cloudflare KV 是最终一致存储，极端并发时计数可能短暂超出阈值。若需要账务级硬上限，应再配置 Cloudflare Rate Limiting/WAF 规则或改用具有原子计数能力的独立 Worker/Durable Object。

## 本地运行

普通前端开发（公共接口会显示不可用）：

```bash
npm install
npm run dev
```

完整 Pages Function 开发：

```bash
Copy-Item .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入专用的开发 Key
npm run dev:pages
```

`.dev.vars.example` 中的 Turnstile 值是 Cloudflare 官方测试密钥，仅能用于本地环境。生产环境必须创建真实 Turnstile Widget。

## Cloudflare Pages 生产配置

仓库内的 `wrangler.jsonc` 已绑定 KV 命名空间 `LINGUALENS_QUOTA`，项目名为 `acesentence`。在 Cloudflare 控制台完成以下设置：

1. 打开 **Workers & Pages → acesentence → Settings → Variables and Secrets**。
2. 添加以下两个生产变量，并将其设置为 **Secret / Encrypt**：
   - `DEEPSEEK_API_KEY`：建议使用单独创建、可随时轮换的站点专用 Key。
   - `TURNSTILE_SECRET_KEY`：Turnstile Widget 的 Secret Key。
3. 添加普通变量 `TURNSTILE_SITE_KEY`：Turnstile Widget 的 Site Key。
4. Turnstile Widget 的允许主机名至少加入 `acesentence.pages.dev` 以及正式自定义域名。
5. 构建设置使用：
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Root directory：留空
6. 重新部署。访问 `/api/config`，确认返回 `"available": true`。

不要把任何真实 Key 写进 `.env`、`.dev.vars.example`、`wrangler.jsonc` 或 Cloudflare 的普通明文变量。

## 验证与部署

```bash
npm test
npm run lint
npm run build
npm run functions:check
```

登录 Wrangler 后，可手动部署：

```bash
npm run deploy
```

## 主要目录

- `functions/api`：公共配置与受保护的分析接口
- `functions/_lib`：Pages Function 运行时类型与响应工具
- `src/analysis`：语言策略、模块、预设、Prompt 和输出 Schema
- `src/providers`：公共服务与 BYOK Provider Adapter
- `src/storage`：普通配置、连接模式与 API Key 的隔离存储
- `src/components`：连接设置、Turnstile、分析设置和结果视图
