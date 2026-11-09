# 托管迁移与 Safari 离线验收

## 原链接诊断

2026-11-09 对原 Sites 根页面及 `/sw.js` 的普通请求均得到 HTTP 403、`Server: cloudflare` 和 Cloudflare 拦截页。原站仍是 active/public，版本部署成功。现有 Sites 工具无法修改平台 WAF，因此不以反复部署或修改游戏 CSP 作为解除此拦截的办法。

## 托管选择

- 妙搭 HTML 发布返回飞书文档包装页，需要登录，不符合独立 PWA 要求。
- 妙搭独立前端构建已完成；但设置匿名公开访问返回 `40302 app not sharable`，所属组织禁止对外共享。因此弃用此托管路线，不要求用户调整飞书组织安全策略。
- 改用专用 GitHub Pages 仓库，发布已审查的游戏源码与生产静态文件。GitHub 身份仅用于发布，玩家无需任何账号。
- 生产文件保持同源，禁用 Git 换行转换与 Jekyll 改写。仅上传项目源码、许可证和构建产物，不上传本机凭据或玩家记录。
- 只有发布接口返回且通过匿名检查的 URL 才作为新入口。

## GitHub Pages 发布

- 仓库：`https://github.com/MarsCC029/holdem-lab`。
- Pages 返回入口：`https://marscc029.github.io/holdem-lab/`，保留末尾斜线。
- 来源：`main` 分支的 `/docs`；公开访问，强制 HTTPS。
- `docs/.nojekyll` 禁用 Jekyll；`.gitattributes` 禁止换行转换，以保留离线资源校验值。
- GitHub Pages 不读取 `_headers`。本版仍有 HTML 内的 CSP 与 referrer 策略；不将未生效的额外 HTTP 响应头计入安全结论。
- 首次生产版本 `3ae7ad16e178b223504a3f1b6bcefaca2833b681` 已构建成功。匿名访问页面及全部 13 个静态文件均 HTTP 200、SHA256 与审查构建一致；sw.js 和计算 Worker 的 MIME 正确，无登录重定向或 Cloudflare 挑战。
- 公开站点的 Chromium 手机视口实测已显示“已可离线使用”，成功运行 5,000 样本权益计算、行动解析、专项题与术语搜索，并恢复刷新前的当前手牌和训练记录。
- 完整验证结果和真机限制见 `VALIDATION.md`。原域名的 IndexedDB 不会自动转移；已有记录应先导出 JSON，在新入口导入。

## 已做的兼容性修复

- Safari 对 Service Worker 导航响应的重定向历史有严格要求；安装、修复及读取旧缓存时使用不带历史重定向标记的本地响应。内容仍逐项 SHA256 校验，保留 CSP 等安全头。
- “已可离线使用”须同时通过完整缓存检查和真实计算 Worker 的皇家同花顺平局自检；计算不能启动或结果异常时不显示就绪。
- 页面从后台恢复、重新联网或恢复浏览器历史时重新核对缓存状态。
- manifest 名称、配色与游戏一致，保持 `standalone`；HTML 声明 `no-transform`（若平台支持对应响应头）。

## 新托管必须通过的检查

1. 根入口匿名 HTTPS 200，返回游戏 HTML，无登录壳或跨域 iframe。
2. `sw.js`、manifest、所有 JS/CSS/图标以同源路径提供，MIME 正确，无挑战页；子目录入口必须使用规范的末尾 `/`。
3. 下载内容与构建中的 SHA256 一致。不得为迁就注入脚本、统计代码或 CDN 改写而移除完整性校验。
4. 全新浏览器会话缓存、运行 Worker、实战与练习、刷新续玩、更新保留记录均正常。
5. iPhone Safari：从新入口添加到主屏幕，打开主屏幕应用并保持联网等到就绪，再强退、开启飞行模式、冷启动，验证新牌局、题库、术语、计算及记录。

桌面 WebKit 或 Chrome 不能替代第 5 项。没有完成真机检查之前，不标为“iPhone 已认证”。更换域名不会自动迁移旧域名的 IndexedDB 进度；能打开旧缓存时应先导出 JSON，再在新入口导入。
