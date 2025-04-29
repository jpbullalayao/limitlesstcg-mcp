#!/usr/bin/env node

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

const INSTRUCTIONS = `
  You are a helpful assistant that can answer questions about data from Limitless TCG.

  You can use the following tools to answer questions:
  - get_tournaments
  - get_tournament_details
  - get_tournament_standings
  - get_tournament_pairings

  For all of your queries, please default to using VGC as the game unless explicitly asked for information from other games. Also, be concise with your responses. PLEASE DO NOT ask the user more questions after you provide your answer. You are a Q&A assistant, not necessarily a chatbot unless the user's prompts require back-to-back discussion.
`;

const server = new McpServer({
  name: "LimitlessTCG",
  version: "1.0.0",
  description: "Access Limitless TCG tournament data via MCP",
  instructions: INSTRUCTIONS
});

const apiKey = getApiKey();
if (!apiKey) {
  console.error("ERROR: No API key provided. Please set LIMITLESS_API_KEY environment variable or provide api-key=<API_KEY_HERE> argument.");
  process.exit(1);
}

// At this point, we know apiKey is not null
const validApiKey = apiKey as string;

// Helper function to make authenticated API requests
const limitlessRequest = async (endpoint: string, params: Record<string, unknown> = {}) => {
  const url = new URL(`${API_BASE_URL}/${endpoint}`);
  
  // Add any query parameters
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  }

  // Set up request headers
  const headers: Record<string, string> = {
    'X-Access-Key': validApiKey
  };

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
    throw error;
  }
}

const GAMES = ['DBS', 'FW', 'POCKET', 'VGC', 'LORCANA', 'BSS', 'OP', 'SWU', 'PGO', 'GUNDAM', 'DCG', 'other', 'PTCG'] as const;

const tournamentsParamsSchema = z.object({
  game: z.enum(GAMES).optional().default('VGC').describe("The game to filter by."),
  format: z.string().nullish().describe("The format to filter by."),
  organizerId: z.string().nullish().describe("The organizer to filter by."),
  limit: z.union([z.string(), z.number()]).nullable().optional().describe("Number of tournaments to be returned."),
  page: z.union([z.string(), z.number()]).nullable().optional().describe("Used for pagination.")
});

const tournamentIdParamsSchema = z.object({
  id: z.string().describe("The tournament ID.")
});

const GET_TOURNAMENTS_DESC = `
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

server.tool(
  "get_tournaments", 
  GET_TOURNAMENTS_DESC,
  tournamentsParamsSchema.shape,
  async ({ game, format, organizerId, limit, page }, extra) => {
    try {
      // Prepare query parameters for the API request
      const queryParams: Record<string, unknown> = {};
      if (game) queryParams.game = game;
      if (format) queryParams.format = format;
      if (organizerId) queryParams.organizerId = organizerId;
      if (limit) queryParams.limit = limit;
      if (page) queryParams.page = page;
      
      const tournaments = await limitlessRequest("tournaments", queryParams);
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(tournaments)
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
          text: JSON.stringify(tournament)
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

const TOURNAMENT_STANDINGS_DESC = `
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

  Also consider the following:
  - "CSR", "Caly-Shadow" and all similar variations are common nicknames for Calyrex Shadow Rider
  - "CIR", "Caly-Ice" and all similar variations are common nicknames for Calyrex Ice Rider

  Try to find restricted pokemon whose names are exact or similar to the user's input, even if the match is not exact. Keep in mind it is guaranteed that not all of these Pokemon names map 1-to-1 with the pokemon names returned by the Limitless API.
`;

server.tool(
  "get_tournament_standings",
  TOURNAMENT_STANDINGS_DESC,
  tournamentIdParamsSchema.shape,
  async ({ id }, extra) => {
    try {
      const standings = await limitlessRequest(`tournaments/${id}/standings`);
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(standings)
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
          text: JSON.stringify(pairings)
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