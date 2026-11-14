import { createFileRoute } from "@tanstack/react-router";
import World from "@/game/Scene";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Домик в лесу — прогулка по 3D-миру" },
      { name: "description", content: "Гуляйте по лесу, зайдите в уютный домик с мебелью, окном и кухней." },
      { property: "og:title", content: "Домик в лесу — прогулка по 3D-миру" },
      { property: "og:description", content: "Гуляйте по лесу, зайдите в уютный домик с мебелью, окном и кухней." },
    ],
  }),
  component: World,
});
