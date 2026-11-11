"""BM2 line-list alias is unique and source-constrained; deployment mirrors root."""
import unittest
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'converters/scripts'))
from xml_to_cii2019_patched import _matching_linelist_rows


class Bm2LineListParityTests(unittest.TestCase):
    def test_source_key_without_prefix_uses_only_unique_bm2_alias(self):
        row={'lineNo':'4110001','t1':'100'}
        config={'linelist':{'masterRows':[row]}}
        self.assertEqual(_matching_linelist_rows('P4110001',config),[row])

    def test_exact_precedence_and_ambiguous_alias_rejected(self):
        exact={'lineNo':'P4110001'}
        alias={'lineNo':'4110001'}
        config={'linelist':{'masterRows':[exact,alias]}}
        self.assertEqual(_matching_linelist_rows('P4110001',config),[exact])
        config={'linelist':{'masterRows':[alias,dict(alias)]}}
        self.assertEqual(_matching_linelist_rows('P4110001',config),[])

    def test_does_not_guess_unrelated_or_bad_keys(self):
        config={'linelist':{'masterRows':[{'lineNo':'4110001'}]}}
        for key in ['Q4110001','P411000','P41100011','P4110002']:
            self.assertEqual(_matching_linelist_rows(key,config),[])

    def test_served_python_is_byte_identical(self):
        a=(ROOT/'converters/scripts/xml_to_cii2019_patched.py').read_bytes()
        b=(ROOT/'docs/converters/scripts/xml_to_cii2019_patched.py').read_bytes()
        self.assertEqual(a,b)


if __name__=='__main__':
    unittest.main()
