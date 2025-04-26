import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  description: "Access Limitless TCG tournament data via MCP"
});

// Get API key
const apiKey = getApiKey() || "dddc5b23b5bae0a87ca800c20d336022";
// if (!apiKey) {
//   console.error("ERROR: No API key provided. Please set LIMITLESS_API_KEY environment variable or provide api-key=<API_KEY_HERE> argument.");
//   process.exit(1);
// }

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

  console.log(`Making request to: ${url.toString()}`);
  
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

// Tournament list resource
server.resource(
  "tournaments",
  new ResourceTemplate("limitless://tournaments{?game,format,organizerId,limit,page}", { list: undefined }),
  async (uri, { game, format, organizerId, limit, page }) => {
    // Prepare query parameters for the API request
    const params: Record<string, unknown> = {};
    if (game) params.game = game;
    if (format) params.format = format;
    if (organizerId) params.organizerId = organizerId;
    if (limit) params.limit = limit;
    if (page) params.page = page;
    
    const tournaments = await limitlessRequest("tournaments", params);
    
    // Construct the title based on the query parameters
    let title = "Limitless Tournaments";
    if (game) title += ` - ${game}`;
    if (format) title += ` (${format} format)`;
    if (organizerId) title += ` by organizer ${organizerId}`;
    if (limit) title += ` (limited to ${limit})`;
    if (page) title += ` - Page ${page}`;
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title,
          description: "List of tournaments from Limitless TCG"
        },
        text: JSON.stringify(tournaments, null, 2)
      }]
    };
  }
);

// Tournament details resource
server.resource(
  "tournament-details",
  new ResourceTemplate("limitless://tournament/{id}/details", { list: undefined }),
  async (uri, { id }) => {
    const tournament = await limitlessRequest(`tournaments/${id}/details`);
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title: `Tournament: ${tournament.name || id}`,
          description: `Details for tournament ${tournament.name || id}`
        },
        text: JSON.stringify(tournament, null, 2)
      }]
    };
  }
);

// Tournament standings resource
server.resource(
  "tournament-standings",
  new ResourceTemplate("limitless://tournament/{id}/standings", { list: undefined }),
  async (uri, { id }) => {
    const standings = await limitlessRequest(`tournaments/${id}/standings`);
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title: "Tournament Standings",
          description: `Standings for tournament ID ${id}`
        },
        text: JSON.stringify(standings, null, 2)
      }]
    };
  }
);

// Tournament decklists resource
// server.resource(
//   "tournament-decklists",
//   new ResourceTemplate("limitless://tournament/{id}/decklists", { list: undefined }),
//   async (uri, { id }) => {
//     const decklists = await limitlessRequest(`tournaments/${id}/decklists`);
    
//     return {
//       contents: [{
//         uri: uri.href,
//         metadata: {
//           title: "Tournament Decklists",
//           description: `Decklists for tournament ID ${id}`
//         },
//         text: JSON.stringify(decklists, null, 2)
//       }]
//     };
//   }
// );

// Tournament pairings resource
server.resource(
  "tournament-pairings",
  new ResourceTemplate("limitless://tournament/{id}/pairings", { list: undefined }),
  async (uri, { id }) => {
    const pairings = await limitlessRequest(`tournaments/${id}/pairings`);
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title: "Tournament Pairings",
          description: `Match pairings for tournament ID ${id}`
        },
        text: JSON.stringify(pairings, null, 2)
      }]
    };
  }
);

// Single decklist resource
// server.resource(
//   "decklist",
//   new ResourceTemplate("limitless://decklist/{id}", { list: undefined }),
//   async (uri, { id }) => {
//     const decklist = await limitlessRequest(`decklists/${id}`);
    
//     return {
//       contents: [{
//         uri: uri.href,
//         metadata: {
//           title: `Decklist: ${decklist.player?.name || id}`,
//           description: `Decklist details for ID ${id}`
//         },
//         text: JSON.stringify(decklist, null, 2)
//       }]
//     };
//   }
// );

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);