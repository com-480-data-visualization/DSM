import requests
import json
import time
import os
import networkx as nx
import matplotlib.pyplot as plt
from collections import defaultdict
import csv

class SemanticScholarClient:
    BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/"
    
    def __init__(self, max_retries=20, timeout=10, delay_between_requests=1):
        self.max_retries = max_retries
        self.timeout = timeout
        self.delay_between_requests = delay_between_requests
        self.session = requests.Session()
        
    def fetch_paper_data(self, paper_id):
        """Fetch paper data from Semantic Scholar API with retry logic."""
        url = f"{self.BASE_URL}{paper_id}?fields=title,authors,year,venue,url,citations,references"
        
        retry_count = 0
        success = False
        
        while not success and retry_count < self.max_retries:
            try:
                response = self.session.get(url, timeout=self.timeout)
                response.raise_for_status()  # Raise exception for 4XX/5XX responses
                success = True
                # Successful response, return the data
                return response.json()
                
            except requests.exceptions.RequestException as e:
                retry_count += 1
                wait_time = min(self.delay_between_requests * (2 ** retry_count), 60)  # Cap at 60 seconds
                print(f"Attempt {retry_count} failed: {str(e)}")
                print(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        
        print(f"Failed to fetch data for paper ID: {paper_id} after {self.max_retries} attempts")
        return None
    
    def build_citation_network(self, root_paper_id, max_depth=2, direction="references"):
        """
        Build a citation network starting from a root paper.
        
        Parameters:
        - root_paper_id: ID of the starting paper
        - max_depth: How many levels deep to explore
        - direction: "references" (papers cited by root) or "citations" (papers citing root)
        
        Returns:
        - Dictionary containing the paper network data
        """
        if direction not in ["references", "citations"]:
            raise ValueError("Direction must be 'references' or 'citations'")
        
        # Initialize network
        network = {
            "papers": {},
            "connections": []
        }
        
        # First, make sure we can get the root paper data
        root_paper_data = self.fetch_paper_data(root_paper_id)
        if not root_paper_data:
            print("ERROR: Failed to fetch root paper data after multiple attempts. Exiting.")
            return network  # Return empty network
        
        # Store root paper info
        network["papers"][root_paper_id] = {
            "title": root_paper_data.get("title", "Unknown"),
            "authors": [author.get("name", "Unknown Author") for author in root_paper_data.get("authors", [])],
            "year": root_paper_data.get("year"),
            "venue": root_paper_data.get("venue"),
            "url": root_paper_data.get("url")
        }
        
        # Queue of papers to process: (paper_id, depth)
        queue = [(root_paper_id, 0)]
        processed_ids = set([root_paper_id])
        
        while queue:
            current_id, depth = queue.pop(0)
            print(f"Processing paper {current_id} at depth {depth}")
            
            # We already have the root paper data
            if current_id != root_paper_id:
                # Fetch paper data
                paper_data = self.fetch_paper_data(current_id)
                if not paper_data:
                    print(f"WARNING: Failed to get data for paper {current_id}, skipping...")
                    continue
                    
                # Store paper info
                network["papers"][current_id] = {
                    "title": paper_data.get("title", "Unknown"),
                    "authors": [author.get("name", "Unknown Author") for author in paper_data.get("authors", [])],
                    "year": paper_data.get("year"),
                    "venue": paper_data.get("venue"),
                    "url": paper_data.get("url")
                }
            else:
                paper_data = root_paper_data
            
            # Stop expanding if we've reached max depth
            if depth >= max_depth:
                continue
                
            # Process connections based on direction
            if direction == "references":
                connections = paper_data.get("references", [])
            else:  # citations
                connections = paper_data.get("citations", [])
                
            # Check if we have valid connections
            if not connections:
                print(f"No {direction} found for paper {current_id}")
                continue
                
            for connection in connections:
                connected_id = connection.get("paperId")
                if not connected_id:
                    continue
                    
                # Add to network connections
                if direction == "references":
                    network["connections"].append({
                        "source": current_id,
                        "target": connected_id
                    })
                else:  # citations
                    network["connections"].append({
                        "source": connected_id,
                        "target": current_id
                    })
                
                # Add to processing queue if not already processed
                if connected_id not in processed_ids:
                    queue.append((connected_id, depth + 1))
                    processed_ids.add(connected_id)
                
            # Respect rate limits
            time.sleep(self.delay_between_requests)
        
        # Verify we have some data before returning
        if not network["papers"]:
            print("WARNING: No papers were successfully processed. Network is empty.")
        else:
            print(f"Successfully processed {len(network['papers'])} papers with {len(network['connections'])} connections.")
            
        return network
        
    def extract_author_collaboration_network(self, citation_network):
        """
        Extract author collaboration network from citation network.
        
        Returns a dictionary mapping author pairs to collaboration count.
        """
        collaborations = defaultdict(int)
        author_papers = defaultdict(list)
        
        # Check if we have papers to process
        if not citation_network["papers"]:
            print("WARNING: No papers in citation network, cannot extract author collaborations.")
            return {
                "collaborations": {},
                "author_papers": {}
            }
        
        # Collect all papers for each author
        for paper_id, paper_info in citation_network["papers"].items():
            authors = paper_info["authors"]
            
            if not authors:
                continue
                
            # Record each author's papers
            for author in authors:
                if author:  # Skip empty authors
                    author_papers[author].append(paper_id)
            
            # Record collaborations within papers
            for i in range(len(authors)):
                for j in range(i+1, len(authors)):
                    # Skip if either author is empty
                    if not authors[i] or not authors[j]:
                        continue
                        
                    # Use tuple to ensure order doesn't matter
                    author_pair = tuple(sorted([authors[i], authors[j]]))
                    collaborations[author_pair] += 1
        
        return {
            "collaborations": dict(collaborations),
            "author_papers": dict(author_papers)
        }

def save_to_json(data, filename):
    """Save data to a JSON file."""
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Data saved to {filename}")

def save_to_csv(data, filename):
    """Save network data to CSV files."""
    import csv
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
    
    # Check if we have data to save
    if not data["papers"]:
        print("WARNING: No paper data to save to CSV.")
        return
    
    # Save papers data
    papers_file = f"{filename}_papers.csv"
    with open(papers_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["paper_id", "title", "authors", "year", "venue", "url"])
        for paper_id, info in data["papers"].items():
            writer.writerow([
                paper_id,
                info["title"],
                "; ".join(info["authors"]),
                info["year"],
                info["venue"],
                info["url"]
            ])
    
    # Save connections data
    connections_file = f"{filename}_connections.csv"
    with open(connections_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["source", "target"])
        for conn in data["connections"]:
            writer.writerow([conn["source"], conn["target"]])
    
    print(f"Data saved to {papers_file} and {connections_file}")

def visualize_citation_network(network_data, output_file="citation_network.png"):
    """Visualize the citation network using NetworkX."""
    if not network_data["papers"] or not network_data["connections"]:
        print("WARNING: Not enough data to visualize citation network.")
        return None
    
    G = nx.DiGraph()
    
    # Add nodes (papers)
    for paper_id, paper_info in network_data["papers"].items():
        G.add_node(paper_id, title=paper_info["title"], year=paper_info["year"])
    
    # Add edges (citations)
    for connection in network_data["connections"]:
        source = connection["source"]
        target = connection["target"]
        if source in network_data["papers"] and target in network_data["papers"]:
            G.add_edge(source, target)
    
    if not G.nodes():
        print("WARNING: No nodes to visualize in citation network.")
        return None
    
    plt.figure(figsize=(12, 12))
    pos = nx.spring_layout(G)
    
    nx.draw_networkx_nodes(G, pos, node_size=100, alpha=0.7)
    nx.draw_networkx_edges(G, pos, alpha=0.3, arrows=True)
    
    # Add labels with shortened titles
    labels = {paper_id: (paper_info["title"][:20] + "..." if paper_info["title"] else "Unknown")
             for paper_id, paper_info in network_data["papers"].items() if paper_id in G.nodes()}
    nx.draw_networkx_labels(G, pos, labels=labels, font_size=8)
    
    plt.title("Citation Network")
    plt.axis('off')
    plt.tight_layout()
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else '.', exist_ok=True)
    
    plt.savefig(output_file, dpi=300)
    print(f"Network visualization saved to {output_file}")
    
    return G

def visualize_author_network(author_data, output_file="author_network.png"):
    """Visualize the author collaboration network using NetworkX."""
    if not author_data["collaborations"]:
        print("WARNING: No collaborations to visualize author network.")
        return None
    
    G = nx.Graph()
    
    # Add nodes (authors)
    authors = set()
    for author_pair in author_data["collaborations"].keys():
        authors.update(author_pair)
    
    for author in authors:
        G.add_node(author)
    
    # Add edges (collaborations)
    for (author1, author2), weight in author_data["collaborations"].items():
        G.add_edge(author1, author2, weight=weight)
    
    plt.figure(figsize=(14, 14))
    
    # Position nodes using force-directed layout
    pos = nx.spring_layout(G, k=0.3)
    
    # Node sizes based on number of papers
    node_sizes = [len(author_data["author_papers"].get(author, [])) * 50 for author in G.nodes()]
    
    # Edge weights based on collaboration count
    edge_weights = [G[u][v]['weight'] for u, v in G.edges()]
    
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, alpha=0.7)
    nx.draw_networkx_edges(G, pos, width=edge_weights, alpha=0.5)
    nx.draw_networkx_labels(G, pos, font_size=10)
    
    plt.title("Author Collaboration Network")
    plt.axis('off')
    plt.tight_layout()
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else '.', exist_ok=True)
    
    plt.savefig(output_file, dpi=300)
    print(f"Author network visualization saved to {output_file}")
    
    return G

def visualize_author_network_better(author_data, top_authors=20, min_collaborations=2, output_file="author_network.png"):
    """
    Visualize the author collaboration network using NetworkX.
    
    Parameters:
    - author_data: Dictionary with collaborations and author_papers
    - top_authors: Maximum number of authors to display
    - min_collaborations: Minimum number of collaborations to show a connection
    - output_file: Path to save the visualization
    """
    if not author_data["collaborations"]:
        print("WARNING: No collaborations to visualize author network.")
        return None
    
    G = nx.Graph()
    
    # Filter collaborations by minimum weight
    filtered_collaborations = {pair: weight for pair, weight in author_data["collaborations"].items() 
                              if weight >= min_collaborations}
    
    if not filtered_collaborations:
        print(f"WARNING: No collaborations with at least {min_collaborations} papers together.")
        # Fall back to using all collaborations
        filtered_collaborations = author_data["collaborations"]
    
    # Identify top authors by number of papers
    author_paper_counts = {author: len(papers) for author, papers in author_data["author_papers"].items()}
    top_author_list = sorted(author_paper_counts.items(), key=lambda x: x[1], reverse=True)[:top_authors]
    top_author_set = set(author for author, _ in top_author_list)
    
    # Add nodes for top authors
    for author, paper_count in top_author_list:
        G.add_node(author, papers=paper_count)
    
    # Add edges for collaborations between top authors
    for (author1, author2), weight in filtered_collaborations.items():
        if author1 in top_author_set and author2 in top_author_set:
            G.add_edge(author1, author2, weight=weight)
    
    if not G.nodes():
        print("WARNING: No nodes to visualize in author network.")
        return None
    
    # Remove isolated nodes
    isolated_nodes = [node for node in G.nodes() if G.degree(node) == 0]
    G.remove_nodes_from(isolated_nodes)
    print(f"Removed {len(isolated_nodes)} isolated authors from visualization")
    
    plt.figure(figsize=(14, 14))
    
    # Position nodes using force-directed layout with stronger repulsion for better spacing
    #pos = nx.spring_layout(G, k=0.5, iterations=100)
    pos = nx.kamada_kawai_layout(G)  # Often gives more organic layouts
    
    # Node sizes based on number of papers
    node_sizes = [author_paper_counts[author] * 30 for author in G.nodes()]
    
    # Edge widths based on collaboration count
    edge_weights = [G[u][v]['weight'] * 0.8 for u, v in G.edges()]
    
    # Draw nodes
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, alpha=0.7, 
                          node_color='lightblue', edgecolors='black')
    
    # Draw edges with width proportional to collaboration strength
    nx.draw_networkx_edges(G, pos, width=edge_weights, alpha=0.5, edge_color='gray')
    
    # Draw labels
    nx.draw_networkx_labels(G, pos, font_size=9, font_weight='bold')
    
    plt.title(f"Author Collaboration Network (Top {len(G.nodes())} authors)")
    plt.axis('off')
    plt.tight_layout()
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else '.', exist_ok=True)
    
    plt.savefig(output_file, dpi=300)
    print(f"Author network visualization saved to {output_file}")
    
    return G

def read_network_csv(papers_csv, connections_csv):
    """
    Read network data from CSV files and construct the network dictionary.
    
    Parameters:
    - papers_csv: Path to the CSV file containing paper data
    - connections_csv: Path to the CSV file containing connection data
    
    Returns:
    - Dictionary with the network structure
    """
    network_data = {
        "papers": {},
        "connections": []
    }
    
    # Read papers data
    with open(papers_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            paper_id = row['paper_id']
            network_data["papers"][paper_id] = {
                "title": row['title'],
                "authors": [author.strip() for author in row['authors'].split(';')] if row['authors'] else [],
                "year": int(row['year']) if row['year'] and row['year'].isdigit() else None,
                "venue": row['venue'],
                "url": row['url']
            }
    
    # Read connections data
    with open(connections_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            network_data["connections"].append({
                "source": row['source'],
                "target": row['target']
            })
    
    return network_data

def extract_author_collaboration_network(citation_network):
    """
    Extract author collaboration network from citation network.
    
    Returns a dictionary mapping author pairs to collaboration count.
    """
    collaborations = defaultdict(int)
    author_papers = defaultdict(list)
    
    # Check if we have papers to process
    if not citation_network["papers"]:
        print("WARNING: No papers in citation network, cannot extract author collaborations.")
        return {
            "collaborations": {},
            "author_papers": {}
        }
    
    # Collect all papers for each author
    for paper_id, paper_info in citation_network["papers"].items():
        authors = paper_info["authors"]
        
        if not authors:
            continue
            
        # Record each author's papers
        for author in authors:
            if author:  # Skip empty authors
                author_papers[author].append(paper_id)
        
        # Record collaborations within papers
        for i in range(len(authors)):
            for j in range(i+1, len(authors)):
                # Skip if either author is empty
                if not authors[i] or not authors[j]:
                    continue
                    
                # Use tuple to ensure order doesn't matter
                author_pair = tuple(sorted([authors[i], authors[j]]))
                collaborations[author_pair] += 1
    
    return {
        "collaborations": dict(collaborations),
        "author_papers": dict(author_papers)
    }

def main():
    # Example: U-Net paper ID on Semantic Scholar
    paper_id = input("Enter the Semantic Scholar paper ID (or press Enter for U-Net example): ")
    if not paper_id:
        paper_id = "204e3073870fae3d05bcbc2f6a8e263d9b72e776"  # attention is all you need paper
        #"627be67feb084f1266cfc36e5aed3c3e7e6ce5f0" # map reduce paper
        #"4e9ec92a90c5d571d2f1d496f8df01f0a8f38596" # Bitcoin paper
        #"6364fdaa0a0eccd823a779fcdd489173f938e91a"  # U-Net paper
    
    # Create client
    client = SemanticScholarClient(max_retries=20, timeout=15, delay_between_requests=1)
    
    # Set parameters
    max_depth = int(input("Enter maximum depth for citation network (default: 1): ") or 1)
    direction = input("Build network based on 'references' or 'citations'? (default: citations): ") or "citations"
    
    # Build citation network
    print(f"Building {direction} network for paper {paper_id} with depth {max_depth}...")
    network_data = client.build_citation_network(paper_id, max_depth=max_depth, direction=direction)
    
    # Check if we have valid data before proceeding
    if not network_data["papers"]:
        print("ERROR: No valid paper data was retrieved. Exiting without saving.")
        return
    
    # Extract author collaboration network
    author_network = client.extract_author_collaboration_network(network_data)
    
    # Choose output format
    output_format = input("Save data as 'json' or 'csv'? (default: csv): ") or "csv"
    
    # Save data
    base_filename = f"semantic_scholar_{paper_id}_{direction}"
    output_dir = "/home/syrine/Desktop/MA4/DataViz/citations/"
    
    if output_format.lower() == "json":
        save_to_json(network_data, f"{output_dir}{base_filename}_network.json")
        save_to_json(author_network, f"{output_dir}{base_filename}_author_network.json")
    else:
        save_to_csv(network_data, f"{output_dir}{base_filename}")
    
    # Visualize networks
    visualize = input("Visualize networks? (y/n, default: n): ") or "n"
    if visualize.lower() == "y":
         print("Creating visualizations...")
         visualize_citation_network(network_data, f"{output_dir}{base_filename}_visual.png")
         visualize_author_network(author_network, f"{output_dir}{base_filename}_author_visual.png")
    
    print("Done!")

if __name__ == "__main__":
    main()
