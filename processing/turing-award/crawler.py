import requests
from bs4 import BeautifulSoup
import re
import os
import json
from urllib.parse import urljoin, urlparse
from tqdm import tqdm

def fetch_turing_award_winners():
    base_url = "https://amturing.acm.org/"
    by_year_url = urljoin(base_url, "byyear.cfm")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/122.0.0.0 Safari/537.36'
    }

    os.makedirs("images", exist_ok=True)

    response = requests.get(by_year_url, headers=headers)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    winners_data = []

    # Collect all (year, anchor) pairs
    winner_entries = []
    for li in soup.find_all('li'):
        text = li.get_text(strip=True)
        match = re.match(r'\((\d{4})\)(.+)', text)
        if match:
            year = match.group(1)
            anchors = li.find_all('a')
            for anchor in anchors:
                winner_entries.append((year, anchor))

    # Progress bar for each winner
    for year, anchor in tqdm(winner_entries, desc="Scraping winners", unit="winner"):
        name = anchor.get_text(strip=True)
        profile_rel_link = anchor['href']
        profile_url = urljoin(base_url, profile_rel_link)

        # Fetch individual profile page
        profile_response = requests.get(profile_url, headers=headers)
        profile_response.raise_for_status()
        profile_soup = BeautifulSoup(profile_response.text, 'html.parser')

        # Extract citation from <div class="citation"><p>...</p></div>
        citation = ""
        citation_div = profile_soup.find('div', class_='citation')
        if citation_div:
            citation_p = citation_div.find('p')
            if citation_p:
                citation = citation_p.get_text(strip=True)

        # Extract country from <div class="description"><span>Country – Year</span></div>
        country = ""
        desc_div = profile_soup.find('div', class_='description')
        if desc_div:
            span = desc_div.find('span')
            if span:
                text = span.get_text(strip=True)
                country = text.split("–")[0].strip()

        # Extract profile image from the featured-photo section
        image_url = ""
        image_filename = ""
        photo_div = profile_soup.find("div", class_="featured-photo")
        if photo_div:
            img_tag = photo_div.find("img")
            if img_tag and 'src' in img_tag.attrs:
                image_src = img_tag['src']
                image_url = urljoin(base_url, image_src)
                image_filename = os.path.basename(urlparse(image_url).path)
                image_path = os.path.join("images", image_filename)

                if not os.path.exists(image_path):
                    img_response = requests.get(image_url, headers=headers)
                    if img_response.status_code == 200:
                        with open(image_path, 'wb') as f:
                            f.write(img_response.content)

        winners_data.append({
            'year': year,
            'name': name,
            'profile_url': profile_url,
            'citation': citation,
            'country': country,
            'image_filename': image_filename
        })

    return winners_data

if __name__ == "__main__":
    print("🚀 Starting scrape of Turing Award winners...")
    winners = fetch_turing_award_winners()

    with open('turing_award_winners.json', 'w', encoding='utf-8') as f:
        json.dump(winners, f, ensure_ascii=False, indent=4)

    print("✅ Done! Data saved to 'turing_award_winners.json'")
