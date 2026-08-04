# mcp-speedrun

Speedrun.com MCP — wraps the Speedrun.com API v1 (speedrun.com/api/v1)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_games` | Search the Speedrun.com database for games by name. Returns matching games with their ID (needed for get_categories and get_leaderboard), abbreviation, release year, and weblink. Example: search_games({ query: "super mario 64", max: 5 }) |
| `get_categories` | List the run categories for a game (e.g. "Any%", "100%", "Glitchless"). Use the game ID from search_games. Each category has an ID needed to fetch a leaderboard via get_leaderboard. Example: get_categories({ game_id: "o1y9wo6q" }) |
| `get_leaderboard` | Fetch the world-record / top-N leaderboard for a specific game category. Returns ranked runs with finish times (ISO-8601 duration plus seconds), run date, players, and weblink. Get game_id from search_games and category_id from get_categories. Example: get_leaderboard({ game_id: "o1y9wo6q", category_id: "7kjpp4k3", top: 10 }) |
| `find_user` | Look up a speedrunner by username. Returns matching users with their ID, display name, and profile weblink. Example: find_user({ name: "cheese05" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "speedrun": {
      "url": "https://gateway.pipeworx.io/speedrun/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Speedrun data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
