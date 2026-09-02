# 策略接口协议 v0.1

`proposer.mjs` 的量程阶梯默认跑四条内置策略（`random` / `always-filled` /
`always-empty` / `oracle`）加上枚举网格。任何外部进程都可以按下面这个协议
接进来当第五条策略——**接 LLM 是换一条策略，不是改环境。**

## 为什么要有这份协议

「人扮演 agent」不是本环境的缺陷，是它的第一条策略（policy #0）。
但如果只有人能进来，「策略可插拔」就只是一句声称。这份协议把它变成
一件能被外人现场验证的事：拿你自己的模型、自己的规则引擎、甚至一个
一行 shell 脚本，接上，跑一遍，看它落在量程阶梯的哪个位置。

## 调用方式

```bash
node proposer.mjs --policy=exec:"node examples/dumb-policy.mjs"
```

`exec:` 后面跟的是任意可执行命令（经 shell 展开），proposer.mjs 会：

1. 把 `law-cells.json` 里的格子（**去掉 `observed` 字段**——不能让策略偷看答案）
   打包成 `{ "cells": [...] }`，JSON 一次性写入子进程 **stdin**。
2. 等子进程退出。**必须退出码 0**，否则该策略在本轮记为失败，不进量程阶梯。
3. 从子进程 **stdout** 读取一个 JSON 对象 `{ "predictions": [bool, ...] }`，
   数组长度必须与输入 `cells` 完全一致、顺序一一对应。
4. 用现有的 `grade()`（准确率 + McNemar 精确检验 vs 平凡解）给这条策略打分，
   与内置四条策略并列打印。

超时 30 秒（`spawnSync` 的 `timeout` 选项），超时视为失败。

## 输入 cell 的字段

每个 cell 是：

```json
{ "a": "Li", "b": "Na", "sys": "Li-Na-O", "dq": 0, "ratio": 1.342, "note": "Li1+(0.76) / Na1+(1.02)" }
```

- `dq`：两阳离子最大氧化态差（整数，见 `law.mjs` 的 `differentiation()`）
- `ratio`：两阳离子 Shannon 半径比（≥1）
- `note`：人类可读的价态/半径注记
- **没有 `observed`**——这是策略要预测的东西，不是给它看的

## 输出

```json
{ "predictions": [true, false, true, ...] }
```

`true` = 该策略判该系统「存在有序三元相」；`false` = 判「空」。
长度、顺序必须与输入 `cells` 一致。

## 失败即诚实失败，不静默降级

- 退出码非 0 → 记为失败，proposer.mjs 打印错误摘要，不把这条策略塞进量程阶梯。
- stdout 不是合法 JSON，或 `predictions` 长度不对 → 同上。
- **没有「猜一个默认值凑数」这种兜底**——一个装死的失败比一个假装成功的降级更诚实。

## 一个最简单的示例策略（30 行内，零依赖）

```js
// examples/dumb-policy.mjs
let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const { cells } = JSON.parse(input);
  const predictions = cells.map(c => c.dq >= 1); // 随便一条规则
  process.stdout.write(JSON.stringify({ predictions }));
});
```

## 这条协议在评分里的位置

- 属于 `00-复赛四项对齐表.md` 第 1 项「最小可运行探索环境」——环境的反馈接口
  必须能被非作者的东西触发，光有作者自己跑过不算。
- 零商业 API、零第三方依赖——外挂策略走的是标准输入输出，本环境不绑定任何
  模型厂商或框架，评委可以拿自己的模型接进来跑，不需要改动 `proposer.mjs`。
