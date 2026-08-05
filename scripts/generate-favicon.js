/**
 * 生成带圆角的favicon
 * 使用Node.js Canvas API处理图片
 */

const fs = require('fs');
const path = require('path');

// 由于Node.js环境限制，这里提供一个HTML工具来生成favicon
// 将此HTML保存为临时文件并在浏览器中打开

const htmlTool = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Favicon Generator</title>
  <style>
    body {
      font-family: monospace;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    canvas {
      border: 1px solid #ccc;
      margin: 10px 0;
    }
    button {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      margin: 10px 5px;
    }
    #preview {
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>Favicon Generator with Rounded Corners</h1>
  
  <div>
    <input type="file" id="imageInput" accept="image/*">
    <label>Border Radius: <input type="range" id="radiusSlider" min="0" max="50" value="20"> <span id="radiusValue">20</span>%</label>
  </div>
  
  <div id="preview">
    <h3>Preview (32x32):</h3>
    <canvas id="canvas32" width="32" height="32"></canvas>
    
    <h3>Preview (192x192):</h3>
    <canvas id="canvas192" width="192" height="192"></canvas>
  </div>
  
  <div>
    <button onclick="download('favicon.ico', 32)">Download favicon.ico (32x32)</button>
    <button onclick="download('favicon-192.png', 192)">Download favicon-192.png</button>
    <button onclick="download('apple-touch-icon.png', 180)">Download Apple Touch Icon (180x180)</button>
  </div>

  <script>
    let originalImage = null;
    
    document.getElementById('imageInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          originalImage = img;
          updatePreviews();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
    
    document.getElementById('radiusSlider').addEventListener('input', function(e) {
      document.getElementById('radiusValue').textContent = e.target.value;
      if (originalImage) updatePreviews();
    });
    
    function drawRoundedImage(canvas, img, borderRadiusPercent) {
      const ctx = canvas.getContext('2d');
      const size = canvas.width;
      const radius = (size * borderRadiusPercent) / 100;
      
      // Clear canvas
      ctx.clearRect(0, 0, size, size);
      
      // Create rounded rectangle clipping path
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
      
      // Draw image
      ctx.drawImage(img, 0, 0, size, size);
    }
    
    function updatePreviews() {
      if (!originalImage) return;
      
      const radius = parseInt(document.getElementById('radiusSlider').value);
      
      const canvas32 = document.getElementById('canvas32');
      const canvas192 = document.getElementById('canvas192');
      
      drawRoundedImage(canvas32, originalImage, radius);
      drawRoundedImage(canvas192, originalImage, radius);
    }
    
    function download(filename, size) {
      if (!originalImage) {
        alert('Please select an image first!');
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      
      const radius = parseInt(document.getElementById('radiusSlider').value);
      drawRoundedImage(canvas, originalImage, radius);
      
      canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  </script>
</body>
</html>`;

// 保存HTML工具
const toolPath = path.join(__dirname, 'favicon-generator.html');
fs.writeFileSync(toolPath, htmlTool);

console.log('\\n✅ Favicon generator tool created!');
console.log('📂 Location:', toolPath);
console.log('\\n📝 Instructions:');
console.log('1. Open favicon-generator.html in your browser');
console.log('2. Upload your image');
console.log('3. Adjust the border radius slider');
console.log('4. Download the generated favicon files');
console.log('5. Move the downloaded files to the /public directory');
console.log('\\nFiles to generate:');
console.log('- favicon.ico (32x32)');
console.log('- favicon-192.png (192x192)');
console.log('- apple-touch-icon.png (180x180)');
