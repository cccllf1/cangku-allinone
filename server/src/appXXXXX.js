const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const locationsRoutes = require('./routes/locations');
const inventoryRoutes = require('./routes/inventory');
const inboundRoutes = require('./routes/inbound');
const outboundRoutes = require('./routes/outbound');

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

console.log('app.js 已加载');
let skuExternalCodesRoutes;
try {
  skuExternalCodesRoutes = require('./routes/skuExternalCodes');
  console.log('skuExternalCodesRoutes require 成功');
} catch (e) {
  console.error('skuExternalCodesRoutes require 失败', e);
}

app.use('/api/sku', skuExternalCodesRoutes);

mongoose.connect('mongodb://192.168.11.252:27017/cangku-guanli', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
}); 