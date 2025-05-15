const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  priority: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema); 