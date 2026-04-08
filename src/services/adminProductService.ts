import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  pricing: Json;
  status: "active" | "inactive";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  pricing?: Json;
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
      .insert([{ ...input, created_by: userId }])
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.pricing !== undefined) payload.pricing = input.pricing;
    if (input.status !== undefined) payload.status = input.status;
    const { data, error } = await supabase
      .from("products")
      .update(payload as { name?: string; description?: string; pricing?: Json; status?: string })
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
