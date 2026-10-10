import { apiOps, type OpsSnapshot } from "./api";

let inflight: Promise<OpsSnapshot> | null = null;

export function loadOps() {
  if (!inflight) {
    inflight = apiOps().catch(err => {
      inflight = null;
      throw err;
    });
  }
  return inflight;
}

export function invalidateOps() {
  inflight = null;
}
