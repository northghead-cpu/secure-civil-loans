import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const CRBRequestSchema = z.object({
  nrc_number: z
    .string()
    .trim()
    .min(8, "nrc_number too short")
    .max(20, "nrc_number too long")
    .regex(/^[0-9/\s-]+$/, "nrc_number contains invalid characters"),
  full_name: z
    .string()
    .trim()
    .min(2, "full_name too short")
    .max(120, "full_name too long")
    .regex(/^[A-Za-z][A-Za-z\s'.-]*$/, "full_name contains invalid characters"),
}).strict();
