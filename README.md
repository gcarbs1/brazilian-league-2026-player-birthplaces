# De onde vem o Brasileirão?

## Resumo

Coleta no Transfermarkt os elencos da Série A de 2026 e o local de nascimento de cada jogador, associa os nascidos no Brasil aos municípios do IBGE e mostra onde eles nasceram em `index.html`:

- **Brasil.** Uma bolha por município, com área proporcional ao número de jogadores.
- **Estado.** Mapa de calor dos municípios, coloridos pelo número de jogadores.
- **Município.** Ao clicar, abre a lista de jogadores com clube e escudo.
- **Busca.** Filtra por jogador, clube ou cidade.

## Estrutura

- `notebooks/00-data_collection.ipynb`: coleta da temporada, dos clubes, dos elencos e dos perfis, com auditoria.
- `notebooks/01-data_processing.ipynb`: seleção dos nascidos no Brasil, associação com municípios, tabelas e dados do mapa.
- `data/raw/`: respostas originais (`transfermarkt-api/`) e referências geográficas (`reference/`).
- `data/processed/`: tabelas prontas para a análise.
- `index.html` e `html/`: explorador com D3; `app.js` (lógica), `styles.css` (estilo), `data/` (dados do mapa), `assets/clubs/` (escudos) e `vendor/` (D3 local).

## Saídas

| arquivo em `data/processed/`                        | conteúdo                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `brasileirao_2026_clubs.csv`                        | os 20 clubes                                                       |
| `brasileirao_2026_squad_memberships.csv`            | um vínculo jogador–clube por linha                                 |
| `brasileirao_2026_player_birthplaces.csv`           | um jogador por linha, com local de nascimento, posição e clubes    |
| `brasileirao_2026_collection_audit.csv`             | contagens e cobertura da coleta                                    |
| `brasileirao_2026_brazilian_player_birthplaces.csv` | nascidos no Brasil, com município, UF, região e coordenadas        |
| `brasileirao_2026_birthplace_cities.csv`            | um município por linha, com a contagem de jogadores                |
| `brasileirao_2026_birthplace_treatment_audit.csv`   | filtros aplicados e cobertura de municípios                        |
