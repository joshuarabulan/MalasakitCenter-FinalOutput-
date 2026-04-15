const express = require('express');
const {
  createReportPatient,
  updateReportPatient,
  getPatients,
  updateStatus,
  deletePatient,
  createMedicalAssistant,
  getSheet,
  createIntakeRecord,
  getAdminPatientDetails,
  renderAdminPatientSheetView
} = require('../controllers/patientController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/submit', createReportPatient);
router.post('/update', updateReportPatient);
router.get('/admin', getPatients);
router.get('/admin/:id/details', getAdminPatientDetails);
router.get('/admin/:id/sheet-view', renderAdminPatientSheetView);
router.post('/admin/update', updateStatus);
router.post('/admin/delete/:id', deletePatient);

router.post('/blah/:id', authController.acceptPatient);

router.post('/save-request', createMedicalAssistant);
router.get('/sheet', getSheet);
router.post('/intake/create', createIntakeRecord);


module.exports = router;
