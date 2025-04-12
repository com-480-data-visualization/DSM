// TODO change with new data 
d3.csv("data/cs_conference_journals.csv").then(data => { //todo add possibility to change number of papers 
    data.forEach(d => d.citationCount = +d.citationCount);

    const topPapers = data.sort((a, b) => b.citationCount - a.citationCount).slice(0, 5);
    const container = d3.select("#top-papers");

    let activeTitle = null;
    topPapers.forEach((paper, index) => {
      const row = container.append("div")
        .attr("class", "flex items-start space-x-4 cursor-pointer p-4 bg-white shadow-sm hover:shadow-md rounded-xl transition")
        .on("click", () => toggleDetails(paper));

      row.append("div")
        .attr("class", "text-2xl font-bold text-indigo-600")
        .text(index + 1);

      const textBlock = row.append("div").attr("class", "flex-1");

      textBlock.append("h3")
        .attr("class", "text-lg font-semibold text-blue-700 hover:underline")
        .text(paper.title);
      
      textBlock.append("p")
        .attr("class", "text-sm text-gray-500")
        .text(`Citations: ${paper.citationCount}`);
    });

    function toggleDetails(paper) {
      const panel = d3.select("#paper-details");
      if (activeTitle == paper.title){
        panel.classed("hidden", true);
        activeTitle = null;
      } else {
        panel.classed("hidden", false);
        d3.select("#detail-title").text(paper.title);
        panel.classed("hidden", false);
        d3.select("#detail-title").text(paper.title);
        let authorList = [];
        try {
          const fixed = paper.authors.replace(/'/g, '"');
          const parsed = JSON.parse(fixed); 
          authorList = parsed.map(a => a.name);     
        } catch (e) {
          console.error("Parsing error:", e);
          authorList = [paper.authors];             
        }
        d3.select("#detail-authors").html(`<strong>Authors:</strong> ${authorList.join(", ")}`);
        d3.select("#detail-abstract").html(`<strong>Abstract:</strong> ${paper.abstract}`);
        activeTitle = paper.title;
      }
    }
  }).catch(error => {
    console.error("CSV Load Error:", error);
  });
