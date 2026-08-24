import AIChat from "../components/AIChat";

export default function Coach() {
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Coach IA</h1>
        <p className="text-sm text-ink-soft mt-0.5">
          Tu coach personal conoce tus hábitos y tu diario reciente. Pregúntale lo que quieras.
        </p>
      </div>
      <AIChat />
    </div>
  );
}
