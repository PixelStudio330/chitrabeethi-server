const express = require('express');
const router = express.Router();
const { createArtworkCheckout, verifyPayment, handleStripeWebhook } = require('../controllers/paymentController');

// 1. Re-apply express.json() locally just for standard endpoints since they bypass global config now
router.post('/create-artwork-checkout', express.json(), createArtworkCheckout);
router.post('/verify-payment', express.json(), verifyPayment); 

// 2. Direct Autonomous Webhook Listener (Captures purely raw body data stream)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;