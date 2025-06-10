const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 定义SKU库存条目子文档
const skuInventorySchema = new mongoose.Schema({
  code: { type: String, required: true }, // SKU编码
  color: { type: String },
  size: { type: String },
  quantity: { type: Number, default: 0 }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
  // 关联到产品
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productCode: { type: String, required: true },
  productName: { type: String },
  unit: { type: String, default: '件' },
  // 总数量，所有库位合计
  quantity: { type: Number, default: 0 },
  image: { type: String },
  // 各库位明细
  locations: [
    {
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      locationCode: String,
      locationName: String,
      quantity: { type: Number, default: 0 },
      // 增加SKU级别的库存数据
      skus: [skuInventorySchema]
    }
  ]
}, { 
  timestamps: true,
  // 添加索引以提高查询性能
  indexes: [
    { product_id: 1 },
    { productCode: 1 }
  ]
});

module.exports = mongoose.model('Inventory', inventorySchema); 