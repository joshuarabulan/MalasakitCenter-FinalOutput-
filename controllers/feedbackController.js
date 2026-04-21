const db = require('../config/db'); 

exports.createFeedback = (req, res) => {
    const {
        section,
        feedbackDate,
        timeStarted,
        timeEnded,
        objective1,
        objective2,
        objective3,
        objective4,
        comments,
        name,
        contact,
        address
    } = req.body;

    const query = `
        INSERT INTO feedbacks
        (section, feedback_date, time_started, time_ended, objective1, objective2, objective3, objective4, comments, name, contact, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        section,
        feedbackDate,
        timeStarted,
        timeEnded,
        objective1,
        objective2,
        objective3,
        objective4,
        comments,
        name,
        contact,
        address
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error saving feedback:', err);
            return res.status(500).json({ success: false, message: 'Error saving feedback' });
        }

        res.json({ success: true, message: 'Feedback submitted successfully!', id: result.insertId });
    });
};

exports.deleteFeedback = (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM feedbacks WHERE id = ?';

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error deleting feedback:', err);
            return res.status(500).json({ success: false, message: 'Error deleting feedback' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        // Check if session exists before using it
        if (req.session && req.session.user && req.session.user.id) {
            const logSql = 'INSERT INTO deleted_history (table_name, record_id, deleted_by) VALUES (?, ?, ?)';
            db.query(logSql, ['feedbacks', id, req.session.user.id], (logErr) => {
                if (logErr) {
                    console.error('Error logging feedback deletion:', logErr);
                }
            });
        }

        res.json({ success: true, message: 'Feedback deleted successfully' });
    });
};

exports.deleteAllFeedback = (req, res) => {
    const query = 'DELETE FROM feedbacks';

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error deleting all feedbacks:', err);
            return res.status(500).json({ success: false, message: 'Error deleting all feedbacks' });
        }

        res.json({ 
            success: true, 
            message: `All feedbacks (${result.affectedRows}) deleted successfully`,
            count: result.affectedRows
        });
    });
};

exports.getFeedback = (req, res) => { 
    const query = 'SELECT *, (objective1 + objective2 + objective3 + objective4) / 4 as avg_score FROM feedbacks ORDER BY id DESC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Calculate stats for the dashboard
        const total = results.length;
        let high = 0, medium = 0, low = 0;
        const sections = {};
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recent = results.filter(feedback => new Date(feedback.feedback_date) >= oneWeekAgo);
        
        results.forEach(feedback => {
            const avgScore = feedback.avg_score;
            
            if (avgScore >= 3.5) high++;
            else if (avgScore >= 2) medium++;
            else low++;
            
            // Count by section
            if (sections[feedback.section]) {
                sections[feedback.section]++;
            } else {
                sections[feedback.section] = 1;
            }
        });
        
        const topSections = Object.entries(sections)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));
        
        const stats = {
            total,
            scoreDistribution: { high, medium, low },
            sections,
            topSections,
            recent
        };

        res.render('admin/feedback', { feedbacks: results, stats });
    });
};