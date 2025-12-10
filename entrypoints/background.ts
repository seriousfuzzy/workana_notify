const TARGET_DOMAIN = "https://www.workana.com";
const COMMON_HEADERS = [
  { header: "Sec-Fetch-Site", operation: "set", value: "same-origin" },
  { header: "Referer", operation: "set", value: TARGET_DOMAIN },
  { header: "Origin", operation: "set", value: TARGET_DOMAIN }
];
const rule = {
  id: 1,
  priority: 1,
  action: {
    type: "modifyHeaders",
    requestHeaders: COMMON_HEADERS
  },
  condition: {
    urlFilter: `${TARGET_DOMAIN}/*`,
    resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "object_subrequest", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport", "webbundle", "other"]
  }
};

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Apply/update rules safely
  browser.declarativeNetRequest
    .updateDynamicRules({ addRules: [rule as any], removeRuleIds: [1] })
    .catch(err => console.error("Failed to update DNR rules:", err));
});