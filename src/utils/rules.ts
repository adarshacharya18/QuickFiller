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

    // Securely derive extension-only origin (e.g. "chrome-extension://<id>" or "moz-extension://<id>")
    // This allows the extension to read Ollama responses while strictly preventing any web page
    // from bypassing CORS or reading local model outputs.
    const extensionOrigin =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('').replace(/\/+$/, '')
        : typeof chrome !== 'undefined' && chrome.runtime?.id
        ? `chrome-extension://${chrome.runtime.id}`
        : '';

    // initiatorDomains requires a valid RFC 1035 domain name without special characters like '@'.
    // In Firefox, chrome.runtime.id is often an email-like ID (e.g. "quickfiller@adarshacharya.dev"),
    // which causes Firefox DNR updateDynamicRules to throw "initiatorDomains: Domain ... is not valid".
    const validDomain =
      typeof chrome !== 'undefined' &&
      chrome.runtime?.id &&
      !chrome.runtime.id.includes('@')
        ? chrome.runtime.id
        : undefined;
    const initiatorDomains = validDomain ? [validDomain] : undefined;

    // Helper to build a modifyHeaders rule for a given target origin
    const buildRule = (
      id: number,
      targetOrigin: string,
      hostname: string,
      port: string
    ): chrome.declarativeNetRequest.Rule => ({
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
          ...(extensionOrigin
            ? [
                {
                  header: 'access-control-allow-origin',
                  operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
                  value: extensionOrigin,
                },
              ]
            : []),
          {
            header: 'access-control-allow-methods',
            operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
            value: 'GET, POST, OPTIONS',
          },
          {
            header: 'access-control-allow-headers',
            operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
            value: 'Content-Type, Authorization, x-goog-api-key, *',
          },
        ],
      },
      condition: {
        urlFilter: `*://${hostname}:${port}/*`,
        resourceTypes: [
          'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
          'other' as chrome.declarativeNetRequest.ResourceType,
        ],
        ...(initiatorDomains ? { initiatorDomains } : {}),
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
        const isDefault = (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && p === '11434';
        if (!isDefault) {
          rules.push(buildRule(dynamicRuleId++, u.origin, u.hostname, p));
        }
      } catch (e) {
        console.warn('[QuickFiller] Invalid custom host format for DNR rule:', customHost);
      }
    }

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map((r) => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
  } catch (err) {
    console.warn('[QuickFiller] Failed to update dynamic DNR rules:', err);
  }
}

let ollamaSendHeadersListener: ((details: chrome.webRequest.WebRequestHeadersDetails) => chrome.webRequest.BlockingResponse | void) | null = null;
let ollamaHeadersReceivedListener: ((details: chrome.webRequest.WebResponseHeadersDetails) => chrome.webRequest.BlockingResponse | void) | null = null;

/**
 * Blocking webRequest listener for Firefox MV2.
 * Intercepts requests to Ollama endpoints and rewrites the Origin header to match
 * the target host, preventing 403 Forbidden CORS blocks from Ollama.
 */
export function setupOllamaWebRequestRules(customHost?: string): void {
  const globalBrowser = (globalThis as any).browser;
  const webRequestApi =
    typeof chrome !== 'undefined' && chrome.webRequest?.onBeforeSendHeaders
      ? chrome.webRequest
      : globalBrowser?.webRequest;

  if (!webRequestApi?.onBeforeSendHeaders) {
    return;
  }

  // WebExtension match patterns (RFC / MDN spec) MUST NOT contain port numbers (e.g. 'http://localhost/*').
  // Specifying port numbers in match patterns causes Firefox to throw an 'Invalid match pattern' error.
  const matchUrls = [
    'http://localhost/*',
    'https://localhost/*',
    'http://127.0.0.1/*',
    'https://127.0.0.1/*',
  ];

  const targetPorts = new Set<string>(['11434', '']);

  if (customHost) {
    try {
      const u = new URL(customHost.startsWith('http') ? customHost : `http://${customHost}`);
      const pattern = `${u.protocol}//${u.hostname}/*`;
      if (!matchUrls.includes(pattern)) {
        matchUrls.push(pattern);
      }
      if (u.port) {
        targetPorts.add(u.port);
      } else {
        targetPorts.add(u.protocol === 'https:' ? '443' : '80');
      }
    } catch {}
  }

  try {
    if (ollamaSendHeadersListener && webRequestApi.onBeforeSendHeaders.hasListener?.(ollamaSendHeadersListener)) {
      webRequestApi.onBeforeSendHeaders.removeListener(ollamaSendHeadersListener);
    }
    ollamaSendHeadersListener = null;
  } catch {}

  try {
    if (ollamaHeadersReceivedListener && webRequestApi.onHeadersReceived?.hasListener?.(ollamaHeadersReceivedListener)) {
      webRequestApi.onHeadersReceived.removeListener(ollamaHeadersReceivedListener);
    }
    ollamaHeadersReceivedListener = null;
  } catch {}

  ollamaSendHeadersListener = (details: chrome.webRequest.WebRequestHeadersDetails) => {
    try {
      const url = new URL(details.url);
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (!targetPorts.has(port) && !targetPorts.has(url.port)) {
        return { requestHeaders: details.requestHeaders };
      }

      const headers = details.requestHeaders || [];
      const targetOrigin = url.origin;

      let found = false;
      for (const h of headers) {
        if (h.name.toLowerCase() === 'origin') {
          h.value = targetOrigin;
          found = true;
          break;
        }
      }
      if (!found) {
        headers.push({ name: 'Origin', value: targetOrigin });
      }
      return { requestHeaders: headers };
    } catch {
      return { requestHeaders: details.requestHeaders };
    }
  };

  ollamaHeadersReceivedListener = (details: chrome.webRequest.WebResponseHeadersDetails) => {
    try {
      const url = new URL(details.url);
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (!targetPorts.has(port) && !targetPorts.has(url.port)) {
        return { responseHeaders: details.responseHeaders };
      }

      const headers = details.responseHeaders || [];
      const extensionOrigin =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('').replace(/\/+$/, '')
          : (globalBrowser?.runtime?.getURL
          ? globalBrowser.runtime.getURL('').replace(/\/+$/, '')
          : '');

      if (extensionOrigin) {
        let foundAcao = false;
        for (const h of headers) {
          if (h.name.toLowerCase() === 'access-control-allow-origin') {
            h.value = extensionOrigin;
            foundAcao = true;
            break;
          }
        }
        if (!foundAcao) {
          headers.push({ name: 'Access-Control-Allow-Origin', value: extensionOrigin });
        }
      }
      return { responseHeaders: headers };
    } catch {
      return { responseHeaders: details.responseHeaders };
    }
  };

  try {
    webRequestApi.onBeforeSendHeaders.addListener(
      ollamaSendHeadersListener,
      { urls: matchUrls },
      ['blocking', 'requestHeaders']
    );

    if (webRequestApi.onHeadersReceived) {
      webRequestApi.onHeadersReceived.addListener(
        ollamaHeadersReceivedListener,
        { urls: matchUrls },
        ['blocking', 'responseHeaders']
      );
    }
  } catch (e) {
    console.warn('[QuickFiller] Failed to register webRequest rules:', e);
  }
}

/**
 * Universal Ollama network rules setup:
 * Configures both webRequest (blocking header modification in Firefox MV2)
 * and Declarative Net Request (DNR dynamic rules in Chrome MV3 / Firefox).
 */
export async function setupOllamaRules(customHost?: string): Promise<void> {
  setupOllamaWebRequestRules(customHost);
  await setupOllamaDNRRules(customHost);
}
