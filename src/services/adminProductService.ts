import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  pricing: Record<string, unknown>;
  status: "active" | "inactive";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  pricing?: Record<string, unknown>;
  status?: "active" | "inactive";
}

export const adminProductService = {
  async list(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
  },

  async create(input: ProductInput, userId: string): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...input, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async toggleStatus(id: string, currentStatus: string): Promise<Product> {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    return this.update(id, { status: newStatus as "active" | "inactive" });
  },
};
