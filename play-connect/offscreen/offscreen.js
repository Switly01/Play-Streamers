(() => {
  "use strict";
  const MAX_HTML_BYTES = 4_000_000;
  const MAX_CANDIDATES = 150;
  const alertFrames = new Map();
  const alertSettleTimers = new Map();
  const ALERT_SETTLE_MS = 1_000;
  const AMOUNT_PATTERN = /(?:₺|TL|TRY|\$|USD|€|EUR|£|GBP)\s*[\d.,]+|[\d.,]+\s*(?:₺|TL|TRY|\$|USD|€|EUR|£|GBP)/i;
  const JSON_KEYS = {
    id: ["eventId", "event_id", "donationId", "donation_id", "transactionId", "transaction_id", "paymentId", "payment_id", "orderId", "order_id", "orderRowId", "opId", "tipId", "tip_id", "supportId", "support_id", "chargeId", "charge_id", "referenceId", "reference_id", "uuid", "_id", "id"],
    name: ["donorName", "donor_name", "supporterName", "supporter_name", "payerName", "payer_name", "customerName", "customer_name", "displayName", "display_name", "nickName", "nickname", "username", "sender", "from", "name"],
    amount: ["amount", "donationAmount", "donation_amount", "supportAmount", "support_amount", "tipAmount", "tip_amount", "amountFormatted", "amount_formatted", "total", "gross", "value"],
    minorAmount: ["amountMinor", "amount_minor", "amountCents", "amount_cents", "grossCents", "gross_cents", "totalCents", "total_cents", "valueCents", "value_cents"],
    currency: ["currency", "currencyCode", "currency_code", "currencyIso", "currency_iso"],
    message: ["message", "comment", "note", "description", "supportMessage", "support_message", "donationMessage", "donation_message"],
    time: ["createdAt", "created_at", "paidAt", "paid_at", "completedAt", "completed_at", "timestamp", "eventAt", "event_at", "date", "time"]
  };

  function compact(value, maximum = 1000) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
  }

  function query(root, selector) {
    if (!selector) return null;
    try { return root.querySelector(selector); } catch { return null; }
  }

  function queryText(root, selector, maximum) {
    return compact(query(root, selector)?.textContent, maximum);
  }

  function loginRequired(document, pageUrl) {
    const title = compact(document.title, 160).toLowerCase();
    const body = compact(document.body?.textContent, 5000).toLowerCase();
    const path = new URL(pageUrl).pathname.toLowerCase();
    return /(?:giriş yap|oturum aç|sign in|log in|login)/i.test(`${title} ${body.slice(0, 800)}`)
      && /(?:login|giris|signin|auth)/i.test(path);
  }

  function genericRows(document) {
    const selectors = [
      "[data-donation-id]",
      "[data-transaction-id]",
      "[data-tip-id]",
      "[data-payment-id]",
      "[data-order-id]",
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
      "table tbody tr",
      "[role='row']",
      ".history-item",
      ".list-group-item"
    ];
    const rows = [];
    for (const selector of selectors) {
      try {
        for (const node of document.querySelectorAll(selector)) {
          if (!rows.includes(node)) rows.push(node);
          if (rows.length >= MAX_CANDIDATES) return rows;
        }
      } catch {}
    }
    return rows;
  }

  function firstJsonValue(object, keys) {
    for (const key of keys) {
      if (object?.[key] !== undefined && object?.[key] !== null && object[key] !== "") return object[key];
    }
    return "";
  }

  function candidatesFromJsonScripts(document) {
    const results = [];
    const scripts = [...document.querySelectorAll("script[type='application/json'],script#__NEXT_DATA__")].slice(0, 12);
    for (const script of scripts) {
      const raw = String(script.textContent || "");
      if (!raw || raw.length > 1_000_000) continue;
      let payload;
      try { payload = JSON.parse(raw); } catch { continue; }
      const queue = [payload];
      const visited = new Set();
      while (queue.length && results.length < MAX_CANDIDATES) {
        const current = queue.shift();
        if (!current || typeof current !== "object" || visited.has(current)) continue;
        visited.add(current);
        if (!Array.isArray(current)) {
          const amount = firstJsonValue(current, JSON_KEYS.amount);
          const amountMinor = firstJsonValue(current, JSON_KEYS.minorAmount);
          const eventId = firstJsonValue(current, JSON_KEYS.id);
          const name = firstJsonValue(current, JSON_KEYS.name);
          const message = firstJsonValue(current, JSON_KEYS.message);
          if ((amount !== "" || amountMinor !== "") && (eventId || name || message)) {
            results.push({
              eventId: compact(eventId, 320),
              name: compact(name, 160),
              amount,
              amountMinor,
              currency: compact(firstJsonValue(current, JSON_KEYS.currency), 16),
              message: compact(message, 1000),
              time: firstJsonValue(current, JSON_KEYS.time),
              rawText: compact(JSON.stringify(current), 3000)
            });
          }
        }
        for (const value of Array.isArray(current) ? current : Object.values(current)) {
          if (value && typeof value === "object") queue.push(value);
        }
      }
      if (results.length >= MAX_CANDIDATES) break;
    }
    return results;
  }

  function candidates(document, selectors) {
    let rows = [];
    if (selectors?.item) {
      try { rows = [...document.querySelectorAll(selectors.item)].slice(0, MAX_CANDIDATES); } catch {}
    }
    if (!rows.length) rows = genericRows(document);
    const rowCandidates = rows.map((row, index) => {
      const rawText = compact(row.textContent, 3000);
      const amountMatch = rawText.match(AMOUNT_PATTERN)?.[0] || "";
      if (!amountMatch) return null;
      return {
        eventId: queryText(row, selectors?.eventId, 320)
          || row.getAttribute("data-donation-id")
          || row.getAttribute("data-transaction-id")
          || row.getAttribute("data-tip-id")
          || row.getAttribute("data-payment-id")
          || row.getAttribute("data-order-id")
          || row.getAttribute("data-id")
          || "",
        name: queryText(row, selectors?.name, 160)
          || queryText(row, "[data-donor],.donor,.nickname,.username,.sender,.name", 160),
        amount: queryText(row, selectors?.amount, 120)
          || queryText(row, "[data-amount],.amount,.total,.value", 120)
          || amountMatch,
        currency: queryText(row, selectors?.currency, 12),
        message: queryText(row, selectors?.message, 1000)
          || queryText(row, "[data-message],.message,.comment,.note,.description", 1000),
        time: queryText(row, selectors?.time, 100)
          || query(row, "time")?.getAttribute("datetime")
          || "",
        rawText,
        rowIndex: index
      };
    }).filter(Boolean);
    return [...rowCandidates, ...candidatesFromJsonScripts(document)].slice(0, MAX_CANDIDATES);
  }

  function reportAlertFrame(providerId, status, detail = "") {
    chrome.runtime.sendMessage({
      type: "ALERT_FRAME_STATUS",
      providerId,
      status,
      detail: compact(detail, 180)
    }).catch(() => {});
  }

  function syncAlertFrames(sources) {
    const requested = new Map((Array.isArray(sources) ? sources : [])
      .filter(item => item?.providerId && item?.url)
      .map(item => [String(item.providerId), String(item.url)]));
    for (const [providerId, frame] of alertFrames) {
      if (requested.get(providerId) === frame.dataset.sourceUrl) continue;
      clearTimeout(alertSettleTimers.get(providerId));
      alertSettleTimers.delete(providerId);
      frame.remove();
      alertFrames.delete(providerId);
    }
    for (const [providerId, url] of requested) {
      if (alertFrames.has(providerId)) continue;
      const frame = document.createElement("iframe");
      frame.title = `${providerId} OBS alert bağlantısı`;
      frame.dataset.providerId = providerId;
      frame.dataset.sourceUrl = url;
      frame.name = `play-connect-alert:${providerId}`;
      frame.referrerPolicy = "no-referrer";
      frame.allow = "autoplay 'none'";
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none";
      frame.addEventListener("load", () => {
        reportAlertFrame(providerId, "active");
        clearTimeout(alertSettleTimers.get(providerId));
        alertSettleTimers.set(providerId, setTimeout(() => {
          reportAlertFrame(providerId, "settled");
          alertSettleTimers.delete(providerId);
        }, ALERT_SETTLE_MS));
      });
      frame.addEventListener("error", () => reportAlertFrame(providerId, "error", "OBS bağlantısı arka planda yüklenemedi."));
      frame.src = url;
      alertFrames.set(providerId, frame);
      reportAlertFrame(providerId, "loading");
      document.querySelector("#alertFrames").append(frame);
    }
    return { ok: true, active: alertFrames.size };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.target !== "offscreen") return false;
    if (message?.type === "SYNC_ALERT_SOURCES") {
      try {
        sendResponse(syncAlertFrames(message.sources));
      } catch (error) {
        sendResponse({ ok: false, error: String(error?.message || "OBS bağlantıları başlatılamadı.") });
      }
      return true;
    }
    if (message?.type !== "PARSE_DONATE_HTML") return false;
    try {
      const html = String(message.html || "");
      if (!html || html.length > MAX_HTML_BYTES) throw new Error("Platform yanıtı boş veya çok büyük.");
      const document = new DOMParser().parseFromString(html, "text/html");
      sendResponse({
        ok: true,
        loginRequired: loginRequired(document, message.pageUrl),
        candidates: candidates(document, message.selectors || {})
      });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || "Sayfa ayrıştırılamadı.") });
    }
    return true;
  });
})();
