# 上游来源与许可证

- 项目：Poker Mentor，https://github.com/Easternguy/poker-mentor
- 固定提交：`a1252b8fc32fb35d3a98dd9545b58859a63378ad`
- 原许可证：MIT，完整保留在 `LICENSE`。
- 本版本：筹码实验室 / Hold’em Lab，独立改造版本，与原作者及任何真钱游戏平台无隶属关系。

复用原项目的纯 TypeScript 德州扑克引擎、牌型比较、机器人策略及原有测试；新增中文界面、术语与计算训练、范围抽样、分池权益分析、Worker、离线 PWA 和本地备份。

删除上游 Node 同步服务器及 Docker 部署方式，移除云同步调用和 Google Fonts。原来的纯合并工具保留用于上游回归测试，已无联网功能。原始英文组件保留作代码来源参考，不作为本版入口，不进入生产页面。

上游开发依赖已更新到本版锁文件指定的版本。不得使用原 README 中的 Docker 或同步 API 部署说明。
