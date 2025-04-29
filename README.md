# Limitless TCG MCP Server

The [Limitless TCG](https://limitlesstcg.com/) [Model Context Protocol](https://modelcontextprotocol.io/introduction) (MCP) server allows you to use LLMs to integrate with the Limitless TCG API to access tournament and team/decklist data.

## Setup

To run the Limitless TCG MCP server using npx, use the following command:

```
$ npx limitlesstcg-mcp api-key=<LIMITLESS_API_KEY_HERE>
```

You can also set LIMITLESS_API_KEY as an env var without passing `api-key` as a command line argument.

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`. See [here](https://modelcontextprotocol.io/quickstart/user) for more details.

```
{
  "mcpServers": {
    "limitlesstcg": {
      "command": "npx",
      "args": ["limitlesstcg-mcp"],
      "env": {
        "LIMITLESS_API_KEY": "<LIMITLESS_API_KEY_HERE>"
      }
    }
  }
}
```

## Getting a Limitless TCG API Key

To use this MCP server, you'll need a Limitless TCG API key:

1. Go to your user API settings in the Limitless TCG platform
2. Fill out the form linked at the top of the page
3. Once approved, you can find your key on that same page

## Authentication

The server supports authentication via HTTP Headers, as provided by the Limitless TCG API:

```jsx
{
   'X-Access-Key': <LIMITLESS_API_KEY_HERE>
}
```

## API Connection

The server connects to the Limitless TCG API at `https://play.limitlesstcg.com/api` and handles the following endpoints:

- `/tournaments` - List of all tournaments
- `/tournaments/{id}/details` - Details for a specific tournament
- `/tournaments/{id}/standings` - Standings for a specific tournament
- `/tournaments/{id}/pairings` - Match pairings for a specific tournament

## MCP Resources

The server exposes the corresponding MCP resources to LLMs:

- `limitless://tournaments{?game,format,organizerId,limit,page}` - List of tournaments

  - `game`: Game ID, e.g. PTCG, VGC
  - `format`: Format ID
  - `organizerId`: Organization ID for a specific organizer's tournaments
  - `limit`: Number of tournaments to be returned (default: 50)
  - `page`: Used for pagination

- `limitless://tournament/{id}/details` - Details for a specific tournament

- `limitless://tournament/{id}/standings` - Standings for a specific tournament

- `limitless://tournament/{id}/pairings` - Match pairings for a specific tournament

## Using with LLMs

When connected to an MCP-compatible LLM (like Claude), you can ask about tournaments and teams with specific queries such as:

- "Show me the latest Pokémon VGC tournaments"
- "Get the standings for the latest Nino FF"
- "what were the most popular restricted duos in the Smogon Challenge?"

The MCP server handles the API authentication and data formatting for seamless integration with the LLM.

## Author's Note

Interested in the progress of this project? Feel free to follow the repo for live updates!

If you need to get a hold of me regarding this project, feel free to either:

- email me at professor.ragna@gmail.com
- tweet me [@professorragna](https://twitter.com/professorragna)

If you're interested in helping to fund this project, you can support me [here](https://www.buymeacoffee.com/professorragna). Any and all support is greatly appreciated!
