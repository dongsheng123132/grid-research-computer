# 结论摘要

**不支持“巨大差异在 Crossref 语料中同样可见”。** 本轮完整抽样的 P1、P2 均不成立；P3 成立，但它只说明标题口径在本样本中的可用性，不改变主结论。

## 执行与数据完整性

- 首次连通性探测：`https://api.crossref.org/works?rows=0` 返回 HTTP 200。
- 按 `PREREG-crossref.md` 的冻结抽样、口径、串行节奏和断点续采规则，`crossref-scale.mjs` 完成了 500 个 topic 的采集。
- 499 条完成且为 `measured`，0 条 `too_narrow`，1 条 `query_failed`（`Cancer-related gene regulation` 的两种查询均失败）。失败占抽样的 0.2%，低于预注册所述 5% 的探索性报告阈值；完成行也远超过 100 条。
- 原始可复核结果保存在同目录 `result-crossref.json`。本轮只访问 Crossref API，未访问 OpenAlex API。

## 预注册统计结果

`measured` 的 n = 499：

| 指标 | 结果 |
| --- | ---: |
| ratio 中位数 | 1.9384 |
| ratio P5 / P95 | 1.1195 / 7.1204 |
| `ratio >= 1000` | 0.00%（Wilson 95% CI：0.00%–0.76%） |
| `ratio < 100` | 100.00%（Wilson 95% CI：99.24%–100.00%） |
| `too_narrow`（完成行中） | 0.00%（Wilson 95% CI：0.00%–0.76%） |

## 判据检验

- P1（ratio 中位数 >=100）：**不成立**，实际为 1.9384。
- P2（`ratio >=1000` 的比例 >=10%）：**不成立**，实际为 0.00%。
- P3（`too_narrow` 占完成行 <30%）：**成立**，实际为 0.00%。

因此，依据预注册规则，P1/P2 至少一项成立的条件未满足；在这套 Crossref `query` 对 `query.title` 的 API 口径下，没有观察到原实验所称的大幅口径敏感度证据。

## 解释边界

这不是跨库逐篇文献对齐，也不能把 Crossref 的 `query` / `query.title` 产品语义当成 OpenAlex 参数的严格等价物。它只说明：对预先冻结的同一批概念短语，Crossref API 实际返回的两种计数口径并未呈现同样的巨大分离。该结果是一次跨语料的反向证据，不可外推为对所有数据库或所有检索式的普遍否定。
