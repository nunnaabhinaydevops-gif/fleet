import { Clock3 } from "lucide-react";
import { FleetLayout } from "./Index";

type ComingSoonPageProps = {
  title: string;
  onSignOut: () => void;
};

export default function ComingSoonPage({ title, onSignOut }: ComingSoonPageProps) {
  return (
    <FleetLayout onSignOut={onSignOut} activeNav={title}>
      <div className="coming-soon-page">
        <section className="coming-soon-card">
          <span className="coming-soon-icon"><Clock3 size={25} /></span>
          <span className="coming-soon-eyebrow">Fleet workspace</span>
          <h1>{title}</h1>
          <p>This section is being prepared and will be available soon.</p>
        </section>
      </div>
    </FleetLayout>
  );
}
