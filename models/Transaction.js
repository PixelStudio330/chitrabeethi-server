const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true // This will hold the Stripe Session ID or PaymentIntent ID
  },
  type: {
    type: String,
    enum: ['purchase', 'subscription'],
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Optional: Only populated if type is 'purchase'
  artworkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork'
  },
  // Optional: Only populated if type is 'subscription'
  subscriptionTier: {
    type: String,
    enum: ['pro', 'premium']
  },
  amount: {
    type: Number,
    required: true // Stored in BDT or USD
  },
  buyerEmail: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed'],
    default: 'successful'
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);