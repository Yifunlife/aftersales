#!/usr/bin/python3
"""Forced command for the GitHub key: no shell, port forwarding or arbitrary paths."""
import os,pathlib,subprocess,sys,tempfile
ROOT=pathlib.Path('/home/yw-deploy/yifun-aftersales/incoming')
command=os.environ.get('SSH_ORIGINAL_COMMAND','')
if command=='upload':
    ROOT.mkdir(mode=0o700,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='upload-',dir=ROOT)
    try:
        with os.fdopen(fd,'wb') as output:
            size=0
            while True:
                chunk=sys.stdin.buffer.read(1024*1024)
                if not chunk:break
                size+=len(chunk)
                if size>300*1024*1024:raise ValueError('Release archive too large')
                output.write(chunk)
        if not size:raise ValueError('Empty release artifact')
        os.replace(name,ROOT/'release.tgz');print('Release artifact received.')
    finally:
        if os.path.exists(name):os.unlink(name)
elif command in ['deploy','status','rollback']:
    sys.exit(subprocess.call(['/usr/bin/sudo','-n','/usr/local/bin/yifun-aftersales-release',command]))
else:
    print('Only upload, deploy, status and rollback are permitted.',file=sys.stderr);sys.exit(1)
