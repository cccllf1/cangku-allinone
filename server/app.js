const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const authRoutes = require('./src/routes/auth');
const User = require('./src/models/User');
const productsRoutes = require('./src/routes/products');
const locationsRoutes = require('./src/routes/locations');
const inventoryRoutes = require('./src/routes/inventory');
const inboundRoutes = require('./src/routes/inbound');
const outboundRoutes = require('./src/routes/outbound');
const uploadRoutes = require('./src/routes/upload');
const skuExternalCodesRoutes = require('./src/routes/skuExternalCodes');

dotenv.config();

const app = express();

console.log('server/app.js 已加载');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 国际化 & 统一响应包装
const i18nMiddleware = require('./src/middleware/i18n');
app.use(i18nMiddleware);

// 创建上传文件夹
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('已创建上传文件夹:', uploadDir);
} else {
  console.log('上传文件夹已存在:', uploadDir);
  // 暂时注释掉文件列举以避免启动时卡住
  // const files = fs.readdirSync(uploadDir);
  // console.log('上传文件夹中的文件:', files);
  console.log('文件列举已跳过，避免启动延迟');
}

// 静态文件服务
app.use('/uploads', (req, res, next) => {
  console.log('访问上传文件:', req.url);
  console.log('完整请求路径:', req.protocol + '://' + req.get('host') + req.originalUrl);
  next();
}, express.static(uploadDir, {
  setHeaders: function (res, path, stat) {
    // 设置缓存控制和CORS头信息
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    // 输出文件信息到日志
    console.log('提供文件:', path);
    console.log('文件大小:', stat.size, 'bytes');
  }
}));
console.log('已配置静态文件服务路径:', '/uploads', '->',  uploadDir);

// 静态文件服务 - public目录
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
console.log('已配置静态文件服务路径:', 'public', '->',  publicDir);

// 测试路由，用于检查静态文件配置
app.get('/api/uploads-check', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    res.json({
      message: '上传目录检查成功',
      uploadDir,
      files,
      baseUrl: req.protocol + '://' + req.get('host'),
      uploadUrl: req.protocol + '://' + req.get('host') + '/uploads'
    });
  } catch (error) {
    res.status(500).json({
      message: '上传目录检查失败',
      error: error.message,
      uploadDir
    });
  }
});

// 存储扫码结果的简单数组（重启后会清空）
let scanResults = [];

// WebSocket服务器变量（后面会初始化）
let wss = null;

// 广播新扫码结果给所有WebSocket客户端
function broadcastScanResult(scanResult) {
  if (!wss) return; // 如果WebSocket服务器未初始化，直接返回
  
  const message = JSON.stringify({
    type: 'NEW_SCAN_RESULT',
    barcode: scanResult.barcode,
    time: scanResult.time,
    room: scanResult.room,
    scanType: scanResult.type
  });
  
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      console.log('📤 已发送扫码结果到WebSocket客户端');
    }
  });
}

// 广播清空通知给所有WebSocket客户端
function broadcastClearNotification() {
  if (!wss) return; // 如果WebSocket服务器未初始化，直接返回
  
  const message = JSON.stringify({
    type: 'SCAN_RESULTS_CLEARED',
    message: '扫码记录已清空'
  });
  
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      console.log('📤 已发送清空通知到WebSocket客户端');
    }
  });
}

// PDA扫码结果处理路由
app.post('/mobile-scanner-result', (req, res) => {
  const { room, barcode, type } = req.body;
  console.log('🔍 收到PDA扫码结果:', { room, barcode, type });
  
  // 创建扫码结果对象
  const scanResult = {
    barcode: barcode,
    time: new Date().toLocaleString(),
    room: room,
    type: type
  };
  
  // 保存扫码结果
  scanResults.push(scanResult);
  
  // 只保留最近50条记录
  if (scanResults.length > 50) {
    scanResults = scanResults.slice(-50);
  }
  
  // 立即广播新扫码结果给所有WebSocket客户端
  broadcastScanResult(scanResult);
  
  res.json({ 
    success: true, 
    message: '扫码结果已接收并广播',
    data: { room, barcode, type }
  });
});

// 获取扫码结果的API
app.get('/api/scan-results', (req, res) => {
  res.json({
    success: true,
    results: scanResults
  });
});

// 清空扫码结果的API
app.post('/api/clear-scan-results', (req, res) => {
  console.log('🗑️ 清空扫码结果');
  scanResults = [];
  
  // 广播清空通知给所有WebSocket客户端
  broadcastClearNotification();
  
  res.json({
    success: true,
    message: '扫码结果已清空并广播'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inbound', inboundRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sku', skuExternalCodesRoutes);

// 这里用环境变量读取 MongoDB 连接字符串
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log('MongoDB connected');
    // 直接在这里创建管理员用户
    const user = await User.findOne({ user_name: 'wms' });
    if (!user) {
      await User.create({ user_name: 'wms', password: '123456', role: 'admin' });
      console.log('管理员用户已创建：wms/123456');
    } else {
      console.log('管理员用户已存在');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
wss = new WebSocket.Server({ 
  server,
  path: '/ws/scan-results'
});

// WebSocket连接处理
wss.on('connection', function connection(ws, req) {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
  console.log('📱 新的WebSocket连接已建立:', clientIp);
  
  // 发送欢迎消息和当前状态
  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    message: 'WebSocket连接成功',
    currentResults: scanResults.length,
    timestamp: new Date().toISOString()
  }));
  
  // 如果有现有数据，发送最新的一条
  if (scanResults.length > 0) {
    const latestResult = scanResults[scanResults.length - 1];
    ws.send(JSON.stringify({
      type: 'CURRENT_STATE',
      barcode: latestResult.barcode,
      time: latestResult.time,
      room: latestResult.room,
      scanType: latestResult.type,
      totalResults: scanResults.length
    }));
  }
  
  // 处理客户端消息
  ws.on('message', function(message) {
    try {
      const data = JSON.parse(message);
      console.log('📨 收到WebSocket消息:', data);
      
      // 可以处理客户端发送的命令
      switch(data.type) {
        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          break;
        case 'GET_CURRENT_STATE':
          ws.send(JSON.stringify({
            type: 'CURRENT_STATE',
            results: scanResults,
            timestamp: new Date().toISOString()
          }));
          break;
        default:
          console.log('未知的WebSocket消息类型:', data.type);
      }
    } catch (error) {
      console.error('处理WebSocket消息失败:', error);
    }
  });
  
  ws.on('close', function() {
    console.log('🔌 WebSocket连接已断开:', clientIp);
  });
  
  ws.on('error', function(error) {
    console.error('❌ WebSocket错误:', error);
  });
  
  // 发送心跳包
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString(),
        connectedClients: wss.clients.size
      }));
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // 每30秒发送一次心跳
});

// 监听WebSocket服务器
wss.on('listening', () => {
  console.log('📡 WebSocket服务器已启动，路径: /ws/scan-results');
});

wss.on('error', (error) => {
  console.error('❌ WebSocket服务器错误:', error);
});



const PORT = process.env.PORT || 8611;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTP服务器已启动: http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket服务器已启动: ws://0.0.0.0:${PORT}/ws/scan-results`);
  console.log(`🔗 API接口: http://0.0.0.0:${PORT}/api/scan-results`);
  console.log(`📱 PDA上传接口: http://0.0.0.0:${PORT}/mobile-scanner-result`);
  console.log(`📊 当前扫码记录数量: ${scanResults.length}`);
});