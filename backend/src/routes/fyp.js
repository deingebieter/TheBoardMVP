const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /fyp - fetch FYP feed
router.get('/', optionalAuth, (req, res) => {
  const { region = 'global', country, city, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user?.user_id;

  let posts;

  if (userId) {
    // Hashtag-based feed: posts that match followed hashtags
    posts = db.prepare(`
      SELECT DISTINCT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
      FROM fyp_posts p
      JOIN users u ON p.user_id = u.user_id
      JOIN fyp_post_hashtags ph ON p.post_id = ph.post_id
      JOIN hashtag_follows hf ON ph.hashtag_id = hf.hashtag_id
      WHERE hf.user_id = ?
        AND p.expires_at > datetime('now')
        AND p.is_ad = 0
        AND (? = 'global' OR p.region = ? OR p.region = 'global')
      ORDER BY p.is_boosted DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, region, region, parseInt(limit), offset);

    // fallback to all posts if feed is empty
    if (!posts.length) {
      posts = db.prepare(`
        SELECT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
        FROM fyp_posts p JOIN users u ON p.user_id=u.user_id
        WHERE p.expires_at > datetime('now') AND p.is_ad=0
          AND (? = 'global' OR p.region=? OR p.region='global')
        ORDER BY p.is_boosted DESC, p.created_at DESC LIMIT ? OFFSET ?
      `).all(region, region, parseInt(limit), offset);
    }
  } else {
    posts = db.prepare(`
      SELECT p.*, u.username, u.user_hashtag, u.display_name, u.profile_image
      FROM fyp_posts p JOIN users u ON p.user_id=u.user_id
      WHERE p.expires_at > datetime('now') AND p.is_ad=0
        AND (? = 'global' OR p.region=? OR p.region='global')
      ORDER BY p.is_boosted DESC, p.created_at DESC LIMIT ? OFFSET ?
    `).all(region, region, parseInt(limit), offset);
  }

  // Attach hashtags and interaction counts per post
  const enriched = posts.map(post => {
    const hashtags = db.prepare(`
      SELECT h.name FROM hashtags h JOIN fyp_post_hashtags ph ON h.id=ph.hashtag_id WHERE ph.post_id=?
    `).all(post.post_id).map(r => r.name);

    const likes = db.prepare("SELECT COUNT(*) as c FROM fyp_interactions WHERE post_id=? AND type='like'").get(post.post_id).c;
    const superLikes = db.prepare("SELECT COUNT(*) as c FROM fyp_interactions WHERE post_id=? AND type='super_like'").get(post.post_id).c;
    const comments = db.prepare("SELECT COUNT(*) as c FROM fyp_comments WHERE post_id=?").get(post.post_id).c;

    let userInteraction = null;
    if (userId) {
      userInteraction = db.prepare("SELECT type FROM fyp_interactions WHERE post_id=? AND user_id=? AND type IN ('like','super_like','dislike','super_dislike','irrelevant')").get(post.post_id, userId);
    }

    return { ...post, hashtags, likes, super_likes: superLikes, comment_count: comments, user_interaction: userInteraction?.type || null };
  });

  // Inject ads every 10 posts
  const ads = db.prepare(`SELECT a.*, u.username, u.display_name FROM advertisements a JOIN users u ON a.user_id=u.user_id
    WHERE a.is_active=1 AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
    AND (a.feed_type='fyp' OR a.feed_type='both') LIMIT 5`).all();

  const feed = [];
  enriched.forEach((post, i) => {
    feed.push({ ...post, slot_type: 'post' });
    if ((i + 1) % 5 === 0 && i > 0) {
      // boosted slot - already handled by ordering
    }
    if ((i + 1) % 10 === 0 && ads.length) {
      const ad = ads[Math.floor(Math.random() * ads.length)];
      feed.push({ ...ad, slot_type: 'ad' });
    }
  });

  res.json({ posts: feed, page: parseInt(page), limit: parseInt(limit) });
});

// POST /fyp - create FYP post
router.post('/', authMiddleware, upload.single('media'), (req, res) => {
  const { caption, hashtags, region, country, city, competition_id } = req.body;

  if (!req.file) return res.status(400).json({ error: 'Media file required' });
  if (!hashtags) return res.status(400).json({ error: 'At least one hashtag required' });

  const post_id = uuidv4();
  const media_url = `/uploads/${req.file.mimetype.startsWith('video/') ? 'videos' : 'images'}/${req.file.filename}`;
  const media_type = req.file.mimetype.startsWith('video/') ? 'video' : 'gif';

  db.prepare(`INSERT INTO fyp_posts (post_id, user_id, media_url, media_type, caption, region, country, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(post_id, req.user.user_id, media_url, media_type, caption, region || 'global', country, city);

  // Handle hashtags
  const tagList = hashtags.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
  for (const tag of tagList) {
    let ht = db.prepare('SELECT id FROM hashtags WHERE name=?').get(tag);
    if (!ht) {
      db.prepare('INSERT INTO hashtags (name) VALUES (?)').run(tag);
      ht = db.prepare('SELECT id FROM hashtags WHERE name=?').get(tag);
    }
    db.prepare('UPDATE hashtags SET post_count=post_count+1 WHERE id=?').run(ht.id);
    db.prepare('INSERT OR IGNORE INTO fyp_post_hashtags (post_id, hashtag_id) VALUES (?,?)').run(post_id, ht.id);
  }

  // Auto-enter active normal competition if requested
  if (competition_id) {
    const comp = db.prepare("SELECT * FROM competitions WHERE competition_id=? AND status='active'").get(competition_id);
    if (comp) {
      db.prepare(`INSERT OR IGNORE INTO competition_entries (competition_id, user_id, post_id) VALUES (?,?,?)`)
        .run(competition_id, req.user.user_id, post_id);
    }
  }

  const post = db.prepare('SELECT * FROM fyp_posts WHERE post_id=?').get(post_id);
  res.status(201).json({ ...post, hashtags: tagList });
});

// POST /fyp/:post_id/interact
router.post('/:post_id/interact', authMiddleware, (req, res) => {
  const { type } = req.body;
  const validTypes = ['like', 'super_like', 'dislike', 'super_dislike', 'irrelevant', 'download'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid interaction type' });

  const post = db.prepare('SELECT * FROM fyp_posts WHERE post_id=?').get(req.params.post_id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // For reaction types, replace existing reaction
  const reactionTypes = ['like', 'super_like', 'dislike', 'super_dislike', 'irrelevant'];
  if (reactionTypes.includes(type)) {
    db.prepare("DELETE FROM fyp_interactions WHERE post_id=? AND user_id=? AND type IN ('like','super_like','dislike','super_dislike','irrelevant')")
      .run(req.params.post_id, req.user.user_id);
  }

  db.prepare('INSERT OR IGNORE INTO fyp_interactions (post_id, user_id, type) VALUES (?,?,?)').run(req.params.post_id, req.user.user_id, type);

  res.json({ ok: true, type });
});

// POST /fyp/:post_id/comment
router.post('/:post_id/comment', authMiddleware, (req, res) => {
  const { content, parent_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const post = db.prepare('SELECT * FROM fyp_posts WHERE post_id=?').get(req.params.post_id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const comment_id = uuidv4();
  db.prepare(`INSERT INTO fyp_comments (comment_id, post_id, user_id, parent_id, content) VALUES (?,?,?,?,?)`)
    .run(comment_id, req.params.post_id, req.user.user_id, parent_id || null, content);

  const comment = db.prepare('SELECT fc.*, u.username, u.display_name, u.profile_image FROM fyp_comments fc JOIN users u ON fc.user_id=u.user_id WHERE fc.comment_id=?').get(comment_id);
  res.status(201).json(comment);
});

// GET /fyp/:post_id/comments
router.get('/:post_id/comments', optionalAuth, (req, res) => {
  const comments = db.prepare(`
    SELECT fc.*, u.username, u.display_name, u.profile_image
    FROM fyp_comments fc JOIN users u ON fc.user_id=u.user_id
    WHERE fc.post_id=? ORDER BY fc.created_at ASC
  `).all(req.params.post_id);
  res.json(comments);
});

// GET /fyp/trending - trending hashtags
router.get('/trending/hashtags', (req, res) => {
  const trending = db.prepare('SELECT * FROM hashtags ORDER BY post_count DESC LIMIT 20').all();
  res.json(trending);
});

module.exports = router;
