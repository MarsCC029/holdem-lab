import { bluffBreakEven, callEV, completionProbability, requiredEquity, riverRangeEquity } from './math';

export type CategoryId = 'outs' | 'potOdds' | 'callEV' | 'bluff' | 'sizing' | 'range';
export interface TrainingQuestion {
  id: string;
  category: CategoryId;
  title: string;
  prompt: string;
  answer: number;
  unit: '张' | '%' | '筹码';
  tolerance: number;
  formula: string;
  explanation: string;
  hero?: string[];
  board?: string[];
  range?: string[][];
}

export const categories: { id: CategoryId; name: string; english: string; description: string }[] = [
  { id: 'outs', name: '补牌与概率', english: 'Outs & Probability', description: '先数不重复的目标牌，再计算命中概率。' },
  { id: 'potOdds', name: '底池赔率', english: 'Pot Odds', description: '算清这次跟注需要多少最低权益。' },
  { id: 'callEV', name: '跟注期望值', english: 'Call EV', description: '给定权益与无后续下注，计算平均收益。' },
  { id: 'bluff', name: '诈唬盈亏平衡', english: 'Bluff Break-even', description: '零摊牌权益的诈唬，需要多少弃牌率？' },
  { id: 'sizing', name: '下注与最小加注', english: 'Sizing & Minimum Raise', description: '分清下注多少与加注到多少。' },
  { id: 'range', name: '范围与权益', english: 'Range & Equity', description: '面对明确范围，算出河牌分池权益。' },
];

const outsFixtures = [
  { title: '同花听牌', hero: ['Ah', 'Qh'], board: ['8h', '4h', '2c'], answer: 9, prompt: '下一张牌有多少张能让你凑成同花？只数完成同花，不保证最后获胜。', why: '已见 4 张红桃；13 − 4 = 9。' },
  { title: '两头顺听牌', hero: ['9s', '8d'], board: ['7c', '6h', 'Ks'], answer: 8, prompt: '下一张牌有多少张能让你凑成顺子？只数完成顺子。', why: '任意 5 或 T 都完成顺子，4 + 4 = 8。' },
  { title: '卡顺听牌', hero: ['As', 'Jd'], board: ['Qc', 'Th', '2s'], answer: 4, prompt: '下一张牌有多少张能让你凑成顺子？', why: '只有 K 完成 A-K-Q-J-T；共 4 张。' },
  { title: 'A234 的边缘听牌', hero: ['As', '2d'], board: ['3h', '4c', 'Ks'], answer: 4, prompt: '下一张牌有多少张能让你凑成顺子？A 在这里只能作为 1 使用。', why: '只有 5 完成 A-2-3-4-5。A234 不是 8 张补牌的两头顺。' },
  { title: '同花加卡顺', hero: ['Ah', 'Kh'], board: ['Qh', 'Jh', '2c'], answer: 12, prompt: '下一张牌有多少张能让你凑成同花或顺子？重叠的牌只算一次。', why: '9 张红桃 + 4 张 T − 重叠的 T♥ = 12。' },
  { title: '组合听牌去重', hero: ['9h', '8h'], board: ['7h', '6h', 'Kc'], answer: 15, prompt: '下一张牌有多少张能让你凑成同花或顺子？重叠的牌只算一次。', why: '9 张红桃 + 8 张顺子补牌 − 5♥、T♥ 两张重叠 = 15。' },
];

const questionsOuts: TrainingQuestion[] = outsFixtures.map((fixture, index) => ({
  id: `outs-${String(index + 1).padStart(2, '0')}`, category: 'outs', title: fixture.title,
  hero: fixture.hero, board: fixture.board, prompt: fixture.prompt, answer: fixture.answer,
  unit: '张', tolerance: 0, formula: fixture.why, explanation: '默认没有额外已知的弃牌或对手底牌。这里统计“完成牌型”的目标牌，并非面对任何对手都能赢的干净补牌。',
}));
for (const [index, fixture] of [
  { outs: 9, unseen: 47, cards: 1, title: '翻牌到转牌', detail: '翻牌时已见 5 张牌，未知 47 张。假设有 9 张指定目标牌；只看下一张。' },
  { outs: 8, unseen: 46, cards: 1, title: '转牌到河牌', detail: '转牌时已见 6 张牌，未知 46 张。假设有 8 张指定目标牌；只看河牌。' },
  { outs: 9, unseen: 47, cards: 2, title: '翻牌直到河牌', detail: '翻牌时未知 47 张，固定目标牌有 9 张。连续发两张，问至少命中一张的概率。' },
  { outs: 15, unseen: 47, cards: 2, title: '15 张目标牌的精确概率', detail: '翻牌时未知 47 张，固定目标牌有 15 张。连续发两张，问至少命中一张的概率。' },
].entries()) {
  const answer = completionProbability(fixture.outs, fixture.unseen, fixture.cards) * 100;
  questionsOuts.push({
    id: `outs-${String(index + 7).padStart(2, '0')}`, category: 'outs', title: fixture.title,
    prompt: `${fixture.detail} 填百分数（例如 25 表示 25%）。`, answer, unit: '%', tolerance: 1,
    formula: fixture.cards === 1 ? `${fixture.outs} ÷ ${fixture.unseen} × 100% = ${answer.toFixed(2)}%`
      : `1 − (${fixture.unseen - fixture.outs}/${fixture.unseen}) × (${fixture.unseen - fixture.outs - 1}/${fixture.unseen - 1}) = ${answer.toFixed(2)}%`,
    explanation: '这是固定目标牌命中概率，不是摊牌权益。两张都能免费看完时才能使用直到河牌的概率；若下一条街还要付钱，不能直接把两张概率用于这次跟注。2 与 4 法则仅供快速估算。',
  });
}

const potCases = [[100, 25], [150, 50], [200, 100], [300, 75], [80, 20], [120, 80], [450, 150], [900, 300], [60, 15], [240, 60]];
const questionsPot: TrainingQuestion[] = potCases.map(([pot, call], index) => ({
  id: `potOdds-${String(index + 1).padStart(2, '0')}`, category: 'potOdds', title: `跟 ${call}，争取多大的池？`,
  prompt: `轮到你时，底池共有 ${pot} 筹码，已包含对手刚下的注。你需要再跟 ${call}。假设无抽水、无边池、无后续下注，盈亏平衡的最低权益是多少？`,
  answer: requiredEquity(pot, call) * 100, unit: '%', tolerance: 1,
  formula: `${call} ÷ (${pot} + ${call}) × 100% = ${(requiredEquity(pot, call) * 100).toFixed(2)}%`,
  explanation: '分母是你跟注后的总底池。权益包含平局分池份额；多街实战还要考虑后续付费、可实现权益与对手范围。',
}));

const evCases = [[100, 25, 0.3], [150, 50, 0.2], [200, 100, 0.5], [300, 75, 0.2], [80, 20, 0.4], [120, 80, 0.25], [450, 150, 0.3], [900, 300, 0.5], [60, 15, 0.1], [240, 60, 0.25]];
const questionsEV: TrainingQuestion[] = evCases.map(([pot, call, equity], index) => ({
  id: `callEV-${String(index + 1).padStart(2, '0')}`, category: 'callEV', title: '这次跟注的 EV',
  prompt: `底池 ${pot}（已含对手下注），再跟 ${call}；题目给定你的摊牌权益为 ${equity * 100}%。无抽水、无边池、此后不再下注。相对现在弃牌，跟注的期望收益是多少筹码？负数请写负号。`,
  answer: callEV(equity, pot, call), unit: '筹码', tolerance: 1,
  formula: `${equity * 100}% × (${pot} + ${call}) − ${call} = ${callEV(equity, pot, call).toFixed(2)} 筹码`,
  explanation: '已经投入的筹码属于沉没成本。EV 衡量从当前决策开始的平均增量；正 EV 也不保证这一手会赢。这里的权益是题目给定条件，不是根据牌型猜出的胜率。',
}));

const bluffCases = [[100, 25], [100, 50], [100, 75], [100, 100], [100, 150], [200, 50], [240, 80], [300, 450], [80, 40], [120, 240]];
const questionsBluff: TrainingQuestion[] = bluffCases.map(([pot, bet], index) => ({
  id: `bluff-${String(index + 1).padStart(2, '0')}`, category: 'bluff', title: `用 ${bet} 筹码诈唬`,
  prompt: `河牌单挑，底池 ${pot}，对手过牌。你用 ${bet} 做纯诈唬；被跟注必输，对手只会弃牌或跟注。忽略抽水，至少需要多少弃牌率才能盈亏平衡？`,
  answer: bluffBreakEven(pot, bet) * 100, unit: '%', tolerance: 1,
  formula: `弃牌率 = ${bet} ÷ (${pot} + ${bet}) = ${(bluffBreakEven(pot, bet) * 100).toFixed(2)}%`,
  explanation: `弃牌时净赚当前底池 ${pot}，被跟时净亏自己的下注 ${bet}。这是零权益、单次决策模型；半诈唬或可能被加注时需另建模型。`,
}));

const sizingCases = [
  { title: '半池下注', prompt: '尚无人下注，底池 120。你想下注半池，应新投入多少筹码？', answer: 60, formula: '120 × 1/2 = 60' },
  { title: '四分之三池下注', prompt: '尚无人下注，底池 200。你想下注 3/4 底池，应新投入多少筹码？', answer: 150, formula: '200 × 3/4 = 150' },
  { title: '加注到，不是再加', prompt: '本街你已投入 20，当前下注到 60。你要 Raise to 180（加注到 180），现在应再投入多少？', answer: 160, formula: '180 − 已投入的 20 = 再投入 160' },
  { title: '翻前最小加注', prompt: '盲注 10/20。前面有人从 20 加注到 60，这是完整加注。无人再加注，你筹码充足，最小应加注到多少？', answer: 100, formula: '最近完整加注增量 = 60 − 20 = 40；60 + 40 = 100' },
  { title: '再次完整加注', prompt: '盲注 10/20，A 加注到 60，B 再加注到 140。你筹码充足，下一次最小加注到多少？', answer: 220, formula: '最近完整加注增量 = 140 − 60 = 80；140 + 80 = 220' },
  { title: '翻后面对首注', prompt: '转牌尚无人下注，对手首次下注 75。你筹码充足，最小合法加注到多少？', answer: 150, formula: '首注增量 75；75 + 75 = 150' },
  { title: '短码全下不缩小增量', prompt: '盲注 10/20。A 从 20 加注到 100（完整增量 80），B 全下到 130。你本轮还没行动且筹码充足，最小加注到多少？', answer: 210, formula: 'B 的 30 不够完整加注；仍沿用 80，130 + 80 = 210' },
  { title: '有效筹码', prompt: '单挑开始本手时你有 800，对手 350，双方尚未投入。两人之间的有效筹码是多少？', answer: 350, formula: 'min(800, 350) = 350' },
  { title: '底池下注', prompt: '尚无人下注，底池 175。你想下注一个底池，应新投入多少筹码？', answer: 175, formula: '175 × 1 = 175' },
  { title: '全下需要补多少', prompt: '本街你已投入 30，身后还剩 270。你选择 All-in，这次再投入多少？', answer: 270, formula: 'All-in 投入身后全部 270；本街最终投入总额为 30 + 270 = 300' },
];
const questionsSizing: TrainingQuestion[] = sizingCases.map((fixture, index) => ({
  id: `sizing-${String(index + 1).padStart(2, '0')}`, category: 'sizing', ...fixture,
  unit: '筹码', tolerance: 0,
  explanation: '标准无限注规则。Raise to 指本街投入的总额；Bet 指当前这次下注。未达到完整增量的短码全下不重开已行动者的加注权，尚未行动者仍可合法加注。',
}));

export const rangeFixtures = [
  { hero: ['As', 'Ad'], board: ['Kc', '9h', '6s', '3d', '2c'], range: [['Kd', 'Qh'], ['9d', '9c']], expected: 0.5, explanation: 'AA 击败 KQ，但输给 99 的三条：1 赢、1 输。' },
  { hero: ['Ks', 'Qs'], board: ['Kh', '8d', '5c', '3s', '2h'], range: [['Kd', 'Jh'], ['Ac', 'Kc'], ['8s', '8c'], ['Qh', 'Qd']], expected: 0.5, explanation: 'KQ 击败 KJ 与 QQ，输给 AK 与 88：2 赢、2 输。' },
  { hero: ['2h', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'], range: [['4c', '5d'], ['Ah', 'Ad'], ['9s', '8s']], expected: 0.5, explanation: '公牌已是皇家同花顺，所有人使用公牌平局。获胜概率为 0%，分池权益为 50%。' },
  { hero: ['9h', '9d'], board: ['9c', '5s', '5h', 'Kd', '2c'], range: [['Kc', 'Kh'], ['Ac', 'Ah'], ['5d', '5c']], expected: 1 / 3, explanation: '99955 葫芦击败 AA，输给 KKK55 葫芦及四条 5：1 赢、2 输。' },
  { hero: ['Ah', 'Qh'], board: ['Kh', '9h', '6h', '3s', '2c'], range: [['Kc', 'Kd'], ['Th', '8h'], ['As', 'Ad'], ['4c', '5d']], expected: 1, explanation: 'A 高同花击败范围中四手牌：4 赢。题目只对给出的范围成立。' },
  { hero: ['Ac', 'Kd'], board: ['As', 'Ks', 'Qs', 'Js', '2s'], range: [['Ts', '9h'], ['3s', '3h'], ['Ah', 'Qd'], ['7h', '8d']], expected: 0.25, explanation: '输给 T♠ 的皇家同花顺及 3♠ 改善的同花，与另外两手同用公牌平局：(0 + 0 + 0.5 + 0.5) ÷ 4。' },
  { hero: ['8s', '7d'], board: ['6c', '5h', '4s', 'Kd', '2c'], range: [['9c', '8d'], ['7c', '8h'], ['7s', '3d'], ['Ac', 'Ad']], expected: 0.875, explanation: '8 高顺子击败 98、73、AA；与 87 平局：(3 + 0.5) ÷ 4。' },
  { hero: ['Tc', 'Ad'], board: ['Ts', 'Th', '8c', '8h', '2s'], range: [['8s', '8d'], ['Td', 'As'], ['8d', '4h']], expected: 0.5, explanation: 'TTT88 输给四条 8，与另一手 T 平局，击败 888TT：(0 + 0.5 + 1) ÷ 3。' },
  { hero: ['Qc', 'Jd'], board: ['As', 'Kh', 'Tc', '7d', '2h'], range: [['Qd', 'Jc'], ['Qh', '9s'], ['7c', '7h']], expected: 5 / 6, explanation: 'A 高顺子与 QJ 平局，击败 Q9 和 77：(0.5 + 1 + 1) ÷ 3。' },
  { hero: ['2s', '2h'], board: ['Ac', 'Ad', 'Ks', 'Kh', 'Qc'], range: [['As', '3c'], ['Kc', '4d'], ['Qh', 'Jh'], ['9c', '8d']], expected: 0.25, explanation: '22 不改善公牌。输给 A3、K4 的葫芦，与 QJ、98 同用公牌平局：(0 + 0 + 0.5 + 0.5) ÷ 4。' },
];
const questionsRange: TrainingQuestion[] = rangeFixtures.map((fixture, index) => ({
  id: `range-${String(index + 1).padStart(2, '0')}`, category: 'range', title: '看范围，不只看单手牌',
  prompt: '河牌单挑，范围中每一手精确花色组合等概率出现。对手只可能持下面列出的其中一手；无抽水、无后续下注。你的底池权益是多少？平局计半份。',
  hero: fixture.hero, board: fixture.board, range: fixture.range,
  answer: riverRangeEquity(fixture.hero, fixture.board, fixture.range) * 100,
  unit: '%', tolerance: 1,
  formula: `权益 =（获胜组合数 + 平局组合数 × 1/2）÷ 总组合数 = ${(fixture.expected * 100).toFixed(2)}%`,
  explanation: `${fixture.explanation} 这是已知范围下的河牌精确枚举，不是对真实对手的预测，也不是 GTO 建议。`,
}));

export const trainingQuestions: TrainingQuestion[] = [...questionsOuts, ...questionsPot, ...questionsEV, ...questionsBluff, ...questionsSizing, ...questionsRange];
export const questionIds = new Set(trainingQuestions.map(question => question.id));
export function isAnswerCorrect(question: TrainingQuestion, answer: number): boolean {
  return Number.isFinite(answer) && Math.abs(answer - question.answer) <= question.tolerance + 1e-9;
}
