const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. MIDDLEWARE ---
app.use(cors({
  origin: ['http://localhost:3000'], // Add your Vercel URL here later during deployment
  credentials: true
}));
app.use(express.json()); // Parses incoming JSON payloads

// --- 2. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🍃 Vault Awake: MongoDB Atlas Connected Successfully for Chitrabeethi!'))
  .catch((err) => {
    console.error('❌ Database connection error:', err.message);
    process.exit(1); 
  });

// --- 3. ROUTES INTERCEPTORS ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/artworks', require('./routes/artworkRoutes')); // Handles /api/artworks AND /api/artworks/:id/comments
app.use('/api/wishlist', require('./routes/wishlistRoutes'));

// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Chitrabeethi Vault Backend is Alive and Humming! 🚀',
    status: 'healthy'
  });
});

// --- 4. START SERVER ---
app.listen(PORT, () => {
  console.log(`🎨 Server is running on http://localhost:${PORT}`);
});