(() => {
  "use strict";

  const MARKER = "PLAY_CONNECT_DONATE_NETWORK_V1";
  const MAX_CANDIDATES = 40;
  const MAX_VISITED = 500;
  const MAX_RESPONSE_BYTES = 1_500_000;
  const recentBatches = [];
  const ID_KEYS = [
    "eventId", "event_id", "eventUuid", "event_uuid", "donationId", "donation_id",
    "donateId", "donate_id", "transactionId", "transaction_id", "operationId",
    "operation_id", "paymentId", "payment_id", "orderId", "order_id",
    "orderRowId", "opId", "tipId", "tip_id", "supportId", "support_id",
    "chargeId", "charge_id", "referenceId", "reference_id", "receiptId", "receipt_id",
    "invoiceId", "invoice_id", "alertId", "alert_id", "uuid", "_id", "id"
  ];
  const NAME_KEYS = [
    "donorName", "donor_name", "supporterName", "supporter_name", "payerName",
    "payer_name", "customerName", "customer_name", "displayName", "display_name",
    "nickName", "nickname", "username", "sender", "from", "name"
  ];
  const AMOUNT_KEYS = [
    "amount", "donationAmount", "donation_amount", "supportAmount", "support_amount",
    "tipAmount", "tip_amount", "amountFormatted", "amount_formatted", "gross",
    "total", "value"
  ];
  const MINOR_AMOUNT_KEYS = [
    "amountMinor", "amount_minor", "amountCents", "amount_cents", "grossCents",
    "gross_cents", "totalCents", "total_cents", "valueCents", "value_cents"
  ];
  const CURRENCY_KEYS = ["currency", "currencyCode", "currency_code", "currencyIso", "currency_iso"];
  const MESSAGE_KEYS = [
    "message", "comment", "note", "description", "supportMessage",
    "support_message", "donationMessage", "donation_message"
  ];
  const TIME_KEYS = [
    "createdAt", "created_at", "createdDate", "created_date", "dateCreated", "date_created",
    "donationDate", "donation_date", "transactionDate", "transaction_date",
    "paidAt", "paid_at", "completedAt", "completed_at",
    "timestamp", "eventAt", "event_at", "date", "time"
  ];
  const URL_STRONG_INTENT = /donat|donation|tips?|supporters?|contribution|pledge|sponsor|alert/i;
  const URL_LEDGER_INTENT = /payment|transaction|income|revenue|activity|history|orders?|outgoing|incoming/i;
  const TYPE_INTENT = /donat|donation|tip|support|contribution|gift|pledge|sponsor/i;
  const OBJECT_INTENT = /donat|donation|tip|support|contribution|pledge|sponsor/i;
  const REJECTED_STATUS = /cancel|canceled|cancelled|refund|refunded|fail|failed|declin|rejected|void|expired/i;
  const ALERT_FRAME = /^play-connect-alert:[a-z0-9_-]+$/i.test(String(window.name || ""));

  function silenceAlertFrameAudio() {
    if (!ALERT_FRAME) return;
    const silenceMedia = media => {
      if (!(media instanceof HTMLMediaElement)) return;
      try {
        media.muted = true;
        media.defaultMuted = true;
        media.volume = 0;
      } catch {}
    };
    const mediaPrototype = window.HTMLMediaElement?.prototype;
    if (mediaPrototype && typeof mediaPrototype.play === "function") {
      const nativePlay = mediaPrototype.play;
      mediaPrototype.play = function playConnectSilentPlay(...args) {
        silenceMedia(this);
        return nativePlay.apply(this, args);
      };
    }
    document.addEventListener("play", event => silenceMedia(event.target), true);
    document.addEventListener("volumechange", event => silenceMedia(event.target), true);
    try {
      const speech = window.speechSynthesis;
      if (speech) {
        speech.cancel();
        speech.speak = () => undefined;
        speech.resume = () => undefined;
      }
    } catch {}
    for (const key of ["AudioContext", "webkitAudioContext"]) {
      const NativeAudioContext = window[key];
      if (typeof NativeAudioContext !== "function" || NativeAudioContext.__playConnectSilent) continue;
      try {
        const SilentAudioContext = function playConnectSilentAudioContext(...args) {
          const context = Reflect.construct(NativeAudioContext, args, new.target || NativeAudioContext);
          try {
            Object.defineProperty(context, "resume", {
              configurable: true,
              value: async () => {
                await context.suspend().catch(() => undefined);
              }
            });
            context.suspend().catch(() => {});
          } catch {}
          return context;
        };
        SilentAudioContext.prototype = NativeAudioContext.prototype;
        Object.setPrototypeOf(SilentAudioContext, NativeAudioContext);
        Object.defineProperty(SilentAudioContext, "__playConnectSilent", { value: true });
        window[key] = SilentAudioContext;
      } catch {}
    }
  }

  silenceAlertFrameAudio();

  function firstValue(object, keys) {
    for (const key of keys) {
      if (object?.[key] !== undefined && object?.[key] !== null && object[key] !== "") {
        return object[key];
      }
    }
    return "";
  }

  function compact(value, maximum = 1000) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
  }

  function urlIntentText(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), location.href);
      return `${url.pathname} ${url.search}`;
    } catch {
      return "";
    }
  }

  function candidateFromObject(object, responseUrl) {
    if (!object || typeof object !== "object" || Array.isArray(object)) return null;
    const semanticType = compact(
      firstValue(object, ["type", "eventType", "event_type", "kind", "category", "resourceType", "resource_type"]),
      120
    );
    const objectKeys = Object.keys(object).slice(0, 80).join(" ");
    const strongObjectIntent = TYPE_INTENT.test(semanticType) || OBJECT_INTENT.test(objectKeys);
    const urlIntent = urlIntentText(responseUrl);
    const alertPayloadIntent = ALERT_FRAME
      && (strongObjectIntent || /donor|supporter|tip|currency|message|comment|amount/i.test(objectKeys));
    if (!URL_STRONG_INTENT.test(urlIntent)
      && !(URL_LEDGER_INTENT.test(urlIntent) && strongObjectIntent)
      && !alertPayloadIntent) return null;
    const status = compact(firstValue(object, ["status", "state", "paymentStatus", "payment_status", "eventStatus", "event_status"]), 80);
    if (status && REJECTED_STATUS.test(status)) return null;
    const directAmount = firstValue(object, AMOUNT_KEYS);
    const minorAmount = firstValue(object, MINOR_AMOUNT_KEYS);
    if (directAmount === "" && minorAmount === "") return null;
    const eventId = firstValue(object, ID_KEYS);
    const name = firstValue(object, NAME_KEYS);
    const message = firstValue(object, MESSAGE_KEYS);
    if (!eventId && !name && !message) return null;
    const candidate = {
      eventId: compact(eventId, 320),
      name: compact(name, 160),
      amount: directAmount,
      amountMinor: minorAmount,
      currency: compact(firstValue(object, CURRENCY_KEYS), 16),
      message: compact(message, 1000),
      time: firstValue(object, TIME_KEYS),
      rawText: ""
    };
    candidate.rawText = compact(JSON.stringify({
      eventId: candidate.eventId,
      name: candidate.name,
      amount: candidate.amount,
      amountMinor: candidate.amountMinor,
      currency: candidate.currency,
      message: candidate.message,
      time: candidate.time,
      type: semanticType
    }), 3000);
    return candidate;
  }

  function candidatesFromPayload(payload, responseUrl) {
    const results = [];
    const queue = [payload];
    const visited = new Set();
    while (queue.length && results.length < MAX_CANDIDATES && visited.size < MAX_VISITED) {
      const current = queue.shift();
      if (!current || typeof current !== "object" || visited.has(current)) continue;
      visited.add(current);
      const candidate = candidateFromObject(current, responseUrl);
      if (candidate) results.push(candidate);
      const values = Array.isArray(current) ? current : Object.values(current);
      for (const value of values) {
        if (value && typeof value === "object") queue.push(value);
      }
    }
    return results;
  }

  function assignOccurrenceIndexes(candidates) {
    const counts = new Map();
    return candidates.map(candidate => {
      if (candidate.eventId) return { ...candidate, occurrenceIndex: 1 };
      const key = JSON.stringify([
        candidate.name,
        candidate.amount,
        candidate.amountMinor,
        candidate.currency,
        candidate.message,
        candidate.time,
        candidate.rawText
      ]);
      const occurrenceIndex = Number(counts.get(key) || 0) + 1;
      counts.set(key, occurrenceIndex);
      return { ...candidate, occurrenceIndex };
    });
  }

  function uniqueCandidates(candidates) {
    const seen = new Set();
    return candidates.filter(candidate => {
      const key = candidate.eventId
        ? `id:${candidate.eventId}`
        : `body:${JSON.stringify([candidate.name, candidate.amount, candidate.amountMinor, candidate.currency, candidate.message, candidate.time])}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function emit(payload, responseUrl, method = "GET") {
    const candidates = assignOccurrenceIndexes(uniqueCandidates(candidatesFromPayload(payload, responseUrl)));
    // An empty donation response is meaningful: it establishes that monitoring
    // started with no historical records. Without this signal, the first real
    // donation would be mistaken for the initial history snapshot.
    if (!candidates.length && !URL_STRONG_INTENT.test(urlIntentText(responseUrl))) return;
    const batch = {
      marker: MARKER,
      sourceUrl: compact(responseUrl, 1800),
      method: compact(method, 12).toUpperCase() || "GET",
      candidates
    };
    recentBatches.push(batch);
    if (recentBatches.length > 6) recentBatches.shift();
    window.postMessage(batch, location.origin);
  }

  async function inspectFetchResponse(response, method) {
    if (!response?.ok) return;
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
    if (!contentType.includes("json")) return;
    const length = Number(response.headers?.get?.("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) return;
    try {
      emit(await response.clone().json(), response.url || location.href, method);
    } catch {}
  }

  async function inspectLiveMessage(data, responseUrl, method) {
    let raw = data;
    try {
      if (raw instanceof Blob) raw = await raw.text();
      if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(raw);
      if (ArrayBuffer.isView(raw)) raw = new TextDecoder().decode(raw);
      if (typeof raw !== "string" || raw.length > MAX_RESPONSE_BYTES) return;
      const text = raw.trim();
      if (!text || (text[0] !== "{" && text[0] !== "[")) return;
      emit(JSON.parse(text), responseUrl, method);
    } catch {}
  }

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = async function playConnectFetch(...args) {
      const response = await nativeFetch.apply(this, args);
      const method = String(args[1]?.method || "GET").toUpperCase();
      inspectFetchResponse(response, method).catch(() => {});
      return response;
    };
  }

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function playConnectOpen(method, url, ...rest) {
    this.__playConnectMethod = String(method || "GET").toUpperCase();
    this.__playConnectUrl = String(url || "");
    return nativeOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function playConnectSend(...args) {
    this.addEventListener("load", () => {
      if (this.status < 200 || this.status >= 300) return;
      const contentType = String(this.getResponseHeader("content-type") || "").toLowerCase();
      if (!contentType.includes("json") && this.responseType !== "json") return;
      try {
        const payload = this.responseType === "json" ? this.response : JSON.parse(String(this.responseText || ""));
        emit(payload, this.responseURL || this.__playConnectUrl || location.href, this.__playConnectMethod || "GET");
      } catch {}
    }, { once: true });
    return nativeSend.apply(this, args);
  };

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket === "function") {
    function PlayConnectWebSocket(url, protocols) {
      const socket = protocols === undefined
        ? new NativeWebSocket(url)
        : new NativeWebSocket(url, protocols);
      socket.addEventListener("message", event => {
        inspectLiveMessage(event.data, socket.url || String(url || ""), "WS").catch(() => {});
      });
      return socket;
    }
    PlayConnectWebSocket.prototype = NativeWebSocket.prototype;
    Object.setPrototypeOf(PlayConnectWebSocket, NativeWebSocket);
    window.WebSocket = PlayConnectWebSocket;
  }

  const NativeEventSource = window.EventSource;
  if (typeof NativeEventSource === "function") {
    function PlayConnectEventSource(url, configuration) {
      const stream = new NativeEventSource(url, configuration);
      stream.addEventListener("message", event => {
        inspectLiveMessage(event.data, stream.url || String(url || ""), "SSE").catch(() => {});
      });
      return stream;
    }
    PlayConnectEventSource.prototype = NativeEventSource.prototype;
    Object.setPrototypeOf(PlayConnectEventSource, NativeEventSource);
    window.EventSource = PlayConnectEventSource;
  }

  document.addEventListener("play-connect-network-ready", () => {
    for (const batch of recentBatches) window.postMessage(batch, location.origin);
  });
})();
