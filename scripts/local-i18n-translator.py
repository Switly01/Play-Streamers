"""Play Streamers statik dil paketlerini ücretsiz, yerel Argos modelleriyle üretir."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from argostranslate import package, translate


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
    models = translation_map()
    tr_to_en = models.get(("tr", "en"))
    if tr_to_en is None:
        raise RuntimeError("Türkçe -> İngilizce yerel modeli yüklenemedi.")

    translations: dict[str, list[str]] = {}
    total = sum(len(requests.get(language) or []) for language in targets)
    completed = 0
    for language in sorted(targets):
        sources = [str(value) for value in requests.get(language) or []]
        target_model = None if language == "en" else models.get(("en", language))
        if language != "en" and target_model is None:
            raise RuntimeError(f"İngilizce -> {language} yerel modeli yüklenemedi.")
        results: list[str] = []
        for source in sources:
            english = tr_to_en.translate(source)
            result = english if language == "en" else target_model.translate(english)
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
