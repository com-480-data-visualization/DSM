let venueMeta = {};
d3.json('data/venues.json').then((d) => {
  d.venues.forEach((v) => {
    const key = v.name.trim().toLowerCase();
    venueMeta[key] = v;
  });
});

document.addEventListener('DOMContentLoaded', () => {
  let allData = [];

  d3.csv('data/high_citations_all_dblp.csv').then((data) => {
    allData = data.filter((d) => {
      const vt = (d.venue_type || '').toLowerCase().trim();
      const vn = (d.venue_name || '').toLowerCase().trim();
      return vt !== 'book' && vn !== '' && vn !== 'n/a';
    });

    updateVisuals(5);

    d3.select('#paper-limit').on('change', function () {
      updateVisuals(+this.value);
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

/**-------------rendering functions---------------------*/

function renderPapers(papers) {
  const container = d3.select('#top-cited-papers').html('');
  papers.forEach((paper, i) => {
    const div = container
      .append('div')
      .attr('class', 'p-4 border rounded-lg hover:bg-gray-50 cursor-pointer')
      .on('click', () => toggleDetails(paper));

    div
      .append('p')
      .attr('class', 'font-semibold text-blue-700')
      .text(`${i + 1}. ${paper.title}`);

    div
      .append('p')
      .attr('class', 'text-sm text-gray-600')
      .text(
        `${
          parseAuthors(paper.author_name).join(', ') || 'Unknown authors'
        } • ${formatNumberWithQuote(Math.floor(paper.n_citation))} citations`
      );
  });
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
    margin = { top: 40, right: 40, bottom: 100, left: 100 };
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
  svg
    .append('text')
    .attr('transform', `rotate(-90)`)
    .attr('x', -height / 2)
    .attr('y', 15)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-sm font-semibold fill-gray-700')
    .text('Total Citations');

  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-sm font-semibold fill-gray-700')
    .text('Author');

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
      const c = color(d.name);
      colorMap.set(d.name, c);
      return c;
    });

  return colorMap;
}

function renderSankey(papers) {
  const width = 700,
    height = 500;

  const nodeSet = new Set(),
    linkMap = new Map();
  papers.forEach((p) => {
    const authors = parseAuthors(p.author_name),
      venue = p.venue_name && p.venue_name.trim();
    if (!venue) return;
    authors.forEach((name) => {
      const a = `A:${name}`,
        v = `V:${venue}`,
        key = `${a}|${v}`;
      nodeSet.add(a);
      nodeSet.add(v);
      linkMap.set(key, (linkMap.get(key) || 0) + 1);
    });
  });
  const nodes = Array.from(nodeSet).map((name) => ({ name })),
    nodeIndex = new Map(nodes.map((d, i) => [d.name, i])),
    links = Array.from(linkMap.entries()).map(([key, value]) => {
      const [s, t] = key.split('|');
      return { source: nodeIndex.get(s), target: nodeIndex.get(t), value };
    });

  const { nodes: Lnodes, links: Llinks } = d3
    .sankey()
    .nodeWidth(15)
    .nodePadding(12)
    .extent([
      [1, 1],
      [width - 1, height - 1],
    ])({ nodes, links });

  const authorNames = Lnodes.filter((d) => d.name.startsWith('A:')).map((d) => d.name.slice(2)),
    venueNames = Lnodes.filter((d) => d.name.startsWith('V:')).map((d) => d.name.slice(2));
  const authorColor = d3.scaleOrdinal(d3.schemeCategory10).domain(authorNames),
    venueColor = d3.scaleOrdinal(d3.schemeSet3).domain(venueNames);

  const svg = d3
    .select('#sankey-chart')
    .html('')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  function hideVenueDetails() {
    d3.select('#venue-details')
      .classed('hidden', true)
      .classed('opacity-0', true)
      .classed('pointer-events-none', true);
  }
  function showVenueDetails() {
    d3.select('#venue-details')
      .classed('hidden', false)
      .classed('opacity-0', false)
      .classed('pointer-events-none', false);
  }
  hideVenueDetails(); // start hidden

  let lastClicked = null;

  svg
    .append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(Llinks)
    .join('path')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', (d) => Math.max(1, d.width))
    .attr('opacity', 0.5)
    .on('mouseover', function (e, d) {
      const auth = Lnodes[d.source.index].name.slice(2);
      d3.select(this).attr('stroke', authorColor(auth)).attr('opacity', 0.8).raise();
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', '#d1d5db').attr('opacity', 0.5);
    })
    .on('click', function (e, d) {
      if (lastClicked === this) {
        lastClicked = null;
        return hideVenueDetails();
      }
      lastClicked = this;
      const ven = Lnodes[d.target.index].name.slice(2).trim().toLowerCase();
      const meta = venueMeta[ven];

      if (meta) {
        d3.select('#venue-title').text(meta.name);
        d3.select('#venue-url').attr('href', meta.url).text(meta.url);
        d3.select('#venue-info').text(meta.info);
      } else {
        d3.select('#venue-title').text(Lnodes[d.target.index].name.slice(2));
        d3.select('#venue-url').attr('href', '#').text('');
        d3.select('#venue-info').text('No metadata available.');
      }
      showVenueDetails();
    })
    .append('title')
    .text((d) => `${Lnodes[d.target.index].name.slice(2)}: ${d.value}`);

  const nodeRects = svg
    .append('g')
    .selectAll('rect')
    .data(Lnodes)
    .join('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('width', (d) => d.x1 - d.x0)
    .attr('height', (d) => d.y1 - d.y0)
    .attr('fill', (d) =>
      d.name.startsWith('A:') ? authorColor(d.name.slice(2)) : venueColor(d.name.slice(2))
    )
    .attr('stroke', '#333')
    .attr('stroke-width', 0.5)
    .filter((d) => d.name.startsWith('V:'))
    .on('click', function (e, d) {
      if (lastClicked === this) {
        lastClicked = null;
        return hideVenueDetails();
      }
      lastClicked = this;
      const key = d.name.slice(2).trim().toLowerCase(),
        meta = venueMeta[key];
      if (!meta) {
        d3.select('#venue-title').text(d.name.slice(2));
        d3.select('#venue-url').attr('href', '#').text('');
        d3.select('#venue-info').text('No metadata available.');
      } else {
        d3.select('#venue-title').text(meta.name);
        d3.select('#venue-url').attr('href', meta.url).text(meta.url);
        d3.select('#venue-info').text(meta.info);
      }
      showVenueDetails();
    });

  svg
    .append('g')
    .selectAll('text')
    .data(Lnodes)
    .join('text')
    .attr('x', (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr('y', (d) => (d.y0 + d.y1) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => (d.x0 < width / 2 ? 'start' : 'end'))
    .style('font-weight', 'bold')
    .style('font-size', '12px')
    .text((d) => d.name.replace(/^A:|^V:/, ''));
}

/**-------------utility functions---------------------*/
function parseAuthors(raw) {
  if (!raw) return [];
  return raw
    .split(';')
    .map((d) => d.trim())
    .filter((a) => a && a.length > 0 && a.toLowerCase() !== 'nan');
}

function formatNumberWithQuote(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

let lastOpenPaperId = null;

function toggleDetails(paper) {
  const detailsEl = d3.select('#paper-details');

  if (lastOpenPaperId === paper.id) {
    detailsEl.classed('hidden', true);
    lastOpenPaperId = null;
    return;
  }

  lastOpenPaperId = paper.id;
  showDetails(paper);
  detailsEl.classed('hidden', false);
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
  const kwDiv = d3.select('#detail-keywords').html('').append('div').attr('class', 'mt-2');

  if (paper.keyword) {
    const kws = paper.keyword
      .split(';')
      .map((k) => k.trim())
      .filter((k) => k);
    const ul = kwDiv
      .append('ul')
      .attr('class', 'list-disc list-inside space-y-1 text-gray-700 text-sm');

    ul.text('Keywords:');
    kws.forEach((k) => {
      ul.append('li').text(k);
    });
  } else {
    kwDiv.append('p').attr('class', 'text-sm text-gray-600').text('Keywords: None');
  }

  d3.select('#paper-details').classed('opacity-0 pointer-events-none', false);
}
