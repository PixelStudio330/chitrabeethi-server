const express = require('express');
const router = express.Router();
const { 
  createArtworkCheckout, 
  createSubscriptionCheckout, 
  verifyPayment, 
  handleStripeWebhook,
  getMyTransactions,
  getAllTransactions, 
  getAdminAnalytics   
} = require('../controllers/paymentController');

// Standard JSON Endpoints
router.post('/create-artwork-checkout', express.json(), createArtworkCheckout);
router.post('/create-subscription-checkout', express.json(), createSubscriptionCheckout); 
router.post('/verify-payment', express.json(), verifyPayment); 
router.get('/my-transactions', getMyTransactions);

// Admin Dash Ledger & Graphs Tracking Endpoints
router.get('/all-transactions', getAllTransactions);
router.get('/admin-analytics', getAdminAnalytics);

// Webhook Raw Stream Endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;