const express = require('express');
const router = express.Router();
const { 
  createArtworkCheckout, 
  createSubscriptionCheckout, // Import the new subscription generator
  verifyPayment, 
  handleStripeWebhook,
  getMyTransactions
} = require('../controllers/paymentController');

// Standard JSON Endpoints
router.post('/create-artwork-checkout', express.json(), createArtworkCheckout);
router.post('/create-subscription-checkout', express.json(), createSubscriptionCheckout); // New Route Attached
router.post('/verify-payment', express.json(), verifyPayment); 
router.get('/my-transactions', getMyTransactions);

// Webhook Raw Stream Endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;