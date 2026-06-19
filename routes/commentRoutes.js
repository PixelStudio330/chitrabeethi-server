const express = require('express');
const router = express.Router({ mergeParams: true });
const { getArtworkComments, addComment, updateComment, deleteComment } = require('../controllers/commentController');

router.route('/')
  .get(getArtworkComments)
  .post(addComment);

router.route('/:commentId')
  .put(updateComment)
  .delete(deleteComment);

module.exports = router;