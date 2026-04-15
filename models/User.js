const db = require('../config/db');
const bcrypt = require('bcrypt');


const User = {
    create: async (name, email, password, role) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            db.query('INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())', 
            [name, email, hashedPassword, role], (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });
    },
    findByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
                if (err) reject(err);
                resolve(results[0]);
            });
        });
    },
    verifyPassword: async (password, hash) => {
        return await bcrypt.compare(password, hash);
    },
    setResetToken: (email, token) => {
        return new Promise((resolve, reject) => {
            db.query('UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE email = ?', [token, email], (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });
    },
    findByResetToken: (token) => {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()', [token], (err, results) => {
                if (err) reject(err);
                resolve(results[0]);
            });
        });
    },
    updatePassword: async (email, newPassword) => {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        return new Promise((resolve, reject) => {
            db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?', [hashedPassword, email], (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });
    }
};

// EDIT user info
User.update = (id, name, email, role) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?`;
        db.query(sql, [name, email, role, id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

// SOFT DELETE user (status = 'Deleted')
User.softDelete = (id) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE users SET status = 'Deleted' WHERE id = ?`;
        db.query(sql, [id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
}; 

module.exports = User;
