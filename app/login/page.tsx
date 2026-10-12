import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="center">
      <div className="panel">
        <h2>Kaderplan</h2>
        <p>Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Link und einen 6-stelligen Code.</p>
        {sp.error && <p className="error">Der Link ist abgelaufen oder ungültig. Fordere einen neuen an.</p>}
        <LoginForm next={sp.next ?? "/"} />
      </div>
    </main>
  );
}
