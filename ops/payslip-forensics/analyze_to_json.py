"""Local PDF Forensics Suite adapter. Produces review signals, never approval."""
import argparse, hashlib, json, os, sqlite3, subprocess, sys
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('pdf',type=Path)
    ap.add_argument('--tool',required=True,type=Path,help='Path to upstream pdf_forensics.py')
    ap.add_argument('--output',required=True,type=Path,help='New case directory')
    args=ap.parse_args()
    source=args.pdf.resolve(strict=True); tool=args.tool.resolve(strict=True)
    if source.suffix.lower()!='.pdf' or not source.is_file():
        ap.error('Input must be a PDF file')
    out=args.output.resolve()
    out.mkdir(parents=True,exist_ok=False)
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    result={'status':'error','sha256':digest,'filename':source.name,'findings':[],
            'authenticity_verified':False,'requires_payroll_verification':True,
            'limitations':['No pixel-level forgery detection','No verification of salary or deduction truth','No automatic approval or rejection']}
    try:
        proc=subprocess.run([sys.executable,str(tool),'--case','LOCAL-REVIEW','analyze',str(source),'-o',str(out)],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120,env={**os.environ,'PYTHONIOENCODING':'utf-8'})
        (out/'analysis.log').write_text(proc.stdout+'\n'+proc.stderr,encoding='utf-8')
        if proc.returncode:
            raise RuntimeError('Analysis failed; see analysis.log')
        databases=list(out.glob('*.db'))
        if len(databases)!=1:
            raise RuntimeError('Expected exactly one results database')
        with sqlite3.connect(databases[0]) as c:
            c.row_factory=sqlite3.Row
            row=c.execute('SELECT id,doc_risk_score,total_pages FROM analyses WHERE source_analysis_id IS NULL').fetchone()
            if row is None: raise RuntimeError('No successful analysis recorded')
            result['tool_risk_score']=row['doc_risk_score']
            result['pages']=row['total_pages']
            result['findings']=[dict(r) for r in c.execute('SELECT ft.code, ft.severity, p.page_number, f.detail FROM findings f JOIN finding_types ft ON ft.id=f.finding_type_id JOIN pages p ON p.id=f.page_id WHERE p.analysis_id=?',(row['id'],))]
        import fitz
        with fitz.open(source) as doc:
            result['textless_pages']=[i+1 for i,p in enumerate(doc) if not p.get_text().strip()]
        if hashlib.sha256(source.read_bytes()).hexdigest()!=digest:
            raise RuntimeError('Input hash changed during analysis')
        result['status']='review_required' if result['findings'] or result['textless_pages'] else 'no_indicators_detected'
        if result['textless_pages']:
            result['limitations'].append('Textless pages may be scanned or flattened; structural checks have limited coverage')
    except Exception as exc:
        result['status']='error'; result['error']=str(exc)
    (out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    return 1 if result['status']=='error' else 0

if __name__=='__main__':
    sys.exit(main())
