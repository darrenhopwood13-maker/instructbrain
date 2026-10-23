import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import "maplibre-gl/dist/maplibre-gl.css";
// The tile worker as its own emitted asset. MapLibre works out a worker URL from its
// own module location, which Vite rewrites in a production build - the map then paints
// its background and nothing else, with "Worker failed to load" in the console. Passing
// the URL Vite emitted removes the guesswork in both dev and the published build.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/query-states";
import { orgDashboardQuery } from "@/lib/data";
import { projectPoints, type ProjectPoint } from "@/lib/map/project-points.functions";
import { countsByProject, mapCaveats, mapTotals, type ProjectCounts } from "@/lib/map/summary";
import { insightByProject, type ProjectInsight } from "@/lib/map/insight";
import { buildTrends } from "@/lib/map/trends";
import { streetLevel } from "@/lib/map/street-level.functions";
import { useOrganisations } from "@/lib/use-organisations";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Where the work is — instructBrain" },
      {
        name: "description",
        content:
          "Every project pinned from the postcode on its record, with the items still open and the ones past their target date.",
      },
    ],
  }),
  component: MapScreen,
});

/**
 * Pin colours, in hex because MapLibre has no oklch parser. Converted from the app's own
 * tokens - oklch(87.73% .2803 139.6) is #57ff00, and the light surface's destructive is
 * #b3261e - so the map cannot drift from the chrome. The basemap itself is
 * /public/map/ib-light-style.json: the light working surface, not a navy slab.
 */
const ACCENT = "#57ff00";
const FAIL = "#b3261e";
const PIN_RING = "#ffffff";
const SELECTED_RING = "#24417b";

const POINTS_KEY = (organisationIds: string[]) => ["map", "points", [...organisationIds].sort()];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Google dates a panorama to the month, so print the month - not a day it never claimed. */
function formatMonthYear(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function MapScreen() {
  const { organisationIds } = useOrganisations();
  const loadPoints = useServerFn(projectPoints);
  const today = todayIso();

  const pointsQuery = useQuery({
    queryKey: POINTS_KEY(organisationIds),
    enabled: organisationIds.length > 0,
    queryFn: () => loadPoints({ data: { organisationIds } }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const itemsQuery = useQuery(orgDashboardQuery(organisationIds));

  const points = useMemo(() => pointsQuery.data ?? [], [pointsQuery.data]);
  const counts = useMemo(
    () => countsByProject(itemsQuery.data?.items ?? [], today),
    [itemsQuery.data, today],
  );
  const insights = useMemo(
    () => insightByProject(itemsQuery.data?.items ?? [], today),
    [itemsQuery.data, today],
  );
  const trends = useMemo(() => buildTrends(itemsQuery.data?.items ?? [], today), [itemsQuery.data, today]);
  const totals = useMemo(() => mapTotals(points, counts), [points, counts]);
  const caveats = useMemo(() => mapCaveats(totals), [totals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<MapView>("map");
  const [panel, setPanel] = useState<"overview" | "trends">("overview");
  const selected = points.find((p) => p.projectId === selectedId) ?? null;

  // The map fills what is left of the viewport under the shell header, so it needs to
  // know how tall that header actually is - it wraps differently on a phone. Measured,
  // not guessed, so a future change to the header cannot leave a gap or a scrollbar.
  const [headerHeight, setHeaderHeight] = useState(85);
  useEffect(() => {
    const el = document.querySelector(".app-shell-header");
    if (!el) return;
    const apply = () => setHeaderHeight(Math.round(el.getBoundingClientRect().height));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const loading = pointsQuery.isPending || itemsQuery.isPending;
  const failed = pointsQuery.isError || itemsQuery.isError;

  return (
    <AppShell surface="light">
      <style>{`
        .map-screen { --map-border: var(--border); --ib-header: 85px; }
        .map-screen .map-canvas { position: absolute; inset: 0; }
        .map-screen .pin-popup .maplibregl-popup-content {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--card);
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.14);
        }
        .map-screen .pin-popup .maplibregl-popup-tip { border-top-color: var(--card); }
        .map-screen .pin-pop-title { font-weight: 700; font-size: 13px; color: var(--foreground); }
        .map-screen .pin-pop-address { margin-top: 2px; font-size: 11px; color: var(--muted-foreground); }
        .map-screen .pin-pop-stats {
          display: flex; flex-wrap: wrap; gap: 10px;
          margin-top: 8px; font-size: 11px; color: var(--muted-foreground);
        }
        .map-screen .pin-pop-stats b { color: var(--foreground); font-variant-numeric: tabular-nums; }
        .map-screen .pin-pop-late b { color: var(--fail); }
        .map-screen .pin-pop-note { margin-top: 6px; font-size: 11px; line-height: 1.45; color: var(--muted-foreground); }
        /* The map is the page. It starts under the shell header and runs to the foot
           of the viewport; the rail scrolls inside that height rather than pushing
           the document taller than the screen. */
        .map-screen .map-frame { height: 64dvh; }
        @media (min-width: 1024px) {
          /* flex-1 on the grid sets flex-basis: 0, which overrides a plain height and lets
             the rail's content stretch the document - the map then gets pushed up and a
             white band appears under it, and the detail card ends up below the fold.
             Pinning the grid to the viewport height and taking it out of the flex
             distribution is what makes the rail scroll inside itself instead. */
          .map-screen .map-grid {
            flex: 0 0 auto;
            height: calc(100dvh - var(--ib-header));
          }
          .map-screen .map-frame { height: calc(100dvh - var(--ib-header)); }
        }
        .map-screen .maplibregl-ctrl-group {
          background: var(--card) !important; border: 1px solid var(--border) !important;
          border-radius: 10px !important; overflow: hidden;
        }
        .map-screen .maplibregl-ctrl-group button + button { border-top: 1px solid var(--border) !important; }
        .map-screen .maplibregl-ctrl-attrib { font-family: var(--font-sans) !important; font-size: 10px !important; }
        .map-screen .maplibregl-ctrl-attrib a { color: var(--muted-foreground) !important; }
        /* Clear the fixed mobile nav and the help bubble, which both sit over the
           attribution pill at the bottom of the map on a phone. */
        @media (max-width: 639px) {
          .map-screen .maplibregl-ctrl-bottom-left { bottom: 68px; }
        }
      `}</style>

      <div
        className="map-screen -mx-4 -mb-28 -mt-10 flex min-h-0 flex-col sm:-mx-6 sm:-mb-20 lg:-mx-10 lg:-mt-12"
        style={{ "--ib-header": `${headerHeight}px` } as CSSProperties}
      >
        {/* No page header. The map is the page - the title block was eating a fifth of
            the screen to say what the pins already say. Heading kept for the outline. */}
        <h1 className="sr-only">Where the work is</h1>

        {failed ? (
          <div className="px-4 sm:px-6 lg:px-10">
            <ErrorState
              title="The map could not be built"
              error={pointsQuery.error ?? itemsQuery.error}
              onRetry={() => {
                void pointsQuery.refetch();
                void itemsQuery.refetch();
              }}
            />
          </div>
        ) : (
          <div className="map-grid grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="map-frame relative border-b border-border lg:border-b-0 lg:border-r">
              <MapCanvas
                points={points}
                counts={counts}
                selectedId={selectedId}
                onSelect={setSelectedId}
                view={view}
                insights={insights}
              />
              <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border border-border bg-card/95 shadow-sm backdrop-blur">
                {VIEWS.map((option) => {
                  const active = option.id === view;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setView(option.id)}
                      aria-pressed={active}
                      className={
                        "px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors " +
                        (active
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {loading ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/40">
                  <LoadingState label="Placing your projects…" />
                </div>
              ) : null}
            </div>

            <aside className="min-h-0 overflow-y-auto border-b border-border px-4 py-4 sm:px-6 lg:px-5">
              <div className="mb-4 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                {(["overview", "trends"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPanel(option)}
                    aria-pressed={panel === option}
                    className={
                      "flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors " +
                      (panel === option
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {option === "overview" ? "Projects" : "Trends"}
                  </button>
                ))}
              </div>

              {panel === "trends" ? <TrendPanel trends={trends} totals={totals} /> : (
              <>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Projects" value={totals.projects} />
                <Tile label="Placed" value={totals.pinned} />
                <Tile label="Past their date" value={totals.overdue} tone="bad" />
                <Tile label="No address" value={totals.noAddress} tone={totals.noAddress ? "warn" : undefined} />
              </div>

              {caveats.length > 0 ? (
                <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                  {caveats.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Click a pin or a row
              </p>

              <ul className="mt-2 space-y-2">
                {points.map((point) => (
                  <li key={point.projectId}>
                    <ProjectRow
                      point={point}
                      counts={counts.get(point.projectId)}
                      selected={point.projectId === selectedId}
                      onSelect={() => setSelectedId(point.projectId)}
                    />
                  </li>
                ))}
              </ul>

              {selected ? (
                <ProjectDetail point={selected} counts={counts.get(selected.projectId)} />
              ) : null}

              <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Pins come from the postcode on the project address: Google Geocoding first, which
                returns a rooftop point, then postcodes.io as a free fallback - UK only. A project
                with no postcode cannot be placed and is counted rather than hidden. Items and target
                dates are the same figures the dashboard reads.
              </p>
              </>
              )}
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" | undefined }) {
  const colour =
    tone === "bad" ? "text-fail" : tone === "warn" ? "text-warn" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className={`font-display text-2xl font-bold leading-none tracking-tight ${colour}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ProjectRow({
  point,
  counts,
  selected,
  onSelect,
}: {
  point: ProjectPoint;
  counts: ProjectCounts | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const overdue = counts?.overdue ?? 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-brand-accent bg-brand-accent-soft"
          : "border-border bg-card hover:border-brand-accent/60"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
          overdue > 0 ? "bg-fail" : point.pinned ? "bg-brand-accent" : "bg-muted-foreground/40"
        }`}
      />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold">{point.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {point.address || "No address on this project"}
        </span>
        {!point.pinned ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            No postcode - cannot be placed
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ProjectDetail({ point, counts }: { point: ProjectPoint; counts: ProjectCounts | undefined }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-3.5">
      <h2 className="font-display text-base font-semibold">{point.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {point.address || "No address on this project"}
      </p>
      <dl className="mt-3 space-y-0 text-[13px]">
        <Row label="Placed on" value={point.locationLabel ?? "Not placed"} />
        <Row label="Items on record" value={String(counts?.items ?? 0)} />
        <Row
          label="Past their date"
          value={String(counts?.overdue ?? 0)}
          tone={counts?.overdue ? "bad" : "ok"}
        />
        <Row label="Last report" value={formatDate(counts?.lastReportDate ?? null)} />
      </dl>
      <StreetLevel point={point} />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "bad" | "ok" }) {
  const colour =
    tone === "bad" ? "text-fail" : tone === "ok" ? "text-brand-accent-deep" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5 first:border-t-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-semibold tabular-nums ${colour}`}>{value}</dd>
    </div>
  );
}

/**
 * Street level: Google first, Mapillary behind it.
 *
 * The lookup runs in a server function, so neither key reaches the browser - the Google
 * image arrives as bytes we fetched, the Mapillary one as a public CDN URL. Everything the
 * pane can say is a real state: neither provider configured, no coverage from either, a key
 * or quota refused, or an actual photograph with its capture date and the credit line its
 * licence requires. Nothing is substituted.
 */
function StreetLevel({ point }: { point: ProjectPoint }) {
  const load = useServerFn(streetLevel);
  const pinned = point.latitude !== null && point.longitude !== null;

  const query = useQuery({
    queryKey: ["street-level", point.latitude, point.longitude],
    enabled: pinned,
    queryFn: () => load({ data: { latitude: point.latitude!, longitude: point.longitude! } }),
    // A panorama does not change between two clicks on the same afternoon, and Google
    // bills per image. The cache is the difference between one call and a dozen.
    staleTime: 12 * 60 * 60 * 1000,
    retry: 1,
  });

  const result = query.data;
  const provider = result?.state === "ok" ? result.provider : null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-sunken">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-brand-accent">
          {provider ? `Street level · ${provider}` : "Street level"}
        </span>
      </div>

      {!pinned ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          This project has no postcode, so there is no point to look up imagery for.
        </p>
      ) : query.isPending ? (
        <p className="px-3 py-3 text-[11.5px] text-muted-foreground">Looking for the nearest capture…</p>
      ) : query.isError ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Street level could not be asked for. Nothing has been substituted for it.
        </p>
      ) : result?.state === "not_configured" ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Street level needs GOOGLE_MAPS_API_KEY or MAPILLARY_TOKEN in the server environment. Until
          then this pane stays empty rather than showing a photograph that is not your site.
        </p>
      ) : result?.state === "none" ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          No street-level coverage within reach of this address, from Google or Mapillary. New-build
          and rural sites often have none - a coverage gap, not a fault in the app.
        </p>
      ) : result?.state === "unavailable" ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          {result.reason} Nothing has been substituted for it.
        </p>
      ) : result?.state === "ok" ? (
        <>
          <img
            src={result.imageUrl}
            alt={`Street-level view of ${point.address || point.name}`}
            className="mt-2 w-full"
          />
          <p className="px-3 py-2 text-[10.5px] text-muted-foreground">
            {result.provider === "Google"
              ? `Captured ${formatMonthYear(result.capturedAt)}`
              : `Captured ${formatDate(result.capturedAt)}`}{" "}
            · {result.credit}
            {result.linkUrl ? (
              <>
                {" · "}
                <a
                  href={result.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  open on Mapillary
                </a>
              </>
            ) : null}
          </p>
        </>
      ) : null}
    </div>
  );
}

type MapView = "map" | "satellite" | "3d";

const VIEWS: { id: MapView; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "satellite", label: "Satellite" },
  { id: "3d", label: "3D" },
];

type MapCanvasProps = {
  points: ProjectPoint[];
  counts: Map<string, ProjectCounts>;
  insights: Map<string, ProjectInsight>;
  selectedId: string | null;
  onSelect: (projectId: string) => void;
  view: MapView;
};

/** Popup content is built as HTML for MapLibre, so names from the database are escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pinPopupHtml(point: ProjectPoint, counts: ProjectCounts | undefined, insight: ProjectInsight | undefined): string {
  const rows: string[] = [];
  if (point.address) rows.push(`<div class="pin-pop-address">${escapeHtml(point.address)}</div>`);

  const items = counts?.items ?? 0;
  const open = counts?.open ?? 0;
  const overdue = counts?.overdue ?? 0;
  rows.push(
    `<div class="pin-pop-stats"><span><b>${items}</b> items</span><span><b>${open}</b> open</span>` +
      `<span class="${overdue > 0 ? "pin-pop-late" : ""}"><b>${overdue}</b> past their date</span></div>`,
  );

  if (insight?.averageDaysLate != null) {
    rows.push(`<div class="pin-pop-note">Late ones are ${insight.averageDaysLate} days past their date on average.</div>`);
  }
  if (insight?.oldestOpenDays != null) {
    rows.push(`<div class="pin-pop-note">Oldest open item was raised ${insight.oldestOpenDays} days ago.</div>`);
  }
  if (insight && insight.severity.length > 0) {
    const mix = insight.severity.map((entry) => `${entry.count} ${escapeHtml(entry.label)}`).join(" · ");
    rows.push(`<div class="pin-pop-note">Open by severity: ${mix}.</div>`);
  }
  if (insight?.busiestTrade) {
    rows.push(`<div class="pin-pop-note">Most open work sits with ${escapeHtml(insight.busiestTrade)}.</div>`);
  }

  return (
    `<div class="pin-pop"><div class="pin-pop-title">${escapeHtml(point.name)}</div>` +
    rows.join("") +
    `</div>`
  );
}

/**
 * The map itself, loaded on demand.
 *
 * MapLibre is dynamically imported so the map code is not in the bundle for anyone who
 * never opens this screen. The style is a static document in /public/map, recoloured
 * from the app's own tokens; the tiles are OpenFreeMap's, which are free for product
 * use as well as prototypes - OpenStreetMap's own raster tiles are not, which is why
 * the prototype note about a paid contract does not apply to this route.
 */
function MapCanvas({ points, counts, insights, selectedId, onSelect, view }: MapCanvasProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const dataRef = useRef({ points, counts, insights });
  dataRef.current = { points, counts, insights };
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);

  const features = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
          type: "Feature" as const,
          properties: {
            projectId: p.projectId,
            overdue: counts.get(p.projectId)?.overdue ?? 0,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [p.longitude as number, p.latitude as number],
          },
        })),
    }),
    [points, counts],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl(maplibreWorkerUrl);

      const instance = new maplibregl.Map({
        container: container.current,
        style: "/map/ib-light-style.json",
        center: [-0.11, 51.521],
        zoom: 10.6,
        // The tile data stops at zoom 14; above that MapLibre overzooms. The style now carries its
        // road widths, label sizes and building contrast out to zoom 18, so the map still reads as a
        // map up there instead of fading to a blank page. 18 is the ceiling: past it the same z14
        // geometry is stretched so far that a building fills the screen.
        maxZoom: 18,
        maxPitch: 70,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      instance.on("load", () => {
        instance.addSource("projects", { type: "geojson", data: features });

        // Satellite photography, inserted beneath the style's label layers so street and place
        // names still read on top of it, and hidden until someone picks that view.
        instance.addSource("satellite", {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery: Esri, Maxar, Earthstar Geographics",
        });
        const baseLayers = instance.getStyle()?.layers ?? [];
        const firstLabel = baseLayers.find((layer) => layer.type === "symbol")?.id;
        instance.addLayer(
          {
            id: "satellite-imagery",
            type: "raster",
            source: "satellite",
            layout: { visibility: "none" },
            paint: { "raster-opacity": 1 },
          },
          firstLabel,
        );

        instance.addLayer({
          id: "project-halo",
          type: "circle",
          source: "projects",
          paint: {
            "circle-radius": ["case", ["==", ["get", "projectId"], ""], 26, 16],
            "circle-color": ["case", [">", ["get", "overdue"], 0], FAIL, ACCENT],
            "circle-opacity": 0.14,
          },
        });

        instance.addLayer({
          id: "project-pins",
          type: "circle",
          source: "projects",
          paint: {
            "circle-radius": 7,
            "circle-color": ["case", [">", ["get", "overdue"], 0], FAIL, ACCENT],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": PIN_RING,
          },
        });

        instance.addLayer({
          id: "project-selected",
          type: "circle",
          source: "projects",
          filter: ["==", ["get", "projectId"], ""],
          paint: {
            "circle-radius": 11,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 2,
            "circle-stroke-color": SELECTED_RING,
          },
        });

        // Real extrusions for the 3D view. The tiles carry render_height and render_min_height, so
        // this lifts the actual building shapes off the ground rather than leaning a flat map back.
        instance.addLayer(
          {
            id: "buildings-3d",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 13,
            layout: { visibility: "none" },
            paint: {
              "fill-extrusion-color": "#ccd2dd",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.95,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          "project-halo",
        );

        instance.on("click", "project-pins", (event: import("maplibre-gl").MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.["projectId"];
          if (typeof id !== "string") return;
          onSelectRef.current(id);

          const { points: latestPoints, counts: latestCounts, insights: latestInsights } = dataRef.current;
          const point = latestPoints.find((candidate) => candidate.projectId === id);
          if (!point) return;

          popupRef.current?.remove();
          const coordinates =
            feature?.geometry?.type === "Point"
              ? (feature.geometry.coordinates as [number, number])
              : [point.longitude ?? 0, point.latitude ?? 0] as [number, number];

          popupRef.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: false,
            maxWidth: "300px",
            offset: 14,
            className: "pin-popup",
          })
            .setLngLat(coordinates)
            .setHTML(pinPopupHtml(point, latestCounts.get(id), latestInsights.get(id)))
            .addTo(instance);
        });

        // Clicking the map itself dismisses it; clicking a pin keeps it.
        instance.on("click", (event: import("maplibre-gl").MapMouseEvent) => {
          const hits = instance.queryRenderedFeatures(event.point, { layers: ["project-pins"] });
          if (hits.length === 0) popupRef.current?.remove();
        });
        instance.on("mouseenter", "project-pins", () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", "project-pins", () => {
          instance.getCanvas().style.cursor = "";
        });

        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; data changes are pushed into the source below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const instance = map.current;
    const source = instance?.getSource("projects");
    if (source && "setData" in source) {
      (source as import("maplibre-gl").GeoJSONSource).setData(features);
    }

    // First look is the whole portfolio, not one pin at zoom 16. Two projects in
    // different parts of London should both be on screen before anyone clicks.
    if (instance && !fitted.current && features.features.length > 0) {
      const lngs = features.features.map((f) => f.geometry.coordinates[0] as number);
      const lats = features.features.map((f) => f.geometry.coordinates[1] as number);
      const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
      const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
      instance.fitBounds([sw, ne], { padding: 70, maxZoom: 14, duration: 0 });
      fitted.current = true;
    }
  }, [features, ready]);

  useEffect(() => {
    if (!ready) return;
    const instance = map.current;
    if (!instance) return;

    instance.setFilter("project-selected", ["==", ["get", "projectId"], selectedId ?? ""]);

    const point = points.find((p) => p.projectId === selectedId);
    if (point?.latitude != null && point.longitude != null) {
      instance.flyTo({ center: [point.longitude, point.latitude], zoom: 16, speed: 1.1, curve: 1.4 });
    }
  }, [selectedId, ready, points]);

  useEffect(() => {
    if (!ready) return;
    const instance = map.current;
    if (!instance) return;
    if (!instance.getLayer("satellite-imagery") || !instance.getLayer("buildings-3d")) return;

    const showSatellite = view === "satellite";
    const show3d = view === "3d";

    instance.setLayoutProperty("satellite-imagery", "visibility", showSatellite ? "visible" : "none");
    instance.setLayoutProperty("buildings-3d", "visibility", show3d ? "visible" : "none");
    // The flat building fill would z-fight with the extrusions standing on it.
    if (instance.getLayer("building")) {
      instance.setLayoutProperty("building", "visibility", show3d ? "none" : "visible");
    }

    instance.easeTo(
      show3d ? { pitch: 58, bearing: -22, duration: 900 } : { pitch: 0, bearing: 0, duration: 700 },
    );
  }, [view, ready]);

  return <div ref={container} className="map-canvas" aria-label="Map of your projects" role="img" />;
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div
        className={
          "font-display text-2xl font-bold leading-none tracking-tight " + (bad ? "text-fail" : "text-foreground")
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function TrendPanel({ trends, totals }: { trends: ReturnType<typeof buildTrends>; totals: ReturnType<typeof mapTotals> }) {
  const peak = Math.max(1, ...trends.cohorts.map((cohort) => cohort.raised));
  const change = trends.raisedChange;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Productive proactiveness
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Tile label="Raised this month" value={trends.raisedThisMonth} />
          <Stat
            label="vs last month"
            value={change === null ? "-" : `${change > 0 ? "+" : ""}${change}%`}
            bad={change !== null && change > 0}
          />
          <Stat label="Closed out" value={`${trends.clearanceRate ?? 0}%`} />
          <Stat
            label="Median days to close"
            value={trends.medianDaysToClose === null ? "-" : `${trends.medianDaysToClose}`}
            bad={(trends.medianDaysToClose ?? 0) > 30}
          />
          <Stat label="Closed this month" value={`${trends.closedThisMonth}`} />
          <Stat
            label="Late share of open"
            value={`${trends.overdueShare ?? 0}%`}
            bad={(trends.overdueShare ?? 0) > 0}
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Raised per month
        </p>
        <ul className="mt-2 space-y-1.5">
          {trends.cohorts.map((cohort) => {
            const width = Math.round((cohort.raised / peak) * 100);
            return (
              <li key={cohort.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-14 shrink-0 text-muted-foreground">{cohort.label}</span>
                <span className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70"
                    style={{ width: `${width}%` }}
                  />
                  {cohort.stillOpen > 0 ? (
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm bg-fail"
                      style={{ width: `${Math.round((cohort.overdue / peak) * 100)}%` }}
                    />
                  ) : null}
                </span>
                <span className="w-10 shrink-0 text-right font-bold tabular-nums">{cohort.raised}</span>
                <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                  {cohort.stillOpen} open
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Grey is everything raised that month, red is how much of it is past its date.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          How long the backlog has been open
        </p>
        <ul className="mt-2 space-y-1.5">
          {trends.ageing.map((band) => {
            const widest = Math.max(1, ...trends.ageing.map((entry) => entry.count));
            return (
              <li key={band.label} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 shrink-0 text-muted-foreground">{band.label}</span>
                <span className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70"
                    style={{ width: `${Math.round((band.count / widest) * 100)}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right font-bold tabular-nums">{band.count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Where the process stalls
        </p>
        <ul className="mt-2 space-y-2">
          {trends.stalls.map((stall) => (
            <li key={stall.label} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="text-[12px] font-bold text-foreground">{stall.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {stall.count} open - {stall.detail}
              </div>
            </li>
          ))}
          {trends.stalls.length === 0 ? (
            <li className="text-[11px] text-muted-foreground">Nothing is sitting open.</li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          What this measures
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {trends.depthPerSurvey != null ? `${trends.depthPerSurvey} items per survey on record. ` : ""}
          {trends.medianDaysLate != null ? `Half of the late work is ${trends.medianDaysLate} days late or more. ` : ""}
          {trends.backfilledCloses > 0
            ? `${trends.backfilledCloses} closed items pre-date close-out tracking, so their close date is their last update. `
            : ""}
          {totals.projects} projects in scope. {trends.caveat}
        </p>
      </div>
    </div>
  );
}
