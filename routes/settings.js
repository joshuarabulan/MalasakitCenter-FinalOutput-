const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const settingsController = require('../controllers/settingsController');
const router = express.Router();

const avatarDirectory = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(avatarDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    cb(null, `avatar-${req.session.user.id}-${Date.now()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isImage = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype);
    cb(isImage ? null : new Error('Only image files are allowed for profile photos.'), isImage);
  }
});

router.post('/', (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      req.flash('error', err.message || 'Profile photo upload failed.');
      return res.redirect('back');
    }
    next();
  });
}, settingsController.updateSettings);

module.exports = router;
