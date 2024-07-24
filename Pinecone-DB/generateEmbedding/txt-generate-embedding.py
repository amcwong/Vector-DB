import os
import requests
import uuid
from dotenv import load_dotenv
import pinecone
import boto3

# Load environment variables from .env file
load_dotenv()

# Get the API keys from the environment variables
cohere_api_key = os.getenv("COHERE_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")

# Define the Cohere API endpoint
cohere_url = "https://api.cohere.ai/embed"

# Initialize Pinecone
pinecone.init(api_key=pinecone_api_key, environment='your-pinecone-environment')
index = pinecone.Index('poc')

# Initialize S3
# s3 = boto3.client('s3')

def read_txt_file(file_path):
    with open(file_path, 'r') as file:
        text = file.read()
    return text

def chunk_text(text, max_tokens=400, tolerance=50):
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0

    for word in words:
        if current_length + len(word.split()) > max_tokens + tolerance:
            chunks.append(" ".join(current_chunk))
            current_chunk = [word]
            current_length = len(word.split())
        else:
            current_chunk.append(word)
            current_length += len(word.split())

    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

def generate_embeddings(chunks):
    # Prepare data for Cohere API
    data = {"texts": chunks}
    headers = {
        "Authorization": f"Bearer {cohere_api_key}",
        "Content-Type": "application/json"
    }
    
    # Make API request to Cohere to get embeddings
    response = requests.post(cohere_url, headers=headers, json=data)
    
    if response.status_code == 200:
        embeddings = response.json()["embeddings"]
    else:
        print(f"Error: {response.status_code}")
        embeddings = []
        
    return embeddings

def upload_and_insert(file_path, bucket_name, document_id):
    # Upload .txt file to S3
    # s3.upload_file(file_path, bucket_name, file_path)

    # Read text from .txt file and generate embeddings
    text = read_txt_file(file_path)
    chunks = chunk_text(text)
    embeddings = generate_embeddings(chunks)

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

# Process all .txt files in the specified directory
txt_dir = './adobe-txt-transcriptions/1-2/'
txt_files = [os.path.join(txt_dir, f) for f in os.listdir(txt_dir) if f.endswith('.txt')]
bucket_name = 'your-s3-bucket-name'

for i, file_path in enumerate(txt_files):
    upload_and_insert(file_path, bucket_name, i+1)
