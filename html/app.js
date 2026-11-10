/**
 * Mapa dos locais de nascimento dos jogadores brasileiros da Série A de 2026.
 *
 * Como ler este arquivo:
 * 1. prepara os dados, os nomes e os escudos dos clubes;
 * 2. reúne os elementos da interface e o estado compartilhado;
 * 3. liga a busca e o teclado ao redesenho;
 * 4. define os utilitários de busca e agrupamento por município;
 * 5. desenha o mapa nacional (bolhas por município) e o estadual (mapa de calor);
 * 6. atualiza o título e as anotações das principais cidades;
 * 7. controla a navegação entre o Brasil e um estado;
 * 8. monta o painel com os jogadores do município selecionado;
 * 9. exibe as dicas flutuantes e quebra os nomes longos em sílabas.
 *
 * Os dados vêm de html/data/birthplaces.js e html/data/brazil-states.js, gerados
 * pelo notebook 01; os municípios de cada estado são carregados sob demanda.
 */
(() => {
  "use strict";

  // 1. Dados, clubes e configuração
  // Se faltar algum dado ou o D3, a visualização não inicia.
  const source = window.BIRTHPLACE_DATA;
  const brazil = window.BRAZIL_STATES;
  if (!source || !brazil || !window.d3) return;

  // Identificador do clube no Transfermarkt, usado para achar o escudo em html/assets/clubs/.
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

  // Nomes curtos exibidos nos filtros, no painel e nas dicas.
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

  // Deslocamento vertical (px) do rótulo de cada cidade anotada no mapa nacional,
  // ajustado à mão para que os rótulos das cidades vizinhas não se sobreponham.
  const annotationLayout = new Map([
    ["Fortaleza|CE", -20],
    ["Salvador|BA", -4],
    ["Belo Horizonte|MG", -32],
    ["Rio de Janeiro|RJ", 28],
    ["São Paulo|SP", 72],
  ]);

  // Cada jogador ganha um texto de busca sem acentos e em minúsculas.
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
      clubShortNames.get(player.club),
    ].join(" ")),
  }));
  // O estado inicial pode vir da URL (?uf=SP); só são aceitos estados com jogadores.
  const supportedStates = new Set(players.map((player) => player.birth_state_code));
  const requestedUf = new URLSearchParams(window.location.search).get("uf");
  const initialUf = supportedStates.has(requestedUf) ? requestedUf : null;
  const municipalityLoads = new Map();
  window.BRAZIL_MUNICIPALITIES = window.BRAZIL_MUNICIPALITIES || {};


  // 2. Interface e estado compartilhado
  const ui = {
    svg: d3.select("#map"),
    panel: document.querySelector(".map-panel"),
    search: document.querySelector("#search"),
    clearSearch: document.querySelector("#clear-search"),
    backState: document.querySelector("#back-state"),
    viewTitle: document.querySelector("#view-title"),
    mapHint: document.querySelector("#map-hint"),
    legendSymbol: document.querySelector("#legend-symbol"),
    legendText: document.querySelector("#legend-text"),
    mapDescription: document.querySelector("#map-description"),
    tooltip: document.querySelector("#tooltip"),
    empty: document.querySelector("#empty-state"),
    sheet: document.querySelector("#city-sheet"),
    closeSheet: document.querySelector("#close-sheet"),
    cityTitle: document.querySelector("#city-title"),
    cityCount: document.querySelector("#city-count"),
    playerList: document.querySelector("#player-list"),
  };

  // Estado único: o mapa é redesenhado por completo sempre que algo aqui muda.
  const state = {
    query: "",
    selectedUf: null,
    selectedId: null,
    loadingUf: null,
  };


  // 3. Busca e teclado
  // A busca de texto cobre jogador, nome completo, cidade, estado e clube.
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

  // Esc fecha o painel do município e, em seguida, volta ao mapa do Brasil.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.selectedId) closeCity();
    else if (state.selectedUf) exitState();
  });

  // O mapa é redesenhado quando o tamanho do painel muda (no máximo uma vez por quadro).
  let frame;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }).observe(ui.panel);

  // Primeiro desenho e, se pedido na URL, entrada direta no estado.
  draw();
  if (initialUf) enterState(initialUf, false);


  // 4. Utilitários de busca e agrupamento
  /** Texto sem acentos e em minúsculas, para comparar buscas. */
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
  }

  /** Jogadores que passam pela busca. */
  function filteredPlayers() {
    return players.filter((player) => !state.query || player.search.includes(state.query));
  }

  /** Agrupa jogadores por município, do mais ao menos numeroso. */
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


  // 5. Desenho do mapa
  /** Redesenha o mapa, o resumo e o painel a partir do estado atual. */
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
    // As anotações só aparecem na visão nacional, sem filtros e com espaço lateral.
    const showAnnotations = width >= 720 && !selectedFeature && !state.query;
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

  /** Brasil por estados: estados em fundo neutro e uma bolha por município. */
  function drawNationalView(visiblePlayers, cities, width, height, plotRight, showAnnotations) {
    const projection = d3.geoMercator().fitExtent([[52, 94], [plotRight, height - 52]], brazil);
    const path = d3.geoPath(projection);
    const stateCounts = d3.rollup(visiblePlayers, (items) => items.length, (player) => player.birth_state_code);

    // Os estados com jogadores são clicáveis e abrem o mapa de municípios.
    ui.svg.append("g")
      .attr("class", "states")
      .selectAll("path.state")
      .data(brazil.features, (feature) => feature.properties.uf)
      .join("path")
      .attr("class", (feature) => "state" + (stateCounts.get(feature.properties.uf) ? " is-interactive" : ""))
      .attr("d", path)
      .attr("tabindex", (feature) => stateCounts.get(feature.properties.uf) ? 0 : null)
      .attr("role", (feature) => stateCounts.get(feature.properties.uf) ? "button" : null)
      .attr("aria-label", (feature) => {
        const count = stateCounts.get(feature.properties.uf) || 0;
        return feature.properties.name + ": " + count + " " + word(count, "jogador", "jogadores") +
          (count ? ". Clique para ver os municípios." : ".");
      })
      .on("pointerenter", (event, feature) => focusState(event, feature, stateCounts.get(feature.properties.uf) || 0))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("focus", (event, feature) => focusState(event, feature, stateCounts.get(feature.properties.uf) || 0))
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

    drawBubbles(cities, projection, 30);

    if (showAnnotations) {
      drawAnnotations(cities, projection, width, plotRight, height);
    }
  }

  /** Estado por municípios: mapa de calor, com a cor indicando o número de jogadores. */
  function drawMunicipalityView(selectedFeature, cities, width, height, plotRight) {
    const municipalities = window.BRAZIL_MUNICIPALITIES[state.selectedUf];
    const projection = d3.geoMercator().fitExtent([[52, 94], [plotRight, height - 52]], selectedFeature);
    const path = d3.geoPath(projection);
    const citiesById = new Map(cities.map((city) => [city.id, city]));
    const maxCount = d3.max(cities, (city) => city.count) || 1;
    const color = d3.scaleSqrt().domain([0, maxCount]).range(["#dbe5e9", "#1c4f70"]);
    const cityOf = (feature) => citiesById.get(String(feature.properties.codarea));

    ui.svg.append("g")
      .attr("class", "municipalities" + (state.selectedId ? " has-selection" : ""))
      .selectAll("path.municipality")
      .data(municipalities.features, (feature) => String(feature.properties.codarea))
      .join("path")
      .attr("class", (feature) => {
        const city = cityOf(feature);
        return "municipality" + (city ? " has-data" : "") + (city && city.id === state.selectedId ? " is-selected" : "");
      })
      .style("--fill", (feature) => {
        const city = cityOf(feature);
        return city ? color(city.count) : "#f7f6f1";
      })
      .attr("d", path)
      .attr("tabindex", (feature) => cityOf(feature) ? 0 : null)
      .attr("role", (feature) => cityOf(feature) ? "button" : null)
      .attr("aria-label", (feature) => {
        const city = cityOf(feature);
        const name = feature.properties.name;
        return city
          ? name + ": " + city.count + " " + word(city.count, "jogador", "jogadores") + ". Clique para ver os nomes."
          : name + ": nenhum jogador na busca atual.";
      })
      .on("pointerenter", (event, feature) => focusMunicipality(event, feature, cityOf(feature)))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("focus", (event, feature) => focusMunicipality(event, feature, cityOf(feature)))
      .on("blur", hideTooltip)
      .on("click", (event, feature) => {
        const city = cityOf(feature);
        if (!city) return;
        event.stopPropagation();
        selectCity(city);
      })
      .on("keydown", (event, feature) => {
        const city = cityOf(feature);
        if (!city || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        selectCity(city);
      });

    ui.svg.append("path")
      .datum(selectedFeature)
      .attr("class", "state-outline")
      .attr("d", path);
  }

  /** Bolhas do mapa nacional, uma por município; a área é proporcional ao número de jogadores. */
  function drawBubbles(cities, projection, maxRadius) {
    const maxCount = d3.max(cities, (city) => city.count) || 1;
    const radius = d3.scaleSqrt().domain([1, maxCount]).range([3.5, maxRadius]);

    // As maiores são desenhadas primeiro, para que as pequenas fiquem por cima.
    ui.svg.append("g")
      .attr("class", "bubbles" + (state.selectedId ? " has-selection" : ""))
      .selectAll("circle.bubble")
      .data(cities.slice().sort((a, b) => d3.descending(a.count, b.count)), (city) => city.id)
      .join("circle")
      .attr("class", (city) => "bubble" + (city.id === state.selectedId ? " is-selected" : ""))
      .attr("cx", (city) => projection([city.longitude, city.latitude])[0])
      .attr("cy", (city) => projection([city.longitude, city.latitude])[1])
      .attr("r", (city) => radius(city.count))
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (city) => city.city + " (" + city.uf + "): " + city.count + " " +
        word(city.count, "jogador", "jogadores") + ". Clique para ver os nomes.")
      .on("pointerenter", focusCity)
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("focus", focusCity)
      .on("blur", hideTooltip)
      .on("click", (event, city) => {
        event.stopPropagation();
        selectCity(city);
      })
      .on("keydown", (event, city) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selectCity(city);
      });
  }


  // 6. Resumo e anotações
  /** Atualiza título, dica e descrição acessível do mapa. */
  function updateSummary(scopedPlayers, cities, selectedFeature) {
    const placeName = selectedFeature ? selectedFeature.properties.name : "Brasil";

    ui.viewTitle.textContent = placeName;
    ui.legendSymbol.className = selectedFeature ? "legend__symbol legend__gradient" : "legend__symbol legend__bubble";
    ui.legendText.textContent = selectedFeature ? "Mais jogadores por município" : "Área da bolha = número de jogadores";
    ui.mapHint.textContent = state.loadingUf
      ? "Carregando municípios"
      : selectedFeature ? "Selecione um município" : "Selecione um estado ou uma bolha";
    ui.backState.hidden = !selectedFeature;
    ui.mapDescription.textContent = selectedFeature
      ? "Mapa de calor de " + placeName + " dividido em municípios; a intensidade da cor representa o número de jogadores."
      : "Mapa do Brasil com uma bolha por município; a área da bolha representa o número de jogadores.";
  }

  /** Rótulos ligados por linhas às principais cidades, na coluna à direita do mapa. */
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
    });
  }


  // 7. Navegação entre o Brasil e um estado
  /** Carrega a malha municipal do estado e passa para a visão estadual. */
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

  /** Carrega html/data/municipalities/<UF>.js uma única vez e guarda a promessa. */
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

  /** Volta ao mapa do Brasil. */
  function exitState() {
    hideTooltip();
    closeCity(false);
    state.selectedUf = null;
    syncUrl(null);
    draw();
  }

  /** Mantém o estado aberto no parâmetro ?uf= da URL, sem criar histórico. */
  function syncUrl(uf) {
    const url = new URL(window.location.href);
    if (uf) url.searchParams.set("uf", uf);
    else url.searchParams.delete("uf");
    window.history.replaceState(null, "", url);
  }


  // 8. Painel do município
  /** Abre o painel com os jogadores do município. */
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

  /** Preenche o painel com a lista de jogadores, cada um com o escudo do clube. */
  function renderCitySheet(city) {
    // Palavras com mais de 7 letras recebem pontos de quebra silábica. O tamanho do título
    // acompanha o maior trecho que pode ficar numa linha, para que o nome nunca seja cortado.
    ui.cityTitle.textContent = hyphenate(city.city);
    const widest = Math.max(4, ...city.city.split(/[\s-]+/).map((part) =>
      part.length > MIN_HYPHEN_LENGTH ? Math.ceil(part.length / 2) + 1 : part.length));
    ui.cityTitle.style.setProperty("--len", widest);
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


  // 9. Dicas flutuantes e quebra silábica dos nomes
  /** Dica de um estado. */
  function focusState(event, feature, count) {
    showTooltip(
      event,
      feature.properties.name,
      count + " " + word(count, "jogador", "jogadores") + (count ? " · abrir estado" : ""),
    );
  }

  /** Dica de uma bolha (município do mapa nacional). */
  function focusCity(event, city) {
    showTooltip(
      event,
      city.city + " (" + city.uf + ")",
      city.count + " " + word(city.count, "jogador", "jogadores") + " · ver nomes",
    );
  }

  // Quebra silábica dos nomes
  /** Nomes de cidade com mais letras que isso podem ser quebrados em sílabas. */
  const MIN_HYPHEN_LENGTH = 7;

  /** Posições de quebra silábica (aproximadas) de uma palavra em português. */
  function syllableCuts(word) {
    const w = word.toLowerCase();
    const vowels = "aeiouáéíóúâêôãõàü";
    const strong = "aeoáéóâêô";
    const isVowel = (c) => vowels.includes(c);
    const inseparable = /^(ch|lh|nh|qu|gu|[bcdfgptv][lr])$/;
    const cuts = [];

    for (let i = 1; i < w.length; i++) {
      const before = w[i - 1];
      const here = w[i];
      if (isVowel(before) && isVowel(here)) {
        // Hiato: duas vogais fortes seguidas separam-se; ditongos ficam juntos.
        if (strong.includes(before) && strong.includes(here)) cuts.push(i);
      } else if (isVowel(before)) {
        const next = w[i + 1];
        if (next && (isVowel(next) || inseparable.test(here + next))) cuts.push(i);
      } else if (!isVowel(before) && !isVowel(here) && i >= 2 && isVowel(w[i - 2])) {
        // Encontro consonantal separável (ex.: "rt", "ss", "ng"): a quebra fica entre as duas.
        if (!inseparable.test(before + here) && !(w[i - 1] === before && inseparable.test(w[i - 2] + before))) cuts.push(i);
      }
    }
    // Cada pedaço precisa ter ao menos duas letras.
    return cuts.filter((cut) => cut >= 2 && w.length - cut >= 2);
  }

  /** Insere hifens opcionais (U+00AD) nas palavras longas; o navegador só os mostra ao quebrar a linha. */
  function hyphenate(text) {
    return text.replace(/\p{L}+/gu, (word) => {
      if (word.length <= MIN_HYPHEN_LENGTH) return word;
      const cuts = new Set(syllableCuts(word));
      return [...word].map((letter, i) => (cuts.has(i) ? "\u00ad" : "") + letter).join("");
    });
  }

  /** Dica de um município do mapa de calor. */
  function focusMunicipality(event, feature, city) {
    showTooltip(
      event,
      feature.properties.name,
      city ? city.count + " " + word(city.count, "jogador", "jogadores") : "Nenhum jogador",
    );
  }

  /** Mostra a dica; com o teclado, ela fica no centro do elemento focado. */
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

  /** Posiciona a dica dentro do painel do mapa, sem ultrapassar as bordas. */
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


  /** Escolhe singular ou plural conforme a quantidade. */
  function word(value, singular, plural) {
    return value === 1 ? singular : plural;
  }
})();
