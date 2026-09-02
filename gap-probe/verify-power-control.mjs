#!/usr/bin/env node
// verify-power-control.mjs — 功效对照判据 v0.1（第七类判据）
//
// 六类判据里，「阳性对照」防的是「空其实不空」，「反向用例」防的是
// 「考题恒绿」——两者都在防误判「有」。但没有任何一条防误判「无」：
// 如果这台仪器对任何输入都吐同一个「没打过平凡解」，前面十六条判据
// 全绿也测不出来，因为它们都不问「这个检验统计量本身有没有功效」。
//
// 这条判据挡的就是这类事故：一个环境如果对所有策略都判负，必须先
// 证明它*能够*判正（喂一个作弊的 oracle 进去，让它赢），才有资格说
// 「这次判负是关于规律的事实，不是仪器没量程」。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result-proposer.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result-proposer.json —— 先跑 node demo/gap-probe/proposer.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const ladder = r.ladder || [];
const byId = id => ladder.find(g => g.id === id);

// ── P1.1：功效对照。oracle 必须显著打赢平凡解 ───────────────────────────
{
  const oracle = byId('oracle');
  const ok = !!oracle && oracle.beatsBaseline && oracle.mcnemar.p < 0.05 && oracle.acc > (r.baselineAcc ?? 0);
  J('P1.1', 'oracle（作弊上界）必须显著打赢平凡解，否则本轮全部「不可区分」结论作废', ok,
    oracle ? `oracle acc=${(oracle.acc * 100).toFixed(1)}% p=${oracle.mcnemar.p.toFixed(4)}` : '量程阶梯里没有 oracle 策略');
}

// ── P1.2：下界对照。random 不得显著优于平凡解 ───────────────────────────
{
  const rnd = byId('random');
  const ok = !!rnd && !(rnd.beatsBaseline);
  J('P1.2', 'random（下界）不得显著优于平凡解——否则平凡解本身定义错了', ok,
    rnd ? `random acc=${(rnd.acc * 100).toFixed(1)}% p=${rnd.mcnemar.p.toFixed(4)}` : '量程阶梯里没有 random 策略');
}

// ── P1.3：探索日志完整性。日志行数须与候选条数对账 ──────────────────────
// 这份判据要在两种目录布局下都能跑：开发目录 demo/gap-probe/（日志在
// 平级的 SUBMIT-.../logs/ 下）与打包后的提交包 代码/（日志在上一级 logs/ 下）。
// 不写死一条路径，按存在与否依次尝试。
{
  const candidatePaths = [
    path.join(HERE, '..', 'SUBMIT-取象-复赛-20260903', 'logs', 'run-agent.log'), // 开发目录布局
    path.join(HERE, '..', 'logs', 'run-agent.log'),                              // 提交包 代码/ 布局
  ];
  const logPath = candidatePaths.find(p => fs.existsSync(p));
  const nCandidates = (r.candidates || []).length;
  if (!logPath) {
    J('P1.3', 'logs/run-agent.log 必须存在（至少一次完整探索日志）', false, `未在以下任一路径找到：${candidatePaths.join(' | ')}`);
  } else {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim().startsWith('{'));
    const ok = lines.length === nCandidates && nCandidates > 0;
    J('P1.3', '探索日志的候选条数须与 result-proposer.json 一致', ok,
      `日志 JSON 行数 ${lines.length}，result-proposer.json 候选数 ${nCandidates}`);
  }
}

// ── P1.4：多重比较诚实披露。若有候选「打赢」，必须带样本内污染警告 ──────
{
  const beaten = (r.candidates || []).filter(c => c.beatsBaseline);
  const hasWarning = typeof r.sampleInContaminationWarning === 'string' && r.sampleInContaminationWarning.length > 0;
  const ok = beaten.length === 0 || hasWarning;
  J('P1.4', '若有候选在样本内打赢平凡解，必须原样披露多重比较风险，不得当作发现', ok,
    beaten.length === 0 ? '本轮无候选打赢，此项天然满足'
      : (hasWarning ? `${beaten.length} 条打赢，已披露多重比较警告` : `❌ ${beaten.length} 条打赢但未披露警告——这会被读成隐瞒 p-hacking`));
}

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('功效对照判据 v0.1 —— demo/gap-probe\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(6)} ${j.desc}`);
  if (j.detail) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮功效对照未通过：仪器要么没有量程（oracle 也赢不了），要么诚实披露没做到。');
  console.log('这两者任一为真，前面所有「候选没打过平凡解」的结论都不能被信任地读成负结果。');
  process.exit(2);
}
process.exit(0);
