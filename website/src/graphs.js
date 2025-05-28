function loadGraphs(path) {
  Promise.all([d3.csv(`${path}/papers.csv`), d3.csv(`${path}/connections.csv`)]).then(
    ([papersRaw, connections]) => {
      const paperIds = new Set();
      connections.forEach((c) => {
        paperIds.add(c.source);
        paperIds.add(c.target);
      });

      const maxPapers = paperIds.size;
      const maxAuthors = new Set(
        papersRaw.flatMap((p) => (p.authors || '').split(';').map((a) => a.trim()))
      ).size;

      drawPapersByVenueSunburst(papersRaw);
      drawAuthorGraph(getMainAuthor(papersRaw, connections), papersRaw);
    }
  );
}

function drawPapersByVenueSunburst(papersRaw) {
  d3.select('#citation-network').selectAll('*').remove();

  const papers = papersRaw.filter(p => p.venue?.trim() !== '');
  const mainPaper = papersRaw[0];
  const mainPaperId = mainPaper?.paper_id;

  const data = { name: 'root', children: [] };
  const venueMap = new Map();

  papers.forEach(p => {
    if (!venueMap.has(p.venue)) {
      venueMap.set(p.venue, { name: p.venue, children: [] });
    }
    venueMap.get(p.venue).children.push({
      name: p.title,
      paper_id: p.paper_id,
      url: p.url
    });
  });

  if (mainPaper.venue.trim() === '') {
    mainPaper.venue = 'Unknown Venue';
  }

const sortedVenues = Array.from(venueMap.values())
  .sort((a, b) => b.children.length - a.children.length);

let totalPapers = 0;
const limitedVenues = [];

  let mainPaperAdded = false;

  for (const venue of sortedVenues) {
    if (totalPapers >= 50) break;

    const papersFromVenue = [];
    for (let paper of venue.children) {
      if (papersFromVenue.length < 10 && totalPapers < 50) {
        papersFromVenue.push(paper);
        totalPapers++;
        if (paper.paper_id === mainPaperId) {
          mainPaperAdded = true;
        }
      }
    }

    if (papersFromVenue.length > 0) {
      limitedVenues.push({
        name: venue.name,
        children: papersFromVenue
      });
    }
  }

    if (!mainPaperAdded) {
      let added = false;

      for (let venue of limitedVenues) {
        if (venue.name === mainPaper.venue) {
          venue.children.push({
            name: mainPaper.title,
            paper_id: mainPaper.paper_id,
            url: mainPaper.url
          });
          totalPapers++;
          added = true;
          break;
        }
      }

      if (!added) {
        limitedVenues.push({
          name: mainPaper.venue,
          children: [{
            name: mainPaper.title,
            paper_id: mainPaper.paper_id,
            url: mainPaper.url
          }].concat(venueMap.get(mainPaper.venue)?.children.filter(p => p.paper_id != mainPaperId).slice(0, 9) || [])
        });
        totalPapers++;
      }
    }

  data.children = limitedVenues;

  const width = 600;
  const radius = width / 2;
  const margin = 50;

  const partition = d3.partition().size([2 * Math.PI, radius]);

  const root = d3.hierarchy(data)
    .sum(d => d.children ? 0 : 1)
    .sort((a, b) => b.value - a.value);

  partition(root);

  const baseColor = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children.length + 1));
  const colorMap = new Map();
  root.children.forEach((venueNode, i) => {
    colorMap.set(venueNode.data.name, baseColor(i));
  });
  const highlightColor = '#FF0000';

  // Arc generator with larger outer radius for papers
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0)
    .outerRadius(d => {
      if (d.depth === 2) return d.y1 + 30; // extend outer arcs
      return d.y1 - 1;
    });

  const svg = d3.select('#citation-network')
    .append('svg')
    .attr('viewBox', [0, 0, width, width])
    .attr('width', width)
    .attr('height', width)
    .style('display', 'block')
    .style('margin', '0 auto')
    .style('font', '12px sans-serif');
  
  svg.attr('viewBox', [0 - margin, 0 - margin, width + 2 * margin, width + 2 * margin])

  const g = svg.append('g')
    .attr('transform', `translate(${width / 2},${width / 2})`);

  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('background', '#fff')
    .style('padding', '8px')
    .style('border', '1px solid #aaa')
    .style('border-radius', '4px')
    .style('display', 'none')
    .style('pointer-events', 'none');

  g.selectAll('path')
    .data(root.descendants().filter(d => d.depth))
    .join('path')
    .attr('fill', d => {
      if (d.data.paper_id === mainPaperId) return highlightColor;
      if (d.depth === 1) return colorMap.get(d.data.name) || '#ccc';
      if (d.depth === 2) {
        const venueName = d.ancestors()[1]?.data.name;
        return colorMap.get(venueName) || '#ccc';
      }
      return '#ccc';
    })
    .attr('d', arc)
    .on('mouseover', function (event, d) {
      d3.select(this).attr('stroke', '#000');
      tooltip.style('display', 'block').html(`<strong>${d.data.name}</strong>`);
    })
    .on('mousemove', function (event) {
      tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 20 + 'px');
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', null);
      tooltip.style('display', 'none');
    })
    .on('click', (event, d) => {
      if (d.data.url) window.open(d.data.url, '_blank');
    });

  // Labels
  g.append('g')
    .attr('pointer-events', 'none')
    .attr('text-anchor', 'middle')
    .selectAll('text')
    .data(root.descendants().filter(d => d.depth > 0))
    .join('text')
    .attr('transform', d => {
      const angle = (((d.x0 + d.x1) / 2) * 180) / Math.PI - 90;
      const r = (d.y0 + d.y1) / 2 + (d.depth === 2 ? 5 : 0);
      return `rotate(${angle}) translate(${r},0) rotate(${angle < 90 || angle > 270 ? 0 : 180})`;
    })
    .attr('dy', '0.35em')
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#fff')
    .text(d => {
      const span = d.x1 - d.x0;

      if (d.depth === 1) {
        const words = d.data.name.split(/\s+/);
        const acronym = words.find(w => /^[A-Z]{2,}$/.test(w));
        const fallback = words.find(w => /^[A-Z]/.test(w) && w !== acronym);
        return acronym
          ? `${acronym}${fallback ? ' (' + fallback + ')' : ''}`
          : d.data.name.slice(0, 10);
      }

      if (d.depth === 2) {
        const maxChars = span > 0.08 ? 20 : span > 0.05 ? 15 : 0;
        if (maxChars === 0) return '';
        let words = d.data.name.split(' ');
        let result = '';
        for (let word of words) {
          if ((result + word).length <= maxChars) {
            result += (result ? ' ' : '') + word;
          } else break;
        }
        return result + (result.length < d.data.name.length ? '…' : '');
      }

      return '';
    });
}

function getMainAuthor(papersRaw, connections, limit = 20) {
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

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = links.filter(
    (l) => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target)
  );

  const mainPaper = filteredNodes.reduce(
    (max, n) => (n.citations > max.citations ? n : max),
    filteredNodes[0]
  );

  return mainPaper.authors ? mainPaper.authors.split(';')[0] || 'unknown' : 'unknown';
}

function drawAuthorGraph(mainAuthor, papersRaw, limit = 100) {
  const WIDTH = 1800;
  const HEIGHT = 600;
  const COLOR_NODE = '#007acc';
  const COLOR_MAIN = '#8e44ad';
  const COLOR_ACTIVE = '#ff6f61';

  d3.select('#authors-network').html('');
  d3.selectAll('.author-tooltip').remove();

  const authorsMap = new Map(); // author → paper-count
  const authorToPapers = new Map(); // author → [{title,url}]
  const coauthorLinks = new Map(); // "A|B" → weight

  papersRaw.forEach((p) => {
    const title = p.title || 'Untitled';
    const url = p.url || '#';
    const authors = (p.authors || '')
      .split(';')
      .map((a) => a.trim())
      .filter(Boolean);

    authors.forEach((a) => {
      authorsMap.set(a, (authorsMap.get(a) || 0) + 1);
      (authorToPapers.get(a) || authorToPapers.set(a, []).get(a)).push({ title, url });
    });

    for (let i = 0; i < authors.length; ++i) {
      for (let j = i + 1; j < authors.length; ++j) {
        const key = [authors[i], authors[j]].sort().join('|');
        coauthorLinks.set(key, (coauthorLinks.get(key) || 0) + 1);
      }
    }
  });

  const topAuthors = Array.from(authorsMap, ([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  if (!topAuthors.some((a) => a.id === mainAuthor)) {
    topAuthors.push({ id: mainAuthor, count: authorsMap.get(mainAuthor) || 1 });
  }

  const topIds = new Set(topAuthors.map((a) => a.id));

  const links = Array.from(coauthorLinks, ([key, value]) => {
    const [source, target] = key.split('|');
    return { source, target, value };
  }).filter((l) => topIds.has(l.source) && topIds.has(l.target));

  const svg = d3
    .select('#authors-network')
    .append('svg')
    .attr('width', WIDTH)
    .attr('height', HEIGHT);

  const g = svg.append('g');
  svg.call(d3.zoom().on('zoom', ({ transform }) => g.attr('transform', transform)));

  g.append('g')
    .attr('stroke', '#ccc')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', 1);

  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'author-tooltip')
    .style('position', 'absolute')
    .style('padding', '6px 8px')
    .style('background', 'white')
    .style('border', '1px solid #ccc')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('max-width', '300px')
    .style('opacity', 0)
    .style('pointer-events', 'none')
    .style('z-index', 1000)
    .on('click', (e) => e.stopPropagation());

  let activeNode = null;

  const node = g
    .append('g')
    .selectAll('circle')
    .data(topAuthors)
    .join('circle')
    .attr('r', (d) => 10 + d.count)
    .attr('fill', (d) => (d.id === mainAuthor ? COLOR_MAIN : COLOR_NODE))
    .attr('stroke', '#333')
    .attr('stroke-width', 1.3)
    .style('cursor', 'pointer')
    .on('click', function (event, d) {
      event.stopPropagation(); // keep SVG’s click-to-hide from firing

      // second click on the same node → toggle off
      if (activeNode === this) {
        hideTooltip();
        return;
      }

      // switch active highlight
      if (activeNode) resetNodeColor(activeNode);
      activeNode = this;
      d3.select(this).attr('fill', COLOR_ACTIVE);

      const papers = authorToPapers.get(d.id) || [];
      const list = papers.length
        ? papers
            .map(
              (p) =>
                `<li><a href="${p.url}" target="_blank" class="text-blue-600 underline">${p.title}</a></li>`
            )
            .join('')
        : '<li><em>No papers available</em></li>';

      tooltip
        .html(
          `<strong>${d.id}</strong><br/>
             ${d.count} paper(s)
             <ul style="margin-top:4px;padding-left:18px;max-height:150px;overflow-y:auto;">
               ${list}
             </ul>`
        )
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY + 10 + 'px')
        .style('opacity', 1)
        .style('pointer-events', 'auto');
    })
    .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

  /* labels – mouse clicks should fall through to the circle */
  g.append('g')
    .selectAll('text')
    .data(topAuthors)
    .join('text')
    .text((d) => d.id)
    .attr('font-size', 10)
    .attr('fill', '#333')
    .attr('text-anchor', 'start')
    .style('pointer-events', 'none');

  /* click on empty space hides tooltip / un-highlights --------------------- */
  svg.on('click', hideTooltip);

  function hideTooltip() {
    tooltip.style('opacity', 0).style('pointer-events', 'none');

    if (activeNode) {
      resetNodeColor(activeNode);
      activeNode = null;
    }
  }

  function resetNodeColor(el) {
    d3.select(el).attr('fill', (d) => (d.id === mainAuthor ? COLOR_MAIN : COLOR_NODE));
  }

  const simulation = d3
    .forceSimulation(topAuthors)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(100)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2));

  const mainNode = topAuthors.find((a) => a.id === mainAuthor);
  if (mainNode) {
    mainNode.fx = WIDTH / 2;
    mainNode.fy = HEIGHT / 2;
  }

  simulation.on('tick', () => {
    g.selectAll('line')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);

    g.selectAll('text')
      .attr('x', (d) => d.x + 6)
      .attr('y', (d) => d.y + 4);
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

// function drawAuthorGraph(papersRaw, limit = 100) {
//   const width = 1800,
//     height = 600;
//   d3.select('#authors-network').html('');

//   const coauthorLinks = new Map();
//   const authorsMap = new Map();
//   const authorToPapers = new Map();

//   papersRaw.forEach((p) => {
//     const title = p.title || 'Untitled';
//     const url = p.url || '#';
//     const authors = p.authors
//       ? p.authors
//           .split(';')
//           .map((a) => a.trim())
//           .filter(Boolean)
//       : [];

//     authors.forEach((a) => {
//       authorsMap.set(a, (authorsMap.get(a) || 0) + 1);
//       if (!authorToPapers.has(a)) authorToPapers.set(a, []);
//       authorToPapers.get(a).push({ title, url });
//     });

//     for (let i = 0; i < authors.length; i++) {
//       for (let j = i + 1; j < authors.length; j++) {
//         const key = [authors[i], authors[j]].sort().join('|');
//         coauthorLinks.set(key, (coauthorLinks.get(key) || 0) + 1);
//       }
//     }
//   });

//   const topAuthors = Array.from(authorsMap.entries())
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, limit)
//     .map(([id, count]) => ({ id, count }));

//   const topAuthorIds = new Set(topAuthors.map((a) => a.id));

//   const links = Array.from(coauthorLinks.entries())
//     .map(([key, value]) => {
//       const [source, target] = key.split('|');
//       return { source, target, value };
//     })
//     .filter((l) => topAuthorIds.has(l.source) && topAuthorIds.has(l.target));

//   const connectedAuthorIds = new Set();
//   links.forEach((link) => {
//     connectedAuthorIds.add(link.source);
//     connectedAuthorIds.add(link.target);
//   });

//   const filteredNodes = topAuthors.filter((n) => connectedAuthorIds.has(n.id));

//   const svg = d3
//     .select('#authors-network')
//     .append('svg')
//     .attr('width', width)
//     .attr('height', height);

//   const g = svg.append('g');

//   svg.call(
//     d3.zoom().on('zoom', ({ transform }) => {
//       g.attr('transform', transform);
//     })
//   );

//   const link = g
//     .append('g')
//     .attr('stroke', '#ccc')
//     .attr('stroke-opacity', 0.6)
//     .selectAll('line')
//     .data(links)
//     .join('line')
//     .attr('stroke-width', 1);

//   const simulation = d3
//     .forceSimulation(filteredNodes)
//     .force(
//       'link',
//       d3
//         .forceLink(links)
//         .id((d) => d.id)
//         .distance(100)
//     )
//     .force('charge', d3.forceManyBody().strength(-300))
//     .force('center', d3.forceCenter(width / 2, height / 2));

//   const tooltip = d3
//     .select('body')
//     .append('div')
//     .attr('class', 'author-tooltip')
//     .style('position', 'absolute')
//     .style('padding', '6px 8px')
//     .style('background', 'white')
//     .style('border', '1px solid #ccc')
//     .style('border-radius', '4px')
//     .style('pointer-events', 'auto')
//     .style('font-size', '12px')
//     .style('max-width', '300px')
//     .style('z-index', 1000)
//     .style('opacity', 0);

//   let activeNode = null;
//   let hideTooltipTimeout = null;

//   tooltip
//     .on('mouseenter', () => clearTimeout(hideTooltipTimeout))
//     .on('mouseleave', () => {
//       tooltip.style('opacity', 0);
//       if (activeNode) {
//         d3.select(activeNode).attr('fill', '#007acc');
//         activeNode = null;
//       }
//     });

//   const node = g
//     .append('g')
//     .selectAll('circle')
//     .data(filteredNodes)
//     .join('circle')
//     .attr('r', (d) => 3 + d.count)
//     .attr('fill', '#007acc')
//     .attr('stroke', '#333')
//     .attr('stroke-width', 1.2)
//     .on('mouseover', function (e, d) {
//       if (activeNode && activeNode !== this) {
//         d3.select(activeNode).attr('fill', '#007acc');
//       }

//       activeNode = this;
//       d3.select(this).attr('fill', '#ff6f61');

//       const papers = authorToPapers.get(d.id) || [];
//       const paperList = papers
//         .map(
//           (p) =>
//             `<li><a href="${p.url}" target="_blank" class="text-blue-600 underline">${p.title}</a></li>`
//         )
//         .join('');

//       tooltip
//         .html(
//           `
//           <strong>${d.id}</strong><br>
//           ${d.count} paper(s)
//           <ul style="margin-top: 4px; padding-left: 18px; max-height: 150px; overflow-y: auto;">
//             ${paperList}
//           </ul>
//         `
//         )
//         .style('left', e.pageX + 10 + 'px')
//         .style('top', e.pageY + 'px')
//         .style('opacity', 1)
//         .style('pointer-events', 'auto');

//       clearTimeout(hideTooltipTimeout);
//     })
//     .on('mouseleave', function () {
//       hideTooltipTimeout = setTimeout(() => {
//         tooltip.style('opacity', 0);
//         if (activeNode) {
//           d3.select(activeNode).attr('fill', '#007acc');
//           activeNode = null;
//         }
//       }, 300);
//     })
//     .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

//   const label = g
//     .append('g')
//     .selectAll('text')
//     .data(filteredNodes)
//     .join('text')
//     .text((d) => d.id)
//     .attr('font-size', 10)
//     .attr('fill', '#333')
//     .attr('text-anchor', 'start');

//   simulation.on('tick', () => {
//     link
//       .attr('x1', (d) => d.source.x)
//       .attr('y1', (d) => d.source.y)
//       .attr('x2', (d) => d.target.x)
//       .attr('y2', (d) => d.target.y);

//     node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);

//     label.attr('x', (d) => d.x + 6).attr('y', (d) => d.y + 4);
//   });

//   function dragstarted(event, d) {
//     if (!event.active) simulation.alphaTarget(0.3).restart();
//     d.fx = d.x;
//     d.fy = d.y;
//   }

//   function dragged(event, d) {
//     d.fx = event.x;
//     d.fy = event.y;
//   }

//   function dragended(event, d) {
//     if (!event.active) simulation.alphaTarget(0);
//     d.fx = null;
//     d.fy = null;
//   }
//  }
