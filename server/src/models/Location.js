const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, minlength: 1 },
  name: { type: String },
  description: { type: String },
  priority: { type: Number, default: 0 },
  defective: { type: Boolean, default: false },
  category1: { type: String },
  category2: { type: String },
  category1Label: { type: String, default: '一级分类' },
  category2Label: { type: String, default: '二级分类' }
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema); 