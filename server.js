const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. MIDDLEWARE ---
// CORS options: Allow requests from your local frontend development port
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
    process.exit(1); // Stop the server if connection fails
  });

// --- 3. HEALTH CHECK ROUTE ---
// --- ROUTES INTERCEPTORS ---
app.use('/api/auth', require('./routes/authRoutes'));
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