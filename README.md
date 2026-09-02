# 格子科研计算机 · Grid Research Computer

**一台会拦住自己的科学发现仪器。**

AI 在科学数据里找空白时，把「数据库里没有」当成「世界上没有」，而仪器内部对此完全失明。
现有评测都在测答得准不准，**没有人测该说没有的时候敢不敢说没有**。

这个仓库是 GOAI 2026 · AI for Research 开放探索赛参赛作品的**可复跑代码部分**。

---

## 一条命令看懂全部主张

```bash
node gap-probe/verify-gap-probe.mjs
# 判决 13/16，退出码 2
```

**退出码 2 是正确结果，不是故障。**

第一轮探针在无机材料空间跑完，内部一切正常——286 次查询全部成功、零失败、控制全通过，
产出 50 个「从未被实验观测的三元系」候选。榜单第 3 名是 **Fe–Ni–Cr**：304/316 不锈钢的基体，
人类每年生产上千万吨。

代码、查询和数据库返回**都没错**。错的是操作化定义：把「数据库里恰好含这三种元素的条目数为 0」
当成「该系统从未被研究过」。不锈钢以固溶体和多组分合金存在，不会「恰好三元」。

于是加了一道闸门：12 个教科书级工业材料作为**阳性对照前置**，任一被判空，整轮退出码 2、
一个格子都不产出。现在它红了 3 条——**红是它在工作。**

---

## 九个学科，同一个操作化错误

> 2026-09-02 更正：本节此前写「五个学科」并称基因/化学缺判据脚本——那是旧状态。
> `d0df8e2`（tag `goai-round2-20260902`）已补齐九学科判据套件，本节随本次提交同步修正。

| 学科 | 目录 | 复跑命令 | 实跑结果 |
|---|---|---|---|
| 材料 | `gap-probe/` | `node gap-probe/verify-gap-probe.mjs` | 判决 13/16，**退出码 2**；12 个阳性对照红 3 |
| 天文 | `sky-probe/` | `node sky-probe/verify-sky-probe.mjs` | 判决 6/14，**退出码 2**；8/8 教科书天体被判「未编目」 |
| 组合 | `sidon-probe/` | `node sidon-probe/verify-sidon-probe.mjs` | **退出码 2**；输出全是合法 Sidon 集，却不如随机重启 |
| 基因 | `gene-probe/` | `node gene-probe/verify-gene-probe.mjs` | 8/8，**退出码 0** |
| 化学 | `chem-probe/` | `node chem-probe/verify-chem-probe.mjs` | 8/8，**退出码 0** |
| 文献连接 | `lbd-probe/` | `node lbd-probe/verify-lbd-probe.mjs` | 9/9，**退出码 0** |
| 趋势口径 | `trend-probe/` | `node trend-probe/verify-trend-probe.mjs` | 6/6，**退出码 0**；`scale/` 子集 30/30 |
| 文献复核 | `lit-recheck/` | `node lit-recheck/verify-lit-recheck.mjs` | 5/5，**退出码 0** |
| 领域测绘 | `field-map/` | `node field-map/verify-field-map.mjs` | 8/8，**退出码 0** |

复刻的是同一个操作化错误，不是同一段代码。

### 必须说清楚的口径

1. **九学科合计 44 条实跑判据全绿**（六学科）+ **材料/天文/组合三学科各自的阳性对照判死自己**（设计如此，退出码 2 不是故障）。**44 条全绿 ≠ 44 项科学发现**：除材料（gap-probe）与趋势口径（trend-probe/scale）外，其余学科目前是同一方法论的横向健壮性证据，不是独立科学发现，这条界线主动画出来。
2. **假空率不可外推。** 对照不是随机抽样，是特意挑的教科书级实体。
   3/12（材料）等数字只对各自那批对照成立。
3. **`sky-probe/probe.mjs` 会打印「假空率 = 90/93 = 96.8%」——不要引用这个数。**
   我们自己的事故记录已判它无效：查询串按构造全部取自别名，**分母是自己造的**。
   该学科可引用的是判据套件给的 8/8 击穿 + 退出码 2。

---

## 材料学科的完整四轮

```bash
node gap-probe/probe.mjs               # 12 金属 / 220 三元系 / 286 次查询 → 50 个候选
node gap-probe/verify-gap-probe.mjs    # 阳性对照 → 13/16，退出码 2，整轮作废
node gap-probe/probe2.mjs              # 16 阳离子 A–B–O / 120 格（116 可判定 + 4 记 UNKNOWN）
node gap-probe/law.mjs                 # 规律 vs 平凡解 + McNemar → p=0.146，不可区分
node gap-probe/oos.mjs                 # 样本外，预注册在先 → p=0.6875，稳定负结果
```

**四轮里没有一个正向材料发现活下来。** 科学结论为负，工程结论为正。

样本外预注册文件 `gap-probe/PREREG-oos.json`，指纹
`5669ffa37e96b95a7b4d96c719747d4538c20acdf615b947869268837ad33302`——
规则 Δq≥1、阈值 θ=0.995、新阳离子 K/Zr/Nb/La/Cd/Pb **全部在任何查询之前冻结**。

## 每一轮死于什么，下一轮就多一道闸门

| 这一轮死于什么 | 于是下一轮多了哪道闸门 |
|---|---|
| 阳性对照 Fe–Cr–Ni 被判空 | 阳性对照前置：任一被判空，一个格子都不产出 |
| 「解释掉空格」被误当成预测力 | 任何规律必须与平凡解做配对统计检验 |
| 半径特征是看过反例后才选的 | 规则、阈值与样本集合必须在任何查询之前冻结 |
| UNKNOWN 被并进「空」 | UNKNOWN / FAILED / NEGATIVE 严格分开，负结果登记为产出 |

**闸门集合本身是探索的产物**，不是设计之初就想好的。这台仪器在开发过程中拦下了它的作者十余次，
其中 4 次就发生在造它的过程中——**一个抓不住作者本人的验金石，凭什么指望它抓住别人。**

---

## 运行环境

Node.js，无第三方运行时依赖，**无 GPU**，普通笔记本分钟级。
全部原始 HTTP 返回已落盘缓存（`cache*.json`），**离线可复跑**，不依赖数据库当时的可用性。

**数据源**：COD、SIMBAD、Europe PMC、OpenAlex、mygene、PubChem。
**未使用**：ICSD / Pauling File / MPDS（付费墙）、OQMD（限流）。
这是环境边界，**不伪装成全世界**。

需要 OpenAlex API key 的两个脚本从 `.secrets/`（已 gitignore）或环境变量 `OPENALEX_API_KEY` 读取，
**密钥不写进源码**；没有 key 时走免费共享额度。

## 已知问题

- `gap-probe/REPORT2.md` 第 17 行写「假空率 12 个里 4 个」，**实跑是 3 个**。
  以 `node gap-probe/verify-gap-probe.mjs` 的判决行为准。
- `trend-probe/trend.mjs`（原始数据抓取脚本，非判据脚本）无 `.secrets/apikeys.env` 时会直接报错退出——
  这是刻意的：抓新数据必须显式配置 key，不允许静默用旧缓存冒充新查询。**评委复现不需要跑这个脚本**，
  `verify-trend-probe.mjs` 只读已落盘的 `result.json`，不依赖它。

## 许可证

[Apache-2.0](LICENSE)
