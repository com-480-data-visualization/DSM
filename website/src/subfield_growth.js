document.addEventListener('DOMContentLoaded', () => {
  const margin = { top: 20, right: 200, bottom: 50, left: 60 };
  const svg = d3.select('#subfield-growth');
  const width = +svg.attr('width') - margin.left - margin.right;
  const height = +svg.attr('height') - margin.top - margin.bottom;
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  d3.json('data/subfield_growth.json').then((data) => {
    const x = d3.scaleLinear().domain(d3.extent(data.years)).range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([2, d3.max(Object.values(data.subfields), (d) => d3.max(d.smooth)) + 1])
      .range([height, 0]);

    const xAxis = d3.axisBottom(x).ticks(10).tickFormat(d3.format('d'));
    const yAxis = d3
      .axisLeft(y)
      .ticks(8)
      .tickFormat((d) => `${d}%`);

    g.append('g').attr('transform', `translate(0,${height})`).call(xAxis);

    g.append('g').call(yAxis);

    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 40)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 'bold')
      .text('Year');

    g.append('text')
      .attr('x', -height / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('font-weight', 'bold')
      .text('Percentage of Papers (%)');

    const line = d3
      .line()
      .x((d, i) => x(data.years[i]))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    const paths = g
      .selectAll('.line')
      .data(Object.entries(data.subfields))
      .join('path')
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', (d) => color(d[0]))
      .attr('stroke-width', 2)
      .attr('d', (d) => line(d[1].smooth.map(() => 0)))
      .style('opacity', 0.7);

    const labels = g
      .selectAll('.line-label')
      .data(Object.entries(data.subfields))
      .join('text')
      .attr('class', 'line-label')
      .attr('fill', (d) => color(d[0]))
      .attr('x', x(data.years[data.years.length - 1]) + 10)
      .attr('y', (d) => y(d[1].smooth[d[1].smooth.length - 1]))
      .style('font-size', '11px')
      .style('pointer-events', 'none')
      .text((d) => d[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            paths
              .transition()
              .duration(1200)
              .attr('d', (d) => line(d[1].smooth));

            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(document.querySelector('#subfield-growth'));
  });
});
