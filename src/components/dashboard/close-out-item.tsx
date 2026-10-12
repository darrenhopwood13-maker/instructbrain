import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { firstNonEmptyText, daysLate, type DashboardItem } from "@/lib/analytics/item-map";
import { CLOSE_OUT_NOTE_LIMIT, closeOutRefusal } from "@/lib/report/close-out";
import { closeOutItem } from "@/lib/report/close-out.functions";

/**
 * Closing an overdue item out, from the dashboard.
 *
 * Dal asked for this on 12 Oct 2026: "the ability for the report creator to close
 * overdue items with a photo or comment from the dashboard". Before this, the only
 * way to close an item was to open its report.
 *
 * The rule the server enforces is shown here first, live, before anything is typed
 * into a form that would only be refused at the end - so "add a comment or a
 * photograph" is a sentence on the screen rather than an error after a submit.
 *
 * The photograph goes in as the `closeout` role the product has always had a slot
 * for, so it sits beside the original finding photograph rather than replacing it:
 * what was found, and what was done about it, in one item.
 */
export function CloseOutItem({ item, today }: { item: DashboardItem; today: string }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<{ base64: string; mimeType: string; filename: string; preview: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const closeOut = useServerFn(closeOutItem);

  const refusal = useMemo(
    () => closeOutRefusal({ lifecycleState: item.lifecycleState, comment, hasPhoto: Boolean(photo) }),
    [item.lifecycleState, comment, photo],
  );

  const late = daysLate(item, today);

  const mutation = useMutation({
    mutationFn: () =>
      closeOut({
        data: {
          findingId: item.id,
          reportId: item.reportId,
          comment: comment.trim() ? comment.trim() : null,
          photo: photo
            ? { base64: photo.base64, mimeType: photo.mimeType, filename: photo.filename }
            : null,
        },
      }),
    onSuccess: async () => {
      setOpen(false);
      setComment("");
      setPhoto(null);
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "items"] });
      toast.success("Item closed out", {
        description: photo ? "With the photograph attached." : "With your comment.",
      });
    },
    onError: (error) =>
      toast.error("That item was not closed", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  async function attach(file: File | undefined) {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("That photograph could not be read."));
      reader.readAsDataURL(file);
    });
    const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (!match) throw new Error("That photograph could not be read.");
    const [, mimeType = "", base64 = ""] = match;
    if (!base64) throw new Error("That photograph came through empty.");
    setPhoto({ base64, mimeType, filename: file.name, preview: dataUrl });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-9 px-2.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Check aria-hidden="true" className="size-3.5" />
        Close out
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Close this item out</DialogTitle>
            <DialogDescription>
              {firstNonEmptyText(item.title, item.ref)}
              {item.ref ? ` · ${item.ref}` : ""}
              {late === null ? "" : ` · ${late} day${late === 1 ? "" : "s"} past its date`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor="close-out-comment">
              What was done
            </label>
            <textarea
              id="close-out-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={CLOSE_OUT_NOTE_LIMIT}
              rows={3}
              placeholder="Verified on site: eaves tray replaced and the wall dried out."
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            />
            <p className="text-right text-xs text-muted-foreground">
              {comment.length}/{CLOSE_OUT_NOTE_LIMIT}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => void attach(event.target.files?.[0])}
              />
              <Button type="button" variant="outline" className="min-h-10" onClick={() => fileRef.current?.click()}>
                <Camera aria-hidden="true" />
                {photo ? "Change photograph" : "Add a photograph"}
              </Button>
              {photo ? (
                <img
                  src={photo.preview}
                  alt="The photograph you are attaching"
                  className="size-14 rounded-lg border border-border object-cover"
                />
              ) : null}
            </div>

            {refusal ? (
              <p className="text-xs text-muted-foreground">{refusal}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The item is marked closed and its history names you. The issued report itself is
                not changed.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="brand"
                className="min-h-11"
                disabled={Boolean(refusal) || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
                Close this item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
