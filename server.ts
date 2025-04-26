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
  new ResourceTemplate("limitless://tournaments", { list: undefined }),
  async (uri) => {
    const tournaments = await limitlessRequest("tournaments");
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title: "Limitless TCG Tournaments",
          description: "List of tournaments from Limitless TCG"
        },
        text: JSON.stringify(tournaments, null, 2)
      }]
    };
  }
);

// Tournament details resource
server.resource(
  "tournament",
  new ResourceTemplate("limitless://tournament/{id}", { list: undefined }),
  async (uri, { id }) => {
    const tournament = await limitlessRequest(`tournaments/${id}`);
    
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
server.resource(
  "tournament-decklists",
  new ResourceTemplate("limitless://tournament/{id}/decklists", { list: undefined }),
  async (uri, { id }) => {
    const decklists = await limitlessRequest(`tournaments/${id}/decklists`);
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title: "Tournament Decklists",
          description: `Decklists for tournament ID ${id}`
        },
        text: JSON.stringify(decklists, null, 2)
      }]
    };
  }
);

// Single decklist resource
server.resource(
  "decklist",
  new ResourceTemplate("limitless://decklist/{id}", { list: undefined }),
  async (uri, { id }) => {
    const decklist = await limitlessRequest(`decklists/${id}`);
    
    return {
      contents: [{
        uri: uri.href,
        metadata: {
          title: `Decklist: ${decklist.player?.name || id}`,
          description: `Decklist details for ID ${id}`
        },
        text: JSON.stringify(decklist, null, 2)
      }]
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);