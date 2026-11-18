// src/scene/scene-manager.ts
import { TimeSystem } from './time-system';
import { WeatherSystem } from './weather-system';

type RGB = [number, number, number];

interface GroundKeyframe {
  minute: number;
  far: RGB;   // 远景草地颜色
  near: RGB;  // 近景草地颜色
  accent: RGB; // 装饰色（花丛、亮点等）
}

const GROUND_KEYFRAMES: GroundKeyframe[] = [
  { minute: 0,    far: [20, 30, 20],   near: [15, 25, 15],   accent: [25, 35, 25] },
  { minute: 300,  far: [40, 60, 35],   near: [30, 50, 28],   accent: [55, 70, 45] },
  { minute: 420,  far: [80, 140, 60],  near: [60, 120, 45],  accent: [100, 160, 70] },
  { minute: 660,  far: [90, 160, 70],  near: [70, 140, 55],  accent: [110, 175, 80] },
  { minute: 840,  far: [80, 145, 65],  near: [65, 130, 50],  accent: [95, 155, 72] },
  { minute: 1020, far: [95, 120, 55],  near: [75, 100, 45],  accent: [115, 135, 65] },
  { minute: 1140, far: [35, 50, 30],   near: [25, 40, 22],   accent: [45, 55, 35] },
  { minute: 1260, far: [20, 30, 20],   near: [15, 25, 15],   accent: [25, 35, 25] },
  { minute: 1440, far: [20, 30, 20],   near: [15, 25, 15],   accent: [25, 35, 25] },
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

function rgb(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export class SceneManager {
  private timeSystem: TimeSystem;
  private weatherSystem: WeatherSystem;

  // 地平线位置（占画面高度的比例，0.72 = 画面下方 28% 是地面）
  private horizonRatio = 0.72;

  constructor(timeSystem: TimeSystem) {
    this.timeSystem = timeSystem;
    this.weatherSystem = new WeatherSystem();
    // 暴露到 window 方便控制台调试
    (window as any).weather = this.weatherSystem;
  }

  getWeather(): WeatherSystem {
    return this.weatherSystem;
  }

  /**
   * 设置画布尺寸（天气粒子需要知道画布大小）
   */
  setCanvasSize(w: number, h: number) {
    this.weatherSystem.setCanvasSize(w, h);
  }

  /**
   * 每帧调用：更新天气粒子状态 + 检查自动切换
   */
  update(dt: number) {
    this.weatherSystem.update(dt);
    const skyInfo = this.timeSystem.getSkyColors();
    this.weatherSystem.checkAutoSwitch(skyInfo.minute);
  }

  /**
   * 获取当前时间对应的地面颜色
   */
  private getGroundColors(minute: number): { far: RGB; near: RGB; accent: RGB } {
    minute = Math.max(0, Math.min(1439.99, minute));

    for (let i = 0; i < GROUND_KEYFRAMES.length - 1; i++) {
      const a = GROUND_KEYFRAMES[i];
      const b = GROUND_KEYFRAMES[i + 1];
      if (minute >= a.minute && minute < b.minute) {
        const t = (minute - a.minute) / (b.minute - a.minute);
        return {
          far: lerpRGB(a.far, b.far, t),
          near: lerpRGB(a.near, b.near, t),
          accent: lerpRGB(a.accent, b.accent, t),
        };
      }
    }
    const last = GROUND_KEYFRAMES[GROUND_KEYFRAMES.length - 1];
    return { far: last.far, near: last.near, accent: last.accent };
  }

  /**
   * 绘制完整场景（天空 + 地面 + 山丘 + 地面细节 + 天气粒子）
   */
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const skyInfo = this.timeSystem.getSkyColors();
    const minute = skyInfo.minute;
    const ground = this.getGroundColors(minute);
    const horizonY = height * this.horizonRatio;

    // === 1. 天空渐变 ===
    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, `rgb(${skyInfo.top[0]}, ${skyInfo.top[1]}, ${skyInfo.top[2]})`);
    skyGradient.addColorStop(0.5, `rgb(${skyInfo.mid[0]}, ${skyInfo.mid[1]}, ${skyInfo.mid[2]})`);
    skyGradient.addColorStop(1, `rgb(${skyInfo.bottom[0]}, ${skyInfo.bottom[1]}, ${skyInfo.bottom[2]})`);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, horizonY);

    // === 2. 地面 ===
    const groundGradient = ctx.createLinearGradient(0, horizonY, 0, height);
    groundGradient.addColorStop(0, rgb(ground.far));
    groundGradient.addColorStop(0.4, rgb(ground.near));
    groundGradient.addColorStop(1, rgb(ground.near));
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // === 3. 远景山丘 ===
    this.drawHills(ctx, width, horizonY, ground.far);

    // === 4. 地面细节 ===
    this.drawGroundDetail(ctx, width, height, horizonY, ground.accent);

    // === 5. 天气粒子（在场景之上、角色之下）===
    this.weatherSystem.render(ctx);
  }

  /**
   * 绘制远景山丘剪影
   */
  private drawHills(
    ctx: CanvasRenderingContext2D,
    width: number,
    horizonY: number,
    baseColor: RGB
  ): void {
    const hillColor: RGB = [
      Math.max(0, baseColor[0] - 15),
      Math.max(0, baseColor[1] - 15),
      Math.max(0, baseColor[2] - 10),
    ];

    ctx.fillStyle = rgb(hillColor);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);

    const hillHeight = horizonY * 0.05;
    ctx.bezierCurveTo(
      width * 0.15, horizonY - hillHeight * 1.2,
      width * 0.25, horizonY - hillHeight * 0.6,
      width * 0.4, horizonY - hillHeight * 0.9
    );
    ctx.bezierCurveTo(
      width * 0.55, horizonY - hillHeight * 1.4,
      width * 0.7, horizonY - hillHeight * 0.5,
      width * 0.85, horizonY - hillHeight * 1.1
    );
    ctx.bezierCurveTo(
      width * 0.92, horizonY - hillHeight * 0.8,
      width * 0.98, horizonY - hillHeight * 0.3,
      width, horizonY - hillHeight * 0.5
    );

    ctx.lineTo(width, horizonY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 绘制地面细节纹理
   */
  private drawGroundDetail(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    horizonY: number,
    accentColor: RGB
  ): void {
    const groundHeight = height - horizonY;

    // 地平线分界线
    const lineColor: RGB = [
      Math.min(255, accentColor[0] + 20),
      Math.min(255, accentColor[1] + 20),
      Math.min(255, accentColor[2] + 15),
    ];
    ctx.strokeStyle = `rgba(${lineColor[0]}, ${lineColor[1]}, ${lineColor[2]}, 0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    // 近景草丛
    const bushColor: RGB = [
      Math.min(255, accentColor[0] + 10),
      Math.min(255, accentColor[1] + 15),
      Math.min(255, accentColor[2] + 8),
    ];
    ctx.fillStyle = `rgba(${bushColor[0]}, ${bushColor[1]}, ${bushColor[2]}, 0.4)`;

    const bushPositions = [0.08, 0.22, 0.45, 0.67, 0.82, 0.95];
    for (const pos of bushPositions) {
      const bx = width * pos;
      const by = height - groundHeight * 0.08;
      const bw = 30 + pos * 20;
      const bh = 8 + pos * 5;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2, by);
      ctx.quadraticCurveTo(bx, by - bh, bx + bw / 2, by);
      ctx.fill();
    }
  }
}