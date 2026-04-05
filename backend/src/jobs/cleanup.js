const cron = require('node-cron');
const db = require('../database/db');
const { finalizeCompetition } = require('../routes/competitions');

// Run every hour: delete expired content
function startCleanupJob() {
  cron.schedule('0 * * * *', () => {
    console.log('[Cleanup] Running content expiry job...');
    const now = new Date().toISOString();

    const deletedFyp = db.prepare("DELETE FROM fyp_posts WHERE expires_at < ?").run(now);
    const deletedMainfeed = db.prepare("DELETE FROM mainfeed_posts WHERE expires_at < ?").run(now);

    console.log(`[Cleanup] Deleted ${deletedFyp.changes} FYP posts, ${deletedMainfeed.changes} mainfeed posts`);

    // Deactivate expired boosts
    const expiredBoosts = db.prepare("SELECT * FROM boosts WHERE is_active=1 AND expires_at < ?").all(now);
    for (const boost of expiredBoosts) {
      db.prepare('UPDATE boosts SET is_active=0 WHERE boost_id=?').run(boost.boost_id);
      const table = boost.post_type === 'fyp' ? 'fyp_posts' : 'mainfeed_posts';
      db.prepare(`UPDATE ${table} SET is_boosted=0 WHERE post_id=?`).run(boost.post_id);
    }

    // Deactivate expired ads
    db.prepare("UPDATE advertisements SET is_active=0 WHERE is_active=1 AND expires_at < ?").run(now);

    // Finalize ended competitions
    const endedComps = db.prepare("SELECT * FROM competitions WHERE status='active' AND ends_at IS NOT NULL AND ends_at < ?").all(now);
    for (const comp of endedComps) {
      try {
        finalizeCompetition(comp.competition_id);
        console.log(`[Cleanup] Finalized competition ${comp.competition_id}`);
      } catch (e) {
        console.error(`[Cleanup] Failed to finalize competition ${comp.competition_id}:`, e.message);
      }
    }
  });

  console.log('[Cleanup] Content expiry job scheduled (every hour)');
}

module.exports = { startCleanupJob };
