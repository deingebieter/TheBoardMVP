const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// GET /competitions - list active competitions
router.get('/', optionalAuth, (req, res) => {
  const { status = 'active' } = req.query;
  const competitions = db.prepare('SELECT * FROM competitions WHERE status=? ORDER BY created_at DESC').all(status);

  const enriched = competitions.map(comp => {
    const entryCount = db.prepare('SELECT COUNT(*) as c FROM competition_entries WHERE competition_id=?').get(comp.competition_id).c;
    let userEntry = null;
    if (req.user) {
      userEntry = db.prepare('SELECT * FROM competition_entries WHERE competition_id=? AND user_id=?').get(comp.competition_id, req.user.user_id);
    }
    return { ...comp, entry_count: entryCount, user_entry: userEntry };
  });

  res.json(enriched);
});

// POST /competitions - create competition (admin-only in full app, open for MVP)
router.post('/', authMiddleware, (req, res) => {
  const { title, type, tier, engagement_factor, ends_at, reward_1st_bronze, reward_1st_silver, reward_2nd_bronze, reward_2nd_silver, reward_3rd_bronze, reward_3rd_silver } = req.body;
  if (!title || !type || !tier) return res.status(400).json({ error: 'title, type, tier required' });

  const competition_id = uuidv4();
  db.prepare(`INSERT INTO competitions (competition_id, title, type, tier, engagement_factor, ends_at,
    reward_1st_bronze, reward_1st_silver, reward_2nd_bronze, reward_2nd_silver, reward_3rd_bronze, reward_3rd_silver)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    competition_id, title, type, tier, engagement_factor || 1.5, ends_at || null,
    reward_1st_bronze || 100, reward_1st_silver || 0,
    reward_2nd_bronze || 50, reward_2nd_silver || 0,
    reward_3rd_bronze || 25, reward_3rd_silver || 0
  );

  res.status(201).json(db.prepare('SELECT * FROM competitions WHERE competition_id=?').get(competition_id));
});

// GET /competitions/:competition_id
router.get('/:competition_id', optionalAuth, (req, res) => {
  const comp = db.prepare('SELECT * FROM competitions WHERE competition_id=?').get(req.params.competition_id);
  if (!comp) return res.status(404).json({ error: 'Competition not found' });

  const leaderboard = getLeaderboard(comp);
  res.json({ ...comp, leaderboard });
});

// POST /competitions/:competition_id/enter
router.post('/:competition_id/enter', authMiddleware, (req, res) => {
  const { post_id, is_highlighted } = req.body;
  if (!post_id) return res.status(400).json({ error: 'post_id required' });

  const comp = db.prepare("SELECT * FROM competitions WHERE competition_id=? AND status='active'").get(req.params.competition_id);
  if (!comp) return res.status(404).json({ error: 'Competition not found or not active' });

  // High-end competition requires a boost
  if (comp.tier === 'high_end' && is_highlighted) {
    const boost = db.prepare("SELECT * FROM boosts WHERE user_id=? AND post_id=? AND is_active=1").get(req.user.user_id, post_id);
    if (!boost) return res.status(403).json({ error: 'High-end competition requires an active boost on the post' });
  }

  // Check if post belongs to user
  const post = db.prepare('SELECT * FROM fyp_posts WHERE post_id=? AND user_id=?').get(post_id, req.user.user_id);
  if (!post) return res.status(403).json({ error: 'Post not found or not yours' });

  try {
    db.prepare(`INSERT OR IGNORE INTO competition_entries (competition_id, user_id, post_id, is_highlighted) VALUES (?,?,?,?)`)
      .run(req.params.competition_id, req.user.user_id, post_id, is_highlighted ? 1 : 0);
    const entry = db.prepare('SELECT * FROM competition_entries WHERE competition_id=? AND user_id=? AND post_id=?').get(req.params.competition_id, req.user.user_id, post_id);
    res.status(201).json(entry);
  } catch (e) {
    res.status(400).json({ error: 'Already entered' });
  }
});

// POST /competitions/:competition_id/finalize - compute results
router.post('/:competition_id/finalize', authMiddleware, (req, res) => {
  const comp = db.prepare("SELECT * FROM competitions WHERE competition_id=?").get(req.params.competition_id);
  if (!comp) return res.status(404).json({ error: 'Not found' });

  const results = finalizeCompetition(comp.competition_id);
  res.json(results);
});

// GET /competitions/:competition_id/leaderboard
router.get('/:competition_id/leaderboard', (req, res) => {
  const comp = db.prepare('SELECT * FROM competitions WHERE competition_id=?').get(req.params.competition_id);
  if (!comp) return res.status(404).json({ error: 'Not found' });
  res.json(getLeaderboard(comp));
});

function calculateScore(comp, post_id) {
  const likes = db.prepare("SELECT COUNT(*) as c FROM fyp_interactions WHERE post_id=? AND type='like'").get(post_id)?.c || 0;
  const superLikes = db.prepare("SELECT COUNT(*) as c FROM fyp_interactions WHERE post_id=? AND type='super_like'").get(post_id)?.c || 0;
  const comments = db.prepare("SELECT COUNT(*) as c FROM fyp_comments WHERE post_id=?").get(post_id)?.c || 0;

  if (comp.type === 'like') return likes + superLikes * 2;
  if (comp.type === 'comment') return comments;
  if (comp.type === 'engagement') return likes + superLikes * 2 + Math.floor(comments * (comp.engagement_factor || 1.5));
  return 0;
}

function getLeaderboard(comp) {
  const entries = db.prepare('SELECT * FROM competition_entries WHERE competition_id=?').all(comp.competition_id);
  const scored = entries.map(e => ({
    ...e,
    score: calculateScore(comp, e.post_id),
    username: db.prepare('SELECT username, display_name FROM users WHERE user_id=?').get(e.user_id)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
}

function finalizeCompetition(competition_id) {
  const comp = db.prepare('SELECT * FROM competitions WHERE competition_id=?').get(competition_id);
  const leaderboard = getLeaderboard(comp);

  const rewardMap = [
    { rank: 1, bronze: comp.reward_1st_bronze, silver: comp.reward_1st_silver },
    { rank: 2, bronze: comp.reward_2nd_bronze, silver: comp.reward_2nd_silver },
    { rank: 3, bronze: comp.reward_3rd_bronze, silver: comp.reward_3rd_silver },
  ];

  for (const entry of leaderboard.slice(0, 3)) {
    const reward = rewardMap.find(r => r.rank === entry.rank);
    if (!reward) continue;

    db.prepare('INSERT OR REPLACE INTO competition_results (competition_id, user_id, rank, score, bronze_earned, silver_earned) VALUES (?,?,?,?,?,?)')
      .run(competition_id, entry.user_id, entry.rank, entry.score, reward.bronze, reward.silver);

    if (reward.bronze > 0) {
      db.prepare('UPDATE coin_balances SET bronze=bronze+? WHERE user_id=?').run(reward.bronze, entry.user_id);
      db.prepare('INSERT INTO coin_transactions (user_id, coin_type, amount, reason, reference_id) VALUES (?,?,?,?,?)')
        .run(entry.user_id, 'bronze', reward.bronze, `Competition rank #${entry.rank}`, competition_id);
      db.prepare("INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES (?,?,?,?,?)")
        .run(entry.user_id, 'competition_win', `Competition Rank #${entry.rank}!`, `You earned ${reward.bronze} Bronze Coins!`, competition_id);
    }
    if (reward.silver > 0) {
      db.prepare('UPDATE coin_balances SET silver=silver+? WHERE user_id=?').run(reward.silver, entry.user_id);
      db.prepare('INSERT INTO coin_transactions (user_id, coin_type, amount, reason, reference_id) VALUES (?,?,?,?,?)')
        .run(entry.user_id, 'silver', reward.silver, `Competition rank #${entry.rank}`, competition_id);
    }

    db.prepare('UPDATE competition_entries SET rank=?, score=? WHERE competition_id=? AND user_id=?').run(entry.rank, entry.score, competition_id, entry.user_id);
  }

  db.prepare("UPDATE competitions SET status='ended' WHERE competition_id=?").run(competition_id);
  return { leaderboard: leaderboard.slice(0, 3) };
}

module.exports = router;
module.exports.finalizeCompetition = finalizeCompetition;
