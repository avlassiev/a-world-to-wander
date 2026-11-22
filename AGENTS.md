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
- The walkable world spans ±500m with a 1200m ground plane; Horizon draws hills and createTrees includes the nearby and distant forest, backfilled for older saves. Why: every visible tree can react to digging and destruction without duplicate decorative trees.
- The public shared world uses a singleton Cloud snapshot with compare-and-swap revisions; clients replay queued pure world edits on conflict and poll without publishing player position. Why: concurrent computers retain each other's excavation while players move independently.
- Old capability-scoped private saves remain inaccessible to visitors; shared initialization backfills the latest prior world once. Why: preserves existing excavation without exposing private save access.
- Player position is journaled locally while shared excavation is loaded before Canvas. Why: reopening does not move every player to another player's location.
- Mouse look supports pointer lock and canvas dragging after entering the world. Why: embedded previews can deny pointer lock.
- Multiplayer uses one public Realtime presence/broadcast room per active game, ephemeral UUIDs and validated sequenced poses; ref-held avatars interpolate without rerendering terrain. Why: players see walking and turning without putting movement in persistent world snapshots or hitching the scene.
- Above ground T destroys the nearest facing tree through a shared indexed blast edit; underground T still extends tunnels. Destruction and the burst origin are saved on the tree. Why: concurrent edits cannot target a replacement tree or resurrect destroyed trees on reload.
- Timber rules use indexed cut/pickup/drop edits and one cosmetic browser owner UUID; carried logs follow the camera without publishing movement, while dropped logs remain in the shared snapshot. Why: a log cannot be duplicated by concurrent pickups and can be carried home or restored after reopening.
- The shared-world commit RPC preserves cutAt, timber, destroyed and explosion when older snapshots omit them; the opt-in cloud compatibility test replays a legacy snapshot. Why: computers still running older code cannot erase newly delivered logs or destroyed trees.
- Day/night uses a pure wall-clock cycle and ref-driven sky/light updates, independent of saved growth time; dev __game.sky overrides it for checks. Why: all computers share the same sky without world writes or terrain rerenders.
- Third-person mode offsets the camera along its existing facing and raycasts the chase arm; the local player reuses Avatar without networking, and held timber stays on its arms. Why: switching views preserves movement, mouse aim and world edits while walls shorten the camera arm.
- Shed tools (shovel, broom, sword) are pure rules in src/game/tools.ts with one cosmetic owner each in the shared snapshot; digging, filling and blasting require the matching held tool, and a held tool returns to the shelf on pagehide. Why: tools cannot be duplicated or locked forever, and browser checks use __game.tool(kind).
