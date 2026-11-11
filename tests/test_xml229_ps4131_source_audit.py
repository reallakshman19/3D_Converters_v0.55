"""Source-only audit: locate every original PS-4131 witness and explicit gaps.

This is an evidence read, not a generated support or acceptance assertion.
"""
from pathlib import Path
from zipfile import ZipFile
import json
import re
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
STAGED=ROOT/'Benchmarks/STF_2026Sep16-0859_managed_stage.zip'
TARGET='B4110003-11502'
PS=re.compile(r'(?<![0-9])PS[- ]?4131(?:[.][123])?(?![0-9])',re.I)
GAP_KEYS=('NODEGAP','CMPSUPGAP','CMPSUPGAP_POS','CMPSUPGAP_PS','SUPPORT GAP',
          'GAP','GAP_POS','GAP_PS')
FIELDS=('NAME','OWNER','POS','POSI','APOS','LPOS','SUPPORTCOORD','DTXR','DTXR_POS',
        'DTXR_PS','SPRE','SPREF','MDSSUPPTYPE','MDSSUPPFUNC','SUPPORT_KIND',
        'SUPPORT_TYPE','SUPPORT_MAPPER_KIND','CMPSUPTYPE','NODETYPE','NODESTIFF',
        'NODEGAP','CMPSUPGAP','CMPSUPGAP_POS','CMPSUPGAP_PS','GAP','SUPPORT GAP')

def visit(obj, branch='',path='$'):
    if isinstance(obj,list):
        for i,v in enumerate(obj):
            yield from visit(v,branch,f'{path}[{i}]')
    elif isinstance(obj,dict):
        typ=str(obj.get('type') or '')
        if typ.upper()=='BRANCH':
            branch=str(obj.get('name') or branch)
        attrs=obj.get('attributes') or {}
        # Include matching PS references in source description, owner and names.
        text=' '.join(str(x) for x in [obj.get('name'),obj.get('type'),attrs])
        if TARGET in branch.upper() or PS.search(text):
            yield dict(branch=branch,path=path,type=typ,name=obj.get('name'),
                       psHit=bool(PS.search(text)),
                       fields={k:attrs[k] for k in FIELDS if k in attrs},
                       gapFields={k:v for k,v in attrs.items() if 'GAP' in k.upper()})
        for i,v in enumerate(obj.get('children') or []):
            yield from visit(v,branch,f'{path}.children[{i}]')

class Ps4131SourceAudit(unittest.TestCase):
    def test_original_managed_source_witnesses(self):
        with ZipFile(STAGED) as archive:
            entries=[x for x in archive.namelist() if x.lower().endswith('.json')]
            self.assertEqual(len(entries),1,entries)
            source=json.loads(archive.read(entries[0]))
        evidence=list(visit(source))
        matches=[row for row in evidence if row['psHit']]
        target=[row for row in evidence if TARGET in row['branch'].upper()]
        print('PS4131_SOURCE_AUDIT '+json.dumps({
            'archiveMember':entries[0],'stagedRootBranches':len(source),
            'psWitnesses':matches[:30],'psWitnessCount':len(matches),
            'targetBranchCount':len({r['branch'] for r in target}),
            'targetRecords':target[:75], 'targetRecordCount':len(target)
        },sort_keys=True))
        self.assertGreater(len(source),0)

    def test_original_bm2_xml_target_presence(self):
        xml=ROOT/'Benchmarks/XML-CII-2019/revamped/GLRD-1000-PI-01 - BM2.xml'
        root=ET.parse(xml).getroot()
        names=[next((str(n.text or '') for n in b if n.tag.rsplit('}',1)[-1]=='Branchname'), '')
               for b in root.iter() if b.tag.rsplit('}',1)[-1]=='Branch']
        hits=[n for n in names if TARGET in n.upper()]
        print('PS4131_XML_AUDIT '+json.dumps({
            'branchCount':len(names),'exactLineHits':hits,
            'allB4110003':[n for n in names if 'B4110003' in n.upper()]
        },sort_keys=True))
        self.assertEqual(len(names),31)

if __name__=='__main__':unittest.main()
