import { z } from 'zod';

export const VersionSchema = z.object({
  branch: z.string().optional(),
  commitHash: z.string().optional(),
  commitTitle: z.string().optional(),
  buildDate: z.string().optional(),
});

export type Version = z.infer<typeof VersionSchema>;
