const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /mainfeed - posts from followed users
router.get('/', optionalAuth, (req, res) => {
  const { page = 1, limit = 20, region = 'global' } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user?.user_id;

  let posts;
  if (userId) {
    posts = db.prepare(`
      SELECT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
      FROM mainfeed_posts p JOIN users u ON p.user_id=u.user_id
      WHERE p.user_id IN (
        SELECT following_id FROM user_follows WHERE follower_id=?
      )
      AND p.expires_at > datetime('now')
      AND (? = 'global' OR p.region=? OR p.region='global')
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(userId, region, region, parseInt(limit), offset);

    if (!posts.length) {
      posts = db.prepare(`
        SELECT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
        FROM mainfeed_posts p JOIN users u ON p.user_id=u.user_id
        WHERE p.expires_at > datetime('now')
        AND (? = 'global' OR p.region=? OR p.region='global')
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?
      `).all(region, region, parseInt(limit), offset);
    }
  } else {
    posts = db.prepare(`
      SELECT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
      FROM mainfeed_posts p JOIN users u ON p.user_id=u.user_id
      WHERE p.expires_at > datetime('now')
      AND (? = 'global' OR p.region=? OR p.region='global')
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(region, region, parseInt(limit), offset);
  }

  const enriched = posts.map(post => {
    const hashtags = db.prepare(`
      SELECT h.name FROM hashtags h JOIN mainfeed_post_hashtags ph ON h.id=ph.hashtag_id WHERE ph.post_id=?
    `).all(post.post_id).map(r => r.name);

    let userInteraction = null;
    if (userId) {
      userInteraction = db.prepare("SELECT type FROM mainfeed_interactions WHERE post_id=? AND user_id=?").get(post.post_id, userId);
    }

    const discussion = db.prepare("SELECT discussion_id FROM discussions WHERE mainfeed_post_id=?").get(post.post_id);

    return { ...post, hashtags, user_interaction: userInteraction?.type || null, discussion_id: discussion?.discussion_id || null };
  });

  // inject ads every 10 posts
  const ads = db.prepare(`SELECT a.*, u.username, u.display_name FROM advertisements a JOIN users u ON a.user_id=u.user_id
    WHERE a.is_active=1 AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
    AND (a.feed_type='mainfeed' OR a.feed_type='both') LIMIT 5`).all();

  const feed = [];
  enriched.forEach((post, i) => {
    feed.push({ ...post, slot_type: 'post' });
    if ((i + 1) % 10 === 0 && ads.length) {
      const ad = ads[Math.floor(Math.random() * ads.length)];
      feed.push({ ...ad, slot_type: 'ad' });
    }
  });

  res.json({ posts: feed, page: parseInt(page), limit: parseInt(limit) });
});

// POST /mainfeed - create post
router.post('/', authMiddleware, upload.single('media'), (req, res) => {
  const { content, hashtags, region, country, city } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const post_id = uuidv4();
  const media_url = req.file ? `/uploads/images/${req.file.filename}` : null;
  const media_type = req.file ? (req.file.mimetype.includes('gif') ? 'gif' : 'image') : null;

  db.prepare(`INSERT INTO mainfeed_posts (post_id, user_id, content, media_url, media_type, region, country, city)
    VALUES (?,?,?,?,?,?,?,?)`).run(post_id, req.user.user_id, content, media_url, media_type, region || 'global', country, city);

  if (hashtags) {
    const tagList = hashtags.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
    for (const tag of tagList) {
      let ht = db.prepare('SELECT id FROM hashtags WHERE name=?').get(tag);
      if (!ht) {
        db.prepare('INSERT INTO hashtags (name) VALUES (?)').run(tag);
        ht = db.prepare('SELECT id FROM hashtags WHERE name=?').get(tag);
      }
      db.prepare('UPDATE hashtags SET post_count=post_count+1 WHERE id=?').run(ht.id);
      db.prepare('INSERT OR IGNORE INTO mainfeed_post_hashtags (post_id, hashtag_id) VALUES (?,?)').run(post_id, ht.id);
    }
  }

  const post = db.prepare('SELECT mp.*, u.username, u.display_name FROM mainfeed_posts mp JOIN users u ON mp.user_id=u.user_id WHERE mp.post_id=?').get(post_id);
  res.status(201).json(post);
});

// GET /mainfeed/:post_id
router.get('/:post_id', optionalAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
    FROM mainfeed_posts p JOIN users u ON p.user_id=u.user_id WHERE p.post_id=?
  `).get(req.params.post_id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const hashtags = db.prepare('SELECT h.name FROM hashtags h JOIN mainfeed_post_hashtags ph ON h.id=ph.hashtag_id WHERE ph.post_id=?').all(req.params.post_id).map(r => r.name);
  res.json({ ...post, hashtags });
});

// POST /mainfeed/:post_id/interact
router.post('/:post_id/interact', authMiddleware, (req, res) => {
  const { type } = req.body;
  if (!['like', 'dislike'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

  const post = db.prepare('SELECT * FROM mainfeed_posts WHERE post_id=?').get(req.params.post_id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT * FROM mainfeed_interactions WHERE post_id=? AND user_id=?').get(req.params.post_id, req.user.user_id);

  if (existing) {
    if (existing.type === type) {
      // Remove interaction (toggle off)
      db.prepare('DELETE FROM mainfeed_interactions WHERE post_id=? AND user_id=?').run(req.params.post_id, req.user.user_id);
      const delta = type === 'like' ? -1 : 0;
      const dislikeDelta = type === 'dislike' ? -1 : 0;
      db.prepare('UPDATE mainfeed_posts SET like_count=like_count+?, dislike_count=dislike_count+? WHERE post_id=?').run(delta, dislikeDelta, req.params.post_id);
      return res.json({ type: null });
    } else {
      // Change reaction
      const oldDelta = existing.type === 'like' ? -1 : 0;
      const oldDislikeDelta = existing.type === 'dislike' ? -1 : 0;
      const newDelta = type === 'like' ? 1 : 0;
      const newDislikeDelta = type === 'dislike' ? 1 : 0;
      db.prepare('UPDATE mainfeed_interactions SET type=? WHERE post_id=? AND user_id=?').run(type, req.params.post_id, req.user.user_id);
      db.prepare('UPDATE mainfeed_posts SET like_count=like_count+?, dislike_count=dislike_count+? WHERE post_id=?').run(oldDelta + newDelta, oldDislikeDelta + newDislikeDelta, req.params.post_id);
    }
  } else {
    db.prepare('INSERT INTO mainfeed_interactions (post_id, user_id, type) VALUES (?,?,?)').run(req.params.post_id, req.user.user_id, type);
    db.prepare('UPDATE mainfeed_posts SET like_count=like_count+?, dislike_count=dislike_count+? WHERE post_id=?')
      .run(type === 'like' ? 1 : 0, type === 'dislike' ? 1 : 0, req.params.post_id);
  }

  res.json({ type });
});

// GET /mainfeed/:post_id/comments
router.get('/:post_id/comments', optionalAuth, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.username, u.display_name, u.profile_image
    FROM fyp_comments c JOIN users u ON c.user_id=u.user_id
    WHERE c.post_id=? ORDER BY c.created_at ASC
  `).all(req.params.post_id);
  res.json(comments);
});

module.exports = router;
