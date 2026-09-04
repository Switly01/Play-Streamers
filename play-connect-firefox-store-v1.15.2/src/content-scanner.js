(() => {
  "use strict";
  if ((location.hostname === "github.com" || location.hostname.endsWith(".github.com"))
    && !/^\/sponsors(?:\/|$)/i.test(location.pathname)) {
    return;
  }
  const MAX_CANDIDATES = 80;
  const MAX_JSON_SCRIPT_BYTES = 1_000_000;
  const AMOUNT_PATTERN = /(?:₺|TL|TRY|\$|USD|€|EUR|£|GBP)\s*[\d.,]+|[\d.,]+\s*(?:₺|TL|TRY|\$|USD|€|EUR|£|GBP)/i;
  const JSON_KEYS = {
    id: ["eventId", "event_id", "eventUuid", "event_uuid", "donationId", "donation_id", "donateId", "donate_id", "transactionId", "transaction_id", "operationId", "operation_id", "paymentId", "payment_id", "orderId", "order_id", "orderRowId", "opId", "tipId", "tip_id", "supportId", "support_id", "chargeId", "charge_id", "referenceId", "reference_id", "receiptId", "receipt_id", "invoiceId", "invoice_id", "alertId", "alert_id", "uuid", "_id", "id"],
    name: ["donorName", "donor_name", "supporterName", "supporter_name", "payerName", "payer_name", "customerName", "customer_name", "displayName", "display_name", "nickName", "nickname", "username", "sender", "from", "name"],
    amount: ["amount", "donationAmount", "donation_amount", "supportAmount", "support_amount", "tipAmount", "tip_amount", "amountFormatted", "amount_formatted", "total", "gross", "value"],
    minorAmount: ["amountMinor", "amount_minor", "amountCents", "amount_cents", "grossCents", "gross_cents", "totalCents", "total_cents", "valueCents", "value_cents"],
    currency: ["currency", "currencyCode", "currency_code", "currencyIso", "currency_iso"],
    message: ["message", "comment", "note", "description", "supportMessage", "support_message", "donationMessage", "donation_message"],
    time: ["createdAt", "created_at", "createdDate", "created_date", "dateCreated", "date_created", "donationDate", "donation_date", "transactionDate", "transaction_date", "paidAt", "paid_at", "completedAt", "completed_at", "timestamp", "eventAt", "event_at", "date", "time"]
  };
  let lastFingerprint = "";
  let lastStatusFingerprint = "";
  let lastStatusSentAt = 0;
  let lastByNoGameToken = "";
  let timer = 0;
  let loginUiRequested = false;
  let logoutUiRequested = false;
  let accountMenuRequested = false;
  let lastErrorFingerprint = "";
  let lastMonitorDiscoveryFingerprint = "";
  let resolvedProviderId = /^play-connect-alert:([a-z0-9_-]+)$/i.exec(String(window.name || ""))?.[1] || "";
  const ALERT_FRAME = Boolean(resolvedProviderId);
  let alertDomSnapshotSent = false;
  let alertLifecycleFingerprint = "";
  let alertLifecycleAt = 0;
  let alertLifecycleSignal = 0;
  let lastAlertMutationSignalAt = 0;
  const NETWORK_MARKER = "PLAY_CONNECT_DONATE_NETWORK_V1";

  function extensionContextAvailable() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function safeRuntimeMessage(message, fallback = null) {
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(fallback), 2500);
      if (!extensionContextAvailable()) {
        finish(fallback);
        return;
      }
      try {
        browser.runtime.sendMessage(message, response => {
          try {
            if (browser.runtime.lastError) {
              finish(fallback);
              return;
            }
          } catch {
            finish(fallback);
            return;
          }
          finish(response ?? fallback);
        });
      } catch {
        finish(fallback);
      }
    });
  }

  function networkCandidate(value) {
    if (!value || typeof value !== "object") return null;
    const amount = typeof value.amount === "number" ? value.amount : String(value.amount ?? "").slice(0, 160);
    const amountMinor = typeof value.amountMinor === "number"
      ? value.amountMinor
      : String(value.amountMinor ?? "").slice(0, 40);
    if ((amount === "" || amount === null) && (amountMinor === "" || amountMinor === null)) return null;
    return {
      eventId: String(value.eventId || "").slice(0, 320),
      name: String(value.name || "").slice(0, 160),
      amount,
      amountMinor,
      currency: String(value.currency || "").slice(0, 16),
      message: String(value.message || "").slice(0, 1000),
      time: typeof value.time === "number" ? value.time : String(value.time || "").slice(0, 160),
      occurrenceIndex: Math.max(1, Number(value.occurrenceIndex || 1)),
      rawText: String(value.rawText || "").slice(0, 3000)
    };
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.marker !== NETWORK_MARKER) return;
    const candidates = (Array.isArray(event.data.candidates) ? event.data.candidates : [])
      .slice(0, MAX_CANDIDATES)
      .map(networkCandidate)
      .filter(Boolean);
    safeRuntimeMessage({
      type: "NETWORK_CANDIDATES",
      providerId: resolvedProviderId,
      sourceUrl: String(event.data.sourceUrl || "").slice(0, 1800),
      method: String(event.data.method || "GET").slice(0, 12).toUpperCase(),
      candidates
    });
  });
  document.dispatchEvent(new CustomEvent("play-connect-network-ready"));

  function text(node, maximum = 1000) {
    return String(node?.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum);
  }

  function cookieValue(name) {
    const prefix = `${name}=`;
    const item = String(document.cookie || "")
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));
    if (!item) return "";
    try {
      return decodeURIComponent(item.slice(prefix.length));
    } catch {
      return item.slice(prefix.length);
    }
  }

  function byNoGameSessionToken() {
    const raw = cookieValue("auth");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return String(parsed?.token || parsed?.state?.token || "").trim();
    } catch {
      return "";
    }
  }

  function pick(root, selector, maximum) {
    if (!selector) return "";
    try {
      const node = root.querySelector(selector);
      return text(node, maximum);
    } catch {
      return "";
    }
  }

  function pickSemantic(root, selectors, maximum) {
    for (const selector of selectors) {
      try {
        const node = root.matches?.(selector) ? root : root.querySelector(selector);
        const value = text(node, maximum);
        if (value) return value;
      } catch {}
    }
    return "";
  }

  function leafTextParts(root) {
    const parts = [];
    const seen = new Set();
    const nodes = [...root.querySelectorAll("*")].filter(node => node.children.length === 0);
    if (!nodes.length) nodes.push(root);
    for (const node of nodes.slice(0, 180)) {
      const value = text(node, 700);
      const key = value.toLocaleLowerCase("tr");
      if (!value || seen.has(key) || /^https?:\/\//i.test(value)) continue;
      seen.add(key);
      parts.push(value);
    }
    return parts;
  }

  function inferAlertCopy(row, amountMatch) {
    const boilerplate = /^(?:test|donate|donation|bağış|destek|alert|şimdi|just now|az önce|anonymous|anonim)$/i;
    const timeLike = /^\d{1,2}[:.]\d{2}(?::\d{2})?$|^\d+\s*(?:saniye|dakika|saat|seconds?|minutes?|hours?)\b/i;
    const parts = leafTextParts(row).filter(value => !AMOUNT_PATTERN.test(value) && !boilerplate.test(value) && !timeLike.test(value));
    const name = parts.find(value => value.length <= 160) || "";
    const message = parts
      .filter(value => value !== name && value !== amountMatch)
      .sort((left, right) => right.length - left.length)[0] || "";
    return { name, message };
  }

  function genericRows() {
    const selectors = [
      "[data-donation-id]",
      "[data-transaction-id]",
      "[data-tip-id]",
      "[data-payment-id]",
      "[data-order-id]",
      "[data-alert-id]",
      ".donation",
      ".donate",
      ".tip",
      ".transaction",
      ".payment",
      "[class*='donation' i]",
      "[class*='donate' i]",
      "[class*='transaction' i]",
      "[class*='payment' i]",
      "[class*='support' i]",
      "[class*='alert' i]",
      "table tbody tr",
      "[role='row']",
      ".history-item",
      ".list-group-item"
    ];
    const nodes = [];
    for (const selector of selectors) {
      try {
        for (const node of document.querySelectorAll(selector)) {
          if (!nodes.includes(node)) nodes.push(node);
          if (nodes.length >= MAX_CANDIDATES) return nodes;
        }
      } catch {}
    }
    return nodes;
  }

  function firstJsonValue(object, keys) {
    for (const key of keys) {
      if (object?.[key] !== undefined && object?.[key] !== null && object[key] !== "") return object[key];
    }
    return "";
  }

  function jsonCandidate(object) {
    if (!object || typeof object !== "object" || Array.isArray(object)) return null;
    const amount = firstJsonValue(object, JSON_KEYS.amount);
    const amountMinor = firstJsonValue(object, JSON_KEYS.minorAmount);
    const eventId = firstJsonValue(object, JSON_KEYS.id);
    const name = firstJsonValue(object, JSON_KEYS.name);
    const message = firstJsonValue(object, JSON_KEYS.message);
    if ((amount === "" && amountMinor === "") || (!eventId && !name && !message)) return null;
    return {
      eventId: String(eventId || "").slice(0, 320),
      name: String(name || "").slice(0, 160),
      amount,
      amountMinor,
      currency: String(firstJsonValue(object, JSON_KEYS.currency) || "").slice(0, 16),
      message: String(message || "").slice(0, 1000),
      time: firstJsonValue(object, JSON_KEYS.time),
      rawText: JSON.stringify(object).slice(0, 3000)
    };
  }

  function candidatesFromJsonScripts() {
    const results = [];
    const scripts = [...document.querySelectorAll("script[type='application/json'],script#__NEXT_DATA__")].slice(0, 12);
    for (const script of scripts) {
      const raw = String(script.textContent || "");
      if (!raw || raw.length > MAX_JSON_SCRIPT_BYTES) continue;
      let payload;
      try { payload = JSON.parse(raw); } catch { continue; }
      const queue = [payload];
      const visited = new Set();
      while (queue.length && results.length < MAX_CANDIDATES) {
        const current = queue.shift();
        if (!current || typeof current !== "object" || visited.has(current)) continue;
        visited.add(current);
        const candidate = jsonCandidate(current);
        if (candidate) results.push(candidate);
        for (const value of Array.isArray(current) ? current : Object.values(current)) {
          if (value && typeof value === "object") queue.push(value);
        }
      }
      if (results.length >= MAX_CANDIDATES) break;
    }
    return results;
  }

  function candidatesFromRows(rows, config) {
    const selectors = config?.selectors || {};
    return rows.map((row, index) => {
      const rawText = text(row, 3000);
      if (!AMOUNT_PATTERN.test(rawText)) return null;
      const amountMatch = rawText.match(AMOUNT_PATTERN)?.[0] || "";
      const semanticName = pickSemantic(row, [
        "[data-donor-name]", "[data-supporter-name]", "[data-sender-name]", "[data-username]",
        "[class*='donor-name' i]", "[class*='supporter-name' i]", "[class*='sender-name' i]",
        "[class~='donor']", "[class~='nickname']", "[class~='username']", "[class~='sender']"
      ], 160);
      const semanticMessage = pickSemantic(row, [
        "[data-donation-message]", "[data-support-message]", "[data-message]",
        "[class*='donation-message' i]", "[class*='support-message' i]", "[class*='alert-message' i]",
        "[class~='message']", "[class~='comment']", "[class~='note']"
      ], 1000);
      const inferred = inferAlertCopy(row, amountMatch);
      return {
        eventId: pick(row, selectors.eventId, 320)
          || row.getAttribute("data-donation-id")
          || row.getAttribute("data-transaction-id")
          || row.getAttribute("data-tip-id")
          || row.getAttribute("data-payment-id")
          || row.getAttribute("data-order-id")
          || row.getAttribute("data-id")
          || "",
        name: pick(row, selectors.name, 160)
          || semanticName
          || pick(row, "[data-donor],.donor,.nickname,.username,.sender,.name", 160)
          || inferred.name,
        amount: pick(row, selectors.amount, 120)
          || pick(row, "[data-amount],.amount,.total,.value", 120)
          || amountMatch,
        currency: pick(row, selectors.currency, 12),
        message: pick(row, selectors.message, 1000)
          || semanticMessage
          || pick(row, "[data-message],.message,.comment,.note,.description", 1000)
          || inferred.message,
        time: pick(row, selectors.time, 100)
          || row.querySelector("time")?.getAttribute("datetime")
          || "",
        rawText,
        rowIndex: index
      };
    }).filter(Boolean);
  }

  function assignOccurrenceIndexes(candidates) {
    const counts = new Map();
    return candidates.map(candidate => {
      if (candidate.eventId) return { ...candidate, occurrenceIndex: 1 };
      const key = JSON.stringify([
        String(candidate.name || "").trim(),
        String(candidate.amount ?? candidate.amountMinor ?? "").trim(),
        String(candidate.currency || "").trim(),
        String(candidate.message || "").trim(),
        String(candidate.time || "").trim(),
        String(candidate.rawText || "").replace(/\s+/g, " ").trim()
      ]);
      const occurrenceIndex = Number(counts.get(key) || 0) + 1;
      counts.set(key, occurrenceIndex);
      return { ...candidate, occurrenceIndex };
    });
  }

  function visiblePasswordInput() {
    return [...document.querySelectorAll("input[type='password']")].some(input => {
      const style = getComputedStyle(input);
      const bounds = input.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
    });
  }

  function visibleAction(pattern) {
    return [...document.querySelectorAll("a,button,[role='button'],summary,input[type='submit']")].some(node => {
      const style = getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || bounds.width <= 0 || bounds.height <= 0) return false;
      const copy = normalizeActionText([
        node.textContent,
        node.getAttribute("value"),
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("href")
      ].filter(Boolean).join(" "));
      return pattern.test(copy);
    });
  }

  function existingAction(pattern) {
    return [...document.querySelectorAll("a,button,[role='button'],summary,input[type='submit'],form")].some(node => {
      const copy = normalizeActionText([
        node.textContent,
        node.getAttribute("value"),
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("href"),
        node.getAttribute("action")
      ].filter(Boolean).join(" "));
      return pattern.test(copy);
    });
  }

  function monitorUrlScore(provider, rawUrl, label = "") {
    try {
      const url = new URL(rawUrl, location.href);
      if (!/^https?:$/.test(url.protocol)) return -100;
      if (!(provider?.domains || []).some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return -100;
      const pathname = url.pathname.replace(/\/{2,}/g, "/");
      const evidence = decodeURIComponent(`${pathname} ${url.search} ${label}`);
      if (/login|signin|sign-in|giriş|giris|logout|signout|çıkış|cikis|help|yardım|yardim|contact|iletişim|iletisim|checkout|sepet|product|ürün|urun|pricing|search|(?:^|[/\s])ara(?:ma)?(?:[/\s?#]|$)/i.test(evidence)) return -100;
      const donateIntent = /donat|donation|bağış|bagis|tips?|supporters?|destekçiler|destekciler|contributions?|pledges?|sponsors?|alerts?/i.test(evidence);
      const ledgerIntent = /transactions?|payments?|ödemeler|odemeler|işlemler|islemler|history|geçmiş|gecmis|income|revenue|gelir|kazanç|kazanc|activity|events?|orders?|outgoing|incoming/i.test(evidence);
      const accountIntent = /api|graphql|dashboard|panel|account|hesab|manage|creator|streamer|member|wallet|balance/i.test(evidence) || /^api\./i.test(url.hostname);
      const publicLanding = /^\/(?:donate|donation|tips?|support)?\/?$/i.test(pathname);
      if ((!donateIntent && !ledgerIntent) || (publicLanding && !accountIntent && !ledgerIntent)) return -100;
      let score = 0;
      if (donateIntent) score += 18;
      if (ledgerIntent) score += 14;
      if (accountIntent) score += 12;
      if (/api|graphql/i.test(evidence) || /^api\./i.test(url.hostname)) score += 8;
      if (/outgoing|incoming|history|geçmiş|gecmis|transactions?|payments?|activity|events?/i.test(evidence)) score += 8;
      if ([...url.searchParams.keys()].some(key => /page|limit|sort|filter|cursor|offset/i.test(key))) score += 3;
      if (publicLanding) score -= 35;
      return score;
    } catch {
      return -100;
    }
  }

  function pageStatus(provider = null) {
    const path = `${location.pathname}${location.hash}`.toLowerCase();
    const loginPath = /(?:^|\/)(?:login|signin|sign-in|auth|giris|giriş|oturum)(?:\/|$|\?|#)/i.test(path);
    const passwordLogin = visiblePasswordInput();
    const visibleLogin = visibleAction(/(?:^|\b)(giriş|giris|üye girişi|oturum aç|sign in|log in|login)(?:\b|$)/i);
    const visibleLogout = visibleAction(/(?:^|\b)(çıkış|cikis|oturumu kapat|hesaptan çık|sign out|log out|logout)(?:\b|$)/i);
    const existingLogout = existingAction(/(?:^|\b)(çıkış|cikis|oturumu kapat|hesaptan çık|sign out|log out|logout)(?:\b|$)/i);
    const strongLoginRequired = loginPath || passwordLogin;
    let authenticated = null;
    let loginRequired = strongLoginRequired;
    if (provider?.id === "githubsponsors") {
      const githubLogin = String(
        document.querySelector('meta[name="user-login"]')?.getAttribute("content")
        || document.querySelector('meta[name="octolytics-actor-login"]')?.getAttribute("content")
        || ""
      ).trim();
      const githubAccountMenu = Boolean(document.querySelector(
        '[aria-label*="profile and more" i],[data-login]:not([data-login=""]),meta[name="user-login"][content]:not([content=""])'
      ));
      authenticated = Boolean(githubLogin || githubAccountMenu);
      loginRequired = loginRequired || !authenticated;
    } else if (strongLoginRequired) {
      authenticated = false;
      loginRequired = true;
    } else if (visibleLogout || existingLogout) {
      authenticated = true;
      loginRequired = false;
    } else if (visibleLogin) {
      authenticated = false;
      loginRequired = true;
    }
    const historyLike = provider
      ? monitorUrlScore(provider, location.href, document.title) >= 22
      : /donat|donation|tip|support|payment|transaction|history|gecmis|geçmiş|destek|bagis|bağış|income|revenue|alert/i.test(path);
    const accountLike = historyLike || /dashboard|panel|account|profile|manage|creator|streamer|member/i.test(path);
    return { loginRequired, strongLoginRequired, historyLike, accountLike, authenticated };
  }

  function discoverMonitorUrl(provider) {
    const candidates = [];
    const addCandidate = (rawUrl, label, baseScore = 0) => {
      try {
        const url = new URL(rawUrl, location.href);
        let score = monitorUrlScore(provider, url.href, label);
        if (score < 22) return;
        score += baseScore;
        if (url.href === location.href) score += 2;
        candidates.push({ url: url.href, confidence: score });
      } catch {}
    };
    addCandidate(location.href, document.title, 1);
    for (const anchor of [...document.querySelectorAll("a[href]")].slice(0, 500)) {
      addCandidate(anchor.href, `${text(anchor, 240)} ${anchor.getAttribute("aria-label") || ""}`, 0);
    }
    return candidates.sort((left, right) => right.confidence - left.confidence)[0] || null;
  }

  function normalizeActionText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
  }

  function openRequestedLoginUi() {
    if (loginUiRequested) return;
    const url = new URL(location.href);
    if (url.searchParams.get("ps_open_login") !== "1") return;
    if (pageStatus().loginRequired) {
      loginUiRequested = true;
      url.searchParams.delete("ps_open_login");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      return;
    }
    const candidates = [...document.querySelectorAll([
      "a[href*='login' i]",
      "a[href*='signin' i]",
      "a[href*='sign-in' i]",
      "a[href*='giris' i]",
      "a[href*='oturum' i]",
      "a[href*='account/login' i]",
      "a[href*='uye-girisi' i]",
      "button",
      "[role='button']",
      "input[type='submit']"
    ].join(","))].filter(node => {
      const style = getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || bounds.width <= 0 || bounds.height <= 0) return false;
      const copy = normalizeActionText([
        node.textContent,
        node.getAttribute("value"),
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("href")
      ].filter(Boolean).join(" "));
      return /(?:^|\b)(giriş|giris|üye girişi|oturum aç|hesabına giriş|sign in|log in|login)(?:\b|$)/i.test(copy);
    });
    if (candidates[0]) {
      const loginAction = candidates[0];
      const directHref = loginAction.closest("a[href]")?.href
        || (loginAction.matches("a[href]") ? loginAction.href : "");
      loginUiRequested = true;
      url.searchParams.delete("ps_open_login");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      if (/^https?:\/\//i.test(String(directHref || "")) && directHref !== location.href) {
        location.assign(directHref);
      } else {
        loginAction.click();
      }
    }
  }

  function openRequestedLogoutUi() {
    if (logoutUiRequested) return;
    const url = new URL(location.href);
    if (url.searchParams.get("ps_open_logout") !== "1") return;
    const logoutPattern = /(?:^|\b)(çıkış|cikis|oturumu kapat|hesaptan çık|sign out|log out|logout)(?:\b|$)/i;
    const candidates = [...document.querySelectorAll([
      "a[href*='logout' i]",
      "a[href*='signout' i]",
      "a[href*='sign-out' i]",
      "a[href*='cikis' i]",
      "form[action*='logout' i] button",
      "form[action*='logout' i] input[type='submit']",
      "button",
      "[role='button']"
    ].join(","))].filter(node => {
      const style = getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || bounds.width <= 0 || bounds.height <= 0) return false;
      const copy = normalizeActionText([
        node.textContent,
        node.getAttribute("value"),
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("href"),
        node.closest("form")?.getAttribute("action")
      ].filter(Boolean).join(" "));
      return logoutPattern.test(copy);
    });
    if (candidates[0]) {
      logoutUiRequested = true;
      url.searchParams.delete("ps_open_logout");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      candidates[0].click();
      return;
    }
    if (!accountMenuRequested) {
      const accountMenu = document.querySelector([
        '[aria-label*="account" i]',
        '[aria-label*="profile" i]',
        '[aria-label*="hesap" i]',
        '[aria-label*="profil" i]',
        '[data-testid*="account" i]',
        '[data-testid*="profile" i]'
      ].join(","));
      if (accountMenu) {
        accountMenuRequested = true;
        accountMenu.click();
        window.setTimeout(() => {
          accountMenuRequested = false;
          schedule();
        }, 450);
      }
    }
  }

  async function scan() {
    if (!extensionContextAvailable()) return { skipped: true, reason: "extension-context-invalidated" };
    const response = await safeRuntimeMessage({ type: "GET_STATE" });
    if (!response?.ok) return;
    const state = response.result;
    const context = await safeRuntimeMessage({ type: "RESOLVE_PAGE_PROVIDER", providerId: resolvedProviderId }, {});
    resolvedProviderId = String(context?.providerId || resolvedProviderId || "");
    const provider = state.providerCatalog?.find(item => item.id === resolvedProviderId)
      || state.providerCatalog?.find(item => (
      item.domains || []
    ).some(domain => location.hostname === domain || location.hostname.endsWith(`.${domain}`)));
    if (!provider) return;
    const config = state.providers?.[provider.id];
    const byNoGameToken = provider.id === "bynogame" ? byNoGameSessionToken() : "";
    if (byNoGameToken) {
      if (byNoGameToken !== lastByNoGameToken) {
        lastByNoGameToken = byNoGameToken;
        await safeRuntimeMessage({
          type: "PAGE_SESSION_TOKEN",
          providerId: provider.id,
          token: byNoGameToken
        });
      }
    }
    const status = pageStatus(provider);
    if (byNoGameToken) {
      status.authenticated = true;
      status.loginRequired = false;
    }
    const statusFingerprint = `${provider.id}:${location.href}:${status.loginRequired}:${status.strongLoginRequired}:${status.historyLike}:${status.accountLike}:${status.authenticated}`;
    if (statusFingerprint !== lastStatusFingerprint || Date.now() - lastStatusSentAt >= 5_000) {
      lastStatusFingerprint = statusFingerprint;
      lastStatusSentAt = Date.now();
      const statusResponse = await safeRuntimeMessage({
        type: "PAGE_STATUS",
        providerId: provider.id,
        ...status
      });
      if (statusResponse?.ok === false && !statusResponse?.ignored) {
        throw new Error(statusResponse?.error || "Platform oturumu doğrulanamadı.");
      }
      if (statusResponse?.loginStatus) config.loginStatus = statusResponse.loginStatus;
    }
    if (!config?.enabled || provider.integration !== "session") return;
    if (ALERT_FRAME) {
      let alertRows = genericRows();
      if (!alertRows.length && AMOUNT_PATTERN.test(text(document.body, 3000))) {
        alertRows = [document.body];
      }
      const alertCandidates = assignOccurrenceIndexes(
        [...candidatesFromRows(alertRows, config), ...candidatesFromJsonScripts()]
          .slice(0, MAX_CANDIDATES)
      );
      if (!alertCandidates.length) {
        alertDomSnapshotSent = false;
        alertLifecycleFingerprint = "";
        alertLifecycleAt = 0;
        lastFingerprint = "";
        return { providerId: provider.id, candidateCount: 0, alertDom: true, loginStatus: config.loginStatus };
      }
      const lifecycleFingerprint = `${alertLifecycleSignal}\u001d${alertCandidates
        .map(item => [item.eventId || "", item.name || "", item.amount || item.amountMinor || "", item.currency || "", item.message || "", item.rawText || ""].join("\u001f"))
        .join("\u001e")
        .slice(0, 12000)}`;
      if (lifecycleFingerprint !== alertLifecycleFingerprint || !alertLifecycleAt) {
        alertLifecycleFingerprint = lifecycleFingerprint;
        alertLifecycleAt = Date.now();
      }
      for (const item of alertCandidates) {
        const suppliedTime = item.time;
        const hasAbsoluteTime = typeof suppliedTime === "number"
          || Number.isFinite(Date.parse(String(suppliedTime || "")));
        if (!hasAbsoluteTime) item.time = alertLifecycleAt;
      }
      const alertFingerprint = alertCandidates
        .map(item => `${item.eventId || item.rawText}:${item.time || ""}`)
        .join("\u001e")
        .slice(0, 12000);
      if (alertDomSnapshotSent && alertFingerprint === lastFingerprint) {
        return {
          providerId: provider.id,
          candidateCount: alertCandidates.length,
          duplicateAlertFrame: true,
          loginStatus: config.loginStatus
        };
      }
      lastFingerprint = alertFingerprint;
      alertDomSnapshotSent = true;
      const alertResponse = await safeRuntimeMessage({
        type: "PAGE_CANDIDATES",
        providerId: provider.id,
        candidates: alertCandidates
      });
      if (!alertResponse) throw new Error("Eklenti arka plan servisine ulaşılamadı.");
      if (alertResponse.ok === false && !alertResponse.ignored) {
        throw new Error(alertResponse.error || "OBS alert kartı teslim kuyruğuna alınamadı.");
      }
      return {
        providerId: provider.id,
        candidateCount: alertCandidates.length,
        accepted: Number(alertResponse.accepted || 0),
        alertDom: true,
        loginStatus: config.loginStatus
      };
    }
    // Donate data is accepted only from authenticated JSON/network feeds.
    // Manual page discovery, CSS selectors and DOM card scraping are disabled.
    return {
      providerId: provider.id,
      candidateCount: 0,
      automaticNetworkOnly: true,
      loginStatus: config.loginStatus
    };
    if (config.loginStatus === "observed" && !status.loginRequired && !byNoGameToken) {
      const discovered = discoverMonitorUrl(provider);
      const discoveryFingerprint = discovered ? `${provider.id}:${discovered.url}` : "";
      if (discovered && discoveryFingerprint !== lastMonitorDiscoveryFingerprint) {
        lastMonitorDiscoveryFingerprint = discoveryFingerprint;
        const discoveryResponse = await safeRuntimeMessage({
          type: "PAGE_MONITOR_DISCOVERY",
          providerId: provider.id,
          url: discovered.url,
          confidence: discovered.confidence
        });
        if (discoveryResponse?.ok === false && !discoveryResponse?.ignored) {
          throw new Error(discoveryResponse?.error || "Donate izleme sayfası otomatik ayarlanamadı.");
        }
      }
    }
    // Landing pages may show example amounts and fake donor cards. Capture is
    // allowed only on a trusted account/history/data page. ByNoGame's direct
    // authenticated endpoint is authoritative when its token is available.
    const currentMonitorScore = monitorUrlScore(provider, location.href, document.title);
    if (byNoGameToken || currentMonitorScore < 22) {
      return { providerId: provider.id, candidateCount: 0, ignoredLandingPage: true, loginStatus: config.loginStatus };
    }
    let rows = [];
    if (config.selectors?.item) {
      try {
        rows = [...document.querySelectorAll(config.selectors.item)].slice(0, MAX_CANDIDATES);
      } catch {
        throw new Error("Kaydedilen donate satırı seçicisi artık bu sayfada geçerli değil.");
      }
    }
    if (!rows.length) rows = genericRows();
    const candidates = assignOccurrenceIndexes(
      [...candidatesFromRows(rows, config), ...candidatesFromJsonScripts()]
        .slice(0, MAX_CANDIDATES)
    );
    if (!candidates.length) return { providerId: provider.id, candidateCount: 0, loginStatus: config.loginStatus };
    const fingerprint = candidates.map(item => item.eventId || item.rawText).join("\u001e").slice(0, 12000);
    if (fingerprint === lastFingerprint) {
      return { providerId: provider.id, candidateCount: candidates.length, duplicatePage: true, loginStatus: config.loginStatus };
    }
    lastFingerprint = fingerprint;
    const candidateResponse = await safeRuntimeMessage({
      type: "PAGE_CANDIDATES",
      providerId: provider.id,
      candidates
    });
    if (!candidateResponse) throw new Error("Eklenti arka plan servisine ulaşılamadı.");
    if (candidateResponse.ok === false && !candidateResponse.ignored) {
      throw new Error(candidateResponse.error || "Donate adayları teslim kuyruğuna alınamadı.");
    }
    return {
      providerId: provider.id,
      candidateCount: candidates.length,
      accepted: Number(candidateResponse.accepted || 0),
      loginStatus: config.loginStatus
    };
  }

  function reportCaptureError(error) {
    const message = String(error?.message || "Sayfa algılama sırasında bilinmeyen bir hata oluştu.").slice(0, 240);
    if (!extensionContextAvailable() || /extension context invalidated/i.test(message)) return;
    const fingerprint = `${location.href}:${message}`;
    if (fingerprint === lastErrorFingerprint) return;
    lastErrorFingerprint = fingerprint;
    safeRuntimeMessage({
      type: "CAPTURE_DIAGNOSTIC",
      level: "error",
      source: "content-scanner",
      message
    });
  }

  function schedule() {
    clearTimeout(timer);
    if (!extensionContextAvailable()) return;
    timer = setTimeout(() => {
      openRequestedLoginUi();
      openRequestedLogoutUi();
      scan().catch(reportCaptureError);
    }, 120);
  }

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "PLAY_CONNECT_SCAN_NOW") return false;
    scan()
      .then(result => sendResponse({ ok: true, ...(result || {}) }))
      .catch(error => {
        reportCaptureError(error);
        sendResponse({ ok: false, error: String(error?.message || "Sayfa taranamadı.") });
      });
    return true;
  });

  window.setTimeout(openRequestedLoginUi, 350);
  window.setTimeout(openRequestedLoginUi, 1200);
  schedule();
  const observer = new MutationObserver(mutations => {
    if (ALERT_FRAME) {
      const meaningful = mutations.some(mutation => {
        if (mutation.type === "childList") {
          const copy = [text(mutation.target, 2200), ...[...mutation.addedNodes].map(node => text(node, 1200))].join(" ");
          return AMOUNT_PATTERN.test(copy);
        }
        if (mutation.type === "characterData") return AMOUNT_PATTERN.test(text(mutation.target?.parentElement, 1800));
        return false;
      });
      const now = Date.now();
      if (meaningful && now - lastAlertMutationSignalAt > 900) {
        lastAlertMutationSignalAt = now;
        alertLifecycleSignal += 1;
        alertLifecycleAt = 0;
        alertDomSnapshotSent = false;
      }
    }
    schedule();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "data-state", "data-status", "aria-live"]
  });
  window.addEventListener("pageshow", schedule);
  window.setInterval(schedule, 500);
})();
