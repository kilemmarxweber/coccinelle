import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Client hôtel : un peu plus large que le funnel voyage (desk + tablette). */
export default function ClientHotelLayout({ children }: Props) {
  return (
    <div className="relative left-1/2 w-[min(100vw-2rem,42rem)] -translate-x-1/2 sm:w-[min(100vw-2rem,48rem)]">
      {children}
    </div>
  );
}
