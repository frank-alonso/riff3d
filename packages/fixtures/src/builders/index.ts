// Builder API
export { SceneBuilder, EntityBuilder, createDeterministicIdGenerator } from "./builder.js";

// Golden fixtures (6 clean + 1 adversarial)
export { buildTransformsParentingFixture } from "./transforms-parenting.js";
export { buildMaterialsLightsFixture } from "./materials-lights.js";
export { buildAnimationFixture } from "./animation.js";
export { buildEventsTriggersFixture } from "./events-triggers.js";
export { buildCharacterStubFixture } from "./character-stub.js";
export { buildTimelineStubFixture } from "./timeline-stub.js";
export { buildAdversarialFixture } from "./adversarial.js";
