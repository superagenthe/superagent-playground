# 验收记录

- 产品：Todo（PRD v1.0，P0 范围）
- 验收日期：2026-11-09
- 被测版本：本 PR 分支 `agent/requirements-doc-dev-7367e604e378` 的 head commit；生产构建由 `npm run build` 生成
- 运行环境：Linux x64，Node.js 22.22.0，Vite 8.3.6，Playwright 1.65 / Chromium 158.0.8127.18（Chrome for Testing Headless Shell）
- 浏览器与视口：Chromium 1440×900、1280×720、390×844（DPR 2、移动/触摸模拟）、360×800；`zh-CN`，`Asia/Shanghai`
- 数据规模：常规用例 3–12 条任务；性能用例 1,000 条任务、20 个自定义清单

## 自动化结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck` | 通过 |
| 生产构建 | `npm run build` | 通过，主 JS gzip 约 83 KB，CSS gzip 约 5 KB |
| 单元测试 | `npm test` | 45 个测试全部通过 |
| 端到端测试 | `npx playwright test` | 22 个测试全部通过（桌面 20 + 移动 2） |

Playwright 测试覆盖：任务生命周期、表单校验与重复提交、全部视图边界和排序、搜索/优先级筛选、清单重命名/删除、任务删除、写入失败、未保存关闭、多标签页并发编辑/删除、清单删除冲突、跨午夜刷新、损坏/不兼容数据、键盘与焦点循环、移动端抽屉/全屏详情/44px 点击区域、1,000 条任务性能。

## AC 对照

| 编号 | 验收结果 | 证据 / 说明 |
| --- | --- | --- |
| AC01 | 通过 | `AC01 creates a minimal task...`：标题创建、默认中优先级/收集箱/今日，刷新后保留 |
| AC02 | 通过 | `AC02 validates blank and overlong titles...`：空标题、201 字符标题、输入保留 |
| AC03 | 通过 | `AC03 guards against duplicate submits`：连续提交只创建一条 |
| AC04 | 通过 | `AC04 edits every field...`：全字段编辑、创建时间不变、刷新后保留 |
| AC05 | 通过 | `AC05 completes and reopens...`：完成时间写入、重新打开清空、视图归位 |
| AC06 | 通过 | `AC06/AC07...`：昨天/今天/明天/第 7 天/第 8 天/无日期归属正确 |
| AC07 | 通过 | 同上：逾期/今日分组、日期/优先级/创建时间/ID 排序、今日数量 |
| AC08 | 通过 | `AC08/AC09...`：标题/备注搜索、大小写、筛选交集、HTML 按文本显示 |
| AC09 | 通过 | 同上：切换视图后搜索/优先级重置；导航数量不随筛选变化 |
| AC10 | 通过 | `AC10/AC11 renames and deletes...`：重命名关联不变；删除清单任务原子迁移至收集箱，状态保留 |
| AC11 | 通过 | 同上 + `AC11 prevents duplicate...`：重复名、收集箱保留名、收集箱无管理入口 |
| AC12 | 通过 | `AC12 cancels and confirms...`：取消保留、确认永久删除 |
| AC13 | 通过 | `AC13 reports write failure...`：写入失败不显示成功，输入保留、原数据不变，恢复后可重试 |
| AC14 | 通过 | `AC14 confirms discarding...`：Esc 触发未保存提示，继续编辑保留输入，放弃后恢复原任务 |
| AC15 | 通过 | `AC15 detects a concurrent edit...`：B 保留草稿、显示冲突、保存禁用，显式重载后可保存 |
| AC16 | 通过 | `AC16 does not recreate...` + `AC16 handles deleting the list...`：删除任务/清单后不静默覆盖、不恢复已删除任务 |
| AC17 | 通过 | `AC17 regroups today tasks...`：Playwright 时钟跨过本地午夜，今日分组转为已逾期 |
| AC18 | 通过 | `AC18 preserves corrupt data...` + `AC18 flags an incompatible version...`：不覆盖原始数据、重试、二次确认重置、版本不兼容 |
| AC19 | 部分通过 | Chromium 1440/1280/390/360 完成核心流程，无整页横向溢出，移动端主要点击区域 ≥ 44×44。真实 Safari、Edge、iPhone Safari、Android Chrome 未执行 |
| AC20 | 通过（有验证缺口） | `AC20 supports Enter submit...`：焦点进入弹窗、Tab 循环、标题 Enter 提交、备注 Enter 换行、Esc 未保存提示。真实中文输入法候选确认未在自动化中复现；代码使用 `isComposing`/`keyCode 229` 防误提交，仍需真实设备手动确认 |

## 性能

在 `npm run build` + `vite preview` 的生产构建上测量（headless Chromium，单机）：

| 场景 | 目标 | 实测 |
| --- | --- | --- |
| 1,000 条任务下从“今日”切到“全部待办”（300 → 900 行） | 300 ms 内反馈 | 79.7 ms |
| 从“全部待办”切回“今日” | 300 ms 内反馈 | 37.8 ms |
| 1,000 条任务下搜索停止输入到结果出现 | 500 ms 内 | 22.3 ms |
| 首次本地打开到空状态可用 | 3 s 内 | 约 105 ms（本地预览，非真实网络） |

开发服务器（StrictMode 双渲染）下同类切换约 248 ms，仍在 300 ms 内；生产构建数据更接近发布行为。

## 手动检查

- 1440×900、1280×720、390×844、360×800：页面无整页横向滚动，任务标题/清单名可换行，详情页保存按钮在软键盘场景可滚动访问。
- 移动端抽屉：Esc 关闭，关闭后焦点回到菜单按钮；遮罩点击关闭。
- 弹窗：焦点进入、Tab/Shift+Tab 循环、Esc 触发未保存确认、关闭后焦点返回触发入口。
- 数据说明在侧边栏底部、首次使用空状态和清单空状态均可打开。
- 完成/重新打开、删除任务、删除清单、搜索无结果、数据损坏状态均已截图，见 [UI.md](UI.md)。

## 已知限制

1. **真实浏览器矩阵**：Safari/WebKit 与 Edge 未在本机执行；WebKit 浏览器因宿主缺少系统库无法启动。Chromium 覆盖了桌面和移动视口模拟，iOS/Android 真机未接入。发布前应按 PRD 9.2 在 Chrome、Edge、Safari 最新稳定版及 iPhone/Android 真机复测。
2. **输入法**：真实中文输入法的候选确认路径未自动化；需在 Safari/Chrome 上手动验证 AC20 的 IME 部分。
3. **日期输入展示**：原生 `input[type=date]` 的显示格式由浏览器区域设置决定；数据始终按 `YYYY-MM-DD` 保存，不随显示格式变化。
4. **部署地址**：本 PR 提供可部署的静态产物和部署说明，未接入实际托管域名与 HTTPS 证书；发布前需完成托管配置。
5. **首版边界**：不含账号同步、提醒、重复任务、子任务、标签、导入导出、回收站和深色模式（PRD 列为 P1 / 后续）。
