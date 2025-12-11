import type { WorkanaJob, WorkanaResponse, ExtensionConfig, StoredJobs } from '@/types/job';

const WORKANA_API_URL = "https://www.workana.com/jobs?category=it-programming&language=xx&publication=1d&subcategory=web-development%2Cweb-design%2Ce-commerce%2Cwordpress-1%2Cmobile-development%2Cdata-science-1%2Cdesktop-apps%2Cartificial-intelligence-1%2Cothers-5";
const STORAGE_KEYS = {
  CONFIG: 'workana_config',
  JOBS: 'workana_jobs',
} as const;

let monitoringIntervalId: number | null = null;

// Default configuration
const DEFAULT_CONFIG: ExtensionConfig = {
  discordWebhookUrl: 'https://discord.com/api/webhooks/1448169710788022352/75MFAGcXxDz6BkEXu4XxWaRMLsQ3hXwD8BNyC5dCi3hhUlOka9rmO3uQEeJaiCO8mORB',
  monitoringInterval: 300000, // 5 minutes in milliseconds (5 * 60 * 1000)
  isMonitoring: false,
  lastCheckTime: null,
};

// Get configuration from storage
async function getConfig(): Promise<ExtensionConfig> {
  const result = await browser.storage.local.get(STORAGE_KEYS.CONFIG);
  return { ...DEFAULT_CONFIG, ...result[STORAGE_KEYS.CONFIG] };
}

// Save configuration to storage
async function saveConfig(config: ExtensionConfig): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
}

// Get stored jobs from storage
async function getStoredJobs(): Promise<StoredJobs> {
  const result = await browser.storage.local.get(STORAGE_KEYS.JOBS);
  return result[STORAGE_KEYS.JOBS] || { jobs: [], lastUpdate: 0 };
}

// Save jobs to storage
async function saveJobs(jobs: WorkanaJob[]): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.JOBS]: {
      jobs,
      lastUpdate: Date.now(),
    },
  });
}

// Get cookies for Workana domain
async function getWorkanaCookies(): Promise<string> {
  try {
    const cookies = await browser.cookies.getAll({ domain: 'workana.com' });
    console.log('[getWorkanaCookies] Found', cookies.length, 'cookies');
    
    if (cookies.length === 0) {
      console.log('[getWorkanaCookies] No cookies found, trying www.workana.com');
      const wwwCookies = await browser.cookies.getAll({ domain: 'www.workana.com' });
      if (wwwCookies.length > 0) {
        console.log('[getWorkanaCookies] Found', wwwCookies.length, 'cookies for www.workana.com');
        return wwwCookies.map(c => `${c.name}=${c.value}`).join('; ');
      }
      return '';
    }
    
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log('[getWorkanaCookies] Cookie string length:', cookieString.length);
    return cookieString;
  } catch (error) {
    console.error('[getWorkanaCookies] Error getting cookies:', error);
    return '';
  }
}

// Fetch jobs from Workana API
async function fetchJobs(): Promise<WorkanaJob[]> {
  try {
    console.log('[fetchJobs] Fetching jobs from:', WORKANA_API_URL);
    
    // Get cookies for the request
    const cookieString = await getWorkanaCookies();
    console.log('[fetchJobs] Cookies retrieved:', cookieString ? 'Yes' : 'No');
    
    // Build headers
    const headers: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'x-requested-with': 'XMLHttpRequest',
      'Referer': 'https://www.workana.com/jobs?category=it-programming&language=xx&publication=1d&subcategory=web-development%2Cweb-design%2Ce-commerce%2Cwordpress-1%2Cmobile-development%2Cdata-science-1%2Cdesktop-apps%2Cartificial-intelligence-1%2Cothers-5',
      'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    };
    
    // Add cookies to headers if available
    if (cookieString) {
      headers['Cookie'] = cookieString;
      console.log('[fetchJobs] Added Cookie header');
    }
    
    const response = await fetch(WORKANA_API_URL, {
      method: 'GET',
      headers,
      credentials: 'include', // Include credentials (cookies) in the request
    });

    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }

    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Unexpected content type. Response:', text.substring(0, 500));
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const data: WorkanaResponse = await response.json();
    console.log('Fetched jobs count:', data.results?.results?.length || 0);
    return data.results?.results || [];
  } catch (error) {
    console.error('Error fetching jobs:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Send Discord webhook notification
async function sendDiscordNotification(job: WorkanaJob, webhookUrl: string): Promise<void> {
  try {
    // Extract clean avatar from HTML
    const avatarMatch = job.profileLogo.match(/src="([^"]+)"/);
    const cleanAvatar = avatarMatch ? avatarMatch[1] : job.profileLogo.replace(/<[^>]*>/g, '');
    
    // Extract clean title from HTML
    const titleMatch = job.title.match(/title="([^"]+)"/);
    const cleanTitle = titleMatch ? titleMatch[1] : job.title.replace(/<[^>]*>/g, '');
    
    // Extract clean url from HTML
    const urlMatch = job.title.match(/href="([^"]+)"/);
    const cleanUrl = 'https://www.workana.com' + (urlMatch ? urlMatch[1] : job.url.replace(/<[^>]*>/g, ''));

    // Extract country from HTML
    const countryMatch = job.country.match(/title="([^"]+)"/);
    const country = countryMatch ? countryMatch[1] : 'Unknown';

    // Build skills list
    const skills = job.skills.map(s => s.anchorText).join(', ');

    const embed = {
      title: cleanTitle,
      url: cleanUrl,
      color: job.isUrgent ? 0xff0000 : 0x00ff00,
      fields: [
        {
          name: 'Budget',
          value: job.budget,
          inline: true,
        },
        {
          name: 'Posted',
          value: job.postedDate,
          inline: true,
        },
        {
          name: 'Bids',
          value: job.totalBids,
          inline: true,
        },
        {
          name: 'Country',
          value: country,
          inline: true,
        },
        {
          name: 'Rating',
          value: job.rating.label,
          inline: true,
        },
        {
          name: 'Verified Payment',
          value: job.hasVerifiedPaymentMethod ? 'Yes' : 'No',
          inline: true,
        },
        {
          name: 'Skills',
          value: skills || 'None',
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const payload = {
      username: job.authorName,
      avatar_url: cleanAvatar,
      embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook error: ${response.status}`);
    }

    console.log('Discord notification sent successfully');
  } catch (error) {
    console.error('Error sending Discord notification:', error);
    throw error;
  }
}

// Check if a job was posted "just now"
// postedDate format examples: "Just now", "just now", etc.
function isJobPostedVeryRecently(postedDate: string): boolean {
  if (!postedDate) {
    return false;
  }

  const dateStr = postedDate.toLowerCase().trim();
  
  // Only check for "just now" or "now"
  if (dateStr.includes('just now') || dateStr === 'now') {
    return true;
  }

  // Anything else (minutes ago, hours, days, yesterday, etc.) is not considered
  return false;
}

// Check if budget is hourly (contains "/hour")
function isHourlyBudget(budget: string): boolean {
  if (!budget) {
    return false;
  }
  return budget.toLowerCase().includes('/hour');
}

// Check if budget is equal to or greater than 1000
// Budget format examples: "USD 500 - 1,000", "Over USD 3,000", "Less than USD 50", "USD 15 - 45 / hour"
function isBudgetAtLeast1000(budget: string): boolean {
  if (!budget) {
    return false;
  }

  const budgetStr = budget.toLowerCase();
  
  // Check for "over USD X" format
  const overMatch = budgetStr.match(/over\s*(?:usd\s*)?([\d,]+)/i);
  if (overMatch) {
    const amount = parseInt(overMatch[1].replace(/,/g, ''), 10);
    return amount >= 1000;
  }

  // Check for ranges like "USD 500 - 1,000" or "USD 1,000 - 3,000"
  const rangeMatch = budgetStr.match(/(?:usd\s*)?([\d,]+)\s*-\s*([\d,]+)/i);
  if (rangeMatch) {
    const maxAmount = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
    return maxAmount >= 1000;
  }

  // Check for single amount like "USD 1,000" or "USD 2000"
  const singleMatch = budgetStr.match(/(?:usd\s*)?([\d,]+)/i);
  if (singleMatch) {
    const amount = parseInt(singleMatch[1].replace(/,/g, ''), 10);
    return amount >= 1000;
  }

  return false;
}

// Check if job meets the filtering criteria
function meetsJobCriteria(job: WorkanaJob): boolean {
  // Must be posted "just now"
  if (!isJobPostedVeryRecently(job.postedDate)) {
    return false;
  }

  // Parse rating value
  const ratingValue = parseFloat(job.rating?.value || '0.00');
  const hasRating = ratingValue > 0.0;
  const hasVerifiedPayment = job.hasVerifiedPaymentMethod === true;
  const isHourly = isHourlyBudget(job.budget);
  const budgetAtLeast1000 = isBudgetAtLeast1000(job.budget);

  // Condition 1: Verified Payment is true
  if (hasVerifiedPayment) {
    return true;
  }

  // Condition 2: Rating is not 0.00 (has rating > 0.0)
  if (hasRating) {
    return true;
  }

  // Condition 3: Verified Payment is false AND Rating is 0.00 BUT Budget >= 1000
  if (!hasVerifiedPayment && ratingValue === 0.00 && budgetAtLeast1000) {
    return true;
  }

  // Condition 4: Projects priced at /hour (hourly)
  if (isHourly) {
    return true;
  }

  // Doesn't meet any criteria
  return false;
}

// Compare jobs and find new ones using slug as unique identifier
// Only compares jobs posted "just now" that meet the criteria:
// - Verified Payment is true, OR
// - Rating is not 0.00 (value > 0.0), OR
// - Verified Payment is false AND Rating is 0.00 BUT Budget >= 1000, OR
// - Budget is hourly (/hour)
// If a job meeting these criteria doesn't exist in saved list, it's considered new
function findNewJobs(currentJobs: WorkanaJob[], storedJobs: WorkanaJob[]): WorkanaJob[] {
  // Create a Set of stored job slugs for fast lookup
  const storedSlugs = new Set(storedJobs.map(job => job.slug?.trim()).filter(Boolean));
  
  // First, filter to only jobs posted "just now" that meet the criteria
  const qualifiedJobs = currentJobs.filter(job => {
    const meetsCriteria = meetsJobCriteria(job);
    if (!meetsCriteria) {
      const rating = parseFloat(job.rating?.value || '0.00');
      console.log(`[findNewJobs] Skipping job ${job.slug} - doesn't meet criteria:`, {
        posted: job.postedDate,
        verifiedPayment: job.hasVerifiedPaymentMethod,
        rating: rating,
        budget: job.budget,
        isHourly: isHourlyBudget(job.budget),
        budgetAtLeast1000: isBudgetAtLeast1000(job.budget)
      });
    }
    return meetsCriteria;
  });
  
  console.log('[findNewJobs] Qualified jobs (just now + meets criteria):', qualifiedJobs.length);
  
  // Now compare these qualified jobs by slug against stored jobs
  // If a job doesn't exist in stored list, it's new
  const newJobs = qualifiedJobs.filter(job => {
    const slug = job.slug?.trim();
    if (!slug) {
      console.warn('[findNewJobs] Job missing slug:', job);
      return false; // Skip jobs without slugs
    }
    
    // Check if job is new (not in stored jobs)
    const isNew = !storedSlugs.has(slug);
    
    if (!isNew) {
      console.log(`[findNewJobs] Job ${slug} already exists in stored jobs, skipping`);
    }
    
    return isNew;
  });
  
  console.log('[findNewJobs] Comparing jobs by slug (just now + criteria):');
  console.log('[findNewJobs] Current jobs count:', currentJobs.length);
  console.log('[findNewJobs] Qualified jobs count (just now + criteria):', qualifiedJobs.length);
  console.log('[findNewJobs] Stored jobs count:', storedJobs.length);
  console.log('[findNewJobs] Stored slugs count:', storedSlugs.size);
  
  if (qualifiedJobs.length > 0) {
    console.log('[findNewJobs] Qualified job details:', 
      qualifiedJobs.map(j => ({ 
        slug: j.slug, 
        posted: j.postedDate,
        verifiedPayment: j.hasVerifiedPaymentMethod,
        rating: j.rating?.value,
        budget: j.budget
      })));
  }
  
  if (storedSlugs.size > 0) {
    console.log('[findNewJobs] Sample stored slugs:', Array.from(storedSlugs).slice(0, 5));
  }
  
  console.log('[findNewJobs] New jobs found (qualified AND not in stored):', newJobs.length);
  if (newJobs.length > 0) {
    console.log('[findNewJobs] New job details:', 
      newJobs.map(j => ({ 
        slug: j.slug, 
        posted: j.postedDate,
        verifiedPayment: j.hasVerifiedPaymentMethod,
        rating: j.rating?.value,
        budget: j.budget
      })));
  } else {
    // Verify comparison is working
    if (qualifiedJobs.length > 0) {
      const qualifiedSlugs = new Set(qualifiedJobs.map(j => j.slug?.trim()).filter(Boolean));
      const matchingCount = Array.from(qualifiedSlugs).filter(slug => storedSlugs.has(slug)).length;
      console.log('[findNewJobs] Verification: qualified jobs already in stored:', matchingCount);
    }
  }
  
  return newJobs;
}

// Main monitoring function
async function checkForNewJobs(forceCheck: boolean = false): Promise<void> {
  try {
    console.log('[checkForNewJobs] Starting check...', new Date().toISOString());
    const config = await getConfig();
    console.log('[checkForNewJobs] Config:', { 
      isMonitoring: config.isMonitoring, 
      hasWebhook: !!config.discordWebhookUrl,
      interval: config.monitoringInterval,
      forceCheck
    });

    // Only check monitoring status if not a forced check
    if (!forceCheck) {
      if (!config.isMonitoring) {
        console.log('[checkForNewJobs] Monitoring is disabled');
        return;
      }

      if (!config.discordWebhookUrl) {
        console.log('[checkForNewJobs] Webhook URL not configured');
        return;
      }
    }

    console.log('[checkForNewJobs] Fetching jobs...');
    const currentJobs = await fetchJobs();
    console.log('[checkForNewJobs] Fetched', currentJobs.length, 'jobs');
    
    const stored = await getStoredJobs();
    console.log('[checkForNewJobs] Stored jobs count:', stored.jobs.length);

    // If this is the first run (no stored jobs), initialize storage without sending notifications
    if (stored.jobs.length === 0) {
      console.log('[checkForNewJobs] First run detected - initializing stored jobs without notifications');
      await saveJobs(currentJobs);
      console.log('[checkForNewJobs] Initialized with', currentJobs.length, 'jobs. No notifications sent.');
      
      // Update last check time
      config.lastCheckTime = Date.now();
      await saveConfig(config);
      console.log('[checkForNewJobs] First run completed - stored jobs initialized');
      return;
    }

    // Find new jobs by comparing slugs
    const newJobs = findNewJobs(currentJobs, stored.jobs);
    console.log('[checkForNewJobs] New jobs found:', newJobs.length);

    if (newJobs.length > 0) {
      console.log(`[checkForNewJobs] Found ${newJobs.length} new job(s)!`);
      console.log('[checkForNewJobs] New job slugs:', newJobs.map(j => j.slug));

      // Send notifications only if webhook is configured
      if (config.discordWebhookUrl) {
        // Send notifications for each new job
        for (const job of newJobs) {
          try {
            console.log(`[checkForNewJobs] Sending notification for job: ${job.slug}`);
            await sendDiscordNotification(job, config.discordWebhookUrl);
            console.log(`[checkForNewJobs] Notification sent for job: ${job.slug}`);
            // Small delay between notifications to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`[checkForNewJobs] Failed to send notification for job ${job.slug}:`, error);
          }
        }
      } else {
        console.log('[checkForNewJobs] Webhook not configured, skipping notifications');
      }
    } else {
      console.log('[checkForNewJobs] No new jobs found');
    }

    // Always update stored jobs with current jobs (this removes archived jobs and adds new ones)
    // This ensures stored jobs always reflect the current state of the API
    await saveJobs(currentJobs);
    console.log('[checkForNewJobs] Updated stored jobs with current jobs');

    // Update last check time
    config.lastCheckTime = Date.now();
    await saveConfig(config);
    console.log('[checkForNewJobs] Check completed successfully');
  } catch (error) {
    console.error('[checkForNewJobs] Error:', error);
    if (error instanceof Error) {
      console.error('[checkForNewJobs] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error; // Re-throw so caller can handle it
  }
}

// Start monitoring
async function startMonitoring(): Promise<void> {
  console.log('[startMonitoring] Starting monitoring...');
  
  // Stop any existing monitoring first to prevent duplicates
  if (monitoringIntervalId !== null) {
    console.log('[startMonitoring] Clearing existing interval before starting new one');
    clearInterval(monitoringIntervalId);
    monitoringIntervalId = null;
  }
  
  const config = await getConfig();
  console.log('[startMonitoring] Config:', config);

  if (!config.isMonitoring) {
    console.log('[startMonitoring] Cannot start: monitoring is disabled');
    return;
  }

  if (!config.discordWebhookUrl) {
    console.log('[startMonitoring] Cannot start: webhook URL not configured');
    return;
  }

  // Use monitoring interval directly as milliseconds
  const intervalMs = config.monitoringInterval;
  console.log(`[startMonitoring] Interval: ${intervalMs}ms (${(intervalMs / 1000).toFixed(1)}s)`);

  // Run immediately on start
  console.log('[startMonitoring] Running initial check...');
  try {
    await checkForNewJobs();
  } catch (error) {
    console.error('[startMonitoring] Initial check failed:', error);
  }

  // Then run at intervals
  monitoringIntervalId = setInterval(() => {
    console.log('[startMonitoring] Interval triggered');
    checkForNewJobs();
  }, intervalMs) as unknown as number;

  console.log(`[startMonitoring] Monitoring started with interval: ${config.monitoringInterval}ms (${(config.monitoringInterval / 1000).toFixed(1)}s)`);
  console.log('[startMonitoring] Interval ID:', monitoringIntervalId);
}

// Stop monitoring
function stopMonitoring(): void {
  console.log('[stopMonitoring] Stopping monitoring...');
  if (monitoringIntervalId !== null) {
    console.log('[stopMonitoring] Clearing interval ID:', monitoringIntervalId);
    clearInterval(monitoringIntervalId);
    monitoringIntervalId = null;
    console.log('[stopMonitoring] Monitoring stopped successfully');
  } else {
    console.log('[stopMonitoring] No active interval to stop');
  }
}

export default defineBackground(() => {
  console.log('Workana Job Monitor extension loaded!', { id: browser.runtime.id });

  // Listen for messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_MONITORING') {
      console.log('[MESSAGE] START_MONITORING received');
      startMonitoring()
        .then(() => {
          console.log('[MESSAGE] START_MONITORING completed');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[MESSAGE] START_MONITORING failed:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true; // Keep channel open for async response
    }

    if (message.type === 'STOP_MONITORING') {
      console.log('[MESSAGE] STOP_MONITORING received');
      stopMonitoring();
      sendResponse({ success: true });
    }

    if (message.type === 'GET_STATUS') {
      Promise.all([getConfig(), getStoredJobs()]).then(([config, stored]) => {
        sendResponse({
          config,
          storedJobsCount: stored.jobs.length,
          lastUpdate: stored.lastUpdate,
        });
      });
      return true;
    }

    if (message.type === 'SAVE_CONFIG') {
      console.log('[MESSAGE] SAVE_CONFIG received, isMonitoring:', message.config.isMonitoring);
      saveConfig(message.config).then(() => {
        sendResponse({ success: true });
        // Restart monitoring if enabled, stop if disabled
        if (message.config.isMonitoring) {
          console.log('[MESSAGE] SAVE_CONFIG: Starting monitoring after config save');
          startMonitoring().catch((error) => {
            console.error('[MESSAGE] SAVE_CONFIG: Failed to start monitoring:', error);
          });
        } else {
          console.log('[MESSAGE] SAVE_CONFIG: Stopping monitoring after config save');
          stopMonitoring();
        }
      }).catch((error) => {
        console.error('[MESSAGE] SAVE_CONFIG failed:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      });
      return true;
    }

    if (message.type === 'CHECK_NOW') {
      console.log('[MESSAGE] CHECK_NOW received, forcing check...');
      checkForNewJobs(true) // Force check even if monitoring is disabled
        .then(() => {
          console.log('[MESSAGE] CHECK_NOW completed successfully');
          sendResponse({ success: true, message: 'Check completed successfully' });
        })
        .catch((error) => {
          console.error('[MESSAGE] CHECK_NOW failed:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : String(error)
          });
        });
      return true;
    }
  });

  // Start monitoring on extension startup if enabled
  getConfig().then(config => {
    if (config.isMonitoring && config.discordWebhookUrl) {
      startMonitoring();
    }
  });
});