const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

// Clean endpoints map straight to our controller functions
router.post('/register', registerUser);
router.post('/login', loginUser);

module.exports = router;