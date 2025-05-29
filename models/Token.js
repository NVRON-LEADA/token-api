const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  tokenNumber: {
    type: Number,
    required: true,
    unique: true
  },
  patientName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'in-progress', 'completed', 'skipped', 'cancelled'],
    default: 'waiting'
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  estimatedTime: {
    type: Date
  },
  actualTime: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Create index for efficient querying
tokenSchema.index({ status: 1, tokenNumber: 1 });
tokenSchema.index({ isVIP: 1, tokenNumber: 1 });

module.exports = mongoose.model('Token', tokenSchema); 