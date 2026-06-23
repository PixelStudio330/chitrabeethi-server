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

/**
 * @route   POST /api/payments/verify-payment
 * @desc    Verify Stripe session state, record database entry, and 
 * dispatch an automated mock invoice via Nodemailer/Ethereal SMTP
 */
router.post('/verify-payment', express.json(), verifyPayment); 

router.get('/my-transactions', getMyTransactions);

// Admin Dash Ledger & Graphs Tracking Endpoints
router.get('/all-transactions', getAllTransactions);
router.get('/admin-analytics', getAdminAnalytics);

/**
 * @route   POST /api/payments/webhook
 * @desc    Raw Stream endpoint handling Stripe fulfillment events. 
 * (Alternative location to trigger Nodemailer loops during live webhook processing)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;