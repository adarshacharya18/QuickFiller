/**
 * Utility to register Declarative Net Request rules dynamically.
 * This rewrites the Origin header for Ollama requests to match Ollama's accepted host origins
 * (e.g. http://localhost:11434) and sets permissive Access-Control headers, preventing 403 Forbidden errors.
 */

export async function setupOllamaDNRRules(customHost?: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
    return;
  }

  try {
    const rules: chrome.declarativeNetRequest.Rule[] = [];
    let dynamicRuleId = 1001;

    // Helper to build a modifyHeaders rule for a given target origin
    const buildRule = (id: number, targetOrigin: string, hostname: string, port: string): chrome.declarativeNetRequest.Rule => ({
      id,
      priority: 1,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: [
          {
            header: 'origin',
            operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
            value: targetOrigin,
          },
        ],
        responseHeaders: [
          {
            header: 'access-control-allow-origin',
            operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
            value: '*',
          },
          {
            header: 'access-control-allow-methods',
            operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
            value: 'GET, POST, OPTIONS',
          },
          {
            header: 'access-control-allow-headers',
            operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
            value: '*',
          },
        ],
      },
      condition: {
        urlFilter: `*://${hostname}:${port}/*`,
        resourceTypes: [
          'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
          'other' as chrome.declarativeNetRequest.ResourceType,
        ],
      },
    });

    // Default 1: localhost:11434
    rules.push(buildRule(dynamicRuleId++, 'http://localhost:11434', 'localhost', '11434'));

    // Default 2: 127.0.0.1:11434
    rules.push(buildRule(dynamicRuleId++, 'http://127.0.0.1:11434', '127.0.0.1', '11434'));

    // If custom host is provided and different from defaults
    if (customHost) {
      try {
        const u = new URL(customHost.startsWith('http') ? customHost : `http://${customHost}`);
        const p = u.port || (u.protocol === 'https:' ? '443' : '80');
        if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
          rules.push(buildRule(dynamicRuleId++, u.origin, u.hostname, p));
        }
      } catch (e) {
        console.warn('[QuickFiller] Invalid custom host format for DNR rule:', customHost);
      }
    }

    const removeRuleIds = [1001, 1002, 1003, 1004, 1005];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
  } catch (err) {
    console.warn('[QuickFiller] Failed to update dynamic DNR rules:', err);
  }
}
