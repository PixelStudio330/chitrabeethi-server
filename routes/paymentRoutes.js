const express = require('express');
const router = express.Router();
const { 
  createArtworkCheckout, 
  verifyPayment, 
  handleStripeWebhook,
  getMyTransactions // 1. Import the new controller
} = require('../controllers/paymentController');

// 2. Re-apply express.json() locally just for standard endpoints since they bypass global config now
router.post('/create-artwork-checkout', express.json(), createArtworkCheckout);
router.post('/verify-payment', express.json(), verifyPayment); 

// 3. Register the dashboard data streaming route
router.get('/my-transactions', getMyTransactions);

// 4. Direct Autonomous Webhook Listener (Captures purely raw body data stream)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;