-- Canlı arayüz çevirilerini paket/KV anahtarı yerine tekil kaynak metin
-- bazında D1'de yeniden kullanır. Aynı metin farklı ekran ve paketlerde tek
-- satır olarak saklanır; böylece dil geçişleri hızlanır ve KV işlemleri biter.
CREATE TABLE IF NOT EXISTS interface_translation_cache (
  cache_key TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interface_translation_language
  ON interface_translation_cache(language);
