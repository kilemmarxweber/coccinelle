import { Leaf, ShieldCheck, Store, Wallet } from "lucide-react";

const features = [
  { icon: Wallet, label: "Encaissement du jour" },
  { icon: Store, label: "Stocks des départements" },
  { icon: ShieldCheck, label: "Versements centralisés" },
  { icon: Leaf, label: "Rapports PDF et Excel" },
];

export function SignInPanel(props: {
  name: string;
  names: string[];
  index: number;
  branchCount: number;
}) {
  return (
    <aside className="relative flex h-56 shrink-0 flex-col justify-end overflow-hidden text-white sm:h-72 lg:h-auto lg:min-h-svh lg:justify-between">
      <img
        src="/cafe-yayo.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[#0e6b3c]/78" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c5a34] via-[#0e6b3c]/40 to-[#157a3c]/20" />

      {props.branchCount > 0 ? (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-2.5 py-1.5 backdrop-blur-md sm:top-6 sm:right-6 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/20 sm:size-9 sm:rounded-xl">
            <Store className="size-3.5 sm:size-4" />
          </span>
          <span>
            <span className="block text-xs font-semibold leading-none sm:text-sm">
              {props.branchCount}
            </span>
            <span className="text-[10px] text-white/80 sm:text-[11px]">
              {props.branchCount > 1 ? "départements" : "département"}
            </span>
          </span>
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-end px-5 pb-4 text-center sm:justify-center sm:px-8 sm:pb-0 lg:px-10">
        <span className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-md sm:mb-6 sm:size-16">
          <Leaf className="size-5 sm:size-7" />
        </span>
        <h2
          key={props.name}
          aria-live="polite"
          className="max-w-full px-2 text-3xl font-bold tracking-tight text-balance break-words sm:text-4xl lg:max-w-md lg:text-5xl"
        >
          {props.name}
        </h2>
        {props.names.length > 1 ? (
          <div className="mt-3 flex items-center gap-1.5" aria-hidden>
            {props.names.map((name, dot) => (
              <span
                key={name}
                className={
                  dot === props.index
                    ? "h-1.5 w-5 rounded-full bg-white"
                    : "size-1.5 rounded-full bg-white/45"
                }
              />
            ))}
          </div>
        ) : null}
        <p className="mt-3 hidden max-w-sm text-sm leading-relaxed text-white/85 sm:block">
          Caisse, stocks, versements et rapports des départements, dans un seul espace.
        </p>
        <ul className="mt-6 hidden max-w-md flex-wrap justify-center gap-2 lg:flex">
          {features.map((feature) => (
            <li
              key={feature.label}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
            >
              <feature.icon className="size-3.5 text-[#d7efe2]" />
              {feature.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 hidden px-10 pb-10 text-3xl text-white italic lg:block">
        {props.name}, chaque service.
      </p>
    </aside>
  );
}
