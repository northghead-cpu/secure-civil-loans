"""Fetch pinned upstream analyzer; verify every file against reviewed source hashes."""
import hashlib,io,json,urllib.request,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent
commit='28a736f2ef955a45f8f99b079a98e9536b4346c4'
with urllib.request.urlopen('https://codeload.github.com/jjrboucher/PDF-Forensics/zip/'+commit,timeout=60) as response:
    raw=response.read(20*1024*1024+1)
if len(raw)>20*1024*1024: raise RuntimeError('Archive too large')
manifest=json.loads((root/'upstream-sha256.json').read_text())
with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    prefix='PDF-Forensics-'+commit+'/Application/'
    for name,digest in manifest.items():
        path=Path(name)
        if path.is_absolute() or '..' in path.parts: raise RuntimeError('Unsafe path')
        data=archive.read(prefix+name)
        if hashlib.sha256(data).hexdigest()!=digest: raise RuntimeError('Source mismatch')
        dest=root/'upstream'/path
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
print('Pinned analyzer source verified.')
