# Limitless TCG MCP Server

This is a Model Context Protocol (MCP) server that provides access to Limitless TCG tournament data. It allows Language Models (LLMs) to access tournaments, standings, and decklist information through standardized MCP resources.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the project:

   ```bash
   npm run build
   ```

3. Run the server, providing your Limitless TCG API key:

   ```bash
   # Using environment variable
   LIMITLESS_API_KEY=your_api_key npm run serve

   # OR using command-line argument
   npm run serve -- api-key=your_api_key
   ```

## Getting a Limitless TCG API Key

To use this MCP server, you'll need a Limitless TCG API key:

1. Go to your user API settings in the Limitless TCG platform
2. Fill out the form linked at the top of the page
3. Once approved, you can find your key on that same page

## Authentication

The server supports both authentication methods provided by the Limitless TCG API:

1. **Query Parameter**: The API key is added as a `key` query parameter (default method)
2. **HTTP Header**: The API key is sent as an `X-Access-Key` HTTP header (fallback method)

The server will automatically try the HTTP header method if the query parameter method fails.

## API Connection

The server connects to the Limitless TCG API at `https://play.limitlesstcg.com/api` and handles the following endpoints:

- `/tournaments` - List of all tournaments
- `/tournaments/{id}/details` - Details for a specific tournament
- `/tournaments/{id}/standings` - Standings for a specific tournament
- `/tournaments/{id}/pairings` - Match pairings for a specific tournament

## MCP Resources

The server exposes the following MCP resources to LLMs:

- `limitless://tournaments` - List of all tournaments
- `limitless://tournament/{id}/details` - Details for a specific tournament
- `limitless://tournament/{id}/standings` - Standings for a specific tournament
- `limitless://tournament/{id}/pairings` - Match pairings for a specific tournament

## Using with LLMs

When connected to an MCP-compatible LLM (like Claude), you can request information about tournaments and decklists:

- "Show me a list of recent tournaments"
- "Get the standings for tournament 123"
- "Show me the top decklists from tournament 456"
- "Show me the match pairings for tournament 789"

The MCP server handles the API authentication and data formatting for seamless integration with the LLM.

## Troubleshooting

If you encounter connection issues:

1. Verify your API key is correct
2. Check console logs for detailed error messages
3. Ensure the Limitless TCG API is accessible from your network
4. Check if your API key has the necessary permissions
