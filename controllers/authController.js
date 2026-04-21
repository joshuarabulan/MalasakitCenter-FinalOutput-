const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const fs = require('fs');

 
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
    fileSize: 5 * 1024 * 1024 
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


exports.getRegister = (req, res) => {
    res.render('auth/register', { error: null });
}; 

exports.postRegister = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email already in use' 
            });
        }

        await User.create(name, email, password, role);

        return res.json({ 
            success: true, 
            message: 'Registration successful!' 
        });

    } catch (error) {
        console.error('Register Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Something went wrong, please try again.' 
        });
    }
};

exports.getLogin = (req, res) => {
    res.render('auth/login', { error: null });
}; 

exports.getAdminDashboard = async (req, res) => { 
    if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.redirect('/');
    }

    try {
        const [
            totalRequestsResult,
            pendingRequestsResult,
            currentMonthCostResult,
            lastMonthCostResult,
            avgAssistanceResult,
            costPerMonthResult,
            newRequestsPerMonthResult,
            recentAssistanceResult,
            recentRequestsResult,
            currentMonthRequestsResult,
            previousMonthRequestsResult,
            currentMonthPendingResult,
            previousMonthPendingResult,
            deletedHistoryResult
        ] = await Promise.all([
            queryAsync('SELECT COUNT(*) AS total FROM requests'),
            queryAsync('SELECT COUNT(*) AS total FROM requests WHERE status = "waiting"'),
            queryAsync(`
                SELECT COALESCE(SUM(total_due), 0) AS total
                FROM billing_records
                WHERE (is_deleted = FALSE OR is_deleted IS NULL)
                  AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
            `),
            queryAsync(`
                SELECT COALESCE(SUM(total_due), 0) AS total
                FROM billing_records
                WHERE (is_deleted = FALSE OR is_deleted IS NULL)
                  AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m')
            `),
            queryAsync(`
                SELECT COALESCE(AVG(total_due), 0) AS avg
                FROM billing_records
                WHERE (is_deleted = FALSE OR is_deleted IS NULL)
            `),
            queryAsync(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total_due) AS total_cost
                FROM billing_records
                WHERE (is_deleted = FALSE OR is_deleted IS NULL)
                  AND created_at >= CURDATE() - INTERVAL 24 MONTH
                GROUP BY month
                ORDER BY month ASC
            `),
            queryAsync(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total_requests 
                FROM requests 
                WHERE created_at >= CURDATE() - INTERVAL 24 MONTH
                GROUP BY month 
                ORDER BY month ASC
            `),
            queryAsync(`
                SELECT name, address, created_at AS date, total_due AS total
                FROM billing_records
                WHERE (is_deleted = FALSE OR is_deleted IS NULL)
                ORDER BY created_at DESC
                LIMIT 5
            `),
            queryAsync(`
                SELECT id, fullname, contact_number, concern, status, created_at 
                FROM requests 
                ORDER BY created_at DESC 
                LIMIT 5
            `),
            queryAsync(`
                SELECT COUNT(*) AS total 
                FROM requests 
                WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
            `),
            queryAsync(`
                SELECT COUNT(*) AS total 
                FROM requests 
                WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m')
            `),
            queryAsync(`
                SELECT COUNT(*) AS total 
                FROM requests 
                WHERE status = 'waiting' 
                AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
            `),
            queryAsync(`
                SELECT COUNT(*) AS total 
                FROM requests 
                WHERE status = 'waiting' 
                AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m')
            `),
            queryAsync(`
                SELECT 
                    h.id,
                    h.table_name AS entity_type, 
                    h.record_id AS entity_id, 
                    COALESCE(u.name, 'Unknown User') AS deleted_by, 
                    h.deleted_at, 
                    h.details
                FROM deleted_history h
                LEFT JOIN users u ON h.deleted_by = u.id
                ORDER BY h.deleted_at DESC
                LIMIT 20
            `)
        ]);

        const currentMonthCost = currentMonthCostResult[0].total;
        const lastMonthCost = lastMonthCostResult[0].total;
        const costChange = lastMonthCost > 0 ? 
            Math.round(((currentMonthCost - lastMonthCost) / lastMonthCost) * 100) : 0;
        
        const currentMonthRequests = currentMonthRequestsResult[0].total;
        const previousMonthRequests = previousMonthRequestsResult[0].total;
        const requestGrowthRate = previousMonthRequests > 0 ? 
            Math.round(((currentMonthRequests - previousMonthRequests) / previousMonthRequests) * 100) : 0;
        
        const currentMonthPending = currentMonthPendingResult[0].total;
        const previousMonthPending = previousMonthPendingResult[0].total;
        const requestChange = currentMonthPending - previousMonthPending;
        const normalizedRecentAssistance = recentAssistanceResult.map(item => ({
            ...item,
            total: parseFloat(item.total || 0)
        }));

        const formattedDeleteHistory = deletedHistoryResult.map(item => {
            let parsedDetails = item.details;
            try {
                if (item.details) {
                    parsedDetails = JSON.parse(item.details);
                }
            } catch (e) {
            }
            
            return {
                ...item,
                details: parsedDetails,
                formatted_date: new Date(item.deleted_at).toLocaleString()
            };
        });

        res.render('admin/dashboard', {
            user: req.session.user,
            metrics: {
                totalRequests: totalRequestsResult[0].total,
                pendingRequests: pendingRequestsResult[0].total,
                currentMonthCost,
                costChange,
                requestGrowthRate,
                avgAssistance: avgAssistanceResult[0].avg,
                requestChange
            },
            costPerMonth: costPerMonthResult,
            newRequestsPerMonth: newRequestsPerMonthResult,
            recentAssistance: normalizedRecentAssistance,
            recentRequests: recentRequestsResult,
            deleteHistory: formattedDeleteHistory
        });
        
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).render('error', { 
            message: 'Server Error',
            error: err
        });
    }
};

function queryAsync(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

function patientRequestSelectSql(whereClause = '') {
    return `
        SELECT
            id,
            user_id,
            TRIM(CONCAT_WS(' ', first_name, middle_name, last_name, extension)) AS fullname,
            COALESCE(patient_contact, informant_contact) AS contact_number,
            patient_email AS email,
            birthdate,
            COALESCE(patient_occupation, occupation) AS occupation,
            COALESCE(patient_nationality, nationality) AS nationality,
            COALESCE(patient_civil_status, civil_status) AS civil_status,
            COALESCE(patient_income, monthly_income, 0) AS income,
            COALESCE(medical_assistance, 'Medical Assistance Request') AS med_assistance,
            COALESCE(medical_concern, problem_health_specify, problem_economic_specify, problem_food_specify, problem_housing_specify, problem_employment_specify, problem_others_specify, 'Unified intake sheet submission') AS concern,
            document_path,
            CASE request_status
                WHEN 'under_review' THEN 'waiting'
                WHEN 'denied' THEN 'deny'
                ELSE COALESCE(request_status, 'waiting')
            END AS status,
            created_at
        FROM unified_intake_sheets
        ${whereClause}
        ORDER BY created_at DESC
    `;
}


exports.getAdminAnalytics = (req, res) => {
    res.render('admin/data-visualization');
 } 

 exports.getIntakeSheet = (req, res) => {
    res.render('patient/sheet', { user: req.session.user || null });
 } 

exports.getPatient = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'User') {
    return res.redirect('/');
  }


  const userId = req.session.user.id;
  
  const requestsSql = patientRequestSelectSql('WHERE user_id = ?');
  db.query(requestsSql, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching requests:', err);
      return res.status(500).send('Database error');
    }
    
    const notificationsSql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`;
    db.query(notificationsSql, [userId], (err, notifications) => {
      if (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).send('Database error');
      }
      
      res.render('patient/dashboard', { 
        user: req.session.user, 
        requests: results, 
        notifications: notifications 
      });
    });
  });
};

exports.markNotificationAsRead = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const userId = req.session.user.id;
  const notificationId = req.params.id;

  const sql = `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`;
  db.query(sql, [notificationId, userId], (err, result) => {
    if (err) {
      console.error('Error updating notification:', err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, message: 'Notification marked as read' });
  });
};

exports.markAllNotificationsAsRead = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const userId = req.session.user.id;

  const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ?`;
  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('Error updating notifications:', err);
      return res.status(500).json({ success: false });
    }
     res.json({ success: true, message: 'All notifications marked as read' });
  });
};

exports.getRequestForEdit = (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const requestId = req.params.id;
    const userId = req.session.user.id;
    
    const sql = `
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
            END AS status
        FROM unified_intake_sheets
        WHERE id = ? AND user_id = ?
    `;
    
    db.query(sql, [requestId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching request:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        res.json({ request: results[0] });
    });
};

exports.updateRequest = (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    upload.single('document')(req, res, function (err) {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ success: false, message: 'File upload error' });
        }

        const requestId = req.params.id;
        const userId = req.session.user.id;
        const checkSql = 'SELECT * FROM unified_intake_sheets WHERE id = ? AND user_id = ?';
        
        db.query(checkSql, [requestId, userId], (err, results) => {
            if (err) {
                console.error('Error checking request ownership:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(403).json({ success: false, message: 'Not authorized to edit this request' });
            }
            
            const existingRequest = results[0];
            let documentPath = existingRequest.document_path;
            
            if (req.file) {
                documentPath = req.file.filename;
                if (existingRequest.document_path) {
                    const oldFilePath = path.join(__dirname, '../uploads', existingRequest.document_path);
                    
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlink(oldFilePath, (err) => {
                            if (err) {
                                console.error('Error deleting old file:', err);
                            }
                        });
                    }
                }
            }
            
            const [firstName, ...remainingParts] = (req.body.fullname || '').trim().split(/\s+/).filter(Boolean);
            const lastName = remainingParts.length > 0 ? remainingParts.pop() : null;
            const middleName = remainingParts.length > 0 ? remainingParts.join(' ') : null;

            const updateSql = `
                UPDATE unified_intake_sheets
                SET first_name = ?,
                    middle_name = ?,
                    last_name = ?,
                    patient_contact = ?,
                    informant_contact = ?,
                    patient_email = ?,
                    birthdate = ?,
                    patient_occupation = ?,
                    occupation = ?,
                    patient_nationality = ?,
                    nationality = ?,
                    patient_civil_status = ?,
                    civil_status = ?,
                    patient_income = ?,
                    monthly_income = ?,
                    medical_assistance = ?,
                    medical_concern = ?,
                    document_path = COALESCE(?, document_path)
                WHERE id = ? AND user_id = ?
            `;
            
            db.query(
                updateSql,
                [
                    firstName || null,
                    middleName,
                    lastName,
                    req.body.contact_number,
                    req.body.contact_number,
                    req.body.email,
                    req.body.birthdate,
                    req.body.occupation,
                    req.body.occupation,
                    req.body.nationality,
                    req.body.nationality,
                    req.body.civil_status,
                    req.body.civil_status,
                    req.body.income || 0,
                    req.body.income || 0,
                    req.body.med_assistance,
                    req.body.concern,
                    documentPath,
                    requestId,
                    userId
                ],
                (err, result) => {
                    if (err) {
                        console.error('Error updating request:', err);
                        return res.status(500).json({ success: false, message: 'Database error' });
                    }
                    
                    res.json({ success: true, message: 'Request updated successfully!' });
                }
            );
        });
    });
};

exports.deleteRequest = (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const requestId = req.params.id;
    const userId = req.session.user.id;
    
    const checkSql = 'SELECT * FROM unified_intake_sheets WHERE id = ? AND user_id = ?';
    
    db.query(checkSql, [requestId, userId], (err, results) => {
        if (err) {
            console.error('Error checking request ownership:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this request' });
        }
        
        const request = results[0];
        
        if (request.document_path) {
            const filePath = path.join(__dirname, '../uploads', request.document_path);
            
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                }
                
                deleteRequestFromDB();
            });
        } else {
            deleteRequestFromDB();
        }
        
        function deleteRequestFromDB() {
            const deleteSql = 'DELETE FROM unified_intake_sheets WHERE id = ? AND user_id = ?';
            
            db.query(deleteSql, [requestId, userId], (err, result) => {
                if (err) {
                    console.error('Error deleting request:', err);
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                
                res.json({ success: true, message: 'Request deleted successfully!' });
            });
        }
    });
};

exports.getAdminUserManagement = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.redirect('/');
    }

    const usersQuery = `SELECT id, name, email, role, created_at, last_login, last_logout FROM users`;
    
    const statsQuery = `
        SELECT 
            COUNT(*) as totalUsers,
            SUM(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) as adminCount,
            SUM(CASE WHEN role = 'User' THEN 1 ELSE 0 END) as userCount,
            SUM(CASE WHEN last_login IS NULL THEN 1 ELSE 0 END) as neverLoggedIn,
            SUM(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as activeLast7Days,
            SUM(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as activeLast30Days,
            DATE_FORMAT(MIN(created_at), '%Y-%m-%d') as oldestUserDate,
            DATE_FORMAT(MAX(created_at), '%Y-%m-%d') as newestUserDate
        FROM users
    `;
    
    const monthlyRegQuery = `
        SELECT 
            DATE_FORMAT(created_at, '%Y-%m') as month,
            COUNT(*) as count
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month
    `;

    db.query(usersQuery, (error, users) => {
        if (error) {
            console.error("❌ Error fetching users:", error);
            return res.render("admin/user-management", {
                users: [],
                stats: null,
                monthlyRegistrations: [],
                error: "Failed to load users",
            });
        }

        db.query(statsQuery, (statsError, statsResults) => {
            if (statsError) {
                console.error("❌ Error fetching stats:", statsError);
                return res.render("admin/user-management", {
                    users: users,
                    stats: null,
                    monthlyRegistrations: [],
                    error: "Failed to load statistics",
                });
            }

            db.query(monthlyRegQuery, (monthlyError, monthlyResults) => {
                if (monthlyError) {
                    console.error("❌ Error fetching monthly stats:", monthlyError);
                    return res.render("admin/user-management", {
                        users: users,
                        stats: statsResults[0],
                        monthlyRegistrations: [],
                        error: null,
                    });
                }

                const stats = statsResults[0];
                const currentDate = new Date();
                const lastWeek = new Date(currentDate.setDate(currentDate.getDate() - 7));
                
                if (stats.totalUsers > 0) {
                    stats.activePercentage = Math.round((stats.activeLast7Days / stats.totalUsers) * 100);
                    stats.adminPercentage = Math.round((stats.adminCount / stats.totalUsers) * 100);
                    stats.userPercentage = Math.round((stats.userCount / stats.totalUsers) * 100);
                } else {
                    stats.activePercentage = 0;
                    stats.adminPercentage = 0;
                    stats.userPercentage = 0;
                }

                res.render("admin/user-management", {
                    users: users,
                    stats: stats,
                    monthlyRegistrations: monthlyResults,
                    error: null,
                });
            });
        });
    });
};


exports.acceptPatient = (req, res) => {
    const patientId = req.params.id;
    const query = 'UPDATE unified_intake_sheets SET request_status = "approved" WHERE id = ?';

    db.query(query, [patientId], (err, result) => {
        if (err) {
            console.error('Error updating status:', err);
            return res.status(500).send('Internal Server Error');
        }

        console.log('Update result:', result); 
        res.redirect('/patient/admin'); 
    });
};

exports.getAdminReports = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.redirect('/');
    }
  const billingQuery = `
    SELECT 
      id, name, age, address, ward, date,
      services, non_phf_meds, hemodialysis, implant, total_due
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
  `;

  const statsQuery = `
    SELECT 
      COUNT(*) as totalTransactions,
      SUM(total_due) as totalAmount,
      AVG(total_due) as averageBill,
      MIN(total_due) as minBill,
      MAX(total_due) as maxBill,
      COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as todaysTransactions,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total_due ELSE 0 END) as todaysTotal
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
  `;

  const wardQuery = `
    SELECT 
      ward,
      COUNT(*) as count,
      SUM(total_due) as total
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    GROUP BY ward
  `;

  db.query(billingQuery, (error, results) => {
    if (error) {
      console.error("❌ Error fetching billing records:", error);
      return res.status(500).send("Error fetching billing data");
    }

    db.query(statsQuery, (statsError, statsResults) => {
      if (statsError) {
        console.error("❌ Error fetching statistics:", statsError);
        return res.status(500).send("Error fetching statistics");
      }

      db.query(wardQuery, (wardError, wardResults) => {
        if (wardError) {
          console.error("❌ Error fetching ward statistics:", wardError);
          return res.status(500).send("Error fetching ward statistics");
        }

        const patients = results.map(row => {
          const categories = {
            rb: 0,
            or_dr: 0,
            diagnostic_fee: 0,
            laboratory_fee: 0,
            medicines: 0,
            medical_supplies: 0,
            oxygen: 0,
            implant: 0,
            others: 0
          };

          try {
            const services = row.services ? JSON.parse(row.services) : [];
            
            services.forEach(service => {
              const serviceName = service.service; 
              const amount = parseFloat(service.amount) || 0;
              
              switch(serviceName) {
                case 'Rnb':
                  categories.rb += amount;
                  break;
                case 'OR/DR':
                  categories.or_dr += amount;
                  break;
                case 'X-ray':
                case 'ECG':
                case 'CT Scan':
                case 'Ultrasound':
                  categories.diagnostic_fee += amount;
                  break;
                case 'Diagnostic':
                  categories.diagnostic_fee += amount;
                  break;
                case 'Laboratory':
                  categories.laboratory_fee += amount;
                  break;
                case 'Drugs and Medicines':
                case 'Medicines':
                  categories.medicines += amount;
                  break;
                case 'Medical Supplies':
                  categories.medical_supplies += amount;
                  break;
                case 'Oxygen':
                  categories.oxygen += amount;
                  break;
                case 'Implant':
                  categories.implant += amount;
                  break;
                case 'Epoetin':
                case 'Hospital Bill':
                case 'Hemodialysis Sessions':
                  categories.others += amount;
                  break;
                default:
                  categories.others += amount;
              }
            });
          } catch (e) {
            console.error('Error parsing services:', e);
          }

          categories.medicines += parseFloat(row.non_phf_meds) || 0;
          categories.implant += parseFloat(row.implant) || 0;
          categories.others += parseFloat(row.hemodialysis) || 0;

          return {
            name: row.name || '-',
            age: row.age === null ? '-' : row.age,
            address: row.address || '-',
            ward: row.ward || '-',
            date: row.date || null,
            rb: categories.rb,
            or_dr: categories.or_dr,
            diagnostic_fee: categories.diagnostic_fee,
            laboratory_fee: categories.laboratory_fee,
            medicines: categories.medicines,
            medical_supplies: categories.medical_supplies,
            oxygen: categories.oxygen,
            implant: categories.implant,
            others: categories.others,
            total: parseFloat(row.total_due) || 0
          };
        });

        const statistics = {
          totalTransactions: statsResults[0].totalTransactions || 0,
          totalAmount: parseFloat(statsResults[0].totalAmount || 0).toFixed(2),
          averageBill: parseFloat(statsResults[0].averageBill || 0).toFixed(2),
          minBill: parseFloat(statsResults[0].minBill || 0).toFixed(2),
          maxBill: parseFloat(statsResults[0].maxBill || 0).toFixed(2),
          todaysTransactions: statsResults[0].todaysTransactions || 0,
          todaysTotal: parseFloat(statsResults[0].todaysTotal || 0).toFixed(2),
          wardDistribution: wardResults
        };

        res.render("admin/reports", {
          patients: patients,
          statistics: statistics
        });
      });
    });
  });
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const isMatch = await User.verifyPassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        await new Promise((resolve, reject) => {
            const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
            db.query(sql, [user.id], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        req.session.user = { 
            id: user.id, 
            role: user.role,
            name: user.name, 
            email: user.email 
        };

        const redirectUrl = user.role === 'Admin' ? '/admin/dashboard' : '/patient/dashboard';
        
        return res.json({ 
            success: true, 
            message: 'Login successful!',
            redirect: redirectUrl
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Something went wrong, please try again.' 
        });
    }
};

exports.logout = async (req, res) => {
    try {
        const userId = req.session.user?.id;

        if (userId) {
            await new Promise((resolve, reject) => {
                const sql = 'UPDATE users SET last_logout = NOW() WHERE id = ?';
                db.query(sql, [userId], (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });
        }

        req.session.destroy(() => {
            res.redirect('/');
        });

    } catch (error) {
        console.error('Logout Error:', error);
        res.redirect('/login');
    }
};


exports.getForgotPassword = (req, res) => {
    res.render('auth/forgot-password', { error: null, success: null });
};


exports.postForgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findByEmail(email);

    if (!user) {
        return res.render('auth/forgot-password', { error: 'Email not found', success: null });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await User.setResetToken(email, token);

    const resetLink = `http://localhost:3000/reset-password/${token}`;

    console.log(`Password reset link: ${resetLink}`);

    res.render('auth/forgot-password', { error: null, success: 'Check your email for reset link' });
}; 

exports.getResetPassword = async (req, res) => {
    const token = req.params.token;
    const user = await User.findByResetToken(token);

    if (!user) {
        return res.send('Invalid or expired reset token');
    }

    res.render('auth/reset-password', { token, error: null });
};

exports.postResetPassword = async (req, res) => {
    const { password } = req.body;
    const token = req.params.token;
    const user = await User.findByResetToken(token);

    if (!user) {
        return res.send('Invalid or expired reset token');
    }

    await User.updatePassword(user.email, password);
    res.redirect('/login');
}; 

exports.getHome = (req, res) => {
    res.render('home');
}

const PDFDocument = require('pdfkit');

exports.getFeedback = (req, res) => { 
  if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.redirect('/');
  }
  const query = `
      SELECT *,
      (objective1 + objective2 + objective3 + objective4) AS total_score,
      (objective1 + objective2 + objective3 + objective4)/4 AS avg_score
      FROM feedbacks 
      ORDER BY feedback_date DESC
  `;

  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching feedbacks:', err);
          return res.status(500).send('Internal Server Error');
      }

      // Normalize feedback_date safely
      results = results.map(f => {
          let d = f.feedback_date;
          if (!(d instanceof Date)) d = new Date(d);
          f.feedback_date = isNaN(d.getTime()) ? null : d;
          return f;
      });

      const stats = calculateStats(results);
      res.render('admin/feedback', { feedbacks: results, stats });
  });
};

exports.generateFeedbackPDF = (req, res) => {
    const query = `
        SELECT *,
        (objective1 + objective2 + objective3 + objective4) AS total_score,
        (objective1 + objective2 + objective3 + objective4)/4 AS avg_score
        FROM feedbacks 
        ORDER BY feedback_date DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Internal Server Error');
        }

        const stats = calculateStats(results);
        generatePDF(results, stats, res);
    });
};

function calculateStats(results) {
    const stats = {
        total: results.length,
        sections: {},
        scoreDistribution: { high: 0, medium: 0, low: 0 },
        recent: []
    };

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    results.forEach(feedback => {
        stats.sections[feedback.section] = (stats.sections[feedback.section] || 0) + 1;
        
        const avg = parseFloat(feedback.avg_score) || 0;
        if (avg >= 3.5) stats.scoreDistribution.high++;
        else if (avg >= 2) stats.scoreDistribution.medium++;
        else stats.scoreDistribution.low++;
        
        // Use feedback_date instead of created_at
        if (feedback.feedback_date && new Date(feedback.feedback_date) > threeDaysAgo) {
            stats.recent.push(feedback);
        }
    });

    stats.topSections = Object.entries(stats.sections)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    return stats;
}

function generatePDF(feedbacks, stats, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=feedback-analytics-${new Date().toISOString().split('T')[0]}.pdf`);
    doc.pipe(res);

    doc.fontSize(24).fillColor('#1f2937').text('Malasakit Feedback Analytics Report', 50, 50);
    doc.fontSize(12).fillColor('#6b7280').text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 85);

    doc.fontSize(18).fillColor('#1f2937').text('Summary Overview', 50, 130);
    let yPos = 160;

    const summaryData = [
        { label: 'Total Feedback', value: stats.total, color: '#ef4444' },
        { label: 'High Satisfaction', value: stats.scoreDistribution.high, color: '#10b981' },
        { label: 'Top Section', value: stats.topSections[0]?.name || 'N/A', color: '#f59e0b' },
        { label: 'Recent Feedback', value: stats.recent.length, color: '#3b82f6' }
    ];

    summaryData.forEach((item, index) => {
        const xPos = 50 + (index * 130);

        doc.rect(xPos, yPos, 120, 80).fillColor('#f9fafb').fill().stroke('#e5e7eb');
        doc.circle(xPos + 20, yPos + 25, 12).fillColor(item.color).fill();

        doc.fillColor('#6b7280').fontSize(10).text(item.label, xPos + 40, yPos + 15);
        doc.fillColor('#1f2937').fontSize(16).font('Helvetica-Bold').text(item.value.toString(), xPos + 40, yPos + 35);

        doc.font('Helvetica');
    });

    yPos += 120;

    doc.fontSize(16).fillColor('#1f2937').text('Satisfaction Distribution', 50, yPos);
    yPos += 30;

    const totalFeedback = stats.total || 1;
    const distributionData = [
        { label: 'High Satisfaction (3.5–5)', value: stats.scoreDistribution.high, color: '#10b981' },
        { label: 'Medium Satisfaction (2–3.4)', value: stats.scoreDistribution.medium, color: '#f59e0b' },
        { label: 'Low Satisfaction (0–1.9)', value: stats.scoreDistribution.low, color: '#ef4444' }
    ];

    const barMaxWidth = 250;

    distributionData.forEach((item, index) => {
        const percentage = Math.round((item.value / totalFeedback) * 100);
        const barWidth = Math.min((item.value / totalFeedback) * barMaxWidth, barMaxWidth);
        const barY = yPos + (index * 40);

        doc.fontSize(12).fillColor('#374151').text(item.label, 50, barY);
        doc.rect(250, barY + 5, barMaxWidth, 15).fillColor('#f3f4f6').fill();

        if (barWidth > 0) {
            doc.rect(250, barY + 5, barWidth, 15).fillColor(item.color).fill();
        }

        doc.fontSize(10).fillColor('#6b7280').text(`${item.value} (${percentage}%)`, 510, barY + 8);
    });

    yPos += 140;

    doc.fontSize(16).fillColor('#1f2937').text('Feedback by Section', 50, yPos);
    yPos += 30;

    const sectionEntries = Object.entries(stats.sections).slice(0, 8);
    const maxSectionCount = Math.max(...Object.values(stats.sections), 1);

    sectionEntries.forEach((entry, index) => {
        const [sectionName, count] = entry;
        const barWidth = (count / maxSectionCount) * 250;

        doc.fontSize(11).fillColor('#374151')
           .text(sectionName.length > 25 ? sectionName.substring(0, 25) + '...' : sectionName, 50, yPos + (index * 25));

        doc.rect(300, yPos + (index * 25) + 3, 250, 12).fillColor('#f3f4f6').fill();

        if (barWidth > 0) {
            doc.rect(300, yPos + (index * 25) + 3, barWidth, 12).fillColor('#4f46e5').fill();
        }

        doc.fontSize(10).fillColor('#6b7280').text(count.toString(), 560, yPos + (index * 25) + 6);
    });

    yPos += (sectionEntries.length * 25) + 40;

    if (yPos > 600) {
        doc.addPage();
        yPos = 50;
    }

    doc.fontSize(16).fillColor('#1f2937').text('Recent Feedback Details', 50, yPos);
    yPos += 30;

    const headers = ['Patient', 'Section', 'Score', 'Comments', 'Date'];
    const colWidths = [100, 120, 60, 150, 80];
    let xPos = 50;

    doc.rect(50, yPos, 510, 25).fillColor('#f9fafb').fill().stroke('#e5e7eb');

    headers.forEach((header, index) => {
        doc.fontSize(10).fillColor('#374151').font('Helvetica-Bold').text(header, xPos + 5, yPos + 8);
        xPos += colWidths[index];
    });

    yPos += 25;
    doc.font('Helvetica');

    const limitedFeedbacks = feedbacks.slice(0, 15);

    limitedFeedbacks.forEach((feedback, index) => {
        if (yPos > 750) {
            doc.addPage();
            yPos = 50;
        }

        xPos = 50;
        const rowHeight = 30;

        if (index % 2 === 0) {
            doc.rect(50, yPos, 510, rowHeight).fillColor('#fafafa').fill();
        }

        doc.rect(50, yPos, 510, rowHeight).stroke('#e5e7eb');

        const rowData = [
            feedback.name || 'N/A',
            feedback.section ? (feedback.section.length > 18 ? feedback.section.substring(0, 18) + '...' : feedback.section) : 'N/A',
            `${Number(feedback.avg_score || 0).toFixed(1)}/5`,
            feedback.comments ? (feedback.comments.length > 25 ? feedback.comments.substring(0, 25) + '...' : feedback.comments) : 'No comments',
            feedback.feedback_date ? new Date(feedback.feedback_date).toISOString().split('T')[0] : 'N/A'
        ];

        rowData.forEach((data, colIndex) => {
            doc.fontSize(9).fillColor('#374151').text(data, xPos + 5, yPos + 10, {
                width: colWidths[colIndex] - 10,
                height: rowHeight - 10,
                ellipsis: true
            });
            xPos += colWidths[colIndex];
        });

        yPos += rowHeight;
    });

    if (yPos > 700) {
        doc.addPage();
        yPos = 50;
    }

    yPos += 40;

    doc.fontSize(10).fillColor('#6b7280')
       .text(`Report generated on ${new Date().toLocaleString()}`, 50, yPos);
    doc.text(`Total records: ${feedbacks.length} | Showing: ${Math.min(15, feedbacks.length)} records`, 50, yPos + 15);

    doc.end();
}



const mapServiceToKey = (serviceName) => {
    const serviceMap = {
        "Hospital Bill": "hospital_bill",
        "Medicines": "medicines",
        "Drugs and Medicines": "medicines",
        "Laboratory": "laboratory",
        "Medical Supplies": "medical_supplies",
        "Oxygen": "oxygen",
        "Rnb": "rnb",
        "OR/DR": "or_dr",
        "Diagnostic": "diagnostic",
        "Implant": "implants",
        "Epoetin": "epoetin",
        "Hemodialysis Sessions": "hemodialysis_sessions",
        "Others": "others"
    };
    return serviceMap[serviceName] || 'others';
};

exports.getStatistics = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.redirect('/');
    }
  const query = `
    SELECT *
    FROM billing_records
    WHERE (is_deleted = FALSE OR is_deleted IS NULL)
  `;
  db.query(query, (err, rows) => {
    if (err) {
      console.error('Error fetching records:', err);
      return res.status(500).send('Error fetching records');
    }

    let totalTransactions = rows.length;
    let totalAmount = 0;
    let minBill = Infinity;
    let maxBill = 0;
    let todayTransactions = 0;
    let todayTotal = 0;
    const today = new Date().toISOString().split('T')[0];
    
    rows.forEach(row => {
      const billAmount = parseFloat(row.total_due) || 0;
      totalAmount += billAmount;
      
      if (billAmount < minBill) minBill = billAmount;
      if (billAmount > maxBill) maxBill = billAmount;
      
      const recordDate = new Date(row.created_at || row.date).toISOString().split('T')[0];
      if (recordDate === today) {
        todayTransactions++;
        todayTotal += billAmount;
      }
    });
    
    const averageBill = totalTransactions > 0 ? totalAmount / totalTransactions : 0;
    const wardDistribution = {
      Inpatient: 0, 
      Outpatient: 0,
      ER: 0
    };
    
    rows.forEach(row => {
      const ward = row.ward || 'Inpatient';
      if (wardDistribution.hasOwnProperty(ward)) {
        wardDistribution[ward]++;
      }
    });

    const servicesList = [
      'hospital_bill', 'medicines', 'laboratory', 'implants', 'diagnostic', 'others',
      'medical_supplies', 'oxygen', 'or_dr', 'rnb', 'epoetin', 'hemodialysis_sessions'
    ];

    const fundTypes = ['PHIC', 'PCSO', 'DSWD', 'MAIP', 'OP-SCPF', 'OTHERS'];
    const mapServiceToKey = (serviceName) => {
      const serviceMap = {
        "Hospital Bill": "hospital_bill",
        "Medicines": "medicines",
        "Drugs and Medicines": "medicines",
        "Laboratory": "laboratory",
        "Medical Supplies": "medical_supplies",
        "X-ray": "diagnostic",
        "ECG": "diagnostic",
        "CT Scan": "diagnostic",
        "Ultrasound": "diagnostic",
        "Oxygen": "oxygen",
        "Rnb": "rnb",
        "OR/DR": "or_dr",
        "Diagnostic": "diagnostic",
        "Implant": "implants",
        "Epoetin": "epoetin",
        "Hemodialysis Sessions": "hemodialysis_sessions",
        "Others": "others"
      };
      return serviceMap[serviceName] || 'others';
    };

    const getAgeGroup = (age) => {
      if (age <= 18) return '0-18';
      if (age <= 35) return '19-35';
      if (age <= 60) return '36-60';
      return '61+';
    };

    const data = {};
    servicesList.forEach(service => {
      data[service] = {
        male: { '0-18': 0, '19-35': 0, '36-60': 0, '61+': 0, subtotal: 0 },
        female: { '0-18': 0, '19-35': 0, '36-60': 0, '61+': 0, subtotal: 0 },
        pregnantCount: 0,
        pwdCount: 0,
        fundUtilization: {
          'PHIC': 0, 'PCSO': 0, 'DSWD': 0, 'MAIP': 0, 'OP-SCPF': 0, 'OTHERS': 0
        },
        ward: {
          'Inpatient': 0,
          'Outpatient': 0,
          'ER': 0
        },
        totalAmountUtilized: 0
      };
    });

    rows.forEach(row => {
      const age = row.age || 0;
      const ageGroup = getAgeGroup(age);
      const gender = row.gender ? row.gender.toLowerCase() : '';
      const ward = row.ward || 'Inpatient';

      let servicesData = [];
      try {
        servicesData = JSON.parse(row.services || '[]');
      } catch (e) {
        console.error('Error parsing services JSON:', e);
      }

      let totalRowServices = 0;
      const serviceAmounts = {};

      servicesList.forEach(service => {
        serviceAmounts[service] = 0;
      });

      servicesData.forEach(serviceItem => {
        const key = mapServiceToKey(serviceItem.service);
        const amount = parseFloat(serviceItem.amount) || 0;
        if (servicesList.includes(key)) {
          serviceAmounts[key] += amount;
          totalRowServices += amount;
        }
      });

      servicesList.forEach(serviceKey => {
        const serviceAmount = serviceAmounts[serviceKey];

        if (serviceAmount > 0) {
          if (data[serviceKey].ward.hasOwnProperty(ward)) {
            data[serviceKey].ward[ward]++;
          }

          if (gender === 'male') {
            data[serviceKey].male[ageGroup]++;
            data[serviceKey].male.subtotal++;
          } else if (gender === 'female') {
            data[serviceKey].female[ageGroup]++;
            data[serviceKey].female.subtotal++;
          }

          if (row.is_pregnant && gender === 'female') {
            data[serviceKey].pregnantCount++;
          }
          if (row.is_pwd) {
            data[serviceKey].pwdCount++;
          }

          if (totalRowServices > 0) {
            const proportion = serviceAmount / totalRowServices;
            const fund = row.fund_type || 'OTHERS';
            const totalDue = parseFloat(row.total_due) || 0;

            if (fundTypes.includes(fund)) {
              const allocatedAmount = totalDue * proportion;
              data[serviceKey].fundUtilization[fund] += allocatedAmount;
            } else {
              data[serviceKey].fundUtilization['OTHERS'] += totalDue * proportion;
            }
          }
        }
      });
    });

    servicesList.forEach(service => {
      data[service].totalAmountUtilized = fundTypes.reduce(
        (sum, fund) => sum + data[service].fundUtilization[fund],
        0
      );
    });

    const grandTotal = servicesList.reduce(
      (sum, service) => sum + data[service].totalAmountUtilized,
      0
    );

    res.render('admin/statistics', {
      services: servicesList.map(service => service.replace(/_/g, ' ').toUpperCase()),
      data,
      fundTypes,
      grandTotal,
      statistics: {
        totalTransactions,
        totalAmount: totalAmount.toFixed(2),
        averageBill: averageBill.toFixed(2),
        minBill: minBill.toFixed(2),
        maxBill: maxBill.toFixed(2),
        todayTransactions,
        todayTotal: todayTotal.toFixed(2),
        wardDistribution
      }
    });
  });
};

exports.getMainForm = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.redirect('/');
    }

    const recordsQuery = `
        SELECT * FROM billing_records
        WHERE (is_deleted = FALSE OR is_deleted IS NULL)
        ORDER BY created_at DESC
    `;

    const deletedRecordsQuery = `
        SELECT * FROM billing_records
        WHERE is_deleted = TRUE
        ORDER BY deleted_at DESC
    `;

    db.query(recordsQuery, (err, results) => {
        if (err) {
            console.error('Error fetching records:', err);
            return res.status(500).send('Error fetching records');
        }

        db.query(deletedRecordsQuery, (deletedErr, deletedResults) => {
            if (deletedErr) {
                console.error('Error fetching deleted records:', deletedErr);
            }

            const formattedResults = results.map(record => ({
                ...record,
                total_due: record.total_due !== null ? parseFloat(record.total_due) : 0
            }));

            const formattedDeletedResults = (deletedResults || []).map(record => ({
                ...record,
                total_due: record.total_due !== null ? parseFloat(record.total_due) : 0,
                deleted_at: record.deleted_at ? new Date(record.deleted_at).toLocaleString() : null
            }));

            res.render('admin/clone-template', {
                records: formattedResults,
                deletedRecords: formattedDeletedResults || [],
                user: req.session.user
            });
        });
    });
};

exports.softDeleteRecord = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const recordId = req.params.id;
    const userId = req.session.user.id;
    
    const query = `
        UPDATE billing_records 
        SET is_deleted = TRUE, 
            deleted_at = NOW(),
            deleted_by = ?
        WHERE id = ?
    `;
    
    db.query(query, [userId, recordId], (err, result) => {
        if (err) {
            console.error('Error soft deleting record:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Error deleting record' 
            });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Record not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Record moved to trash successfully' 
        });
    });
};

exports.restoreRecord = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const recordId = req.params.id;
    
    const query = `
        UPDATE billing_records 
        SET is_deleted = FALSE, 
            deleted_at = NULL,
            deleted_by = NULL
        WHERE id = ?
    `;
    
    db.query(query, [recordId], (err, result) => {
        if (err) {
            console.error('Error restoring record:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Error restoring record' 
            });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Record not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Record restored successfully' 
        });
    });
};

exports.permanentDeleteRecord = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const recordId = req.params.id;
        const checkQuery = 'SELECT is_deleted FROM billing_records WHERE id = ?';
    
    db.query(checkQuery, [recordId], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking record:', checkErr);
            return res.status(500).json({ 
                success: false, 
                message: 'Error checking record' 
            });
        }
        
        if (checkResult.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Record not found' 
            });
        }
        
        if (!checkResult[0].is_deleted) {
            return res.status(400).json({ 
                success: false, 
                message: 'Record must be soft deleted before permanent deletion' 
            });
        }
        
        const deleteQuery = 'DELETE FROM billing_records WHERE id = ?';
        db.query(deleteQuery, [recordId], (deleteErr, deleteResult) => {
            if (deleteErr) {
                console.error('Error permanently deleting record:', deleteErr);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Error permanently deleting record' 
                });
            }
            
            res.json({ 
                success: true, 
                message: 'Record permanently deleted successfully' 
            });
        });
    });
};

exports.emptyTrash = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const query = 'DELETE FROM billing_records WHERE is_deleted = TRUE';
    
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error emptying trash:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Error emptying trash' 
            });
        }
        
        res.json({ 
            success: true, 
            message: `Trash emptied successfully. ${result.affectedRows} records deleted permanently.` 
        });
    });
};


exports.submitMainForm = (req, res) => {
  const {
    name,
    address,
    confinement_start,
    confinement_end,
    hospital_number,
    icd_ivs,
    ward,
    age,
    date,
    non_phf_meds,
    hemodialysis,
    implant,
    gender,
    fund_type,
    is_pregnant,
    is_pwd,
    services_json  
  } = req.body;

  try {
    const services = JSON.parse(services_json || '[]');
    let total_due = 0;
        services.forEach(service => {
        const amount = parseFloat(service.amount) || 0;
        const discount = parseFloat(service.discount) || 0;
        const philhealth = parseFloat(service.philhealth) || 0;
        total_due += amount - discount - philhealth;
    });
    
    total_due += parseFloat(non_phf_meds || 0);
    total_due += parseFloat(hemodialysis || 0);
    total_due += parseFloat(implant || 0);

    const sql = `
      INSERT INTO billing_records 
      (name, address, confinement_start, confinement_end, hospital_number, 
       icd_ivs, ward, age, gender, fund_type, is_pregnant, is_pwd, date, services, 
       non_phf_meds, hemodialysis, implant, total_due) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      name || null,
      address || null,
      confinement_start || null,
      confinement_end || null,
      hospital_number || null,
      icd_ivs || null,
      ward || null,
      age || null,
      gender || null,
      fund_type || null,
      is_pregnant ? 1 : 0,
      is_pwd ? 1 : 0,
      date || null,
      JSON.stringify(services), 
      parseFloat(non_phf_meds || 0),
      parseFloat(hemodialysis || 0),
      parseFloat(implant || 0),
      total_due.toFixed(2)
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Database Error:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      res.json({ message: 'Record saved successfully.' });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Unexpected server error: ' + error.message });
  }
};

exports.editUser = (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  try {
    const emailSql = `SELECT id FROM users WHERE email = ? AND id != ?`;
    const emailValues = [email, id];

    db.query(emailSql, emailValues, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Database error: " + err.message });
      }

      if (result.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another account",
        });
      }

      const updateSql = `UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?`;
      const updateValues = [name || null, email || null, role || null, id];

      db.query(updateSql, updateValues, (err2) => {
        if (err2) {
          console.error("Error updating user:", err2);
          return res
            .status(500)
            .json({ success: false, message: "Database error: " + err2.message });
        }

        res.json({ success: true, message: "User updated successfully" });
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Unexpected server error: " + error.message,
    });
  }
};
function rollbackWithError(res, message, err) {
  db.rollback(() => {
    if (err) {
      console.error(message, err);
    }
    res.status(500).json({ success: false, message });
  });
}

function deleteUserDependencies(targetClause, params, callback) {
  const steps = [
    { sql: `DELETE FROM notifications WHERE ${targetClause}`, params },
    { sql: `DELETE FROM requests WHERE ${targetClause}`, params },
    { sql: `DELETE FROM unified_intake_sheets WHERE ${targetClause}`, params }
  ];

  let index = 0;
  const next = () => {
    if (index >= steps.length) {
      return callback(null);
    }

    const step = steps[index++];
    db.query(step.sql, step.params, (err) => {
      if (err) {
        return callback(err);
      }
      next();
    });
  };

  next();
}

exports.deleteUser = (req, res) => {
  const targetUserId = Number.parseInt(req.params.id, 10);

  try {
    if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!Number.isInteger(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (req.session.user.id === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    db.beginTransaction((txErr) => {
      if (txErr) {
        console.error("Error starting delete user transaction:", txErr);
        return res.status(500).json({ success: false, message: "Database error: " + txErr.message });
      }

      deleteUserDependencies('user_id = ?', [targetUserId], (dependencyErr) => {
        if (dependencyErr) {
          return rollbackWithError(res, "Database error while deleting user dependencies", dependencyErr);
        }

        db.query(`DELETE FROM users WHERE id = ?`, [targetUserId], (deleteErr, result) => {
          if (deleteErr) {
            return rollbackWithError(res, "Database error while deleting user", deleteErr);
          }

          if (result.affectedRows === 0) {
            return db.rollback(() => {
              res.status(404).json({ success: false, message: "User not found" });
            });
          }

          const logSql = 'INSERT INTO deleted_history (table_name, record_id, deleted_by) VALUES (?, ?, ?)';
          db.query(logSql, ['users', targetUserId, req.session.user.id], (logErr) => {
            if (logErr) {
              return rollbackWithError(res, "Database error while logging user deletion", logErr);
            }

            db.commit((commitErr) => {
              if (commitErr) {
                return rollbackWithError(res, "Database error while finalizing user deletion", commitErr);
              }

              res.json({ success: true, message: "User deleted successfully" });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Unexpected server error: " + error.message,
    });
  }
};


exports.deleteAllUsers = (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    db.beginTransaction((txErr) => {
      if (txErr) {
        console.error("Error starting delete all users transaction:", txErr);
        return res.status(500).json({ success: false, message: "Database error: " + txErr.message });
      }

      deleteUserDependencies('user_id != ?', [req.session.user.id], (dependencyErr) => {
        if (dependencyErr) {
          return rollbackWithError(res, "Database error while deleting user dependencies", dependencyErr);
        }

        db.query(`DELETE FROM users WHERE id != ?`, [req.session.user.id], (deleteErr) => {
          if (deleteErr) {
            return rollbackWithError(res, "Database error while deleting users", deleteErr);
          }

          db.commit((commitErr) => {
            if (commitErr) {
              return rollbackWithError(res, "Database error while finalizing user deletion", commitErr);
            }

            res.json({ success: true, message: "All users deleted successfully" });
          });
        });
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Unexpected server error: " + error.message,
    });
  }
};

exports.updatePatientStatus = (req, res) => {
    const { id, status } = req.body;
    
    const getRequestQuery = 'SELECT * FROM unified_intake_sheets WHERE id = ?';
    
    db.query(getRequestQuery, [id], (err, requestResult) => {
        if (err) {
            console.error('Error fetching request:', err);
            return res.status(500).send('Internal Server Error');
        }
        
        if (requestResult.length === 0) {
            return res.status(404).send('Request not found');
        }
        
        const request = requestResult[0];
        const userId = request.user_id;
        
        const normalizedStatus = status === 'waiting' ? 'under_review' : status === 'deny' ? 'denied' : status;
        const updateQuery = 'UPDATE unified_intake_sheets SET request_status = ? WHERE id = ?';
        
        db.query(updateQuery, [normalizedStatus, id], (err, result) => {
            if (err) {
                console.error('Error updating patient status:', err);
                return res.status(500).send('Internal Server Error');
            }
            
            let message;
            switch(status) {
                case 'approved':
                    message = `Your request for medical assistance (${request.medical_assistance || 'Medical Assistance Request'}) has been approved.`;
                    break;
                case 'deny':
                    message = `Your request for medical assistance (${request.medical_assistance || 'Medical Assistance Request'}) has been denied.`;
                    break;
                case 'waiting':
                default:
                    message = `Your request for medical assistance (${request.medical_assistance || 'Medical Assistance Request'}) is under review.`;
            }
            
            const notificationQuery = `
                INSERT INTO notifications (user_id, message, request_id, is_read) 
                VALUES (?, ?, ?, 0)
            `;
            
            db.query(notificationQuery, [userId, message, id], (err, notificationResult) => {
                if (err) {
                    console.error('Error creating notification:', err);
                }
                
                res.redirect('/patient/admin');
            });
        });
    });
};


exports.deletePatient = (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM unified_intake_sheets WHERE id = ?';
    
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error deleting patient:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/patient/admin');
    });
};

