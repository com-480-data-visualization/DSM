import requests
import time
import json
import pandas as pd
from tqdm import tqdm

def fetch_trending_cs_papers(max_papers=1000, year_range=None):
    """
    Fetch computer science papers with high citation counts
    
    Args:
        max_papers: Maximum number of papers to fetch
        year_range: Optional tuple of (start_year, end_year) to filter papers
        
    Returns:
        List of papers sorted by citation count
    """
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    
    # Fields to fetch
    fields = ["paperId", "title", "abstract", "year", "venue", "publicationTypes", 
             "authors", "citationCount", "fieldsOfStudy"]
    field_param = ",".join(fields)
    
    # Add year filter if specified
    year_filter = ""
    if year_range:
        start_year, end_year = year_range
        year_filter = f" year>={start_year} year<={end_year}"
    
    # Build the query for CS papers
    query = "fieldsOfStudy:Computer Science" + year_filter
    
    all_papers = []
    offset = 0
    
    with tqdm(total=max_papers) as pbar:
        while len(all_papers) < max_papers:
            # Build query parameters
            params = {
                "query": query,
                "fields": field_param,
                "limit": 100,  # Max allowed by API
                "offset": offset,
                "sort": "citationCount:desc"  # Sort by highest citation count first
            }
            
            # Make request with retries for rate limiting
            max_retries = 5
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
    
    return all_papers

if __name__ == "__main__":
    import datetime
    current_year = datetime.datetime.now().year
    
    # Fetch papers from the last 5 years
    papers = fetch_trending_cs_papers(
        max_papers=1000,
        year_range=(current_year-5, current_year)
    )
    
    # Save results to JSON file
    with open("trending_cs_papers.json", "w") as f:
        json.dump(papers, f)
    
    # Convert to pandas DataFrame for analysis
    df = pd.DataFrame(papers)
    df.to_csv("trending_cs_papers.csv", index=False)
    
    print(f"Total papers fetched: {len(papers)}")
    
    # Display citation statistics
    if len(papers) > 0:
        citation_counts = [p.get("citationCount", 0) for p in papers]
        print(f"Citation count - Min: {min(citation_counts)}, Max: {max(citation_counts)}, Avg: {sum(citation_counts)/len(citation_counts):.1f}")
        
        # Show top 5 papers by citation
        print("\nTop 5 papers by citation count:")
        for i, paper in enumerate(papers[:5]):
            print(f"{i+1}. {paper['title']} ({paper['year']}) - {paper.get('citationCount', 0)} citations")