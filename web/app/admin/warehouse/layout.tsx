import { OpsNav } from "@/components/warehouse/WarehouseUI";

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg px-4 pb-24 pt-6">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-widest text-muted">Warehouse Ops</p>
        <h1 className="font-serif text-2xl text-espresso">Fulfilment</h1>
      </header>
      <OpsNav />
      {children}
    </div>
  );
}
