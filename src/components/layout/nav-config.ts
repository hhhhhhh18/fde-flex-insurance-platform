import {
  BadgeAlert,
  Building2,
  ClipboardCheck,
  FileBarChart,
  FileCheck2,
  FileText,
  Gauge,
  Package,
  RefreshCw,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** False while the page is not implemented yet; rendered as disabled, never as a dead link. */
  enabled: boolean;
  phase?: 1 | 2 | 3;
  description: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: Gauge, enabled: true, phase: 1, description: "Portfolio health at a glance" },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { label: "Applicants", href: "/applicants", icon: Users, enabled: true, phase: 2, description: "Customer records" },
      { label: "Insured assets", href: "/assets", icon: Building2, enabled: true, phase: 2, description: "Scheduled risks" },
      { label: "Products", href: "/products", icon: Package, enabled: true, phase: 2, description: "Products and coverage options" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { label: "Quotes", href: "/quotes", icon: FileText, enabled: true, phase: 2, description: "Rating and eligibility" },
      { label: "Policies", href: "/policies", icon: ShieldCheck, enabled: true, phase: 2, description: "In-force and cancelled cover" },
      { label: "Renewals", href: "/renewals", icon: RefreshCw, enabled: true, phase: 2, description: "Renewal offers and outcomes" },
      { label: "Endorsements", href: "/endorsements", icon: FileCheck2, enabled: true, phase: 2, description: "Mid-term changes" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Underwriting", href: "/underwriting", icon: ClipboardCheck, enabled: true, phase: 3, description: "Referral work queue" },
      { label: "Exceptions", href: "/exceptions", icon: BadgeAlert, enabled: true, phase: 3, description: "Validation findings" },
      { label: "Reports", href: "/reports", icon: FileBarChart, enabled: true, phase: 3, description: "Metrics and exports" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
