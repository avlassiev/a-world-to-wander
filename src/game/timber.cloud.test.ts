import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sharedSave } from "./shared";

// Explicitly opt in: this checks the live shared-world RPC without changing gameplay data.
describe.skipIf(process.env["RUN_CLOUD_TIMBER_TEST"] !== "1")("shared timber compatibility", () => {
  it("an older client cannot erase an existing delivered log", async () => {
    const url = import.meta.env["VITE_SUPABASE_URL"];
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Cloud test configuration is missing");
    const headers = { apikey: key, "Content-Type": "application/json" };
    const read = async () => {
      const response = await fetch(`${url}/rest/v1/shared_forest_world?id=eq.1&select=snapshot,revision`, { headers });
      if (!response.ok) throw new Error(`World read failed: ${response.status}`);
      const rows = z.array(z.object({ revision: z.number(), snapshot: z.unknown() })).parse(await response.json());
      const row = rows[0];
      if (!row) throw new Error("Shared world is missing");
      const save = sharedSave(row.snapshot, { x: 0, y: 0, z: 6, vy: 0 });
      if (!save) throw new Error("Invalid shared world");
      return { revision: row.revision, save };
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { revision, save } = await read();
      const index = save.trees.findIndex((tree) => tree.cutAt !== undefined && tree.timber);
      const expected = save.trees[index];
      if (!expected?.timber) throw new Error("Deliver a log through the UI before running this check");
      const oldSnapshot = structuredClone(save);
      for (const tree of oldSnapshot.trees) {
        delete tree.cutAt; delete tree.timber; delete tree.destroyed; delete tree.explosion;
      }
      const response = await fetch(`${url}/rest/v1/rpc/commit_shared_forest`, {
        method: "POST", headers,
        body: JSON.stringify({ expected_revision: revision, world_snapshot: oldSnapshot }),
      });
      if (!response.ok) throw new Error(`World commit failed: ${response.status}`);
      if (await response.json() !== true) continue;
      const restored = await read();
      expect(restored.save.trees[index]?.cutAt).toBe(expected.cutAt);
      expect(restored.save.trees[index]?.timber).toEqual(expected.timber);
      return;
    }
    throw new Error("World stayed busy during the compatibility check");
  }, 20000);
});