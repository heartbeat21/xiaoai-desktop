// src/scene/time-system.ts

type RGB = [number, number, number];

interface SkyKeyframe {
  minute: number; // 距午夜的分钟数 (0-1440)
  top: RGB;
  mid: RGB;
  bottom: RGB;
}

// 关键帧定义：在特定时间点的天空颜色（顶部、中部、底部）
const SKY_KEYFRAMES: SkyKeyframe[] = [
  // 午夜 → 黎明前
  { minute: 0,    top: [12, 12, 29],    mid: [19, 19, 37],     bottom: [26, 26, 46] },
  // 05:00 黎明
  { minute: 300,  top: [26, 26, 62],    mid: [140, 100, 80],   bottom: [254, 180, 123] },
  // 07:00 早晨
  { minute: 420,  top: [79, 172, 254],  mid: [40, 207, 254],   bottom: [0, 242, 254] },
  // 11:00 中午
  { minute: 660,  top: [33, 150, 243],  mid: [67, 165, 245],   bottom: [100, 181, 246] },
  // 14:00 下午
  { minute: 840,  top: [102, 126, 234], mid: [110, 100, 198],  bottom: [118, 75, 162] },
  // 17:00 日落
  { minute: 1020, top: [250, 112, 154], mid: [252, 168, 109],  bottom: [254, 225, 64] },
  // 19:00 傍晚
  { minute: 1140, top: [12, 12, 29],    mid: [19, 19, 45],     bottom: [26, 26, 62] },
  // 21:00 夜晚
  { minute: 1260, top: [12, 12, 29],    mid: [19, 19, 37],     bottom: [26, 26, 46] },
  // 24:00 与 0:00 衔接（闭环）
  { minute: 1440, top: [12, 12, 29],    mid: [19, 19, 37],     bottom: [26, 26, 46] },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

export class TimeSystem {
  // 设为非 null 时覆盖真实时间，用于调试
  // 控制台输入: timeSystem.debugMinute = 300 (05:00), 1020 (17:00) 等
  debugMinute: number | null = null;

  /**
   * 获取当前时段名称（调试用）
   */
  getPeriodName(minute: number): string {
    if (minute < 300) return '深夜';
    if (minute < 420) return '黎明';
    if (minute < 660) return '早晨';
    if (minute < 840) return '中午';
    if (minute < 1020) return '下午';
    if (minute < 1140) return '日落';
    if (minute < 1260) return '傍晚';
    return '夜晚';
  }

  /**
   * 获取当前时间对应的天空颜色
   */
  getSkyColors(): { top: RGB; mid: RGB; bottom: RGB; minute: number } {
    let minute: number;

    if (this.debugMinute !== null) {
      minute = this.debugMinute;
    } else {
      const now = new Date();
      minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    }

    const colors = this.getColorsAtMinute(minute);
    return { ...colors, minute };
  }

  /**
   * 获取指定分钟数的天空颜色（支持 0-1440）
   */
  getColorsAtMinute(minute: number): { top: RGB; mid: RGB; bottom: RGB } {
    minute = Math.max(0, Math.min(1439.99, minute));

    // 查找两侧关键帧
    for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
      const a = SKY_KEYFRAMES[i];
      const b = SKY_KEYFRAMES[i + 1];
      if (minute >= a.minute && minute < b.minute) {
        const t = (minute - a.minute) / (b.minute - a.minute);
        return {
          top: lerpRGB(a.top, b.top, t),
          mid: lerpRGB(a.mid, b.mid, t),
          bottom: lerpRGB(a.bottom, b.bottom, t),
        };
      }
    }

    // 兜底
    const last = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];
    return { top: last.top, mid: last.mid, bottom: last.bottom };
  }

  /**
   * 在 Canvas 上绘制天空渐变
   */
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const colors = this.getSkyColors();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgb(${colors.top[0]}, ${colors.top[1]}, ${colors.top[2]})`);
    gradient.addColorStop(0.5, `rgb(${colors.mid[0]}, ${colors.mid[1]}, ${colors.mid[2]})`);
    gradient.addColorStop(1, `rgb(${colors.bottom[0]}, ${colors.bottom[1]}, ${colors.bottom[2]})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}