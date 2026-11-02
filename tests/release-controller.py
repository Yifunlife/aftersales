import importlib.util,io,json,pathlib,tarfile,tempfile,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('release',pathlib.Path(__file__).resolve().parents[1]/'runtime/release/controller.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

def archive(extra=None):
    output=io.BytesIO()
    files={'start-node.mjs':b'','dist/server/index.js':b'','release.json':json.dumps({'revision':'a'*40}).encode()}
    with tarfile.open(fileobj=output,mode='w:gz') as tar:
        for name,data in files.items():
            item=tarfile.TarInfo(name);item.size=len(data);tar.addfile(item,io.BytesIO(data))
        if extra:tar.addfile(extra)
    output.seek(0);return output

class ReleaseTests(unittest.TestCase):
    def test_valid_artifact(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(release.unpack(archive(),pathlib.Path(root))['revision'],'a'*40)
    def test_paths_links_and_special_files_rejected(self):
        for name,kind in [('../escape',tarfile.REGTYPE),('/etc/escape',tarfile.REGTYPE),('alias',tarfile.SYMTYPE),('hardlink',tarfile.LNKTYPE),('device',tarfile.CHRTYPE)]:
            with self.subTest(name=name,kind=kind),tempfile.TemporaryDirectory() as root:
                bad=tarfile.TarInfo(name);bad.type=kind;bad.linkname='/etc/passwd'
                with self.assertRaises(ValueError):release.unpack(archive(bad),pathlib.Path(root))
    def test_sql_quoted_semicolons_and_comments(self):
        result=release.statements("-- schema\nCREATE TABLE a(x TEXT); INSERT INTO a VALUES('semi;colon'); -- end")
        self.assertEqual(len(result),2)
    def test_migrations_only_apply_new_files_atomically(self):
        calls=[]
        def rpc(config,payload):
            calls.append(payload)
            return {'results':[{'name':'0001_old.sql'}]} if payload['op']=='db' else [{'success':True}]
        with tempfile.TemporaryDirectory() as root,patch.object(release,'rpc',side_effect=rpc):
            path=pathlib.Path(root);(path/'migrations').mkdir()
            (path/'migrations/0001_old.sql').write_text('DROP TABLE old;')
            (path/'migrations/0002_new.sql').write_text('CREATE TABLE new(x);')
            release.migrate(path,{})
        self.assertEqual(len(calls),2);self.assertEqual(calls[1]['op'],'batch')
        self.assertEqual(calls[1]['statements'][-1]['values'],['0002_new.sql'])
        self.assertFalse(any('DROP TABLE' in s['sql'] for s in calls[1]['statements']))
    def test_failed_health_restores_old_application(self):
        links=[]
        with patch.object(release,'link',side_effect=lambda k,v:links.append((k,v))),patch.object(release,'run') as run,patch.object(release,'healthy',side_effect=[RuntimeError('bad'),None]),patch.object(release,'central'):
            with self.assertRaisesRegex(RuntimeError,'previous application release restored'):release.activate('new','old',{})
        self.assertEqual(links,[('current','new'),('current','old')])
        self.assertEqual(run.call_args_list[0].args,('/usr/bin/systemctl','restart','yifun-aftersales.service'))
        self.assertEqual(run.call_count,2)
if __name__=='__main__':unittest.main()
