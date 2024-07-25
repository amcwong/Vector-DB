# UNFINISHED

import os
import requests
import fitz  # PyMuPDF
import uuid
from dotenv import load_dotenv
import pinecone

load_dotenv()


cohere_api_key = os.getenv("COHERE_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")

cohere_url = "https://api.cohere.ai/embed"

# Initializing Pinecone
pinecone.init(api_key=pinecone_api_key, environment='your-pinecone-environment')
index = pinecone.Index('poc')

# Initialize S3
# import boto3
# s3 = boto3.client('s3')

def process_pdf(file_path):
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def generate_embeddings(text):
    chunks = [text[i:i+512] for i in range(0, len(text), 512)]  # chunking text into 512 character segments
    
    data = {"texts": chunks}
    headers = {
        "Authorization": f"Bearer {cohere_api_key}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(cohere_url, headers=headers, json=data)
    
    if response.status_code == 200:
        embeddings = response.json()["embeddings"]
    else:
        print(f"Error: {response.status_code}")
        embeddings = []
        
    return embeddings, chunks

def upload_and_insert(file_path, bucket_name, document_id):
    # Upload PDF to S3
    # s3.upload_file(file_path, bucket_name, file_path)

    # Process PDF and generate embeddings
    text = process_pdf(file_path)
    embeddings, chunks = generate_embeddings(text)

    # Insert embeddings into Pinecone
    for i, (embedding, chunk) in enumerate(zip(embeddings, chunks)):
        chunk_id = str(uuid.uuid4())
        index.upsert([
            {
                'id': chunk_id,
                'values': embedding,
                'metadata': {
                    'CollectionID': 'Grades-1-2',
                    'Username': 'andrewmc.wong@mail.utoronto.ca',
                    'ChunkID': chunk_id,
                    'DocumentID': f'document-{document_id}'
                }
            }
        ])

pdf_files = ['file1.pdf', 'file2.pdf', 'file3.pdf']  # Add your file paths
bucket_name = 'your-s3-bucket-name'

for i, file_path in enumerate(pdf_files):
    upload_and_insert(file_path, bucket_name, i+1)
