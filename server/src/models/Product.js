const mongoose = require('mongoose');

// 定义SKU的模式
const skuSchema = new mongoose.Schema({
  code: { type: String, required: true },
  color: { type: String },
  size: { type: String },
  image: { type: String }
}, { _id: false });

// 定义外部码关联
const externalCodeSchema = new mongoose.Schema({
  code: { type: String, required: true },
  source: { type: String }, // 来源，例如"客户A"、"客户B"等
  description: { type: String }
}, { _id: false });

const productSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String }, // 可为空，后端兜底
  unit: { type: String, default: '件' },
  image: { type: String },
  description: { type: String },
  has_sku: { type: Boolean, default: false },
  skus: [skuSchema], // 产品可以有多个SKU
  image_path: { type: String }, // 增加图片路径字段，兼容不同格式
  external_codes: [externalCodeSchema] // 关联的外部条码
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema); 