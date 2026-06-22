const Wishlist = require("../models/Wishlist");
const mongoose = require("mongoose"); // <-- Make sure mongoose is imported here!

// @desc    Fetch target user's current complete wishlist entries aggregation array map
// @route   GET /api/wishlist
// @access  Public (Via Query Param)
exports.getUserWishlist = async (req, res) => {
  try {
    const { userId } = req.query; 
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required to fetch wishlist items." });
    }

    // Explicitly convert the string userId into a valid Mongoose ObjectId 
    // to prevent blank results from mismatched query structures.
    let queryUser = userId;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      queryUser = new mongoose.Types.ObjectId(userId);
    }

    const items = await Wishlist.find({ user: queryUser })
      .populate({
        path: "artwork",
        populate: { path: "artist", select: "name email" }
      });

    console.log(`Live Wishlist Sync: Found ${items.length} items for User ${userId}`); // Debug log to see your terminal output
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

    // Explicitly convert the string userId into a valid Mongoose ObjectId
    let queryUser = userId;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      queryUser = new mongoose.Types.ObjectId(userId);
    }

    const existingRecord = await Wishlist.findOne({ user: queryUser, artwork: artworkId });

    if (existingRecord) {
      await existingRecord.deleteOne();
      return res.status(200).json({ success: true, added: false, message: "Artwork removed from wishlist." });
    } else {
      await Wishlist.create({ user: queryUser, artwork: artworkId });
      return res.status(201).json({ success: true, added: true, message: "Artwork saved to wishlist reference." });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};