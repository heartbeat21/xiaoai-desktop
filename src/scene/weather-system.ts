// src/scene/weather-system.ts
import { ParticleSystem, ParticleConfig } from './particles/particle-system';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'sakura' | 'fireflies';

interface WeatherDef {
  type: WeatherType;
  config: ParticleConfig;
  probability: number;
  nightOnly?: boolean;
}

const DEFS: WeatherDef[] = [
  {
    type: 'rain',
    probability: 25,
    config: {
      count: 150,
      minSize: 1, maxSize: 2,
      minSpeed: 8, maxSpeed: 12,
      direction: 85,        // 略向右倾斜（风吹效果）
      directionSpread: 10,
      minOpacity: 0.25, maxOpacity: 0.5,
      minLife: 2, maxLife: 4,
      sway: false, swayAmplitude: 0, swaySpeed: 0,
      rotation: false, rotationSpeed: 0,
      gravity: 0,
      glow: false, glowRadius: 0,
      color: 'rgba(170, 200, 240, 0.6)',
      shape: 'line',
      lineWidth: 1.5,
      lineLength: 16,
    },
  },
  {
    type: 'snow',
    probability: 15,
    config: {
      count: 80,
      minSize: 2, maxSize: 4,
      minSpeed: 1, maxSpeed: 3,
      direction: 90,
      directionSpread: 30,
      minOpacity: 0.4, maxOpacity: 0.8,
      minLife: 5, maxLife: 10,
      sway: true, swayAmplitude: 1.5, swaySpeed: 2,
      rotation: false, rotationSpeed: 0,
      gravity: 0.008,
      glow: false, glowRadius: 0,
      color: 'rgba(255, 255, 255, 0.85)',
      shape: 'circle',
    },
  },
  {
    type: 'sakura',
    probability: 10,
    config: {
      count: 25,
      minSize: 3, maxSize: 6,
      minSpeed: 0.5, maxSpeed: 2,
      direction: 100,
      directionSpread: 60,
      minOpacity: 0.5, maxOpacity: 0.85,
      minLife: 6, maxLife: 12,
      sway: true, swayAmplitude: 2, swaySpeed: 1.5,
      rotation: true, rotationSpeed: 3,
      gravity: 0.004,
      glow: false, glowRadius: 0,
      color: 'rgba(255, 183, 197, 0.7)',
      shape: 'petal',
    },
  },
  {
    type: 'fireflies',
    probability: 8,
    nightOnly: true,
    config: {
      count: 20,
      minSize: 1.5, maxSize: 3,
      minSpeed: 0.3, maxSpeed: 0.8,
      direction: 0,
      directionSpread: 360,
      minOpacity: 0.3, maxOpacity: 0.7,
      minLife: 4, maxLife: 8,
      sway: true, swayAmplitude: 0.8, swaySpeed: 1,
      rotation: false, rotationSpeed: 0,
      gravity: -0.002,   // 微微上浮
      glow: true, glowRadius: 10,
      color: 'rgba(200, 255, 100, 0.8)',
      shape: 'dot',
    },
  },
];

export class WeatherSystem {
  private current: WeatherType = 'clear';
  private particles: ParticleSystem | null = null;
  private opacity = 0;
  private targetOpacity = 0;
  private cw = 0;
  private ch = 0;

  // 自动切换计时
  private nextSwitch = 0;
  private autoEnabled = true;

  setCanvasSize(w: number, h: number) {
    this.cw = w;
    this.ch = h;
    if (this.particles) {
      this.particles.deactivate();
      this.particles.activate(w, h);
    }
  }

  getCurrentWeather(): WeatherType {
    return this.current;
  }

  /**
   * 手动设置天气（控制台调试用）
   * weather.setWeather('rain')
   */
  setWeather(type: WeatherType) {
    if (type === this.current && type !== 'clear') return;

    this.current = type;

    if (type === 'clear') {
      this.targetOpacity = 0;
    } else {
      const def = DEFS.find(d => d.type === type);
      if (!def) return;

      const cfg: ParticleConfig = { ...def.config };
      this.particles = new ParticleSystem(cfg);
      this.particles.activate(this.cw, this.ch);
      this.particles.setGlobalOpacity(0);
      this.targetOpacity = 1;
    }

    this.scheduleNext();
  }

  /**
   * 随机选择天气（根据概率权重 + 时段限制）
   */
  switchRandom(minuteOfDay: number) {
    const isNight = minuteOfDay < 300 || minuteOfDay >= 1140;

    const pool: { type: WeatherType; w: number }[] = [
      { type: 'clear', w: 40 },
    ];
    for (const d of DEFS) {
      if (d.nightOnly && !isNight) continue;
      pool.push({ type: d.type, w: d.probability });
    }

    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let chosen: WeatherType = 'clear';
    for (const p of pool) {
      r -= p.w;
      if (r <= 0) { chosen = p.type; break; }
    }

    this.setWeather(chosen);
  }

  update(dt: number) {
    // 淡入淡出过渡（2 秒）
    if (this.opacity < this.targetOpacity) {
      this.opacity = Math.min(this.targetOpacity, this.opacity + dt / 2000);
    } else if (this.opacity > this.targetOpacity) {
      this.opacity = Math.max(this.targetOpacity, this.opacity - dt / 2000);
    }

    if (this.particles) {
      this.particles.setGlobalOpacity(this.opacity);
      this.particles.update(dt);

      // 淡出完毕，清理
      if (this.opacity <= 0 && this.targetOpacity <= 0) {
        this.particles.deactivate();
        this.particles = null;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.particles && this.opacity > 0.01) {
      this.particles.render(ctx);
    }
  }

  /**
   * 在 render loop 中调用，检查是否该自动切换
   */
  checkAutoSwitch(minuteOfDay: number) {
    if (!this.autoEnabled) return;
    if (performance.now() < this.nextSwitch) return;
    this.switchRandom(minuteOfDay);
  }

  /**
   * 缩短自动切换间隔，方便测试
   * weather.enableQuickSwitch() → 每 10-30 秒切换
   */
  enableQuickSwitch() {
    this.nextSwitch = performance.now() + 5000;
  }

  private scheduleNext() {
    const interval = this.autoEnabled
      ? 30 * 60 * 1000 + Math.random() * 90 * 60 * 1000
      : Infinity;
    this.nextSwitch = performance.now() + interval;
  }
}