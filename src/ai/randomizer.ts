// 加权随机选择
export function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// 范围内随机整数
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 范围内随机浮点
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 随机时间间隔（毫秒）
export function randomInterval(minSec: number, maxSec: number): number {
  return randomFloat(minSec, maxSec) * 1000;
}