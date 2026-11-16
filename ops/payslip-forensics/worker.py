"""Bounded private worker. No document data is printed or uploaded as artifacts."""
import hashlib,json,os,subprocess,sys,tempfile,urllib.request,urllib.parse
from pathlib import Path
ENDPOINT='https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/payslip-forensics-worker'
ROOT=Path(__file__).resolve().parent
def request(url,headers,data=None,limit=6*1024*1024):
    req=urllib.request.Request(url,headers=headers,data=data)
    with urllib.request.urlopen(req,timeout=40) as res:
        body=res.read(limit+1)
        if len(body)>limit: raise RuntimeError('Response size limit')
        return body
def api(body):
    oidc_url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience='+urllib.parse.quote('riverbanc-payslip-forensics')
    token=json.loads(request(oidc_url,{'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']},limit=32768))['value']
    return request(ENDPOINT,{'Authorization':'Bearer '+token,'Content-Type':'application/json'},json.dumps(body).encode())
def main():
    completed=0
    for _ in range(10):
        job=json.loads(api({'action':'claim'}))
        if job is None: break
        if job.get('skip'): continue
        args={'id':job['id'],'lease':job['lease']}
        raw=api({'action':'read',**args})
        digest=hashlib.sha256(raw).hexdigest()
        with tempfile.TemporaryDirectory(prefix='riverbanc-pdf-') as folder:
            folder=Path(folder);source=folder/'evidence.pdf';source.write_bytes(raw)
            os.chmod(source,0o600)
            run=subprocess.run([sys.executable,str(ROOT/'analyze_to_json.py'),str(source),'--tool',str(ROOT/'upstream/pdf_forensics.py'),'--output',str(folder/'case')],capture_output=True,timeout=140)
            result_path=folder/'case/result.json'
            result=json.loads(result_path.read_text()) if result_path.exists() and run.returncode==0 else {'status':'error','sha256':digest,'authenticity_verified':False,'findings':[]}
            # Avoid storing irrelevant temporary paths/filenames or excessive details.
            result.pop('filename',None);result.pop('error',None)
            if len(result.get('findings',[]))>100 or len(json.dumps(result))>28000:
                result={'status':'error','sha256':digest,'authenticity_verified':False,'findings':[]}
            if result.get('sha256')!=digest: raise RuntimeError('Source hash mismatch')
            api({'action':'complete',**args,'result':result})
            completed+=1
    print('Completed document checks:',completed)
if __name__=='__main__':
    try: main()
    except Exception:
        print('Document worker failed; pending leases will expire. No evidence details logged.',file=sys.stderr)
        sys.exit(1)
