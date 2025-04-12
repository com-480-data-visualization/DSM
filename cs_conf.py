import requests
import time
import json
import pandas as pd
from tqdm import tqdm

def fetch_cs_conference_papers(max_papers=5000, year_range=None, fields=None):
    """
    Fetch computer science conference papers using Semantic Scholar API
    
    Args:
        max_papers: Maximum number of papers to fetch
        year_range: Optional tuple of (start_year, end_year) to filter papers
        fields: Optional list of fields to include in the response
        
    Returns:
        List of conference papers
    """
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    
    # Default fields to fetch if none provided
    if fields is None:
        fields = ["paperId", "title", "abstract", "year", "venue", "PublicationTypes", "authors", "citationCount","influentialCitationCount", "references", "fieldsOfStudy"]
    field_param = ",".join(fields)
    
    # Build the query - search for papers with publicationType "Conference"
    # and filter by field of study "Computer Science"
    #query = "publicationType:Conference"
    #query = "publicationTypes:JournalArticle"
    
    # Add year filter if specified
    year_filter = ""
    if year_range:
        start_year, end_year = year_range
        year_filter = f" year>={start_year} year<={end_year}"
    
    all_papers = []
    offset = 0
    
    with tqdm(total=max_papers) as pbar:
        while len(all_papers) < max_papers:
            # Build query parameters
            params = {
                "query": "" + year_filter,
                "fields": field_param,
                "limit": min(100, max_papers - len(all_papers)),
                "offset": offset,
                "fieldsOfStudy": "Computer Science" , # Filter to computer science papers
                "publicationTypes": ["Conference", "JournalArticle"] 
            }
            
            # Make request with exponential backoff for rate limiting
            max_retries = 10 # increment
            retry_count = 0
            success = False
            
            while not success and retry_count < max_retries:
                try:
                    response = requests.get(base_url, params=params)
                    response.raise_for_status()
                    success = True
                except requests.exceptions.RequestException as e:
                    retry_count += 1
                    wait_time = 2 ** retry_count  # Exponential backoff
                    print(f"Request failed, retrying in {wait_time} seconds: {e}")
                    time.sleep(wait_time)
            
            if not success:
                print(f"Failed to fetch data after {max_retries} retries")
                break
            
            data = response.json()
            batch = data.get("data", [])
            
            if not batch:
                # No more papers to fetch
                break
            
            all_papers.extend(batch)
            pbar.update(len(batch))
            
            # Increment offset for next request
            offset += len(batch)
            
            # Respect rate limiting
            time.sleep(1)
    year_filter = ""
    if year_range:
        start_year, end_year = year_range
        year_filter = f" year>={start_year} year<={end_year}"
    
    all_papers = []
    offset = 0
    
    with tqdm(total=max_papers) as pbar:
        while len(all_papers) < max_papers:
            # Build query parameters
            params = {
                "query": "" + year_filter,
                "fields": field_param,
                "limit": min(100, max_papers - len(all_papers)),
                "offset": offset,
                "fieldsOfStudy": "Physics" , # Filter to computer science papers
                "publicationTypes": ["Conference", "JournalArticle"] 
            }
            
            # Make request with exponential backoff for rate limiting
            max_retries = 10 # increment
            retry_count = 0
            success = False
            
            while not success and retry_count < max_retries:
                try:
                    response = requests.get(base_url, params=params)
                    response.raise_for_status()
                    success = True
                except requests.exceptions.RequestException as e:
                    retry_count += 1
                    wait_time = 2 ** retry_count  # Exponential backoff
                    print(f"Request failed, retrying in {wait_time} seconds: {e}")
                    time.sleep(wait_time)
            
            if not success:
                print(f"Failed to fetch data after {max_retries} retries")
                break
            
            data = response.json()
            batch = data.get("data", [])
            
            if not batch:
                # No more papers to fetch
                break
            
            all_papers.extend(batch)
            pbar.update(len(batch))
            
            # Increment offset for next req
    return all_papers

if __name__ == "__main__":
    current_year = 2025  
    papers = fetch_cs_conference_papers(
        max_papers=7000, 
        year_range=(current_year - 10, current_year)
    )
    
    # Save results to JSON file
    with open("cs_conference_journals.json", "w") as f:
        json.dump(papers, f)

    
    # Convert to pandas DataFrame for analysis
    df = pd.DataFrame(papers)
    df.to_csv("cs_conference_journals.csv", index=False)
    
    print(f"Total papers fetched: {len(papers)}")