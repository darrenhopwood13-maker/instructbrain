import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadCompliancePack } from "@/lib/compliance/pack.functions";

/**
 * The pack is built when a person presses this button, never sent anywhere on
 * its own. It carries the register, every point's answers, the photographs and
 * the actions with their close-out evidence.
 */
export function PackDownloadButton({
  projectId,
  checkType,
  runId = null,
  label,
  variant = "outline",
  className,
}: {
  projectId: string;
  checkType: string;
  runId?: string | null;
  label: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const build = useServerFn(downloadCompliancePack);

  const pack = useMutation({
    mutationFn: () => build({ data: { projectId, checkType, runId } }),
    onSuccess: (result) => {
      const binary = atob(result.content);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Compliance pack downloaded", { description: result.filename });
    },
    onError: (error: unknown) =>
      toast.error("The pack could not be built", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => pack.mutate()}
      disabled={pack.isPending}
    >
      <Download aria-hidden="true" className="size-4" />
      {pack.isPending ? "Building pack…" : label}
    </Button>
  );
}
