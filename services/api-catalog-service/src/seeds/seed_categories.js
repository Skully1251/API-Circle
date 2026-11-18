'use strict';

const { pool } = require('../config/db');

const CATEGORIES = [
  { name: 'Payments', slug: 'payments', description: 'Payment processing, billing, and financial transaction APIs', icon: 'credit-card' },
  { name: 'Messaging', slug: 'messaging', description: 'SMS, chat, push notification, and messaging APIs', icon: 'message-circle' },
  { name: 'Social', slug: 'social', description: 'Social media integration and social networking APIs', icon: 'users' },
  { name: 'Weather', slug: 'weather', description: 'Weather data, forecasts, and climate APIs', icon: 'cloud' },
  { name: 'Finance', slug: 'finance', description: 'Stock market, banking, cryptocurrency, and financial data APIs', icon: 'trending-up' },
  { name: 'AI & ML', slug: 'ai-ml', description: 'Artificial intelligence, machine learning, and NLP APIs', icon: 'cpu' },
  { name: 'Storage', slug: 'storage', description: 'Cloud storage, file management, and CDN APIs', icon: 'hard-drive' },
  { name: 'Communication', slug: 'communication', description: 'Email, voice, video, and real-time communication APIs', icon: 'phone' },
  { name: 'Maps & Location', slug: 'maps-location', description: 'Mapping, geocoding, and location-based service APIs', icon: 'map-pin' },
  { name: 'Authentication', slug: 'authentication', description: 'Identity verification, OAuth, and authentication APIs', icon: 'shield' },
  { name: 'E-commerce', slug: 'e-commerce', description: 'Product catalog, inventory, and shopping APIs', icon: 'shopping-cart' },
  { name: 'Data', slug: 'data', description: 'Public datasets, data enrichment, and analytics APIs', icon: 'database' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const cat of CATEGORIES) {
      await client.query(
        `INSERT INTO catalog.categories (name, slug, description, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE
           SET description = EXCLUDED.description, icon = EXCLUDED.icon`,
        [cat.name, cat.slug, cat.description, cat.icon, CATEGORIES.indexOf(cat)]
      );
    }

    await client.query('COMMIT');
    console.log(`  ✔ ${CATEGORIES.length} categories seeded`);
    console.log('API Catalog service seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}

module.exports = { seed };
