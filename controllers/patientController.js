const db = require('../config/db'); 
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images, PDFs, and Documents only!');
    }
  }
});

function normalizeSingleValue(value) {
  if (Array.isArray(value)) {
    return value.find(Boolean) || null;
  }
  return value || null;
}

function normalizeCheckbox(value) {
  return value ? 1 : 0;
}

function buildPatientFullName(body) {
  return [
    body.first_name,
    body.middle_name,
    body.last_name,
    body.extension
  ].filter(Boolean).join(' ').trim();
}


exports.createReportPatient = (req, res) => {
    const { fullName, phoneNumber, address, concerns } = req.body;

    const sql = `INSERT INTO patients (full_name, phone_number, address, concerns) VALUES (?, ?, ?, ?)`;
    db.query(sql, [fullName, phoneNumber, address, concerns], (err, result) => {
        if (err) {
            console.error('Database Insert Error:', err);
            return res.status(500).send('Database Error');
        }
        console.log('Patient Record Inserted:', result.insertId);
        res.redirect('/patient/dashboard');
    });
} //pag create reports

exports.updateReportPatient = (req, res) => {
    const { id, fullName, phoneNumber, address, concerns } = req.body;

    const sql = `UPDATE patients SET full_name = ?, phone_number = ?, address = ?, concerns = ? WHERE id = ?`;
    db.query(sql, [fullName, phoneNumber, address, concerns, id], (err, result) => {
        if (err) {
            console.error('Error updating patient:', err);
            return res.json({ success: false, message: 'Database error' });
        }
        res.json({ success: true });
    });
} 

  exports.getPatients = (req, res) => {

    if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.redirect('/');
    }
    
      const query = `
        SELECT
          id,
          TRIM(CONCAT_WS(' ', first_name, middle_name, last_name, extension)) AS fullname,
          COALESCE(patient_contact, informant_contact) AS contact_number,
          patient_email AS email,
          birthdate,
          COALESCE(patient_occupation, occupation) AS occupation,
          COALESCE(patient_nationality, nationality) AS nationality,
          COALESCE(patient_civil_status, civil_status) AS civil_status,
          COALESCE(patient_income, monthly_income, 0) AS income,
          COALESCE(medical_assistance, 'Medical Assistance Request') AS med_assistance,
          COALESCE(medical_concern, 'Unified intake sheet submission') AS concern,
          document_path,
          CASE request_status
            WHEN 'under_review' THEN 'waiting'
            WHEN 'denied' THEN 'deny'
            ELSE COALESCE(request_status, 'waiting')
          END AS status,
          created_at
        FROM unified_intake_sheets
        ORDER BY created_at DESC
      `;

      db.query(query, (err, results) => {
          if (err) {
              console.error('Error fetching patients:', err);
              return res.status(500).send('Internal Server Error');
          }

          res.render('admin/patient', { patients: results });
      });
  };

//pag kuha dun sa reports para sa table


exports.updateStatus = (req, res) => {
    const { id, status } = req.body;
    
    if (!id || !status) {
        return res.status(400).json({ success: false, message: "Missing required fields!" });
    }

    const query = "UPDATE patients SET status = ? WHERE id = ?";
    db.query(query, [status, id], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error!" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Patient not found!" });
        }

        res.json({ success: true, message: "Status updated successfully!" });
    });
}; 


// Delete a patient by ID
exports.deletePatient = (req, res) => {
    const { id } = req.params; // Get the patient id from URL

    const query = 'DELETE FROM patients WHERE id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Failed to delete patient!" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Patient not found!" });
        }
        res.json({ success: true, message: "Patient deleted successfully!" });
    });
}

// // Get all patients

exports.createMedicalAssistant = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  upload.single('document')(req, res, function (err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ success: false, message: err });
    }

    const {
      fullname,
      contact_number,
      email,
      birthdate,
      occupation,
      nationality,
      civil_status,
      income,
      med_assistance,
      concern
    } = req.body;

    const documentPath = req.file ? req.file.filename : null;

    const sql = `
      INSERT INTO requests 
        (user_id, fullname, contact_number, email, birthdate, occupation, nationality, civil_status, income, med_assistance, concern, document_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Fixed: Pass SQL string first, then values array, then callback
    db.query(
      sql, // SQL query string
      [    // Values array
        req.session.user.id,
        fullname,
        contact_number,
        email,
        birthdate,
        occupation,
        nationality,
        civil_status,
        income,
        med_assistance,
        concern,
        documentPath
      ],
      (err, result) => {
        if (err) {
          console.error('Error saving request:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        return res.json({ success: true, message: 'Request submitted successfully!' });
      }
    );
  });
};

exports.getSheet = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'User') {
    return res.redirect('/');
  }

  res.render('patient/sheet', {
    user: req.session.user
  });
};

exports.getAdminPatientDetails = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const sql = 'SELECT * FROM unified_intake_sheets WHERE id = ? LIMIT 1';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error('Error fetching intake details:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!results.length) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const record = results[0];
    let familyComposition = [];

    try {
      familyComposition = JSON.parse(record.family_composition || '[]');
    } catch (parseErr) {
      console.error('Error parsing family composition:', parseErr);
    }

    res.json({
      success: true,
      request: {
        ...record,
        fullname: [
          record.first_name,
          record.middle_name,
          record.last_name,
          record.extension
        ].filter(Boolean).join(' ').trim(),
        family_composition: familyComposition
      }
    });
  });
};

exports.renderAdminPatientSheetView = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'Admin') {
    return res.redirect('/');
  }

  const sql = 'SELECT * FROM unified_intake_sheets WHERE id = ? LIMIT 1';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error('Error fetching intake sheet view:', err);
      return res.status(500).send('Database error');
    }

    if (!results.length) {
      return res.status(404).send('Record not found');
    }

    const record = results[0];
    let familyComposition = [];

    try {
      familyComposition = JSON.parse(record.family_composition || '[]');
    } catch (parseErr) {
      console.error('Error parsing family composition for sheet view:', parseErr);
    }

    res.render('admin/intake-sheet-view', {
      user: req.session.user,
      viewMode: 'admin',
      request: {
        ...record,
        fullname: [
          record.first_name,
          record.middle_name,
          record.last_name,
          record.extension
        ].filter(Boolean).join(' ').trim(),
        family_composition: familyComposition
      }
    });
  });
};

exports.renderPatientSheetView = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'User') {
    return res.redirect('/');
  }

  const sql = 'SELECT * FROM unified_intake_sheets WHERE id = ? AND user_id = ? LIMIT 1';
  db.query(sql, [req.params.id, req.session.user.id], (err, results) => {
    if (err) {
      console.error('Error fetching patient intake sheet view:', err);
      return res.status(500).send('Database error');
    }

    if (!results.length) {
      return res.status(404).send('Record not found');
    }

    const record = results[0];
    let familyComposition = [];

    try {
      familyComposition = JSON.parse(record.family_composition || '[]');
    } catch (parseErr) {
      console.error('Error parsing patient family composition for sheet view:', parseErr);
    }

    res.render('admin/intake-sheet-view', {
      user: req.session.user,
      viewMode: 'patient',
      request: {
        ...record,
        fullname: [
          record.first_name,
          record.middle_name,
          record.last_name,
          record.extension
        ].filter(Boolean).join(' ').trim(),
        family_composition: familyComposition
      }
    });
  });
};

exports.createIntakeRecord = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'User') {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  upload.single('document')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ success: false, message: typeof err === 'string' ? err : 'File upload error' });
    }

    const familyMembers = req.body.family_members || '[]';
    const fullName = buildPatientFullName(req.body);

    const columns = [
      'user_id', 'philhealth_no', 'hospital_no', 'intake_date', 'intake_time', 'informant_name',
      'informant_relation', 'informant_address', 'informant_contact', 'last_name', 'first_name',
      'middle_name', 'extension', 'sex', 'birthdate', 'age', 'birth_place', 'permanent_address',
      'present_address', 'civil_status', 'religion', 'nationality', 'education', 'occupation',
      'monthly_income', 'family_composition', 'house_lot', 'light_source', 'water_source',
      'artesian_well', 'water_district', 'expenses_food', 'expenses_education', 'expenses_clothing',
      'expenses_transportation', 'expenses_househelp', 'expenses_medical', 'expenses_insurance',
      'expenses_others', 'problem_health', 'problem_health_specify', 'problem_economic',
      'problem_economic_specify', 'problem_food', 'problem_food_specify', 'problem_housing',
      'problem_housing_specify', 'problem_employment', 'problem_employment_specify', 'problem_others',
      'problem_others_specify', 'client_name_signature', 'assessment_financially_capable',
      'assessment_lack_resources', 'assessment_medical_checkup', 'assessment_resources_exhausted',
      'recommendation_hospital_bill', 'recommendation_lab_diagnostic',
      'recommendation_medical_supplies', 'recommendation_amount', 'recommendation_mode',
      'recommendation_fund_source', 'interviewed_by', 'approved_by', 'request_date', 'request_status',
      'medical_assistance', 'medical_concern', 'patient_contact', 'patient_email', 'patient_occupation',
      'patient_income', 'patient_nationality', 'patient_civil_status', 'document_path'
    ];

    const values = [
      req.session.user.id,
      req.body.philhealth_no || null,
      req.body.hospital_no || null,
      req.body.intake_date || null,
      req.body.intake_time || null,
      req.body.informant_name || null,
      req.body.relation_to_patient || null,
      req.body.address || null,
      req.body.contact_number || null,
      req.body.last_name || null,
      req.body.first_name || null,
      req.body.middle_name || null,
      req.body.extension || null,
      req.body.sex || null,
      req.body.birth_date || null,
      req.body.age || null,
      req.body.place_of_birth || null,
      req.body.permanent_address || null,
      req.body.present_address || null,
      normalizeSingleValue(req.body.civil_status),
      req.body.religion || null,
      req.body.nationality || null,
      normalizeSingleValue(req.body.education),
      req.body.occupation || null,
      req.body.monthly_income || null,
      familyMembers,
      normalizeSingleValue(req.body.house_status),
      normalizeSingleValue(req.body.light_source),
      req.body.water_source || null,
      normalizeSingleValue(req.body.artesian_well),
      req.body.water_district || null,
      req.body.food_expense || null,
      req.body.education_expense || null,
      req.body.clothing_expense || null,
      req.body.transportation_expense || null,
      req.body.househelp_expense || null,
      req.body.medical_expense || null,
      req.body.insurance_expense || null,
      req.body.other_expense && !Number.isNaN(Number(req.body.other_expense)) ? req.body.other_expense : null,
      normalizeCheckbox(req.body.prob_health),
      req.body.problem_health || null,
      normalizeCheckbox(req.body.prob_economic),
      req.body.problem_economic || null,
      normalizeCheckbox(req.body.prob_food),
      req.body.problem_food || null,
      normalizeCheckbox(req.body.prob_housing),
      req.body.problem_housing || null,
      normalizeCheckbox(req.body.prob_employment),
      req.body.problem_employment || null,
      normalizeCheckbox(req.body.prob_others),
      req.body.problem_others || null,
      req.body.client_name_signature || fullName || req.session.user.name,
      normalizeCheckbox(req.body.assessment_1),
      normalizeCheckbox(req.body.assessment_2),
      normalizeCheckbox(req.body.assessment_3),
      normalizeCheckbox(req.body.assessment_4),
      normalizeCheckbox(req.body.assist_hospital_bill),
      normalizeCheckbox(req.body.assist_lab_diagnostic),
      normalizeCheckbox(req.body.assist_medical_supplies),
      req.body.assistance_amount || null,
      req.body.assistance_mode || 'Medical Assistance',
      req.body.fund_source || 'MC-MAIP',
      req.body.interviewed_by || null,
      req.body.approved_by || 'DOROTHY JOY C. ZAMORA, RSW',
      req.body.intake_date || null,
      'submitted',
      req.body.medical_assistance || 'Medical Assistance Request',
      [
        req.body.problem_health,
        req.body.problem_economic,
        req.body.problem_food,
        req.body.problem_housing,
        req.body.problem_employment,
        req.body.problem_others
      ].filter(Boolean).join(' | ') || 'Unified intake sheet submission',
      req.body.contact_number || null,
      req.body.patient_email || req.session.user.email || null,
      req.body.occupation || null,
      req.body.monthly_income || null,
      req.body.nationality || null,
      normalizeSingleValue(req.body.civil_status),
      req.file ? req.file.filename : null
    ];

    const sql = `
      INSERT INTO unified_intake_sheets (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})
    `;

    db.query(sql, values, (dbErr, result) => {
      if (dbErr) {
        console.error('Error saving intake record:', dbErr);
        return res.status(500).json({ success: false, message: `Database error: ${dbErr.message}` });
      }

      res.json({
        success: true,
        message: 'Intake sheet submitted successfully.',
        id: result.insertId
      });
    });
  });
};
