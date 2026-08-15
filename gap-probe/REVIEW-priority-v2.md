# 「首次晶体结构」优先权审计 v2：人工复核

## 判决

**本轮作废，不得报告为 0/15 或 3/15。**

自动闸门完成了预注册要求的学科修正：OpenAlex `primary_topic.field.id` 仅取 Chemistry（16）与 Materials Science（25），用 cursor 完整遍历 1434 条；279 条可在标题或摘要字面复核短语，自动抽取器留下 15 条，COD 查询 0 条未决。

但人工复核发现，15 个 token 没有一个是“被声称首次结构的完整化学式”。自动产生的 3 个 PRIOR 候选全部是假阳性；因此最终可纳入且完成 COD 分类的唯一声明为 **0 条，小于预注册门槛 10 条**，触发 `void_if`。

这不是把结果改成更好看的 0，而是第二实例再次失败：学科过滤修掉了大部分生物医学污染，仍未解决“配合物标题中的反应物、配体片段、氧化态和缩写会被读成完整化学式”的测量错配。

## 三个 PRIOR 候选逐条复核

| 自动 token | 论文 | COD 最早年 | 复核判决 |
|---|---|---:|---|
| `NiBr2` | 10.1023/A:1007199330939（2001） | 1934 | **否决**。论文首次主张对象是 α-diimine nickel(II) complex / `[NiBrL2]Br·4CHCl3`；`NiBr2(DME)` 是反应物。早期 NiBr₂ 晶体不能推翻配合物的首次结构主张。 |
| `H2O` | 10.3390/cryst7120377（2017） | 1918 | **否决**。主张对象是无额外反离子的 iron(III) salicylate `Fe[(HSal)(Sal)(H2O)2]`；`H2O` 只是两个 aquo 配体。冰的早期结构无关。 |
| `NON` | 无 DOI，OpenAlex W2294653342（2009） | 1924 | **否决**。token 来自英文 `NON-HEME`，不是化学式；COD 将其误归一为 N₂O。 |

前两条的主张对象由论文标题/摘要直接复核：

- https://doi.org/10.1023/A:1007199330939
- https://doi.org/10.3390/cryst7120377

## 15 条全样本的公式同一性复核

| token | 自动类 | 复核 |
|---|---|---|
| `NiBr2` | PRIOR_CANDIDATE | 反应物，不是主张对象 |
| `H2O` | PRIOR_CANDIDATE | 配体片段，不是完整配合物 |
| `NON` | PRIOR_CANDIDATE | `NON-HEME` 英文词 |
| `CHN` | SINCE_OR_SAME_YEAR | HTML 碎片，只截到复杂配合物中的 `CHN` |
| `RuIIRuII` | UNKNOWN | `Ru(II)` 氧化态串联记法，不是完整化学式 |
| `HB8` | UNKNOWN | *Thermus thermophilus* 菌株编号 |
| `NH2` | UNKNOWN | PAMAM 端基片段；预印本版本 1 |
| `NCO` | UNKNOWN | 复杂 lithium phosphazene 中的官能团片段 |
| `RuNO` | UNKNOWN | `{RuNO}7` 电子结构类别/配位片段，不是完整配合物；原文 10.1021/acs.inorgchem.6b00719 给出的完整对象为 `[Ru(Me3[9]aneN3)(bpy)(NO)](BF4)2` |
| `CYP` | UNKNOWN | cytochrome P450 缩写 |
| `PF6` | UNKNOWN | 配合物的 counterion 片段 |
| `NH2` | UNKNOWN | PAMAM 端基片段；正式预印本记录 |
| `HB8` | UNKNOWN | *Thermus thermophilus* 菌株编号 |
| `FeIV` | UNKNOWN | `Fe(IV)` 氧化态记法 |
| `CUP` | UNKNOWN | chaperone–usher pathway 缩写 |

## 这轮真正测出了什么

1. `primary_topic` 学科过滤有效：旧轮的 UP1/NS5 直接事故没有再次进入 PRIOR。
2. “至少两个真实元素符号 + 黑名单”仍不足以识别复杂配合物标题里的**完整主张对象**。
3. 仅把 `NON/HB8/CYP/CUP` 加进黑名单属于看过数据后改规则，不能回头修 v2；若继续必须新建 v3 并重新盖章。
4. v3 更合理的方向不是继续堆黑名单，而是要求主张对象能映射到完整 CIF/CCDC/COD 化学式，或彻底换用 PDB 审结构生物学优先权。

原始自动结果见 `result-priority-v2.json`；该文件中的 `void:false` 只代表自动闸门阶段通过，最终判决以本复核为准。
