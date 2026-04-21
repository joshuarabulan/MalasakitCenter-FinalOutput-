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