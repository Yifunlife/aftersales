#!/usr/bin/python3
"""Fixed-purpose root controller. It never modifies the central service or runtime secrets."""
import contextlib,fcntl,hashlib,json,os,pathlib,pwd,re,shutil,sqlite3,stat,subprocess,sys,tarfile,tempfile,time,urllib.request,uuid
ROOT=pathlib.Path('/opt/yifun-aftersales')
INCOMING=pathlib.Path('/home/yw-deploy/yifun-aftersales/incoming/release.tgz')
CONFIG=pathlib.Path('/etc/yifun-aftersales/runtime.json')
SERVICE='yifun-aftersales.service'
MAX_ARCHIVE=300*1024*1024
MAX_EXPANDED=1024*1024*1024

def run(*args):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=60).stdout.strip()

def unpack(archive,dest):
    count=total=0; seen=set()
    with tarfile.open(fileobj=archive,mode='r:gz') as tar:
        for entry in tar:
            path=pathlib.PurePosixPath(entry.name)
            if path.is_absolute() or '..' in path.parts or '\\' in entry.name: raise ValueError('Unsafe archive path')
            if str(path)=='.': continue
            if not (entry.isdir() or entry.isfile()): raise ValueError('Archive links and special files are forbidden')
            if str(path) in seen: raise ValueError('Duplicate archive path')
            seen.add(str(path)); count+=1; total+=entry.size
            if count>80000 or total>MAX_EXPANDED: raise ValueError('Archive too large')
            target=dest.joinpath(*path.parts)
            if entry.isdir(): target.mkdir(parents=True,exist_ok=True,mode=0o755)
            else:
                target.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
                with tar.extractfile(entry) as source,target.open('xb') as output: shutil.copyfileobj(source,output)
                target.chmod(0o644)
    for name in ['start-node.mjs','dist/server/index.js','release.json']:
        if not (dest/name).is_file(): raise ValueError('Required release file missing: '+name)
    info=json.loads((dest/'release.json').read_text())
    if not re.fullmatch('[a-f0-9]{40}',str(info.get('revision',''))): raise ValueError('Invalid release revision')
    return info

def statements(source):
    result=[]; current=''
    for char in source:
        current+=char
        if char==';' and sqlite3.complete_statement(current): result.append(current);current=''
    if current.strip() and not all(not line.strip() or line.lstrip().startswith('--') for line in current.splitlines()):
        if sqlite3.complete_statement(current+';'): result.append(current+';')
        else: raise ValueError('Incomplete migration')
    return result

def rpc(config,payload):
    request=urllib.request.Request(config['resourceUrl'],data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+config['resourceSecret'],'Content-Type':'application/json','User-Agent':'Yifun-Aftersales-Server/1.0'},method='POST')
    with urllib.request.urlopen(request,timeout=120) as response: return json.load(response)

def migrate(dest,config):
    rows=rpc(config,{'op':'db','method':'all','sql':'SELECT name FROM d1_migrations','values':[]})
    applied={r['name'] for r in rows['results']}
    files=sorted((dest/'migrations').glob('*.sql'))
    if not files: raise ValueError('Migration history missing')
    unknown=applied-{p.name for p in files}
    if unknown: raise ValueError('Database has migrations newer than this release')
    for file in files:
        if file.name in applied: continue
        batch=[{'sql':sql,'values':[]} for sql in statements(file.read_text())]
        batch.append({'sql':'INSERT INTO d1_migrations(name) VALUES(?)','values':[file.name]})
        if len(batch)>500: raise ValueError('Migration requires a reviewed manual rollout')
        result=rpc(config,{'op':'batch','statements':batch})
        if any(x.get('success') is False for x in result): raise RuntimeError('Migration failed')
        print('Applied schema migration: '+file.name,flush=True)

def link(name,target):
    temporary=ROOT/(name+'.next')
    if temporary.is_symlink(): temporary.unlink()
    temporary.symlink_to(target)
    os.replace(temporary,ROOT/name)

def target(name):
    path=(ROOT/name).resolve(strict=True)
    if path.parent!=ROOT/'releases' or not path.is_dir(): raise ValueError('Unexpected release target')
    return path

def healthy(config):
    for attempt in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3100/__health',timeout=3) as response:
                if not json.load(response).get('ok'): raise RuntimeError('Service unhealthy')
            request=urllib.request.Request('http://127.0.0.1:3100/api/auth/status',headers={'x-yifun-origin-key':config['originSecret'],'x-forwarded-host':config['publicHost']})
            with urllib.request.urlopen(request,timeout=10) as response:
                data=json.load(response)
                if 'setupRequired' not in data: raise RuntimeError('Account service unhealthy')
            if run('/usr/bin/systemctl','is-active',SERVICE)!='active': raise RuntimeError('Service inactive')
            return
        except Exception:
            if attempt==29: raise RuntimeError('Aftersales health check failed') from None
            time.sleep(1)

def central():
    if run('/usr/bin/systemctl','is-active','yw-park-os.service')!='active': raise RuntimeError('Central service is not healthy')
    with urllib.request.urlopen('http://127.0.0.1:3000/api/auth/status',timeout=10) as response: json.load(response)

def activate(next_release,previous,config):
    link('current',next_release)
    try:
        run('/usr/bin/systemctl','restart',SERVICE);healthy(config);central()
    except Exception:
        link('current',previous)
        run('/usr/bin/systemctl','restart',SERVICE);healthy(config)
        raise RuntimeError('Publish failed; previous application release restored') from None
    link('previous',previous)

def audit(action,revision):
    with open('/var/log/yifun-aftersales-release.log','a') as output:
        output.write(json.dumps({'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'action':action,'revision':revision})+'\n')

def main():
    os.umask(0o022)
    if os.geteuid()!=0: raise RuntimeError('Use the permitted release command')
    if len(sys.argv)!=2 or sys.argv[1] not in ['deploy','rollback','status']: raise ValueError('Expected deploy, rollback or status')
    with open('/run/lock/yifun-aftersales-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        action=sys.argv[1]
        if action=='status':
            current=target('current'); manifest=current/'release.json'
            print(json.dumps({'release':current.name,'revision':json.loads(manifest.read_text()).get('revision') if manifest.exists() else 'legacy','service':run('/usr/bin/systemctl','is-active',SERVICE)}));return
        config=json.loads(CONFIG.read_text()); central(); previous=target('current')
        if action=='rollback':
            next_release=target('previous');activate(next_release,previous,config);audit(action,next_release.name);print('Previous application release restored; database changes retained.');return
        release=ROOT/'releases'/('ci-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime())+'-'+uuid.uuid4().hex[:8])
        release.mkdir(mode=0o755)
        try:
            fd=os.open(INCOMING,os.O_RDONLY|os.O_NOFOLLOW)
            with os.fdopen(fd,'rb') as source,tempfile.TemporaryFile() as snapshot:
                metadata=os.fstat(source.fileno())
                if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid!=pwd.getpwnam('yw-deploy').pw_uid or metadata.st_size>MAX_ARCHIVE: raise ValueError('Invalid uploaded artifact')
                shutil.copyfileobj(source,snapshot);snapshot.seek(0);info=unpack(snapshot,release)
            # Root owns the extracted tree; migrations use the existing private resource bridge.
            migrate(release,config)
            activate(release,previous,config)
        except Exception:
            if target('current')!=release: shutil.rmtree(release)
            raise
        audit(action,info['revision'])
        print(json.dumps({'ok':True,'revision':info['revision'],'release':release.name,'previous':previous.name}))
if __name__=='__main__':
    try: main()
    except Exception as error:
        print('Release error: '+str(error),file=sys.stderr);sys.exit(1)
