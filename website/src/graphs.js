function loadGraphs(path) {
  Promise.all([d3.csv(`${path}/papers.csv`), d3.csv(`${path}/connections.csv`)]).then(
    ([papersRaw, connections]) => {
      const paperIds = new Set();
      connections.forEach((c) => {
        console.log(c);
        paperIds.add(c.source);
        paperIds.add(c.target);
      });

      const maxPapers = paperIds.size;
      //log max papers and the ids
      console.log('Max papers:', maxPapers);
      console.log('Paper IDs:', Array.from(paperIds));
      const maxAuthors = new Set(
        papersRaw.flatMap((p) => (p.authors || '').split(';').map((a) => a.trim()))
      ).size;

      const paperSlider = document.getElementById('paper-count');
      const paperValue = document.getElementById('paper-count-value');
      paperSlider.max = maxPapers;
      paperSlider.value = Math.min(20, maxPapers);
      paperValue.textContent = paperSlider.value;

      const authorSlider = document.getElementById('author-count');
      const authorValue = document.getElementById('author-count-value');
      authorSlider.max = maxAuthors;
      authorSlider.value = Math.min(100, maxAuthors);
      authorValue.textContent = authorSlider.value;

      drawCitationGraph(papersRaw, connections, +paperSlider.value);
      drawAuthorGraph(papersRaw, +authorSlider.value);

      paperSlider.oninput = () => {
        paperValue.textContent = paperSlider.value;
        drawCitationGraph(papersRaw, connections, +paperSlider.value);
      };

      authorSlider.oninput = () => {
        authorValue.textContent = authorSlider.value;
        drawAuthorGraph(papersRaw, +authorSlider.value);
      };
    }
  );
}

function drawCitationGraph(papersRaw, connections, limit = 20) {
  const width = 1200,
    height = 900;
  d3.select('#citation-network').html('');

  const papers = {};
  papersRaw.forEach((p) => {
    papers[p.paper_id] = {
      title: p.title,
      year: +p.year,
      authors: p.authors || 'Unknown author',
      url: p.url || '#',
    };
  });

  const citationCounts = {};
  connections.forEach((c) => {
    citationCounts[c.target] = (citationCounts[c.target] || 0) + 1;
  });

  const nodeMap = {};
  const allIds = new Set();
  connections.forEach((c) => {
    allIds.add(c.source);
    allIds.add(c.target);
  });

  const nodes = [];
  allIds.forEach((id) => {
    const paper = papers[id];
    if (paper) {
      const node = {
        id,
        title: paper.title,
        year: paper.year,
        authors: paper.authors,
        url: paper.url,
        citations: citationCounts[id] || 0,
      };
      nodeMap[id] = node;
      nodes.push(node);
    }
  });

  const links = connections.filter((c) => nodeMap[c.source] && nodeMap[c.target]);

  const filteredNodes = nodes
    .filter((n) => n.citations >= 0)
    .sort((a, b) => b.citations - a.citations)
    .slice(0, limit);
  console.log('limit', limit);

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = links.filter(
    (l) => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target)
  );

  const mainPaper = filteredNodes.reduce(
    (max, n) => (n.citations > max.citations ? n : max),
    filteredNodes[0]
  );

  const centerX = width / 2;
  const centerY = height / 2;
  mainPaper.x = centerX;
  mainPaper.y = centerY;

  const others = filteredNodes.filter((n) => n.id !== mainPaper.id);
  const radius = Math.min(width, height) / 3;
  const angleStep = (2 * Math.PI) / others.length;

  others.forEach((node, i) => {
    const angle = i * angleStep;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
  });

  const svg = d3
    .select('#citation-network')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const colorScale = d3
    .scaleSequential()
    .domain(d3.extent(filteredNodes, (d) => d.year))
    .interpolator(d3.interpolateViridis);

  const sizeScale = d3
    .scaleLinear()
    .domain(d3.extent(filteredNodes, (d) => d.citations))
    .range([10, 25]);

  svg
    .append('g')
    .attr('stroke', '#ccc')
    .attr('stroke-opacity', 0.5)
    .selectAll('line')
    .data(filteredLinks)
    .join('line')
    .attr('x1', (d) => nodeMap[d.source].x)
    .attr('y1', (d) => nodeMap[d.source].y)
    .attr('x2', (d) => nodeMap[d.target].x)
    .attr('y2', (d) => nodeMap[d.target].y)
    .attr('stroke-width', 1);

  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'citation-tooltip')
    .style('position', 'absolute')
    .style('padding', '6px 8px')
    .style('background', 'rgba(0,0,0,0.7)')
    .style('color', 'white')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('font-size', '14px')
    .style('max-width', '400px')
    .style('opacity', 0);

  const node = svg
    .append('g')
    .selectAll('circle')
    .data(filteredNodes)
    .join('circle')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', (d) => sizeScale(d.citations))
    .attr('fill', (d) => colorScale(d.year))
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .style('cursor', (d) => (d.url && d.url !== '#' ? 'pointer' : 'default'))
    .on('mouseover', function (event, d) {
      tooltip
        .html(`<strong>${d.title}</strong><br/>Author(s): ${d.authors}`)
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY + 10 + 'px')
        .style('opacity', 1);
    })
    .on('mousemove', function (event) {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY + 10 + 'px');
    })
    .on('mouseout', function () {
      tooltip.style('opacity', 0);
    })
    .on('click', (event, d) => {
      if (d.url && d.url !== '#') {
        window.open(d.url, '_blank');
      }
    });

  svg
    .append('g')
    .selectAll('text')
    .data(filteredNodes)
    .join('text')
    .attr('x', (d) => d.x + 20)
    .attr('y', (d) => d.y + 6)
    .text((d) => (d.title.length > 20 ? d.title.slice(0, 20) + '...' : d.title))
    .attr('font-size', 16)
    .attr('fill', '#333');
}

function drawAuthorGraph(papersRaw, limit = 100) {
  const width = 1800,
    height = 600;
  d3.select('#authors-network').html('');

  const coauthorLinks = new Map();
  const authorsMap = new Map();
  const authorToPapers = new Map();

  papersRaw.forEach((p) => {
    const title = p.title || 'Untitled';
    const url = p.url || '#';
    const authors = p.authors
      ? p.authors
          .split(';')
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    authors.forEach((a) => {
      authorsMap.set(a, (authorsMap.get(a) || 0) + 1);
      if (!authorToPapers.has(a)) authorToPapers.set(a, []);
      authorToPapers.get(a).push({ title, url });
    });

    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const key = [authors[i], authors[j]].sort().join('|');
        coauthorLinks.set(key, (coauthorLinks.get(key) || 0) + 1);
      }
    }
  });

  const topAuthors = Array.from(authorsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));

  const topAuthorIds = new Set(topAuthors.map((a) => a.id));

  const links = Array.from(coauthorLinks.entries())
    .map(([key, value]) => {
      const [source, target] = key.split('|');
      return { source, target, value };
    })
    .filter((l) => topAuthorIds.has(l.source) && topAuthorIds.has(l.target));

  const connectedAuthorIds = new Set();
  links.forEach((link) => {
    connectedAuthorIds.add(link.source);
    connectedAuthorIds.add(link.target);
  });

  const filteredNodes = topAuthors.filter((n) => connectedAuthorIds.has(n.id));

  const svg = d3
    .select('#authors-network')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g');

  svg.call(
    d3.zoom().on('zoom', ({ transform }) => {
      g.attr('transform', transform);
    })
  );

  const link = g
    .append('g')
    .attr('stroke', '#ccc')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', 1);

  const simulation = d3
    .forceSimulation(filteredNodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(100)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'author-tooltip')
    .style('position', 'absolute')
    .style('padding', '6px 8px')
    .style('background', 'white')
    .style('border', '1px solid #ccc')
    .style('border-radius', '4px')
    .style('pointer-events', 'auto')
    .style('font-size', '12px')
    .style('max-width', '300px')
    .style('z-index', 1000)
    .style('opacity', 0);

  let activeNode = null;
  let hideTooltipTimeout = null;

  tooltip
    .on('mouseenter', () => clearTimeout(hideTooltipTimeout))
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
      if (activeNode) {
        d3.select(activeNode).attr('fill', '#007acc');
        activeNode = null;
      }
    });

  const node = g
    .append('g')
    .selectAll('circle')
    .data(filteredNodes)
    .join('circle')
    .attr('r', (d) => 3 + d.count)
    .attr('fill', '#007acc')
    .attr('stroke', '#333')
    .attr('stroke-width', 1.2)
    .on('mouseover', function (e, d) {
      if (activeNode && activeNode !== this) {
        d3.select(activeNode).attr('fill', '#007acc');
      }

      activeNode = this;
      d3.select(this).attr('fill', '#ff6f61');

      const papers = authorToPapers.get(d.id) || [];
      const paperList = papers
        .map(
          (p) =>
            `<li><a href="${p.url}" target="_blank" class="text-blue-600 underline">${p.title}</a></li>`
        )
        .join('');

      tooltip
        .html(
          `
          <strong>${d.id}</strong><br>
          ${d.count} paper(s)
          <ul style="margin-top: 4px; padding-left: 18px; max-height: 150px; overflow-y: auto;">
            ${paperList}
          </ul>
        `
        )
        .style('left', e.pageX + 10 + 'px')
        .style('top', e.pageY + 'px')
        .style('opacity', 1)
        .style('pointer-events', 'auto');

      clearTimeout(hideTooltipTimeout);
    })
    .on('mouseleave', function () {
      hideTooltipTimeout = setTimeout(() => {
        tooltip.style('opacity', 0);
        if (activeNode) {
          d3.select(activeNode).attr('fill', '#007acc');
          activeNode = null;
        }
      }, 300);
    })
    .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

  const label = g
    .append('g')
    .selectAll('text')
    .data(filteredNodes)
    .join('text')
    .text((d) => d.id)
    .attr('font-size', 10)
    .attr('fill', '#333')
    .attr('text-anchor', 'start');

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);

    label.attr('x', (d) => d.x + 6).attr('y', (d) => d.y + 4);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}
