from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import json,hashlib,zipfile
root=Path(__file__).parent
specs=[('NRC.pdf','Identity document test fixture',None),('GOV_ID.pdf','Government ID test fixture',None),('INTRODUCTORY_LETTER.pdf','Employment letter test fixture',None),('PAYSLIP-2026-08.pdf','Payslip test fixture','2026-08'),('PAYSLIP-2026-09.pdf','Payslip test fixture','2026-09'),('PAYSLIP-2026-10.pdf','Payslip test fixture','2026-10')]
manifest=[]
for name,title,period in specs:
 p=root/name;c=canvas.Canvas(str(p),pagesize=A4);c.setTitle('SYNTHETIC TEST ONLY - '+title)
 c.setFillColorRGB(.7,0,0);c.setFont('Helvetica-Bold',21);c.drawString(45,790,'SYNTHETIC TEST ONLY')
 c.setFillColorRGB(0,0,0);c.setFont('Helvetica-Bold',16);c.drawString(45,745,title)
 lines=['NOT VALID FOR IDENTIFICATION, EMPLOYMENT OR LENDING.','Not issued by any government, employer or financial institution.','','Test case: TEST-LIVE-KYC-20261111','Applicant: Synthetic KYC Download Test','Test lender: Handshake Test','Identity reference: TEST-NOT-A-REAL-ID','Employer: Synthetic Test Organization']
 if period:lines += ['Pay period: '+period,'Illustrative gross: ZMW 100.00','Illustrative deductions: ZMW 10.00','Illustrative net: ZMW 90.00']
 lines += ['','No real person, employer, signature, seal, photograph or identity number.','Purpose: upload, package integrity and authorized download testing only.']
 c.setFont('Helvetica',11)
 for i,l in enumerate(lines):c.drawString(45,705-24*i,l)
 c.setFillColorRGB(.7,0,0);c.setFont('Helvetica-Bold',12);c.drawString(45,45,'FICTIONAL FIXTURE - NOT EVIDENCE OF VERIFICATION');c.save()
 manifest.append({'file':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size,'synthetic':True})
(root/'manifest.json').write_text(json.dumps({'test_case':'TEST-LIVE-KYC-20261111','synthetic_only':True,'documents':manifest},indent=2))
(root/'README.md').write_text('# Synthetic KYC test documents\n\nAll six PDFs are fictional, visibly marked test fixtures. They are not real identification, employment or income evidence. Use only with the dedicated test borrower and Handshake Test tenant. Do not attach them to a real borrower or mark a real person verified. Upload through the authenticated Marketplace borrower flow; this archive does not grant access or authorize release.\n')
with zipfile.ZipFile(root/'Riverbanc_Synthetic_KYC_Test.zip','w',zipfile.ZIP_DEFLATED) as z:
 for n in [x[0] for x in specs]+['README.md','manifest.json']:z.write(root/n,n)
print('Created six synthetic PDFs and test archive')
