export type PlanTier = "free" | "pro" | "product-pro";

export type AppSection =
  | "home"
  | "live"
  | "analysis"
  | "content"
  | "community"
  | "brand"
  | "revenue"
  | "vault"
  | "settings";

export type FeatureStatus = "ready" | "foundation" | "planned";

export interface FeatureDefinition {
  id: string;
  title: string;
  description: string;
  section: AppSection;
  minimumTier: PlanTier;
  status: FeatureStatus;
  localFirst?: boolean;
  ai?: boolean;
}

export interface PlatformBootstrap {
  signedIn: boolean;
  user: {
    id: string;
    name: string;
    username: string | null;
    picture: string | null;
  } | null;
  plan: {
    tier: PlanTier;
    label: string;
    status: string;
  };
  features: string[];
}
