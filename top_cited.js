function parseAuthors(raw) {
  if (!raw) return [];
  return raw.split(';').map((d) => d.trim());
}

function renderPapers(papers) {
  const container = d3.select('#top-cited-papers').html('');
  papers.forEach((paper, i) => {
    const div = container
      .append('div')
      .attr('class', 'p-4 border rounded-lg hover:bg-gray-50 cursor-pointer')
      .on('click', () => showDetails(paper));

    div
      .append('p')
      .attr('class', 'font-semibold text-blue-700')
      .text(`${i + 1}. ${paper.title}`);

    div
      .append('p')
      .attr('class', 'text-sm text-gray-600')
      .text(
        `${
          parseAuthors(paper.author_name)
            .filter((n) => n != 'nan')
            .join(', ') || 'Unknown authors'
        } • ${Math.floor(paper.n_citation)} citations`
      );
  });
}

function showDetails(paper) {
  d3.select('#detail-title').text(paper.title);
  d3.select('#detail-authors').text(
    `Authors: ${parseAuthors(paper.author_name).join(', ') || 'Unknown'}`
  );
  d3.select('#detail-venue').text(`Venue: ${paper.venue_name || 'N/A'}`);
  d3.select('#detail-year').text(`Year: ${paper.year || 'N/A'}`);
  d3.select('#detail-doi').html(
    paper.doi
      ? `DOI Link: <a href="${paper.doi}" target="_blank" class="text-blue-600 underline">${paper.doi}</a>`
      : `🔗 DOI: N/A`
  );
  d3.select('#detail-keywords').text(`Keywords: ${paper.keyword || 'None'}`);
  d3.select('#paper-details').classed('hidden', false);
}

function renderTopAuthors(papers) {
  const authorMap = new Map();
  papers.forEach((p) => {
    const authors = parseAuthors(p.author_name);
    const citations = +p.n_citation || 0;
    authors.forEach((name) => {
      authorMap.set(name, (authorMap.get(name) || 0) + citations);
    });
  });

  const topAuthors = Array.from(authorMap.entries())
    .filter(([name, _]) => name != 'nan')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, citations]) => ({ name, citations }));

  const width = 500,
    height = 400,
    margin = { top: 20, right: 20, bottom: 80, left: 80 };
  const svg = d3
    .select('#top-authors-chart')
    .html('')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const x = d3
    .scaleBand()
    .domain(topAuthors.map((d) => d.name))
    .range([0, width - margin.left - margin.right])
    .padding(0.2);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(topAuthors, (d) => d.citations)])
    .nice()
    .range([height - margin.top - margin.bottom, 0]);

  chart
    .append('g')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  chart.append('g').call(d3.axisLeft(y));

  const colorMap = new Map();
  chart
    .selectAll('rect')
    .data(topAuthors)
    .enter()
    .append('rect')
    .attr('x', (d) => x(d.name))
    .attr('y', (d) => y(d.citations))
    .attr('width', x.bandwidth())
    .attr('height', (d) => height - margin.top - margin.bottom - y(d.citations))
    .attr('fill', (d, i) => {
      const c = color(i);
      colorMap.set(d.name, c);
      return c;
    });

  return colorMap;
}

function renderSankey(papers, colorMap) {
  const nodeSet = new Set();
  const linkMap = new Map();

  papers.forEach((p) => {
    const authors = parseAuthors(p.author_name);
    const venue = p.venue_name;
    if (!venue) return;
    authors.forEach((name) => {
      const a = `A:${name}`,
        v = `V:${venue}`;
      nodeSet.add(a);
      nodeSet.add(v);
      const key = `${a}|${v}`;
      linkMap.set(key, (linkMap.get(key) || 0) + 1);
    });
  });

  const nodes = Array.from(nodeSet).map((name) => ({ name }));
  const nodeIndex = new Map(nodes.map((d, i) => [d.name, i]));
  const links = Array.from(linkMap.entries()).map(([key, value]) => {
    const [s, t] = key.split('|');
    return { source: nodeIndex.get(s), target: nodeIndex.get(t), value };
  });

  const sankey = d3
    .sankey()
    .nodeWidth(15)
    .nodePadding(12)
    .extent([
      [1, 1],
      [699, 499],
    ]);

  const { nodes: layoutNodes, links: layoutLinks } = sankey({ nodes, links });

  const svg = d3
    .select('#sankey-chart')
    .html('')
    .append('svg')
    .attr('width', 700)
    .attr('height', 500);

  svg
    .append('g')
    .selectAll('rect')
    .data(layoutNodes)
    .join('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('height', (d) => d.y1 - d.y0)
    .attr('width', (d) => d.x1 - d.x0)
    .attr('fill', (d) => {
      if (d.name.startsWith('A:')) {
        const author = d.name.slice(2);
        return colorMap.get(author) || '#60a5fa';
      }
      return '#a78bfa';
    });

  svg
    .append('g')
    .selectAll('text')
    .data(layoutNodes)
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
    .data(layoutLinks)
    .join('path')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', (d) => Math.max(1, d.width))
    .attr('opacity', 0.5)
    .append('title')
    .text(
      (d) =>
        `${layoutNodes[d.source.index].name.replace(/^A:/, '')} → ${layoutNodes[d.target.index].name.replace(/^V:/, '')}: ${d.value}`
    );
}

document.addEventListener('DOMContentLoaded', () => {
  let allData = [];

  d3.csv('data/high_citations_all_dblp.csv').then((data) => {
    allData = data;
    updateVisuals(5); // default

    document.getElementById('paper-limit').addEventListener('change', (e) => {
      const limit = +e.target.value;
      updateVisuals(limit);
    });
  });

  function updateVisuals(limit) {
    const topPapers = allData
      .filter((d) => d.title && d.n_citation)
      .sort((a, b) => +b.n_citation - +a.n_citation)
      .slice(0, limit);

    renderPapers(topPapers);
    const colorMap = renderTopAuthors(topPapers);
    renderSankey(topPapers, colorMap);
  }
});
