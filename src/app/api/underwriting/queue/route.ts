import { ok, route } from "@/lib/api/http";
import { getUnderwritingQueue } from "@/services/underwriting-service";


export const GET = route(async () => {
  const queue = await getUnderwritingQueue();
  return ok(queue);
});
