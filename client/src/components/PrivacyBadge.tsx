import type { PrivacyLevel } from "@shared/types";

export function PrivacyBadge({ privacy }: { privacy: PrivacyLevel }) {
  const label: Record<PrivacyLevel, string> = {
    private: "私有",
    link: "链接分享",
    team: "团队",
    public: "公开演示"
  };

  return <span className={`badge ${privacy}`}>{label[privacy]}</span>;
}
