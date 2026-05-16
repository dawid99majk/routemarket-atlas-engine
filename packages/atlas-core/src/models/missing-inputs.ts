import { z } from "zod";

export const MissingInputItemSchema = z.object({
  code: z.string(),
  message: z.string(),
  requiredFor: z.string()
});

export const MissingInputsSchema = z.object({
  projectId: z.string(),
  generatedAt: z.string(),
  blocking: z.boolean(),
  missing: z.array(MissingInputItemSchema)
});

export type MissingInputItem = z.infer<typeof MissingInputItemSchema>;
export type MissingInputs = z.infer<typeof MissingInputsSchema>;
