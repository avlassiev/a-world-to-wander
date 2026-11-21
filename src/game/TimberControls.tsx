import { useEffect, useState, type RefObject } from "react";
import { ArrowDownToLine, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nearbyTimber } from "./timber";
import { treeAhead, type Body, type FallingTree } from "./world";

export function TimberControls({ trees, player, direction, time, carrying, saw, take }: {
  trees: RefObject<FallingTree[]>; player: RefObject<Body>; direction: RefObject<{ x: number; z: number }>;
  time: RefObject<number>; carrying: RefObject<number>; saw: () => void; take: () => void;
}) {
  const [available, setAvailable] = useState({ saw: false, take: false, held: false });
  useEffect(() => {
    const refresh = () => {
      const held = carrying.current >= 0;
      const next = {
        held,
        saw: !held && treeAhead(trees.current, player.current, direction.current.x, direction.current.z, time.current) >= 0,
        take: held || nearbyTimber(trees.current, player.current, time.current) >= 0,
      };
      setAvailable((old) => old.held === next.held && old.saw === next.saw && old.take === next.take ? old : next);
    };
    refresh();
    const timer = setInterval(refresh, 200);
    return () => clearInterval(timer);
  }, [trees, player, direction, time, carrying]);
  return <div className="game-timber-tools">
    <Button className="game-tool" disabled={!available.saw} aria-label="Спилить дерево" title="Спилить дерево" onClick={(event) => { event.currentTarget.blur(); saw(); }}><span aria-hidden="true">🪚</span></Button>
    <Button className="game-tool" disabled={!available.take} aria-label={available.held ? "Положить бревно" : "Взять бревно"} title={available.held ? "Положить бревно" : "Взять бревно"} onClick={(event) => { event.currentTarget.blur(); take(); }}>
      {available.held ? <ArrowDownToLine aria-hidden="true" /> : <Hand aria-hidden="true" />}
    </Button>
  </div>;
}