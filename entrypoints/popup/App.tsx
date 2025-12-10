import { useState, useEffect } from 'react';
import type { ExtensionConfig } from '@/types/job';
import './App.css';

function App() {
  const [config, setConfig] = useState<ExtensionConfig>({
    discordWebhookUrl: 'https://discord.com/api/webhooks/1448169710788022352/75MFAGcXxDz6BkEXu4XxWaRMLsQ3hXwD8BNyC5dCi3hhUlOka9rmO3uQEeJaiCO8mORB',
    monitoringInterval: 300000, // 5 minutes in milliseconds
    isMonitoring: false,
    lastCheckTime: null,
  });
  const [storedJobsCount, setStoredJobsCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response) {
        setConfig(response.config);
        setStoredJobsCount(response.storedJobsCount);
        setLastUpdate(response.lastUpdate);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.discordWebhookUrl.trim()) {
      setStatus('error');
      setMessage('Please enter a Discord webhook URL');
      return;
    }

    if (config.monitoringInterval < 1000) {
      setStatus('error');
      setMessage('Monitoring interval must be at least 1000 milliseconds (1 second)');
      return;
    }

    setStatus('loading');
    try {
      await browser.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config,
      });
      setStatus('success');
      setMessage('Configuration saved successfully!');
      await loadStatus();
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage('Failed to save configuration');
      console.error('Error saving config:', error);
    }
  };

  const handleStartMonitoring = async () => {
    if (!config.discordWebhookUrl.trim()) {
      setStatus('error');
      setMessage('Please configure Discord webhook URL first');
      return;
    }

    setStatus('loading');
    try {
      // Save the config with isMonitoring: true, then start monitoring
      // SAVE_CONFIG will handle starting monitoring, so we don't need to call START_MONITORING separately
      const updatedConfig = { ...config, isMonitoring: true };
      const response = await browser.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config: updatedConfig,
      });
      
      console.log('[POPUP] Start monitoring response:', response);
      
      if (response && response.success) {
        setConfig(updatedConfig);
        setStatus('success');
        setMessage('Monitoring started!');
      } else {
        setStatus('error');
        setMessage(response?.error || 'Failed to start monitoring');
      }
      
      await loadStatus();
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 2000);
    } catch (error) {
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to start monitoring';
      setMessage(`Error: ${errorMessage}. Check console for details.`);
      console.error('[POPUP] Error starting monitoring:', error);
    }
  };

  const handleStopMonitoring = async () => {
    setStatus('loading');
    try {
      // Save the config with isMonitoring: false, then stop monitoring
      // SAVE_CONFIG will handle stopping monitoring, so we don't need to call STOP_MONITORING separately
      const updatedConfig = { ...config, isMonitoring: false };
      const response = await browser.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config: updatedConfig,
      });
      
      console.log('[POPUP] Stop monitoring response:', response);
      
      if (response && response.success) {
        setConfig(updatedConfig);
        setStatus('success');
        setMessage('Monitoring stopped');
      } else {
        setStatus('error');
        setMessage(response?.error || 'Failed to stop monitoring');
      }
      
      await loadStatus();
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 2000);
    } catch (error) {
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop monitoring';
      setMessage(`Error: ${errorMessage}. Check console for details.`);
      console.error('[POPUP] Error stopping monitoring:', error);
    }
  };

  const handleCheckNow = async () => {
    setStatus('loading');
    setMessage('Checking for new jobs...');
    try {
      console.log('[POPUP] Sending CHECK_NOW message');
      const response = await browser.runtime.sendMessage({ type: 'CHECK_NOW' });
      console.log('[POPUP] Check now response:', response);
      
      if (response && response.success) {
        setStatus('success');
        setMessage('Check completed! Check browser console (F12) for details.');
      } else {
        setStatus('error');
        setMessage(response?.error || 'Check failed. See console for details.');
      }
      
      await loadStatus();
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    } catch (error) {
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to check for jobs';
      setMessage(`Error: ${errorMessage}. Open browser console (F12) for details.`);
      console.error('[POPUP] Error checking jobs:', error);
    }
  };

  const formatLastUpdate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute(s) ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;
    return date.toLocaleString();
  };

  return (
    <div className="app-container">
      <h1>Workana Job Monitor</h1>
      
      <div className="status-section">
        <div className="status-item">
          <span className="status-label">Status:</span>
          <span className={`status-value ${config.isMonitoring ? 'active' : 'inactive'}`}>
            {config.isMonitoring ? '🟢 Monitoring' : '🔴 Stopped'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Stored Jobs:</span>
          <span className="status-value">{storedJobsCount}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Last Update:</span>
          <span className="status-value">{formatLastUpdate(lastUpdate)}</span>
        </div>
      </div>

      <div className="config-section">
        <div className="form-group">
          <label htmlFor="webhook-url">Discord Webhook URL:</label>
          <input
            id="webhook-url"
            type="text"
            value={config.discordWebhookUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, discordWebhookUrl: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..."
            className="input-field"
          />
        </div>

        <div className="form-group">
          <label htmlFor="interval">Monitoring Interval (milliseconds):</label>
          <input
            id="interval"
            type="number"
            min="1000"
            step="1000"
            value={config.monitoringInterval}
            onChange={(e) => setConfig(prev => ({ ...prev, monitoringInterval: parseInt(e.target.value) || 300000 }))}
            className="input-field"
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            {config.monitoringInterval >= 1000 && (
              <span>
                {config.monitoringInterval >= 60000 
                  ? `${(config.monitoringInterval / 60000).toFixed(1)} minute(s)`
                  : `${(config.monitoringInterval / 1000).toFixed(1)} second(s)`
                }
              </span>
            )}
          </div>
        </div>

        <div className="button-group">
          <button
            onClick={handleSaveConfig}
            className="btn btn-primary"
            disabled={status === 'loading'}
          >
            Save Configuration
          </button>
        </div>
      </div>

      <div className="actions-section">
        <button
          onClick={config.isMonitoring ? handleStopMonitoring : handleStartMonitoring}
          className={`btn ${config.isMonitoring ? 'btn-danger' : 'btn-success'}`}
          disabled={status === 'loading'}
        >
          {config.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </button>
        <button
          onClick={handleCheckNow}
          className="btn btn-secondary"
          disabled={status === 'loading'}
        >
          Check Now
        </button>
      </div>

      {message && (
        <div className={`message ${status === 'error' ? 'error' : status === 'success' ? 'success' : ''}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default App;
