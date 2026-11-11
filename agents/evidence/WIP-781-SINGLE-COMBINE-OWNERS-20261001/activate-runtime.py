"""Bounded reverse-import cache activation and source/docs mirror ledger."""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
RELEASE = "20261001-single-weight-owners-1"
SEEDS = [
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-processing-mode.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-b-xml-export.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js",
    "converters/xml-cii-2019-standalone/engine.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-smart-fill-ui.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js",
    "tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js",
    "tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-authority-ui.js",
]
PYTHON = ["xml_to_cii2019.py", "xml_to_cii2019_runtime_custody.py",
          "xml_cii_weight_output_custody.py", "xml_cii_weighted_geometry.py"]
pattern = re.compile(r"(['\"])(\.{1,2}/[^'\"\s]+\.js)(?:\?[^'\"]*)?\1")
files = [ROOT / line for line in subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
         if line.endswith(".js") and not line.startswith(("docs/", "tests/", "agents/", "vendor/", "third_party/"))]
texts = {}
for file in files:
    if file.exists():
        try:
            texts[file] = file.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            continue
changed = {ROOT / path for path in SEEDS}
while True:
    parents = {file for file, content in texts.items()
               if any((file.parent / match.group(2)).resolve() in changed for match in pattern.finditer(content))}
    next_changed = changed | parents
    if next_changed == changed:
        break
    changed = next_changed
ledger = []
apply = "--apply" in __import__("sys").argv


def write(file, content, reason):
    if file.exists() and file.read_bytes().decode("utf-8") == content:
        return
    ledger.append({"file": file.relative_to(ROOT).as_posix(), "reason": reason})
    if not apply:
        return
    if file.exists():
        subprocess.run(["node", "utils/backup.js", "save", file.relative_to(ROOT).as_posix(), reason],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(content.encode("utf-8"))


for file in sorted(changed):
    content = file.read_bytes().decode("utf-8")
    def replace(match):
        target = (file.parent / match.group(2)).resolve()
        return f"{match.group(1)}{match.group(2)}?v={RELEASE}{match.group(1)}" if target in changed else match.group(0)
    revised = pattern.sub(replace, content)
    write(file, revised, "activate changed Single/ModeA/ModeB and weighted owner runtime imports")
    write(ROOT / "docs" / file.relative_to(ROOT), revised, "mirror qualified runtime and cache activation")
index = ROOT / "index.html"
content = re.sub(r"main-rhbg-fitguard.js\?v=[^\"']+", f"main-rhbg-fitguard.js?v={RELEASE}", index.read_bytes().decode("utf-8"))
write(index, content, "activate reverse-import entry chain")
write(ROOT / "docs/index.html", content, "mirror release entry")
for name in PYTHON:
    write(ROOT / "docs/converters/scripts" / name, (ROOT / "converters/scripts" / name).read_bytes().decode("utf-8"),
          "mirror physical component preservation in existing Python runtime")
destination = Path(__file__).with_name("runtime-activation-ledger.json")
destination.write_text(json.dumps({"release": RELEASE, "apply": apply, "seeds": SEEDS,
                                  "reverseImportFiles": len(changed), "activatedModules": sorted(file.relative_to(ROOT).as_posix() for file in changed), "changed": ledger}, indent=2) + "\n")
print(json.dumps({"apply": apply, "reverseImportFiles": len(changed), "changedFiles": len(ledger)}))
