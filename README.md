# De onde vem o Brasileirão?

## Resumo

Coleta no Transfermarkt os elencos da Série A do Campeonato Brasileiro de 2026 e o local de nascimento de cada jogador. Usa o endpoint JSON consumido pelo próprio Transfermarkt, guarda as respostas originais e constrói tabelas prontas para a análise. Os jogadores nascidos no Brasil são associados aos municípios do IBGE, e o explorador em `index.html` mostra onde eles nasceram:

- **Mapa nacional.** Uma bolha por município de nascimento, com área proporcional ao número de jogadores.
- **Mapa estadual.** Ao clicar num estado, aparece um mapa de calor: os municípios são coloridos pelo número de jogadores.
- **Painel do município.** Ao clicar numa bolha ou num município, a lista de jogadores abre com o clube e o escudo de cada um.
- **Busca.** Um campo de texto filtra por jogador, clube ou cidade nas duas visões.

## Estrutura

- `notebooks/00-data_collection.ipynb`: coleta, feita em quatro partes:
  - a temporada e os 20 clubes participantes;
  - o elenco de cada clube;
  - o perfil e o local de nascimento de cada jogador;
  - a auditoria da cobertura.

  As respostas ficam em cache em JSON compactado.

- `notebooks/01-data_processing.ipynb`: seleção dos jogadores nascidos no Brasil, associação com os municípios, coordenadas, tabelas da visualização, auditoria e exportação dos dados do mapa.
- `data/raw/`: dados de entrada do pipeline; as respostas originais ficam em `transfermarkt-api/` e as referências geográficas, em `reference/`.
- `data/processed/`: tabelas prontas para a análise.
- `index.html` e `html/`: explorador com D3 (local); os dados ficam em `html/data/`.

### Leitura do front-end

| arquivo                      | responsabilidade                                                          |
| ---------------------------- | ------------------------------------------------------------------------- |
| `index.html`                 | estrutura semântica: apresentação, filtros, mapa e painel do município    |
| `html/styles.css`            | tema, componentes, mapa e responsividade, na ordem em que aparecem        |
| `html/app.js`                | estado, filtros e construção dos mapas nacional e estadual                |
| `html/data/birthplaces.js`   | jogadores mapeados, exportados pelo notebook 01                           |
| `html/data/brazil-states.js` | limites estaduais do IBGE                                                 |
| `html/data/municipalities/`  | malha municipal de cada estado, carregada sob demanda                     |
| `html/assets/clubs/`         | escudos dos clubes                                                        |
| `html/vendor/`               | cópia local do D3                                                         |

## Saídas

| arquivo em `data/processed/`                            | conteúdo                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `brasileirao_2026_clubs.csv`                            | os 20 clubes participantes                                                              |
| `brasileirao_2026_squad_memberships.csv`                | uma linha por vínculo jogador–clube                                                     |
| `brasileirao_2026_player_birthplaces.csv`               | uma linha por jogador único, com local e país de nascimento, posição e clubes           |
| `brasileirao_2026_collection_audit.csv`                 | contagens e cobertura da coleta                                                         |
| `brasileirao_2026_brazilian_player_birthplaces.csv`     | nascidos no Brasil, com município, UF, região, coordenadas e situação da associação     |
| `brasileirao_2026_birthplace_cities.csv`                | uma linha por município mapeado, com a contagem de jogadores                            |
| `brasileirao_2026_birthplace_treatment_audit.csv`       | filtros aplicados e cobertura de municípios                                             |

## Execução

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
```

Rode os notebooks 00 e 01 em ordem, na raiz do projeto ou em `notebooks/`. As respostas ficam em cache em `data/raw/transfermarkt-api/`, então uma execução interrompida continua de onde parou; para atualizar o retrato dos dados, use `REFRESH_RAW = True` no notebook 00.

Para ver o explorador:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000`. A visualização também funciona abrindo o `index.html` diretamente em um navegador moderno.

O Transfermarkt rotula a temporada brasileira de 2026 com um ID interno que pode diferir do ano exibido. O notebook resolve o ID pelos metadados da temporada, em vez de fixá-lo no código.

## Nota sobre a fonte

O Transfermarkt não oferece uma API pública documentada. O endpoint usado aqui é uma fonte de dados interna e pode mudar. Consulte os termos de uso e a política de robôs do Transfermarkt antes de redistribuir os dados ou de rodar a coleta em larga escala.
