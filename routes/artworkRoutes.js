const express = require("express");
const router = express.Router();
const { 
  getAllArtworks, 
  getArtworkById, 
  createArtwork, 
  updateArtwork, 
  deleteArtwork 
} = require("../controllers/artworkController");

// Import the comment routes handler
const commentRoutes = require("./commentRoutes");

// --- NESTED ROUTES INTERCEPTOR ---
// Re-routes any pattern matching /api/artworks/:id/comments down to the comment router
router.use("/:id/comments", commentRoutes);

// --- BASE ARTWORK ROUTES ---
router.route("/")
  .get(getAllArtworks)
  .post(createArtwork);

router.route("/:id")
  .get(getArtworkById)
  .put(updateArtwork)
  .delete(deleteArtwork);

module.exports = router;