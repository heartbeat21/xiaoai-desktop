// src/scene/particles/particle-system.ts

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  maxOpacity: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  swayPhase: number;
  swayAmplitude: number;
  swaySpeed: number;
  active: boolean;
  glowRadius: number;
}

export interface ParticleConfig {
  count: number;
  minSize: number;
  maxSize: number;
  minSpeed: number;
  maxSpeed: number;
  direction: number;       // 角度 (90=向下)
  directionSpread: number; // 扩散角度
  minOpacity: number;
  maxOpacity: number;
  minLife: number;         // 秒
  maxLife: number;
  sway: boolean;
  swayAmplitude: number;
  swaySpeed: number;
  rotation: boolean;
  rotationSpeed: number;
  gravity: number;
  glow: boolean;
  glowRadius: number;
  color: string;
  shape: 'circle' | 'line' | 'petal' | 'dot';
  lineWidth?: number;
  lineLength?: number;
}

export class ParticleSystem {
  private pool: Particle[] = [];
  private config: ParticleConfig;
  private globalOpacity = 1;
  private canvasW = 0;
  private canvasH = 0;

  constructor(config: ParticleConfig) {
    this.config = config;
    for (let i = 0; i < config.count; i++) {
      this.pool.push(this.createParticle());
    }
  }

  private createParticle(): Particle {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      size: 0, opacity: 0, maxOpacity: 0,
      rotation: 0, rotationSpeed: 0,
      life: 0, maxLife: 0,
      swayPhase: 0, swayAmplitude: 0, swaySpeed: 0,
      active: false, glowRadius: 0,
    };
  }

  setGlobalOpacity(o: number) {
    this.globalOpacity = Math.max(0, Math.min(1, o));
  }

  activate(w: number, h: number) {
    this.canvasW = w;
    this.canvasH = h;
    for (let i = 0; i < this.config.count; i++) {
      this.spawnParticle(this.pool[i], true);
    }
  }

  deactivate() {
    for (const p of this.pool) p.active = false;
  }

  private spawnParticle(p: Particle, scatter: boolean) {
    const cfg = this.config;
    const dirRad = (cfg.direction * Math.PI) / 180;
    const spreadRad = (cfg.directionSpread * Math.PI) / 180;
    const angle = dirRad + (Math.random() - 0.5) * spreadRad;
    const speed = cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed);

    p.x = Math.random() * this.canvasW;
    p.y = scatter ? Math.random() * this.canvasH : -20;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.size = cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize);
    p.maxOpacity = cfg.minOpacity + Math.random() * (cfg.maxOpacity - cfg.minOpacity);
    p.opacity = scatter ? p.maxOpacity : 0; // 新生成从0开始淡入
    p.rotation = Math.random() * Math.PI * 2;
    p.rotationSpeed = cfg.rotation ? (Math.random() - 0.5) * cfg.rotationSpeed * 2 : 0;
    p.maxLife = cfg.minLife + Math.random() * (cfg.maxLife - cfg.minLife);
    p.life = p.maxLife;
    p.swayPhase = Math.random() * Math.PI * 2;
    p.swayAmplitude = cfg.sway ? cfg.swayAmplitude * (0.5 + Math.random()) : 0;
    p.swaySpeed = cfg.sway ? cfg.swaySpeed * (0.5 + Math.random()) : 0;
    p.glowRadius = cfg.glow ? cfg.glowRadius * (0.5 + Math.random()) : 0;
    p.active = true;
  }

  update(dt: number) {
    const dtSec = dt / 1000;

    for (const p of this.pool) {
      if (!p.active) continue;

      p.life -= dtSec;
      if (p.life <= 0) {
        this.spawnParticle(p, false);
        continue;
      }

      // 新生成粒子淡入
      if (p.opacity < p.maxOpacity) {
        p.opacity = Math.min(p.maxOpacity, p.opacity + dtSec * 2);
      }

      p.x += p.vx;
      p.y += p.vy;

      if (p.swayAmplitude > 0) {
        p.swayPhase += p.swaySpeed * dtSec;
        p.x += Math.sin(p.swayPhase) * p.swayAmplitude;
      }

      if (this.config.gravity) {
        p.vy += this.config.gravity;
      }

      p.rotation += p.rotationSpeed * dtSec;

      // 生命末期淡出
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < 0.15) {
        p.opacity = p.maxOpacity * (lifeRatio / 0.15);
      }

      // 越界重生
      if (p.y > this.canvasH + 30 || p.x < -60 ||
          p.x > this.canvasW + 60 || p.y < -60) {
        this.spawnParticle(p, false);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.globalOpacity <= 0) return;
    const cfg = this.config;

    for (const p of this.pool) {
      if (!p.active) continue;

      const alpha = p.opacity * this.globalOpacity;
      if (alpha < 0.01) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      switch (cfg.shape) {
        case 'circle':
          ctx.fillStyle = cfg.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'line': {
          ctx.strokeStyle = cfg.color;
          ctx.lineWidth = cfg.lineWidth || 1.5;
          ctx.lineCap = 'round';
          const lineAngle = Math.atan2(p.vy, p.vx);
          ctx.rotate(lineAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(cfg.lineLength || p.size * 4, 0);
          ctx.stroke();
          break;
        }

        case 'petal': {
          ctx.fillStyle = cfg.color;
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(p.size * 0.6, 0, 0, p.size);
          ctx.quadraticCurveTo(-p.size * 0.6, 0, 0, -p.size);
          ctx.fill();
          break;
        }

        case 'dot': {
          if (cfg.glow) {
            // 萤火虫呼吸闪烁
            const pulse = 0.4 + 0.6 * Math.sin(p.swayPhase * 2 + p.life * 3);
            const glowAlpha = alpha * pulse;
            ctx.globalAlpha = glowAlpha;
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.glowRadius);
            grad.addColorStop(0, cfg.color);
            grad.addColorStop(0.3, cfg.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, p.glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = alpha;
          }
          ctx.fillStyle = cfg.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }
  }
}