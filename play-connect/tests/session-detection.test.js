import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_BY_ID,
  alertLinkInfo,
  isProviderAlertUrlAllowed,
  comparableAlertUrl
} from "../src/providers.js";

test("OBS bağlantısı platformun kendi alan adını ve ortak alert sağlayıcılarını doğrular", () => {
  const klasgame = PROVIDER_BY_ID.get("klasgame");
  const pindirim = PROVIDER_BY_ID.get("pindirim");
  assert.equal(alertLinkInfo(klasgame, "https://www.klasgame.com/yayinci/alert/secret")?.renderer, "Klasgame");
  assert.equal(alertLinkInfo(klasgame, "https://streamlabs.com/widgets/alertbox/v1/secret")?.renderer, "Streamlabs");
  assert.equal(alertLinkInfo(pindirim, "https://streamelements.com/overlay/secret/channel")?.renderer, "StreamElements");
  assert.equal(isProviderAlertUrlAllowed(klasgame, "http://streamlabs.com/widgets/alertbox/secret"), false);
  assert.equal(isProviderAlertUrlAllowed(klasgame, "https://example.com/overlay/secret"), false);
  assert.equal(comparableAlertUrl("https://streamlabs.com/widgets/alertbox/secret#scene"), "https://streamlabs.com/widgets/alertbox/secret");
});
