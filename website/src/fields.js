(() => {
  /* ---------- constants ---------- */
  const FIELD_COLORS = {
    theory: '#8146ff',
    systems: '#05a653',
    ai: '#e5007d',
  };
  const mix = (a, b) => d3.rgb(d3.interpolateRgb(a, b)(0.5)).formatHex();
  const colour = (d) =>
    d.field.includes('root')
      ? '#4f5dff'
      : d.field.length === 2
        ? mix(FIELD_COLORS[d.field[0]], FIELD_COLORS[d.field[1]])
        : FIELD_COLORS[d.field[0]];

  /* ---------- DOM refs ---------- */
  const container = document.getElementById('cloud-container');
  const infoBox = document.getElementById('info-box');
  const infoTitle = document.getElementById('info-title');
  const infoDesc = document.getElementById('info-desc');
  let svg; // will hold current svg

  /* ---------- load JSON then draw ---------- */
  fetch('./data/subfields.json')
    .then((r) => r.json())
    .then((wordsData) => {
      drawCloud(wordsData); // initial draw
      window.addEventListener(
        'resize',
        d3.debounce(() => drawCloud(wordsData), 300)
      );
    })
    .catch((err) => console.error('Could not load wordsData.json →', err));

  /* ========== drawing & interaction ========== */
  function drawCloud(wordsData) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    container.innerHTML = ''; // clear previous
    svg = d3.select(container).append('svg').attr('viewBox', [0, 0, w, h]);

    d3.layout
      .cloud()
      .size([w, h])
      .words(wordsData.map((d) => ({ ...d })))
      .padding(5)
      .font('Inter, sans-serif')
      .fontSize((d) => d.size)
      .rotate(() => 0)
      .on('end', draw)
      .start();

    function draw(words) {
      const g = svg.append('g').attr('transform', `translate(${w / 2},${h / 2})`);

      g.selectAll('text')
        .data(words)
        .enter()
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('font-weight', (d) => (d.field.includes('root') ? 600 : 500))
        .attr('font-size', (d) => d.size)
        .attr('fill', (d) => colour(d))
        .attr('transform', (d) => `translate(${d.x},${d.y})`)
        .text((d) => d.text)
        .style('cursor', 'pointer')
        .on('click', handleClick);

      svg.on('click', reset);
    }
  }

  /* ========== info-panel logic ========== */
  function handleClick(event, d) {
    event.stopPropagation();
    svg
      .selectAll('text')
      .transition()
      .duration(200)
      .style('opacity', (t) => opacityRule(t, d));

    infoTitle.textContent = d.text;
    infoDesc.textContent = d.desc;

    // load the graphs if the subfield has an associated paper
    d3.select('#citation-network').html('');
    d3.select('#authors-network').html('');
    document.getElementById('authors-network-container').classList.add('hidden');
    document.getElementById('citation-network-container').classList.add('hidden');

    if (d.path != '' && d.path != undefined) {
      document.getElementById('authors-network-container').classList.remove('hidden');
      document.getElementById('citation-network-container').classList.remove('hidden');
      loadGraphs(d.path);
    }
  }

  function reset() {
    svg.selectAll('text').transition().duration(200).style('opacity', 1);

    infoTitle.textContent = '';
    infoDesc.textContent = '';
  }

  function opacityRule(t, clicked) {
    if (clicked.field.includes('root')) return 1;
    if (clicked.size === 60 && clicked.field.length === 1) {
      return t.field.some((f) => clicked.field.includes(f)) ? 1 : 0.15;
    }
    return t.text === clicked.text ? 1 : 0.15;
  }
})();
