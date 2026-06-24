export interface Visit {
  id: string;
  patient_ptnum?: string;
  transcript: string;
  note: string;
  template_name?: string;
  language?: string;
  audio_path?: string;
  status: "processing" | "complete" | "failed";
  created_at: string;
  updated_at: string;
}

export function formatVisitDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
