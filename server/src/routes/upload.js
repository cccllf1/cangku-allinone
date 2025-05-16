const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

// 配置存储
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('创建上传目录:', uploadDir);
    }
    
    // 检查目录权限
    try {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      console.log('上传目录可写');
    } catch (err) {
      console.error('上传目录权限错误:', err);
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // 生成唯一文件名，防止文件名冲突
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = 'product-' + uniqueSuffix + ext;
    console.log('生成文件名:', filename);
    cb(null, filename);
  }
});

// 文件过滤器，只允许上传图片
const fileFilter = (req, file, cb) => {
  console.log('检查文件类型:', file.mimetype);
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

// 上传单个文件的路由
router.post('/image', auth, (req, res, next) => {
  console.log('接收到图片上传请求');
  next();
}, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      console.error('没有文件被上传');
      return res.status(400).json({ message: '没有文件被上传' });
    }
    
    console.log('文件上传成功:', req.file);
    
    // 返回文件访问URL
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log('生成文件URL:', fileUrl);
    
    // 验证文件是否可访问
    const filePath = path.join(__dirname, '../../uploads', req.file.filename);
    if (fs.existsSync(filePath)) {
      console.log('文件已成功保存到磁盘:', filePath);
      const stats = fs.statSync(filePath);
      console.log('文件大小:', stats.size, 'bytes');
    } else {
      console.error('文件未成功保存到磁盘!');
    }
    
    res.json({ url: fileUrl, message: '文件上传成功' });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({ message: '文件上传失败: ' + error.message });
  }
});

// 错误处理中间件
router.use((err, req, res, next) => {
  console.error('上传错误:', err);
  
  if (err instanceof multer.MulterError) {
    // Multer错误
    if (err.code === 'LIMIT_FILE_SIZE') {
      console.error('文件大小超出限制');
      return res.status(400).json({ message: '文件大小不能超过10MB' });
    }
    console.error('Multer错误:', err.code);
    return res.status(400).json({ message: '上传文件错误: ' + err.message });
  } else if (err) {
    // 其他错误
    console.error('其他上传错误:', err.message);
    return res.status(500).json({ message: err.message });
  }
  next();
});

module.exports = router; 