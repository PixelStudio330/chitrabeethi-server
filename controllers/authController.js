const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role, profilePicture } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'This email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      profilePicture: profilePicture || undefined 
    });

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role, name: newUser.name, profilePicture: newUser.profilePicture },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { 
        id: newUser._id, 
        name: newUser.name, 
        email: newUser.email, 
        role: newUser.role,
        subscriptionTier: newUser.subscriptionTier || 'free', // 🌟 FIXED
        profilePicture: newUser.profilePicture,
        photoUrl: newUser.profilePicture 
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Login. Please sign in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, profilePicture: user.profilePicture },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      message: 'Logged in successfully!',
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        subscriptionTier: user.subscriptionTier || 'free', // 🌟 FIXED
        profilePicture: user.profilePicture,
        photoUrl: user.profilePicture 
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google verification token is missing." });
    }

    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        profilePicture: picture,
        role: 'user',
      });
    } else if (!user.profilePicture && picture) {
      user.profilePicture = picture;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, profilePicture: user.profilePicture },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      message: 'Authenticated successfully with Google!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier || 'free', // 🌟 FIXED
        profilePicture: user.profilePicture,
        photoUrl: user.profilePicture 
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Google Authentication failed', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { userId, name, photoUrl, password } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User identity verification context missing." });
    }

    const updateData = { 
      name: name, 
      profilePicture: photoUrl 
    };

    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long." });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        return res.status(400).json({ message: "Include both uppercase & lowercase text." });
      }
      
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Resident profile record not found." });
    }

    res.status(200).json({
      success: true,
      message: "Canvas properties re-rendered beautifully!",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        subscriptionTier: updatedUser.subscriptionTier || 'free', // 🌟 FIXED
        profilePicture: updatedUser.profilePicture,
        photoUrl: updatedUser.profilePicture 
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Canvas synchronization failed.", error: error.message });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier || 'free', // 🌟 FIXED
        profilePicture: user.profilePicture,
        photoUrl: user.profilePicture 
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data.", error: error.message });
  }
};