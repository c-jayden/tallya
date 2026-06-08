type MemoryHeroProps = {
  title: string;
  description: string;
  selectedDateHint?: string;
};

export function MemoryHero({ title, description, selectedDateHint }: MemoryHeroProps) {
  return (
    <section className="mb-4 grid gap-0" aria-labelledby="today-title">
      <h1
        id="today-title"
        className="mb-2 text-3xl leading-[1.15] font-bold tracking-normal text-app-ink max-[560px]:text-[28px]"
      >
        {title}
      </h1>
      <p className="mt-0.5 text-sm leading-[1.55] text-app-ink-muted">
        {description}
      </p>
      {selectedDateHint ? (
        <p className="mt-1 text-[13px] leading-[1.45] text-app-ink-subtle">{selectedDateHint}</p>
      ) : null}
    </section>
  );
}
