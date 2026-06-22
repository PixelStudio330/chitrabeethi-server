const express = require('express');
const router = express.Router();
// 🌟 Added getUserProfile to the imports below:
const { registerUser, loginUser, googleLogin, updateProfile, getUserProfile } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.put('/update-profile', updateProfile);

// 🌟 ADD THIS ROUTE: This answers the frontend when it asks for the fresh user data
router.get('/user/:id', getUserProfile);

module.exports = router;