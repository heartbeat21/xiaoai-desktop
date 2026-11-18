/**
 * Sprite Sheet 解析器
 * 严格遵循技术设计文档 8.5 节规范
 */

export interface SpriteSheetMeta {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  anchorPoint: { x: number; y: number };
}

export interface FrameRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export class SpriteSheet {
  readonly image: HTMLImageElement;
  readonly meta: SpriteSheetMeta;
  readonly isFallback: boolean; // [SAFE] 标记是否为占位

  constructor(image: HTMLImageElement, meta: SpriteSheetMeta, isFallback = false) {
    this.image = image;
    this.meta = meta;
    this.isFallback = isFallback;
  }

  /**
   * 获取指定帧在 sprite sheet 中的裁剪矩形
   * 水平排列：第 i 帧的 x 偏移 = i * frameWidth
   */
  getFrameRect(index: number): FrameRect {
    return {
      sx: index * this.meta.frameWidth,
      sy: 0,
      sw: this.meta.frameWidth,
      sh: this.meta.frameHeight,
    };
  }

  /**
   * 从 URL 加载 sprite sheet（图片 + JSON 元数据）
   * [SAFE] 加载失败时返回占位色块，不抛出异常
   */
  static async load(imagePath: string, jsonPath: string): Promise<SpriteSheet> {
    try {
      const [image, meta] = await Promise.all([
        loadImage(imagePath),
        loadJson<SpriteSheetMeta>(jsonPath),
      ]);
      console.log(`[SpriteSheet] 加载成功: ${imagePath}`);
      return new SpriteSheet(image, meta);
    } catch (err) {
      console.warn(`[SpriteSheet] 加载失败，使用占位: ${imagePath}`, err);
      return SpriteSheet.createFallback();
    }
  }

  /**
   * [SAFE] 创建占位 sprite sheet（粉色方块 + 感叹号）
   * 单帧、单循环，用于资源缺失时的视觉兜底
   */
  static createFallback(): SpriteSheet {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 粉色背景
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(0, 0, size, size);

    // 边框
    ctx.strokeStyle = '#cc3388';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);

    // 问号/感叹号
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', size / 2, size / 2);

    // 转为 HTMLImageElement
    const img = new Image();
    img.src = canvas.toDataURL();

    const meta: SpriteSheetMeta = {
      frameWidth: size,
      frameHeight: size,
      frameCount: 1,
      fps: 1,
      loop: true,
      anchorPoint: { x: 0.5, y: 1.0 },
    };

    return new SpriteSheet(img, meta, true);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}

async function loadJson<T>(src: string): Promise<T> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`JSON 加载失败: ${src}`);
  return res.json();
}