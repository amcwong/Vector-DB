import os
import requests
import uuid
import re
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
import boto3
import cohere

load_dotenv()

# text/txt -> vector -> pinecone

cohere_api_key = os.getenv("COHERE_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")


# cohere_url = "https://api.cohere.ai/embed"
co = cohere.Client(cohere_api_key)

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

index_name = "poc"
expected_dimension = 1024

# Create the Pinecone index if it doesn't exist
if index_name not in [index.name for index in pc.list_indexes().indexes]:
    pc.create_index(
        name=index_name,
        dimension=expected_dimension,
        metric='cosine',
        spec=ServerlessSpec(
            cloud='aws',
            region='us-east-1'
        )
    )
# Check if the index already exists and its dimension
index_info = pc.describe_index(index_name)
print(f"Index {index_name} dimension: {index_info['dimension']}")


index = pc.Index(index_name)

# Initialize S3
# s3 = boto3.client('s3')

def read_txt_file(file_path):
    with open(file_path, 'r') as file:
        text = file.read()
    return text

def chunk_text(text, max_tokens=400, tolerance=50):
    paragraphs = text.split('\n\n')
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for paragraph in paragraphs:
        sentences = re.split(r'(?<=[.!?]) +', paragraph)
        
        for sentence in sentences:
            sentence_length = len(sentence.split())
            
            if current_length + sentence_length > max_tokens + tolerance:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentence]
                current_length = sentence_length
            else:
                current_chunk.append(sentence)
                current_length += sentence_length

        if current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_length = 0

    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

def generate_embeddings(chunks):
    data = {"texts": chunks}
    # headers = {
    #     "Authorization": f"Bearer {cohere_api_key}",
    #     "Content-Type": "application/json"
    # }
    
    # response = requests.post(cohere_url, headers=headers, json=data)
    response = co.embed(
        texts=chunks, model="embed-english-v3.0", input_type="search_document"
    )
    
    
    embeddings = response.embeddings
    if embeddings and len(embeddings[0]) != expected_dimension:
        raise ValueError(f"Returned embedding dimension {len(embeddings[0])} does not match the expected dimension {expected_dimension}")
        
    return embeddings

def upload_and_insert(file_path, bucket_name, document_id):
    # s3.upload_file(file_path, bucket_name, file_path)

    text = read_txt_file(file_path)
    chunks = chunk_text(text)
    embeddings = generate_embeddings(chunks)

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

# Determine the absolute path to the directory
script_dir = os.path.dirname(os.path.abspath(__file__))
txt_dir = os.path.join(script_dir, 'adobe-txt-transcriptions/1-2/')
print("Directory being searched:", txt_dir)

txt_files = [os.path.join(txt_dir, f) for f in os.listdir(txt_dir) if f.endswith('.txt')]
bucket_name = 'your-s3-bucket-name'

for i, file_path in enumerate(txt_files):
    upload_and_insert(file_path, bucket_name, i+1)
