# 长程冲刺结论（R2）：提交包终局状态与评审防线

> 生成：2026-09-03 凌晨，长程任务包 `D:\tmp\quxiang-longtask\`（分支 feat/final-sprint-20260903）。
> 本文是冲刺全链路的**结论层**：怎么判的、判了什么、什么已被机器与多AI证实、什么还开着。
> 全部数字可由文末命令复算；判据脚本清单见文末附录。

## TL;DR

1. **证据层全部验证为真**（冷启动评委独立复跑证实）：九探针判决逐条一致、149 行探索日志
   逐字节重现、面板 6 个 SHA-256 全中、预注册指纹 5669ffa3…3302 一致、law/oos 两轮 McNemar
   p=0.146/0.688 现场复现。
2. **v3 候选包全绿**：with-panel `ca9fc5d4…`（推荐）/ no-panel `73e4d11f…`，双变体过
   V1-V5 全部机器判据（红点 0/0），替换演练 V5 归零通过。
3. **多AI终审双 GO**（opus 真身 claude-opus-5 + sol gpt-5.6-sol），唯一阻断项
   （manifest 两本账）已机器化为 V5 判据。
4. **冷启动评审抓出 4 个提交阻断**：机械类已连夜修完（同目录解压说明/口径/参照系行/
   品牌标注/本机路径泄露）；口径类 5 件等作者本人拍板（涉及署名与披露，AI 不可代签）。

## 一、怎么判的（判据链，全部机器可复跑）

红点制：每个判据脚本退出码=红点数，0 才放行。同一把尺从 R0 用到收官。

| 判据 | 防什么 | 结果 |
|---|---|---|
| check-sprint.mjs | zip 内文档新鲜度（R0 抓到 00-对齐表 STALE=唯一真红点） | ✅ |
| check-panel.mjs | 面板诚实性：6/6 sha256 溯源、九判决串齐全、无软化词 | ✅ 0 红点 |
| check-v3.mjs | V1 哈希一致 / V2 九判决复跑==基线 / V3 面板变体语义 / V4 manifest | ✅ 0/0 |
| check-final.mjs (V5) | manifest==待传 zip 字节级一致（mutation 实证 3 红点→修后 0） | ✅ 演练归零 |
| pack-v3.py | 打包卫生断言：无 / 根条目、无 // 双斜杠、条目数、面板语义 | ✅ |

判据有效性自证：V1 曾因脚本 bug 全表报 MISMATCH（16 红点），修复后归零——尺子真的在量；
V5 在替换前恒红（3 红点）、替换后归零——被测行为变化时判据跟着变。

## 二、多AI会审编成与产出（R1-R2 全链）

| 角色 | 谁 | 产出 | 状态 |
|---|---|---|---|
| 规划 | sol (gpt-5.6-sol medium) | 执行序 7 步+放弃序 8 条+风险 3 条 | 全采纳 |
| 独立复核 | pi (@earendil-works, glm-5.3-flash) | 抓到重打包首版引入的 / 与 // 垃圾条目 | 立功（长工单×2 卡死，短差×2 一功） |
| 终审 | opus (claude-opus-5 实锤) | 双 GO；manifest 两本账 FAIL→V5 修法；no-panel=净损失裁决 | 已落地 |
| 终审 | sol | 双 GO；同判两本账 FAIL；上传后回执复核建议 | 已采纳 |
| 冷启动评委 | opus 真解包真复跑（$2.02） | 4 阻断+11 答辩风险+6 建议+正面清单 | 机械类已修，口径类待拍板 |

分歧裁决 1 例：no-panel 定位（sol=合规备选 vs opus=删面板=负结果最显眼载体消失，形态像藏）
→ 保守裁决取 opus，与「负结果原样入账不软化」红线同向 → **推荐 with-panel**。

## 三、冷启动评审抓到什么（为什么不放行）

最有讽刺意味的一条：**「检验别人敢不敢说没有」的作品，被自己的检验流程抓了现行**——
评委只解代码包时，旗舰判据 `verify-power-control.mjs` P1.3 找不到 `logs/run-agent.log`
（日志在非代码包），自己 exit 2。这正是本作品的主题现象：工具对「自己的操作化前提」失明。

**已修（机械类，纯事实/路径/口径错误）**：
- README+02 增「两包解到同一目录」说明（P1.3 路径语义写透）
- 「200 次探索」→「网格搜索 130 条候选规律（--runs=200 为上限）」（00/README/02 三处对齐日志实测 130）
- 面板：Node≥18→≥20；复判命令块改双布局真实路径；删「重新运行 build-panel.mjs 可重新出数」
  （生成器不随包，承诺不可兑付+泄露本机路径）；补参照系行（复赛必交③此前在面板 0 出现）；
  meta 行标注「取象=作品内部代号」防品牌混淆

**待作者拍板（口径类，按诚实声明纪律必须本人过目）**：
1. A2：05/06 含「由 Sonnet 撰写，需作者本人过目确认后方可对外提交」vs README「正文文字由人类完成」
   ——两口径冲突，只有作者过目后才能翻正
2. A3：03-增量正文核对表是内部改写指令稿，随包=递弹药，建议移出 zip（文件保留不删）
3. A4：API 披露四处口径不一（05 零收费 vs 04 实费 $0.10/天额度 vs 00 折中 vs 02 收窄），
   建议统一采 04 实费版（诚实且可查）
4. B5：OTS 时间锚「21 锚 14 进块」无 .ots 实物随包，补文件或改弱表述
5. B9：04 末尾残留「前 30」旧口径（官方 Top 20）

## 四、答辩防线（若 9/10 进 Top 20）

争议答辩卡 5 张已备（本文仓外协作文档 `争议答辩卡-草案.md`）：五/九学科差异、11364 倍口径差、
三条 exit 2、Agent 由谁跑、面板数字来源。每卡=一句话结论+证据链+「评委 30 秒自验」路径。

## 五、复算命令

```bash
# 判据链（Node ≥20，零依赖）
node D:/tmp/quxiang-longtask/_tools/check-panel.mjs     # 面板诚实性
node D:/tmp/quxiang-longtask/_tools/check-v3.mjs        # 双变体全量
node D:/tmp/quxiang-longtask/_tools/check-final.mjs with-panel   # 替换后终局

# 事件链（9 轮全记录）
cat D:/tmp/quxiang-longtask/events.jsonl
```

## 附录：产物索引

- 双变体候选：`D:\tmp\quxiang-longtask\artifacts\repack-v3\{with-panel,no-panel}\`
- 定案报告/动作单/答辩卡：`D:\tmp\quxiang-longtask\branches\`
- 会审原始产物：`D:\tmp\quxiang-longtask\gates\`（sol-plan-r1 / opus-final / sol-final / opus-coldjudge）
- 判据脚本：`D:\tmp\quxiang-longtask\_tools\`（与协作文档仓 05-台账/frontier-track/sprint-20260903/ 同步存档）

## 附录补：pi 独立核验记录（2026-09-03 凌晨）

pi (glm-5.3-flash) 对 tag `goai-round2-20260902` 的独立核验：九个探针目录顶层 verify-*.mjs
**九行全部为「有」**，`trend-probe/scale/result.json` 在 tag 树中存在（历史 commit 留下，
d0df8e2 快照未改动）。这从公开仓角度证实了披露节的核心主张：tag 内判据脚本齐全，
README 曾滞后只是文字问题。核验记录：任务包 gates/pi-tag-recon.txt。
