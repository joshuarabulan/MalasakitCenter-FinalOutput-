const express = require('express');
const { createFeedback, getFeedback, deleteAllFeedback, deleteFeedback } = require('../controllers/feedbackController');

const router = express.Router();

router.post('/submit', createFeedback);
router.post('/get-feedback', getFeedback);   // ← POST as you have it
router.delete('/feedback/:id', deleteFeedback);
router.delete('/feedback', deleteAllFeedback);

module.exports = router;