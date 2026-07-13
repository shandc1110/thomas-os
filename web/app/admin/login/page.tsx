import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-white/70" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
