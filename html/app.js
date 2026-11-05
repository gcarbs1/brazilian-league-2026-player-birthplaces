(() => {
  "use strict";

  const source = window.BIRTHPLACE_DATA;
  const brazil = window.BRAZIL_STATES;
  if (!source || !brazil || !window.d3) return;

  const clubIds = new Map([
    ["Associação Chapecoense de Futebol", "17776"],
    ["Botafogo de Futebol e Regatas", "537"],
    ["CR Flamengo", "614"],
    ["Club Athletico Paranaense", "679"],
    ["Clube Atlético Mineiro", "330"],
    ["Clube de Regatas Vasco da Gama", "978"],
    ["Clube do Remo (PA)", "10997"],
    ["Coritiba Foot Ball Club", "776"],
    ["Cruzeiro Esporte Clube", "609"],
    ["Esporte Clube Bahia", "10010"],
    ["Esporte Clube Vitória", "2125"],
    ["Fluminense Football Club", "2462"],
    ["Grêmio Foot-Ball Porto Alegrense", "210"],
    ["Mirassol Futebol Clube (SP)", "3876"],
    ["Red Bull Bragantino", "8793"],
    ["Santos FC", "221"],
    ["Sociedade Esportiva Palmeiras", "1023"],
    ["Sport Club Corinthians Paulista", "199"],
    ["Sport Club Internacional", "6600"],
    ["São Paulo Futebol Clube", "585"],
  ]);

  const clubShortNames = new Map([
    ["Associação Chapecoense de Futebol", "Chapecoense"],
    ["Botafogo de Futebol e Regatas", "Botafogo"],
    ["CR Flamengo", "Flamengo"],
    ["Club Athletico Paranaense", "Athletico-PR"],
    ["Clube Atlético Mineiro", "Atlético-MG"],
    ["Clube de Regatas Vasco da Gama", "Vasco"],
    ["Clube do Remo (PA)", "Remo"],
    ["Coritiba Foot Ball Club", "Coritiba"],
    ["Cruzeiro Esporte Clube", "Cruzeiro"],
    ["Esporte Clube Bahia", "Bahia"],
    ["Esporte Clube Vitória", "Vitória"],
    ["Fluminense Football Club", "Fluminense"],
    ["Grêmio Foot-Ball Porto Alegrense", "Grêmio"],
    ["Mirassol Futebol Clube (SP)", "Mirassol"],
    ["Red Bull Bragantino", "Bragantino"],
    ["Santos FC", "Santos"],
    ["Sociedade Esportiva Palmeiras", "Palmeiras"],
    ["Sport Club Corinthians Paulista", "Corinthians"],
    ["Sport Club Internacional", "Internacional"],
    ["São Paulo Futebol Clube", "São Paulo"],
  ]);

  const players = source.players.map((player) => ({
    ...player,
    municipality_id: String(player.municipality_id),
    latitude: Number(player.latitude),
    longitude: Number(player.longitude),
    search: normalize(`${player.player_name} ${player.full_name} ${player.birth_city} ${player.birth_state} ${player.club}`),
  }));

  const ui = {
    svg: d3.select("#map"),
    panel: document.querySelector(".map-panel"),
    club: document.querySelector("#club-filter"),
    search: document.querySelector("#search"),
    clearSearch: document.querySelector("#clear-search"),
    tooltip: document.querySelector("#tooltip"),
    empty: document.querySelector("#empty-state"),
    sheet: document.querySelector("#city-sheet"),
    closeSheet: document.querySelector("#close-sheet"),
    cityTitle: document.querySelector("#city-title"),
    cityCount: document.querySelector("#city-count"),
    playerList: document.querySelector("#player-list"),
  };

  const state = { club: "all", query: "", selectedId: null };
  const allCities = groupCities(players);
  const maxCount = d3.max(allCities, (city) => city.count) || 1;
  const radius = d3.scaleSqrt().domain([0, maxCount]).range([0, 39]);

  const annotationOffsets = new Map([
    ["São Paulo|SP", [136, 92]],
    ["Rio de Janeiro|RJ", [66, 44]],
    ["Salvador|BA", [70, -18]],
    ["Belo Horizonte|MG", [116, -72]],
    ["Fortaleza|CE", [92, -42]],
  ]);

  [...new Set(players.map((player) => player.club))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((club) => ui.club.add(new Option(clubShortNames.get(club) || club, club)));

  ui.club.addEventListener("change", (event) => {
    state.club = event.target.value;
    draw();
  });

  ui.search.addEventListener("input", (event) => {
    state.query = normalize(event.target.value);
    ui.clearSearch.hidden = !event.target.value;
    draw();
  });

  ui.clearSearch.addEventListener("click", () => {
    ui.search.value = "";
    state.query = "";
    ui.clearSearch.hidden = true;
    ui.search.focus();
    draw();
  });

  ui.closeSheet.addEventListener("click", () => closeCity());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedId) closeCity();
  });

  let frame;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }).observe(ui.panel);

  draw();

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  }

  function filteredPlayers() {
    return players.filter((player) =>
      (state.club === "all" || player.club === state.club) &&
      (!state.query || player.search.includes(state.query)),
    );
  }

  function groupCities(records) {
    return d3.rollups(
      records,
      (items) => ({
        id: items[0].municipality_id,
        city: items[0].birth_city,
        uf: items[0].birth_state_code,
        region: items[0].birth_region,
        latitude: items[0].latitude,
        longitude: items[0].longitude,
        count: items.length,
        players: items.slice().sort((a, b) => a.player_name.localeCompare(b.player_name, "pt-BR")),
      }),
      (player) => player.municipality_id,
    ).map(([, city]) => city).sort((a, b) => d3.descending(a.count, b.count));
  }

  function draw() {
    const visiblePlayers = filteredPlayers();
    const cities = groupCities(visiblePlayers);
    const width = Math.max(ui.panel.clientWidth, 320);
    const height = Math.max(ui.panel.clientHeight, 520);
    const selectedCity = cities.find((city) => city.id === state.selectedId);

    if (state.selectedId && !selectedCity) closeCity(false);
    if (selectedCity) renderCitySheet(selectedCity);
    ui.panel.classList.toggle("has-sheet", Boolean(state.selectedId));

    ui.empty.hidden = cities.length > 0;
    ui.svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();

    const rightEdge = Math.max(250, width - 34);
    const projection = d3.geoMercator().fitExtent([[64, 68], [rightEdge, height - 54]], brazil);
    const path = d3.geoPath(projection);

    ui.svg.append("g")
      .selectAll("path")
      .data(brazil.features)
      .join("path")
      .attr("class", "state")
      .attr("d", path);

    if (!state.selectedId && state.club === "all" && !state.query) {
      drawAnnotations(cities, projection);
    }

    const cityLayer = ui.svg.append("g")
      .attr("class", `cities${state.selectedId ? " has-selection" : ""}`);

    cityLayer.selectAll("circle.city")
      .data(cities.slice().sort((a, b) => d3.descending(a.count, b.count)), (city) => city.id)
      .join("circle")
      .attr("class", (city) => `city${city.id === state.selectedId ? " is-selected" : ""}`)
      .attr("cx", (city) => projection([city.longitude, city.latitude])[0])
      .attr("cy", (city) => projection([city.longitude, city.latitude])[1])
      .attr("r", (city) => radius(city.count))
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (city) => `${city.city}, ${city.uf}: ${city.count} ${word(city.count, "jogador", "jogadores")}. Clique para ver os nomes.`)
      .on("pointerenter", focusCity)
      .on("pointermove", moveTooltip)
      .on("pointerleave", unfocusCity)
      .on("focus", focusCity)
      .on("blur", unfocusCity)
      .on("click", (event, city) => {
        event.stopPropagation();
        selectCity(city);
      })
      .on("keydown", (event, city) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCity(city);
        }
      });

    if (selectedCity) {
      const [x, y] = projection([selectedCity.longitude, selectedCity.latitude]);
      cityLayer.insert("circle", ":first-child")
        .attr("class", "selection-ring")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", radius(selectedCity.count) + 8);
    }

    ui.svg.on("click", () => {
      if (state.selectedId) closeCity();
    });
  }

  function drawAnnotations(cities, projection) {
    const annotated = cities.filter((city) => annotationOffsets.has(`${city.city}|${city.uf}`));
    const labels = ui.svg.append("g").attr("class", "map-labels");

    const defs = ui.svg.append("defs");
    defs.append("marker")
      .attr("id", "annotation-arrow")
      .attr("viewBox", "0 0 8 8")
      .attr("refX", 7)
      .attr("refY", 4)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L8,4 L0,8 Z")
      .attr("fill", "#263a34");

    annotated.forEach((city) => {
      const [x, y] = projection([city.longitude, city.latitude]);
      const [dx, dy] = annotationOffsets.get(`${city.city}|${city.uf}`);
      const anchor = dx < 0 ? "end" : "start";
      const textX = x + dx;
      const textY = y + dy;
      const lineStartX = textX + (dx < 0 ? 10 : -10);
      const elbowX = x + (dx < 0 ? -42 : 42);
      const label = labels.append("g").attr("class", "map-label");

      label.append("polyline")
        .attr("points", `${lineStartX},${textY + 3} ${elbowX},${textY + 3} ${x},${y}`)
        .attr("marker-end", "url(#annotation-arrow)");

      label.append("text")
        .attr("x", textX)
        .attr("y", textY)
        .attr("text-anchor", anchor)
        .text(city.city);

      label.append("text")
        .attr("class", "label-count")
        .attr("x", textX)
        .attr("y", textY + 13)
        .attr("text-anchor", anchor)
        .text(`${city.count} ${word(city.count, "jogador", "jogadores")}`);
    });
  }

  function selectCity(city) {
    hideTooltip();
    state.selectedId = city.id;
    ui.sheet.classList.add("is-open");
    ui.sheet.setAttribute("aria-hidden", "false");
    renderCitySheet(city);
    draw();
  }

  function closeCity(redraw = true) {
    state.selectedId = null;
    ui.panel.classList.remove("has-sheet");
    ui.sheet.classList.remove("is-open");
    ui.sheet.setAttribute("aria-hidden", "true");
    if (redraw) draw();
  }

  function renderCitySheet(city) {
    ui.cityTitle.textContent = city.city;
    ui.cityCount.textContent = `${city.count} ${word(city.count, "jogador", "jogadores")}`;
    ui.playerList.replaceChildren();

    city.players.forEach((player, index) => {
      const row = document.createElement("article");
      const number = document.createElement("span");
      const content = document.createElement("div");
      const name = document.createElement("strong");
      const details = document.createElement("span");
      const crest = document.createElement("img");

      row.className = "player";
      row.style.setProperty("--i", Math.min(index, 12));
      number.className = "player__number";
      number.textContent = String(index + 1).padStart(2, "0");
      name.textContent = player.player_name;
      details.textContent = clubShortNames.get(player.club) || player.club;
      details.title = player.club;
      crest.className = "player__crest";
      crest.src = `html/assets/clubs/${clubIds.get(player.club)}.png`;
      crest.alt = "";
      crest.width = 32;
      crest.height = 32;
      crest.loading = "lazy";
      crest.decoding = "async";

      content.append(name, details);
      row.append(number, content, crest);
      ui.playerList.append(row);
    });

    ui.sheet.scrollTop = 0;
  }

  function focusCity(event, city) {
    const circle = event.currentTarget;
    circle.classList.add("is-hovered");
    circle.parentElement.classList.add("has-hover");
    showTooltip(event, city);
  }

  function unfocusCity(event) {
    const circle = event.currentTarget;
    circle.classList.remove("is-hovered");
    circle.parentElement.classList.remove("has-hover");
    hideTooltip();
  }

  function showTooltip(event, city) {
    ui.tooltip.replaceChildren();
    const title = document.createElement("strong");
    const value = document.createElement("span");
    title.textContent = `${city.city}, ${city.uf}`;
    value.textContent = `${city.count} ${word(city.count, "jogador", "jogadores")}`;
    ui.tooltip.append(title, value);
    ui.tooltip.hidden = false;

    if (event.clientX) {
      moveTooltip(event);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      positionTooltip(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }

  function moveTooltip(event) {
    positionTooltip(event.clientX, event.clientY);
  }

  function positionTooltip(clientX, clientY) {
    const panel = ui.panel.getBoundingClientRect();
    const tooltip = ui.tooltip.getBoundingClientRect();
    const pad = 12;
    const left = Math.min(clientX - panel.left + 14, panel.width - tooltip.width - pad);
    const top = Math.min(clientY - panel.top + 14, panel.height - tooltip.height - pad);
    ui.tooltip.style.left = `${Math.max(pad, left)}px`;
    ui.tooltip.style.top = `${Math.max(pad, top)}px`;
  }

  function hideTooltip() {
    ui.tooltip.hidden = true;
  }

  function word(value, singular, plural) {
    return value === 1 ? singular : plural;
  }
})();
