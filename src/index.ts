interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Speedrun.com MCP — wraps the Speedrun.com API v1 (speedrun.com/api/v1)
 *
 * Speedrun.com is the central database of video-game speedrunning records.
 *
 * Tools:
 * - search_games: find games by name
 * - get_categories: list run categories for a game
 * - get_leaderboard: fetch the world-record / top-N leaderboard for a category
 * - find_user: look up a speedrunner by username
 *
 * All endpoints are read-only and work with no key. An optional `_apiKey`
 * may be supplied to authenticate the request (sent as X-API-Key); it is not
 * required for reads.
 */


const BASE_URL = 'https://www.speedrun.com/api/v1';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_games',
    description:
      'Search the Speedrun.com database for games by name. Returns matching games with their ID (needed for get_categories and get_leaderboard), abbreviation, release year, and weblink. Example: search_games({ query: "super mario 64", max: 5 })',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Game name or keyword to search for, e.g. "super mario 64", "celeste"',
        },
        max: {
          type: 'number',
          description: 'Maximum number of games to return (default 10)',
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional speedrun.com API key for authenticated access; omit to use the shared platform key',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_categories',
    description:
      'List the run categories for a game (e.g. "Any%", "100%", "Glitchless"). Use the game ID from search_games. Each category has an ID needed to fetch a leaderboard via get_leaderboard. Example: get_categories({ game_id: "o1y9wo6q" })',
    inputSchema: {
      type: 'object',
      properties: {
        game_id: {
          type: 'string',
          description: 'Speedrun.com game ID, as returned by search_games (e.g. "o1y9wo6q")',
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional speedrun.com API key for authenticated access; omit to use the shared platform key',
        },
      },
      required: ['game_id'],
    },
  },
  {
    name: 'get_leaderboard',
    description:
      'Fetch the world-record / top-N leaderboard for a specific game category. Returns ranked runs with finish times (ISO-8601 duration plus seconds), run date, players, and weblink. Get game_id from search_games and category_id from get_categories. Example: get_leaderboard({ game_id: "o1y9wo6q", category_id: "7kjpp4k3", top: 10 })',
    inputSchema: {
      type: 'object',
      properties: {
        game_id: {
          type: 'string',
          description: 'Speedrun.com game ID, as returned by search_games',
        },
        category_id: {
          type: 'string',
          description: 'Speedrun.com category ID, as returned by get_categories',
        },
        top: {
          type: 'number',
          description: 'Number of top-ranked runs to return (default 10)',
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional speedrun.com API key for authenticated access; omit to use the shared platform key',
        },
      },
      required: ['game_id', 'category_id'],
    },
  },
  {
    name: 'find_user',
    description:
      'Look up a speedrunner by username. Returns matching users with their ID, display name, and profile weblink. Example: find_user({ name: "cheese05" })',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Speedrunner username to look up, e.g. "cheese05"',
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional speedrun.com API key for authenticated access; omit to use the shared platform key',
        },
      },
      required: ['name'],
    },
  },
];

// Build request headers. The optional key authenticates the request but is not
// needed for these read-only endpoints.
function buildHeaders(apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'pipeworx/1.0 (+https://pipeworx.io)',
    Accept: 'application/json',
  };
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string | undefined;
  delete args._apiKey;

  switch (name) {
    case 'search_games':
      return searchGames(args.query as string, args.max as number | undefined, apiKey);
    case 'get_categories':
      return getCategories(args.game_id as string, apiKey);
    case 'get_leaderboard':
      return getLeaderboard(
        args.game_id as string,
        args.category_id as string,
        args.top as number | undefined,
        apiKey,
      );
    case 'find_user':
      return findUser(args.name as string, apiKey);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

interface GameEntry {
  id: string;
  names: { international: string; japanese: string | null };
  abbreviation: string;
  weblink: string;
  released: number | null;
}

async function searchGames(query: string, max: number | undefined, apiKey: string | undefined) {
  try {
    if (!query) return { error: 'search_games requires a `query` argument (a game name).' };
    const params = new URLSearchParams({ name: query, max: String(max ?? 10) });
    const res = await fetch(`${BASE_URL}/games?${params}`, { headers: buildHeaders(apiKey) });
    if (!res.ok) return { error: `Speedrun.com search_games error: ${res.status}` };

    const json = (await res.json()) as { data: GameEntry[] };
    const games = (json.data ?? []).map((g) => ({
      id: g.id,
      name: g.names?.international,
      abbreviation: g.abbreviation,
      released: g.released,
      weblink: g.weblink,
    }));
    return { count: games.length, games };
  } catch (err) {
    return { error: `Speedrun.com search_games failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

interface CategoryEntry {
  id: string;
  name: string;
  type: string;
}

async function getCategories(gameId: string, apiKey: string | undefined) {
  try {
    if (!gameId) return { error: 'get_categories requires a `game_id` argument.' };
    const res = await fetch(`${BASE_URL}/games/${encodeURIComponent(gameId)}/categories`, {
      headers: buildHeaders(apiKey),
    });
    if (!res.ok) return { error: `Speedrun.com get_categories error: ${res.status}` };

    const json = (await res.json()) as { data: CategoryEntry[] };
    const categories = (json.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));
    return { count: categories.length, categories };
  } catch (err) {
    return { error: `Speedrun.com get_categories failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

interface LeaderboardPlayer {
  name?: string;
  id?: string;
  rel?: string;
}

interface LeaderboardRunEntry {
  place: number;
  run: {
    id: string;
    weblink: string;
    times: { primary: string; primary_t: number };
    players: LeaderboardPlayer[];
    date: string | null;
  };
}

async function getLeaderboard(
  gameId: string,
  categoryId: string,
  top: number | undefined,
  apiKey: string | undefined,
) {
  try {
    if (!gameId || !categoryId) {
      return { error: 'get_leaderboard requires both `game_id` and `category_id` arguments.' };
    }
    const params = new URLSearchParams({ top: String(top ?? 10) });
    const res = await fetch(
      `${BASE_URL}/leaderboards/${encodeURIComponent(gameId)}/category/${encodeURIComponent(categoryId)}?${params}`,
      { headers: buildHeaders(apiKey) },
    );
    if (!res.ok) return { error: `Speedrun.com get_leaderboard error: ${res.status}` };

    const json = (await res.json()) as { data: { runs: LeaderboardRunEntry[] } };
    const runs = (json.data?.runs ?? []).map((entry) => ({
      place: entry.place,
      time: entry.run?.times?.primary,
      time_seconds: entry.run?.times?.primary_t,
      date: entry.run?.date,
      weblink: entry.run?.weblink,
      players: (entry.run?.players ?? []).map((p) => p.name ?? p.id ?? p.rel),
    }));
    return { count: runs.length, runs };
  } catch (err) {
    return { error: `Speedrun.com get_leaderboard failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

interface UserEntry {
  id: string;
  names: { international: string };
  weblink: string;
}

async function findUser(name: string, apiKey: string | undefined) {
  try {
    if (!name) return { error: 'find_user requires a `name` argument (a speedrunner username).' };
    const params = new URLSearchParams({ lookup: name });
    const res = await fetch(`${BASE_URL}/users?${params}`, { headers: buildHeaders(apiKey) });
    if (!res.ok) return { error: `Speedrun.com find_user error: ${res.status}` };

    const json = (await res.json()) as { data: UserEntry[] };
    const users = (json.data ?? []).map((u) => ({
      id: u.id,
      name: u.names?.international,
      weblink: u.weblink,
    }));
    return { count: users.length, users };
  } catch (err) {
    return { error: `Speedrun.com find_user failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
