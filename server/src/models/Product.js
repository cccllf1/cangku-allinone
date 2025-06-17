const mongoose = require('mongoose');

// 定义SKU的模式
const skuSchema = new mongoose.Schema({
  sku_code: { type: String, required: true },
  sku_color: { type: String }, // 标准字段
  sku_size: { type: String },  // 标准字段
  stock_quantity: { type: Number, default: 0 },
  image_path: { type: String },
  // 保留旧字段兼容
  color: { type: String },
  size: { type: String },
  image: { type: String },
  external_codes: [
    {
      external_code: { type: String, required: true }
    }
  ]
}, { _id: false, strict: false });

// 定义外部码关联（商品级，保留不动）
const external_codeSchema = new mongoose.Schema({
  external_code: { type: String, required: true },
  source: { type: String }, // 来源，例如"客户A"、"客户B"等
  description: { type: String }
}, { _id: false });

const productSchema = new mongoose.Schema({
  product_code: { type: String, required: true, unique: true },
  product_name: { type: String }, // 可为空，后端兜底
  unit: { type: String, default: '件' },
  image: { type: String },
  description: { type: String },
  has_sku: { type: Boolean, default: false },
  skus: [skuSchema], // 产品可以有多个SKU
  image_path: { type: String }, // 增加图片路径字段，兼容不同格式
  external_codes: [external_codeSchema] // 关联的外部条码（商品级）
}, { timestamps: true });

// 为skus.sku_code添加唯一索引（全局唯一）
productSchema.index({ 'skus.sku_code': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', productSchema); 