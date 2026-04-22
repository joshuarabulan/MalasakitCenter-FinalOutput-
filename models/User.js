const db = require('../config/db');
const bcrypt = require('bcrypt');

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
    return String(role || 'User').trim().toLowerCase() === 'admin' ? 'Admin' : 'User';
}

const User = {
    create: async (name, email, password, role) => {
        const normalizedEmail = normalizeEmail(email);
        const normalizedRole = normalizeRole(role);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // First, get the next available ID
        return new Promise((resolve, reject) => {
            db.query('SELECT MAX(id) AS maxId FROM users', (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const nextId = (results[0].maxId || 0) + 1;
                
                // Insert with explicit ID
                db.query('INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())', 
                [nextId, name, normalizedEmail, hashedPassword, normalizedRole], (err, results) => {
                    if (err) reject(err);
                    resolve(results);
                });
            });
        });
    },
    
    findByEmail: (email) => {
        const normalizedEmail = normalizeEmail(email);
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [normalizedEmail], (err, results) => {
                if (err) reject(err);
                resolve(results[0]);
            });
        });
    },
    
    verifyPassword: async (password, hash) => {
        if (!hash) {
            return false;
        }

        if (typeof hash === 'string' && hash.startsWith('$2')) {
            return bcrypt.compare(password, hash);
        }

        // Fallback for legacy plain-text records if any still exist.
        return String(password) === String(hash);
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
        const normalizedEmail = normalizeEmail(email);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        return new Promise((resolve, reject) => {
            db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE LOWER(TRIM(email)) = ?', [hashedPassword, normalizedEmail], (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });
    },
    
    update: (id, name, email, role) => {
        const normalizedEmail = normalizeEmail(email);
        const normalizedRole = normalizeRole(role);
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?`;
            db.query(sql, [name, normalizedEmail, normalizedRole, id], (err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    },
    
    softDelete: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET status = 'Deleted' WHERE id = ?`;
            db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    }
};

module.exports = User;
