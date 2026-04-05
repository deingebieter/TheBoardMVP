const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// GET /discussions - list discussions
router.get('/', optionalAuth, (req, res) => {
  const { sort = 'new', page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // Explicit whitelist for ORDER BY to prevent SQL injection
  const ORDER_BY_MAP = {
    top: '(d.upvote_count - d.downvote_count) DESC',
    controversial: '(d.upvote_count + d.downvote_count) DESC',
    new: 'd.created_at DESC',
  };
  const orderBy = ORDER_BY_MAP[sort] || ORDER_BY_MAP.new;

  const discussions = db.prepare(`
    SELECT d.*, u.username, u.display_name, u.profile_image
    FROM discussions d JOIN users u ON d.user_id=u.user_id
    ORDER BY ${orderBy} LIMIT ? OFFSET ?
  `).all(parseInt(limit), offset);

  const enriched = discussions.map(d => {
    let userVote = null;
    if (req.user) {
      const v = db.prepare("SELECT vote FROM discussion_votes WHERE target_type='discussion' AND target_id=? AND user_id=?").get(d.discussion_id, req.user.user_id);
      userVote = v?.vote || null;
    }
    return { ...d, user_vote: userVote };
  });

  res.json({ discussions: enriched, page: parseInt(page) });
});

// POST /discussions - create discussion
router.post('/', authMiddleware, (req, res) => {
  const { title, content, mainfeed_post_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const discussion_id = uuidv4();
  db.prepare(`INSERT INTO discussions (discussion_id, user_id, title, content, mainfeed_post_id) VALUES (?,?,?,?,?)`)
    .run(discussion_id, req.user.user_id, title, content, mainfeed_post_id || null);

  const discussion = db.prepare('SELECT d.*, u.username, u.display_name FROM discussions d JOIN users u ON d.user_id=u.user_id WHERE d.discussion_id=?').get(discussion_id);
  res.status(201).json(discussion);
});

// GET /discussions/:discussion_id
router.get('/:discussion_id', optionalAuth, (req, res) => {
  const discussion = db.prepare(`
    SELECT d.*, u.username, u.display_name, u.profile_image
    FROM discussions d JOIN users u ON d.user_id=u.user_id
    WHERE d.discussion_id=?
  `).get(req.params.discussion_id);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

  let userVote = null;
  if (req.user) {
    const v = db.prepare("SELECT vote FROM discussion_votes WHERE target_type='discussion' AND target_id=? AND user_id=?").get(req.params.discussion_id, req.user.user_id);
    userVote = v?.vote || null;
  }

  res.json({ ...discussion, user_vote: userVote });
});

// POST /discussions/:discussion_id/vote
router.post('/:discussion_id/vote', authMiddleware, (req, res) => {
  const { vote } = req.body; // 1 or -1
  if (![1, -1].includes(Number(vote))) return res.status(400).json({ error: 'Vote must be 1 or -1' });

  const discussion = db.prepare('SELECT * FROM discussions WHERE discussion_id=?').get(req.params.discussion_id);
  if (!discussion) return res.status(404).json({ error: 'Not found' });

  const existing = db.prepare("SELECT * FROM discussion_votes WHERE target_type='discussion' AND target_id=? AND user_id=?").get(req.params.discussion_id, req.user.user_id);

  if (existing) {
    if (existing.vote === Number(vote)) {
      // Remove vote
      db.prepare("DELETE FROM discussion_votes WHERE target_type='discussion' AND target_id=? AND user_id=?").run(req.params.discussion_id, req.user.user_id);
      if (existing.vote === 1) db.prepare('UPDATE discussions SET upvote_count=upvote_count-1 WHERE discussion_id=?').run(req.params.discussion_id);
      else db.prepare('UPDATE discussions SET downvote_count=downvote_count-1 WHERE discussion_id=?').run(req.params.discussion_id);
      return res.json({ vote: null });
    } else {
      db.prepare("UPDATE discussion_votes SET vote=? WHERE target_type='discussion' AND target_id=? AND user_id=?").run(Number(vote), req.params.discussion_id, req.user.user_id);
      if (Number(vote) === 1) {
        db.prepare('UPDATE discussions SET upvote_count=upvote_count+1, downvote_count=downvote_count-1 WHERE discussion_id=?').run(req.params.discussion_id);
      } else {
        db.prepare('UPDATE discussions SET upvote_count=upvote_count-1, downvote_count=downvote_count+1 WHERE discussion_id=?').run(req.params.discussion_id);
      }
    }
  } else {
    db.prepare("INSERT INTO discussion_votes (target_type, target_id, user_id, vote) VALUES ('discussion',?,?,?)").run(req.params.discussion_id, req.user.user_id, Number(vote));
    if (Number(vote) === 1) db.prepare('UPDATE discussions SET upvote_count=upvote_count+1 WHERE discussion_id=?').run(req.params.discussion_id);
    else db.prepare('UPDATE discussions SET downvote_count=downvote_count+1 WHERE discussion_id=?').run(req.params.discussion_id);
  }

  res.json({ vote: Number(vote) });
});

// GET /discussions/:discussion_id/comments
router.get('/:discussion_id/comments', optionalAuth, (req, res) => {
  const { sort = 'top' } = req.query;

  // Explicit whitelist for ORDER BY to prevent SQL injection
  const ORDER_BY_MAP = {
    top: '(c.upvote_count - c.downvote_count) DESC',
    new: 'c.created_at DESC',
    controversial: '(c.upvote_count + c.downvote_count) DESC',
    old: 'c.created_at ASC',
  };
  const orderBy = ORDER_BY_MAP[sort] || ORDER_BY_MAP.top;

  const comments = db.prepare(`
    SELECT c.*, u.username, u.display_name, u.profile_image
    FROM discussion_comments c JOIN users u ON c.user_id=u.user_id
    WHERE c.discussion_id=?
    ORDER BY c.parent_id ASC NULLS FIRST, ${orderBy}
  `).all(req.params.discussion_id);

  const enriched = comments.map(c => {
    let userVote = null;
    if (req.user) {
      const v = db.prepare("SELECT vote FROM discussion_votes WHERE target_type='comment' AND target_id=? AND user_id=?").get(c.comment_id, req.user.user_id);
      userVote = v?.vote || null;
    }
    return { ...c, user_vote: userVote };
  });

  // Build tree structure
  const map = {};
  const roots = [];
  enriched.forEach(c => { c.replies = []; map[c.comment_id] = c; });
  enriched.forEach(c => {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies.push(c);
    else roots.push(c);
  });

  res.json(roots);
});

// POST /discussions/:discussion_id/comments
router.post('/:discussion_id/comments', authMiddleware, (req, res) => {
  const { content, parent_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const discussion = db.prepare('SELECT * FROM discussions WHERE discussion_id=?').get(req.params.discussion_id);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

  let depth = 0;
  if (parent_id) {
    const parent = db.prepare('SELECT depth FROM discussion_comments WHERE comment_id=?').get(parent_id);
    depth = parent ? parent.depth + 1 : 0;
  }

  const comment_id = uuidv4();
  db.prepare(`INSERT INTO discussion_comments (comment_id, discussion_id, user_id, parent_id, content, depth) VALUES (?,?,?,?,?,?)`)
    .run(comment_id, req.params.discussion_id, req.user.user_id, parent_id || null, content, depth);

  db.prepare('UPDATE discussions SET comment_count=comment_count+1 WHERE discussion_id=?').run(req.params.discussion_id);

  const comment = db.prepare('SELECT dc.*, u.username, u.display_name, u.profile_image FROM discussion_comments dc JOIN users u ON dc.user_id=u.user_id WHERE dc.comment_id=?').get(comment_id);
  res.status(201).json({ ...comment, replies: [] });
});

// POST /discussions/comments/:comment_id/vote
router.post('/comments/:comment_id/vote', authMiddleware, (req, res) => {
  const { vote } = req.body;
  if (![1, -1].includes(Number(vote))) return res.status(400).json({ error: 'Vote must be 1 or -1' });

  const comment = db.prepare('SELECT * FROM discussion_comments WHERE comment_id=?').get(req.params.comment_id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const existing = db.prepare("SELECT * FROM discussion_votes WHERE target_type='comment' AND target_id=? AND user_id=?").get(req.params.comment_id, req.user.user_id);

  if (existing) {
    if (existing.vote === Number(vote)) {
      db.prepare("DELETE FROM discussion_votes WHERE target_type='comment' AND target_id=? AND user_id=?").run(req.params.comment_id, req.user.user_id);
      if (existing.vote === 1) db.prepare('UPDATE discussion_comments SET upvote_count=upvote_count-1 WHERE comment_id=?').run(req.params.comment_id);
      else db.prepare('UPDATE discussion_comments SET downvote_count=downvote_count-1 WHERE comment_id=?').run(req.params.comment_id);
      return res.json({ vote: null });
    } else {
      db.prepare("UPDATE discussion_votes SET vote=? WHERE target_type='comment' AND target_id=? AND user_id=?").run(Number(vote), req.params.comment_id, req.user.user_id);
      if (Number(vote) === 1) {
        db.prepare('UPDATE discussion_comments SET upvote_count=upvote_count+1, downvote_count=downvote_count-1 WHERE comment_id=?').run(req.params.comment_id);
      } else {
        db.prepare('UPDATE discussion_comments SET upvote_count=upvote_count-1, downvote_count=downvote_count+1 WHERE comment_id=?').run(req.params.comment_id);
      }
    }
  } else {
    db.prepare("INSERT INTO discussion_votes (target_type, target_id, user_id, vote) VALUES ('comment',?,?,?)").run(req.params.comment_id, req.user.user_id, Number(vote));
    if (Number(vote) === 1) db.prepare('UPDATE discussion_comments SET upvote_count=upvote_count+1 WHERE comment_id=?').run(req.params.comment_id);
    else db.prepare('UPDATE discussion_comments SET downvote_count=downvote_count+1 WHERE comment_id=?').run(req.params.comment_id);
  }

  res.json({ vote: Number(vote) });
});

module.exports = router;
