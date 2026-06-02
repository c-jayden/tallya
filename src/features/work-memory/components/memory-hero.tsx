export function MemoryHero() {
  return (
    <section className="mb-4 grid gap-0" aria-labelledby="today-title">
      <h1
        id="today-title"
        className="mb-2 text-[30px] leading-[1.15] font-bold tracking-normal text-app-ink max-[560px]:text-[28px]"
      >
        今天做了什么？
      </h1>
      <p className="mt-0.5 text-sm leading-[1.55] text-app-ink-muted">
        随便写几句，职迹会帮你整理和沉淀。
      </p>
    </section>
  );
}
