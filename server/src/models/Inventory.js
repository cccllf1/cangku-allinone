const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productCode: { type: String, required: true },
  productName: { type: String },
  unit: { type: String },
  total: { type: Number, default: 0 },
  image: { type: String },
  locations: [
    {
      locationCode: String,
      locationName: String,
      quantity: Number
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema); 