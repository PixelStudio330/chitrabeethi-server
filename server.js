const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. GLOBAL MIDDLEWARE ---
app.use(cors({
  origin: ['http://localhost:3000'], 
  credentials: true
}));

// Add this so query parameters and url encoding parse seamlessly everywhere
app.use(express.urlencoded({ extended: true }));

// 💳 Mounted payment routes BEFORE express.json() for Stripe signatures
// This safely captures:
// - POST /api/payments/create-artwork-checkout
// - POST /api/payments/create-subscription-checkout ✨ (YOUR NEW ENDPOINT)
// - POST /api/payments/verify-payment
// - GET  /api/payments/my-transactions
// - POST /api/payments/webhook
app.use('/api/payments', require('./routes/paymentRoutes'));

// Global parsers run for all OTHER routes below
app.use(express.json());

// --- 2. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🍃 Vault Awake: MongoDB Atlas Connected Successfully for Chitrabeethi!'))
  .catch((err) => {
    console.error('❌ Database connection error:', err.message);
    process.exit(1); 
  });

// --- 3. ROUTES INTERCEPTORS ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/artworks', require('./routes/artworkRoutes')); 
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));

// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Chitrabeethi Vault Backend is Alive and Humming! 🚀',
    status: 'healthy'
  });
});

// ✨ GLOBAL 404 JSON INTERCEPTOR FALLBACK
// This catches any invalid routes and ensures JSON is returned, preventing frontend parser crashes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint Not Found - [${req.method}] ${req.originalUrl}. Check backend route configurations!`
  });
});

// --- 4. START SERVER ---
app.listen(PORT, () => {
  console.log(`🎨 Server is running on http://localhost:${PORT}`);
});