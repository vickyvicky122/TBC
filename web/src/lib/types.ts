export type Contact = {
  name: string;
  role: string;
  email: string;
  demo?: boolean;
  demoEmail?: boolean;
};

export type PastEvent = {
  name: string;
  role: string;
  demo?: boolean;
  confirmed?: boolean;
};

export type EventApplication = {
  id: string;
  slug: string;
  name: string;
  community: string;
  contact: Contact | null;
  purpose: string;
  oneLine?: string;
  date: string;
  dateDemo?: boolean;
  location: string;
  expectedAttendance: number | null;
  attendanceDemo?: boolean;
  audience: string;
  supportRequested: string[];
  benefitsOffered: string[];
  applicationDeadline: string;
  deadlineDemo?: boolean;
  tracks: string[];
  leadTimeWeeks: number | null;
  rating: number;
  pastEvents: PastEvent[];
  prospectusText?: string | null;
  prospectusCover?: string | null;
  logoData?: string | null;
  submitted: boolean;
  demo: boolean;
  missingFields?: string[];
};

export type SponsorProfile = {
  id: string;
  name: string;
  kind: string;
  source: string;
  sourceConfirmed: boolean;
  tagline?: string;
  logoData?: string | null;
  contact: Contact | null;
  goals: string;
  targetAudience: string;
  minRequirements: string;
  supportAvailable: string[];
  limits: string;
  benefitsExpected: string[];
  tracksLookingFor: string[];
  leadTimeWeeks: number | null;
  rating: number;
  pastEvents: PastEvent[];
  demo: boolean;
};

export type Terms = {
  funding: string;
  credits: string;
  venue: string;
  mentors: string;
  prizes: string;
  promotion: string;
  recruitment: string;
  notes: string;
};

export type Message = {
  id: string;
  authorRole: "organiser" | "sponsor" | "system";
  authorName: string;
  body: string;
  createdAt: string;
};

export type PartnershipRequest = {
  id: string;
  eventId: string;
  sponsorId: string;
  initiatedBy: "organiser" | "sponsor";
  status: "requested" | "counter" | "confirmed" | "declined";
  terms: Terms;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

export type ComponentScores = {
  audience: number;
  tracks: number;
  support: number;
  location: number;
  leadTime: number;
  history: number;
};

export type Match = {
  eventId: string;
  sponsorId: string;
  score: number;
  rankBoost: number;
  source: "cognee" | "graph" | "hybrid";
  components?: ComponentScores;
  explanation: {
    whyRelevant: string;
    aligned: string[];
    missing: string[];
    supporting: string[];
    connections: string[];
  };
};

export const emptyTerms = (): Terms => ({
  funding: "",
  credits: "",
  venue: "",
  mentors: "",
  prizes: "",
  promotion: "",
  recruitment: "",
  notes: "",
});

export const SUPPORT = ["funding", "credits", "venue", "mentors", "prizes"] as const;

export const SAMPLE_COVER = "/prospectus/impact-hack-cover.png";
