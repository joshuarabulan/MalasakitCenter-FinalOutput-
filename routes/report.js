const express = require('express');
const reportController = require('../controllers/reportController');
const router = express.Router();    

router.post('/medical-assistance', reportController.createMedicalAssistanceReport);

router.post('/submit-form', reportController.submitForm);
router.get('/show-services', reportController.showServices);
router.get('/category-usage-report', reportController.categoryUsageReport);
router.post('/insert/category', reportController.insertServiceUsage);


// new routes fo delete
router.get('/delete-bill/:id', reportController.deleteBill);

router.get('/download/service', reportController.downloadServiceUsage);
router.get('/print/service', reportController.printServiceUsage);

module.exports = router;

