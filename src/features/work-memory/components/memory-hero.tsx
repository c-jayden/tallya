type MemoryHeroProps = {
  title: string;
  description: string;
  selectedDateHint?: string;
};

export function MemoryHero({ title, description, selectedDateHint }: MemoryHeroProps) {
  return (
    <section className="mb-3.5 grid gap-0" aria-labelledby="today-title">
      <h1
        id="today-title"
        className="mb-1 text-2xl leading-[1.2] font-bold tracking-normal text-app-ink max-[560px]:text-[22px]"
      >
        {title}
      </h1>
      <p className="text-[13px] leading-[1.5] text-app-ink-muted">{description}</p>
      {selectedDateHint ? (
        <p className="mt-1 text-[13px] leading-[1.45] text-app-ink-subtle">{selectedDateHint}</p>
      ) : null}
    </section>
  );
}
