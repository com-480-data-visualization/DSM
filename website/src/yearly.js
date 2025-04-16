const colorYearly = d3.scaleOrdinal(d3.schemeTableau10);

function parseAuthors(authorsStr) {
  try {
    const fixed = authorsStr.replace(/'/g, '"');
    const parsed = JSON.parse(fixed);
    return Array.isArray(parsed) ? parsed.map((a) => a.name) : [];
  } catch {
    return [];
  }
}

function renderTopPapers(papers) {
  const container = d3.select('#yearly-top-papers').html('');
  papers.forEach((paper, i) => {
    const div = container.append('div').attr('class', 'mb-4');
    div
      .append('p')
      .attr('class', 'font-bold')
      .text(`${i + 1}. ${paper.title}`);
    div
      .append('p')
      .attr('class', 'text-sm text-gray-600')
      .text(`Citations: ${paper.citationCount}`);
  });
}

function renderVenueChart(authors) {
  const width = 500;
  const height = 400;
  const margin = { top: 20, right: 20, bottom: 80, left: 80 };

  const svg = d3
    .select('#yearly-top-authors')
    .html('')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3
    .scaleBand()
    .domain(authors.map((d) => d.name))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(authors, (d) => d.citations)])
    .nice()
    .range([innerHeight, 0]);

  chart
    .append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  chart.append('g').call(d3.axisLeft(y));

  const authorColorMap = new Map();

  const bars = chart
    .selectAll('rect')
    .data(authors)
    .enter()
    .append('rect')
    .attr('x', (d) => x(d.name))
    .attr('width', x.bandwidth())
    .attr('y', innerHeight)
    .attr('height', 0)
    .attr('fill', (d, i) => {
      const color = colorYearly(i);
      authorColorMap.set(d.name, color);
      return color;
    });

  return { bars, y, innerHeight, authorColorMap };
}

function renderSankeyDiagram(data, authorColorMap) {
  const svg = d3
    .select('#yearly-sankey')
    .html('')
    .append('svg')
    .attr('width', 700)
    .attr('height', 500);

  const sankey = d3
    .sankey()
    .nodeWidth(15)
    .nodePadding(12)
    .extent([
      [1, 1],
      [699, 499],
    ]);

  const { nodes, links } = sankey(data);

  svg
    .append('g')
    .selectAll('rect')
    .data(nodes)
    .join('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('height', (d) => d.y1 - d.y0)
    .attr('width', (d) => d.x1 - d.x0)
    .attr('fill', (d) => {
      if (d.name.startsWith('A:')) {
        const author = d.name.replace('A:', '');
        return authorColorMap.get(author) || '#60a5fa';
      }
      return '#a78bfa'; // for venues
    });

  svg
    .append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .attr('x', (d) => (d.x0 < 350 ? d.x1 + 6 : d.x0 - 6))
    .attr('y', (d) => (d.y0 + d.y1) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => (d.x0 < 350 ? 'start' : 'end'))
    .attr('fill', '#111827')
    .style('font-size', '12px')
    .text((d) => d.name.replace(/^A:|^V:/, ''));

  svg
    .append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', (d) => Math.max(1, d.width))
    .attr('opacity', 0.5)
    .append('title')
    .text(
      (d) =>
        `${nodes[d.source.index].name.replace(/^A:/, '')} → ${nodes[d.target.index].name.replace(/^V:/, '')}: ${d.value}`
    );
}

function loadYearlyData(year, observer) {
  d3.csv(`data/trending/${year}.csv`)
    .then((data) => {
      const sortedPapers = data
        .filter((d) => d.title && d.citationCount)
        .sort((a, b) => +b.citationCount - +a.citationCount);
      const topPapers = sortedPapers.slice(0, 5);
      renderTopPapers(topPapers);

      const authorMap = new Map();
      topPapers.forEach((paper) => {
        const authors = parseAuthors(paper.authors);
        const citations = +paper.citationCount || 0;
        authors.forEach((name) => {
          authorMap.set(name, (authorMap.get(name) || 0) + citations);
        });
      });

      const topAuthors = Array.from(authorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, citations]) => ({ name, citations }));

      const venues = [
        { name: 'Computers and Education: Artificial Intelligence', citations: 37 },
        { name: 'Conference on Fairness, Accountability and Transparency', citations: 36 },
        { name: 'International Conference on Learning Representations', citations: 25 },
        { name: 'Nature', citations: 25 },
        { name: 'IEEE Access', citations: 15 },
      ];

      const { bars, y, innerHeight, authorColorMap } = renderVenueChart(venues);

      const target = document.querySelector('#yearly-top-authors svg');
      if (target) observer.observe(target);

      const nodeSet = new Set();
      const linkMap = new Map();

      topPapers.forEach((paper) => {
        const authors = parseAuthors(paper.authors);
        const venue = paper.venue;
        if (!venue) return;

        authors.forEach((name) => {
          if (topAuthors.find((a) => a.name === name)) {
            const authorNode = `A:${name}`;
            const venueNode = `V:${venue}`;
            nodeSet.add(authorNode);
            nodeSet.add(venueNode);

            const key = `${authorNode}|${venueNode}`;
            linkMap.set(key, (linkMap.get(key) || 0) + 1);
          }
        });
      });

      const nodes = Array.from(nodeSet).map((name) => ({ name }));
      const nodeIndex = new Map(nodes.map((d, i) => [d.name, i]));

      const links = Array.from(linkMap.entries()).map(([key, value]) => {
        const [sourceName, targetName] = key.split('|');
        return {
          source: nodeIndex.get(sourceName),
          target: nodeIndex.get(targetName),
          value,
        };
      });

      renderSankeyDiagram({ nodes, links }, authorColorMap);
    })
    .catch((error) => {
      console.error('Error loading CSV for year:', year, error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const yearSelect = document.getElementById('year-select');
  if (!yearSelect) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const svg = d3.select('#yearly-top-authors svg');
          const bars = svg.selectAll('rect');
          const height = +svg.attr('height') - 100;
          const maxCitations = d3.max(bars.data(), (d) => d.citations);
          const y = d3.scaleLinear().domain([0, maxCitations]).range([height, 0]);

          bars.attr('y', height).attr('height', 0);

          bars
            .transition()
            .duration(800)
            .delay((d, i) => i * 100)
            .attr('y', (d) => y(d.citations))
            .attr('height', (d) => height - y(d.citations));
        }
      });
    },
    { threshold: 0.3 }
  );

  loadYearlyData(yearSelect.value, observer);

  yearSelect.addEventListener('change', (e) => {
    loadYearlyData(e.target.value, observer);
  });
});
