# Tallya 计划：线索续接（整理时追问 + 打开应用被动回顾）

> 与 DESIGN.md / AGENTS.md 的**核心定位与边界**冲突时，以 PLAN.md 为准；本文是 PLAN.md 之下的单功能落地计划。
> 最近更新：2026-06-15。

## 背景与决策（为什么是现在这个样子）

最初设想是「每日早报」：每天早上主动推送一份「昨天/上周未完成的事」清单。讨论后**砍掉了主动推送**，原因有两条硬约束：

- **不做任务状态机。** entry 模型里没有「完成/未完成」字段，要算「未完成」必须让 AI 推断完成状态并持久化对账——这正是 PLAN「坚决不做」的头号项，也违背「AI 只做追问、不做无中生有」。
- **不催促、不制造压力。** DESIGN 的产品人格是「安静、不催促、不把记录变成绩效监督」。每天早上弹一张待办清单，无论放通知还是首页 banner，体感都是 push，与人格相反。

保留下来的是真实需求：**「别忘了手上还在进行中的事。」** 用**数据规律**（线索的记录时间）来识别，而不是让 AI 判断完成度；用**被动 pull**（用户想看才看）替代主动 push。

## 核心原则

- **只追问，不下结论。** 程序只问「《X》还在进行吗？」，从不声称某事完成或未完成。
- **判定全靠时间戳，零 AI、零误判。** 复用现有 `thread` 的记录时间分布，不新建任何状态表 / 状态字段。
- **答案落地为普通 clarification。** 追问的回答存成对应 entry 的 clarification，不引入新的「待办」实体。
- **首页不动。** 不在 toolbar 与输入框之间插入任何回顾区；首屏始终是「今天做了什么？」。

---

## 停顿判定规则（共用，M-A / M-B 都用这套）

一条线索要被拎出来「续接追问 / 回顾」，需**同时**满足四个条件。判定数据全部来自
`ThreadSummary`（已含 `entryCount / firstOccurredOn / lastOccurredOn`，见
[types.ts](../src/features/work-memory/types.ts)），无需新查询。

| # | 旋钮 | 含义 | 初始默认值 |
| --- | --- | --- | --- |
| ① | 有过势头 | 是真·跨天的事，不是一次性记录 | `entryCount ≥ 2` 且 `firstOccurredOn ≠ lastOccurredOn`（≥2 个不同的天） |
| ② | 沉默下限 | 最后一条记录距今够久才算「停了」 | 距 `lastOccurredOn` **≥ 3 天**无新记录 |
| ③ | 沉默上限 | 太久就当它黄了/忘了，不再打扰 | 距 `lastOccurredOn` **≤ 14 天** |
| ④ | 问过静默 | 同一条不反复唠叨 | 出现过且未被续接/补充，则 **3 天内不再出现** |

口语版：**「之前连着几天在记、但最近 3～14 天一条都没添的线索」** 才拎出来问一句。

- 不满足①（一次性记录）→ 永不出现（治「噪音：一次性小事被当成停顿」）。
- 超出③（沉默两个月）→ 自动消失（治「噪音：早黄的事被反复唠叨」）。
- ④ 的「问过」需要轻量持久化「上次提示某线索的日期」（一个 thread→date 的小记录即可，
  非状态机；具体存储在实现时定，倾向放 app_settings / 一张极简表）。

> 阈值为初始默认，后续按真机手感可调。`14 天上限`先按此跑，若发现「搁两三周再捡起来」
> 的事被过早丢弃，再放宽。

---

## M-A：整理时追问停顿线索 ✅ 已完成

> 已实现并随测试通过（typecheck + lint + 420 测试全绿）。真机验证仍待做（见末尾）。

**目标**：生成周报/范围报告前的「补充」环节，除了现有「重点但记得简略的线索」，
再带上「停顿线索」，各问一句「还在进行吗？」。

**实现摘要**：

- 新增纯逻辑 [stalled-threads.ts](../src/features/work-memory/services/stalled-threads.ts)：
  `selectStalledThreadGaps(summaries, referenceDate)` 按停顿规则（默认值见下）从
  `ThreadSummary` 直接算出 `ReportGap[]`，问题是固定模板、不调 AI。
- [types.ts](../src/features/work-memory/types.ts) `ThreadSummary` 加 `lastEntryId`，
  [thread-service.ts](../src/features/work-memory/services/thread-service.ts) 填充——答案挂回该线索最近一条真实 entry。
- [report-service.ts](../src/features/work-memory/services/report-service.ts) `getReportGaps`
  拆成两个**各自 fail-open** 的来源并行跑：`getAiReportGaps`（原逻辑）+ `getStalledThreadGaps`
  （新增，参照日 = `now()`），再 `mergeReportGaps` 去重（按 entryId / threadTitle）并截断
  至 `MAX_REPORT_GAPS = 3`，AI 选优先、停顿补位。注入新依赖 `threadSummaryProvider`
  （默认 `threadService`）。
- UI / `ReportGapDialog` / `saveGapAnswers` **未改**：停顿线索就是普通 `ReportGap`，答案照旧存 clarification。
- 无 AI 也生效：停顿线索不依赖 AI，AI 失败/未配置时仍能出现。
- ④「问过静默」未接（报告本就低频，留 M-B 统一处理）。仅周报/范围报告路径有缺口环节，
  日报快速流（`use-daily-report-flow`）无此环节，不受影响。

**复用**：整套缺口补全流程已存在——
[report-gap-dialog.tsx](../src/features/work-memory/components/report-gap-dialog.tsx)、
`getReportGaps` / `saveGapAnswers`（[report-service.ts](../src/features/work-memory/services/report-service.ts)）、
`ReportGap` 类型。**几乎只改数据源，不改 UI、不改回答落地路径。**

**改动点**：

1. [report-service.ts](../src/features/work-memory/services/report-service.ts) `getReportGaps`：
   在现有 AI 选出的 gaps 基础上，**合并**按停顿规则筛出的线索。停顿线索的 `question`
   是固定模板（如「《X》这周没再记，还在进行吗？做到哪了？」），不必走 AI；与 AI gaps
   去重（按 `entryId` / `threadTitle`），合并后整体 `≤ 3 条`仍保持 fail-open。
   - 停顿线索的代表 `entryId`：取该 thread 最近一条 entry 的 id（答案挂上去）。
2. `saveGapAnswers` / `ReportGapDialog` **无需改**：答案照旧存成 clarification。
3. ④「问过静默」在 M-A 可暂不接（报告是用户主动触发、本就低频），优先 M-B 再统一处理。

**验证**：配好 AI + 造一条「上周记了 3 天、本周没动」的线索 → 点生成 → 缺口对话框里出现
「《X》还在进行吗？」→ 答一句 → 生成的报告/该 entry 下能看到这条补充；无 AI 时停顿线索
仍能出现（因为它不依赖 AI），答完正常生成。

---

## M-B：打开应用被动回顾 ✅ 已完成

> 已实现并随测试通过（typecheck + lint + 431 测试全绿）。真机验证仍待做（见末尾）。
> 注意：这是计划里建议「等 M-A 信号再做」的一块，按用户决定提前实现。

**实现摘要**：

- 纯逻辑复用 M-A 的 `selectStalledThreads`（同一条判定规则）。
- **圆点**：[home-toolbar.tsx](../src/features/work-memory/components/home-toolbar.tsx) 线索按钮右上角加
  `bg-app-accent` 小圆点（带 `ring-app-bg`），仅 `hasThreadsNudge` 为真时出现，aria-label 同步。
- **每日检查 + 问过静默**：新增 hook
  [use-stalled-thread-review.ts](../src/features/work-memory/hooks/use-stalled-thread-review.ts)，
  挂 `visibilitychange/focus`，以「上次判断日期」去重做到**每天首次显示窗口判断一次**；
  决策抽成纯函数 [stalled-review.ts](../src/features/work-memory/services/stalled-review.ts)
  `planStalledReviewNudge`（④：同一线索 3 天内不重复亮点，离开停顿窗口即丢弃）。
- **存储**：[stalled-review-repository.ts](../src/features/work-memory/services/stalled-review-repository.ts)
  用 localStorage 存「上次判断日期 + 每线索上次亮点日期」——这是可丢弃的提示态、非用户内容，
  故不进 SQLite（零迁移），接口隔离，日后可换。
- **面板标注 + 置顶**：[use-threads-panel.ts](../src/features/work-memory/hooks/use-threads-panel.ts)
  打开时算出停顿线索 id、把停顿的稳定排到列表前；
  [threads-panel.tsx](../src/features/work-memory/components/threads-panel.tsx) 给停顿行加安静的
  「停顿中」标。打开面板即 `markReviewed()` 清掉圆点（含异步在途的竞态保护）。
- 共用日期口径：新增 [memory-date.ts](../src/features/work-memory/services/memory-date.ts)
  `differenceInCalendarDays`（UTC 计算，避免跨时区差一天），M-A/M-B 共用。

**目标**：每天首次显示窗口时，若存在停顿线索，给一个**安静的、可点开**的回顾入口；
**首页布局完全不动**。

**放置（关键决策）**：**不**做首页 banner。改为：

- 在已有的「线索」工具栏按钮（`ListTree`，见
  [use-threads-panel.ts](../src/features/work-memory/hooks/use-threads-panel.ts)）上加一个
  **安静的小圆点**，表示「有停顿线索待回顾」。
- 回顾内容放进**已存在的** threads-panel：把停顿中的线索**标注/置顶**，点进去即续接
  （直接跳到该线索、可在对应天补记）。
- 不新增任何顶层入口（DESIGN：「Do not pile up feature entry points」）。

**触发时机**：每天**首次**窗口可见时判断一次（复用
[reminder-bootstrap.tsx](../src/features/work-memory/components/settings/reminder-bootstrap.tsx)
已有的 `visibilitychange/focus` 监听思路），用「上次判断日期」去重，避免一天反复弹。

**改动点**：

1. thread-service / threads-panel hook：新增「列出停顿线索」（基于上面的判定规则，复用
   `listThreadSummaries` 的数据）。
2. 工具栏按钮加圆点状态；threads-panel 里对停顿线索做视觉标注。
3. ④「问过静默」在此落地：回顾里展示过且用户没续接，则 N 天内不再标红点。

**前置判断**：M-A 上线后**先观察用户是否真的会抱怨「忘了在进行中的事」**。没有这个信号，
M-B 可以再等——避免在留存尚未验证时继续加面。

---

## M-C：线索归并中枢 + 手动归并（来自真机 dogfooding 的真实摩擦）

> **第一期已完成**（typecheck + lint + 444 测试全绿）。第二期（主动 nudge）仍未做。真机验证待做。

**背景**：真机使用发现，跨天补记同一件事经常**没归并成线索**。根因不是判定逻辑，而是归并
建议本身太脆：
- 它是**会话内临时态**（不存盘）、**绑在当天 feed 的卡片**上、且**依赖 AI 及时返回**；
- AI 一慢/超时，后台 `suggestThreadLink` 静默失败（[use-entries-controller.ts](../src/features/work-memory/hooks/use-entries-controller.ts) `catch {}`，设计如此，不能打断记录）→ 建议卡不弹 → 不归并；
- 跨天补记时，某天的建议还没弹我就切了日期，也就错过了；
- 而且**没有手动兜底**（DESIGN「绝不手动维护关联树」），AI 漏了就补不回来。

**这点很关键**：M-A/M-B 全靠线索存在，线索全靠这个后台 AI 调用可靠触发。AI 一慢，线索静默
变少，停顿/缺口功能就没东西可显示。

### 决策

- **持久化**：待归并建议落 **SQLite**（`thread_suggestions` 表，`SCHEMA_VERSION = 8`），重启不丢、慢 AI 慢慢攒。
- **聚合到「线索」中枢**：归并建议**从当天 feed 卡片移出**，集中到线索面板顶部的「待归并」分区，每条两个图标 ✓/✗（确认归并 / 忽略）。线索按钮显示**待归并数量角标**。
- **手动归并④**：在**某条 entry 的操作**里加「归并到…」，可选已有线索或新建——给纯自动一个克制的兜底（这是对 DESIGN「绝不手动维护关联树」的一次有意识破例，理由是已亲身验证纯自动的脆弱）。
- **失效/过期**：打开中枢时校验——关联 entry 已删、已归到别的线索、线索已不存在 → 该建议自动丢弃；并设软过期（如 14 天）避免攒成收件箱（否则就违背「不做后台管理系统」）。

### 语义澄清（重要）

角标/通知的数字**只数「待归并的决定」**，不要把「停顿」算进去：
- 数字 = 待归并建议数（要你点 yes/no）；
- 停顿 = 面板内安静标「停顿中」，不计数。
- 线索按钮指示优先级：有待归并 → 数字角标；否则有停顿 → 圆点（M-B）；否则无。

### 分期（避免给一个信号堆四个通道、反而变吵）

**第一期（安静基线，纯 pull —— ✅ 已完成）**：
1. ✅ `thread_suggestions` 表 + 迁移（v8）+ 仓储（内存+SQLite+单例）：[thread-suggestion-repository.ts](../src/features/work-memory/services/thread-suggestion-repository.ts)；校验/确认/忽略/过期逻辑在 [thread-suggestion-service.ts](../src/features/work-memory/services/thread-suggestion-service.ts)。
2. ✅ 记录时把建议**持久化**（替代会话内 map），保持 fail-silent：[use-entries-controller.ts](../src/features/work-memory/hooks/use-entries-controller.ts) `requestThreadSuggestion` → `threadSuggestionService.save`，并经 `onThreadSuggestionsChanged` 通知中枢刷新。
3. ✅ 线索中枢「待归并」分区（✓/✗）+ 失效校验；**已移除 feed 内联建议卡**：[threads-panel.tsx](../src/features/work-memory/components/threads-panel.tsx)、[use-threads-panel.ts](../src/features/work-memory/hooks/use-threads-panel.ts)。
4. ✅ 线索按钮**数字角标**（与 M-B 圆点按优先级共存）：[home-toolbar.tsx](../src/features/work-memory/components/home-toolbar.tsx)。
5. ✅ 手动归并④：entry 操作「归并到…」+ 线索选择器：[entry-merge-dialog.tsx](../src/features/work-memory/components/entry-merge-dialog.tsx)（未在线索中的 entry 才显示入口）。

**第二期（主动 nudge，仅当第一期证明确实会漏才做）**：
- idle 弹窗：首页 + 前台聚焦 + 无遮罩 + 键鼠静默 ~10s + **一批只弹一次** + 不抢焦点；
- 后台→系统通知：AI 任务队列清空后只发一次、count>0、受通知开关控制、点开唤起并打开中枢（复用 [use-ai-task-coordinator](../src/features/work-memory/hooks/use-ai-task-coordinator.ts) + `useTrayWindowEvents`）；
- OS 角标数字（Tauri `set_badge_count`）——**Windows 上是任务栏 overlay，数字渲染受限，需先验证**。

---

## 明确不做

- ❌ 每日早报 / 任何主动推送「未完成清单」。
- ❌ entry / thread 上的「完成 / 未完成」状态字段或独立「待办」实体。
- ❌ 让 AI 推断某件事是否已完成。
- ❌ 首页 toolbar 与输入框之间的常驻回顾区 / banner。
- ❌ 待归并建议堆成「收件箱」式待办（必须失效清理 + 软过期）。
- ❌ 一个信号配多个通知通道（第一期只做安静 pull；主动 nudge 留第二期且默认可关）。

---

## 暂缓（本轮评估过、未纳入当前范围）

这两条来自同批想法，方向认可，但当前先聚焦「线索续接」，不展开：

- **补充选项化**：信息补充时让 AI 生成 1–4 个预设选项（每行最多两个）+ 一个自由输入框。
  收益是降输入负担，但有「诱导用户选个差不多对的、污染记忆真实性」的风险——预设须从
  **真实数据**（现有 thread 名、时长区间等枚举型问题）生成，开放型问题不给预设。待 M-A/M-B
  稳定后单独立项。
- **应用内自动更新**：经 GitHub Release 分发更新，设置→关于里放「检查更新」。注意这是
  **整包替换**（`tauri-plugin-updater`），非二进制增量；需引入插件 + 签名密钥对 + CI 产出
  `latest.json`/`.sig`，且 OS 级代码签名缺失时仍会触发 SmartScreen/Gatekeeper 警告。
  纯工程项，无定位冲突，可独立排期。

---

## 验证 / 已知风险

- **停顿判定的「天」边界**：跨时区 / 跨天分界要与现有 `occurredOn`（YYYY-MM-DD）口径一致，
  别用 `occurredAt` 时间戳直接减导致差一天。
- **无 AI 场景**：M-A 的停顿线索不依赖 AI，必须在无 AI 配置时也能出现并正常存补充。
- **真机验证**：threads-panel 圆点 + 标注；每天只弹一次；④ 静默生效后不反复标红。
- **数据稀疏期**：新用户线索少时，回顾应安静地什么都不显示，不得出现空态噪音。
