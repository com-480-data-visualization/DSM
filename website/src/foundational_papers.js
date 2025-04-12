const svg = d3.select('#foundational-timeline');
const width = +svg.attr('width');
const height = +svg.attr('height');

const margin = { top: 40, right: 30, bottom: 50, left: 30 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

const tooltipPapers = d3
  .select('#timeline-tooltip')
  .style('position', 'absolute')
  .style('background', 'white')
  .style('padding', '12px')
  .style('border', '1px solid #ccc')
  .style('border-radius', '8px')
  .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
  .style('pointer-events', 'none')
  .style('max-width', '300px')
  .style('opacity', 0)
  .style('font-size', '0.9rem')
  .style('color', '#111');

d3.json('data/foundational_papers.json').then((data) => {
  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.year))
    .range([0, innerWidth])
    .nice();

  const size = d3
    .scaleSqrt()
    .domain(d3.extent(data, (d) => d.citationCount))
    .range([6, 25]);

  g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));

  g.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', (d) => x(d.year))
    .attr('cy', innerHeight / 2)
    .attr('r', (d) => size(d.citationCount))
    .attr('fill', '#4f46e5')
    .attr('opacity', 0.85)
    .on('mouseover', (event, d) => {
      tooltipPapers
        .html(
          `
          <strong>${d.title}</strong><br/>
          <em>${d.authors.join(', ')}</em><br/>
          <strong>${d.citationCount.toLocaleString()} citations</strong><br/>
          <span>${d.summary}</span>
        `
        )
        .style('left', event.pageX + 15 + 'px')
        .style('top', event.pageY - 30 + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1);
    })
    .on('mouseout', () => {
      tooltipPapers.transition().duration(200).style('opacity', 0);
    });
});
