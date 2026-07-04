import os
from pypdf import PdfReader
p = r'c:\Users\hp\Multi-Workspace Document\Multi-Workspace Document Assistant (RAG & Tool Calling)-2026070314355699.pdf'
print('exists', os.path.exists(p), 'size', os.path.getsize(p))
reader = PdfReader(p)
print('pages', len(reader.pages))
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
print(text[:80000])
