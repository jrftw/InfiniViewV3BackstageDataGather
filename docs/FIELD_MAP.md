# Field Map — Combined Creator Output

See `Plan/Plan.md` for full field definitions.

## Two Backstage exports (merged by Creator ID)

| Backstage UI | URL | Combined fields it feeds |
|---|---|---|
| **Manage creators** | `/portal/anchor/list` | `diamonds_l30d`, `notes`, `relationship_status`, `followers`, `last_live`, L30D hours/days, management dates |
| **Creator Data** | `/portal/data/data` | `total_diamonds` (current month), `live_duration_total_hours`, matches, fan club, multi-guest diamonds, etc. |

## Diamond columns (both kept separately)

| Output column | Source | Meaning |
|---|---|---|
| `total_diamonds` | **Creator Data** export | Diamonds in the **current calendar month** (URL date range = month start → today) |
| `diamonds_l30d` | **Manage creators** export | **Diamonds in L30D** column |
| `performance_data_period` | **Creator Data** export | Backstage "Data period" cell (e.g. `2026-06-01 ~ 2026-06-23`) |

`.env`:

```env
BACKSTAGE_PERFORMANCE_DATE_RANGE=month
```

Use `rolling` + `BACKSTAGE_PERFORMANCE_DAYS=30` only if you want Creator Data diamonds to be a rolling window instead of calendar month.

## Merge keys

1. Primary: `backstage_creator_id` (Creator ID)
2. Fallback: `normalized_username`

## Normalization

| Input | Output |
|---|---|
| `2.98M` | `2980000` |
| `88.46K` | `88460` |
| `1,055d` | `1055` |
| `119h 47m 31s` | `119.79` hours |
| `90.13%` | `90.13` |
| `-` / blank | `null` |

## Data ownership

**Backstage owns:** diamonds, hours, followers, tier, graduation, management dates.

**Manual enrichment owns:** email, phone, CRM ID, notes, do-not-reassign flags.
