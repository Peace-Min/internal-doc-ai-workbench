"""Optional Marker 2.0.0 extraction; no LLM enhancement or cloud API calls."""
import argparse,json,hashlib,time,sys
from pathlib import Path
import pdfplumber

def main():
    parser=argparse.ArgumentParser();parser.add_argument('pdf');parser.add_argument('output');parser.add_argument('--ocr',action='store_true');args=parser.parse_args()
    pdf=Path(args.pdf);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    digest=hashlib.sha256(pdf.read_bytes()).hexdigest()
    with pdfplumber.open(pdf) as source:
        pages=[{'page':i+1,'text':page.extract_text() or ''} for i,page in enumerate(source.pages)]
    (out/'baseline.json').write_text(json.dumps({'schemaVersion':1,'engine':'pdfplumber','documentSha256':digest,'pages':pages},ensure_ascii=False,indent=2),encoding='utf8')
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict,shutdown_models
    from marker.renderers.markdown import MarkdownRenderer
    from marker.renderers.json import JSONRenderer
    from bs4 import BeautifulSoup
    models=create_model_dict();start=time.monotonic()
    config={'mode':'fast','disable_ocr':not args.ocr,'use_llm':False,'extract_images':False,'paginate_output':True}
    try:
        converter=PdfConverter(config=config,artifact_dict=models)
        document=converter.build_document(str(pdf))
        renderer=MarkdownRenderer(config)
        rendered=renderer(document)
        # Use Marker HTML page wrappers; markdown conversion is Marker's own renderer.
        html,_=renderer.extract_html(document,document.render(renderer.block_config))
        soup=BeautifulSoup(html,'html.parser')
        pages=[]
        for page in soup.select('div.page[data-page-id]'):
            number=int(page['data-page-id'])+1
            page.attrs.pop('class',None);page.attrs.pop('data-page-id',None)
            pages.append({'page':number,'text':renderer.md_cls.convert(str(page)).strip()})
        if len(pages)!=len(document.pages):raise RuntimeError('Page provenance mismatch')
        raw=JSONRenderer(config)(document)
        (out/'marker-raw.json').write_text(raw.model_dump_json(indent=2),encoding='utf8')
        (out/'marker.md').write_text(rendered.markdown,encoding='utf8')
        (out/'marker.json').write_text(json.dumps({'schemaVersion':1,'engine':'marker','markerVersion':'2.0.0','documentSha256':digest,'mode':'fast','ocr':args.ocr,'useLlm':False,'durationSeconds':round(time.monotonic()-start,2),'pages':pages},ensure_ascii=False,indent=2),encoding='utf8')
    finally:
        # Surya's SIGINT shutdown can interrupt the parent console on Windows.
        # Terminate only this worker's descendants before upstream cleanup.
        if sys.platform=='win32':
            import psutil
            children=psutil.Process().children(recursive=True)
            for child in reversed(children):
                try:child.terminate()
                except psutil.NoSuchProcess:pass
            _,alive=psutil.wait_procs(children,timeout=5)
            for child in alive:
                try:child.kill()
                except psutil.NoSuchProcess:pass
        shutdown_models(models)

if __name__=='__main__':main()
