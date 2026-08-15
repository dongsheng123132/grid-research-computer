# 254 / 186 / “70%” 原始出处核查

status: verified

- 核查日期：2026-08-13
- 原始出处：Balachandran et al., “Predictions of new ABO3 perovskite compounds by combining machine learning and density functional theory,” *Physical Review Materials* 2, 043802 (2018)
- DOI：https://doi.org/10.1103/PhysRevMaterials.2.043802
- APS 接受稿：https://link.aps.org/accepted/10.1103/PhysRevMaterials.2.043802

## 结论

两个数字和基本口径成立，但原始出处不是 Bartel et al. 本身，而是 Bartel et al. 引用的 Balachandran et al. 2018。

- 总体：254 个实验数据库中的、已实验合成的 ABO3 钙钛矿；
- 命中：OQMD 把其中 186 个预测为距凸包不超过 100 meV/atom；
- 比例：186 / 254 = 73.23%，后来的 Bartel et al. 2019 将其约写为 70%；
- 口径：阈值包含凸包上的稳定相，也包含凸包上方 0–100 meV/atom 的亚稳相，不能简写成“186 个都在凸包上”。

## 原文证据

Balachandran et al. 摘要：

> “OQMD predicts 186 of 254 of the perovskites in the experimental database to be thermodynamically stable within 100 meV/atom of the convex hull.”

出处：接受稿第 2 页摘要。正文第 36 页进一步说明，把允许的 degree of metastability 从 0 提高到 100 meV/atom，使 OQMD 与已知化合物的一致率从 60% 提高到 70%。

Bartel et al., “New tolerance factor to predict the stability of perovskite oxides and halides,” *Science Advances* 5, eaav0693 (2019)，在正文引用该结果为 254 个已合成钙钛矿中 186 个（70%），其参考文献 27 指向 Balachandran et al.。

## 对草稿的处理建议

保留该句，但改成精确措辞并补 DOI：

> Balachandran 等对 254 个实验已合成的 ABO3 钙钛矿比较发现，OQMD 仅将 186 个（73.2%；后续文献约写 70%）置于凸包上或凸包上方 100 meV/atom 以内。
