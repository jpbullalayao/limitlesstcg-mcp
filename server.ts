import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// @ts-ignore - cross-fetch will be available at runtime through package.json
import fetch from "cross-fetch";

// Get API key from environment variables or command line arguments
const getApiKey = (): string | null => {
  // First check environment variable
  if (process.env.LIMITLESS_API_KEY) {
    return process.env.LIMITLESS_API_KEY;
  }

  // Then check command line arguments
  const apiKeyArg = process.argv.find(arg => arg.startsWith("api-key="));
  if (apiKeyArg) {
    return apiKeyArg.split("=")[1];
  }

  // No API key found
  return null;
};

// Base URL for Limitless TCG API
const API_BASE_URL = "https://play.limitlesstcg.com/api";

// Create an MCP server
const server = new McpServer({
  name: "LimitlessTCG",
  version: "1.0.0",
  description: "Access Limitless TCG tournament data via MCP",
  instructions: "For all of your queries, please default to using VGC as the game unless explicitly asked for information from other games."
});

// Get API key
const apiKey = getApiKey();
if (!apiKey) {
  console.error("ERROR: No API key provided. Please set LIMITLESS_API_KEY environment variable or provide api-key=<API_KEY_HERE> argument.");
  process.exit(1);
}

// At this point, we know apiKey is not null
const validApiKey = apiKey as string;

// Helper function to make authenticated API requests
async function limitlessRequest(endpoint: string, params: Record<string, unknown> = {}, useHeaderAuth = false) {
  // Remove leading slash if present for consistency
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  const url = new URL(`${API_BASE_URL}/${cleanEndpoint}`);
  
  // Add any query parameters
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  }

  // Set up request headers
  const headers: Record<string, string> = {};
  
  // Add API key either as query parameter or HTTP header based on preference
  if (useHeaderAuth) {
    // Use HTTP header authentication
    headers['X-Access-Key'] = validApiKey;
  } else {
    // Use query parameter authentication
    url.searchParams.append("key", validApiKey);
  }

  // process.stderr.write(`Making request to: ${url.toString()}\n`);
  
  try {
    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching from Limitless API: ${error}`);
    
    // If using query param auth failed, try with header auth
    if (!useHeaderAuth) {
      console.log("Retrying with header authentication...");
      return limitlessRequest(endpoint, params, true);
    }
    
    throw error;
  }
}

const GAME_ENUM = z.enum(['DBS', 'FW', 'POCKET', 'VGC', 'LORCANA', 'BSS', 'OP', 'SWU', 'PGO', 'GUNDAM', 'DCG', 'other', 'PTCG']);

// Define tournament parameters schema with ZodRawShape
const tournamentsParamsSchema = z.object({
  game: GAME_ENUM.nullish().describe("The game to filter by."),
  format: z.string().nullish().describe("The format to filter by."),
  organizerId: z.string().nullish().describe("The organizer to filter by."),
  limit: z.union([z.string(), z.number()]).nullable().optional().describe("Number of tournaments to be returned."),
  page: z.union([z.string(), z.number()]).nullable().optional().describe("Used for pagination.")
});

// Define tournament ID parameter schema with ZodRawShape
const tournamentIdParamsSchema = z.object({
  id: z.string().describe("The tournament ID.")
});

const getTournamentsDesc = `
  Retrieve a list of tournaments with optional filtering by game, format, organizer, etc.

  It can accept the following parameters:
  - game (str, optional): The game to filter by.
  - format (str, optional): The format to filter by.
  - organizerId (str, optional): The organizer to filter by.
  - limit (str | int, optional): Number of tournaments to be returned.
  - page (str | int, optional): Used for pagination.

  Default to VGC as the game. Pass PTCG as the game if the user explicitly requests for TCG tournaments.

  Try to find tournaments whose names are exact or similar to the user's input, even if the match is not exact.

  If the user requests for a specific tournament, and you can't find it, please attempt to find the tournament on later pages without explicitly being asked by the user. Don't go past tournaments that happened more than a month ago unless explicitly asked by the user.

  If the user requests for upcoming tournaments, please let them know that you only have access to tournaments that have just completed. Then provide them with results immediately.
`;

// Tool 1: Get Tournament List
server.tool(
  "get_tournaments", 
  getTournamentsDesc,
  tournamentsParamsSchema.shape,
  async ({ game, format, organizerId, limit, page }, extra) => {
    try {
      console.log("game", game);
      // Prepare query parameters for the API request
      const queryParams: Record<string, unknown> = {};
      if (game) queryParams.game = game;
      if (format) queryParams.format = format;
      if (organizerId) queryParams.organizerId = organizerId;
      if (limit) queryParams.limit = limit;
      if (page) queryParams.page = page;
      
      const tournaments = await limitlessRequest("tournaments", queryParams);
      
      // Construct the title based on the query parameters
      let title = "Limitless Tournaments";
      if (game) title += ` - ${game}`;
      if (format) title += ` (${format} format)`;
      if (organizerId) title += ` by organizer ${organizerId}`;
      if (limit) title += ` (limited to ${limit})`;
      if (page) title += ` - Page ${page}`;
      
      return {
        content: [{ 
          type: "text", 
          text: `# ${title}\n\n${JSON.stringify(tournaments, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ 
          type: "text", 
          text: `Error fetching tournaments: ${error}` 
        }]
      };
    }
  }
);

// Tool 2: Get Tournament Details
server.tool(
  "get_tournament_details",
  "Retrieve detailed information about a specific tournament",
  tournamentIdParamsSchema.shape,
  async ({ id }, extra) => {
    try {
      const tournament = await limitlessRequest(`tournaments/${id}/details`);
      
      return {
        content: [{ 
          type: "text", 
          text: `# Tournament: ${tournament.name || id}\n\n${JSON.stringify(tournament, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ 
          type: "text", 
          text: `Error fetching tournament details: ${error}` 
        }]
      };
    }
  }
);

const tournamentStandingsDesc = `
  Retrieve standings for a specific tournament. If anyone asks about specific pokemon usage, you can find that info in the decklists. 
  If anyone asks about "restricted"s, they're referring to any of the following pokemon:
  - Mewtwo
  - Lugia
  - Ho-Oh
  - Kyogre
  - Groudon
  - Rayquaza
  - Dialga
  - Dialga (Origin Forme)
  - Palkia
  - Palkia (Origin Forme)
  - Giratina (Altered Forme)
  - Giratina (Origin Forme)
  - Reshiram
  - Zekrom
  - Kyurem
  - Kyurem (White Kyurem)
  - Kyurem (Black Kyurem)
  - Cosmog
  - Cosmoem
  - Solgaleo
  - Lunala
  - Necrozma
  - Necrozma (Dusk Mane)
  - Necrozma (Dawn Wings)
  - Zacian
  - Zamazenta
  - Eternatus
  - Calyrex
  - Calyrex (Ice Rider)
  - Calyrex (Shadow Rider)
  - Koraidon
  - Miraidon
  - Terapagos

  Try to find restricted pokemon whose names are exact or similar to the user's input, even if the match is not exact. Keep in mind it is guaranteed that not all of these Pokemon names map 1-to-1 with the pokemon names returned by the Limitless API.
`;

// Tool 3: Get Tournament Standings
server.tool(
  "get_tournament_standings",
  tournamentStandingsDesc,
  tournamentIdParamsSchema.shape,
  async ({ id }, extra) => {
    try {
      const standings = await limitlessRequest(`tournaments/${id}/standings`);
      
      return {
        content: [{ 
          type: "text", 
          text: `# Tournament Standings\n\n${JSON.stringify(standings, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ 
          type: "text", 
          text: `Error fetching tournament standings: ${error}` 
        }]
      };
    }
  }
);

// Tool 4: Get Tournament Pairings
server.tool(
  "get_tournament_pairings",
  "Retrieve match pairings for a specific tournament",
  tournamentIdParamsSchema.shape,
  async ({ id }, extra) => {
    try {
      const pairings = await limitlessRequest(`tournaments/${id}/pairings`);
      
      return {
        content: [{ 
          type: "text", 
          text: `# Tournament Pairings\n\n${JSON.stringify(pairings, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ 
          type: "text", 
          text: `Error fetching tournament pairings: ${error}` 
        }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);