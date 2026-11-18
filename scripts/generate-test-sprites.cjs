const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const FRAME_W = 256;
const FRAME_H = 256;
const CX = FRAME_W / 2;  // 中心 X

// ============================================================
// 颜色定义 — 小爱同学配色
// ============================================================
const COLORS = {
  // 头发
  hairMain: '#4A90D9',
  hairDark: '#3A70B0',
  hairHighlight: '#6BB3FF',
  hairBang: '#3D7EC4',
  // 皮肤
  skin: '#FFD8B4',
  skinShadow: '#F0C09A',
  skinHighlight: '#FFE8D0',
  // 眼睛
  eyeWhite: '#FFFFFF',
  irisOuter: '#4A90D9',
  irisInner: '#2E6BB0',
  irisHighlight: '#8DC8FF',
  pupil: '#1A1A2E',
  eyeHighlight: '#FFFFFF',
  eyeShadow: 'rgba(60, 80, 120, 0.15)',
  // 腮红
  blush: 'rgba(255, 130, 130, 0.35)',
  // 嘴巴
  mouth: '#E88B7A',
  mouthLight: '#F0A090',
  // 衣服
  clothMain: '#5B8EC9',
  clothDark: '#4A75A8',
  clothLight: '#7AADE0',
  clothAccent: '#FFD700',  // 金色装饰
  clothWhite: '#E8EFF8',
  // 裙子
  skirtMain: '#4A7AB5',
  skirtDark: '#3A6299',
  // 腿/袜子
  sockWhite: '#F0F0F5',
  sockTop: '#5B8EC9',
  // 鞋子
  shoeMain: '#4A4A6A',
  shoeAccent: '#FFD700',
  // 阴影
  shadow: 'rgba(30, 50, 80, 0.2)',
};

// ============================================================
// 辅助绘图函数
// ============================================================

// 渐变填充圆
function fillGradientCircle(ctx, cx, cy, r, colorInner, colorOuter) {
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
  grad.addColorStop(0, colorInner);
  grad.addColorStop(1, colorOuter);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// 圆角矩形
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// 填充圆角矩形
function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

// 贝塞尔曲线填充形状
function fillShape(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// 绘制角色各部分（参数化，支持动画偏移）
// ============================================================

function drawCharacter(ctx, ox, params) {
  const {
    breatheOffset = 0,
    headTilt = 0,
    eyeOpenL = 1,    // 0=闭, 1=全开
    eyeOpenR = 1,
    lookX = 0,       // -1 到 1，左右看
    lookY = 0,       // -1 到 1，上下看
    legPhase = 0,    // 行走时的腿摆动相位
    bodyBob = 0,     // 行走时的身体上下弹跳
    armSwing = 0,    // 行走时手臂摆动
    mouthSmile = 1,  // 0=闭嘴, 1=微笑
    blinkOneSide = false, // 单眼眨眼
  } = params;

  // 整体偏移
  const baseY = 0 + bodyBob;

  // ========================================
  // 1. 地面阴影
  // ========================================
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(ox, FRAME_H - 18 + baseY, 45, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // ========================================
  // 2. 腿 + 鞋子
  // ========================================
  const legY = 160 + baseY + breatheOffset;
  const legLen = 42;
  const footY = legY + legLen;
  const legSpread = 14;

  // 左腿
  const leftLegX = ox - legSpread + Math.sin(legPhase) * 12;
  const leftFootY = footY + Math.abs(Math.sin(legPhase)) * 3;
  // 袜子
  fillRoundRect(ctx, leftLegX - 7, legY, 14, legLen, 4, COLORS.sockWhite);
  // 袜子顶部装饰
  fillRoundRect(ctx, leftLegX - 8, legY, 16, 6, 3, COLORS.sockTop);
  // 鞋子
  fillRoundRect(ctx, leftLegX - 9, leftFootY - 4, 20, 10, 5, COLORS.shoeMain);
  // 鞋子装饰
  fillRoundRect(ctx, leftLegX - 4, leftFootY - 2, 6, 4, 2, COLORS.shoeAccent);

  // 右腿
  const rightLegX = ox + legSpread + Math.sin(legPhase + Math.PI) * 12;
  const rightFootY = footY + Math.abs(Math.sin(legPhase + Math.PI)) * 3;
  fillRoundRect(ctx, rightLegX - 7, legY, 14, legLen, 4, COLORS.sockWhite);
  fillRoundRect(ctx, rightLegX - 8, legY, 16, 6, 3, COLORS.sockTop);
  fillRoundRect(ctx, rightLegX - 9, rightFootY - 4, 20, 10, 5, COLORS.shoeMain);
  fillRoundRect(ctx, rightLegX - 4, rightFootY - 2, 6, 4, 2, COLORS.shoeAccent);

  // ========================================
  // 3. 身体（衣服）
  // ========================================
  const bodyTop = 108 + baseY + breatheOffset;
  const bodyBot = 162 + baseY + breatheOffset;
  const bodyW = 68;

  // 主体 — 梯形连衣裙
  const clothGrad = ctx.createLinearGradient(ox - bodyW / 2, bodyTop, ox + bodyW / 2, bodyTop);
  clothGrad.addColorStop(0, COLORS.clothDark);
  clothGrad.addColorStop(0.3, COLORS.clothLight);
  clothGrad.addColorStop(0.7, COLORS.clothMain);
  clothGrad.addColorStop(1, COLORS.clothDark);
  ctx.fillStyle = clothGrad;

  ctx.beginPath();
  ctx.moveTo(ox - 28, bodyTop);
  ctx.lineTo(ox + 28, bodyTop);
  ctx.lineTo(ox + 38, bodyBot);
  ctx.quadraticCurveTo(ox, bodyBot + 8, ox - 38, bodyBot);
  ctx.closePath();
  ctx.fill();

  // 领口装饰
  ctx.fillStyle = COLORS.clothWhite;
  ctx.beginPath();
  ctx.moveTo(ox - 18, bodyTop);
  ctx.lineTo(ox, bodyTop + 14);
  ctx.lineTo(ox + 18, bodyTop);
  ctx.quadraticCurveTo(ox, bodyTop + 6, ox - 18, bodyTop);
  ctx.fill();

  // 胸前金色蝴蝶结/装饰
  ctx.fillStyle = COLORS.clothAccent;
  // 中心结
  ctx.beginPath();
  ctx.arc(ox, bodyTop + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  // 左翅膀
  ctx.beginPath();
  ctx.ellipse(ox - 10, bodyTop + 8, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // 右翅膀
  ctx.beginPath();
  ctx.ellipse(ox + 10, bodyTop + 8, 8, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // ========================================
  // 4. 手臂
  // ========================================
  const shoulderY = bodyTop + 8;
  ctx.strokeStyle = COLORS.clothMain;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';

  // 左臂
  const leftArmEnd = shoulderY + 35 + Math.sin(armSwing) * 8;
  const leftArmXEnd = ox - 34 + Math.sin(armSwing) * 5;
  ctx.beginPath();
  ctx.moveTo(ox - 28, shoulderY);
  ctx.quadraticCurveTo(ox - 38, shoulderY + 15, leftArmXEnd, leftArmEnd);
  ctx.stroke();
  // 左手
  fillGradientCircle(ctx, leftArmXEnd, leftArmEnd + 4, 8, COLORS.skinHighlight, COLORS.skin);

  // 右臂
  const rightArmEnd = shoulderY + 35 + Math.sin(armSwing + Math.PI) * 8;
  const rightArmXEnd = ox + 34 + Math.sin(armSwing + Math.PI) * 5;
  ctx.beginPath();
  ctx.moveTo(ox + 28, shoulderY);
  ctx.quadraticCurveTo(ox + 38, shoulderY + 15, rightArmXEnd, rightArmEnd);
  ctx.stroke();
  // 右手
  fillGradientCircle(ctx, rightArmXEnd, rightArmEnd + 4, 8, COLORS.skinHighlight, COLORS.skin);

  // ========================================
  // 5. 头部
  // ========================================
  const headCX = ox + headTilt * 2;
  const headCY = 72 + baseY + breatheOffset;
  const headR = 56;

  // 头部阴影
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(headCX + 3, headCY + 5, headR + 2, headR + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头（皮肤）
  fillGradientCircle(ctx, headCX, headCY, headR, COLORS.skinHighlight, COLORS.skin);

  // ========================================
  // 5a. 头发（后层）
  // ========================================
  ctx.fillStyle = COLORS.hairMain;
  // 头发主体 — 比头稍大的圆
  ctx.beginPath();
  ctx.arc(headCX, headCY - 4, headR + 6, 0, Math.PI * 2);
  ctx.fill();

  // 头发下半部分覆盖耳朵区域
  ctx.beginPath();
  ctx.arc(headCX, headCY - 2, headR + 4, 0.8 * Math.PI, 2.2 * Math.PI);
  ctx.fill();

  // ========================================
  // 5b. 脸部（在头发表面之下）
  // ========================================
  // 重新画脸（裁剪在头发之上）
  fillGradientCircle(ctx, headCX, headCY + 4, headR - 6, COLORS.skinHighlight, COLORS.skin);

  // ========================================
  // 5c. 刘海
  // ========================================
  const hairGrad = ctx.createLinearGradient(headCX - headR, headCY - headR, headCX + headR, headCY);
  hairGrad.addColorStop(0, COLORS.hairDark);
  hairGrad.addColorStop(0.4, COLORS.hairHighlight);
  hairGrad.addColorStop(1, COLORS.hairMain);
  ctx.fillStyle = hairGrad;

  // 刘海主体
  ctx.beginPath();
  ctx.moveTo(headCX - headR - 4, headCY - 10);
  ctx.quadraticCurveTo(headCX - headR + 10, headCY - headR - 10, headCX - 20, headCY - headR + 5);
  ctx.quadraticCurveTo(headCX - 10, headCY - headR + 15, headCX - 5, headCY - 20);
  ctx.quadraticCurveTo(headCX, headCY - headR + 20, headCX + 5, headCY - 20);
  ctx.quadraticCurveTo(headCX + 10, headCY - headR + 15, headCX + 20, headCY - headR + 5);
  ctx.quadraticCurveTo(headCX + headR - 10, headCY - headR - 10, headCX + headR + 4, headCY - 10);
  ctx.quadraticCurveTo(headCX + headR + 2, headCY - 30, headCX + headR - 10, headCY - headR);
  ctx.quadraticCurveTo(headCX, headCY - headR - 18, headCX - headR + 10, headCY - headR);
  ctx.quadraticCurveTo(headCX - headR - 2, headCY - 30, headCX - headR - 4, headCY - 10);
  ctx.closePath();
  ctx.fill();

  // 刘海中间的分缝高光
  ctx.fillStyle = COLORS.hairHighlight;
  ctx.beginPath();
  ctx.moveTo(headCX - 2, headCY - headR + 8);
  ctx.quadraticCurveTo(headCX, headCY - 24, headCX + 2, headCY - headR + 8);
  ctx.quadraticCurveTo(headCX, headCY - headR + 2, headCX - 2, headCY - headR + 8);
  ctx.fill();

  // ========================================
  // 5d. 两侧头发（长发垂下）
  // ========================================
  ctx.fillStyle = COLORS.hairMain;

  // 左侧长发
  ctx.beginPath();
  ctx.moveTo(headCX - headR + 5, headCY - 5);
  ctx.quadraticCurveTo(headCX - headR - 12, headCY + 30, headCX - headR - 8, headCY + 70);
  ctx.quadraticCurveTo(headCX - headR - 4, headCY + 80, headCX - headR + 8, headCY + 75);
  ctx.quadraticCurveTo(headCX - headR + 10, headCY + 40, headCX - headR + 8, headCY);
  ctx.closePath();
  ctx.fill();

  // 右侧长发
  ctx.beginPath();
  ctx.moveTo(headCX + headR - 5, headCY - 5);
  ctx.quadraticCurveTo(headCX + headR + 12, headCY + 30, headCX + headR + 8, headCY + 70);
  ctx.quadraticCurveTo(headCX + headR + 4, headCY + 80, headCX + headR - 8, headCY + 75);
  ctx.quadraticCurveTo(headCX + headR - 10, headCY + 40, headCX + headR - 8, headCY);
  ctx.closePath();
  ctx.fill();

  // 头发高光
  ctx.fillStyle = 'rgba(140, 200, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(headCX - 15, headCY - 25, 12, 20, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // ========================================
  // 5e. 头顶装饰 — 天线/发饰
  // ========================================
  // 小天线
  ctx.strokeStyle = COLORS.hairDark;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headCX + 5, headCY - headR + 2);
  ctx.quadraticCurveTo(headCX + 10, headCY - headR - 20, headCX + 8, headCY - headR - 28);
  ctx.stroke();
  // 天线球
  fillGradientCircle(ctx, headCX + 8, headCY - headR - 32, 7, '#8DD8FF', COLORS.hairMain);

  // ========================================
  // 6. 眼睛
  // ========================================
  const eyeL_CX = headCX - 18 + lookX * 3;
  const eyeR_CX = headCX + 18 + lookX * 3;
  const eyeCY = headCY + 4 + lookY * 2;
  const eyeW = 16;
  const eyeH_open = 18;
  const eyeH_l = eyeH_open * eyeOpenL;
  const eyeH_r = eyeH_open * eyeOpenR;

  if (eyeH_l > 2) {
    drawEye(ctx, eyeL_CX, eyeCY, eyeW, eyeH_l, lookX, lookY);
  } else {
    // 闭眼 — 画弧线
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(eyeL_CX, eyeCY, eyeW * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  if (eyeH_r > 2) {
    drawEye(ctx, eyeR_CX, eyeCY, eyeW, eyeH_r, lookX, lookY);
  } else {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(eyeR_CX, eyeCY, eyeW * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  // 眼睛阴影
  ctx.fillStyle = COLORS.eyeShadow;
  ctx.beginPath();
  ctx.ellipse(eyeL_CX, eyeCY - eyeH_l / 2 - 2, eyeW + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(eyeR_CX, eyeCY - eyeH_r / 2 - 2, eyeW + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ========================================
  // 7. 腮红
  // ========================================
  ctx.fillStyle = COLORS.blush;
  ctx.beginPath();
  ctx.ellipse(eyeL_CX - 12, eyeCY + 16, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(eyeR_CX + 12, eyeCY + 16, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // ========================================
  // 8. 嘴巴
  // ========================================
  if (mouthSmile > 0.5) {
    // 微笑弧线
    ctx.strokeStyle = COLORS.mouth;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(headCX, eyeCY + 20, 10, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // 小圆嘴
    ctx.fillStyle = COLORS.mouth;
    ctx.beginPath();
    ctx.arc(headCX, eyeCY + 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================
// 绘制单只眼睛
// ============================================================
function drawEye(ctx, cx, cy, w, h, lookX, lookY) {
  // 眼白
  ctx.fillStyle = COLORS.eyeWhite;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 虹膜
  const irisR = Math.min(w, h / 2) * 0.75;
  const irisCX = cx + lookX * 3;
  const irisCY = cy + lookY * 2 + 1;

  // 虹膜渐变
  const irisGrad = ctx.createRadialGradient(irisCX, irisCY, 0, irisCX, irisCY, irisR);
  irisGrad.addColorStop(0, COLORS.irisHighlight);
  irisGrad.addColorStop(0.4, COLORS.irisInner);
  irisGrad.addColorStop(1, COLORS.irisOuter);
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(irisCX, irisCY, irisR, 0, Math.PI * 2);
  ctx.fill();

  // 瞳孔
  const pupilR = irisR * 0.45;
  ctx.fillStyle = COLORS.pupil;
  ctx.beginPath();
  ctx.arc(irisCX, irisCY + 1, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // 大高光（左上）
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(irisCX - irisR * 0.3, irisCY - irisR * 0.3, irisR * 0.25, irisR * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 小高光（右下）
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(irisCX + irisR * 0.25, irisCY + irisR * 0.2, irisR * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // 上眼睑线
  ctx.strokeStyle = '#2A2A4A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, h / 2, 0, Math.PI, 0);
  ctx.stroke();

  // 睫毛（左眼左侧，右眼右侧）
  ctx.strokeStyle = '#2A2A4A';
  ctx.lineWidth = 2;
  const lashX = cx === undefined ? cx : (cx < CX ? cx - w - 2 : cx + w + 2);
  ctx.beginPath();
  ctx.moveTo(lashX, cy - h / 2 + 2);
  ctx.lineTo(lashX + (cx < CX ? -4 : 4), cy - h / 2 - 5);
  ctx.stroke();
}

// ============================================================
// 清除一帧区域
// ============================================================
function clearFrame(ctx, ox) {
  ctx.clearRect(ox, 0, FRAME_W, FRAME_H);
}

// ============================================================
// 生成 idle sprite sheet
// ============================================================
function generateIdle(outDir) {
  const FC = 48;
  const canvas = createCanvas(FRAME_W * FC, FRAME_H);
  const ctx = canvas.getContext('2d');

  // 眨眼区间
  const blinkFrames = { 22: 0.7, 23: 0.3, 24: 0.1, 25: 0.05, 26: 0.1, 27: 0.5, 28: 0.9 };
  // 右眼单独眨一下
  const rBlinkFrames = { 38: 0.7, 39: 0.3, 40: 0.05, 41: 0.3, 42: 0.8 };

  for (let i = 0; i < FC; i++) {
    const ox = i * FRAME_W + FRAME_W / 2;

    // 呼吸
    const breatheOffset = Math.sin((i / FC) * Math.PI * 2) * 4;

    // 微微摆动
    const sway = Math.sin((i / FC) * Math.PI * 2 * 2) * 1;

    // 眨眼
    let eyeL = 1, eyeR = 1;
    if (blinkFrames[i] !== undefined) { eyeL = blinkFrames[i]; eyeR = blinkFrames[i]; }
    if (rBlinkFrames[i] !== undefined) { eyeR = rBlinkFrames[i]; }

    drawCharacter(ctx, ox, {
      breatheOffset,
      headTilt: sway * 0.3,
      eyeOpenL: eyeL,
      eyeOpenR: eyeR,
      lookX: Math.sin((i / FC) * Math.PI * 2 * 0.5) * 0.3,
      lookY: 0,
      legPhase: 0,
      bodyBob: 0,
      armSwing: 0,
      mouthSmile: 1,
    });
  }

  fs.writeFileSync(path.join(outDir, 'idle.png'), canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(outDir, 'idle.json'), JSON.stringify({
    frameWidth: FRAME_W, frameHeight: FRAME_H,
    frameCount: FC, fps: 24, loop: true,
    anchorPoint: { x: 0.5, y: 1.0 }
  }, null, 2));
  console.log(`✅ idle → ${FRAME_W * FC}x${FRAME_H}px, ${FC}帧`);
}

// ============================================================
// 生成 walk sprite sheet
// ============================================================
function generateWalk(outDir) {
  const FC = 24;
  const canvas = createCanvas(FRAME_W * FC, FRAME_H);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < FC; i++) {
    const ox = i * FRAME_W + FRAME_W / 2;

    const phase = (i / FC) * Math.PI * 2;
    const breatheOffset = Math.sin(phase * 2) * 2;
    const bodyBob = Math.abs(Math.sin(phase)) * 3;
    const headTilt = Math.sin(phase) * 0.5;
    const armSwing = phase;

    drawCharacter(ctx, ox, {
      breatheOffset,
      headTilt,
      eyeOpenL: 1,
      eyeOpenR: 1,
      lookX: 0,
      lookY: 0,
      legPhase: phase,
      bodyBob,
      armSwing,
      mouthSmile: 0.8,
    });
  }

  fs.writeFileSync(path.join(outDir, 'walk.png'), canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(outDir, 'walk.json'), JSON.stringify({
    frameWidth: FRAME_W, frameHeight: FRAME_H,
    frameCount: FC, fps: 24, loop: true,
    anchorPoint: { x: 0.5, y: 1.0 }
  }, null, 2));
  console.log(`✅ walk → ${FRAME_W * FC}x${FRAME_H}px, ${FC}帧`);
}

// ============================================================
// 执行
// ============================================================
const idleDir = path.resolve(__dirname, '../public/assets/characters/xiaoai/animations/idle');
const walkDir = path.resolve(__dirname, '../public/assets/characters/xiaoai/animations/walk');

if (!fs.existsSync(idleDir)) fs.mkdirSync(idleDir, { recursive: true });
if (!fs.existsSync(walkDir)) fs.mkdirSync(walkDir, { recursive: true });

console.log('🎨 生成 Chibi 小爱同学 Sprite Sheet...\n');
generateIdle(idleDir);
generateWalk(walkDir);
console.log('\n✅ 完成！运行 `npm run tauri dev` 后访问浏览器确认效果。');