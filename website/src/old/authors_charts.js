// TODO change with new data 
const color = d3.scaleOrdinal(d3.schemeTableau10);
const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "6px 12px")
    .style("border-radius", "8px")
    .style("pointer-events", "none")
    .style("box-shadow", "0px 2px 8px rgba(0,0,0,0.2)")
    .style("font-size", "0.875rem")
    .style("color", "#333")
    .style("opacity", 0);

d3.csv("data/cs_conference_journals.csv").then(data => {
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

    const topAuthors = Array.from(authorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15); //TODO add possibility to change top x authors

    const topAuthorNames = topAuthors.map(d => d[0]);

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

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    g.append("g").call(d3.axisLeft(y));

    const bars = g.selectAll(".bar")
        .data(topAuthors)
        .enter().append("rect")
        .attr("x", d => x(d[0]))
        .attr("width", x.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .attr("fill", (d, i) => color(i))
        .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).attr("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip
                .html(`<strong>${d[0]}</strong><br>${d[1]} citations`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", (event) => {
            d3.select(event.currentTarget).attr("opacity", 1);
            tooltip.transition().duration(200).style("opacity", 0);
        })
        .on("click", (event, d) => {
            const authorName = d[0];
            const filtered = data.filter(paper => paper.authors.includes(authorName));
            showFilteredPapers(authorName, filtered);
        });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                bars
                    .attr("y", height)
                    .attr("height", 0);

                bars.transition()
                    .duration(800)
                    .delay((d, i) => i * 100)
                    .attr("y", d => y(d[1]))
                    .attr("height", d => height - y(d[1]));
            }
        });
    }, {
        threshold: 0.3,
    });

    observer.observe(document.querySelector("#author-chart-section"));

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

    const nodeSet = new Set();
    const linkMap = new Map(); 

    data.forEach(paper => {
        let authors = [];
        try {
            const fixed = paper.authors.replace(/'/g, '"');
            authors = JSON.parse(fixed);
        } catch (e) {
            return;
        }

        const venue = paper.venue;
        if (!venue) return;

        authors.forEach(a => {
            const name = a.name;
            if (topAuthorNames.includes(name)) {
                const authorNode = `A:${name}`;
                const venueNode = `V:${venue}`;
                nodeSet.add(authorNode);
                nodeSet.add(venueNode);

                const key = `${authorNode}|${venueNode}`;
                linkMap.set(key, (linkMap.get(key) || 0) + 1);
            }
        });
    });

    const nodes = Array.from(nodeSet).map(name => ({ name }));
    const nodeIndex = new Map(nodes.map((d, i) => [d.name, i]));

    const links = Array.from(linkMap.entries()).map(([key, value]) => {
        const [sourceName, targetName] = key.split("|");
        return {
            source: nodeIndex.get(sourceName),
            target: nodeIndex.get(targetName),
            value,
        };
    });

    const sankeyData = { nodes, links };
    drawSankey(sankeyData);
});

function drawSankey(data) {
    const svg = d3.select("#sankey-diagram");
    const width = +svg.attr("width");
    const height = +svg.attr("height");

    const sankey = d3.sankey()
        .nodeWidth(15)
        .nodePadding(12)
        .extent([[1, 1], [width - 1, height - 6]]);

    const { nodes, links } = sankey(data);

    svg.append("g")
        .selectAll("rect")
        .data(nodes)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.name.startsWith("A:") ? "#60a5fa" : "#a78bfa")
        .append("title")
        .text(d => d.name.replace(/^A:|^V:/, ""));

    svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .attr("fill", "#111827") // Tailwind gray-900
        .style("font-size", "12px")
        .text(d => d.name.replace(/^A:|^V:/, ""));


    svg.append("g")
        .attr("fill", "none")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", "#d1d5db")
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("opacity", 0.5)
        .append("title")
        .text(d => `${data.nodes[d.source.index].name.replace(/^A:/, "")} → ${data.nodes[d.target.index].name.replace(/^V:/, "")}\n${d.value} paper(s)`);
}
