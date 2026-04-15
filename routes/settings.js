const express = require('express');
const settingsController = require('../controllers/settingsController');
const router = express.Router();

router.post('/', settingsController.updateSettings);

module.exports = router;