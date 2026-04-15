const express = require('express'); 
const db = require('../config/db');
const excel = require('exceljs');

exports.createMedicalAssistanceReport = (req, res) => {
    try {
        const {
            full_name, age, address, date, rb, or_dr_number,
            diagnostic_fee, laboratory_fee, medicines,
            medical_supplies, oxygen, implant, other_expenses
        } = req.body;

        const toNull = (value) => value === "" ? null : parseFloat(value) || null;

        const rbValue = toNull(rb);
        const orDrValue = toNull(or_dr_number);
        const diagnosticFeeValue = toNull(diagnostic_fee);
        const laboratoryFeeValue = toNull(laboratory_fee);
        const medicinesValue = toNull(medicines);
        const medicalSuppliesValue = toNull(medical_supplies);
        const oxygenValue = toNull(oxygen);
        const implantValue = toNull(implant);
        const otherExpensesValue = toNull(other_expenses);

        db.query(`
            INSERT INTO medical_assistance 
            (name, age, address, date, rb, or_dr, diagnostic_fee, laboratory_fee, medicines, 
             medical_supplies, oxygen, implant, others) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [full_name, age, address, date, rbValue, orDrValue, diagnosticFeeValue, laboratoryFeeValue, 
             medicinesValue, medicalSuppliesValue, oxygenValue, implantValue, otherExpensesValue],
            (err, results) => {
                if (err) {
                    console.error("❌ Error inserting medical assistance record:", err);
                    return res.status(500).send("Error submitting form");
                }
                console.log("✅ Successfully submitted medical assistance form");
                res.redirect('/admin/reports'); // Redirect to the reports page after submission
            }
        );

    } catch (error) {
        res.status(500).send("Error submitting form");
    }
};


exports.submitForm = (req, res) => {
    const data = req.body;
    const services = data.services || [];

    const serviceTotals = {
        hospital_bill: 0,
        medicines: 0,
        laboratory: 0,
        implants: 0,
        diagnostic: 0,
        others: 0,
        medical_supplies: 0,
        oxygen: 0,
        or_dr: 0,
        rnb: 0,
        epoetin: 0,
        hemodialysis_sessions: 0
    };

    const fundingTotals = {
        PHIC: 0,
        PCSO: 0,
        DSWD: 0,
        MAIP: 0,
        'OP-SCPF': 0,
        OTHERS: 0
    };

    services.forEach(service => {
        const type = service.type;
        const amount = parseFloat(service.amount) || 0;
        const fundingSource = service.funding_source;

        if (serviceTotals.hasOwnProperty(type)) {
            serviceTotals[type] += amount;
        }

        if (fundingTotals.hasOwnProperty(fundingSource)) {
            fundingTotals[fundingSource] += amount;
        }
    });

    const sql = `
        INSERT INTO services 
        (age, gender, pregnant, pwd, 
         hospital_bill, medicines, laboratory, implants, diagnostic, others, 
         medical_supplies, oxygen, or_dr, rnb, epoetin, hemodialysis_sessions,
         phic, pcso, dswd, maip, op_scpf, others_fund) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        data.age,
        data.gender,
        data.pregnant || 0,
        data.pwd || 0,
        serviceTotals.hospital_bill,
        serviceTotals.medicines,
        serviceTotals.laboratory,
        serviceTotals.implants,
        serviceTotals.diagnostic,
        serviceTotals.others,
        serviceTotals.medical_supplies,
        serviceTotals.oxygen,
        serviceTotals.or_dr,
        serviceTotals.rnb,
        serviceTotals.epoetin,
        serviceTotals.hemodialysis_sessions,
        fundingTotals.PHIC,
        fundingTotals.PCSO,
        fundingTotals.DSWD,
        fundingTotals.MAIP,
        fundingTotals['OP-SCPF'],
        fundingTotals.OTHERS
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting service:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.json({ message: 'Service record saved successfully.' });
    });
};




exports.exportServices = (req, res) => {
    const query = `SELECT * FROM services`;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching services:', err);
            return res.status(500).send('Internal Server Error');
        }

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Services Report');
        
        // Add headers
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Age', key: 'age', width: 10 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Pregnant', key: 'pregnant', width: 10 },
            { header: 'PWD', key: 'pwd', width: 10 },
            { header: 'Hospital Bill', key: 'hospital_bill', width: 15 },
            { header: 'Medicines', key: 'medicines', width: 15 },
            // Add other service fields...
            { header: 'PHIC', key: 'phic', width: 15 },
            { header: 'PCSO', key: 'pcso', width: 15 },
            { header: 'DSWD', key: 'dswd', width: 15 },
            { header: 'MAIP', key: 'maip', width: 15 },
            { header: 'OP-SCPF', key: 'op_scpf', width: 15 },
            { header: 'OTHERS', key: 'others_fund', width: 15 },
            { header: 'Date', key: 'created_at', width: 20 }
        ];

        results.forEach(row => {
            worksheet.addRow(row);
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=services_report.xlsx'
        );

        return workbook.xlsx.write(res)
            .then(() => {
                res.end();
            });
    });
};

exports.showServices = (req, res) => {
    const sql = `SELECT * FROM services ORDER BY created_at DESC`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching services:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Grouping logic
        const groups = {
            Male: {
                '0-18': [],
                '19-35': [],
                '36-60': [],
                '61+': []
            },
            Female: {
                '0-18': [],
                '19-35': [],
                '36-60': [],
                '61+': []
            }
        };

        results.forEach(row => {
            const genderGroup = groups[row.gender];
            let ageGroup = '';

            if (row.age <= 18) ageGroup = '0-18';
            else if (row.age <= 35) ageGroup = '19-35';
            else if (row.age <= 60) ageGroup = '36-60';
            else ageGroup = '61+';

            genderGroup[ageGroup].push(row);
        });

        res.render('services', { groups });
    });
};


exports.categoryUsageReport = (req, res) => {
    const query = `
        SELECT 
            category,
            SUM(CASE WHEN patient_age BETWEEN 0 AND 18 THEN quantity ELSE 0 END) AS age_0_18,
            SUM(CASE WHEN patient_age BETWEEN 19 AND 35 THEN quantity ELSE 0 END) AS age_19_35,
            SUM(CASE WHEN patient_age BETWEEN 36 AND 60 THEN quantity ELSE 0 END) AS age_36_60,
            SUM(CASE WHEN patient_age BETWEEN 61 AND 100 THEN quantity ELSE 0 END) AS age_61_100,
            SUM(quantity) AS total_quantity
        FROM service_usage
        GROUP BY category
        ORDER BY category ASC;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching category usage report:', err);
            return res.status(500).send('Server Error');
        }

        res.render('categoryUsageReport', { reportData: results });
    });
};


exports.insertServiceUsage = (req, res) => {
  const { patient_age, category, quantity } = req.body;

  if (!patient_age || !category || !quantity) {
    return res.status(400).send('All fields are required.');
  }

  const query = `INSERT INTO service_usage ( patient_age, category, quantity) VALUES (?, ?, ?)`;

  db.query(query, [ patient_age, category, quantity], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).send('Server error inserting service usage.');
    }
        res.json({ message: 'Service record saved successfully.' });

  });
};


exports.submitFormCategoryFive = (req, res) => {
    const { age } = req.body;
    const categories = req.body.category;
    const quantities = req.body.quantity;

    if (!Array.isArray(categories) || !Array.isArray(quantities)) {
        return res.status(400).send('Invalid form data');
    }

    const values = categories.map((cat, index) => {
        const quantity = parseInt(quantities[index], 10) || 0;
        return {
            Vent: cat === 'Vent' ? quantity : 0,
            Suction: cat === 'Suction' ? quantity : 0,
            Cardiac: cat === 'Cardiac' ? quantity : 0,
            CompressAir: cat === 'Compress Air' ? quantity : 0,
            Nebu: cat === 'Nebu' ? quantity : 0,
        };
    });

    const insertPromises = values.map((val) => {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO five_category_reports 
                (age, vent, suction, cardiac, compress_air, nebu)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            db.query(sql, [age, val.Vent, val.Suction, val.Cardiac, val.CompressAir, val.Nebu], (err, result) => {
                if (err) {
                    console.error('Error inserting form data:', err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    });

    // Run all inserts
    Promise.all(insertPromises)
        .then(() => {
            res.json({ message: 'All records saved successfully.' });
        })
        .catch((err) => {
            res.status(500).send('Server error');
        });
};


const ExcelJS = require('exceljs');

exports.downloadFiveCategoryExcel = (req, res) => {
  const fiveCategoryGroupedQuery = `
    SELECT 
      CASE
        WHEN age BETWEEN 0 AND 18 THEN '0-18'
        WHEN age BETWEEN 19 AND 35 THEN '19-35'
        WHEN age BETWEEN 36 AND 60 THEN '36-60'
        WHEN age BETWEEN 61 AND 100 THEN '61-100'
        ELSE 'Unknown'
      END AS age_group,
      SUM(vent) AS vent_total,
      SUM(suction) AS suction_total,
      SUM(cardiac) AS cardiac_total,
      SUM(compress_air) AS compress_air_total,
      SUM(nebu) AS nebu_total
    FROM five_category_reports
    GROUP BY age_group
    ORDER BY age_group
  `;

  db.query(fiveCategoryGroupedQuery, async (err, fiveCategoryGroupedResults) => {
    if (err) {
      console.error("❌ Error fetching five category grouped reports:", err);
      return res.status(500).send("Error generating Excel file");
    }

    const allAgeGroups = ['0-18', '19-35', '36-60', '61-100'];

    const groupedMap = {};
    fiveCategoryGroupedResults.forEach(row => {
      groupedMap[row.age_group] = row;
    });

    const completeGroupedRecords = allAgeGroups.map(ageGroup => {
      if (groupedMap[ageGroup]) {
        return groupedMap[ageGroup];
      } else {
        return {
          age_group: ageGroup,
          vent_total: 0,
          suction_total: 0,
          cardiac_total: 0,
          compress_air_total: 0,
          nebu_total: 0
        };
      }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Grouped Records by Age');

    worksheet.columns = [
      { header: 'Age Group', key: 'age_group', width: 15 },
      { header: 'Vent', key: 'vent_total', width: 10 },
      { header: 'Suction', key: 'suction_total', width: 10 },
      { header: 'Cardiac', key: 'cardiac_total', width: 10 },
      { header: 'Compress Air', key: 'compress_air_total', width: 15 },
      { header: 'Nebu', key: 'nebu_total', width: 10 }
    ];

    completeGroupedRecords.forEach(record => {
      const row = worksheet.addRow(record);
      row.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }; // center align
      });
    });

    worksheet.getRow(1).eachCell(cell => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { bold: true }; 
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=grouped_records.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  });
};

exports.insertFourCategory = (req, res) => {
    const { ecg_quantity, xray_quantity, utz_quantity, ct_scan_quantity } = req.body;

    const total_quantity = 
        (parseInt(ecg_quantity) || 0) +
        (parseInt(xray_quantity) || 0) +
        (parseInt(utz_quantity) || 0) +
        (parseInt(ct_scan_quantity) || 0);

    const sql = `
        UPDATE four_category_reports
        SET 
            ecg_quantity = ecg_quantity + ?,
            xray_quantity = xray_quantity + ?,
            utz_quantity = utz_quantity + ?,
            ct_scan_quantity = ct_scan_quantity + ?,
            total_quantity = total_quantity + ?
        WHERE id = 1
    `;

    db.query(sql, [ecg_quantity, xray_quantity, utz_quantity, ct_scan_quantity, total_quantity], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error.');
        }
        res.json({ message: 'Record saved successfully.' });

    });
};

exports.getFourCategory = (req, res) => {
    db.query('SELECT * FROM medical_services ORDER BY created_at DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error.');
        }

        res.render('four-category-list', { services: results });
    });
};

exports.downloadFourCategoryExcel = (req, res) => {
    const query = `SELECT * FROM four_category_reports ORDER BY created_at DESC`;

    db.query(query, async (err, results) => {
        if (err) {
            console.error('❌ Error fetching medical services:', err);
            return res.status(500).send('Error generating Excel.');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Medical Services');

        worksheet.columns = [
            { header: 'ECG Qty', key: 'ecg_quantity', width: 15 },
            { header: 'XRAY Qty', key: 'xray_quantity', width: 15 },
            { header: 'UTZ Qty', key: 'utz_quantity', width: 15 },
            { header: 'CT SCAN Qty', key: 'ct_scan_quantity', width: 15 },
            { header: 'Total Qty', key: 'total_quantity', width: 15 }
        ];

        results.forEach(service => {
            worksheet.addRow({
                ecg_quantity: service.ecg_quantity,
                xray_quantity: service.xray_quantity,
                utz_quantity: service.utz_quantity,
                ct_scan_quantity: service.ct_scan_quantity,
                total_quantity: service.total_quantity
            });
        });

       worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (colNumber === 5) {
            cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        }
    });
});


        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=FourCategory.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
    });
};

exports.insertFifteenCategory = (req, res) => {
    const fields = [
        'nph_quantity', 'nebulizer_quantity', 'iv_insertion_quantity', 'ventilator_quantity',
        'p_therapy_quantity', 'cardiac_quantity', 'suction_quantity', 'compress_air_quantity',
        'droplight_quantity', 'infusion_quantity', 'h_test_quantity', 'incubator_quantity',
        'echo_2d_quantity', 'misce_quantity'
    ];

    const values = fields.map(field => parseInt(req.body[field]) || 0);
    const totalQuantity = values.reduce((sum, val) => sum + val, 0);

    const recordId = 1;

    const setClause = fields.map(field => `${field} = ${field} + ?`).join(', ');
    
    const query = `
        UPDATE fifteen_category_reports
        SET ${setClause}, total_quantity = total_quantity + ?
        WHERE id = ?
    `;

    db.query(query, [...values, totalQuantity, recordId], (err, result) => {
        if (err) {
            console.error('❌ Error updating fifteen category report:', err);
            return res.status(500).send('Error updating record');
        }

        if (result.affectedRows === 0) {
            const insertQuery = `
                INSERT INTO fifteen_category_reports (${fields.join(', ')}, total_quantity)
                VALUES (${fields.map(() => '?').join(', ')}, ?)
            `;
            db.query(insertQuery, [...values, totalQuantity], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('❌ Error inserting fifteen category report:', insertErr);
                    return res.status(500).send('Error inserting record');
                }
                res.json({ message: 'Record inserted successfully.' });
            });
        } else {
            res.json({ message: 'Record updated successfully.' });
        }
    });
};

exports.downloadFifteenCategoryExcel = async (req, res) => {
    const query = `SELECT * FROM fifteen_category_reports ORDER BY created_at DESC`;

    db.query(query, async (err, results) => {
        if (err) {
            console.error('❌ Error fetching fifteen category reports:', err);
            return res.status(500).send('Error generating Excel.');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Fifteen Medical Services');

        const columns = [
            'nph_quantity', 'nebulizer_quantity', 'iv_insertion_quantity', 'ventilator_quantity',
            'p_therapy_quantity', 'cardiac_quantity', 'suction_quantity', 'compress_air_quantity',
            'droplight_quantity', 'infusion_quantity', 'h_test_quantity', 'incubator_quantity',
            'echo_2d_quantity', 'misce_quantity', 'total_quantity'
        ];

        worksheet.columns = columns.map(col => ({
            header: col.replace('_', ' ').toUpperCase(),
            key: col,
            width: 15
        }));

        results.forEach(service => {
            worksheet.addRow(service);
        });

        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };

                if (colNumber === columns.length) {
                    cell.font = { bold: true, color: { argb: 'FFFF0000' } };
                }
            });
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=FifteenCategory.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();
    });
};


exports.insertSevenCategory = (req, res) => {
  const fields = [
    'ms_quantity', 'oxygen_quantity', 'r_and_b_quantity', 'or_dr_quantity',
    'implant_quantity', 'dialysis_quantity', 'efoetin_quantity'
  ];

  const values = fields.map(field => parseInt(req.body[field]) || 0);
  const totalQuantity = values.reduce((sum, val) => sum + val, 0);

  db.query('SELECT * FROM seven_category_reports LIMIT 1', (err, results) => {
    if (err) return res.status(500).send('Database error');

    if (results.length > 0) {
      const current = results[0];
      const updatedValues = fields.map(field => (current[field] || 0) + (parseInt(req.body[field]) || 0));
      const updatedTotal = updatedValues.reduce((sum, val) => sum + val, 0);

      const updateQuery = `
        UPDATE seven_category_reports SET
        ms_quantity = ?, oxygen_quantity = ?, r_and_b_quantity = ?, or_dr_quantity = ?,
        implant_quantity = ?, dialysis_quantity = ?, efoetin_quantity = ?, total_quantity = ?
        WHERE id = ?
      `;

      db.query(updateQuery, [...updatedValues, updatedTotal, current.id], (updateErr) => {
        if (updateErr) {
          console.error('Error updating seven category:', updateErr);
          return res.status(500).send('Error updating record');
        }
        res.json({ message: 'Record updated successfully.' });
      });

    } else {
      const insertQuery = `
        INSERT INTO seven_category_reports (${fields.join(', ')}, total_quantity)
        VALUES (${fields.map(() => '?').join(', ')}, ?)
      `;

      db.query(insertQuery, [...values, totalQuantity], (insertErr) => {
        if (insertErr) {
          console.error('Error inserting seven category:', insertErr);
          return res.status(500).send('Error inserting record');
        }
        res.json({ message: 'Record saved successfully.' });
      });
    }
  });
};

exports.deleteRecord = (req, res) => {
    const recordId = req.params.id;
    const query = 'DELETE FROM billing_records WHERE id = ?';
    
    db.query(query, [recordId], (error, results) => {
        if (error) {
            console.error('Error deleting record:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error deleting record from database' 
            });
        }
        
        if (results.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Record not found' 
            });
        }

        const logSql = 'INSERT INTO deleted_history (table_name, record_id, deleted_by) VALUES (?, ?, ?)';
        db.query(logSql, ['billing_records', recordId, req.session.user.id]);

        res.json({ 
            success: true, 
            message: 'Record deleted successfully' 
        });
    });
};

exports.deleteAllRecords = (req, res) => {
    const query = 'DELETE FROM billing_records';
    
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error deleting all records:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error deleting records from database' 
            });
        }
        
        res.json({ 
            success: true, 
            message: `All ${results.affectedRows} records deleted successfully` 
        });
    });
};








// command for deleting records
exports.deleteBill = (req, res) => {
  const { id } = req.params;

  const query = 'DELETE FROM billing_records WHERE id = ?';

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error deleting bill:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete the record.' });
    }

    console.log(`Deleted record with ID: ${id}`);
    return res.status(200).json({ success: true, message: 'Record deleted successfully.' });
  });
};












exports.downloadSevenCategoryExcel = async (req, res) => {
  db.query('SELECT * FROM seven_category_reports', async (err, results) => {
    if (err) return res.status(500).send('Database error');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Seven Medical Services');

    worksheet.columns = [
      { header: 'MS Qty', key: 'ms_quantity', width: 15 },
      { header: 'OXYGEN Qty', key: 'oxygen_quantity', width: 15 },
      { header: 'R&B Qty', key: 'r_and_b_quantity', width: 15 },
      { header: 'OR/DR Qty', key: 'or_dr_quantity', width: 15 },
      { header: 'IMPLANT Qty', key: 'implant_quantity', width: 15 },
      { header: 'DIALYSIS Qty', key: 'dialysis_quantity', width: 15 },
      { header: 'EFOETIN Qty', key: 'efoetin_quantity', width: 15 },
      { header: 'TOTAL Qty', key: 'total_quantity', width: 15 },
    ];

    results.forEach(row => {
      worksheet.addRow(row);
    });

    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=seven_medical_services.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  });
};


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

exports.downloadServiceUsage = async (req, res) => {
    db.query(`
        SELECT *
        FROM billing_records
        WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    `, async (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Medical Services Statistics');

        const servicesList = [
            'hospital_bill', 'medicines', 'laboratory', 'implants', 'diagnostic', 'others',
            'medical_supplies', 'oxygen', 'or_dr', 'rnb', 'epoetin', 'hemodialysis_sessions'
        ];

        const fundTypes = ['PHIC', 'PCSO', 'DSWD', 'MAIP', 'OP-SCPF', 'OTHERS'];
        const wards = ['Inpatient', 'Outpatient', 'ER'];

        // Service mapping function (FIXED)
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

        // Process records (FIXED)
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
            
            // Use the mapping function to categorize services
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
                    // Track ward usage
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

        // Worksheet setup (unchanged)
        worksheet.mergeCells('B1:F1');
        worksheet.getCell('B1').value = 'MALE';
        worksheet.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('B1').font = { bold: true };

        worksheet.mergeCells('G1:K1');
        worksheet.getCell('G1').value = 'FEMALE';
        worksheet.getCell('G1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('G1').font = { bold: true };

        worksheet.mergeCells('L1:L2');
        worksheet.getCell('L1').value = 'TOTAL';
        worksheet.getCell('L1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('L1').font = { bold: true };

        worksheet.mergeCells('M1:O1');
        worksheet.getCell('M1').value = 'WARD BREAKDOWN';
        worksheet.getCell('M1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('M1').font = { bold: true };

        worksheet.mergeCells('P1:Q1');
        worksheet.getCell('P1').value = 'SPECIAL CASES';
        worksheet.getCell('P1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('P1').font = { bold: true };

        worksheet.mergeCells('R1:W1');
        worksheet.getCell('R1').value = 'AMOUNT OF FUND UTILIZED';
        worksheet.getCell('R1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('R1').font = { bold: true };

        worksheet.mergeCells('X1:X2');
        worksheet.getCell('X1').value = 'TOTAL AMOUNT';
        worksheet.getCell('X1').alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getCell('X1').font = { bold: true };

        const subHeaders = [
            'SERVICE',
            '0-18', '19-35', '36-60', '61+', 'Subtotal',
            '0-18', '19-35', '36-60', '61+', 'Subtotal',
            '',
            'Inpatient', 'Outpatient', 'ER',
            'Pregnant', 'PWD',
            ...fundTypes,
            ''
        ];

        const headerRow2 = worksheet.getRow(2);
        subHeaders.forEach((header, index) => {
            if (header !== '') {
                headerRow2.getCell(index + 1).value = header;
                headerRow2.getCell(index + 1).alignment = { horizontal: 'center', vertical: 'middle' };
                headerRow2.getCell(index + 1).font = { bold: true };
            }
        });

        // Apply borders to all header cells
        for (let col = 1; col <= 24; col++) {
            worksheet.getCell(1, col).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            worksheet.getCell(2, col).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        const formatZero = (value) => {
            if (value === 0 || value === '0' || value === '0.00') return '';
            return value;
        };

        // Add data rows
        servicesList.forEach(service => {
            const rowData = [
                service.replace(/_/g, ' ').toUpperCase(),
                formatZero(data[service].male['0-18']),
                formatZero(data[service].male['19-35']),
                formatZero(data[service].male['36-60']),
                formatZero(data[service].male['61+']),
                formatZero(data[service].male.subtotal),
                formatZero(data[service].female['0-18']),
                formatZero(data[service].female['19-35']),
                formatZero(data[service].female['36-60']),
                formatZero(data[service].female['61+']),
                formatZero(data[service].female.subtotal),
                formatZero(data[service].male.subtotal + data[service].female.subtotal),
                formatZero(data[service].ward['Inpatient']),
                formatZero(data[service].ward['Outpatient']),
                formatZero(data[service].ward['ER']),
                formatZero(data[service].pregnantCount),
                formatZero(data[service].pwdCount),
                ...fundTypes.map(fund => formatZero(data[service].fundUtilization[fund].toFixed(2))),
                formatZero(data[service].totalAmountUtilized.toFixed(2))
            ];

            const row = worksheet.addRow(rowData);
            
            row.getCell(6).font = { bold: true, color: { argb: 'FFFF0000' } };
            row.getCell(11).font = { bold: true, color: { argb: 'FFFF0000' } };
        });

        // Add grand total row
        const grandTotalData = [
            'GRAND TOTAL',
            '', '', '', '', '',
            '', '', '', '', '',
            '',
            '', '', '',
            '', '',
            ...Array(fundTypes.length).fill(''),
            grandTotal.toFixed(2)
        ];

        const grandRow = worksheet.addRow(grandTotalData);
        grandRow.font = { bold: true };

        // Set column widths
        worksheet.columns.forEach((column, index) => {
            if (index === 0) column.width = 20;
            else if (index >= 12 && index <= 14) column.width = 12;
            else if (index === 23) column.width = 18;
            else column.width = 15;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=medical_services_statistics.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    });
};

exports.printServiceUsage = async (req, res) => {
    db.query(`
        SELECT *
        FROM billing_records
        WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    `, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

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
                ward: { 'Inpatient': 0, 'Outpatient': 0, 'ER': 0 },
                totalAmountUtilized: 0
            };
        });

        // Process records
        rows.forEach(row => {
            const age = row.age || 0;
            const ageGroup = getAgeGroup(age);
            const gender = row.gender ? row.gender.toLowerCase() : '';
            const ward = row.ward || 'Inpatient';

            let servicesData = [];
            try { servicesData = JSON.parse(row.services || '[]'); } catch {}

            let totalRowServices = 0;
            const serviceAmounts = {};
            servicesList.forEach(service => serviceAmounts[service] = 0);

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
                            data[serviceKey].fundUtilization[fund] += totalDue * proportion;
                        } else {
                            data[serviceKey].fundUtilization['OTHERS'] += totalDue * proportion;
                        }
                    }
                }
            });
        });

        servicesList.forEach(service => {
            data[service].totalAmountUtilized = fundTypes.reduce(
                (sum, fund) => sum + data[service].fundUtilization[fund], 0
            );
        });

        const grandTotal = servicesList.reduce(
            (sum, service) => sum + data[service].totalAmountUtilized, 0
        );

        let html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Medical Services Statistics - Print</title>
            <style>
              @page { size: landscape; margin: 12mm; }
              body { font-family: Arial, sans-serif; padding: 20px; }
              h2 { text-align: center; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #ccc; padding: 4px; text-align: center; }
              th { background: #2563eb; color: white; }
              .highlight { font-weight: bold; color: red; }
              .total-row { font-weight: bold; background: #f1f1f1; }
            </style>
          </head>
          <body>
            <h2>Medical Services Statistics</h2>
            <table>
              <thead>
                <tr>
                  <th rowspan="2">SERVICE</th>
                  <th colspan="5">MALE</th>
                  <th colspan="5">FEMALE</th>
                  <th rowspan="2">TOTAL</th>
                  <th colspan="3">WARD BREAKDOWN</th>
                  <th colspan="2">SPECIAL CASES</th>
                  <th colspan="${fundTypes.length}">AMOUNT OF FUND UTILIZED</th>
                  <th rowspan="2">TOTAL AMOUNT</th>
                </tr>
                <tr>
                  <th>0-18</th><th>19-35</th><th>36-60</th><th>61+</th><th>Subtotal</th>
                  <th>0-18</th><th>19-35</th><th>36-60</th><th>61+</th><th>Subtotal</th>
                  <th>Inpatient</th><th>Outpatient</th><th>ER</th>
                  <th>Pregnant</th><th>PWD</th>
                  ${fundTypes.map(f => `<th>${f}</th>`).join('')}
                </tr>
              </thead>
              <tbody>`;

        const formatZero = (value) => (value === 0 || value === '0.00') ? '' : value;

        servicesList.forEach(service => {
            html += `
              <tr>
                <td>${service.replace(/_/g, ' ').toUpperCase()}</td>
                <td>${formatZero(data[service].male['0-18'])}</td>
                <td>${formatZero(data[service].male['19-35'])}</td>
                <td>${formatZero(data[service].male['36-60'])}</td>
                <td>${formatZero(data[service].male['61+'])}</td>
                <td class="highlight">${formatZero(data[service].male.subtotal)}</td>
                <td>${formatZero(data[service].female['0-18'])}</td>
                <td>${formatZero(data[service].female['19-35'])}</td>
                <td>${formatZero(data[service].female['36-60'])}</td>
                <td>${formatZero(data[service].female['61+'])}</td>
                <td class="highlight">${formatZero(data[service].female.subtotal)}</td>
                <td>${formatZero(data[service].male.subtotal + data[service].female.subtotal)}</td>
                <td>${formatZero(data[service].ward['Inpatient'])}</td>
                <td>${formatZero(data[service].ward['Outpatient'])}</td>
                <td>${formatZero(data[service].ward['ER'])}</td>
                <td>${formatZero(data[service].pregnantCount)}</td>
                <td>${formatZero(data[service].pwdCount)}</td>
                ${fundTypes.map(f => `<td>${formatZero(data[service].fundUtilization[f].toFixed(2))}</td>`).join('')}
                <td>${formatZero(data[service].totalAmountUtilized.toFixed(2))}</td>
              </tr>`;
        });

        html += `
              <tr class="total-row">
                <td>GRAND TOTAL</td>
                ${'<td></td>'.repeat(servicesList.length ? 16 + fundTypes.length : 0)}
                <td>${grandTotal.toFixed(2)}</td>
              </tr>
              </tbody>
            </table>
            <script>
              window.addEventListener('load', () => {
                setTimeout(() => {
                  window.print();
                  window.onafterprint = () => window.close();
                }, 250);
              });
            </script>
          </body>
        </html>`;

        res.send(html);
    });
};



exports.downloadUsageService = (req, res) => {
   db.query('SELECT category, patient_age, quantity FROM service_usage', async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    const allCategories = [
      'LAB', 'MED', 'ECG', 'XRAY', 'CT', 'UTZ', 'OXYGEN', 'IMPLANT', 'MS', 'IV INSERTION',
      'R&B', 'OR/DR', 'NPH', 'SUCTION', 'PTHERAPY', 'DROPLIGHT', 'VENT', 'HT', 'CARDIAC',
      'NEB FEE', '2D ECHO', 'SUCTION FEE', 'PT INFUSION'
    ];

    const ageGroups = [
      { label: 'Age 0-18', min: 0, max: 18 },
      { label: 'Age 19-35', min: 19, max: 35 },
      { label: 'Age 36-60', min: 36, max: 60 },
      { label: 'Age 61-100', min: 61, max: 100 },
    ];

    const matrix = {};
    ageGroups.forEach(group => {
      matrix[group.label] = {};
      allCategories.forEach(cat => {
        matrix[group.label][cat] = 0;
      });
    });

    results.forEach(row => {
      const { category, patient_age, quantity = 0 } = row;
      ageGroups.forEach(group => {
        if (patient_age >= group.min && patient_age <= group.max) {
          if (matrix[group.label][category] !== undefined) {
            matrix[group.label][category] += quantity;
          }
        }
      });
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Service Usage');

    worksheet.addRow(['Age Group', ...allCategories]);

    ageGroups.forEach(group => {
      const row = [group.label];
      allCategories.forEach(cat => {
        row.push(matrix[group.label][cat]);
      });
      worksheet.addRow(row);
    });

    const totalRow = ['Total'];
    allCategories.forEach(cat => {
      const sum = ageGroups.reduce((acc, grp) => acc + matrix[grp.label][cat], 0);
      totalRow.push(sum);
    });
    const addedTotalRow = worksheet.addRow(totalRow);

    worksheet.getRow(1).font = { bold: true };
    addedTotalRow.font = { bold: true };
    worksheet.columns.forEach(col => col.width = 15);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="service_usage.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  });
};
