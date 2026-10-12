import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function FormField({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11" {...props} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}