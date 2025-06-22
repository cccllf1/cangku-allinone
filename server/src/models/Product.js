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

// 定义颜色及其尺寸的模式
const colorSizeSchema = new mongoose.Schema({
  sku_size: { type: String, required: true },
  sku_code: { type: String, required: true },
  external_codes: [ { external_code: { type: String } } ],
  sku_total_quantity: { type: Number, default: 0 },
  locations: [{ type: mongoose.Schema.Types.Mixed }]
}, { _id: false });

const colorSchema = new mongoose.Schema({
  color: { type: String, required: true },
  image_path: { type: String },
  color_total_quantity: { type: Number, default: 0 }, // 该颜色下所有尺寸的总数量
  sizes: [colorSizeSchema]
}, { _id: false });

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
  has_sku: { type: Boolean, default: true }, // 系统只支持变体商品
  // 添加商品分类字段
  category_code_1: { type: String }, // 一级分类代码，如 "CLOTHING"
  category_name_1: { type: String }, // 一级分类名称，如 "服装"
  category_code_2: { type: String }, // 二级分类代码，如 "TOPS", "BOTTOMS"
  category_name_2: { type: String }, // 二级分类名称，如 "上装", "下装"
  skus: [skuSchema], // 产品可以有多个SKU
  colors: [colorSchema], // 颜色结构，支持层级管理
  image_path: { type: String }, // 增加图片路径字段，兼容不同格式
  external_codes: [external_codeSchema] // 关联的外部条码（商品级）
}, { timestamps: true });

// 为skus.sku_code添加唯一索引（全局唯一）
productSchema.index({ 'skus.sku_code': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', productSchema); 