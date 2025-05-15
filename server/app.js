const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./src/routes/auth');
const User = require('./src/models/User');
const productsRoutes = require('./src/routes/products');
const locationsRoutes = require('./src/routes/locations');
const inventoryRoutes = require('./src/routes/inventory');
const inboundRoutes = require('./src/routes/inbound');
const outboundRoutes = require('./src/routes/outbound');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inbound', inboundRoutes);
app.use('/api/outbound', outboundRoutes);

// 这里用环境变量读取 MongoDB 连接字符串
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log('MongoDB connected');
    // 直接在这里创建管理员用户
    const user = await User.findOne({ username: 'wms' });
    if (!user) {
      await User.create({ username: 'wms', password: '123456', role: 'admin' });
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

const PORT = process.env.PORT || 8611;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});