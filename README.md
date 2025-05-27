# Ghost CMS + Cloudflare Cache Automation

Automatically purge CloudFlare cache when content changes in Ghost CMS using webhooks and CloudFlare Workers.

## How It Works

```
Ghost CMS → Webhook → CloudFlare Worker → CloudFlare API → Cache Purge
```

When you publish, update, or delete content in Ghost CMS, it sends a webhook to the CloudFlare Worker, which then intelligently purges the relevant cached content.

## Features

- ✅ **Smart Cache Purging** - Only purges relevant URLs instead of everything
- ✅ **Multiple Event Support** - Handles posts, pages, and site changes
- ✅ **Slack Notifications** - Get notified of successful purges and failures
- ✅ **No Authentication Required** - Simplified setup without webhook secrets
- ✅ **Error Handling** - Robust error handling and logging

## Quick Setup

### 1. Deploy CloudFlare Worker

1. **Go to CloudFlare Dashboard** → **Workers & Pages**
2. **Click "Create Application"** → **"Create Worker"**
3. **Name your worker:** `ghost-cache-purge`
4. **Click "Deploy"**
5. **Click "Edit Code"** and replace the default code with the entire contents from `index.js`
6. **Click "Save and Deploy"**

### 2. Configure Environment Variables

1. **Go to Settings tab** in your worker
2. **Scroll to "Environment Variables"** section
3. **Add these variables:**

| Variable | Value | Required |
|----------|-------|----------|
| `CLOUDFLARE_ZONE_ID` | Your CloudFlare zone ID | Yes |
| `CLOUDFLARE_API_TOKEN` | Your CloudFlare API token | Yes |
| `SLACK_WEBHOOK_URL` | Your Slack webhook URL | Optional |

### 3. Configure Ghost Webhook

1. **Go to Ghost Admin** → **Settings** → **Integrations**
2. **Click "Add custom integration"**
3. **Name it:** `CloudFlare Cache Purge`
4. **Click "Create"**
5. **Add webhook** with these settings:
   - **Name:** `Cache Purge Webhook`
   - **Target URL:** Your CloudFlare Worker URL (e.g., `https://ghost-cache-purge.your-subdomain.workers.dev`)
   - **Secret:** Leave empty
   - **Events:** Select all these events:
     - `Post published`
     - `Post updated`
     - `Post unpublished`
     - `Page published`
     - `Page updated`
     - `Page unpublished`

## Getting CloudFlare Credentials

### Zone ID
1. Go to **CloudFlare Dashboard**
2. Select your domain
3. Copy **Zone ID** from the right sidebar

### API Token
1. Go to **CloudFlare Dashboard** → **My Profile** → **API Tokens**
2. Click **"Create Token"**
3. Use **"Cache Purge"** template or create custom with:
   - **Zone:Zone:Read**
   - **Zone:Cache Purge:Edit**
4. **Include your specific zone**
5. Click **"Continue to summary"** → **"Create Token"**
6. **Copy and save the token immediately**

## Cache Purge Strategy

The worker uses intelligent cache purging based on the type of content:

### Post Events
- **Purges:** Post URL, home page, RSS feed, tag pages, author page
- **Example:** Publishing a post purges `/new-post/`, `/`, `/rss/`, `/tag/tech/`, `/author/john/`

### Page Events  
- **Purges:** Page URL, home page, sitemap
- **Example:** Publishing a page purges `/about/`, `/`, `/sitemap.xml`

### Site Events
- **Purges:** Everything (full cache purge)
- **Triggers:** Settings changes, theme updates

### Unknown Events
- **Purges:** Common URLs (home, RSS, sitemap, robots.txt)
- **Conservative approach** for unrecognized webhook events

## Slack Notifications

Get simple notifications in Slack:

### Success
```
✅ Cache purged successfully
```

### Failure
```
❌ Cache purge failed - CloudFlare API error: Invalid token
```

### Setup Slack (Optional)
1. Create a Slack webhook URL in your Slack workspace
2. Add it as `SLACK_WEBHOOK_URL` environment variable in your worker

## Testing

### Test the Integration
1. **Publish a test post** in Ghost
2. **Check CloudFlare Worker logs:**
   - Go to Workers & Pages → your-worker → **Logs**
   - Watch for real-time activity
3. **You should see:**
   - Webhook received logs
   - Cache purge success
   - Slack notification (if configured)

### Manual Test
```bash
curl -X POST https://your-worker-url.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"event":"post.published","post":{"url":"/test-post/","title":"Test Post"}}'
```

## Troubleshooting

### Common Issues

**❌ Webhook not triggering**
- Check webhook URL in Ghost integration
- Verify worker is deployed and accessible
- Check Ghost webhook logs in Admin

**❌ Authentication errors**
- Verify API token permissions (Zone:Zone:Read, Zone:Cache Purge:Edit)
- Check zone ID is correct
- Ensure token isn't expired

**❌ Worker errors**
- Check CloudFlare Worker logs for details
- Verify environment variables are set correctly
- Test API connectivity manually

### Check CloudFlare API Manually
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### View Logs
- **Worker Logs:** CloudFlare Dashboard → Workers & Pages → Your Worker → Logs
- **Ghost Webhook Logs:** Ghost Admin → Settings → Integrations → Your Integration → View logs

## Advanced Configuration

### Custom Purge Rules
Modify the `determinePurgeStrategy()` function in `index.js` to customize which URLs get purged for different events.

### Multiple Environments
Create separate workers for staging/production:
- `ghost-cache-purge-staging`
- `ghost-cache-purge-production`

## Security Considerations

- **Worker URL Privacy:** Keep your worker URL private - it acts as basic security
- **API Token Permissions:** Use minimal required permissions (Zone:Zone:Read, Zone:Cache Purge:Edit)
- **Monitor Activity:** Check worker logs regularly for unexpected activity
- **Rate Limiting:** CloudFlare Workers have built-in rate limiting

## Support

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Review CloudFlare Worker logs** in Dashboard  
3. **Verify Ghost webhook logs** in Admin
4. **Test API connectivity** manually
5. **Check environment variables** are set correctly

## License

MIT License - Feel free to modify and use for your projects.

---

**That's it!** Your Ghost CMS will now automatically purge CloudFlare cache when content changes. The integration is designed to be simple, reliable, and efficient. 
