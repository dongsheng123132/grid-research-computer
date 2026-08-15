# audit4：4 篇「absent from the ICSD」论文审计

审计问题：**「某数据库里查不到 ⇒ 尚未合成」这个推断，错误率是多少？**
上一轮：npj Comput. Mater. 2024 的 19 个 absent-from-ICSD 化合物里 6 个（32%）在 COD 已有更早结构。
本轮：OpenAlex 精确短语 "absent from the ICSD" 全总体 5 篇中剩余的 4 篇。

**一句话结论：4 篇里没有一篇在把「数据库缺席」当「未合成」的硬证据用。两篇（npj 2023、JACS 2024）是诚实端，一篇（Crystals 2020）直接实证了 ICSD 收录有漏——已报道 20 多年的结构 ICSD 查不到。只有 EES 2021 是「沉默端」：说了 absent from ICSD，但没主动披露这个推断的局限。**

---

## 1. EES 2021 — Charting lattice thermal conductivity（10.1039/d1ee00442e，arXiv 2006.11712）

**A. 原话**（Section II，Table 1 说明）：
> "The shaded entries are new materials suggested by machine learning, which are absent from ICSD and will be discussed later."

Section III 另点名两个：
> "In contrast, **B4C3 is absent from ICSD**"；"we could hypothesize that **CsTlI3** would have a low κ, which is **also absent from the ICSD** and confirmed by our DFT calculations (Tab. 1)"

**B. 覆盖的化学式**：Table 1 共 11 行（已全抄），其中 **2 行 shaded（absent）**：CsTlI3、C3N4。正文另点名 B4C3（不在表中）。unshaded 9 行是 ICSD 里筛出的，不算。
shaded/unshaded 是拿 arXiv PDF 的 fill 矩形逐行判的（pymupdf get_drawings），不是猜的。

**C. 局限披露：否。** 全文没有「数据库缺席 ≠ 不存在」类表述。它把 absent from ICSD 当作「新材料」的认定条件，未披露 ICSD 漏收录的可能。

---

## 2. npj Comput. Mater. 2023 — SynthNN（10.1038/s41524-023-01114-4）

**A. 原话**（Introduction + Methods 各一次）：
> "It is important to note that some of these artificially-generated materials **could be synthesizable, but are absent from the ICSD database** or have yet to be synthesized."

**B. 覆盖的化学式：无。** 主张对象是 Synthesizability Dataset 里**人工生成的「未合成」负样本**（正例 53,594 个配方，负例按 1–20 系数采样生成）。论文不列出这些配方的清单——正文连一个具名化学式都没有。**这是「不点名的预测不可证伪」的直接实例。**

**C. 局限披露：是（诚实端）。**
> "Definitively labeling a material as unsynthesizable is potentially problematic since the ongoing development of synthetic methodologies may enable the synthesis of previously unsynthesizable materials."

注意：这篇的 absent-from-ICSD 是**训练数据免责声明**，不是「我们预测的新化合物不存在」的断言——它恰恰在承认负样本里可能混着其实可合成的材料。

---

## 3. JACS 2024 — Quaternary Cesium Chlorides（10.1021/jacs.4c10294）

**A. 原话**（Introduction + Methods）：
> "In this work, we selected the compounds that **did not have a matching ICSD entry** (by composition) at the time of the work as targets. **Absence in the ICSD implies the structure may not have been available** to the computational community for further exploration, and identifying compounds not in the ICSD is commonly considered a benchmark for experimental novelty."

**B. 覆盖的化学式**：Table 1「Quaternary Cs-Cl Targets Explored in the Present Study」**13 行全抄**，ICSD 列全为 N：
Cs2LiRhCl6, Cs2LiIrCl6, Cs3KCdCl6, Cs2NaDyCl6, Cs3NaCdCl6, Cs2LiCrCl6, Cs2KDyCl6, Cs3KSnCl6, CsK2TlCl6, Cs2LiTiCl6, Cs2LiVCl6, Cs2LiRuCl6, Cs2LiFeCl6

**C. 局限披露：是（诚实端标杆）。** 它不止披露，还主动做了 manual literature search：
> "Nevertheless, **literature has gaps in digitization and is ever-evolving, and there could be compounds not registered in the ICSD**; therefore, we further perform a manual search ... We found mentions of certain compositions such as **Cs2NaDyCl6** (as an elpasolite) and **Cs2LiCrCl6** (as a 2L-type perovskite) ... in reports from decades ago ... We found that **Cs2LiRuCl6** ... was reported recently, but an ICSD entry was not currently available to us."

也就是说：表里 13 个「ICSD 查不到」的目标里，它自己就查到至少 3 个文献里早就有报道——这正是「数据库缺席 ≠ 未合成」的现场证据，而且是论文自己提供的。

---

## 4. Crystals 2020 — Complex Disorder in Type-I Clathrates（10.3390/cryst10040298）

**A. 原话**（Results and Discussion）：
> "Structural data for type-I clathrates **Rb8Ga8Sn38 and Cs8Ga8Sn38 have been reported more than two decades ago; however, for inexplicable reasons, they are not retrievable from the ICSD database**. Another published work on the structural characterization of A8Ga8Sn38 is also absent from the ICSD database"

**B. 覆盖的化学式**（正文点名，非表格）：Rb8Ga8Sn38、Cs8Ga8Sn38（另泛指 A8Ga8Sn38）。

**C. 局限披露：是（最直接的实证）。** 这篇的整个缺席主张就是在说 **ICSD 收录有漏**：这些化合物 1998 年（Kröner, von Schnering, Nesper）就报道过、是单晶 XRD 精修的结构，ICSD 却查不到。它把缺席归因于数据库问题（"for inexplicable reasons"），而不是化合物不存在。

---

## 汇总

| 论文 | asserts_absence | named | 覆盖数量 | discloses_limitation | 端 |
|---|---|---|---|---|---|
| EES 2021 | yes | yes | 2 表内 + 1 正文（CsTlI3, C3N4, B4C3） | **no** | 沉默端 |
| npj 2023 | yes（训练数据免责） | **no** | 0（不点名） | yes | 诚实端 |
| JACS 2024 | yes | yes | 13（Table 1 全表） | yes | 诚实端（自查出 3 个文献已有） |
| Crystals 2020 | yes（反方向） | yes | 2 + 1 泛指 | yes | 实证端（ICSD 有漏） |

对照上一轮 npj 2024（32% 已在 COD）：本轮 4 篇里唯一不披露局限的 EES 2021，其 3 个 absent 化合物（CsTlI3、C3N4、B4C3）恰好是最值得拿去 COD 复核的对象——它是「沉默端」，正是错判率风险最高的一类。

## 覆盖说明（诚实交代）

- 论文 1：arXiv 2006.11712（任务指定）ar5iv HTML 全文 + arXiv PDF 交叉验证；未取 RSC 正式排版版。
- 论文 2：Nature gold OA HTML 全文；Table 1 为模型超参数表，非化合物清单。
- 论文 3：ACS 官网 Cloudflare 拦截 curl 与浏览器 → 改用 PMC11528441 BioC XML（同一出版版全文）；Table 1 从 XML 内嵌表格逐行提取。
- 论文 4：MDPI 原站 Akamai 拒绝 curl 与浏览器 → 用 Wayback Machine 2025-01-20 存档全文；未取 MDPI 在线补充材料（XLSX 结构数据，不影响三项结论）。
- 所有引文为原文逐字摘录；化学式来自表格 XML/HTML 逐行提取或正文直接点名，无凭记忆补写。
