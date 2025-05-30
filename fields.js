(() => {
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

  const container = document.getElementById('cloud-container');
  const infoTitle = document.getElementById('info-title');
  const infoDesc = document.getElementById('info-desc');
  const infoPaper = document.getElementById('info-paper');
  let svg;

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
      .on('end', function (words) {
        draw(words);

        // simulate click on Computer Vision so that the user sees some graphs by default
        const defaultSubfield = words.find((d) => d.text === 'System Security');
        if (defaultSubfield) {
          handleClick(new Event('click'), defaultSubfield);
        }
      })
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

  function handleClick(event, d) {
    event.stopPropagation();
    svg
      .selectAll('text')
      .transition()
      .duration(200)
      .style('opacity', (t) => opacityRule(t, d));

    infoTitle.textContent = d.text;
    infoDesc.textContent = d.desc;

    document.getElementById('authors-network-container').classList.add('hidden');
    document.getElementById('citation-network-container').classList.add('hidden');
    infoPaper.innerHTML = '';

    if (d.path != '' && d.path != undefined) {
      Promise.all([d3.csv(`${d.path}/papers.csv`), d3.csv(`${d.path}/connections.csv`)]).then(
        ([papersRaw, connections]) => {
          const sp = papersRaw[0];
          const authorsList = sp.authors
            .split(';')
            .map((s) => s.trim())
            .join(', ');

          infoPaper.innerHTML = `      
<h2 class="text-xl font-semibold text-yellow-600 mt-8">🌟 Paper in the Spotlight</h2>
      <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
        <a href="${sp.url}" target="_blank"
           class="block text-lg font-bold text-yellow-800 hover:underline">
          ${sp.title} <span class="text-sm text-gray-500">(${sp.year})</span>
        </a>
        <p class="mt-1 text-gray-700"><strong>Authors:</strong> ${authorsList}</p>
        <p class="mt-1 text-gray-700"><strong>Venue:</strong> ${sp.venue}</p>
      </div>`;

          loadGraphs(papersRaw, connections);
          document.getElementById('authors-network-container').classList.remove('hidden');
          document.getElementById('citation-network-container').classList.remove('hidden');
        }
      );
    }
  }

  function reset() {
    svg.selectAll('text').transition().duration(200).style('opacity', 1);

    infoTitle.textContent = '';
    infoDesc.textContent = '';
    infoPaper.textContent = '';

    document.getElementById('authors-network-container').classList.add('hidden');
    document.getElementById('citation-network-container').classList.add('hidden');
  }

  function opacityRule(t, clicked) {
    if (clicked.field.includes('root')) return 1;
    if (clicked.size === 60 && clicked.field.length === 1) {
      return t.field.some((f) => clicked.field.includes(f)) ? 1 : 0.15;
    }
    return t.text === clicked.text ? 1 : 0.15;
  }
})();

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}
