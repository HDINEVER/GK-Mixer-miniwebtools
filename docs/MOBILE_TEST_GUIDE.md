# 移动设备模式测试指南

## 快速测试步骤

### 1. 启动开发服务器
```bash
npm run dev
```
访问: http://localhost:3001

### 2. 测试桌面模式
1. 在普通浏览器窗口打开应用
2. 切换到"基础色"标签
3. 拖动任意色块(黑/红/蓝/黄/白)
4. **验证**:
   - ✓ 色块沿轨道移动流畅
   - ✓ 中心圆实时显示混色结果
   - ✓ 配方显示正确的ml和百分比
   - ✓ mixbox算法生效(例如红+蓝=紫,不是粉色)

### 3. 测试移动设备模式 (430×932)
1. 打开 Chrome DevTools (按 F12)
2. 点击设备工具栏图标 (Ctrl+Shift+M)
3. 选择 "iPhone 14 Pro Max" 或输入 430×932
4. 刷新页面
5. 切换到"基础色"标签
6. **用鼠标模拟触摸**拖动色块
7. **验证**:
   - ✓ 点击色块时正确识别
   - ✓ 拖动时坐标转换正确
   - ✓ 色块跟随鼠标沿轨道移动
   - ✓ 混色结果正确(使用mixbox算法)
   - ✓ 配方数据实时更新
   - ✓ 色块放大/缩小动画流畅

### 4. 切换测试
1. 在桌面模式和移动模式之间多次切换
2. 每次切换后测试拖动功能
3. **验证**: 所有模式下功能都正常

## 已修复的问题

### 问题1: 坐标转换错误
**现象**: 在430×932模式下,点击色块位置不准确,拖动响应错误

**原因**: 使用了错误的坐标转换基准(`rect.width`而非`canvasSize.width`)

**修复**: 
```typescript
// 修复前
const x = (clientX - rect.left) * (WIDTH / rect.width);

// 修复后
const x = (clientX - rect.left) * (WIDTH / canvasSize.width);
```

### 问题2: 依赖项缺失
**现象**: 设备模式切换后,拖动功能失效

**原因**: `useEffect`依赖数组缺少`canvasSize`,事件处理器使用旧的尺寸值

**修复**: 添加`canvasSize`到依赖数组

### 问题3: mixbox算法未生效
**现象**: 混色结果不正确

**原因**: 坐标转换错误导致配比计算错误,进而影响mixbox算法

**修复**: 坐标转换修复后,mixbox算法正常工作

## 技术要点

### 坐标系统
- **屏幕坐标**: `clientX/clientY` (事件提供)
- **Canvas显示坐标**: 相对于Canvas的像素坐标
- **逻辑坐标**: 固定500×500坐标系(用于绘图)

### 转换公式
```
逻辑X = (屏幕X - Canvas.left) × (500 / Canvas显示宽度)
逻辑Y = (屏幕Y - Canvas.top) × (500 / Canvas显示高度)
```

### 关键修复点
1. **handleStart**: 点击检测时的坐标转换
2. **handleMove**: 拖动时的坐标转换
3. **useEffect依赖**: 添加`canvasSize`确保尺寸变化时重新绑定

## 预期结果

### 桌面模式 (1920×1080等)
- Canvas尺寸: 500×500 (或稍小,取决于容器)
- 鼠标操作: 流畅无延迟
- 混色: mixbox算法正确应用

### 移动模式 (430×932)
- Canvas尺寸: ~398×398 (自动缩放)
- 触摸操作: 坐标转换正确,响应准确
- 混色: mixbox算法正确应用
- 性能: 60fps流畅运行

## 故障排查

如果仍有问题:

1. **检查Console**: 查看是否有JavaScript错误
2. **验证mixbox导入**: 确认`utils/mixbox.ts`正确导入
3. **检查Canvas尺寸**: 在Console输入`document.querySelector('canvas').width`
4. **测试坐标**: 添加临时日志查看转换后的x/y值

## 相关文档
- [MOBILE_DEVICE_FIX.md](./MOBILE_DEVICE_FIX.md) - 详细修复文档
- [MOBILE_SCALE_FIX.md](./MOBILE_SCALE_FIX.md) - 之前的缩放修复
- [copilot-instructions.md](../.github/copilot-instructions.md) - 项目架构说明
