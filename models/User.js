const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() { return !this.googleId; } 
  },
  googleId: {
    type: String,
    default: null
  },
  profilePicture: {
    type: String,
    // Professional default UI-Avatar
    default: 'https://ui-avatars.com/api/?name=User&background=E2B4BD&color=3D2B1F'
  },
  role: {
    type: String,
    enum: ['user', 'artist', 'admin'],
    default: 'user'
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'pro', 'premium'],
    default: 'free'
  },
  purchasesCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);