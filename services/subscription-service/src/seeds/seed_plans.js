'use strict';

/**
 * Seeds sample subscription plans for development.
 * In production, providers create plans via the API when they publish an API.
 * These plans reference a placeholder API UUID – replace it once a real API exists.
 */
const { pool } = require('../config/db');

// Placeholder UUID – will be replaced by a real catalog API id in a running system
const PLACEHOLDER_API_ID = '00000000-0000-0000-0000-000000000001';

const PLANS = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Get started with limited access — no credit card required.',
    price_monthly: 0,
    request_limit_daily: 100,
    request_limit_monthly: 1000,
    rate_limit_per_second: 1,
    rate_limit_per_minute: 30,
    features: ['100 requests/day', '1,000 requests/month', 'Community support'],
    sort_order: 0,
  },
  {
    name: 'Basic',
    slug: 'basic',
    description: 'For hobby projects and small-scale integrations.',
    price_monthly: 9.99,
    price_yearly: 99.99,
    request_limit_daily: 5000,
    request_limit_monthly: 50000,
    rate_limit_per_second: 10,
    rate_limit_per_minute: 300,
    features: ['5,000 requests/day', '50,000 requests/month', 'Email support', 'Standard SLA'],
    sort_order: 1,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For production workloads requiring higher throughput.',
    price_monthly: 49.99,
    price_yearly: 499.99,
    request_limit_daily: 50000,
    request_limit_monthly: 500000,
    rate_limit_per_second: 50,
    rate_limit_per_minute: 1000,
    is_featured: true,
    features: ['50,000 requests/day', '500,000 requests/month', 'Priority support', 'Premium SLA', 'Webhook notifications'],
    sort_order: 2,
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const plan of PLANS) {
      await client.query(
        `INSERT INTO subscriptions.plans
           (api_id, name, slug, description, price_monthly, price_yearly,
            request_limit_daily, request_limit_monthly, rate_limit_per_second,
            rate_limit_per_minute, is_featured, features, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (api_id, slug) DO UPDATE
           SET description = EXCLUDED.description,
               price_monthly = EXCLUDED.price_monthly,
               features = EXCLUDED.features`,
        [
          PLACEHOLDER_API_ID, plan.name, plan.slug, plan.description,
          plan.price_monthly, plan.price_yearly || null,
          plan.request_limit_daily || null, plan.request_limit_monthly || null,
          plan.rate_limit_per_second || null, plan.rate_limit_per_minute || null,
          plan.is_featured || false, JSON.stringify(plan.features), plan.sort_order,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`  ✔ ${PLANS.length} sample plans seeded`);
    console.log('Subscription service seed complete.');
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
