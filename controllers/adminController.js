const db = require('../config/db'); 
const multer = require('multer');
const path = require('path');

// Get intake sheet by ID (for all users)
exports.getIntakeSheet = (req, res) => {
  const intakeId = req.params.id;

  const sql = `SELECT * FROM unified_intake_sheets WHERE id = ?`;

  db.query(sql, [intakeId], (err, results) => {
    if (err) {
      console.error('Error fetching intake sheet:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Intake sheet not found' });
    }

    const intake = results[0];

    if (intake.family_composition) {
      try {
        intake.family_composition_parsed = JSON.parse(intake.family_composition);
      } catch (e) {
        intake.family_composition_parsed = [];
      }
    } else {
      intake.family_composition_parsed = [];
    }

    res.json({ success: true, intake });
  });
};

// Get all draft intake sheets (for all users)
exports.getIntakeDrafts = (req, res) => {
  const sql = `
    SELECT * FROM unified_intake_sheets 
    WHERE request_status = 'draft'
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching drafts:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Parse family_composition for each draft
    const drafts = results.map(draft => {
      if (draft.family_composition) {
        try {
          draft.family_composition_parsed = JSON.parse(draft.family_composition);
        } catch (e) {
          draft.family_composition_parsed = [];
        }
      } else {
        draft.family_composition_parsed = [];
      }
      return draft;
    });

    res.json({ success: true, drafts });
  });
};

// Delete intake sheet (any user)
exports.deleteIntake = (req, res) => {
  const intakeId = req.params.id;

  const sql = `DELETE FROM unified_intake_sheets WHERE id = ?`;

  db.query(sql, [intakeId], (err, result) => {
    if (err) {
      console.error('Error deleting intake:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Intake not found' });
    }

    res.json({ success: true, message: 'Intake deleted successfully' });
  });
};
