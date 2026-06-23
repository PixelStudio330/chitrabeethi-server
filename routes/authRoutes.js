const express = require('express');
const router = express.Router();

const { 
  registerUser, 
  loginUser, 
  googleLogin, 
  updateProfile, 
  getUserProfile,
  getAllArtists,
  getAllUsers,      // 🌟 Added
  updateUserRole    // 🌟 Added
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.put('/update-profile', updateProfile);

router.get('/user/:id', getUserProfile);
router.get('/artists', getAllArtists);

// 🌟 Admin Dashboard Matrix Operations
router.get('/users', getAllUsers);
router.put('/update-role', updateUserRole);

module.exports = router;