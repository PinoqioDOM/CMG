import { priorityLabels } from "@/lib/labels";
import { DeleteButton } from "@/components/delete-button";
import { IncidentStatusSelect } from "./incident-status-select";
import { deleteIncident } from "./actions";

export type Incident = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  performer: string | null;
  status: string;
  priority: string;
  created_at: string;
  photo_url: string | null;
};

export function IncidentList({
  incidents,
  photoUrls,
}: {
  incidents: Incident[];
  photoUrls: Record<string, string>;
}) {
  if (incidents.length === 0) {
    return <p className="text-muted-foreground">ჩანაწერები არ არის</p>;
  }
  return (
    <div className="space-y-3">
      {incidents.map((i) => {
        const date = i.created_at.slice(0, 10).split("-").reverse().join(".");
        const photo = i.photo_url ? photoUrls[i.photo_url] : null;
        return (
          <div key={i.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 font-medium leading-snug">{i.title}</div>
              <IncidentStatusSelect id={i.id} status={i.status} />
              <DeleteButton
                action={deleteIncident.bind(null, i.id)}
                title="ინციდენტის წაშლა"
                description={`„${i.title}" სამუდამოდ წაიშლება${i.photo_url ? " ფოტოსთან ერთად" : ""}.`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded bg-muted px-2 py-0.5">📅 {date}</span>
              {i.location && <span className="rounded bg-muted px-2 py-0.5">📍 {i.location}</span>}
              {i.performer && <span className="rounded bg-muted px-2 py-0.5">🔧 {i.performer}</span>}
              {i.priority === "high" && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">
                  {priorityLabels.high}
                </span>
              )}
            </div>
            {i.description && (
              <p className="line-clamp-4 text-sm text-muted-foreground">{i.description}</p>
            )}
            {photo && (
              <a href={photo} target="_blank" rel="noreferrer" className="text-sm underline">
                ფოტოს ნახვა
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}