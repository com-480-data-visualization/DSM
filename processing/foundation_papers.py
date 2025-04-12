import requests
import json
import time
from tqdm import tqdm

# Handpicked foundational CS papers with known publication years and summaries
foundation_papers = [
    {
        "title": "On Computable Numbers, with an Application to the Entscheidungsproblem",
        "year": 1936,
        "summary": "Alan Turing introduced the concept of a 'universal machine', laying the foundation for theoretical computer science and defining the limits of computation."
    },
    {
        "title": "A Mathematical Theory of Communication",
        "year": 1948,
        "summary": "Claude Shannon founded information theory, introducing entropy, channel capacity, and data compression — core to digital communication and storage."
    },
    {
        "title": "A Relational Model of Data for Large Shared Data Banks",
        "year": 1970,
        "summary": "Edgar F. Codd proposed the relational database model, transforming how structured data is stored and queried using tables and formal logic."
    },
    {
        "title": "The Complexity of Theorem-Proving Procedures",
        "year": 1971,
        "summary": "Stephen Cook introduced NP-completeness and formalized the P vs NP problem, becoming a cornerstone of computational complexity theory."
    },
    {
        "title": "A Protocol for Packet Network Intercommunication",
        "year": 1974,
        "summary": "Vint Cerf and Bob Kahn introduced TCP/IP, enabling scalable and robust communication across packet-switched networks — the foundation of the Internet."
    },
    {
        "title": "Information Management: A Proposal",
        "year": 1989,
        "summary": "Tim Berners-Lee proposed the World Wide Web, including URLs, HTTP, and HTML — a blueprint that led to the creation of the modern web."
    },
    {
        "title": "The Anatomy of a Large-Scale Hypertextual Web Search Engine",
        "year": 1998,
        "summary": "Page and Brin introduced Google and the PageRank algorithm, revolutionizing web search by ranking pages based on importance and structure."
    },
    {
        "title": "Recursive Functions of Symbolic Expressions and Their Computation by Machine",
        "year": 1960,
        "summary": "John McCarthy introduced Lisp and recursion in computing, laying the groundwork for symbolic AI and functional programming."
    },
    {
        "title": "Go To Statement Considered Harmful",
        "year": 1968,
        "summary": "Edsger W. Dijkstra famously criticized 'goto', advocating for structured programming — a shift that influenced modern programming languages."
    },
    {
        "title": "Time, Clocks, and the Ordering of Events in a Distributed System",
        "year": 1978,
        "summary": "Leslie Lamport introduced logical clocks and causal ordering, essential for consistency and coordination in distributed systems."
    },
    {
        "title": "No Silver Bullet—Essence and Accident in Software Engineering",
        "year": 1987,
        "summary": "Fred Brooks argued that no single breakthrough will solve software engineering challenges, emphasizing the complexity of software design."
    },
    {
        "title": "Attention Is All You Need",
        "year": 2017,
        "summary": "Vaswani et al. introduced the Transformer architecture, changing the landscape of NLP and enabling models like BERT and GPT."
    }
]

def fetch_foundation_papers(papers):
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    fields = "paperId,title,year,citationCount,fieldsOfStudy,authors"
    headers = {
        "User-Agent": "FoundationalPaperFetcher/1.0"
    }

    enriched = []

    for paper in tqdm(papers):
        params = {
            "query": paper["title"],
            "fields": fields,
            "limit": 10
        }

        success = False
        retries = 0
        while not success and retries < 5:
            try:
                response = requests.get(base_url, params=params, headers=headers)
                response.raise_for_status()
                success = True
            except requests.exceptions.RequestException as e:
                wait = 2 ** retries
                print(f"Retry in {wait}s for '{paper['title']}': {e}")
                time.sleep(wait)
                retries += 1

        if not success:
            print(f"Failed to fetch: {paper['title']}")
            continue

        results = response.json().get("data", [])
        match = next((r for r in results if abs(r.get("year") - paper["year"]) < 5), None)

        if match:
            enriched.append({
                "title": match.get("title", paper["title"]),
                "summary": paper["summary"],
                "year": match.get("year"),
                "citationCount": match.get("citationCount", 0),
                "authors": [a["name"] for a in match.get("authors", [])],
                "fieldsOfStudy": match.get("fieldsOfStudy", []),
                "paperId": match.get("paperId")
            })
        else:
            print(f"No year-matching result for '{paper['title']}' ({paper['year']})")

        time.sleep(1)  

    return enriched

if __name__ == "__main__":
    results = fetch_foundation_papers(foundation_papers)

    with open("foundational_papers.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nEnriched data saved: {len(results)} papers → foundational_papers_enriched.json")
