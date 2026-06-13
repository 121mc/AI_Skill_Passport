import type { PrivacyLevel } from "@shared/types";

export function PrivacyBadge({ privacy }: { privacy: PrivacyLevel }) {
  const label: Record<PrivacyLevel, string> = {
    private: "Private",
    link: "Link share",
    team: "Team",
    public: "Public demo"
  };

  return <span className={`badge ${privacy}`}>{label[privacy]}</span>;
}
