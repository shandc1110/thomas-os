export type Product = {
  id: string | number;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  stock: number | null;
  active: boolean | null;
  created_at: string | null;
};
