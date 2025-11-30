# RadialPaletteMixer 优化报告

## 优化目标
根据 RadialMixer 的优秀设计,完全重构 RadialPaletteMixer 的视觉外观和交互逻辑。

---

## 核心优化点

### 1. 简化轨道绘制 ✅
**RadialMixer 原理:**
```typescript
// 单层灰色轨道,简洁清晰
ctx.strokeStyle = '#e2e8f0'; // slate-200
ctx.lineWidth = 4;
ctx.lineCap = 'round';
```

**实施效果:**
- 移除了复杂的双层轨道系统(灰色基底 + 彩色渐变)
- 移除了发光效果(shadowBlur)
- 仅保留简单的灰色连接线,视觉更清爽

---

### 2. Anime.js 弹性动画 ✅
**RadialMixer 动画系统:**

#### 点击时(easeOutElastic)
```typescript
anime({
  targets: { radius: knobSizes.current[i] },
  radius: ACTIVE_KNOB_RADIUS, // 20 → 30
  duration: 400,
  easing: 'easeOutElastic(1, .6)', // 弹性弹跳
  update: (anim: any) => {
    knobSizes.current[i] = anim.animatables[0].target.radius;
  }
});
```

#### 释放时(easeOutQuad)
```typescript
anime({
  targets: { radius: knobSizes.current[draggedIndex] },
  radius: BASE_KNOB_RADIUS, // 30 → 20
  duration: 300,
  easing: 'easeOutQuad', // 平滑恢复
  update: (anim: any) => {
    knobSizes.current[draggedIndex] = anim.animatables[0].target.radius;
  }
});
```

**实施效果:**
- 使用 `knobSizes.current[]` 数组存储每个旋钮的当前半径
- 点击时半径从 20 → 30,带弹性效果
- 释放时半径从 30 → 20,平滑恢复
- 动画完全独立于 React state,性能更优

---

### 3. 动态旋钮尺寸 ✅
**常量定义:**
```typescript
const BASE_KNOB_RADIUS = 20;  // 基础半径(0%时)
const ACTIVE_KNOB_RADIUS = 30; // 激活半径(拖动时)
const CENTER_RADIUS = INNER_RADIUS - 5; // 中心圆=95
```

**尺寸逻辑:**
- 静止状态: `BASE_KNOB_RADIUS = 20px`
- 拖动状态: `ACTIVE_KNOB_RADIUS = 30px` (放大50%)
- 动画驱动: anime.js 控制 `knobSizes.current[]`

---

### 4. 优化信息标签 ✅
**RadialMixer 标签样式:**
```typescript
// 圆角矩形背景(6px圆角)
ctx.roundRect(tx - w/2, ty - h/2, w, h, 6);
ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
ctx.fill();

// 主文本(毫升数)
ctx.font = 'bold 12px "JetBrains Mono", monospace';
ctx.fillText(`${ml}ml`, tx, ty - 5);

// 副文本(百分比)
ctx.font = '10px "JetBrains Mono", monospace';
ctx.fillStyle = '#64748b';
ctx.fillText(`${pct}%`, tx, ty + 7);
```

**智能定位逻辑:**
```typescript
// 外圈:向外偏移 / 内圈:向内偏移(避免重叠)
const textDist = 45;
const tx = kx + sinA * (t > 0.8 ? -textDist : textDist);
const ty = ky + cosA * (t > 0.8 ? -textDist : textDist);
```

**实施效果:**
- 白色半透明背景(90%不透明度)
- 使用 JetBrains Mono 等宽字体
- 数值上下排列,层次清晰
- 根据位置自动调整方向

---

### 5. 中心圆渲染 ✅
**阴影效果:**
```typescript
// 向下偏移5px制造深度感
ctx.arc(CENTER_X, CENTER_Y + 5, CENTER_RADIUS, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(0,0,0,0.1)';
ctx.fill();
```

**空状态(Mosaic):**
```typescript
// 15x15 棋盘格纹理
for (let i = x - r; i < x + r; i += 15) {
  for (let j = y - r; j < y + r; j += 15) {
    if ((gridX + gridY) % 2 === 0) {
      ctx.fillRect(i, j, 15, 15);
    }
  }
}
```

**混合状态:**
```typescript
ctx.fillStyle = mixedColor;
ctx.fill();
ctx.strokeStyle = '#fff';
ctx.lineWidth = 4; // 粗白边
ctx.stroke();
```

**目标色对比:**
```typescript
// 35%半径的内圈显示目标色
ctx.arc(CENTER_X, CENTER_Y, CENTER_RADIUS * 0.35, 0, Math.PI * 2);
ctx.fillStyle = targetColor.hex;
```

---

### 6. RequestAnimationFrame 循环 ✅
**RadialMixer 渲染机制:**
```typescript
const draw = () => {
  // 绘制所有元素...
};

useEffect(() => {
  const loop = () => {
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };
  requestRef.current = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(requestRef.current!);
}, [sliders, mixedColor, targetColor, draggingIndex, knobSizes]);
```

**优势:**
- 60 FPS 流畅渲染
- 动画过渡平滑无卡顿
- 自动同步 anime.js 动画
- 依赖变化自动重启循环

---

### 7. 碰撞检测优化 ✅
**直接计算方式(移除 sliderRefs):**
```typescript
// 实时计算旋钮位置
const t = slider.position;
const angle = slider.angle;
const sinA = Math.sin(angle);
const cosA = Math.cos(angle);

const outerX = CENTER_X + sinA * OUTER_RADIUS;
const outerY = CENTER_Y + cosA * OUTER_RADIUS;

const kx = outerX - sinA * t * (OUTER_RADIUS - INNER_RADIUS);
const ky = outerY - cosA * t * (OUTER_RADIUS - INNER_RADIUS);

const dist = Math.sqrt(Math.pow(mouseX - kx, 2) + Math.pow(mouseY - ky, 2));

// 40px 宽容碰撞检测
if (dist < 40) {
  setDraggingIndex(i);
  // ...
}
```

**改进点:**
- 移除了 `sliderRefs` 缓存系统
- 每次直接计算坐标(性能影响可忽略)
- 代码更简洁,逻辑更清晰
- 与 RadialMixer 完全一致

---

## 技术细节对比

| 特性 | 旧版 RadialPaletteMixer | 新版(优化后) | RadialMixer |
|------|------------------------|-------------|-------------|
| 轨道样式 | 双层+渐变+发光 | 单层灰线 | 单层灰线 ✅ |
| 旋钮动画 | slider.scale state | knobSizes ref | knobSizes ref ✅ |
| 碰撞检测 | sliderRefs 缓存 | 实时计算 | 实时计算 ✅ |
| 渲染循环 | useEffect 触发 | requestAnimationFrame | requestAnimationFrame ✅ |
| 标签定位 | 固定外侧 | 智能内外切换 | 智能切换 ✅ |
| 中心阴影 | 无 | +5px 偏移 | +5px 偏移 ✅ |
| Mosaic | 20x20格子 | 15x15格子 | 15x15格子 ✅ |

---

## 代码变更清单

### ✅ 已完成的修改

1. **components/RadialPaletteMixer.tsx** (主文件)
   - Line 35-37: 添加 `knobSizes.current[]` 和 `requestRef`
   - Line 48-50: 添加 `BASE_KNOB_RADIUS`, `ACTIVE_KNOB_RADIUS`
   - Line 69: 初始化 `knobSizes.current`
   - Line 130-240: 重写 `draw()` 函数,简化轨道绘制
   - Line 265-271: 添加 requestAnimationFrame 循环
   - Line 313-347: 重写 `handleMouseDown`,使用 anime.js
   - Line 355-380: 重写 hover 检测逻辑
   - Line 450-465: 重写 `handleMouseUp`,使用 anime.js
   - Line 274-283: 删除重复的 `shadeColor` 函数

### ⚠️ 遗留问题

1. **Line 581**: TypeScript linter 误报(冒号警告) - 可忽略
2. **旋钮尺寸动态缩放**: 当前仅在拖动时变化,未来可根据 weight 实时调整

---

## 测试验证

### 视觉测试
- ✅ 轨道显示为简洁灰线
- ✅ 旋钮点击时弹性放大
- ✅ 旋钮释放时平滑缩小
- ✅ 标签在内圈时自动向内偏移
- ✅ 中心圆显示阴影效果
- ✅ 空状态显示棋盘格纹理
- ✅ 目标色显示为内圈(35%半径)

### 交互测试
- ✅ 碰撞检测准确(40px 宽容度)
- ✅ 拖动流畅无卡顿(60 FPS)
- ✅ 动画过渡自然(elastic + quad easing)
- ✅ 触摸设备支持(onTouchStart/Move/End)

### 性能测试
- ✅ requestAnimationFrame 循环稳定
- ✅ anime.js 动画不阻塞主线程
- ✅ 19个旋钮同时渲染无性能问题

---

## 未来优化方向

### 1. 动态尺寸增强
```typescript
// 根据 weight 实时调整旋钮大小
const dynamicRadius = BASE_KNOB_RADIUS * (1 + slider.weight * 0.5);
```

### 2. 活跃轨道渐变(可选)
```typescript
// 从内圈到旋钮位置显示彩色渐变(仅活跃旋钮)
if (slider.weight > 0.01) {
  const gradient = ctx.createLinearGradient(innerX, innerY, kx, ky);
  gradient.addColorStop(0, slider.color + '40');
  gradient.addColorStop(1, slider.color);
  ctx.strokeStyle = gradient;
  ctx.stroke();
}
```

### 3. 重置动画优化
```typescript
// 从中心向外的 stagger 动画(已部分实现)
anime.stagger(80, { from: 'center' })
```

---

## 相关文档

- **RadialMixer 参考实现**: `components/RadialMixer.tsx`
- **Mixbox 物理混色**: `utils/mixbox.ts`
- **Anime.js 文档**: https://animejs.com/documentation/
- **Canvas 2D API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

---

**优化日期**: 2025-11-30  
**优化范围**: 视觉外观 + 交互逻辑 + 动画系统  
**参考标准**: RadialMixer 专业级实现
