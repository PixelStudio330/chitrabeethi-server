const express = require('express');
const router = express.Router({ mergeParams: true });
const { 
  getArtworkComments, 
  addComment, 
  updateComment, 
  deleteComment,
  getUserComments // Import the new controller function
} = require('../controllers/commentController');

// Global route profile context for user-specific collection
router.get('/user/:userId', getUserComments);

router.route('/')
  .get(getArtworkComments)
  .post(addComment);

router.route('/:commentId')
  .put(updateComment)
  .delete(deleteComment);

module.exports = router;