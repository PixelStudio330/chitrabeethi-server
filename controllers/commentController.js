const Comment = require('../models/Comment');
const mongoose = require('mongoose');

// Helper to check if a purchase record exists
const checkPurchaseStatus = async (userId, artworkId) => {
  try {
    // Note: Make sure 'Transaction' matches your actual Mongoose Model name for artwork purchases
    const transaction = await mongoose.model('Transaction').findOne({
      buyerId: userId, 
      artworkId: artworkId
    });
    return !!transaction;
  } catch (error) {
    return false;
  }
};

// @desc    Get comments AND verification state for an artwork
// @route   GET /api/artworks/:id/comments
exports.getArtworkComments = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId; // Passed as an optional query param from frontend

    const comments = await Comment.find({ artworkId: id }).sort({ createdAt: -1 });
    
    // --- FUTURE REQUIRED ASSIGNMENT METRIC ---
    // TODO: Uncomment the line below once Stripe payments are saving transaction documents to the DB
    // const hasPurchased = userId ? await checkPurchaseStatus(userId, id) : false;
    
    // TEMPORARY: Bypassing the check so all logged-in users can write and interact right now
    const hasPurchased = true;

    res.status(200).json({
      comments,
      hasPurchased
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve comments', error: err.message });
  }
};

// @desc    Add a comment (Only allowed if user purchased the artwork)
// @route   POST /api/artworks/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, comment } = req.body;

    if (!comment || comment.trim() === "") {
      return res.status(400).json({ message: "Comment content cannot be empty" });
    }

    // --- FUTURE REQUIRED ASSIGNMENT METRIC ---
    // TODO: Uncomment this validation block once payments/transactions are implemented to secure the backend path.
    /*
    const hasPurchased = await checkPurchaseStatus(userId, id);
    if (!hasPurchased) {
      return res.status(403).json({ 
        message: "Access Denied: Only collectors who have purchased this artwork can leave a review." 
      });
    }
    */

    const newComment = new Comment({ artworkId: id, userId, userName, comment });
    const savedComment = await newComment.save();
    res.status(201).json(savedComment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to post comment', error: err.message });
  }
};

// @desc    Update a comment
// @route   PUT /api/artworks/:id/comments/:commentId
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, comment } = req.body;

    const existingComment = await Comment.findById(commentId);
    if (!existingComment) return res.status(404).json({ message: "Comment not found" });

    // Validate ownership
    if (existingComment.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to edit this comment" });
    }

    existingComment.comment = comment;
    const updated = await existingComment.save();
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update comment', error: err.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/artworks/:id/comments/:commentId
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body; // Pass userId in request body to verify ownership

    const existingComment = await Comment.findById(commentId);
    if (!existingComment) return res.status(404).json({ message: "Comment not found" });

    if (existingComment.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized to delete this comment" });
    }

    await existingComment.deleteOne();
    res.status(200).json({ message: "Comment removed successfully" });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment', error: err.message });
  }
};