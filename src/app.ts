import { Express } from "express";
import cors from "cors";
import { adminRouter } from "./controllers/adminController";
import { streamEventsRouter } from "./controllers/streamEventsController";
import { featuresRouter } from "./controllers/featuresController";
import proxyMiddleware from "./middleware/proxyMiddleware";
import {featuresCache, initializeCache} from "./services/cache";
import {EndpointsEntry, initializeRegistrar, Registrar, registrar} from "./services/registrar";
import {EventStreamManager, eventStreamManager} from "./services/sse";

export interface GrowthBookProxy {
  app: Express;
  context: Context;
  services: {
    featuresCache: typeof featuresCache;
    registrar: Registrar;
    eventStreamManager: EventStreamManager
  }
}

export interface Context {
  endpoints?: Partial<EndpointsEntry>;
  createEndpointsFromEnv: boolean;
  enableCache: boolean;
  cacheSettings: {
    cacheEngine: "memory" | "redis";
    staleTTL: number;
    expiresTTL: number;
    allowStale: boolean;
    connectionUrl?: string;
    useAdditionalMemoryCache?: boolean;
  };
  enableCors: boolean;
  enableAdmin: boolean;
  enableSsePush: boolean;
  proxyAllRequests: boolean;
}

const defaultContext: Context = {
  createEndpointsFromEnv: true,
  enableCache: true,
  cacheSettings: {
    cacheEngine: "memory",
    staleTTL: 60, //        1 min,
    expiresTTL: 10 * 60, // 10 min,
    allowStale: true,
  },
  enableCors: true,
  enableAdmin: true,
  enableSsePush: true,
  proxyAllRequests: false,
};

export const growthBookProxy = async (
  app: Express,
  context?: Partial<Context>
): Promise<GrowthBookProxy> => {
  const ctx: Context = { ...defaultContext, ...context };

  // initialize
  initializeRegistrar(ctx);
  ctx.enableCache && (await initializeCache(ctx));

  // set up handlers
  ctx.enableCors && app.use(cors());
  ctx.enableAdmin && app.use("/admin", adminRouter);
  ctx.enableSsePush && app.use("/sub", streamEventsRouter);
  app.use("/", featuresRouter);
  ctx.proxyAllRequests && app.all("/*", proxyMiddleware);

  return {
    app,
    context: ctx,
    services: {
      featuresCache,
      registrar,
      eventStreamManager,
    }
  };
};