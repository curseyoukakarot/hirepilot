declare module "@modelcontextprotocol/sdk" {
  import { z } from "zod";

  export const z: typeof import("zod");

  export interface ToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
    name: string;
    description?: string;
    parameters?: T;
    run: (params: z.infer<T>) => Promise<any> | any;
  }

  export function createServer(config: any): {
    registerTool: <T extends z.ZodTypeAny>(def: ToolDefinition<T>) => void;
    serve: (transport: any) => void;
  };

  export class StdioServerTransport {
    constructor();
  }
} 