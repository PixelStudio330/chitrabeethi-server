const express = require('express');
const router = express.Router();
const { registerUser, loginUser, googleLogin, updateProfile } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);

// 🌟 ADD THIS ROUTE: Matches exactly what frontend calls via api.put()
router.put('/update-profile', updateProfile);

module.exports = router;