# Cron Job System - Framework Agnostic Guide

This cron system is designed to be **framework-agnostic** and can easily migrate between Nuxt, Next.js, Express, NestJS, or any Node.js framework.

## 🏗️ Architecture

The system consists of:

1. **CronManager** - Core scheduling logic (framework-independent)
2. **Plugin/Middleware** - Framework-specific initialization
3. **Admin API** - Management and monitoring endpoints
4. **Environment Config** - Flexible configuration

## 🚀 Quick Start

### 1. Enable Cron Jobs

```bash
# In your .env file
ENABLE_CRON=true
CHECK_DUE_CARDS_ENABLED=true
CHECK_DUE_CARDS_SCHEDULE="0 * * * *"  # Every hour
CRON_SECRET_TOKEN="your-secret-token"
```

### 2. Start Your Application

```bash
npm run dev    # Development
npm run build && npm start  # Production
```

### 3. Monitor Cron Jobs

```bash
# Check status
curl -H "Authorization: Bearer your-secret-token" \
     http://localhost:3000/api/admin/cron

# Manually trigger a job
curl -X POST -H "Authorization: Bearer your-secret-token" \
     "http://localhost:3000/api/admin/cron?job=check-due-cards"
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_CRON` | `false` | Enable/disable all cron jobs |
| `CHECK_DUE_CARDS_ENABLED` | `true` | Enable card due notifications |
| `CHECK_DUE_CARDS_SCHEDULE` | `0 * * * *` | Cron schedule for card checks |
| `DEFAULT_TIMEZONE` | `UTC` | Default timezone for jobs |
| `CRON_SECRET_TOKEN` | - | Security token for admin endpoints |

### Schedule Syntax

Use standard cron syntax ([crontab.guru](https://crontab.guru/) is helpful):

```bash
# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of the month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
# │ │ │ │ │
# * * * * *

"0 * * * *"     # Every hour
"0 */2 * * *"   # Every 2 hours
"0 9 * * *"     # Every day at 9 AM
"0 9 * * 1"     # Every Monday at 9 AM
"*/15 * * * *"  # Every 15 minutes
```

## 📦 Framework Migration Guide

### From Nuxt to Express.js

1. **Move the CronManager** (no changes needed):
   ```bash
   cp server/services/CronManager.ts src/services/CronManager.ts
   ```

2. **Replace the plugin with Express middleware**:
   ```javascript
   // src/middleware/cron.js
   import { cronManager } from '../services/CronManager.js'

   export function initializeCron() {
     if (process.env.ENABLE_CRON === 'true') {
       cronManager.initialize()
     }
   }

   // In your main app.js
   import { initializeCron } from './middleware/cron.js'
   initializeCron()
   ```

3. **Create Express admin route**:
   ```javascript
   // routes/admin.js
   import { cronManager } from '../services/CronManager.js'

   router.get('/cron', async (req, res) => {
     // Same logic as server/api/admin/cron.ts
   })
   ```

### From Nuxt to NestJS

1. **Move CronManager to NestJS service**:
   ```typescript
   // src/cron/cron.service.ts
   import { Injectable } from '@nestjs/common'
   import { CronManager } from './CronManager'  // Move the file

   @Injectable()
   export class CronService {
     constructor(private cronManager: CronManager) {}

     async initialize() {
       return this.cronManager.initialize()
     }
   }
   ```

2. **Create NestJS module**:
   ```typescript
   // src/cron/cron.module.ts
   import { Module } from '@nestjs/common'
   import { CronService } from './cron.service'

   @Module({
     providers: [CronService],
     exports: [CronService]
   })
   export class CronModule {}
   ```

### From Nuxt to Next.js

1. **Move CronManager** (no changes needed):
   ```bash
   cp server/services/CronManager.ts lib/CronManager.ts
   ```

2. **Initialize in Next.js API route**:
   ```typescript
   // pages/api/init.ts or app/api/init/route.ts
   import { cronManager } from '../../lib/CronManager'

   // Initialize once when the API starts
   if (!global.cronInitialized) {
     cronManager.initialize()
     global.cronInitialized = true
   }
   ```

## 🔍 Monitoring & Debugging

### View Cron Status

```bash
# Get all jobs status
GET /api/admin/cron
```

Response:
```json
{
  "success": true,
  "data": {
    "initialized": true,
    "totalJobs": 1,
    "jobs": [
      {
        "name": "check-due-cards",
        "running": true,
        "nextDate": "2024-01-15T15:00:00.000Z",
        "lastDate": "2024-01-15T14:00:00.000Z"
      }
    ]
  }
}
```

### Manually Trigger Jobs

```bash
# Trigger a specific job
POST /api/admin/cron?job=check-due-cards
```

### Logs

The system logs all cron activities:

```
🕐 Initializing CronManager...
🚀 Started cron job: check-due-cards (0 * * * *)
🔄 Starting cron job: check-due-cards
✅ Completed cron job: check-due-cards (1234ms)
```

## 🔒 Security

1. **Always set CRON_SECRET_TOKEN** in production
2. **Use HTTPS** for admin endpoints
3. **Restrict admin endpoints** to internal networks
4. **Monitor logs** for suspicious activity

## 🚀 Deployment

### Hosting Provider Comparison

| Provider | Built-in Cron | Self-hosted Cron | Recommendation |
|----------|---------------|------------------|----------------|
| Vercel | ✅ | ✅ | Use built-in cron |
| Netlify | ✅ | ✅ | Use built-in cron |
| Railway | ❌ | ✅ | Use self-hosted |
| Render | ✅ | ✅ | Use built-in cron |
| Heroku | ✅ | ✅ | Use built-in cron |
| VPS/Docker | ❌ | ✅ | Use self-hosted |

### Production Checklist

- [ ] Set `ENABLE_CRON=true`
- [ ] Configure secure `CRON_SECRET_TOKEN`
- [ ] Set appropriate schedules
- [ ] Test manually with admin API
- [ ] Monitor logs for first few runs
- [ ] Set up alerting for failures

## 🔧 Adding New Cron Jobs

1. **Create your task function**:
   ```typescript
   // server/tasks/my-new-task.ts
   export async function myNewTask() {
     console.log('Running my new task...')
     // Your task logic here
     return { success: true }
   }
   ```

2. **Add to CronManager**:
   ```typescript
   // In CronManager.ts jobs array
   {
     name: 'my-new-task',
     schedule: '0 6 * * *', // 6 AM daily
     task: this.createSafeTask('my-new-task', myNewTask),
     enabled: this.isJobEnabled('MY_NEW_TASK_ENABLED', true)
   }
   ```

3. **Add environment variables**:
   ```bash
   MY_NEW_TASK_ENABLED=true
   MY_NEW_TASK_SCHEDULE="0 6 * * *"
   ```

## 🆘 Troubleshooting

### Cron Jobs Not Running

1. Check environment variables:
   ```bash
   echo $ENABLE_CRON
   echo $CHECK_DUE_CARDS_ENABLED
   ```

2. Check logs for initialization:
   ```
   🕐 Initializing CronManager...
   🚀 Started cron job: check-due-cards
   ```

3. Manually trigger to test:
   ```bash
   curl -X POST "http://localhost:3000/api/admin/cron?job=check-due-cards"
   ```

### Jobs Failing

1. Check individual job logs
2. Test task function separately
3. Verify database connections
4. Check environment variables

This system gives you complete control over your scheduled tasks while remaining portable across any Node.js framework! 🎉
