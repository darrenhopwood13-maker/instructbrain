import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RoomProposal } from "@/lib/photos/room-suggest";

/**
 * Proposing rooms for a report's photographs. Read-only: the proposal comes
 * back to the browser and a person applies it. The provider key stays here.
 */
export const suggestRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const reportId = (input as Record<string, unknown>)?.["reportId"];
    const id = typeof reportId === "string" ? reportId.trim() : "";
    if (id === "") throw new Error("A report id is required.");
    return { reportId: id };
  })
  .handler(async ({ data, context }): Promise<RoomProposal> => {
    const { suggestRoomsForReport } = await import("@/lib/photos/rooms.server");
    return suggestRoomsForReport(context.supabase as never, data.reportId);
  });
