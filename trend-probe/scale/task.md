# 任务：OpenAlex 口径敏感度 · 全总体普查（采数）

工作目录：`D:\uking编程\ShadowOS = Harness OS\demo\trend-probe\scale`
你只负责**采数**。规则（`PREREG.md`）和验收判据（`verify-trend-scale.mjs`）已经写死在这个目录里，
**都不许改**。先把 `PREREG.md` 从头读一遍，它是这个任务的唯一权威。

## 你要交付两个文件

### 1. `scale.mjs` —— 可重跑的采数脚本

Node ≥ 20，**零依赖**，只用内置 `fetch`。分两阶段：

**阶段 A：拉总体**
- `https://api.openalex.org/topics?per-page=200&cursor=*`，用 `cursor` 分页拉到耗尽。
- 第一页的 `meta.count` 记为 `declared_count`。
- 全部 topic 落 `topics.json`（字段只留 `id` 与 `display_name`）。
- **落盘条数必须等于 `declared_count`。不等就报错退出，不要继续。**

**阶段 B：逐个测三口径**

对每个 topic 的 `display_name`（记为 P），发三个请求，都带 `per-page=1`：

```
fulltext_loose        works?search=<urlencode(P)>&per-page=1
title_abstract_phrase works?filter=title_and_abstract.search:<urlencode('"'+P+'"')>&per-page=1
title_phrase          works?filter=title.search:<urlencode('"'+P+'"')>&per-page=1
```

取值一律是响应的 `meta.count`。

### 2. `result.json` —— 严格按下面这个形状

```json
{
  "spec": "trend-scale/0.1",
  "source": "OpenAlex",
  "prereg_sha256": "084a62b1bccb8641c6ef1404b8c76d616722a5776def636faeb421cfb0443828",
  "population": { "declared_count": 4516, "fetched_count": 4516 },
  "states":  { "measured": 0, "too_narrow": 0, "error": 0 },
  "stats":   { "ratio_median": 0, "ratio_p5": 0, "ratio_p95": 0,
               "pct_ratio_ge_1000": 0, "pct_ratio_lt_100": 0 },
  "prediction_outcomes": [
    {"id":"P1","claim":"ratio 中位数 ≥ 100","held":true,"observed":"中位 123.4"},
    {"id":"P2","claim":"…","held":false,"observed":"…"},
    {"id":"P3","claim":"…","held":true,"observed":"…"},
    {"id":"P4","claim":"…","held":true,"observed":"…"}
  ],
  "honest_bounds": "……（见下）",
  "rows": [
    { "topic_id":"https://openalex.org/T14423", "display_name":"Military Technology and Strategies",
      "state":"measured", "fulltext_loose":123456, "title_abstract_phrase":789, "title_phrase":123,
      "ratio": 1003.7 }
  ]
}
```

`declared_count` 与 `prereg_sha256` **照抄上面这两个值**，不要自己算、不要自己改。

## 硬规则（照 PREREG.md，违反即整轮作废）

1. **三态由数字决定，不由你决定**：
   - 三个数都拿到了 且 `title_phrase >= 10` → `"measured"`，并给出 `ratio = fulltext_loose / title_phrase`
   - 三个数都拿到了 但 `title_phrase < 10`（**含 0**）→ `"too_narrow"`，**不要写 `ratio` 字段**
   - 任一请求最终失败 → `"error"`，那三个数字字段写 `null`，**不要写 `ratio` 字段**
2. **`title_phrase == 0` 绝不许算成 measured，也绝不许算成"倍数无穷大"。** 这是这个任务的承重点。
3. **`stats` 只在 `measured` 的行上计算**，`too_narrow` 与 `error` 不进任何统计。
4. **一条 topic 都不许跳过、不许筛选、不许抽样。** `rows` 必须是 4516 条（或阶段 A 实际拿到的 `declared_count` 条）。
5. **数字必须是真请求回来的。不许估算、不许编造、不许"因为跑太久就抽一部分"。**
6. 分位数用线性插值（第 q 分位取 `sorted[(n-1)*q]` 两侧线性插值），百分比按 measured 条数算。
7. `honest_bounds` 写一段话，**必须提到**：topic 的 `display_name` 是 OpenAlex 编的标签，
   不必然是研究者真会输入的检索式，这是本轮外部效度的主要限制。
   **不许**出现「置信区间」「p <」这类抽样统计词——全总体普查没有抽样误差。
8. `prediction_outcomes` 四条照 PREREG.md「预测」那一节的 P1–P4 原样写，
   **如实填 `held`**。预测被推翻是正常结果，如实记账，**不许为了好看去改预测或改数据**。

## 工程要求（这个活会跑几小时，必须扛得住）

- **限速**：每个请求之间 sleep ≥ 120ms；所有 URL 都要带 `&mailto=HEFANGSHENG@gmail.com`（polite pool）。
- **429/5xx 退避重试**：最多 5 次，指数退避（1s/2s/4s/8s/16s），尊重 `Retry-After` 响应头。
  五次都失败才记为 `error`。**这一段是实测必需的，别省。**
- **断点续跑**：每个请求的响应缓存进 `cache.json`（键用完整 query string），
  每处理完 20 个 topic 落一次盘。脚本被 Ctrl-C 或断网后重跑，必须能从缓存继续，不重复请求。
- **进度**：往 stderr 打 `已完成 N/4516`，不要往 stdout 打噪音。
- 总请求量约 3 × 4516 ≈ 13,548 次，远低于 OpenAlex polite pool 的 10 万次/天，**不要为了省额度而缩减样本**。

## 验收（你说做完不算数）

跑完自己执行一次：

```
node verify-trend-scale.mjs
```

**退出码 0 才算做完。** 退出码 2 说明本轮结果作废，看它打 ✘ 的那几行，
修**你的脚本或数据**，**绝对不许改 `verify-trend-scale.mjs` 或 `PREREG.md` 来让它变绿**——
改判据让判据通过，是这个项目从第一天起就在抓的那个病。

注意：判据里 `S6.P1`–`S6.P4` 那四行标 `·` 是**只记账不影响判决**的，预测被推翻不算失败。

## 只准动这四个文件

`scale.mjs`、`result.json`、`topics.json`、`cache.json`。
目录里其他文件（`PREREG.md`、`verify-trend-scale.mjs`、`task.md`）一个字节都不许改。
也不要动这个目录以外的任何东西。

---

## ⚠ 执行方式修订（2026-08-24 03:15）

pi 在无 TTY 的后台模式下会静默退出且不写任何文件（实测：退出码 0、零输出、零产物）。
所以本任务**拆成两步**，你只做第一步：

**你只需要交付 `scale.mjs`，外加一次 20 条 topic 的冒烟自测。**

- `scale.mjs` 必须支持 `--limit N`（只处理前 N 个 topic，用于冒烟）与不带参数（全量）。
- 冒烟：`node scale.mjs --limit 20`，确认 `topics.json` 是全量 4516 条、
  `result.json` 的 rows 是 20 条、三态分类正确、`cache.json` 有断点续跑数据。
- 冒烟产生的 `result.json` **跑不过 `verify-trend-scale.mjs`**（S1.2 会因为 rows≠4516 而红），
  **这是预期的，不是失败**。冒烟只要确认脚本能跑通、数字是真的、断点续跑有效。
- 全量那一轮由调用方在后台跑，不用你等。
