# Owner-confirmed Smart Zambia layout reference

The owner confirmed the public GRZ e-payslip at
https://www.scribd.com/document/859418071/ACFrOgBIHdGKnO9HPmS5XpLeChusCu-zk060L6qzJQuhOABO-tKowJ5q2Ie67Tg7Bz3XrPx-Ds7KuYLO7RKXm6Pt8qSN4NbRD3WJwm2QK-LkdXcPS34XJYqcaChHXYUoNjApKfgif-rbibICmArOo
as the layout to support on 6 November 2026. This records the owner's selection,
not independent issuer verification or approval of the application.

These two PNG files are original, watermarked synthetic fixtures representing
the reference's field structure and accounting conventions. No source employee
name, employee identifier, NRC, bank account or personal financial record is
copied. The fictional totals are 12000 gross, 3000 deductions and 9000 net;
the altered fixture changes net to 9100. Neither fixture is valid evidence.

The parser is calibrated code using the existing English OCR model. No OCR
model weights were trained. Checks are advisory; matching fields/layout and
consistent arithmetic do not establish authenticity. Accumulation is distinct
from current-period amounts. Two cents of arithmetic tolerance is allowed.

The text equivalent and altered cases are tested in
`src/services/smartZambiaPayslip.test.ts`. Use the opt-in browser OCR page with
these fixtures to test actual image recognition under the release CSP.
