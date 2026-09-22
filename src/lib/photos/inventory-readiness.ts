import type { PhotoWorkflow } from "@/lib/survey-types";

/**
 * A step the person still has to complete before a room-schedule report can be
 * generated. The wording is generic; every discipline term comes from the
 * template's own photo workflow.
 */
export type ReadinessStep = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

type ReadinessPhoto = {
  id: string;
  sequence?: number | null;
  capture_fields?: Record<string, string> | null;
};

function roomOf(workflow: PhotoWorkflow, photo: ReadinessPhoto): string {
  if (!workflow.sectionField) return "";
  return (photo.capture_fields?.[workflow.sectionField] ?? "").trim();
}

function roleOf(workflow: PhotoWorkflow, photo: ReadinessPhoto): string {
  return (photo.capture_fields?.[workflow.roleField] ?? "").trim();
}

/**
 * Signposts the extra steps a room-schedule template needs — a title-page
 * photograph, named rooms, room overview photographs and every other
 * photograph allocated — so none of them is a surprise at generation time.
 */
export function inventoryReadiness(
  workflow: PhotoWorkflow | null,
  photos: ReadinessPhoto[],
  coverPhotoId: string | null,
): ReadinessStep[] {
  if (!workflow || photos.length === 0) return [];

  const coverRoles = new Set(
    [workflow.coverRoleId, workflow.firstPhotoRoleId].filter(
      (value): value is string => typeof value === "string" && value !== "",
    ),
  );
  const maxOverviews = workflow.maxOverviewPhotos ?? 3;

  const coverChosen =
    (coverPhotoId !== null && photos.some((photo) => photo.id === coverPhotoId)) ||
    photos.some((photo) => coverRoles.has(roleOf(workflow, photo)));

  const roomPhotos = photos.filter((photo) => !coverRoles.has(roleOf(workflow, photo)));
  const rooms = new Map<string, { label: string; overviews: number; items: number }>();
  let unallocated = 0;
  for (const photo of roomPhotos) {
    if (coverPhotoId !== null && photo.id === coverPhotoId) continue;
    const room = roomOf(workflow, photo);
    if (room === "") {
      unallocated += 1;
      continue;
    }
    const key = room.toLowerCase();
    const entry = rooms.get(key) ?? { label: room, overviews: 0, items: 0 };
    if (workflow.overviewRoleId && roleOf(workflow, photo) === workflow.overviewRoleId) {
      entry.overviews += 1;
    } else {
      entry.items += 1;
    }
    rooms.set(key, entry);
  }

  const roomList = [...rooms.values()];
  const shortOfOverviews = roomList.filter((room) => room.overviews < maxOverviews);

  const steps: ReadinessStep[] = [
    {
      id: "cover",
      label: "Title page photograph chosen",
      detail: coverChosen
        ? "The title page photograph is set."
        : "Pick one photograph to use as the title page.",
      done: coverChosen,
    },
    {
      id: "rooms",
      label: "Rooms created",
      detail:
        roomList.length === 0
          ? "Create a room, then add its photographs to it."
          : `${roomList.length} room${roomList.length === 1 ? "" : "s"}: ${roomList
              .map((room) => room.label)
              .join(", ")}`,
      done: roomList.length > 0,
    },
    {
      id: "allocated",
      label: "Every photograph allocated",
      detail:
        unallocated === 0
          ? "All photographs sit in a room."
          : `${unallocated} photograph${unallocated === 1 ? "" : "s"} not in a room yet.`,
      done: unallocated === 0 && roomList.length > 0,
    },
  ];

  if (workflow.overviewRoleId) {
    steps.push({
      id: "overviews",
      label: `${maxOverviews} room photographs per room`,
      detail:
        roomList.length === 0
          ? `Pick ${maxOverviews} wide photographs in each room.`
          : shortOfOverviews.length === 0
            ? "Every room has its room photographs."
            : `Still needed in: ${shortOfOverviews
                .map((room) => `${room.label} (${room.overviews} of ${maxOverviews})`)
                .join(", ")}`,
      done: roomList.length > 0 && shortOfOverviews.length === 0,
    });
  }

  return steps;
}

/** How many of the signposted steps are still outstanding. */
export function outstandingReadiness(steps: ReadinessStep[]): number {
  return steps.filter((step) => !step.done).length;
}
