-- TheBoard MVP Database Schema
-- SQLite

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ==========================================
-- USERS
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,        -- random 7-9 digit numeric ID
  username TEXT UNIQUE NOT NULL,
  user_hashtag TEXT UNIQUE NOT NULL,   -- @handle unique
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  profile_image TEXT,
  links TEXT,                          -- JSON array of links
  region TEXT DEFAULT 'global',        -- global, EU, USA, DE, etc.
  city TEXT,
  bg_music_enabled INTEGER DEFAULT 0,  -- arcade background music preference
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Coin balances
CREATE TABLE IF NOT EXISTS coin_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  bronze INTEGER DEFAULT 0,
  silver INTEGER DEFAULT 0,
  gold INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- FOLLOWS
-- ==========================================
CREATE TABLE IF NOT EXISTS user_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(follower_id, following_id)
);

-- ==========================================
-- HASHTAGS
-- ==========================================
CREATE TABLE IF NOT EXISTS hashtags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  post_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hashtag_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, hashtag_id)
);

-- ==========================================
-- POSTS (FYP - Video Posts)
-- ==========================================
CREATE TABLE IF NOT EXISTS fyp_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,             -- video/gif file path
  media_type TEXT DEFAULT 'video',     -- video, gif
  duration INTEGER,                    -- seconds, max 30
  thumbnail_url TEXT,
  caption TEXT,
  region TEXT DEFAULT 'global',
  country TEXT,
  city TEXT,
  is_boosted INTEGER DEFAULT 0,
  boost_expires_at TEXT,
  is_ad INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT (datetime('now', '+30 days'))
);

CREATE TABLE IF NOT EXISTS fyp_post_hashtags (
  post_id TEXT NOT NULL REFERENCES fyp_posts(post_id) ON DELETE CASCADE,
  hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY(post_id, hashtag_id)
);

-- FYP Interactions
CREATE TABLE IF NOT EXISTS fyp_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL REFERENCES fyp_posts(post_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('like','super_like','dislike','super_dislike','irrelevant','comment','download')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id, type)
);

-- FYP Comments
CREATE TABLE IF NOT EXISTS fyp_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT UNIQUE NOT NULL,
  post_id TEXT NOT NULL REFERENCES fyp_posts(post_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  parent_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- MAINFEED POSTS (Text/Image)
-- ==========================================
CREATE TABLE IF NOT EXISTS mainfeed_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,                     -- image, gif, null
  region TEXT DEFAULT 'global',
  country TEXT,
  city TEXT,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT (datetime('now', '+30 days'))
);

CREATE TABLE IF NOT EXISTS mainfeed_post_hashtags (
  post_id TEXT NOT NULL REFERENCES mainfeed_posts(post_id) ON DELETE CASCADE,
  hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY(post_id, hashtag_id)
);

-- Mainfeed Interactions
CREATE TABLE IF NOT EXISTS mainfeed_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL REFERENCES mainfeed_posts(post_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('like','dislike')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id)
);

-- ==========================================
-- DISCUSSIONS (Reddit-style threads)
-- ==========================================
CREATE TABLE IF NOT EXISTS discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discussion_id TEXT UNIQUE NOT NULL,
  mainfeed_post_id TEXT REFERENCES mainfeed_posts(post_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discussion_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT UNIQUE NOT NULL,
  discussion_id TEXT NOT NULL REFERENCES discussions(discussion_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  parent_id TEXT,                      -- for nested replies
  content TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discussion_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK(target_type IN ('discussion','comment')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK(vote IN (1,-1)),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(target_type, target_id, user_id)
);

-- ==========================================
-- COMPETITION SYSTEM
-- ==========================================
CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('like','comment','engagement')),
  tier TEXT NOT NULL CHECK(tier IN ('normal','high_end')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','ended','cancelled')),
  engagement_factor REAL DEFAULT 1.5,  -- for engagement type
  reward_1st_bronze INTEGER DEFAULT 0,
  reward_1st_silver INTEGER DEFAULT 0,
  reward_2nd_bronze INTEGER DEFAULT 0,
  reward_2nd_silver INTEGER DEFAULT 0,
  reward_3rd_bronze INTEGER DEFAULT 0,
  reward_3rd_silver INTEGER DEFAULT 0,
  starts_at TEXT DEFAULT (datetime('now')),
  ends_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competition_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id TEXT NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,               -- fyp_post_id
  is_highlighted INTEGER DEFAULT 0,   -- for high-end
  score INTEGER DEFAULT 0,
  rank INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(competition_id, user_id, post_id)
);

CREATE TABLE IF NOT EXISTS competition_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id TEXT NOT NULL REFERENCES competitions(competition_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  bronze_earned INTEGER DEFAULT 0,
  silver_earned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- COIN TRANSACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  coin_type TEXT NOT NULL CHECK(coin_type IN ('bronze','silver','gold')),
  amount INTEGER NOT NULL,             -- positive = earn, negative = spend
  reason TEXT NOT NULL,
  reference_id TEXT,                   -- competition_id, post_id, etc.
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- BOOST & ADS
-- ==========================================
CREATE TABLE IF NOT EXISTS boosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boost_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK(post_type IN ('fyp','mainfeed')),
  bronze_spent INTEGER NOT NULL,
  starts_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS advertisements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  target_url TEXT,
  feed_type TEXT NOT NULL CHECK(feed_type IN ('fyp','mainfeed','both')),
  coin_type TEXT NOT NULL CHECK(coin_type IN ('silver','gold')),
  coins_spent INTEGER NOT NULL,
  impression_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  starts_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_id TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_fyp_posts_user ON fyp_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_fyp_posts_expires ON fyp_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_fyp_posts_region ON fyp_posts(region);
CREATE INDEX IF NOT EXISTS idx_mainfeed_user ON mainfeed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_mainfeed_expires ON mainfeed_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_disc ON discussion_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id);
