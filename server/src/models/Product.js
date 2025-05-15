const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String }, // 可为空，后端兜底
  unit: { type: String },
  image: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema); 