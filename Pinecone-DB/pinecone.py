import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the API key from the environment variable
api_key = os.getenv("COHERE_API_KEY")

# Define the API endpoint
url = "https://api.cohere.ai/embed"

# Define the text data
data = {
    "texts": [
        "This is the first sentence.",
        "Here is another sentence."
    ]
}

# Set the headers, including your API key
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Make the API request
response = requests.post(url, headers=headers, json=data)

# Check the response status
if response.status_code == 200:
    embeddings = response.json()["embeddings"]
    print(embeddings)
else:
    print(f"Error: {response.status_code}")
