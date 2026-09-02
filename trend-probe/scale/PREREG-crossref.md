# 检索口径敏感度：Crossref 跨语料复现——预注册

> 2026-09-02。本文件在向 Crossref 发出任何本轮数据查询之前写定。

## 问题与设计

本轮检验原实验的现象是否只依赖于一个数据库的检索实现。抽样框复用已冻结的 `../topics.json`：4516 个概念短语（SHA-256 `7df1bf6f2a819bbbc9c22483894188e61384bcb69b63f6ce8802a2b29b2b15c9`）。这些自然语言短语在 Crossref 中原样检索；它们不是本轮由 Crossref 结果反推出来的词表。

固定种子 `trend-scale-crossref-20260902`，以 topic `id` 字典序排序后，用 xmur3 + mulberry32 的 Fisher–Yates 洗牌，取前 **n=500**。每个短语仅比较 Crossref REST API 的两个计数（`rows=0`，只读取 `message.total-results`）：

- 宽松口径：`/works?query=<phrase>&rows=0&mailto=research@example.org`；Crossref 的多字段相关性检索。
- 标题口径：`/works?query.title=<phrase>&rows=0&mailto=research@example.org`；仅标题字段检索。

`ratio = query_total / query_title_total`。这不是两个数据库的同批文献逐篇对齐；是对另一个检索语料是否出现同类“宽松与标题口径计数显著分离”现象的复现。

## 预先固定的分类、执行与统计

- 两个请求的总数均为有限非负整数且标题数 >=10：`measured`，进入 ratio 统计。
- 标题数 <10（含 0）：`too_narrow`，不以无穷倍数或任何替代值计入 ratio。
- 任一最终查询失败、HTTP/JSON/计数无效：`query_failed`，不进入任何比例的分母或 ratio。
- 请求严格串行；每次 HTTP 请求起点相隔至少 1,000 ms。429 或 5xx、网络/超时错误最多重试 5 次，等待 `Retry-After`（若有效）或 1、2、4、8、16 秒指数退避。
- 目标为 500 条完整查询；如服务限制或运行中断，只报告已经完成的行和实际样本量，绝不补造或把失败行视作零命中。

在 `measured` 行上报告 ratio 的中位数、P5、P95、`ratio >=1000` 和 `<100` 的比例；在所有非失败完成行上报告 `too_narrow` 比例。比例同时报告普通 Wilson 95% CI（不把复用的 OpenAlex topic 表误作 Crossref 总体，因此不使用有限总体校正）。分位数不报区间。

## 预先固定的判据

P1：measured 的 ratio 中位数 >=100。

P2：measured 中 `ratio >=1000` 的比例 >=10%。

P3：`too_narrow` 占所有完成行的比例 <30%。

若 P1、P2 至少一项成立，则称为“在 Crossref 语料中观察到大幅口径敏感度的证据”；两项都不成立则不支持“巨大差异在该语料中同样可见”。P3 只描述短语作为标题检索式的可用性，并不改变 P1/P2 的结论。若完成行少于 100 或失败行超过已抽样行的 5%，仅作探索性报告，不作强复现判定。

## 诚实边界

`query` 和 `query.title` 是 Crossref 的产品语义，不能假定与 OpenAlex 的参数完全等价；尤其 `query.title` 是标题字段检索，API 不保证其为逐字短语匹配。本轮只比较公开 API 实际返回的计数后果。复用的 topic 名称也未必是研究者的自然检索式。结论不得写成“同一批文献换库后仍为同一倍数”。本轮绝不访问 OpenAlex API。
