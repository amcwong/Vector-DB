import requests
import os
import time
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

# Load environment variables from .env file
load_dotenv()

# Get the API keys from the environment variables
cohere_api_key = os.getenv("COHERE_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")

# Define the Cohere API endpoint
cohere_url = "https://api.cohere.ai/embed"

# Define the text data
texts = [
    "This is the first sentence.",
    "Here is another sentence."
]

data = {
    "texts": texts
}

# Set the headers for Cohere API
cohere_headers = {
    "Authorization": f"Bearer {cohere_api_key}",
    "Content-Type": "application/json"
}

# Make the API request to Cohere to get embeddings
cohere_response = requests.post(cohere_url, headers=cohere_headers, json=data)

# Check the Cohere API response status
if cohere_response.status_code == 200:
    embeddings = cohere_response.json()["embeddings"]
    print("Embeddings from Cohere:", embeddings[0:10], "...")
else:
    print(f"Error: {cohere_response.status_code}")
    embeddings = []

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

# Define the Pinecone index name and dimension
index_name = "example-index"
dimension = len(embeddings[0])

# Create the Pinecone index
if index_name not in pc.list_indexes().names():
    pc.create_index(
        name=index_name,
        dimension=dimension,
        metric='cosine',
        spec=ServerlessSpec(
            cloud='aws',
            region='us-east-1'
        )
    )
index = pc.Index(index_name)

# Ingest embeddings into Pinecone and measure latency
ingestion_start_time = time.time()

vectors = [(str(i), embedding) for i, embedding in enumerate(embeddings)]
index.upsert(vectors)

ingestion_end_time = time.time()
ingestion_latency = ingestion_end_time - ingestion_start_time
print(f"Ingestion Latency: {ingestion_latency} seconds")

# Perform a retrieval to test latency
query_vector = embeddings[0]

retrieval_start_time = time.time()

# Use keyword arguments for the query method
response = index.query(vector=query_vector, top_k=5)

retrieval_end_time = time.time()
retrieval_latency = retrieval_end_time - retrieval_start_time

print(f"Retrieval Latency: {retrieval_latency} seconds")
print("Retrieval Response:", response)

# Clean up: delete the index (optional)
pc.delete_index(index_name)
