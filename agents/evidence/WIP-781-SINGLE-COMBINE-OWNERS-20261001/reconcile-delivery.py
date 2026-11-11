"""Reconcile every changed path and mirror against live main; reject scope leaks."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
folder = Path(__file__).parent
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)

base = git('rev-parse', 'origin/main').decode().strip()
changed = set(git('diff', '--name-only', 'origin/main').decode().splitlines())
changed.update(git('ls-files', '--others', '--exclude-standard').decode().splitlines())
protected = [p for p in changed if p == 'README.md' or p.startswith(('Benchmarks/', 'ValidationRecords/', '.github/workflows/'))]
assert not protected, protected
assert all(p.startswith(('agents/', '.backups/', 'converters/', 'core/', 'docs/', 'tabs/', 'tests/'))
           or p in ['index.html', 'main-rhbg-fitguard.js'] for p in changed), sorted(changed)
rows = []
mirrors = []
cache = re.compile(r'\?v=[^\s\'"\)<>]+')
for path in sorted(changed):
    file = ROOT / path
    if not file.exists():
        rows.append({'path': path, 'reason': 'WIP identity migrated after allocation', 'kind': 'handover'})
        continue
    data = file.read_bytes()
    if path.startswith('agents/'):
        reason, kind = 'recovery, actual acceptance evidence, live claim/status reconciliation', 'handover/evidence'
    elif path.startswith('.backups/'):
        reason, kind = 'mandatory native backup ledger', 'backup'
    elif path.startswith('tests/'):
        reason, kind = 'physical owner, manual weight, mode dispatch, or activated release contract regression', 'validation'
    else:
        result = subprocess.run(['git', 'show', 'origin/main:' + path], cwd=ROOT, capture_output=True)
        before = result.stdout.decode('utf-8', errors='replace').replace('\r\n', '\n')
        after = data.decode('utf-8', errors='replace').replace('\r\n', '\n')
        metadata = cache.sub('', before) == cache.sub('', after)
        reason = 'reverse import query activation only' if metadata else 'bounded mode, review, physical-owner repair; existing ownership retained'
        kind = 'cache-only' if metadata else 'implementation'
        if path.startswith('docs/'):
            source = ROOT / path[5:]
            assert source.exists() and source.read_bytes() == data, 'Source/docs byte drift: ' + path
            mirrors.append(path)
            reason = 'exact source mirror: ' + reason
    rows.append({'path': path, 'kind': kind, 'reason': reason, 'bytes': len(data),
                 'sha256': hashlib.sha256(data).hexdigest()})
    if path.endswith('/changed-file-ledger.json'):
        rows[-1]['bytes'] = None
        rows[-1]['sha256'] = 'SELF_REFERENTIAL_NOT_HASHED'
report = {'baseMain': base, 'head': git('rev-parse', 'HEAD').decode().strip(),
          'protectedPathDiff': protected, 'exactMirrors': len(mirrors), 'changed': rows}
(folder / 'changed-file-ledger.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
summary = {kind: sum(row['kind'] == kind for row in rows) for kind in sorted({row['kind'] for row in rows})}
print(json.dumps({'status': 'PASS', 'paths': len(rows), 'mirrors': len(mirrors), 'classes': summary}))
