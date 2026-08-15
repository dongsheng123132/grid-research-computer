# 文献检索结果：数据库无实验条目 → 判定为候选新化合物的假阴性率

调查问题：在「计算筛选新无机化合物」流水线的最后一步「交叉比对实验数据库（ICSD / Materials Project / COD / Pauling File），把查不到的组合当作尚未合成的新材料候选」中，**有多少论文量化报告了这一步本身的误判率**（假阴性率 / false-emptiness rate / 数据库覆盖率导致的误判）？

检索执行时间：2026-08-11（本机网络环境）。所有 DOI 均经 Crossref API 逐条核验（`api.crossref.org/works/{doi}`，返回 200 且标题一致者才收录）。全文 PDF 实际下载并通读 16 篇；其余依据 Crossref / Europe PMC 摘要或仅记录标题。

---

## 检索覆盖

### A. 必用检索式（5 条，逐条记录）

说明：Crossref `query.bibliographic` 的 total-results 是**模糊相关计数**（把每个词拆开在全库匹配，数千万量级；不含引号精确短语语义），**不能当作精确命中数**。实际查看 = 每式取 API 返回的前 20 条，逐条人工筛选。Semantic Scholar 有响应时 0 相关命中、之后 429；OpenAlex / arXiv / Google Scholar 在本机不可用（见下表），故以下 5 式均以 Crossref 为主要执行通道。

| 检索式 | 通道 | 返回条数（API 口径） | 实际查看 | 未查看原因 |
|---|---|---|---|---|
| `"no experimental entry" ICSD candidate new compounds screening` | Crossref | 7,549,385（模糊） | 20 | 仅查前 20；S2 429 限流 |
| `"not present in the ICSD" hypothetical compounds high-throughput` | Crossref | 4,049,772（模糊） | 20 | 同上 |
| `ICSD coverage completeness limitations inorganic crystal structure database` | Crossref | 3,112,602（模糊） | 20 | 同上 |
| `false negative synthesizability database absence "has not been synthesized"` | Crossref | 961,618（模糊） | 20 | 同上 |
| `materials discovery "unreported" compounds database cross-reference validation` | Crossref | 6,290,798（模糊） | 20 | 同上 |
| 以上 5 式 | Semantic Scholar | 0 相关命中 | 0 | 首批脚本中 6/7 式返回 0 命中、1 式返回 20 条医学无关结果（见留痕 s2-00~06.json）；随后请求全部 HTTP 429（共享 IP 被限流） |
| 以上 5 式 | arXiv API | — | 0 | export.arxiv.org 请求超时/空响应（http 与 https 均试） |
| 以上 5 式 | Google Scholar | — | 0 | 浏览器访问返回空页（反爬拦截） |
| 以上 5 式 | OpenAlex | — | 0 | HTTP 429：`"Insufficient budget... Resets at midnight UTC"`（免费配额当日耗尽） |

### B. 增补检索（全部经 Crossref，每式查看前 12–20 条）

| 检索式 | 返回条数（模糊） | 实际查看 |
|---|---|---|
| `ICSD completeness coverage experimental compounds database` | 2,782,038 | 20 |
| `"not in the ICSD" synthesis prediction machine learning` | 5,390,564 | 20 |
| `Materials Project coverage completeness experimental compounds` | 6,472,048 | 20 |
| `false negative rate materials database coverage screening` | 5,162,390 | 20 |
| `high-throughput screening "no experimental entry" candidate materials` | 8,627,448 | 20 |
| `"has not been synthesized" database absence negative labels synthesizability` | 920,004 | 20 |
| `"absent from the ICSD" compounds` | 9,442,794 | 20 |
| `"not in the ICSD" OR "not in ICSD" hypothetical` | 11,534 | 20 |
| `ICSD "has not been reported" screening` | 695,464 | 20 |
| `"database coverage" inorganic compounds "false negative"` | 1,675,762 | 20 |
| `synthesizability prediction "ICSD" negative samples` | 1,229,993 | 20 |
| `"Materials Project" "not in the ICSD"` | 4,032,107 | 20 |
| `"no experimental record" OR "no experimental data" new compounds DFT` | 10,215,513 | 20 |
| `unreported compounds high-throughput screening experiment` | 4,412,914 | 20 |
| `ICSD completeness percentage compounds missing` | 767,885 | 20 |
| `materials databases comparison coverage ICSD Materials Project OQMD` | 5,243,922 | 20 |
| `chemical space "never been synthesized" compounds database` | 4,524,459 | 20 |
| `literature mining synthesis "not in the ICSD"` | 3,590,190 | 20 |
| `crystallography open database COD completeness coverage` | 1,503,573 | 15 |
| `Pauling File database coverage completeness` | 461,995 | 15 |
| `"Crystallography Open Database" coverage inorganic structures` | 2,682,949 | 15 |
| `COD "not found" new compounds screening crystallography` | 5,856,366 | 15 |
| `"hidden positives" synthesizability materials` | 3,600,977 | 12 |
| `synthesizability "false negative" "ICSD"` | 375,289 | 12 |
| `"unreported" materials "not in the ICSD" synthesis` | 5,245,959 | 12 |
| `"database completeness" inorganic "not synthesized"` | 667,465 | 12 |
| `"ICSD" "coverage" percentage compounds missing screening` | 1,253,981 | 12 |
| `"never been reported" compounds high-throughput candidates` | 4,018,344 | 12 |
| `"absence of" "experimental data" "new compounds" screening database` | 10,540,947 | 12 |
| `"not experimentally" known compounds database screening candidate` | 1,461,647 | 12 |
| 标题检索 `completeness inorganic crystal structure database` 等 4 式 | 各取前 8 | 8 |

### C. 已知论文的 DOI 直接核验

- Crossref 精确 DOI 查询 47 个候选 → 43 个核验通过；4 个凭记忆写错的 DOI 用标题检索修正（Kim 合成规划实为 JCIM 2020 `10.1021/acs.jcim.9b00995` 而非 JACS；Jensen 沸石实为 ACS Cent. Sci. `10.1021/acscentsci.9b00193`；Kim 文本挖掘实为 `10.1021/acs.chemmater.7b03500`；Gautier 实为 Nat. Chem. `10.1038/nchem.2207`）。
- Unpaywall 批量查询 43 个 DOI → 26 个有 OA 位置；据此下载全文。
- 全文实际下载并通读 16 篇（Nature 系 6、Research Square 2、OSTI 3、Europe PMC 3、arXiv 1、UCL 1；IUCr/RSC/ACS/Zenodo/Elsevier 被反爬或付费墙挡为 0）。

### D. 明知存在但未读的

- **付费墙/反爬未获取全文**：IUCr（Zagorac 2019、ICSD 百年综述 2026、COD 论文——Cloudflare 质询循环）、ACS（Heusler 2016、Kim 2020、Jang 2021、MXene 2019、Jang 2024 Matter）、RSC（SynCoTrain、TSDNN、MatFold——Cloudflare）、Elsevier/ScienceDirect（磷光体 2019、CPC 2025 等）、AIP（Jain 2013 已从 OSTI 补到）、Cell Press（Jang 2024 Matter）、Springer（Saal 2013 JOM、Hellenbrandt 2004）、APS（Meredig 2014，OSTI 无全文）。这些论文按摘要或上下文归类，标 `未验证` 的条目见「我不确定的」。
- **语言**：检索限于英文文献；中文期刊文献未检索（本问题文献基本为英文）。
- **Google Scholar 引文网络**未展开（被反爬拦截）；Semantic Scholar 引用网络未展开（429）。

---

## 论文清单

### 主表：使用「数据库无实验条目 → 候选/负样本」这一步的论文（30 篇）

| # | DOI | 真实标题 | 年份 | 用了「数据库无条目→候选」这一步? | reports_rate | 若 yes：数字与出处 |
|---|---|---|---|---|---|---|
| 1 | 10.1038/npjcompumats.2015.10 | The Open Quantum Materials Database (OQMD): assessing the accuracy of DFT formation energies | 2015 | 是（"All the 3,231 compounds that we predict to be stable, but are not in the ICSD, represent new compounds to be discovered"） | no | —（全文已读；仅承认原型结构"do not represent an exhaustive crystal structure determination"，未量化假阴性） |
| 2 | 10.1007/s11837-013-0755-4 | Materials Design and Discovery with High-Throughput Density Functional Theory: The Open Quantum Materials Database (OQMD) | 2013 | 是（同 OQMD 管线） | no | —（全文未获取；按 #1 同类方法归列） |
| 3 | 10.1103/physrevb.89.094104 | Combinatorial screening for new materials in unconstrained composition space with machine learning | 2014 | 是（推定：ML 负样本=不在 ICSD 的组合；全文未获取） | no | —（未验证，见不确定清单） |
| 4 | 10.1021/acs.chemmater.6b02724 | High-Throughput Machine-Learning-Driven Synthesis of Full-Heusler Compounds | 2016 | 是（ICSD 缺失组合为候选，实验合成验证） | no | —（全文未获取） |
| 5 | 10.1038/nchem.2207 | Prediction and accelerated laboratory discovery of previously unknown 18-electron ABX compounds | 2015 | 是（400 个未报道 ABX 成员筛选→54 稳定→15 个实验室合成） | no | —（摘要：量化了已知/未知规模"only 83 out of 483 … have been made"，但未量化该步骤假阴性率） |
| 6 | 10.1021/acs.jcim.9b00995 | Inorganic Materials Synthesis Planning with Literature-Trained Neural Networks | 2020 | 部分/变体（文献挖掘合成条件；负样本方案全文未确认） | no | —（未验证） |
| 7 | 10.1016/j.matt.2024.05.002 | Synthesizability of materials stoichiometry using semi-supervised learning | 2024 | 是（ICSD 条目=正样本，其余=未标记；stoi-CGNF 方法源头，npj 2026 称之为"reference study"） | no（未验证） | —（付费墙；若其正文含 8.8% 估计的原始版本，需核原文） |
| 8 | 10.1038/s41524-026-02092-z | Closed-loop workflow of high-entropy materials discovery: efficient and accurate synthesizability prediction | 2026 | 是（352,236 个未报道组成→PU 学习，明确拒绝"把所有未报道数据当不可合成"） | **yes** | **~8.8%（31,009/352,092）未报道组成被模型判定为潜在隐藏正样本并剔出负集。原文：*"Out of 352,092 unlabeled compositions, 31,009 (approximately 8.8%) exceeded this threshold and were excluded from the negative set to prevent false-negative supervision."* — Methods「Data curation via PU learning with stoi-CGNF」段（npj Comput. Mater. 12, 221 (2026)）** |
| 9 | 10.1039/d2dd00098a | Materials synthesizability and stability prediction using a semi-supervised teacher-student dual neural network | 2023 | 是（利用大量未标记样本） | no | —（摘要未见量化） |
| 10 | 10.1039/d4dd00394b | SynCoTrain: a dual classifier PU-learning framework for synthesizability prediction | 2025 | 是（PU 学习） | no | —（摘要未见量化） |
| 11 | 10.1016/j.cpc.2024.109465 | Crystal synthesizability prediction using contrastive positive unlabeled learning | 2025 | 是（PU 学习） | no（未验证） | —（摘要不可得，Elsevier 付费墙） |
| 12 | 10.1021/jacs.0c07384 | Structure-Based Synthesizability Prediction of Crystals Using Partially Supervised Learning | 2020 | 是（部分监督；ICSD 正样本） | no | —（摘要讨论"热力学稳定性"方法的缺陷，未见该步误判量化） |
| 13 | 10.1021/acsnano.8b08014 | Prediction of Synthesis of 2D Metal Carbides and Nitrides (MXenes) and Their Precursors with Positive and Unlabeled Learning | 2019 | 是（PU 学习；预测未合成 MXene） | no（未验证） | —（摘要无量化；全文付费墙） |
| 14 | 10.1038/s41524-023-01193-3 | Candidate ferroelectrics via ab initio high-throughput screening of polar materials | 2024 | 是（50 个不在 ICSD 的候选→可合成性 ML 模型→19 个可能可合成；并用 Scopus/Google Scholar 逐候选回查文献） | no | —（全文已读；做了文献回查（LP/R/S 列）但没有汇总成该步的假阴性比率） |
| 15 | 10.1021/acs.chemmater.9b00116 | High-throughput Computational Study of Halide Double Perovskite Inorganic Compounds | 2019 | 是（ICSD 结构地图筛选 1980→40 个 "have not been synthesized to our knowledge"） | no | —（全文已读；"to our knowledge"式断言，未量化） |
| 16 | 10.1016/j.jallcom.2018.09.370 | Identification of a narrow band red light-emitting phosphor using computational screening of ICSD: Its synthesis and characterization | 2019 | 是（ICSD 计算筛选→合成新荧光粉） | no（未验证） | —（摘要不可得，ScienceDirect 付费墙） |
| 17 | 10.1016/j.ssi.2012.02.014 | Screening of the alkali-metal ion containing materials from the Inorganic Crystal Structure Database (ICSD) for energy storage applications | 2012 | 是（ICSD 筛选） | no（未验证） | —（摘要不可得） |
| 18 | 10.1016/j.jssc.2019.121045 | Surveying polar materials in the Inorganic Crystal Structure Database to identify emerging structure types | 2020 | 是（ICSD 普查） | no（未验证） | —（摘要不可得） |
| 19 | 10.1021/acs.chemmater.2c03540 | Ferroaxial Transitions in Glaserite-type Compounds: Database Screening, Phonon Calculations, and Experimental Investigation | 2023 | 是（数据库筛选+实验） | no（未验证） | —（摘要不可得） |
| 20 | 10.1021/acs.chemmater.3c01323 | Screening New Quaternary Semiconductor Heusler Compounds By Machine-Learning Methods | 2023 | 是（ML 筛选新 Heusler 候选） | no（未验证） | —（摘要不可得） |
| 21 | 10.1021/acsami.0c15728 | Finding Optimal Mid-Infrared Nonlinear Optical Materials in Germanates by First-Principles High-Throughput Screening | 2020 | 是（HT 筛选→实验验证） | no（未验证） | —（摘要不可得） |
| 22 | 10.1021/acsami.9b23297 | Screening Promising Thermoelectric Materials in Binary Chalcogenides through High-Throughput Computations | 2020 | 是（HT 筛选） | no（未验证） | —（摘要不可得） |
| 23 | 10.1021/acs.jpcc.1c06843 | High-Throughput Screening of Quaternary Compounds and New Insights for Excellent Thermoelectric Performance | 2021 | 是（HT 筛选） | no（未验证） | —（摘要不可得） |
| 24 | 10.1021/acsami.4c18556 | High-Throughput Screening of 6858 Compounds for Zinc-Ion Battery Cathodes via Hybrid Machine Learning Optimization | 2025 | 是（HT 筛选） | no（未验证） | —（摘要不可得） |
| 25 | 10.1021/acs.jpclett.9b00136 | Necessity of Heteroatoms for Realizing Hypothetical Aluminophosphate Zeolites: A High-Throughput Computational Prediction | 2019 | 是（84,292 个假设结构筛选→实验合成 2 个 JU-60/JU-61） | no | —（全文已读；假设结构按构造即"不在库"，与"已合成但漏录"方向相反） |
| 26 | 10.26434/chemrxiv.7770758.v1 | High-Throughput Assessment of Hypothetical Zeolite Materials for Their Synthesizability and Industrial Deployment | 2019 | 是（假设沸石库筛选） | no（未验证） | —（ChemRxiv 预印本被反爬挡） |
| 27 | 10.1021/acscentsci.9b00193 | A Machine Learning Approach to Zeolite Synthesis Enabled by Automatic Literature Data Extraction | 2019 | 变体（负样本=文献中明确失败的合成记录，非数据库缺失） | no | —（全文已读："currently only 245 zeolites have been synthesized"等为背景计数，非该步假阴性率） |
| 28 | 10.1038/s43246-021-00219-x | Predicting synthesizability of crystalline materials via deep learning | 2021 | 是（COD 缺失→生成"异常/负"样本） | no | —（全文已读；明确讨论"unobserved crystals … can be either crystal anomalies or synthesizable crystals that have not been explored yet"，但未给比率） |
| 29 | 10.1021/acsomega.2c04856 | Predicting Synthesizability using Machine Learning on Databases of Existing Inorganic Materials | 2023 | 是（MP 中无 ICSD 标签=不可合成标签"0"） | **yes** | **见下：4 个数字，全部在正文 pp. 8214–8215** |
| 30 | 10.1038/s41586-023-06786-y | Disordered enthalpy–entropy descriptor for high-entropy ceramics discovery | 2024 | 是（报道/未报道分类） | no（未验证） | —（摘要无量化；全文付费墙） |

**#29（ACS Omega 2023, 8, 8210–8218）的量化出处（逐字摘录）：**
- p. 8214：*"the test achieved 91.2% recall; however, the precision is as low as 31.73%. The high false positive rate (FPR) of 55.2% indicates that our model predicted a large amount of database tag '0' materials to be synthesizable. This is possibly due to what the '0' synthesizability tag in the MP database means: it does not mean that the material is not synthesizable; it just means that it does not have an ICSD tag."*
- p. 8214：*"in 15582 pre-2015 training materials, 8660 entries have an ICSD tag and 6922 entries do not"*（标签池构成：44.4% 无 ICSD 标签）
- p. 8214：*"we would also expect a correction in reality with higher-than-expected false negative rates (because some of the actual '0's could be '1's as they might, in reality, be synthesizable)"*
- p. 8215（Fig. 4）：*"Four materials with a negative tag (no ICSD ID) in the MP database are confirmed to be synthesizable or to be stable in DFT calculations. (a) Cs2AgSbBr6, (b) BaHfO3, and (c) Cs2InAgCl6 are synthesized and reported in the literature."* —— 抽样的 4 个「数据库无条目」材料中 3 个实际已被合成。

### 附表：不直接使用该步、但量化了数据库覆盖率/组成事实的论文（12 篇，供交叉参考）

| # | DOI | 真实标题 | 年份 | 量化了什么 |
|---|---|---|---|---|
| S1 | 10.1126/sciadv.1600225 | The thermodynamic scale of inorganic crystalline metastability | 2016 | 全文已读。**~20% 的 ICSD 条目是未观测的假设/理论结构**（"they compose approximately 20% of the ICSD"）；并对观察（ICSD 内）与未观察（假设生成）相的能量尺度做了定量比较——能量上大量未入库化合物与已合成化合物不可区分 |
| S2 | 10.1063/1.4812323 | Commentary: The Materials Project: A materials genome approach to accelerating materials innovation | 2013 | 全文已读。MP 数据"the vast majority … are for compounds in the ICSD"；无覆盖率数字 |
| S3 | 10.1107/s160057671900997x | Recent developments in the Inorganic Crystal Structure Database: theoretical crystal structure data and related features | 2019 | 摘要（IUCr Cloudflare 挡）。ICSD 自某版本起收录理论结构数据——"in ICSD" 不再等同「实验确定」（未获全文确认具体百分比） |
| S4 | 10.1107/s2052520626007079 | A century of structures: historical fidelity and computational fitness in the Inorganic Crystal Structure Database (ICSD) | 2026 | 摘要（IUCr Cloudflare 挡）。对 464 个 1913–1929 年 ICSD 条目做质量审计（键价和/晶格能、拓扑错误如 BeO-in-NaCl、SnTe-in-zinc-blende）——数据库条目自身有错误率，非覆盖率 |
| S5 | 10.1080/08893110410001664882 | The Inorganic Crystal Structure Database (ICSD)—Present and Future | 2004 | 摘要不可得（付费墙） |
| S6 | 10.1107/s0108768102006948 | New developments in the Inorganic Crystal Structure Database (ICSD): accessibility in support of materials research and design | 2002 | 摘要（部分） |
| S7 | 10.1107/s0021889809016690 | Crystallography Open Database – an open-access collection of crystal structures | 2009 | 摘要不可得（IUCr Cloudflare 挡） |
| S8 | 10.1103/physrevmaterials.7.053805 | Quantifying uncertainty in high-throughput density functional theory: A comparison of AFLOW, Materials Project, and OQMD | 2023 | 全文已读。三库间性质一致性（formation energy 相关系数 ~0.99），性质层面而非覆盖层面 |
| S9 | 10.1039/d4dd00250d | MatFold: systematic insights into materials discovery models' performance through standardized cross-validation | 2025 | 摘要。CV 切分基准，涉及"新材料"标签噪声但未见该步误判率 |
| S10 | 10.1016/j.commatsci.2012.02.005 | AFLOW: An automatic framework for high-throughput materials discovery | 2012 | 全文已读。HT 框架描述，未量化 |
| S11 | 10.1038/npjcompumats.2016.28 | A general-purpose machine learning framework for predicting properties of inorganic materials | 2016 | 全文已读。ICSD 衍生训练集，未量化 |
| S12 | 10.21203/rs.3.rs-9507801/v1 | The Stability-Completeness Theorem: Fundamental Limits of Materials Informatics – An Empirical Analysis of 103,644 Materials from the Materials Project | 2026 | 全文已读（Research Square 预印本，单作者）。量化 MP 组成：60.3% 理论预测数据 / 39.7% DFT；"完整性"指条目有效性而非实验覆盖率——与本问题同向但不直接 |

（另：检索中发现的 COD 验证论文 `10.1107/s1600576720016532`（Validation of the Crystallography Open Database using the Crystallographic Information Framework）与 1996 年 Acta Cryst 短文「Databases and prediction of new inorganic compounds」（`10.1107/s0108767396077185`）因 IUCr 反爬未读，列入不确定清单。）

---

## 结论

**30 篇使用「数据库无实验条目 → 判定为候选新化合物」这一步的论文中，有 2 篇量化报告了该步骤的假阴性/标签不可靠性**：npj Computational Materials 2026（`10.1038/s41524-026-02092-z`）估计未报道数据中约 8.8%（31,009/352,092）为潜在隐藏正样本；ACS Omega 2023（`10.1021/acsomega.2c04856`）实测无 ICSD 标签样本的分类器 FPR 达 55.2%（post-2015 测试集），并实证 4 个抽样「无条目」材料中 3 个实际已被文献报道合成。

限定说明：这两篇都不是「把数据库缺失与全部文献/专利系统比对后给出完整假阴性率」的直接测量——npj 2026 是模型置信度估计（8.8% 是"被模型判为隐藏正样本"的比例），ACS Omega 2023 是标签不可靠的代理指标 + 小样本实证。**严格意义上的全量实测该步假阴性率的论文，本次检索未找到（0 篇）**；最接近的间接量化是 Sun et al. 2016（`10.1126/sciadv.1600225`）给出的"~20% ICSD 条目为理论结构"（反方向的库内≠实验）。其余 28 篇均以「不在库 = 未合成」为工作假设，只做定性提醒（如 OQMD、铁电筛选、双钙钛矿、COD 异常样本、Jang 2024 半监督系列）或完全不提该误差。

---

## 我不确定的

1. **10.1103/physrevb.89.094104（Meredig 2014）**：全文/摘要均未获取（APS 403、OSTI 无全文）。"用不在 ICSD 的组合做 ML 负样本"是我对该论文的既有认知推定，**未在本会话核实**。`uses_step=是（推定）`，`reports_rate=no（未验证）`。
2. **10.1016/j.matt.2024.05.002（Jang 2024, Matter 7, 2294–2312）**：付费墙，摘要/全文均未读。npj 2026 称其为"reference study"（0.741 置信阈值出处），8.8% 方法学可能源自此文——若其正文已报告该比例，则"量化论文"应为 3 篇。**需人工核原文**。
3. **10.1021/acs.chemmater.6b02724（Oliynyk 2016 Heusler）**、**10.1021/acsnano.8b08014（MXene PU）**、**10.1021/acs.jcim.9b00995（Kim 2020）**、**10.1021/jacs.0c07384（Jang 2021）**、**10.1016/j.cpc.2024.109465（对比 PU）**：ACS/Elsevier 付费墙，仅摘要级证据（部分摘要经 Europe PMC 获取）。这些 PU/半监督论文的正文很可能讨论"未报道≈不可合成"的标签噪声（npj 2026 与 ACS Omega 2023 已验证该讨论的存在），但**我没有读到原文，不能确认其中是否含数字**。
4. **10.1016/j.jallcom.2018.09.370（磷光体）**、**10.1016/j.ssi.2012.02.014**、**10.1016/j.jssc.2019.121045**、**10.1021/acs.chemmater.2c03540**、**10.1021/acs.chemmater.3c01323**、**10.1021/acsami.0c15728**、**10.1021/acsami.9b23297**、**10.1021/acs.jpcc.1c06843**、**10.1021/acsami.4c18556**：均为经典「数据库筛选→候选」论文，但摘要被出版社墙挡住（Crossref 无摘要、Europe PMC 无收录），我只核验了 DOI/标题/年份。`uses_step=是`（按标题与方法学惯例），`reports_rate` 的 no 是"未见证据"而非"确认没有"。
5. **10.1039/d2dd00098a（TSDNN）**、**10.1039/d4dd00394b（SynCoTrain）**：RSC 反爬未获全文，仅摘要。半监督/PU 框架的正文讨论未读。
6. **10.1107/s160057671900997x（Zagorac 2019）**、**10.1107/s2052520626007079（ICSD 百年综述）**、**10.1107/s0021889809016690（COD 2009）**、**10.1107/s1600576720016532（COD 验证）**：IUCr 被 Cloudflare 质询循环拦截，只有摘要（百年综述摘要已含其主题=条目质量而非覆盖率）。Zagorac 2019 摘要明确提到 ICSD 收录理论结构数据，**其正文可能有理论条目占比数字，未获全文核实**。
7. **10.21203/rs.3.rs-9507801/v1（Stability-Completeness 预印本）**：Research Square 单作者预印本，同行评审状态不明；其"定理"证明较可疑（coupon-collector 论证），我把它当"存在且真实"的文献收录，不当权威结论引用。
8. **Google Scholar 完全未覆盖**（反爬空页）：GS 独有的引文网络检索（如"引用 Kim 2020 合成规划那篇的论文如何讨论该步"）未执行；这是本次检索的最大盲区，可能在 GS 里存在我未检索到的量化论文（例如非 Crossref 收录的会议论文、预印本）。
9. **Jang 2024 之外，另有 1 处方法学溯源缺口**：npj 2026 的 8.8% 与 ACS Omega 2023 的 55.2% 口径不同（前者=模型估计的隐藏正样本占比；后者=分类器对"无标签"类的 FPR），两者都**不是**「已合成但数据库漏录」的直接测量。若你要的是后者的严格数字，结论应为：**公开文献中目前没有这样一篇论文，最接近的是以上两篇的间接估计**。

## 数据留痕

- 检索原始 JSON：`.goai/litsearch-raw/`（crossref-00~22.json 共 23 个、s2-00~06.json 共 7 个（多为空命中）、unpaywall.json、verified-dois.json、full-abstracts.json、_summary.json；OpenAlex 12 式全部 429，无文件）
- 全文文本：`.goai/litsearch-txt/`（26 个文件，其中 16 篇为真实全文；其余为被反爬拦截的 HTML 壳）
- 全文 PDF：`.goai/litsearch-pdfs/`
