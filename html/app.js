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

  const annotationLayout = new Map([
    ["Fortaleza|CE", -20],
    ["Salvador|BA", -4],
    ["Belo Horizonte|MG", -32],
    ["Rio de Janeiro|RJ", 28],
    ["São Paulo|SP", 72],
  ]);

  const players = source.players.map((player) => ({
    ...player,
    municipality_id: String(player.municipality_id),
    latitude: Number(player.latitude),
    longitude: Number(player.longitude),
    search: normalize([
      player.player_name,
      player.full_name,
      player.birth_city,
      player.birth_state,
      player.club,
    ].join(" ")),
  }));
  const maximumStateCount = d3.max(
    d3.rollup(players, (items) => items.length, (player) => player.birth_state_code).values(),
  ) || 1;

  const supportedStates = new Set(players.map((player) => player.birth_state_code));
  const requestedUf = new URLSearchParams(window.location.search).get("uf");
  const initialUf = supportedStates.has(requestedUf) ? requestedUf : null;
  const municipalityLoads = new Map();
  window.BRAZIL_MUNICIPALITIES = window.BRAZIL_MUNICIPALITIES || {};

  const ui = {
    svg: d3.select("#map"),
    panel: document.querySelector(".map-panel"),
    club: document.querySelector("#club-filter"),
    search: document.querySelector("#search"),
    clearSearch: document.querySelector("#clear-search"),
    backState: document.querySelector("#back-state"),
    viewTitle: document.querySelector("#view-title"),
    scopeSummary: document.querySelector("#scope-summary"),
    mapHint: document.querySelector("#map-hint"),
    mapDescription: document.querySelector("#map-description"),
    legendSymbol: document.querySelector("#legend-symbol"),
    legendText: document.querySelector("#legend-text"),
    tooltip: document.querySelector("#tooltip"),
    empty: document.querySelector("#empty-state"),
    sheet: document.querySelector("#city-sheet"),
    closeSheet: document.querySelector("#close-sheet"),
    cityTitle: document.querySelector("#city-title"),
    cityCount: document.querySelector("#city-count"),
    playerList: document.querySelector("#player-list"),
  };

  const state = {
    club: "all",
    query: "",
    selectedUf: null,
    selectedId: null,
    loadingUf: null,
  };

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

  ui.backState.addEventListener("click", exitState);
  ui.closeSheet.addEventListener("click", () => closeCity());

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.selectedId) closeCity();
    else if (state.selectedUf) exitState();
  });

  let frame;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }).observe(ui.panel);

  draw();
  if (initialUf) enterState(initialUf, false);

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
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
    const scopedPlayers = state.selectedUf
      ? visiblePlayers.filter((player) => player.birth_state_code === state.selectedUf)
      : visiblePlayers;
    const cities = groupCities(scopedPlayers);
    const width = Math.max(ui.panel.clientWidth, 320);
    const height = Math.max(ui.panel.clientHeight, 520);
    const selectedFeature = state.selectedUf
      ? brazil.features.find((feature) => feature.properties.uf === state.selectedUf)
      : null;
    const selectedCity = cities.find((city) => city.id === state.selectedId);
    const showAnnotations = width >= 720 && !selectedFeature && state.club === "all" && !state.query;
    const labelColumn = showAnnotations ? Math.min(125, width * 0.17) : 0;
    const plotRight = Math.max(250, width - labelColumn - 28);

    if (state.selectedId && !selectedCity) closeCity(false);
    if (selectedCity) renderCitySheet(selectedCity);
    ui.panel.classList.toggle("has-sheet", Boolean(state.selectedId));

    updateSummary(scopedPlayers, cities, selectedFeature);
    ui.empty.hidden = cities.length > 0;
    ui.svg.attr("viewBox", "0 0 " + width + " " + height).selectAll("*").remove();

    if (selectedFeature && window.BRAZIL_MUNICIPALITIES[state.selectedUf]) {
      drawMunicipalityView(selectedFeature, cities, width, height, plotRight);
    } else {
      drawNationalView(visiblePlayers, cities, width, height, plotRight, showAnnotations);
    }

    ui.svg.on("click", () => {
      if (state.selectedId) closeCity();
    });
  }

  function drawNationalView(visiblePlayers, cities, width, height, plotRight, showAnnotations) {
    const projection = d3.geoMercator().fitExtent([[52, 94], [plotRight, height - 52]], brazil);
    const path = d3.geoPath(projection);
    const stateCounts = d3.rollup(visiblePlayers, (items) => items.length, (player) => player.birth_state_code);
    const netSpacing = d3.scaleSqrt()
      .domain([0, maximumStateCount])
      .range([22, 5])
      .clamp(true);

    const defs = ui.svg.append("defs");
    brazil.features.forEach((feature) => {
      const uf = feature.properties.uf;
      const count = stateCounts.get(uf) || 0;
      if (!count) return;

      const spacing = netSpacing(count);
      const pattern = defs.append("pattern")
        .attr("id", "state-net-" + uf)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", spacing)
        .attr("height", spacing);

      pattern.append("rect")
        .attr("width", spacing)
        .attr("height", spacing)
        .attr("fill", "#f7f6f1");

      pattern.append("path")
        .attr(
          "d",
          "M0,0L" + spacing + "," + spacing +
          "M-" + spacing + ",0L0," + spacing +
          "M" + spacing + ",0L" + (spacing * 2) + "," + spacing +
          "M0," + spacing + "L" + spacing + ",0" +
          "M-" + spacing + "," + spacing + "L0,0" +
          "M" + spacing + "," + spacing + "L" + (spacing * 2) + ",0",
        )
        .attr("fill", "none")
        .attr("stroke", "#356f95")
        .attr("stroke-width", 0.68)
        .attr("stroke-opacity", 0.74)
        .attr("vector-effect", "non-scaling-stroke");
    });

    ui.svg.append("g")
      .attr("class", "states")
      .selectAll("path.state")
      .data(brazil.features, (feature) => feature.properties.uf)
      .join("path")
      .attr("class", (feature) => {
        const count = stateCounts.get(feature.properties.uf) || 0;
        return "state" + (count ? " is-interactive has-data" : "");
      })
      .style("--fill", (feature) => {
        const uf = feature.properties.uf;
        return stateCounts.get(uf) ? "url(#state-net-" + uf + ")" : "#f7f6f1";
      })
      .attr("d", path)
      .attr("tabindex", (feature) => stateCounts.get(feature.properties.uf) ? 0 : null)
      .attr("role", (feature) => stateCounts.get(feature.properties.uf) ? "button" : null)
      .attr("aria-label", (feature) => {
        const count = stateCounts.get(feature.properties.uf) || 0;
        return feature.properties.name + ": " + count + " " + word(count, "jogador", "jogadores") +
          (count ? ". Clique para ver os municípios." : ".");
      })
      .on("pointerenter", (event, feature) => {
        const count = stateCounts.get(feature.properties.uf) || 0;
        focusState(event, feature, count);
      })
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("focus", (event, feature) => {
        const count = stateCounts.get(feature.properties.uf) || 0;
        focusState(event, feature, count);
      })
      .on("blur", hideTooltip)
      .on("click", (event, feature) => {
        if (!stateCounts.get(feature.properties.uf)) return;
        event.stopPropagation();
        enterState(feature.properties.uf, true);
      })
      .on("keydown", (event, feature) => {
        if (!stateCounts.get(feature.properties.uf) || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        enterState(feature.properties.uf, true);
      });

    if (showAnnotations) {
      drawAnnotations(cities, projection, width, plotRight, height);
    }
  }

  function drawMunicipalityView(selectedFeature, cities, width, height, plotRight) {
    const municipalities = window.BRAZIL_MUNICIPALITIES[state.selectedUf];
    const projection = d3.geoMercator().fitExtent([[52, 94], [plotRight, height - 52]], selectedFeature);
    const path = d3.geoPath(projection);
    const citiesById = new Map(cities.map((city) => [city.id, city]));
    const maxCount = d3.max(cities, (city) => city.count) || 1;
    const color = d3.scaleSqrt().domain([0, maxCount]).range(["#dbe5e9", "#1c4f70"]);

    ui.svg.append("g")
      .attr("class", "municipalities" + (state.selectedId ? " has-selection" : ""))
      .selectAll("path.municipality")
      .data(municipalities.features, (feature) => String(feature.properties.codarea))
      .join("path")
      .attr("class", (feature) => {
        const city = citiesById.get(String(feature.properties.codarea));
        const selected = city && city.id === state.selectedId;
        return "municipality" + (city ? " has-data" : "") + (selected ? " is-selected" : "");
      })
      .style("--fill", (feature) => {
        const city = citiesById.get(String(feature.properties.codarea));
        return city ? color(city.count) : "#f7f6f1";
      })
      .attr("d", path)
      .attr("tabindex", (feature) => citiesById.has(String(feature.properties.codarea)) ? 0 : null)
      .attr("role", (feature) => citiesById.has(String(feature.properties.codarea)) ? "button" : null)
      .attr("aria-label", (feature) => municipalityAria(feature, citiesById))
      .on("pointerenter", (event, feature) => focusMunicipality(event, feature, citiesById))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("focus", (event, feature) => focusMunicipality(event, feature, citiesById))
      .on("blur", hideTooltip)
      .on("click", (event, feature) => {
        const city = citiesById.get(String(feature.properties.codarea));
        if (!city) return;
        event.stopPropagation();
        selectCity(city);
      })
      .on("keydown", (event, feature) => {
        const city = citiesById.get(String(feature.properties.codarea));
        if (!city || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        selectCity(city);
      });

    ui.svg.append("path")
      .datum(selectedFeature)
      .attr("class", "state-outline")
      .attr("d", path);
  }

  function municipalityAria(feature, citiesById) {
    const city = citiesById.get(String(feature.properties.codarea));
    const name = feature.properties.name;
    if (!city) return name + ": nenhum jogador nos filtros atuais.";
    return name + ": " + city.count + " " + word(city.count, "jogador", "jogadores") +
      ". Clique para ver os nomes.";
  }

  function updateSummary(scopedPlayers, cities, selectedFeature) {
    const playerCount = scopedPlayers.length;
    const cityCount = cities.length;
    const playerLabel = word(playerCount, "jogador", "jogadores");
    const cityLabel = word(cityCount, "município", "municípios");
    const placeName = selectedFeature ? selectedFeature.properties.name : "Brasil";

    ui.viewTitle.textContent = placeName;
    ui.scopeSummary.textContent = playerCount + " " + playerLabel + " · " + cityCount + " " + cityLabel;
    ui.mapHint.textContent = state.loadingUf
      ? "Carregando municípios"
      : selectedFeature ? "Selecione um município" : "Selecione um estado";
    ui.backState.hidden = !selectedFeature;
    ui.legendSymbol.className = selectedFeature
      ? "legend__symbol legend__gradient"
      : "legend__symbol legend__net";
    ui.legendText.textContent = selectedFeature
      ? "Mais jogadores por município"
      : "Trama mais densa = mais jogadores";
    ui.mapDescription.textContent = selectedFeature
      ? "Mapa de " + placeName + " dividido em municípios. A intensidade da cor representa o número de jogadores."
      : "Mapa do Brasil preenchido por uma trama mais fechada nos estados que concentram mais jogadores.";
  }

  function drawAnnotations(cities, projection, width, plotRight, height) {
    const annotated = cities.filter((city) => annotationLayout.has(city.city + "|" + city.uf));
    const labels = ui.svg.append("g").attr("class", "map-labels");
    const labelX = Math.min(width - 16, plotRight + 108);
    const connectorX = labelX - 95;
    const elbowX = plotRight + 5;

    annotated.forEach((city) => {
      const [x, y] = projection([city.longitude, city.latitude]);
      const key = city.city + "|" + city.uf;
      const textY = Math.max(110, Math.min(height - 58, y + annotationLayout.get(key)));
      const label = labels.append("g").attr("class", "map-label");

      label.append("polyline")
        .attr(
          "points",
          connectorX + "," + (textY - 3) + " " +
          elbowX + "," + (textY - 3) + " " +
          x + "," + y,
        );

      label.append("text")
        .attr("x", labelX)
        .attr("y", textY)
        .attr("text-anchor", "end")
        .text(city.city);

      label.append("text")
        .attr("class", "label-count")
        .attr("x", labelX)
        .attr("y", textY + 12)
        .attr("text-anchor", "end")
        .text(city.count + " " + word(city.count, "jogador", "jogadores"));

      label.append("circle")
        .attr("class", "annotation-dot")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 3);
    });
  }

  async function enterState(uf, focusBack) {
    if (!supportedStates.has(uf) || state.loadingUf) return;
    hideTooltip();
    closeCity(false);
    state.loadingUf = uf;
    ui.mapHint.textContent = "Carregando municípios";

    try {
      await loadMunicipalities(uf);
      state.selectedUf = uf;
      syncUrl(uf);
      draw();
      if (focusBack) requestAnimationFrame(() => ui.backState.focus());
    } catch (error) {
      console.error(error);
      ui.mapHint.textContent = "Não foi possível carregar os municípios";
    } finally {
      state.loadingUf = null;
    }
  }

  function loadMunicipalities(uf) {
    if (window.BRAZIL_MUNICIPALITIES[uf]) {
      return Promise.resolve(window.BRAZIL_MUNICIPALITIES[uf]);
    }
    if (municipalityLoads.has(uf)) return municipalityLoads.get(uf);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "html/data/municipalities/" + uf + ".js";
      script.onload = () => resolve(window.BRAZIL_MUNICIPALITIES[uf]);
      script.onerror = () => reject(new Error("Falha ao carregar a malha municipal de " + uf));
      document.head.append(script);
    });

    municipalityLoads.set(uf, promise);
    return promise;
  }

  function exitState() {
    hideTooltip();
    closeCity(false);
    state.selectedUf = null;
    syncUrl(null);
    draw();
  }

  function syncUrl(uf) {
    const url = new URL(window.location.href);
    if (uf) url.searchParams.set("uf", uf);
    else url.searchParams.delete("uf");
    window.history.replaceState(null, "", url);
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
    ui.cityCount.textContent = city.count + " " + word(city.count, "jogador", "jogadores");
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
      crest.src = "html/assets/clubs/" + clubIds.get(player.club) + ".png";
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

  function focusState(event, feature, count) {
    showTooltip(
      event,
      feature.properties.name,
      count + " " + word(count, "jogador", "jogadores") + (count ? " · abrir estado" : ""),
    );
  }

  function focusMunicipality(event, feature, citiesById) {
    const city = citiesById.get(String(feature.properties.codarea));
    showTooltip(
      event,
      feature.properties.name,
      city ? city.count + " " + word(city.count, "jogador", "jogadores") : "Nenhum jogador",
    );
  }

  function showTooltip(event, titleText, valueText) {
    ui.tooltip.replaceChildren();
    const title = document.createElement("strong");
    const value = document.createElement("span");
    title.textContent = titleText;
    value.textContent = valueText;
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
    ui.tooltip.style.left = Math.max(pad, left) + "px";
    ui.tooltip.style.top = Math.max(pad, top) + "px";
  }

  function hideTooltip() {
    ui.tooltip.hidden = true;
  }

  function word(value, singular, plural) {
    return value === 1 ? singular : plural;
  }
})();
