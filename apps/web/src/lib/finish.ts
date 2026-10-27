export type LensFinish = "solid" | "gradient" | "mirror";

export const finishFor = (lensColor: string, lensTypes: string[] = []): LensFinish =>
  /mirror/i.test(lensColor) ? "mirror" : /gradient/i.test(lensColor) || (lensTypes.includes("gradient") && !lensTypes.includes("mirrored")) ? "gradient" : "solid";
