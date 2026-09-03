"""Play Streamers statik dil paketlerini ücretsiz, yerel Argos modelleriyle üretir."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from argostranslate import package, translate
import ctranslate2


TARGETS = {"en", "de", "es", "fr", "ru", "ar", "ja"}


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def installed_pairs() -> set[tuple[str, str]]:
    return {
        (item.from_code, item.to_code)
        for item in package.get_installed_packages()
    }


def ensure_models(targets: set[str]) -> None:
    required = {("tr", "en")}
    required.update(("en", target) for target in targets if target != "en")
    missing = required - installed_pairs()
    if not missing:
        return

    log("Yerel çeviri modelleri ilk kullanım için indiriliyor…")
    package.update_package_index()
    available = package.get_available_packages()
    by_pair = {(item.from_code, item.to_code): item for item in available}
    unavailable = missing - set(by_pair)
    if unavailable:
        pairs = ", ".join(f"{source}->{target}" for source, target in sorted(unavailable))
        raise RuntimeError(f"Argos model deposunda gerekli dil paketleri bulunamadı: {pairs}")
    for pair in sorted(missing):
        log(f"Model kuruluyor: {pair[0]} -> {pair[1]}")
        package.install_from_path(by_pair[pair].download())


def translation_map() -> dict[tuple[str, str], object]:
    result: dict[tuple[str, str], object] = {}
    for source in translate.get_installed_languages():
        for target in translate.get_installed_languages():
            if source.code == target.code:
                continue
            translation = source.get_translation(target)
            if translation is not None:
                result[(source.code, target.code)] = translation
    return result


def run(input_path: Path, output_path: Path) -> None:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    requests = payload.get("requests") or {}
    targets = set(requests) & TARGETS
    ensure_models(targets)
    packages = {(item.from_code, item.to_code): item for item in package.get_installed_packages()}

    def batch(values: list[str], source: str, target: str) -> list[str]:
        pkg = packages[(source, target)]
        model = ctranslate2.Translator(str(pkg.package_path / "model"), device="cpu", compute_type="int8", intra_threads=4)
        encoded = [pkg.tokenizer.encode(value) for value in values]
        prefix = [[pkg.target_prefix]] * len(encoded) if pkg.target_prefix else None
        outputs = model.translate_batch(encoded, target_prefix=prefix, replace_unknowns=True,
                                        max_batch_size=1024, batch_type="tokens", beam_size=4,
                                        num_hypotheses=1, length_penalty=0.2)
        decoded = [pkg.tokenizer.decode(item.hypotheses[0]).removeprefix(pkg.target_prefix).strip() for item in outputs]
        del model
        return decoded

    all_sources = list(dict.fromkeys(str(value) for language in sorted(targets) for value in requests.get(language) or []))
    protected = [re.sub(r"\{(\d+)\}", lambda match: str(918470000 + int(match[1])), source) for source in all_sources]
    log(f"Ortak İngilizce kaynak: {len(all_sources)} metin toplu hazırlanıyor.")
    english = dict(zip(all_sources, batch(protected, "tr", "en")))

    translations: dict[str, list[str]] = {}
    total = sum(len(requests.get(language) or []) for language in targets)
    completed = 0
    for language in sorted(targets):
        sources = [str(value) for value in requests.get(language) or []]
        log(f"{language}: {len(sources)} metin toplu hazırlanıyor.")
        translated = [english[source] for source in sources]
        if language != "en":
            translated = batch(translated, "en", language)
        results: list[str] = []
        for result in translated:
            # Numeric sentinels survive both model passes; user values are never translated.
            result = re.sub(r"918470(\d{3})", lambda match: "{" + str(int(match[1])) + "}", str(result))
            results.append(str(result).strip())
            completed += 1
            if completed % 25 == 0 or completed == total:
                log(f"Yerel çeviri: {completed}/{total}")
        translations[language] = results

    output_path.write_text(
        json.dumps({"translations": translations}, ensure_ascii=False),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    run(args.input, args.output)


if __name__ == "__main__":
    main()
