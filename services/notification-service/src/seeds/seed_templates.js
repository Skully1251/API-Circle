'use strict';

const { pool } = require('../config/db');

const TEMPLATES = [
  {
    name: 'welcome_email',
    channel: 'both',
    subject_template: 'Welcome to API Circle, {{name}}!',
    body_template: 'Hi {{name}},\n\nWelcome to API Circle! Your account has been created successfully.\n\nGet started by exploring our API marketplace or publishing your own APIs.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'email_verification',
    channel: 'email',
    subject_template: 'Verify your email address',
    body_template: 'Hi {{name}},\n\nPlease verify your email address by clicking the link below:\n\n{{verification_link}}\n\nThis link expires in 24 hours.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'password_reset',
    channel: 'email',
    subject_template: 'Reset your password',
    body_template: 'Hi {{name}},\n\nWe received a request to reset your password. Click the link below:\n\n{{reset_link}}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'subscription_created',
    channel: 'both',
    subject_template: 'Subscription confirmed: {{api_name}} – {{plan_name}}',
    body_template: 'Hi {{name}},\n\nYour subscription to {{api_name}} on the {{plan_name}} plan is now active.\n\nPlan details:\n- {{plan_name}}\n- Billing: {{billing_cycle}}\n\nYou can manage your subscription from your dashboard.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'subscription_cancelled',
    channel: 'both',
    subject_template: 'Subscription cancelled: {{api_name}}',
    body_template: 'Hi {{name}},\n\nYour subscription to {{api_name}} has been cancelled. Your access will remain active until the end of your current billing period on {{period_end}}.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'api_key_created',
    channel: 'in_app',
    subject_template: null,
    body_template: 'A new API key has been created for {{api_name}}. Key prefix: {{key_prefix}}. Keep your key secure — it will not be shown again.',
  },
  {
    name: 'api_key_revoked',
    channel: 'both',
    subject_template: 'API key revoked: {{key_prefix}}',
    body_template: 'Hi {{name}},\n\nYour API key ({{key_prefix}}…) for {{api_name}} has been revoked.\n\nReason: {{reason}}\n\nIf this was not you, please secure your account immediately.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'usage_warning',
    channel: 'both',
    subject_template: 'Usage alert: {{api_name}} – {{percent}}% of quota used',
    body_template: 'Hi {{name}},\n\nYou have used {{percent}}% of your {{quota_type}} quota for {{api_name}} on the {{plan_name}} plan.\n\nUsed: {{used}} / {{limit}}\n\nConsider upgrading your plan to avoid disruption.\n\nBest,\nThe API Circle Team',
  },
  {
    name: 'api_deprecated',
    channel: 'both',
    subject_template: 'API deprecation notice: {{api_name}} {{version}}',
    body_template: 'Hi {{name}},\n\nThe API {{api_name}} version {{version}} has been deprecated by its provider.\n\nPlease migrate to the latest version before {{sunset_date}} to avoid service disruption.\n\nBest,\nThe API Circle Team',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const t of TEMPLATES) {
      await client.query(
        `INSERT INTO notifications.notification_templates
           (name, channel, subject_template, body_template)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE
           SET channel = EXCLUDED.channel,
               subject_template = EXCLUDED.subject_template,
               body_template = EXCLUDED.body_template,
               updated_at = NOW()`,
        [t.name, t.channel, t.subject_template, t.body_template]
      );
    }

    await client.query('COMMIT');
    console.log(`  ✔ ${TEMPLATES.length} notification templates seeded`);
    console.log('Notification service seed complete.');
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
