const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
}

function deleteAvatarFile(filename) {
  if (!filename) {
    return;
  }

  const filePath = path.join(__dirname, '..', 'uploads', 'avatars', filename);
  fs.unlink(filePath, () => {});
}

exports.updateSettings = async (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    return res.redirect('/login');
  }

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  const uploadedAvatar = req.file ? req.file.filename : null;

  if (!name || !email) {
    if (uploadedAvatar) {
      deleteAvatarFile(uploadedAvatar);
    }
    req.flash('error', 'Name and email are required.');
    return res.redirect('back');
  }

  if (password) {
    if (password.length < 6) {
      if (uploadedAvatar) {
        deleteAvatarFile(uploadedAvatar);
      }
      req.flash('error', 'Password must be at least 6 characters.');
      return res.redirect('back');
    }

    if (password !== confirmPassword) {
      if (uploadedAvatar) {
        deleteAvatarFile(uploadedAvatar);
      }
      req.flash('error', 'Passwords do not match.');
      return res.redirect('back');
    }
  }

  try {
    const currentUserRows = await runQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [sessionUser.id]);
    const currentUser = currentUserRows[0];

    if (!currentUser) {
      if (uploadedAvatar) {
        deleteAvatarFile(uploadedAvatar);
      }
      req.flash('error', 'User account not found.');
      return res.redirect('back');
    }

    const duplicateRows = await runQuery(
      'SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND id != ? LIMIT 1',
      [email, sessionUser.id]
    );

    if (duplicateRows.length > 0) {
      if (uploadedAvatar) {
        deleteAvatarFile(uploadedAvatar);
      }
      req.flash('error', 'That email is already in use by another account.');
      return res.redirect('back');
    }

    let hashedPassword = currentUser.password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const currentProfilePicture = currentUser.profile_picture || currentUser.avatar || null;
    const nextAvatar = uploadedAvatar || currentProfilePicture || null;

    await runQuery(
      'UPDATE users SET name = ?, email = ?, password = ?, profile_picture = ? WHERE id = ?',
      [name, email, hashedPassword, nextAvatar, sessionUser.id]
    );

    if (uploadedAvatar && currentProfilePicture && currentProfilePicture !== uploadedAvatar) {
      deleteAvatarFile(currentProfilePicture);
    }

    req.session.user = {
      ...sessionUser,
      name,
      email,
      avatar: nextAvatar,
      profile_picture: nextAvatar
    };

    req.flash('success', 'Settings updated successfully!');
  } catch (err) {
    if (uploadedAvatar) {
      deleteAvatarFile(uploadedAvatar);
    }
    console.error('Settings update error:', err);
    req.flash('error', err.message || 'Unable to update settings.');
  }

  res.redirect('back');
};
