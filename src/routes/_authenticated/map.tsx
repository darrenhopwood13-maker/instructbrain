import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/query-states";
import { orgDashboardQuery } from "@/lib/data";
import { projectPoints, type ProjectPoint } from "@/lib/map/project-points.functions";
import { countsByProject, mapCaveats, mapTotals, type ProjectCounts } from "@/lib/map/summary";
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
 * Brand colours for the map, in hex because MapLibre has no oklch parser.
 * Converted from the same tokens the app declares - oklch(87.73% .2803 139.6) is
 * #57ff00, oklch(74% .2 13) is #ff6a86, oklch(34.2% .091 262.9) is #1e3667 - so the
 * basemap and the chrome cannot drift apart. See /public/map/ib-console-style.json.
 */
const ACCENT = "#57ff00";
const FAIL = "#ff6a86";
const INK = "#1e3667";
const OPEN = "#d6dae1";

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
  const totals = useMemo(() => mapTotals(points, counts), [points, counts]);
  const caveats = useMemo(() => mapCaveats(totals), [totals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = points.find((p) => p.projectId === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const loading = pointsQuery.isPending || itemsQuery.isPending;
  const failed = pointsQuery.isError || itemsQuery.isError;

  return (
    <AppShell surface="light">
      <style>{`
        .map-screen { --map-border: var(--border); }
        .map-screen .map-canvas { position: absolute; inset: 0; }
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

      <div className="map-screen -mx-4 flex min-h-0 flex-col sm:-mx-6 lg:-mx-10">
        <header className="flex flex-wrap items-end justify-between gap-3 px-4 pb-4 sm:px-6 lg:px-10">
          <div className="min-w-0">
            <p className="eyebrow">Geography</p>
            <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">Where the work is</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Every project pinned from the postcode on its record. Green is on track, red is past
              its target date.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {loading ? "Placing your projects…" : `${totals.pinned} of ${totals.projects} placed`}
          </p>
        </header>

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
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="relative h-[56vh] border-y border-border lg:h-[calc(100dvh-11rem)] lg:border-b-0 lg:border-r">
              <MapCanvas
                points={points}
                counts={counts}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              {loading ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/40">
                  <LoadingState label="Placing your projects…" />
                </div>
              ) : null}
            </div>

            <aside className="min-h-0 overflow-y-auto border-b border-border px-4 py-4 sm:px-6 lg:px-5">
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
                Pins come from the postcode on the project address, resolved with postcodes.io - free,
                no key, UK only. A project with no postcode cannot be placed and is counted rather than
                hidden. Items and target dates are the same figures the dashboard reads.
              </p>
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
 * Street level, from Mapillary.
 *
 * Chosen for the licence as much as the price: imagery is CC BY-SA, so a photograph can
 * be kept and printed inside a report with attribution, which Google's terms do not
 * allow. The token is read from the build environment (VITE_MAPILLARY_TOKEN) because a
 * token in the bundle is public - in production this lookup belongs on the server.
 *
 * With no token the pane says so and stays empty. An empty state is honest; a stock
 * photograph standing in for a site is not.
 */
function StreetLevel({ point }: { point: ProjectPoint }) {
  const token = (import.meta.env["VITE_MAPILLARY_TOKEN"] as string | undefined) ?? "";
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "none" } | { kind: "error"; reason: string } | {
      kind: "image";
      url: string;
      when: string;
      id: string;
    }
  >({ kind: "idle" });

  const key = `${point.latitude},${point.longitude}`;

  useEffect(() => {
    if (!token || point.latitude === null || point.longitude === null) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    const d = 0.00045;
    const e = 0.0003;
    const bbox = [point.longitude - d, point.latitude - e, point.longitude + d, point.latitude + e].join(",");
    const url =
      "https://graph.mapillary.com/images?access_token=" +
      encodeURIComponent(token) +
      "&fields=id,thumb_1024_url,captured_at&limit=1&bbox=" +
      bbox;

    void fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Mapillary answered ${response.status}`);
        return response.json() as Promise<{ data?: Array<{ id: string; thumb_1024_url?: string; captured_at?: number }> }>;
      })
      .then((body) => {
        if (cancelled) return;
        const image = body.data?.[0];
        if (!image?.thumb_1024_url) {
          setState({ kind: "none" });
          return;
        }
        setState({
          kind: "image",
          url: image.thumb_1024_url,
          when: image.captured_at ? formatDate(new Date(image.captured_at).toISOString()) : "date unknown",
          id: image.id,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: "error", reason: error instanceof Error ? error.message : String(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [key, token, point.latitude, point.longitude]);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-sunken">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-brand-accent">
          Mapillary
        </span>
      </div>

      {!token ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Street level is switched to Mapillary - free, crowdsourced, no billing account. It needs an
          access token before it can fetch a photograph, and this pane stays empty rather than showing
          one that is not your site.
        </p>
      ) : state.kind === "loading" ? (
        <p className="px-3 py-3 text-[11.5px] text-muted-foreground">Looking for imagery within 50m…</p>
      ) : state.kind === "none" ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          No Mapillary imagery within 50 metres of this address. New-build and rural sites often have
          none - a coverage gap, not a fault in the app.
        </p>
      ) : state.kind === "error" ? (
        <p className="px-3 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Mapillary could not be reached: {state.reason}. Nothing has been substituted for it.
        </p>
      ) : state.kind === "image" ? (
        <>
          <img src={state.url} alt={`Street level at ${point.address}`} className="mt-2 w-full" />
          <p className="px-3 py-2 text-[10.5px] text-muted-foreground">
            Captured {state.when} · © Mapillary contributors, CC BY-SA 4.0 ·{" "}
            <a
              href={`https://www.mapillary.com/map/im/${state.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              open on Mapillary
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}

type MapCanvasProps = {
  points: ProjectPoint[];
  counts: Map<string, ProjectCounts>;
  selectedId: string | null;
  onSelect: (projectId: string) => void;
};

/**
 * The map itself, loaded on demand.
 *
 * MapLibre is dynamically imported so the map code is not in the bundle for anyone who
 * never opens this screen. The style is a static document in /public/map, recoloured
 * from the app's own tokens; the tiles are OpenFreeMap's, which are free for product
 * use as well as prototypes - OpenStreetMap's own raster tiles are not, which is why
 * the prototype note about a paid contract does not apply to this route.
 */
function MapCanvas({ points, counts, selectedId, onSelect }: MapCanvasProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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

      const instance = new maplibregl.Map({
        container: container.current,
        style: "/map/ib-console-style.json",
        center: [-0.11, 51.521],
        zoom: 10.6,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      instance.on("load", () => {
        instance.addSource("projects", { type: "geojson", data: features });

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
            "circle-stroke-color": INK,
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
            "circle-stroke-color": OPEN,
          },
        });

        instance.on("click", "project-pins", (event: import("maplibre-gl").MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.["projectId"];
          if (typeof id === "string") onSelectRef.current(id);
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

  return <div ref={container} className="map-canvas" aria-label="Map of your projects" role="img" />;
}
