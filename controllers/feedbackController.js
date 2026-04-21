const db = require('../config/db');

exports.createFeedback = (req, res) => {
    const {
        section, feedbackDate, timeStarted, timeEnded,
        objective1, objective2, objective3, objective4,
        comments, name, contact, address
    } = req.body;

    const query = `
        INSERT INTO feedbacks
        (section, feedback_date, time_started, time_ended, objective1, objective2, objective3, objective4, comments, name, contact, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [section, feedbackDate, timeStarted, timeEnded,
        objective1, objective2, objective3, objective4,
        comments, name, contact, address], (err, result) => {
        if (err) {
            console.error('Error saving feedback:', err);
            return res.status(500).json({ success: false, message: 'Error saving feedback' });
        }
        res.json({ success: true, message: 'Feedback submitted successfully!' });
    });
};

exports.deleteFeedback = (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM feedbacks WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error deleting feedback:', err);
            return res.status(500).json({ success: false, message: 'Error deleting feedback' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        const userId = req.session && req.session.user ? req.session.user.id : null;
        db.query(
            'INSERT INTO deleted_history (table_name, record_id, deleted_by) VALUES (?, ?, ?)',
            ['feedbacks', id, userId],
            (logErr) => { if (logErr) console.error('Error logging deletion:', logErr); }
        );

        res.json({ success: true, message: 'Feedback deleted successfully' });
    });
};

exports.deleteAllFeedback = (req, res) => {
    // Grab IDs first so we can log them
    db.query('SELECT id FROM feedbacks', (err, rows) => {
        if (err) {
            console.error('Error fetching feedback IDs:', err);
            return res.status(500).json({ success: false, message: 'Error deleting all feedbacks' });
        }

        db.query('DELETE FROM feedbacks', (delErr, result) => {
            if (delErr) {
                console.error('Error deleting all feedbacks:', delErr);
                return res.status(500).json({ success: false, message: 'Error deleting all feedbacks' });
            }

            // Log each deleted record
            const userId = req.session && req.session.user ? req.session.user.id : null;
            rows.forEach(row => {
                db.query(
                    'INSERT INTO deleted_history (table_name, record_id, deleted_by) VALUES (?, ?, ?)',
                    ['feedbacks', row.id, userId],
                    (logErr) => { if (logErr) console.error('Error logging deletion:', logErr); }
                );
            });

            res.json({
                success: true,
                message: `All feedbacks (${result.affectedRows}) deleted successfully`,
                count: result.affectedRows
            });
        });
    });
};

exports.getFeedback = (req, res) => {
    const query = `
        SELECT *,
            (objective1 + objective2 + objective3 + objective4) / 4 AS avg_score
        FROM feedbacks
        ORDER BY feedback_date DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Normalize feedback_date to a plain JS Date safely
        results = results.map(f => {
            let d = f.feedback_date;
            if (!(d instanceof Date)) d = new Date(d);
            f.feedback_date = isNaN(d.getTime()) ? null : d;
            return f;
        });

        const total = results.length;
        let high = 0, medium = 0, low = 0;
        const sections = {};

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recent = results.filter(f => f.feedback_date && f.feedback_date >= oneWeekAgo);

        results.forEach(f => {
            const avg = parseFloat(f.avg_score) || 0;
            if (avg >= 3.5) high++;
            else if (avg >= 2) medium++;
            else low++;

            sections[f.section] = (sections[f.section] || 0) + 1;
        });

        const topSections = Object.entries(sections)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));

        const stats = { total, scoreDistribution: { high, medium, low }, sections, topSections, recent };

        res.render('admin/feedback', { feedbacks: results, stats });
    });
};