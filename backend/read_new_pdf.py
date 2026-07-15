import os
from pypdf import PdfReader

pdf_path = "c:/Users/Madan M/Downloads/03-Agentic-Nurse-Watch.pdf"
output_path = "D:/nursewatch-ai/backend/new_pdf_text.txt"

try:
    reader = PdfReader(pdf_path)
    text = ""
    for i, page in enumerate(reader.pages):
        text += f"\n--- PAGE {i} ---\n"
        text += page.extract_text() or ""
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Successfully extracted {len(text)} characters to {output_path}")
except Exception as e:
    print(f"Error reading PDF: {e}")
