import { JoinTeamForm } from "@/components/TeamForms";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main className="center">
      <div className="panel">
        <h2>Team beitreten</h2>
        <p>Gib noch an, unter welchem Namen dich deine Mannschaft sieht.</p>
        <JoinTeamForm code={decodeURIComponent(code)} />
      </div>
    </main>
  );
}
