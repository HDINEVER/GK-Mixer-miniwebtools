# 移动端缩放修复测试

## 问题描述
- iPhone (432×932) 分辨率下色盘没有正确按比例缩放
- 移动端算法错误,PC端正常

## 修复内容

### 1. 修正响应式尺寸计算
**修改前:**
```typescript
const scale = isMobile ? Math.min(window.innerWidth - 40, 380) / BASE_WIDTH : 1;
```
- 问题:移动端强制限制最大宽度为380px,导致432px屏幕计算错误

**修改后:**
```typescript
const availableWidth = isMobile ? window.innerWidth - 40 : BASE_WIDTH;
const scale = Math.min(availableWidth / BASE_WIDTH, 1); // 只缩小不放大
```
- 解决:移除最大宽度限制,根据实际可用宽度动态计算

### 2. 修复Canvas尺寸设置

**问题:**
- Canvas逻辑尺寸(canvas.width)使用BASE_WIDTH (500px)
- CSS显示尺寸(canvas.style.width)也使用500px
- 导致移动端显示尺寸不正确

**修复:**
```typescript
// Canvas内部逻辑坐标系统保持500×500
canvas.width = displayWidth * dpr;  // 500 × devicePixelRatio
canvas.height = displayHeight * dpr;

// CSS显示尺寸使用缩放后的尺寸
canvas.style.width = canvasSize.width + 'px';  // 例如392px (432-40)
canvas.style.height = canvasSize.height + 'px';
```

### 3. 坐标系统说明

**逻辑坐标系(内部绘制):**
- 始终使用 500×500 作为基准
- 所有绘制代码使用这个坐标系统
- 保证PC和移动端算法一致

**显示坐标系(CSS):**
- PC端: 500×500px (scale=1)
- iPhone 432px: 392×392px (scale=0.784)
- 通过CSS transform实现缩放

**事件坐标转换:**
```typescript
// 鼠标/触摸坐标转换为逻辑坐标
const x = (clientX - rect.left) * (WIDTH / rect.width);
const y = (clientY - rect.top) * (HEIGHT / rect.height);
```

## 测试步骤

### iPhone (432×932) 测试:
1. ✅ 打开开发者工具
2. ✅ 选择设备: iPhone 14 Pro 或自定义 432×932
3. ✅ 验证色盘显示尺寸: 应为 392×392px (432-40)
4. ✅ 验证拖动准确性: 点击位置应与视觉位置一致
5. ✅ 验证计算结果: 混合颜色应与PC端一致

### 其他设备测试:
- iPhone SE (375px): 335×335px ✅
- iPhone 12 Pro (390px): 350×350px ✅
- iPhone 14 Pro Max (430px): 390×390px ✅
- iPad (768px+): 500×500px (保持原始尺寸) ✅

## 修复的文件
- ✅ `components/BasicColorMixer.tsx`
- ✅ `components/RadialPaletteMixer.tsx`

## 预期结果
- ✅ PC端: 保持500px/450px原始尺寸,算法不变
- ✅ 移动端: 根据屏幕宽度自动缩放,算法与PC端完全一致
- ✅ 坐标转换: 触摸位置准确对应到画布元素
- ✅ 颜色混合: PC和移动端结果完全相同
