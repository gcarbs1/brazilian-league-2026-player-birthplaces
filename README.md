# Brazilian League 2026 Player Birthplaces

## Summary

This project collects the 2026 Campeonato Brasileiro Serie A squads and the
birthplaces of their players from Transfermarkt. It uses the JSON endpoint
consumed by Transfermarkt itself, stores the original responses, and builds
analysis-ready CSV files.

## Structure

- `notebooks/00-data_collection.ipynb`: season resolution, data collection,
  processing, and quality checks.
- `notebooks/01-data_cleaning.ipynb`: Brazilian-born player filtering,
  municipality matching, coordinates, and visualization data generation.
- `data/raw/transfermarkt-api/`: compressed JSON responses and request metadata.
- `data/raw/reference/`: cached municipality coordinates and IBGE state geometry.
- `data/processed/`: analysis-ready CSV files.
- `index.html`: local exploratory birthplace map.
- `html/`: styles, interaction code, local D3 build, and generated map data.

## Output

- `brasileirao_2026_player_birthplaces.csv`: one row per unique player, with
  birthplace, birth country, position, and all clubs represented in the season.
- `brasileirao_2026_squad_memberships.csv`: one row per player-club membership.
- `brasileirao_2026_clubs.csv`: the 20 participating clubs.
- `brasileirao_2026_collection_audit.csv`: collection counts and coverage.
- `brasileirao_2026_brazilian_player_birthplaces.csv`: Brazilian-born players
  with standardized municipality, state, region, coordinates, and match status.
- `brasileirao_2026_birthplace_cities.csv`: one row per mapped municipality.
- `brasileirao_2026_birthplace_treatment_audit.csv`: filtering and municipality
  coverage audit.

## Running the collection

Create and activate a virtual environment, install the dependencies, and run
the notebook from the project root or from `notebooks/`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
```

Run `00-data_collection.ipynb` and then `01-data_cleaning.ipynb`. Raw responses
are cached, so an interrupted run resumes without downloading completed requests
again. Set `REFRESH_RAW = True` in the collection notebook to update the snapshot.

To view the exploratory map locally:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. The visualization is also self-contained enough
to open `index.html` directly in a modern browser.

Transfermarkt labels the 2026 Brazilian season with an internal season ID that
may differ from the displayed year. The notebook resolves the ID from the
season metadata instead of hard-coding it.

## Source note

Transfermarkt does not provide a documented public API. The endpoint used here
is an internal JSON data source and may change. Review Transfermarkt's terms and
robots policy before redistributing data or running the collection at scale.

