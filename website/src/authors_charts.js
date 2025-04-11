// author-visualization.js

// This assumes your HTML already loaded D3 and has an SVG with id="chart-authors"
// and a side panel with #paper-details, #detail-title, #detail-authors, #detail-abstract

d3.csv("cs_conference_journals.csv").then(data => {
    // --- Parse authors and aggregate citation counts ---
    const authorMap = new Map();
  
    data.forEach(paper => {
      let authors = [];
      try {
        const fixed = paper.authors.replace(/'/g, '"');
        authors = JSON.parse(fixed);
      } catch (e) {
        console.error("Author parsing error:", e);
        return;
      }
  
      authors.forEach(a => {
        const name = a.name;
        const citations = +paper.citationCount || 0;
        authorMap.set(name, (authorMap.get(name) || 0) + citations);
      });
    });
  
    // --- Get Top N Authors ---
    const topAuthors = Array.from(authorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // top 10 authors
  
    // --- Setup SVG ---
    const svg = d3.select("#chart-authors"),
          margin = { top: 20, right: 20, bottom: 80, left: 80 },
          width = +svg.attr("width") - margin.left - margin.right,
          height = +svg.attr("height") - margin.top - margin.bottom;
  
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  
    const x = d3.scaleBand()
      .domain(topAuthors.map(d => d[0]))
      .range([0, width])
      .padding(0.2);
  
    const y = d3.scaleLinear()
      .domain([0, d3.max(topAuthors, d => d[1])])
      .nice()
      .range([height, 0]);
  
    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");
  
    // Y Axis
    g.append("g").call(d3.axisLeft(y));
  
    // Bars
    g.selectAll(".bar")
      .data(topAuthors)
      .enter().append("rect")
        .attr("class", "bar fill-blue-500 hover:fill-indigo-600 cursor-pointer")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(d[1]))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d[1]))
        .on("click", (event, d) => {
          const authorName = d[0];
          const filtered = data.filter(paper => paper.authors.includes(authorName));
          showFilteredPapers(authorName, filtered);
        })
        .on("mouseover", function () {
          d3.select(this).classed("fill-indigo-700", true);
        })
        .on("mouseout", function () {
          d3.select(this).classed("fill-indigo-700", false);
        });
  
    // --- Helper to show author papers in side panel ---
    function showFilteredPapers(authorName, papers) {
      const panel = d3.select("#paper-details");
      panel.classed("hidden", false);
      d3.select("#detail-title").text(`Papers by ${authorName}`);
      
      const html = papers.map(p => `
        <div class="mb-4">
          <p class="font-semibold">${p.title}</p>
          <p class="text-sm text-gray-600">${p.citationCount} citations</p>
        </div>
      `).join("");
  
      d3.select("#detail-authors").html(html);
      d3.select("#detail-abstract").html("");
    }
  }).catch(error => {
    console.error("CSV Load Error:", error);
  });
  