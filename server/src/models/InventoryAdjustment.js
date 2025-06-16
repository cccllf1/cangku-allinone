const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const inventoryAdjustmentSchema = new mongoose.Schema({
  location_code: { 
    type: String, 
    required: true 
  },
  product_code: { 
    type: String, 
    required: true 
  },
  sku_code: { 
    type: String,
    default: null
  },
  previous_quantity: { 
    type: Number, 
    required: true 
  },
  adjusted_quantity: { 
    type: Number, 
    required: true 
  },
  current_quantity: { 
    type: Number, 
    required: true 
  },
  batch_number: { 
    type: String,
    default: null
  },
  operator_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  notes: { 
    type: String,
    default: ''
  },
  is_urgent: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: true 
});

// Add indexes to improve query performance
inventoryAdjustmentSchema.index({ location_code: 1 });
inventoryAdjustmentSchema.index({ product_code: 1 });
inventoryAdjustmentSchema.index({ sku_code: 1 });
inventoryAdjustmentSchema.index({ operator_id: 1 });
inventoryAdjustmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema); 