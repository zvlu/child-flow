import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Plain-English definitions for the Head Start / childcare jargon that appears
 * across the app, so staff never need to be *told* what an acronym means —
 * they tap the ⓘ next to it. Keys are uppercased.
 */
export const GLOSSARY: Record<string, { full: string; plain: string }> = {
  PIR: {
    full: "Program Information Report",
    plain: "The report every Head Start program files once a year with the federal Office of Head Start.",
  },
  CACFP: {
    full: "Child & Adult Care Food Program",
    plain: "The USDA program that reimburses your center for serving nutritious meals and snacks.",
  },
  DRDP: {
    full: "Desired Results Developmental Profile",
    plain: "An observation-based assessment of how a child is developing across key areas.",
  },
  ELOF: {
    full: "Early Learning Outcomes Framework",
    plain: "Head Start's framework of what children should learn, grouped into developmental domains.",
  },
  FNA: {
    full: "Family Needs Assessment",
    plain: "A check-in on a family's strengths, needs, and goals.",
  },
  FPA: {
    full: "Family Partnership Agreement",
    plain: "A plan you build together with a family to work toward their goals.",
  },
  CFCR: {
    full: "Child & Family Contact Record",
    plain: "A log of your contacts and interactions with a child's family.",
  },
  ERSEA: {
    full: "Eligibility, Recruitment, Selection, Enrollment & Attendance",
    plain: "The rules for who qualifies for Head Start and how families are enrolled.",
  },
  "IN-KIND": {
    full: "In-Kind (non-federal share)",
    plain: "Donated goods, services, or volunteer time that count toward your program's required funding match.",
  },
  IEP: {
    full: "Individualized Education Program",
    plain: "A plan of special-education services for a child age 3+ with a disability.",
  },
  IFSP: {
    full: "Individualized Family Service Plan",
    plain: "An early-intervention services plan for a child under 3 with a developmental need.",
  },
  "FAMILY ADVOCATE": {
    full: "Family Advocate",
    plain: "The staff member who partners with assigned families — running needs assessments, setting goals, and keeping up regular contact.",
  },
  "MONTHLY CONTACT": {
    full: "Monthly / Routine Contact",
    plain: "The regular monthly check-in a family advocate is expected to have with each assigned family.",
  },
  "COORDINATED SERVICES": {
    full: "Coordinated Service Discussion",
    plain: "A documented conversation that coordinates the services a family receives across programs — health, education, and social services.",
  },
  "SMART GOAL": {
    full: "SMART Goal",
    plain: "A goal that is Specific, Measurable, Achievable, Relevant, and Time-bound — the format used in family partnership agreements.",
  },
};

/**
 * A small "ⓘ" affixed next to a jargon term. Hover/tap reveals a plain-English
 * definition. Usage: `Compliance & PIR <Glossary term="PIR" />`.
 */
export function Glossary({ term, className }: { term: string; className?: string }) {
  const g = GLOSSARY[term.toUpperCase()];
  if (!g) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className={cn("inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors align-middle", className)}
          aria-label={`What is ${term}? ${g.full}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold">{g.full}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{g.plain}</p>
      </TooltipContent>
    </Tooltip>
  );
}
