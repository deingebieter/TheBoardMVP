const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'theboard_secret';

function generateUserId() {
  const len = 7 + Math.floor(Math.random() * 3); // 7-9 digits
  let id = '';
  for (let i = 0; i < len; i++) id += Math.floor(Math.random() * 10);
  return id;
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, user_hashtag, email, password, display_name } = req.body;
    if (!username || !user_hashtag || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check uniqueness
    const exists = db.prepare('SELECT id FROM users WHERE username=? OR user_hashtag=? OR email=?')
      .get(username, user_hashtag, email);
    if (exists) {
      return res.status(409).json({ error: 'Username, hashtag, or email already taken' });
    }

    let user_id;
    let attempts = 0;
    do {
      user_id = generateUserId();
      attempts++;
    } while (db.prepare('SELECT id FROM users WHERE user_id=?').get(user_id) && attempts < 100);

    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(`INSERT INTO users (user_id, username, user_hashtag, email, password_hash, display_name)
      VALUES (?, ?, ?, ?, ?, ?)`).run(user_id, username, user_hashtag, email, password_hash, display_name || username);

    db.prepare('INSERT INTO coin_balances (user_id) VALUES (?)').run(user_id);

    const user = db.prepare('SELECT user_id, username, user_hashtag, display_name, bio, profile_image, region, bg_music_enabled FROM users WHERE user_id=?').get(user_id);
    const token = jwt.sign({ user_id, username }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = username or email
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username=? OR email=?').get(identifier, identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ user_id: user.user_id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
