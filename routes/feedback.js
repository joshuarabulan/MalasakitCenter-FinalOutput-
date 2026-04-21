const express = require('express');
const feedbackController = require('../controllers/feedbackController');

console.log('Available methods:', Object.keys(feedbackController));
console.log('createFeedback:', typeof feedbackController.createFeedback);
console.log('getFeedback:', typeof feedbackController.getFeedback);
console.log('deleteFeedback:', typeof feedbackController.deleteFeedback);
console.log('deleteAllFeedback:', typeof feedbackController.deleteAllFeedback);

const { createFeedback, getFeedback, deleteAllFeedback, deleteFeedback } = feedbackController;

const router = express.Router();

router.post('/submit', createFeedback);
router.get('/get-feedback', getFeedback);
router.delete('/feedback/:id', deleteFeedback);
router.delete('/feedback', deleteAllFeedback);

module.exports = router;