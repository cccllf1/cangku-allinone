const fs = require('fs');
const path = require('path');

// 要检查的图片路径
const imagePaths = [
  '/uploads/product-1749841722103-775515245.jpg',  // 黄色、卡其色
  '/uploads/product-1749841306157-531759750.jpg',  // 绿色、黑色
  '/uploads/product-1749840987553-173148288.jpg',  // 粉色、蓝色
];

// 可能的uploads目录路径
const possibleUploadPaths = [
  path.join(__dirname, '..', 'public', 'uploads'),
  path.join(__dirname, '..', 'uploads'),
  '/uploads',
  '/volume1/docker/cccllf1/cangku-allinone/uploads'
];

// 检查uploads目录中的图片
function checkImages() {
  console.log('开始检查图片文件...\n');
  
  // 找到正确的uploads目录
  let uploadsDir = null;
  for (const testPath of possibleUploadPaths) {
    console.log(`检查目录: ${testPath}`);
    if (fs.existsSync(testPath)) {
      uploadsDir = testPath;
      console.log(`✅ 找到uploads目录: ${uploadsDir}\n`);
      break;
    } else {
      console.log(`❌ 目录不存在\n`);
    }
  }

  if (!uploadsDir) {
    console.error('错误: 未找到uploads目录');
    return;
  }
  
  // 读取uploads目录下的所有文件
  try {
    const files = fs.readdirSync(uploadsDir);
    
    console.log('uploads目录中的所有文件:');
    files.forEach(file => {
      console.log(file);
    });
    console.log('\n');

    // 检查每个图片路径
    imagePaths.forEach(imagePath => {
      const filename = path.basename(imagePath);
      const fullPath = path.join(uploadsDir, filename);
      
      console.log(`检查图片: ${filename}`);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log(`✅ 文件存在`);
        console.log(`   完整路径: ${fullPath}`);
        console.log(`   大小: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   修改时间: ${stats.mtime}`);
      } else {
        console.log(`❌ 文件不存在: ${fullPath}`);
      }
      console.log('');
    });
  } catch (err) {
    console.error('读取目录失败:', err);
  }
}

// 运行检查
checkImages(); 