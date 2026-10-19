"""Fixed synthetic PDF content and answer key; no corporate documents."""
import argparse, json, hashlib
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from PIL import Image, ImageDraw, ImageFont

def main():
    parser=argparse.ArgumentParser();parser.add_argument('output');args=parser.parse_args()
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    pdf=canvas.Canvas(str(output/'fixture.pdf'),pagesize=(595,842))
    pdf.setTitle('Synthetic grounding evaluation - not a company document')
    pdf.setFont('Helvetica-Bold',18);pdf.drawString(40,795,'Synthetic project register')
    pdf.setFont('Helvetica',11)
    for i,line in enumerate(['All amounts are in USD. This is fictional evaluation material.',
      'The owner of project ORBIT is NORA.', 'The review month is NOVEMBER.',
      'The delivery city is BUSAN.', 'The warranty period is 18 months.',
      'Only approved budgets are listed below. Proposed values are not approved.']):
        pdf.drawString(40,755-i*24,line)
    rows=[['Project','Approved budget','Proposed budget','Delivery day'],
      ['ORBIT','950','1200','20'],['CEDAR','430','470','12'],['MAPLE','680','720','25'],
      ['CORAL','275','310','16'],['DELTA','810','900','28'],['LUNAR','560','600','14']]
    table=Table(rows,colWidths=[110,130,130,110],rowHeights=32)
    table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.7,colors.grey),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#dfeaf2')),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),10)]))
    table.wrapOn(pdf,510,300);table.drawOn(pdf,40,335)
    pdf.showPage()
    pdf.setFont('Helvetica-Bold',18);pdf.drawString(40,795,'Independent regional notes')
    pdf.setFont('Helvetica-Bold',12);pdf.drawString(40,755,'NORTH region');pdf.drawString(320,755,'SOUTH region')
    pdf.setFont('Helvetica',11)
    for i,(left,right) in enumerate(zip(['Manager: ALMA','Staff count: 17','Audit code: N42','Reserve fund: 63'],['Manager: BERN','Staff count: 29','Audit code: S81','Reserve fund: 48'])):
        pdf.drawString(40,720-i*32,left);pdf.drawString(320,720-i*32,right)
    pdf.showPage()
    # Image-only page: negative control when OCR is disabled; never hand-transcribe it.
    image=Image.new('RGB',(1100,400),'white');draw=ImageDraw.Draw(image)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',36)
    for i,line in enumerate(['SCANNED ONLY - synthetic invoice','Invoice code: RAVEN','Invoice amount: 437 USD','Invoice month: APRIL']):draw.text((30,30+i*85),line,font=font,fill='black')
    image.save(output/'scan.png');pdf.drawImage(str(output/'scan.png'),35,450,width=525,height=191)
    pdf.save()
    cases=[]
    def add(q,answer,page,category):cases.append({'id':f'q{len(cases)+1:02d}','question':q,'answer':answer,'page':page,'category':category})
    for row in rows[1:]:
        add(f'What is the approved budget for {row[0]} in USD?',row[1],1,'table')
    for q,a in [('Who owns ORBIT?','NORA'),('What is the review month?','NOVEMBER'),('What is the delivery city?','BUSAN'),('How many months is the warranty?','18')]:add(q,a,1,'prose')
    for q,a in [('Who manages NORTH?','ALMA'),('How many staff are in NORTH?','17'),('What is the SOUTH audit code?','S81'),('What is the SOUTH reserve fund?','48')]:add(q,a,2,'columns')
    for q in ['What is the CEO name?','What is the bank account number?','What is the final tax amount?','What is the actual completion year?','Who manages the EAST region?','What is the approved budget for PLUTO?']:
        add(q,'UNKNOWN',None,'unanswerable')
    for q,a in [('What is the scanned invoice code?','RAVEN'),('What is the scanned invoice amount in USD?','437')]:add(q,a,3,'scan')
    (output/'questions.json').write_text(json.dumps({'schemaVersion':1,'synthetic':True,'documentSha256':hashlib.sha256((output/'fixture.pdf').read_bytes()).hexdigest(),'cases':cases},indent=2),encoding='utf8')

if __name__=='__main__':main()
