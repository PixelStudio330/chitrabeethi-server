const Wishlist = require("../models/Wishlist");
const mongoose = require("mongoose");

// @desc    Fetch target user's current complete wishlist entries aggregation array map
// @route   GET /api/wishlist
// @access  Public (Via Query Param)
exports.getUserWishlist = async (req, res) => {
  try {
    const { userId } = req.query; 
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required to fetch wishlist items." });
    }

    const items = await Wishlist.find({ user: userId.trim() })
      .populate({
        path: "artwork",
        populate: { path: "artist", select: "name email" }
      });

    console.log(`Live Wishlist Sync: Found ${items.length} items for User ${userId}`); 
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle wishlist state context assignment target
// @route   POST /api/wishlist/toggle
// @access  Public (Via Body Payload)
exports.toggleWishlistItem = async (req, res) => {
  try {
    const { artworkId, userId } = req.body; 
    
    if (!artworkId || !userId) {
      return res.status(400).json({ success: false, message: "Missing required artwork asset or user identifier." });
    }

    const cleanUserId = userId.trim();
    const cleanArtworkId = artworkId.trim();

    // Look for the record using the sanitized string keys directly
    const existingRecord = await Wishlist.findOne({ 
      user: cleanUserId, 
      artwork: cleanArtworkId 
    });

    if (existingRecord) {
      await existingRecord.deleteOne();
      console.log(`🗑️ Wishlist Sync: Removed item ${cleanArtworkId} for User ${cleanUserId}`);
      return res.status(200).json({ success: true, added: false, message: "Artwork removed from wishlist." });
    } else {
      await Wishlist.create({ 
        user: cleanUserId, 
        artwork: cleanArtworkId 
      });
      console.log(`✨ Wishlist Sync: Created item ${cleanArtworkId} for User ${cleanUserId}`);
      return res.status(201).json({ success: true, added: true, message: "Artwork saved to wishlist reference." });
    }
  } catch (error) {
    console.error("TOGGLE WISHLIST BACKEND ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};