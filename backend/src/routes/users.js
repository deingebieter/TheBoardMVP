const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /users/:user_id - public profile
router.get('/:user_id', optionalAuth, (req, res) => {
  const user = db.prepare(`
    SELECT user_id, username, user_hashtag, display_name, bio, profile_image, links, region, city, created_at
    FROM users WHERE user_id=?
  `).get(req.params.user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const coins = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.params.user_id);
  const followerCount = db.prepare('SELECT COUNT(*) as c FROM user_follows WHERE following_id=?').get(req.params.user_id).c;
  const followingCount = db.prepare('SELECT COUNT(*) as c FROM user_follows WHERE follower_id=?').get(req.params.user_id).c;

  let isFollowing = false;
  if (req.user) {
    isFollowing = !!db.prepare('SELECT id FROM user_follows WHERE follower_id=? AND following_id=?')
      .get(req.user.user_id, req.params.user_id);
  }

  res.json({ ...user, coins, follower_count: followerCount, following_count: followingCount, is_following: isFollowing });
});

// GET /users/me/profile - own profile
router.get('/me/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id=?').get(req.user.user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const coins = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.user.user_id);
  const { password_hash, ...safeUser } = user;
  res.json({ ...safeUser, coins });
});

// PATCH /users/me - update profile
router.patch('/me', authMiddleware, upload.single('profile_image'), (req, res) => {
  const { display_name, bio, links, region, city, bg_music_enabled } = req.body;
  const profile_image = req.file ? `/uploads/images/${req.file.filename}` : undefined;

  const updates = [];
  const params = [];

  if (display_name !== undefined) { updates.push('display_name=?'); params.push(display_name); }
  if (bio !== undefined) { updates.push('bio=?'); params.push(bio); }
  if (links !== undefined) { updates.push('links=?'); params.push(links); }
  if (region !== undefined) { updates.push('region=?'); params.push(region); }
  if (city !== undefined) { updates.push('city=?'); params.push(city); }
  if (bg_music_enabled !== undefined) { updates.push('bg_music_enabled=?'); params.push(bg_music_enabled ? 1 : 0); }
  if (profile_image) { updates.push('profile_image=?'); params.push(profile_image); }

  if (updates.length) {
    updates.push('updated_at=datetime(\'now\')');
    params.push(req.user.user_id);
    db.prepare(`UPDATE users SET ${updates.join(',')} WHERE user_id=?`).run(...params);
  }

  const user = db.prepare('SELECT * FROM users WHERE user_id=?').get(req.user.user_id);
  const coins = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.user.user_id);
  const { password_hash, ...safeUser } = user;
  res.json({ ...safeUser, coins });
});

// POST /users/:user_id/follow
router.post('/:user_id/follow', authMiddleware, (req, res) => {
  if (req.user.user_id === req.params.user_id) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  const target = db.prepare('SELECT user_id FROM users WHERE user_id=?').get(req.params.user_id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  try {
    db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?,?)').run(req.user.user_id, req.params.user_id);
    res.json({ following: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /users/:user_id/follow
router.delete('/:user_id/follow', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM user_follows WHERE follower_id=? AND following_id=?').run(req.user.user_id, req.params.user_id);
  res.json({ following: false });
});

// GET /users/me/hashtag-follows
router.get('/me/hashtag-follows', authMiddleware, (req, res) => {
  const hashtags = db.prepare(`
    SELECT h.id, h.name, h.post_count FROM hashtags h
    JOIN hashtag_follows hf ON h.id=hf.hashtag_id
    WHERE hf.user_id=? ORDER BY h.name
  `).all(req.user.user_id);
  res.json(hashtags);
});

// POST /users/me/hashtag-follows/:name
router.post('/me/hashtag-follows/:name', authMiddleware, (req, res) => {
  const name = req.params.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
  let hashtag = db.prepare('SELECT * FROM hashtags WHERE name=?').get(name);
  if (!hashtag) {
    db.prepare('INSERT INTO hashtags (name) VALUES (?)').run(name);
    hashtag = db.prepare('SELECT * FROM hashtags WHERE name=?').get(name);
  }
  db.prepare('INSERT OR IGNORE INTO hashtag_follows (user_id, hashtag_id) VALUES (?,?)').run(req.user.user_id, hashtag.id);
  res.json({ followed: true, hashtag });
});

// DELETE /users/me/hashtag-follows/:name
router.delete('/me/hashtag-follows/:name', authMiddleware, (req, res) => {
  const hashtag = db.prepare('SELECT id FROM hashtags WHERE name=?').get(req.params.name);
  if (hashtag) {
    db.prepare('DELETE FROM hashtag_follows WHERE user_id=? AND hashtag_id=?').run(req.user.user_id, hashtag.id);
  }
  res.json({ followed: false });
});

// GET /users/me/notifications
router.get('/me/notifications', authMiddleware, (req, res) => {
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.user_id);
  res.json(notifs);
});

// PATCH /users/me/notifications/read
router.patch('/me/notifications/read', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.user_id);
  res.json({ ok: true });
});

module.exports = router;
