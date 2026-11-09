# 验收记录

## 2026-11-09 托管迁移前增量检查

- 25 个测试文件、174 项测试通过，生产构建成功。
- 新增 Safari 导航响应重定向兼容、旧缓存修复及真实计算 Worker 就绪自检。
- 全新本地浏览器会话的离线缓存与 Worker 自检通过，刷新后再次通过；这不是 iPhone 真机认证。
- 原 Sites 首页和 sw.js 均为平台 HTTP403；现已迁移至 `https://marscc029.github.io/holdem-lab/`。GitHub Pages 公开且强制 HTTPS，游戏无需飞书或 GitHub 登录。详见 `DEPLOYMENT.md`。

## GitHub Pages 公开版本实测

- Pages 首次生产提交 `3ae7ad16e178b223504a3f1b6bcefaca2833b681` 状态 built；来源 main:/docs。
- 不带 Cookie/认证的请求：13 个静态文件全部 HTTP 200、SHA256 与本地审查构建一致；包括主页、sw.js、计算 Worker、manifest 和图标。脚本 MIME 正确，无跨域登录跳转或平台改写。
- Chromium 390×844 手机视口：匿名新入口显示“已可离线使用”；实际创建 Worker，完成 5,000 样本权益计算，显示独赢、平局、权益、EV、样本误差。
- 实际执行 Call，验证行动后暂停及解析；刷新恢复同一底牌、投入与剩余筹码。翻后无人下注时界面显示 Bet，已有下注时显示 Raise to。
- 题库半池下注题 P=120，答 60 正确，显示公式与分类进度；刷新后保留。`all in` 检索找到 All-in / Short All-in 两词条。
- HTTP 完整性报告保存在交付目录的 `artifacts/github-pages-http-verification.json`；手机视口截图 `artifacts/holdem-pages-iphone-preview.png`。这些检查不能替代真实 iPhone。
- 公开站点另通过 Desktop WebKit 26.5 的 8 项集成检查：正确 `/holdem-lab/` SW scope、11 项缓存及真实 Worker 就绪、5,000 样本提示、术语弹窗、行动/快照写入、训练反馈、All-in 检索，以及由 SW 提供的刷新和 IndexedDB 恢复。无页面脚本错误或外部域名请求；报告 `artifacts/webkit-pwa-public-result.json`。
- 对公开站点的 Playwright route 网络拦截会在导航前返回 `Blocked by Web Inspector`，不作为成功断网的证据。真实服务器不可达后的离线功能由下述本地 9 项检查验证；真机飞行模式检查仍待设备验收。

日期：2026-11-09（Asia/Shanghai）。环境：Windows、Node.js 24.18.0、Vite 8.3.6、Vitest 5.1.0，Chromium 内置浏览器；另以 Playwright 1.62.1 的 Desktop WebKit 26.5 进行本地离线集成检查。

## 自动化

- 完整回归：25 个测试文件、174 项测试全部通过。
- TypeScript 严格类型检查通过；Vite Safari 17 目标生产构建成功。
- 完整依赖及生产依赖 npm audit：0 项已知漏洞。
- 离线构建：11 项本地资源，包括主页面、样式、JavaScript、计算 Worker、manifest、图标和公开 LICENSE；每项包含 SHA256。
- 规则包括累计不足额全下重开、最小完整加注、非法金额、边池与平分、筹码守恒、回放一致性、牌型独立交叉验证。
- 数学包括 P=150/C=50 所需权益25%、30%权益跟注EV+10、普通盲注局面不误报边池、多层资格与平局权益、范围阻断与联合抽样。
- 教学包括60题逐题计算/独立牌型库校验、50个词条、All-in等搜索变体、数值评分误差和错题记录。
- 存储包括严格导入、非法牌谱、超限、累计统计与1000手裁剪、大备份显式省略旧牌谱的准备结果。
- 离线包括缓存哈希损坏拒绝、资源修复、等待接受更新、Vary: Origin兼容、旧版本资产回退及跨域/POST不接管。

## 浏览器实际操作

- 检查390×844手机视口与1440×1000桌面视口，无横向内容溢出。
- 开始牌局，验证跟注、All-in、行动后暂停/继续、合法下注范围和结果结算。
- 请求本机Worker提示；显示权益、独赢、平局、所需权益、EV、样本数和误差；提示与复盘不使用对手底牌。
- 完成一手后保存，逐步回放并查看冻结决策。
- 作答EV题：P150、C50、权益20%，输入-10；界面正确判分并记录100%当前正确率。
- JSON备份下载、校验、明确确认后导入，牌局和练习进度恢复。
- 搜索 `all in`，找到All-in与Short All-in解释；桌面/手机术语弹窗可打开关闭。
- 新版本下载后保持等待，点击“应用更新”后刷新，原牌谱和训练统计保留。
- 关闭本地4174预览服务器并确认HTTP不可达；浏览器刷新后仍可开新局，并创建Worker完成5000样本的范围计算。该检查未通过操作系统断网实现。

## Desktop WebKit 本地离线集成检查

使用官方 Playwright WebKit 26.5，390×844 触摸/移动视口；这是 Windows 上的桌面 WebKit，不能等同于实体 iPhone 或特定版本的 iOS Safari。测试使用隔离的浏览器上下文和仅绑定 `127.0.0.1:4180` 的临时静态服务器，不操作用户的浏览器。

服务器为 `/index.html` 返回到 `/` 的 302 重定向，并为静态响应设置 `Cache-Control: no-store, no-transform`。等待完整缓存和真实计算 Worker 自检通过后，实际停止服务器，再继续检查，避免普通 HTTP 缓存掩盖离线资源缺失。

以下 9 项通过：

1. 首次加载取得 Service Worker 控制，完整资源缓存包含计算 Worker，真实计算就绪自检通过。
2. 停止服务器、关闭页面并在同一上下文重新打开后，HTML、CSS、JavaScript 和离线界面正常加载，包括重定向后的首页缓存。
3. 离线开始实战，计算 Worker 返回 5,000 个有效样本的范围权益结果。
4. 离线打开并关闭专业术语解释弹窗。
5. 玩家行动和冻结的公开决策快照写入 IndexedDB。
6. 离线提交训练答案，显示判分与计算过程。
7. 离线搜索 `all in`，找到全下相关词条。
8. 离线刷新后恢复当前手牌、原有行动前缀和训练进度。
9. 测试未观察到外部请求或页面 JavaScript 异常；服务器停止后的 Service Worker 更新请求连接失败属于预期情况。

本地证据目录为 `D:\AI\德州\artifacts`：报告 `webkit-pwa-local-server-down-ephemeral-result.json`、截图 `webkit-pwa-local-server-down-ephemeral.png`、脚本 `webkit-pwa-local-test.mjs`。这些测试产物未随应用源码上传。

验证限制：Playwright `context.setOffline(true)` 路径出现 `WebKit encountered an internal error`，因此不记作模拟断网通过；上述通过结果来自实际停止服务器。另一次使用工作区持久化浏览器配置目录的测试出现 IndexedDB `Unable to open database file on disk`，没有据此认证浏览器进程完全退出再启动后的持久性。同一临时上下文内关闭页面、重新打开及刷新后的存储恢复已经通过，仍需实体 iPhone 独立启动与飞行模式验收。

## 尚未验证

- 未连接实体iPhone，未完成真实iOS Safari、主屏幕独立启动和飞行模式验收；须按README步骤在设备上完成。
- 新披露漏洞、浏览器数据被系统清理及托管平台自身安全性不属于本次保证范围。
- 浏览器下载验证曾被宿主下载流程长时间阻塞；文件最终成功保存且导入验证完成。

构建有单个主JavaScript大于500KB的提示；实际主文件gzip约174KB，离线总资源约1.2MB。无外部字体或媒体依赖。
