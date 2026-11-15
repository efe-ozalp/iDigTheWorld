
# iDigTheWorld
As kids, we've all wondered what would happen if we dug straight down. Would we end up in China? (Spoiler: from most of the US, you'd end up in the Indian Ocean!!!) We wanted to turn that childhood question into a way to learn about the world, and to build it in the style of the wonder-inspiring, magical illustrated encyclopedias and CD-ROMs of the 1990s, a look now called "Utopian Scholastic".

You could say we took "let's dig in" quite literally!

## How we built it
- Front end: React, TypeScript and Vite, with react-globe.gl (three.js) for the globe. The look is modelled on 1990s illustrated encyclopedias.
- AI: Llama 4 Maverick through the Databricks Foundation Model API. Every card is written from Wikipedia text about its own subject and returned as validated JSON, and the app falls back to the encyclopedia entry if the model fails.
- Data: OpenStreetMap Nominatim for place names, Wikipedia and Wikimedia Commons for text and credited photos, and bundled Natural Earth data for naming oceans and finding coastlines.
- Hosting: a small dependency-free Node server on Databricks Apps, deployed from GitHub.


## How to Run:
1. Download and install [node.js](https://nodejs.org/en/download)
2. Install dependencies: `npm install`
3. In terminal: `npm run dev`
