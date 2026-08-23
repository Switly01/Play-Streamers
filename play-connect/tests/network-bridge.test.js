import test from "node:test";
import assert from "node:assert/strict";

test("ortak ağ katmanı gerçek işlem alanlarını güvenli donate adayına dönüştürür", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const originalXhr = globalThis.XMLHttpRequest;
  const posted = [];
  const documentListeners = new Map();

  class FakeXhr {
    addEventListener() {}
    open() {}
    send() {}
  }

  globalThis.location = {
    origin: "https://www.klasgame.com",
    href: "https://www.klasgame.com/hesabim/donate"
  };
  globalThis.document = {
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    }
  };
  globalThis.XMLHttpRequest = FakeXhr;
  globalThis.window = {
    async fetch() {
      const response = new Response(JSON.stringify({
        data: [{
          transactionId: "network-transaction-1",
          supporterName: "Ağ destekçisi",
          amountCents: 3750,
          currencyCode: "TRY",
          supportMessage: "Ortak yakalama testi",
          completedAt: "2026-07-30T20:00:00.000Z",
          type: "donation"
        }]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
      Object.defineProperty(response, "url", {
        value: "https://api.klasgame.com/donations?page=1"
      });
      return response;
    },
    postMessage(value, origin) {
      posted.push({ value, origin });
    }
  };

  await import(`../src/network-bridge.js?network-test=${Date.now()}`);
  await globalThis.window.fetch("https://api.klasgame.com/donations?page=1");
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(posted.length, 1);
  assert.equal(posted[0].origin, "https://www.klasgame.com");
  assert.equal(posted[0].value.marker, "PLAY_CONNECT_DONATE_NETWORK_V1");
  assert.equal(posted[0].value.candidates.length, 1);
  assert.equal(posted[0].value.candidates[0].eventId, "network-transaction-1");
  assert.equal(posted[0].value.candidates[0].name, "Ağ destekçisi");
  assert.equal(posted[0].value.candidates[0].amountMinor, 3750);

  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
  globalThis.XMLHttpRequest = originalXhr;
});

test("boş donate yanıtı başlangıç taramasını tamamlamak için iletilir", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const originalXhr = globalThis.XMLHttpRequest;
  const posted = [];

  class FakeXhr {
    addEventListener() {}
    open() {}
    send() {}
  }

  globalThis.location = {
    origin: "https://www.pindirim.com",
    href: "https://www.pindirim.com/panel/donations"
  };
  globalThis.document = { addEventListener() {} };
  globalThis.XMLHttpRequest = FakeXhr;
  globalThis.window = {
    async fetch() {
      const response = new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
      Object.defineProperty(response, "url", {
        value: "https://www.pindirim.com/api/donations?page=1"
      });
      return response;
    },
    postMessage(value, origin) {
      posted.push({ value, origin });
    }
  };

  await import(`../src/network-bridge.js?empty-network-test=${Date.now()}`);
  await globalThis.window.fetch("https://www.pindirim.com/api/donations?page=1");
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(posted.length, 1);
  assert.equal(posted[0].value.marker, "PLAY_CONNECT_DONATE_NETWORK_V1");
  assert.deepEqual(posted[0].value.candidates, []);

  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
  globalThis.XMLHttpRequest = originalXhr;
});

test("herkese açık ana sayfadaki örnek ödeme kartları donate sayılmaz", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const originalXhr = globalThis.XMLHttpRequest;
  const posted = [];

  class FakeXhr {
    addEventListener() {}
    open() {}
    send() {}
  }

  globalThis.location = {
    origin: "https://donate.bynogame.com",
    href: "https://donate.bynogame.com/"
  };
  globalThis.document = { addEventListener() {} };
  globalThis.XMLHttpRequest = FakeXhr;
  globalThis.window = {
    async fetch() {
      const response = new Response(JSON.stringify({
        cards: [{ id: "sample-card", name: "Örnek yayıncı", amount: 10, message: "Tanıtım kartı" }]
      }), { status: 200, headers: { "content-type": "application/json" } });
      Object.defineProperty(response, "url", { value: "https://donate.bynogame.com/api/home" });
      return response;
    },
    postMessage(value, origin) { posted.push({ value, origin }); }
  };

  await import(`../src/network-bridge.js?landing-noise-test=${Date.now()}`);
  await globalThis.window.fetch("https://donate.bynogame.com/api/home");
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(posted.length, 0);

  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
  globalThis.XMLHttpRequest = originalXhr;
});
