const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, minlength: 1 },
  name: { type: String },
  description: { type: String },
  priority: { type: Number, default: 0 },
  defective: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema); 