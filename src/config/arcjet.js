import arcjet, { shield, detectBot } from '@arcjet/node';

// Rate limiting is intentionally NOT configured here: security.middleware.js
// attaches a role-aware slidingWindow rule per request instead. Arcjet denies
// a request if ANY attached rule denies it, so a blanket rule here would
// silently cap every role at whatever this rule's limit is, defeating the
// per-role limits (e.g. admins getting a higher allowance than guests).
const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({
      mode: 'LIVE',
      allow: [
        'CATEGORY:SEARCH_ENGINE', // Google, Bing, etc
        'CATEGORY:PREVIEW', // Link previews such as Slack, Discord
      ],
    }),
  ],
});

export default aj;
