import { AlertTriangle, Apple, Accessibility, Star } from "lucide-react";

export type ChildFlag = {
  id: number | string;
  childId?: number;
  type: string; // allergy | dietary | disability | special
  label: string;
  detail?: string | null;
};

const STYLES: Record<string, { cls: string; Icon: typeof AlertTriangle }> = {
  allergy: { cls: "bg-red-100 text-red-800", Icon: AlertTriangle },
  dietary: { cls: "bg-amber-100 text-amber-800", Icon: Apple },
  disability: { cls: "bg-indigo-100 text-indigo-800", Icon: Accessibility },
  special: { cls: "bg-blue-100 text-blue-800", Icon: Star },
};

export function FlagChip({ flag }: { flag: ChildFlag }) {
  const s = STYLES[flag.type] ?? STYLES.special;
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
      title={flag.detail ?? flag.label}
    >
      <Icon className="h-3 w-3" />
      {flag.label}
    </span>
  );
}

export function FlagChips({ flags, limit }: { flags: ChildFlag[]; limit?: number }) {
  if (!flags?.length) return null;
  const shown = limit ? flags.slice(0, limit) : flags;
  const extra = limit && flags.length > limit ? flags.length - limit : 0;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((f) => (
        <FlagChip key={f.id} flag={f} />
      ))}
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
    </div>
  );
}
