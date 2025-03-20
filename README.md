# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| Syrine Noamen | 314544 |
| Mariem Baccari| 324363 |
| Daniel Bucher | 351734 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (21st March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset
We chose to get our data from the [Semantic Scholar API](https://www.semanticscholar.org/product/api) which provides scientification publication data via an API. We will get fields such as the title of the paper, abstract, year of publication, citation count, venue and fields of study (e.g. mathematics, physics, computer science etc.). Each query needs to be provided a "query" parameter and it is possible to filter the results using the fields. 

The API being a reliable source, the data is of high quality and there will be minimal data-cleaning. We will use a Python script to download all needed data at once.

Additional datasets, which are well-structured, provide insights into how papers reference one another and include citation counts:
* https://www.aminer.cn/citation
* https://www.kaggle.com/datasets/mathurinache/citation-network-dataset (same as above, but the data can be downloaded faster)
* https://dblp.org/
* https://snap.stanford.edu/data/com-DBLP.html

### Problematic
As students, we often struggle to identify key research papers that define our field or keep up with the latest trends. Without proper guidance, it is difficult to find the foundational or high-impact papers, especially in rapidly evolving fields such as Computer Science and Physics. 

Our goal is to create a website that allows users to explore and dive deep into the most relevant research papers in their area of interest.

Our visualizations will show a citation network graph to demonstrate how papers are connected to each other which will allow us to identify the most influential contributions. The publication year will distinguish the foundational papers on the one hand and the current trends on the other hand. Our tool will make it easy for the users to access key information such as the abstract of the resulting papers. 
It will also be possible to see the most popular papers for each year. This will highlight any trend changes in specific fields. 
Similar techniques will help gain insights on authors, their collaboration network and influence; allowing us to discover the top researchers and key collaborations in a field. 

The platform can be useful for anyone from new students to curious individuals who would like to learn more about advancements accross the different fields. 

### Exploratory Data Analysis
Basic insights using the dataset can be found in [EDA.ipynb](https://github.com/com-480-data-visualization/DSM/blob/master/EDA.ipynb).

### Related work
Multiple platforms such as Google Scholar and Semantic Scholar provide free access to research papers. 
Instead of being a search engine we focus on on aggregating the most important information such that a newcomer is able to grasp the ABC's of their research field of interest. 

[Prof. Mathias Payer](https://nebelwelt.net/pubstats/) also used the DBLP dataset to count the number of publications a professor has made and to identify with whom they have collaborated (forming so-called cliques). We focus less on the professors and more on the actual papers, which are relevant to a specific subfield of computer science or another area of science.

## Milestone 2 (18th April, 5pm)

**10% of the final grade**


## Milestone 3 (30th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

