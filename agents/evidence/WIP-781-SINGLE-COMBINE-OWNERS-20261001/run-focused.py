"""Replay unchanged existing gate and mission regressions, with durable commands."""
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
folder = Path(__file__).parent
workflow = (ROOT / ".github/workflows/issue-776-validation.yml").read_text()
focused = workflow.split("Run Issue 776 focused regressions", 1)[1].split("status=${PIPESTATUS", 1)[0]
dataset = workflow.split("Run PR780 master dataset regressions", 1)[1].split("status=${PIPESTATUS", 1)[0]
predecessor = json.loads((ROOT / "agents/evidence/WIP-781-OUTPUT-CUSTODY-20261001/validation-commands.json").read_text())
commands = {
    "unchanged-main-focused": ["node", "--test", *re.findall(r"tests/[^\s\\]+\.mjs", focused)],
    "dataset-custody": ["node", "--test", *re.findall(r"tests/[^\s\\]+\.mjs", dataset)],
    "mission-focused": [*predecessor['focusedNodeCommand'].split(), "tests/xml-cii-processing-mode.test.mjs", "tests/xml-cii-issue-781-weight-match-authority-presentation.test.mjs"],
    "physical-geometry": [sys.executable, "tests/xml-cii-weighted-geometry.test.py"],
    "publication-guard": [sys.executable, "tests/xml-cii-weight-owner-guard.test.py"],
}
results = []
for label, command in commands.items():
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    (folder / (label + ".log")).write_text(result.stdout + result.stderr, encoding="utf-8")
    row = {"label": label, "command": command, "exitCode": result.returncode,
           "status": "PASS" if result.returncode == 0 else "FAIL", "observation": "EXECUTION",
           "oracle": "EXISTING_GATE_PLUS_INDEPENDENT_PHYSICAL_FIXTURES"}
    results.append(row)
    print(json.dumps({key: row[key] for key in ['label', 'exitCode', 'status']}), flush=True)
(folder / "focused-validation.json").write_text(json.dumps(results, indent=2) + "\n")
sys.exit(1 if any(row['status'] == 'FAIL' for row in results) else 0)
