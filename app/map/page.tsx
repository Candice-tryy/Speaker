import { load } from "@/lib/question-bank";
import ClimbingMap from "./ClimbingMap";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Climbing-map home (ported from preview/climbing-map.html). Server loads the real
// question bank; the client component renders the scene + handles progress.
export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const bank = await load();
  return (
    <>
      <ClimbingMap parts={bank.parts} loaded={bank.loaded} initialPart={first(sp.p)} initialPeak={first(sp.pk)} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  if (window.__speakerMapFallbackBound) return;
  window.__speakerMapFallbackBound = true;

  function bind() {
    var stage = document.querySelector('[data-map-stage="true"]');
    if (!stage) {
      window.setTimeout(bind, 50);
      return;
    }

    var startX = null;
    var startY = null;
    var locked = false;

    function readInt(name, fallback) {
      var value = Number(stage.dataset[name]);
      return Number.isFinite(value) ? value : fallback;
    }

    function go(dir) {
      if (stage.dataset.reactReady === "1" || locked) return;
      var partIdx = readInt("partIdx", 1);
      var peakIdx = readInt("peakIdx", 0);
      var total = readInt("totalPeaks", 0);
      var next = peakIdx + dir;
      if (next < 0 || next >= total) return;
      locked = true;
      window.location.href = "/map?p=" + partIdx + "&pk=" + next;
    }

    function goPart(dir) {
      if (stage.dataset.reactReady === "1" || locked) return;
      var partIdx = readInt("partIdx", 1);
      var partCount = readInt("partCount", 0);
      var next = partIdx + dir;
      if (next < 0 || (partCount && next >= partCount)) return;
      locked = true;
      window.location.href = "/map?p=" + next + "&pk=0";
    }

    stage.addEventListener("wheel", function (event) {
      if (stage.dataset.reactReady === "1") return;
      event.preventDefault();
      if (Math.abs(event.deltaY) > 12) go(event.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    stage.addEventListener("mousedown", function (event) {
      if (stage.dataset.reactReady === "1") return;
      startX = event.clientX;
      startY = event.clientY;
    });

    window.addEventListener("mouseup", function (event) {
      if (stage.dataset.reactReady === "1" || startY === null) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      startX = null;
      startY = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) goPart(dx < 0 ? 1 : -1);
      else if (Math.abs(dy) > 55) go(dy < 0 ? 1 : -1);
    });

    stage.addEventListener("touchstart", function (event) {
      if (stage.dataset.reactReady === "1" || !event.touches.length) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });

    stage.addEventListener("touchend", function (event) {
      if (stage.dataset.reactReady === "1" || startY === null || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      startX = null;
      startY = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) goPart(dx < 0 ? 1 : -1);
      else if (Math.abs(dy) > 55) go(dy < 0 ? 1 : -1);
    });
  }

  bind();
})();
          `,
        }}
      />
    </>
  );
}
