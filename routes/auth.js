const express = require('express');
const authController = require('../controllers/authController');
const reportController = require('../controllers/reportController');
const patientController = require('../controllers/patientController');
const router = express.Router();
const pdf = require('html-pdf');
const path = require('path');
const ejs = require('ejs');
const multer = require('multer');
const db = require('../config/db');


const upload = multer();

function loadBillingRecord(id, callback) {
  const query = 'SELECT * FROM billing_records WHERE id = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      return callback(err);
    }

    if (!results.length) {
      return callback(null, null);
    }

    const record = results[0];
    const decimalFields = ['non_phf_meds', 'hemodialysis', 'implant'];

    decimalFields.forEach((field) => {
      record[field] = parseFloat(record[field]) || 0;
    });

    let services = [];
    try {
      services = JSON.parse(record.services || '[]').map((service) => ({
        ...service,
        amount: parseFloat(service.amount) || 0,
        discount: parseFloat(service.discount) || 0,
        philhealth_case_rate: parseFloat(service.philhealth_case_rate) || 0,
        amount_due: parseFloat(service.amount_due) || 0
      }));
    } catch (parseError) {
      console.error('Error parsing services:', parseError);
    }

    callback(null, { record, services });
  });
}

function renderBillingRecordTemplate(record, services, callback) {
  ejs.renderFile(
    path.join(__dirname, '..', 'views', 'pdf-clone-template.ejs'),
    { record, services },
    callback
  );
}

function createBillingPdfBuffer(record, services, callback) {
  renderBillingRecordTemplate(record, services, (renderErr, html) => {
    if (renderErr) {
      return callback(renderErr);
    }

    const options = {
      format: 'A4',
      orientation: 'portrait',
      quality: '75',
      type: 'pdf',
      timeout: 30000,
      border: {
        top: '0.1in',
        right: '0.1in',
        bottom: '0.1in',
        left: '0.1in'
      },
      renderDelay: 2000,
      dpi: 96,
      zoomFactor: 1,
      phantomArgs: [
        '--ignore-ssl-errors=yes',
        '--web-security=no',
        '--ssl-protocol=any',
        '--load-images=yes'
      ],
      childProcessOptions: {
        env: {
          OPENSSL_CONF: '/dev/null'
        }
      }
    };

    pdf.create(html, options).toBuffer(callback);
  });
}

function buildPrintPreviewHtml(id) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Print Statement ${id}</title>
      <style>
        html, body {
          margin: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #111827;
        }

        iframe {
          width: 100vw;
          height: 100vh;
          border: 0;
          display: block;
        }
      </style>
    </head>
    <body>
      <iframe id="statementPrintFrame" src="/generate-pdf/${id}?inline=1" title="Statement Print Preview"></iframe>
      <script>
        const frame = document.getElementById('statementPrintFrame');
        frame.addEventListener('load', () => {
          setTimeout(() => {
            try {
              frame.contentWindow.focus();
              frame.contentWindow.print();
            } catch (error) {
              console.error('Print preview error:', error);
            }
          }, 700);
        });
      </script>
    </body>
  </html>`;
}

//Register
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);

//Login
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.logout);
router.get('/admin/feedback/pdf', authController.generateFeedbackPDF);

router.get('/admin/dashboard', authController.getAdminDashboard);
router.get('/admin/analytics', authController.getAdminAnalytics);
router.get('/admin/user-management', authController.getAdminUserManagement);
router.get('/admin/reports', authController.getAdminReports);
router.get('/admin/feedback', authController.getFeedback);
router.get('/admin/statistics', authController.getStatistics);
router.get('/admin/main-form', authController.getMainForm);


// Soft delete routes
router.delete('/admin/soft-delete/:id', authController.softDeleteRecord);
router.patch('/admin/restore/:id', authController.restoreRecord);
router.delete('/admin/permanent-delete/:id', authController.permanentDeleteRecord);
router.delete('/admin/empty-trash', authController.emptyTrash);

// patient
router.get('/patient/dashboard', authController.getPatient);
router.get('/patient/sheet', authController.getIntakeSheet);
router.get('/patient/admin/:id/details', patientController.getAdminPatientDetails);
router.get('/patient/admin/:id/sheet-view', patientController.renderAdminPatientSheetView);
router.post('/patient/notifications/:id/read', authController.markNotificationAsRead);
router.post('/patient/mark-all-notification', authController.markAllNotificationsAsRead);
router.get('/patient/edit-request/:id', authController.getRequestForEdit);
router.post('/patient/update-request/:id', authController.updateRequest);
router.post('/patient/delete-request/:id', authController.deleteRequest);


router.delete('/admin/delete-record/:id', reportController.deleteRecord);
router.delete('/admin/delete-all-records', reportController.deleteAllRecords);

//Forget Password
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/reset-password/:token', authController.getResetPassword);
router.post('/reset-password/:token', authController.postResetPassword);

//landing page
router.get('/', authController.getHome);

router.post('/submit-main-form', upload.none(), authController.submitMainForm);

// Updated route in auth.js
router.get('/generate-pdf/:id', (req, res) => {
  const id = req.params.id;
  const isInline = req.query.inline === '1';

  loadBillingRecord(id, (recordErr, payload) => {
    if (recordErr) {
      console.error('Error fetching record:', recordErr);
      return res.status(500).send('Error fetching record');
    }

    if (!payload) {
      return res.status(404).send('Record not found');
    }

    createBillingPdfBuffer(payload.record, payload.services, (pdfErr, buffer) => {
      if (pdfErr) {
        console.error('Error generating PDF:', pdfErr);
        return res.status(500).send('Error generating PDF');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${isInline ? 'inline' : 'attachment'}; filename=statement-${id}.pdf`
      );
      res.send(buffer);
    });
  });
});

// sa visualization 'to API ba
router.get('/analytics/data', (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  const patientsByMonthQuery = `
    SELECT MONTH(created_at) as month, COUNT(*) as count 
    FROM requests 
    WHERE YEAR(created_at) = ? 
    GROUP BY MONTH(created_at) 
    ORDER BY month
  `;

  const assistanceByMonthQuery = `
    SELECT MONTH(created_at) as month, COUNT(*) as count
    FROM billing_records
    WHERE YEAR(created_at) = ?
      AND (is_deleted = FALSE OR is_deleted IS NULL)
    GROUP BY MONTH(created_at)
    ORDER BY month
  `;

  const ageDistributionQuery = `
    SELECT 
      CASE
        WHEN age BETWEEN 0 AND 18 THEN '0-18'
        WHEN age BETWEEN 19 AND 35 THEN '19-35'
        WHEN age BETWEEN 36 AND 61 THEN '36-61'
        ELSE '61+'
      END as age_group,
      COUNT(*) as count
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    GROUP BY age_group
    ORDER BY age_group
  `;

  const genderAgeDistributionQuery = `
    SELECT 
      CASE
        WHEN age BETWEEN 0 AND 18 THEN '0-18'
        WHEN age BETWEEN 19 AND 35 THEN '19-35'
        WHEN age BETWEEN 36 AND 61 THEN '36-61'
        ELSE '61+'
      END as age_group,
      gender,
      COUNT(*) as count
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    GROUP BY age_group, gender
    ORDER BY age_group, gender
  `;

  const statsQuery = `
    SELECT 
      (SELECT COUNT(*) FROM requests) as total_patients,
      (SELECT COUNT(*) FROM requests WHERE MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)) as prev_month_patients,
      (SELECT COUNT(*) FROM billing_records WHERE (is_deleted = FALSE OR is_deleted IS NULL)) as total_assistance,
      (SELECT COUNT(*) FROM billing_records WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)) as prev_month_assistance,
      (SELECT COUNT(*) FROM requests WHERE status = 'waiting') as pending_concerns,
      (SELECT COUNT(*) FROM requests WHERE status = 'waiting' AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)) as prev_month_concerns,
      (SELECT COALESCE(SUM(total_due), 0) FROM billing_records WHERE (is_deleted = FALSE OR is_deleted IS NULL)) as total_amount,
      (SELECT COALESCE(SUM(total_due), 0) FROM billing_records WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND MONTH(created_at) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)) as prev_month_amount
  `;

  const yearsQuery = `
    SELECT DISTINCT YEAR(created_at) as year 
    FROM requests 
    UNION 
    SELECT DISTINCT YEAR(created_at) as year
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    ORDER BY year DESC
  `;

  db.query(patientsByMonthQuery, [year], (err, patientsByMonthResult) => {
    if (err) {
      console.error('Error fetching patientsByMonth:', err);
      return res.status(500).send('Error fetching analytics data');
    }

    db.query(assistanceByMonthQuery, [year], (err, assistanceByMonthResult) => {
      if (err) {
        console.error('Error fetching assistanceByMonth:', err);
        return res.status(500).send('Error fetching analytics data');
      }

      db.query(ageDistributionQuery, (err, ageDistributionResult) => {
        if (err) {
          console.error('Error fetching ageDistribution:', err);
          return res.status(500).send('Error fetching analytics data');
        }

        db.query(genderAgeDistributionQuery, (err, genderAgeDistributionResult) => {
          if (err) {
            console.error('Error fetching genderAgeDistribution:', err);
            return res.status(500).send('Error fetching analytics data');
          }

          db.query(statsQuery, (err, statsResult) => {
            if (err) {
              console.error('Error fetching stats:', err);
              return res.status(500).send('Error fetching analytics data');
            }

            db.query(yearsQuery, (err, yearsResult) => {
              if (err) {
                console.error('Error fetching years:', err);
                return res.status(500).send('Error fetching analytics data');
              }

              // === Data Processing ===
              const patientsByMonth = Array(12).fill(0);
              patientsByMonthResult.forEach(row => {
                patientsByMonth[row.month - 1] = row.count;
              });

              const assistanceByMonth = Array(12).fill(0);
              assistanceByMonthResult.forEach(row => {
                assistanceByMonth[row.month - 1] = row.count;
              });

              const ageDistribution = [0, 0, 0, 0];
              ageDistributionResult.forEach(row => {
                switch (row.age_group) {
                  case '0-18': ageDistribution[0] = row.count; break;
                  case '19-35': ageDistribution[1] = row.count; break;
                  case '36-61': ageDistribution[2] = row.count; break;
                  case '61+': ageDistribution[3] = row.count; break;
                }
              });

              const genderAgeDistribution = { male: [0, 0, 0, 0], female: [0, 0, 0, 0] };
              genderAgeDistributionResult.forEach(row => {
                const index = ['0-18', '19-35', '36-61', '61+'].indexOf(row.age_group);
                if (index !== -1) {
                  if (row.gender.toLowerCase() === 'male') {
                    genderAgeDistribution.male[index] = row.count;
                  } else if (row.gender.toLowerCase() === 'female') {
                    genderAgeDistribution.female[index] = row.count;
                  }
                }
              });

              const stats = statsResult[0];
              const patientChange = stats.prev_month_patients > 0
                ? ((stats.total_patients - stats.prev_month_patients) / stats.prev_month_patients) * 100
                : 0;

              const assistanceChange = stats.prev_month_assistance > 0
                ? ((stats.total_assistance - stats.prev_month_assistance) / stats.prev_month_assistance) * 100
                : 0;

              const concernChange = stats.prev_month_concerns > 0
                ? ((stats.pending_concerns - stats.prev_month_concerns) / stats.prev_month_concerns) * 100
                : 0;

              const amountChange = stats.prev_month_amount > 0
                ? ((stats.total_amount - stats.prev_month_amount) / stats.prev_month_amount) * 100
                : 0;

              const availableYears = yearsResult.map(row => row.year);

              // Final Response
              res.json({
                patientsByMonth,
                assistanceByMonth,
                ageDistribution,
                genderAgeDistribution,
                stats: {
                  totalPatients: stats.total_patients,
                  patientChange: patientChange.toFixed(1),
                  totalAssistance: stats.total_assistance,
                  assistanceChange: assistanceChange.toFixed(1),
                  pendingConcerns: stats.pending_concerns,
                  concernChange: concernChange.toFixed(1),
                  totalAmount: stats.total_amount,
                  amountChange: amountChange.toFixed(1)
                },
                availableYears
              });
            });
          });
        });
      });
    });
  });
});

router.get('/print-direct/:id', (req, res) => {
  const id = req.params.id;
  loadBillingRecord(id, (recordErr, payload) => {
    if (recordErr) {
      console.error('Error fetching record:', recordErr);
      return res.status(500).send('Error fetching record');
    }

    if (!payload) {
      return res.status(404).send('Record not found');
    }

    res.send(buildPrintPreviewHtml(id));
  });
});


router.post('/users/add', authController.addUser);
router.post('/users/edit/:id', authController.editUser);

// Delete users
router.post('/users/delete/:id', authController.deleteUser);

//users deletion
router.post('/users/delete-all',authController.deleteAllUsers );
router.delete('/users/delete-all', authController.deleteAllUsers);
router.post('/admin/update-status', authController.updatePatientStatus);
router.post('/admin/delete/:id', authController.deletePatient);

module.exports = router;
