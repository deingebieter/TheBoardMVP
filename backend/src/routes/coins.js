const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /coins/balance
router.get('/balance', authMiddleware, (req, res) => {
  const balance = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.user.user_id);
  res.json(balance || { bronze: 0, silver: 0, gold: 0 });
});

// GET /coins/transactions
router.get('/transactions', authMiddleware, (req, res) => {
  const txs = db.prepare('SELECT * FROM coin_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.user_id);
  res.json(txs);
});

// POST /coins/boost - boost a post with bronze coins
router.post('/boost', authMiddleware, (req, res) => {
  const { post_id, post_type = 'fyp', days = 1 } = req.body;
  if (!post_id) return res.status(400).json({ error: 'post_id required' });

  const BRONZE_PER_DAY = 10;
  const bronze_cost = BRONZE_PER_DAY * days;

  const balance = db.prepare('SELECT bronze FROM coin_balances WHERE user_id=?').get(req.user.user_id);
  if (!balance || balance.bronze < bronze_cost) {
    return res.status(402).json({ error: `Insufficient bronze coins. Need ${bronze_cost}, have ${balance?.bronze || 0}` });
  }

  // Check post ownership
  const table = post_type === 'fyp' ? 'fyp_posts' : 'mainfeed_posts';
  const post = db.prepare(`SELECT * FROM ${table} WHERE post_id=? AND user_id=?`).get(post_id, req.user.user_id);
  if (!post) return res.status(403).json({ error: 'Post not found or not yours' });

  const boost_id = uuidv4();
  const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO boosts (boost_id, user_id, post_id, post_type, bronze_spent, expires_at) VALUES (?,?,?,?,?,?)`)
    .run(boost_id, req.user.user_id, post_id, post_type, bronze_cost, expires_at);

  // Update post boost status
  db.prepare(`UPDATE ${table} SET is_boosted=1, boost_expires_at=? WHERE post_id=?`).run(expires_at, post_id);

  // Deduct coins
  db.prepare('UPDATE coin_balances SET bronze=bronze-? WHERE user_id=?').run(bronze_cost, req.user.user_id);
  db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason, reference_id) VALUES (?,?,?,?,?)").run(req.user.user_id, 'bronze', -bronze_cost, 'Post boost', boost_id);

  res.status(201).json({ boost_id, bronze_spent: bronze_cost, expires_at });
});

// POST /coins/advertise - create advertisement
router.post('/advertise', authMiddleware, upload.single('media'), (req, res) => {
  const { title, content, target_url, feed_type = 'both', coin_type, coins_amount, days = 7 } = req.body;
  if (!title || !content || !coin_type || !coins_amount) {
    return res.status(400).json({ error: 'title, content, coin_type, coins_amount required' });
  }

  if (!['silver', 'gold'].includes(coin_type)) {
    return res.status(400).json({ error: 'coin_type must be silver or gold' });
  }

  const amount = parseInt(coins_amount);
  const balance = db.prepare(`SELECT ${coin_type} as bal FROM coin_balances WHERE user_id=?`).get(req.user.user_id);
  if (!balance || balance.bal < amount) {
    return res.status(402).json({ error: `Insufficient ${coin_type} coins` });
  }

  const media_url = req.file ? `/uploads/ads/${req.file.filename}` : null;
  const ad_id = uuidv4();
  const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO advertisements (ad_id, user_id, title, content, media_url, target_url, feed_type, coin_type, coins_spent, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ad_id, req.user.user_id, title, content, media_url, target_url, feed_type, coin_type, amount, expires_at);

  db.prepare(`UPDATE coin_balances SET ${coin_type}=${coin_type}-? WHERE user_id=?`).run(amount, req.user.user_id);
  db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason, reference_id) VALUES (?,?,?,?,?)").run(req.user.user_id, coin_type, -amount, 'Advertisement', ad_id);

  res.status(201).json({ ad_id, coin_type, coins_spent: amount, expires_at });
});

// POST /coins/purchase - simulate gold coin purchase
router.post('/purchase', authMiddleware, (req, res) => {
  const { gold_amount, payment_token } = req.body; // payment_token would go to Stripe in production
  if (!gold_amount || gold_amount < 1) return res.status(400).json({ error: 'gold_amount must be >= 1' });

  // Simulate successful payment (production: verify with payment processor)
  db.prepare('UPDATE coin_balances SET gold=gold+? WHERE user_id=?').run(parseInt(gold_amount), req.user.user_id);
  db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason) VALUES (?,?,?,?)").run(req.user.user_id, 'gold', parseInt(gold_amount), 'Purchase');

  const balance = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.user.user_id);
  res.json({ ok: true, balance });
});

// POST /coins/convert - convert coins
router.post('/convert', authMiddleware, (req, res) => {
  const { from, amount } = req.body;
  // bronze -> silver: 2 bronze = 1 silver
  // silver -> gold: 2 silver = 1 gold
  if (!from || !amount || amount < 1) return res.status(400).json({ error: 'from and amount required' });

  const balance = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.user.user_id);

  if (from === 'bronze_to_silver') {
    const needed = amount * 2;
    if (balance.bronze < needed) return res.status(402).json({ error: 'Insufficient bronze coins' });
    db.prepare('UPDATE coin_balances SET bronze=bronze-?, silver=silver+? WHERE user_id=?').run(needed, amount, req.user.user_id);
    db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason) VALUES (?,?,?,?)").run(req.user.user_id, 'bronze', -needed, 'Convert to silver');
    db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason) VALUES (?,?,?,?)").run(req.user.user_id, 'silver', amount, 'Converted from bronze');
  } else if (from === 'silver_to_gold') {
    const needed = amount * 2;
    if (balance.silver < needed) return res.status(402).json({ error: 'Insufficient silver coins' });
    db.prepare('UPDATE coin_balances SET silver=silver-?, gold=gold+? WHERE user_id=?').run(needed, amount, req.user.user_id);
    db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason) VALUES (?,?,?,?)").run(req.user.user_id, 'silver', -needed, 'Convert to gold');
    db.prepare("INSERT INTO coin_transactions (user_id, coin_type, amount, reason) VALUES (?,?,?,?)").run(req.user.user_id, 'gold', amount, 'Converted from silver');
  } else {
    return res.status(400).json({ error: 'Invalid conversion type' });
  }

  const updated = db.prepare('SELECT bronze, silver, gold FROM coin_balances WHERE user_id=?').get(req.user.user_id);
  res.json({ ok: true, balance: updated });
});

module.exports = router;
