# Workana Job Monitor Extension

A browser extension that monitors Workana job listings in real-time and sends Discord webhook notifications when new jobs are posted.

## Features

- 🔄 **Real-time Monitoring**: Automatically checks for new jobs at configurable intervals
- 💾 **Local Storage**: Stores job listings locally to compare with new results
- 🔔 **Discord Notifications**: Sends rich embed notifications to Discord via webhook
- ⚙️ **Configurable**: Set monitoring interval and Discord webhook URL
- 📊 **Status Dashboard**: View monitoring status, stored jobs count, and last update time

## Installation

### Development

1. Install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load the extension in your browser:
   - **Chrome/Edge**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `.output/chrome-mv3` directory
   - **Firefox**: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select the manifest file from `.output/firefox-mv2`

### Development Mode

Run the extension in development mode with hot reload:
```bash
npm run dev
```

## Configuration

1. **Get a Discord Webhook URL**:
   - Go to your Discord server
   - Navigate to Server Settings → Integrations → Webhooks
   - Click "New Webhook" or select an existing one
   - Copy the webhook URL

2. **Configure the Extension**:
   - Click the extension icon in your browser toolbar
   - Paste your Discord webhook URL
   - Set your preferred monitoring interval (in milliseconds)
   - Click "Save Configuration"
   - Click "Start Monitoring"

## Usage

### Starting Monitoring

1. Open the extension popup
2. Enter your Discord webhook URL
3. Set the monitoring interval in milliseconds (minimum 1000ms = 1 second)
4. Click "Save Configuration"
5. Click "Start Monitoring"

### Manual Check

You can manually trigger a job check by clicking the "Check Now" button in the popup.

### Stopping Monitoring

Click "Stop Monitoring" in the extension popup to pause job monitoring.

## How It Works

1. The extension periodically fetches job listings from Workana's API
2. It compares new results with previously stored jobs
3. When new jobs are detected, it sends a Discord webhook notification with:
   - Job title and description
   - Budget information
   - Posted date and bid count
   - Required skills
   - Country and rating information
   - Direct link to the job

## Notification Format

Discord notifications include:
- **Title**: Clean job title
- **Description**: First 1000 characters of job description
- **Budget**: Project budget range
- **Posted Date**: When the job was posted
- **Bids**: Current number of bids
- **Country**: Job location
- **Rating**: Employer rating
- **Verified Payment**: Whether payment method is verified
- **Skills**: List of required skills
- **Author**: Job poster name
- **Direct Link**: Clickable link to the job page

## Technical Details

- Built with [WXT](https://wxt.dev) framework
- Uses React for the popup UI
- TypeScript for type safety
- Browser storage API for persistence
- Discord webhook API for notifications

## Permissions

The extension requires:
- `storage`: To save configuration and job data locally
- `alarms`: For scheduled monitoring (optional, can use setInterval)
- Host permissions for `workana.com` and `discord.com`

## Development

### Project Structure

```
├── entrypoints/
│   ├── background.ts      # Background script with monitoring logic
│   ├── popup/
│   │   ├── App.tsx        # React popup UI
│   │   └── App.css        # Popup styles
│   └── content.ts         # Content script (not used in this extension)
├── types/
│   └── job.ts            # TypeScript type definitions
└── wxt.config.ts         # WXT configuration
```

### Building

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox

# Create distributable ZIP
npm run zip
```

## License

MIT
