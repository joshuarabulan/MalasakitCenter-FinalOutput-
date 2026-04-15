const bcrypt = require('bcrypt');
const db = require('../config/db');

exports.updateSettings = async (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  const { name, email, password, confirmPassword } = req.body;

  console.log('--- updateSettings called ---');
  console.log('user.id:', user.id);
  console.log('name:', name, 'email:', email);
  console.log('password provided:', !!password);

  if (password) {
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters.');
      return res.redirect('back');
    }
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('back');
    }
  }

  try {
    let hashedPassword = user.password;

    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await new Promise((resolve, reject) => {
      db.query(
        'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
        [name, email, hashedPassword, user.id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    req.session.user = { ...user, name, email, password: hashedPassword };
    req.flash('success', 'Settings updated successfully!');
  } catch (err) {
    console.error('FULL ERROR:', err);
    req.flash('error', err.message);
  }

  res.redirect('back');
};