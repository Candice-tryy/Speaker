import { load } from "@/lib/question-bank";
import ClimbingMap from "./ClimbingMap";

// Climbing-map home (ported from preview/climbing-map.html). Server loads the real
// question bank; the client component renders the scene + handles progress.
export default async function MapPage() {
  const bank = await load();
  return <ClimbingMap parts={bank.parts} loaded={bank.loaded} />;
}
