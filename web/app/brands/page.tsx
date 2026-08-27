import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Brands | Chosen by Chloe",
  description: "Browse curated brand collections from Chosen by Chloe.",
};

/** Alias — brand hub lives on `/`. */
export default function BrandsIndexPage() {
  redirect("/");
}
