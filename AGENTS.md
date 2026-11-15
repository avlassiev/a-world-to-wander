<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- 3D world: rules/collision in src/game/world.ts (no React/three), scene in src/game/Scene.tsx; / route is ssr:false. Why: keeps physics testable and Canvas off the server.
- Tree placement and falling rules live in world.ts; Growth draws ref-held poses without React frame updates. Why: deterministic tests cover digging reactions.
- Dev-only window.__game exposes state, dig(x,z), fill(x,z), sim(seconds), view(x,z,targetX,targetZ); data-scene-ready signals rendering. Why: browser checks can reach and inspect digging, filling and falling trees despite slow software rendering.
- Body stores a filled pit while buried; Space launches the player above ground before clearing it. Dev state includes player and sim advances player physics. Why: filling cannot silently teleport the player to the surface, and escape is testable.
- Tunnel cells retain a shaft ID and floor in world.ts; scene draws their connected underground boundaries, and dev __game.tunnel(dirX,dirZ) digs from the live player. Why: passages keep solid ceilings, collision and browser checks share the same excavation data.
- Tunnel furnishings derive from the first, wider room cell per shaft in world.ts, with matching scene geometry and collision footprints; filling only closes the shaft and retains tunnels. Why: furniture leaves walkable space and underground rooms survive filling their entrance.
- Buried trees retain their original pit position and depth; recoverTrees reveals the same tree when digging reaches its roots. Why: filling and re-digging preserve identity instead of spawning replacement trees.
- The walkable world spans ±500m with a 1200m ground plane; Scene's Horizon component draws static far trees and hills beyond the interactive forest. Why: the player can walk far without hitting a wall or seeing empty void.
