// Using Web Crypto API (built into CloudFlare Workers)

/**
 * CloudFlare Worker for Ghost CMS Cache Purging
 * Handles webhooks from Ghost CMS and purges CloudFlare cache
 */

export default {
  async fetch(request, env, ctx) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Parse the webhook payload
      const payload = await request.json();
      console.log('Ghost webhook received:', {
        event: payload.event || 'unknown',
        post_url: payload.post?.url || 'N/A',
        page_url: payload.page?.url || 'N/A',
        post_title: payload.post?.title || 'N/A',
        page_title: payload.page?.title || 'N/A'
      });

      // Determine what type of cache purge to perform
      const purgeResult = await handleCachePurge(payload, env);

      // Send Slack notification
      await sendSlackNotification(payload, purgeResult, env);

      return new Response(JSON.stringify({
        success: true,
        message: 'Cache purged successfully',
        purgeResult
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error processing webhook:', error);
      
      // Send Slack notification about the error
      await sendSlackErrorNotification('Worker Error', error.message, env);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};


/**
 * Handle cache purging based on Ghost webhook payload
 */
async function handleCachePurge(payload, env) {
  const { CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN } = env;

  if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('CloudFlare credentials not configured');
  }

  // Determine purge strategy based on webhook event
  const purgeData = determinePurgeStrategy(payload);

  // Make API call to CloudFlare
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(purgeData)
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`CloudFlare API error: ${result.errors?.[0]?.message || 'Unknown error'}`);
  }

  return result;
}

/**
 * Determine what to purge based on Ghost webhook payload
 */
function determinePurgeStrategy(payload) {
  // Ghost webhook structure varies by event type
  const eventType = payload.event || 'unknown';
  
  switch (eventType) {
    case 'post.published':
    case 'post.updated':
    case 'post.unpublished':
      // For post events, purge specific URLs
      return generatePostPurgeUrls(payload.post);
    
    case 'page.published':
    case 'page.updated':
    case 'page.unpublished':
      // For page events, purge specific URLs
      return generatePagePurgeUrls(payload.page);
    
    case 'site.changed':
    case 'settings.updated':
      // For site-wide changes, purge everything
      return { purge_everything: true };
    
    default:
      // For unknown events, do a conservative selective purge
      return generateSelectivePurge(payload);
  }
}

/**
 * Generate URLs to purge for post events
 */
function generatePostPurgeUrls(post) {
  if (!post) {
    return { purge_everything: true };
  }

  const urls = [
    '/', // Home page
    '/rss/', // RSS feed
    '/sitemap.xml' // Sitemap
  ];

  // Add post URL if available
  if (post.url) {
    urls.push(post.url);
  }

  // Add tag pages if post has tags
  if (post.tags && Array.isArray(post.tags)) {
    post.tags.forEach(tag => {
      if (tag.slug) {
        urls.push(`/tag/${tag.slug}/`);
      }
    });
  }

  // Add author page if available
  if (post.primary_author && post.primary_author.slug) {
    urls.push(`/author/${post.primary_author.slug}/`);
  }

  return { files: urls };
}

/**
 * Generate URLs to purge for page events
 */
function generatePagePurgeUrls(page) {
  if (!page) {
    return { purge_everything: true };
  }

  const urls = [
    '/', // Home page
    '/sitemap.xml' // Sitemap
  ];

  // Add page URL if available
  if (page.url) {
    urls.push(page.url);
  }

  return { files: urls };
}

/**
 * Generate selective purge for unknown events
 */
function generateSelectivePurge(payload) {
  // Conservative approach - purge common dynamic content
  return {
    files: [
      '/',
      '/rss/',
      '/sitemap.xml',
      '/robots.txt'
    ]
  };
}

/**
 * Send Slack notification about cache purge
 */
async function sendSlackNotification(payload, purgeResult, env) {
  const { SLACK_WEBHOOK_URL } = env;
  
  if (!SLACK_WEBHOOK_URL) {
    console.log('No Slack webhook URL configured, skipping notification');
    return;
  }

  try {
    const notification = formatSlackMessage(payload, purgeResult);
    
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notification)
    });

    if (response.ok) {
      console.log('Slack notification sent successfully');
    } else {
      console.error('Failed to send Slack notification:', response.status);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error.message);
  }
}

/**
 * Format Slack message with markdown
 */
function formatSlackMessage(payload, purgeResult) {
  return {
    text: "✅ Cache purged successfully"
  };
}

/**
 * Extract content information from payload
 */
function getContentInfo(payload) {
  const eventType = payload.event || '';
  
  if (eventType.includes('post')) {
    return {
      title: payload.post?.title || 'Untitled Post',
      url: payload.post?.url || null,
      type: 'Post'
    };
  } else if (eventType.includes('page')) {
    return {
      title: payload.page?.title || 'Untitled Page',
      url: payload.page?.url || null,
      type: 'Page'
    };
  } else {
    return {
      title: 'Site-wide change',
      url: null,
      type: 'Settings'
    };
  }
}

/**
 * Format event name for display
 */
function formatEventName(eventType) {
  const eventMap = {
    'post.published': '📝 Post Published',
    'post.updated': '✏️ Post Updated',
    'post.unpublished': '🗑️ Post Unpublished',
    'page.published': '📄 Page Published',
    'page.updated': '📝 Page Updated',
    'page.unpublished': '🗑️ Page Unpublished',
    'site.changed': '⚙️ Site Settings Changed',
    'settings.updated': '🔧 Settings Updated'
  };
  
  return eventMap[eventType] || `🔄 ${eventType}`;
}

/**
 * Send Slack error notification
 */
async function sendSlackErrorNotification(title, message, env) {
  const { SLACK_WEBHOOK_URL } = env;
  
  if (!SLACK_WEBHOOK_URL) {
    console.log('No Slack webhook URL configured, skipping error notification');
    return;
  }

  try {
    const errorMessage = {
      text: `❌ Cache purge failed - ${message}`
    };

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorMessage)
    });

    if (response.ok) {
      console.log('Slack error notification sent successfully');
    } else {
      console.error('Failed to send Slack error notification:', response.status);
    }
  } catch (error) {
    console.error('Error sending Slack error notification:', error.message);
  }
} 